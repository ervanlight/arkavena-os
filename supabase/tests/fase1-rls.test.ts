import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asUser, closePool, expectRejection, sql } from './db';
import {
  addProjectMember,
  cleanupOrganizations,
  createOrgWithStaff,
  createProjectWithClientAndSite,
  createUser,
  type SeedClient,
  type SeedOrg,
  type SeedProject,
  type SeedSite,
  type SeedUser,
} from './factories';

type SeedProjectWithClientAndSite = SeedProject & { clientRow: SeedClient; siteRow: SeedSite };

/**
 * RLS harness for Fase 1 (ARCHITECTURE.md 2.4 layer 3, docs/rls-matrix.md's
 * "Fase 1" section). Same shape as rls.test.ts: two organisations throughout,
 * so a broken policy has something real to leak.
 */

const createdOrgs: string[] = [];

let orgA: SeedOrg;
let ownerA: SeedUser;
let financeA: SeedUser;
let projectA: SeedProjectWithClientAndSite;
let mandorA: SeedUser; // holds a project_role on projectA
let clientViewerA: SeedUser; // holds a different project_role on projectA
let outsiderA: SeedUser; // staff-less user with no membership on projectA at all

let orgB: SeedOrg;
let projectB: SeedProjectWithClientAndSite;

beforeAll(async () => {
  const a = await createOrgWithStaff();
  orgA = a.org;
  ownerA = a.owner;
  financeA = a.finance;
  projectA = await createProjectWithClientAndSite(orgA.id);
  mandorA = await createUser({ organizationId: orgA.id, orgRole: null });
  clientViewerA = await createUser({ organizationId: orgA.id, orgRole: null });
  outsiderA = await createUser({ organizationId: orgA.id, orgRole: null });
  await addProjectMember(projectA.id, mandorA.id, 'mandor');
  await addProjectMember(projectA.id, clientViewerA.id, 'client_viewer');

  const b = await createOrgWithStaff();
  orgB = b.org;
  projectB = await createProjectWithClientAndSite(orgB.id);

  createdOrgs.push(orgA.id, orgB.id);
});

afterAll(async () => {
  await cleanupOrganizations(createdOrgs);
  await closePool();
});

describe('clients, sites -- staff-only, org-scoped', () => {
  it('lets staff see their own org clients and hides the other org', async () => {
    await asUser(financeA.id, async (run) => {
      const own = await run('select id from clients where id = $1', [projectA.clientRow.id]);
      expect(own).toHaveLength(1);

      const other = await run('select id from clients where id = $1', [projectB.clientRow.id]);
      expect(other).toHaveLength(0);
    });
  });

  it('refuses a client insert from a user holding no org_role', async () => {
    const error = await expectRejection(
      asUser(outsiderA.id, (run) =>
        run('insert into clients (organization_id, name) values ($1, $2)', [orgA.id, 'Klien liar']),
      ),
    );
    expect(error.message).toMatch(/row-level security/i);
  });

  it('hides sites across organisations the same way as clients', async () => {
    await asUser(ownerA.id, async (run) => {
      const rows = await run('select id from sites where id = $1', [projectB.siteRow.id]);
      expect(rows).toHaveLength(0);
    });
  });
});

describe('projects -- staff see all in their org, a project role sees only their own project', () => {
  it('lets staff see every project in their organisation', async () => {
    await asUser(ownerA.id, async (run) => {
      const rows = await run('select id from projects where id = $1', [projectA.id]);
      expect(rows).toHaveLength(1);
    });
  });

  it('lets a project member see the project they hold a role on', async () => {
    await asUser(mandorA.id, async (run) => {
      const rows = await run('select id from projects where id = $1', [projectA.id]);
      expect(rows).toHaveLength(1);
    });
  });

  it('hides a project from someone with no membership and no staff role', async () => {
    await asUser(outsiderA.id, async (run) => {
      const rows = await run('select id from projects where id = $1', [projectA.id]);
      expect(rows).toHaveLength(0);
    });
  });

  it('hides a project in a different organisation from a project role in this one', async () => {
    await asUser(mandorA.id, async (run) => {
      const rows = await run('select id from projects where id = $1', [projectB.id]);
      expect(rows).toHaveLength(0);
    });
  });

  it('refuses a project insert from a user holding no org_role', async () => {
    const error = await expectRejection(
      asUser(outsiderA.id, (run) =>
        run('insert into projects (organization_id, client_id, site_id, name) values ($1, $2, $3, $4)', [
          orgA.id,
          projectA.clientRow.id,
          projectA.siteRow.id,
          'Proyek liar',
        ]),
      ),
    );
    expect(error.message).toMatch(/row-level security/i);
  });
});

describe('project_members -- a project role sees only their own membership row, not the roster', () => {
  it('lets staff see the full roster', async () => {
    await asUser(ownerA.id, async (run) => {
      const rows = await run('select user_id from project_members where project_id = $1', [projectA.id]);
      expect(rows.map((r) => r.user_id).sort()).toEqual([mandorA.id, clientViewerA.id].sort());
    });
  });

  it("lets a member see their own row but not a co-member's", async () => {
    await asUser(mandorA.id, async (run) => {
      const own = await run('select user_id from project_members where user_id = $1', [mandorA.id]);
      expect(own).toHaveLength(1);

      const coMember = await run('select user_id from project_members where user_id = $1', [clientViewerA.id]);
      expect(coMember).toHaveLength(0);
    });
  });
});

describe('contracts, milestones -- money, staff only (ARCHITECTURE.md 2.6)', () => {
  let contractId: string;

  beforeAll(async () => {
    const row = await sql<{ id: string }>(
      'insert into contracts (organization_id, project_id, title, contract_amount) values ($1, $2, $3, $4) returning id',
      [orgA.id, projectA.id, 'Kontrak utama', '500000000'],
    );
    contractId = row[0]!.id;
  });

  it('lets staff read the contract', async () => {
    await asUser(financeA.id, async (run) => {
      const rows = await run('select id from contracts where id = $1', [contractId]);
      expect(rows).toHaveLength(1);
    });
  });

  it('hides the contract from a project member, unlike projects/zones/work_packages', async () => {
    await asUser(mandorA.id, async (run) => {
      const rows = await run('select id from contracts where id = $1', [contractId]);
      expect(rows).toHaveLength(0);
    });
  });

  it('refuses a contract insert from a project role', async () => {
    const error = await expectRejection(
      asUser(mandorA.id, (run) =>
        run('insert into contracts (organization_id, project_id, title, contract_amount) values ($1, $2, $3, $4)', [
          orgA.id,
          projectA.id,
          'Kontrak liar',
          '1',
        ]),
      ),
    );
    expect(error.message).toMatch(/row-level security/i);
  });
});

describe('work_packages -- no money figure, so a project role may read it', () => {
  let workPackageId: string;

  beforeAll(async () => {
    const row = await sql<{ id: string }>(
      'insert into work_packages (organization_id, project_id, name) values ($1, $2, $3) returning id',
      [orgA.id, projectA.id, 'Pekerjaan pondasi'],
    );
    workPackageId = row[0]!.id;
  });

  it('lets a project member read it', async () => {
    await asUser(mandorA.id, async (run) => {
      const rows = await run('select id from work_packages where id = $1', [workPackageId]);
      expect(rows).toHaveLength(1);
    });
  });

  it('still hides it from someone with no membership on the project', async () => {
    await asUser(outsiderA.id, async (run) => {
      const rows = await run('select id from work_packages where id = $1', [workPackageId]);
      expect(rows).toHaveLength(0);
    });
  });
});

describe('fn_has_project_role -- the kernel function Wave 4 replaced from its Wave 0 placeholder', () => {
  it('is true for a role the user actually holds', async () => {
    await asUser(mandorA.id, async (run) => {
      const rows = await run('select fn_has_project_role($1, $2) as ok', [
        projectA.id,
        ['mandor', 'site_coordinator'],
      ]);
      expect(rows[0]!.ok).toBe(true);
    });
  });

  it('is false for a role the user does not hold, even on a project they belong to', async () => {
    await asUser(mandorA.id, async (run) => {
      const rows = await run('select fn_has_project_role($1, $2) as ok', [projectA.id, ['client_approver']]);
      expect(rows[0]!.ok).toBe(false);
    });
  });

  it('is false for any role on a project the user has no membership on at all', async () => {
    await asUser(mandorA.id, async (run) => {
      const rows = await run('select fn_has_project_role($1, $2) as ok', [
        projectB.id,
        ['mandor', 'site_coordinator', 'client_approver', 'client_viewer', 'supplier', 'subcontractor'],
      ]);
      expect(rows[0]!.ok).toBe(false);
    });
  });
});
