import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { can, requirePermission, type ActionContext } from '@/core/permissions/guard';
import { PermissionError } from '@/core/errors/app-error';
import { asUser, closePool, sql } from './db';
import {
  addProjectMember,
  cleanupOrganizations,
  createOrgWithStaff,
  createProjectWithClientAndSite,
  createUser,
  type SeedOrg,
  type SeedProject,
  type SeedUser,
} from './factories';

/**
 * ADR 0013: before it, `requirePermission`/`roleCan` denied every
 * project-role-only caller (ActionContext.orgRole always null for them)
 * regardless of what the permission matrix listed, so a server action could
 * throw PermissionError for a mandor even on a resource/action RLS already
 * scoped correctly for them (fase1-rls.test.ts proves that RLS half on its
 * own). That made "RLS allows it" necessary but not sufficient proof the
 * application actually worked -- the app layer was a second, independent
 * gate that failed first.
 *
 * This suite closes that gap using the real, imported `requirePermission`/
 * `can` (no reimplementation of the permission check) against the same
 * fixtures fase1-rls.test.ts uses, cross-checked in the same test against
 * what RLS itself decides for the identical user and table. The one thing
 * this suite cannot do is drive a real HTTP request through
 * `getActionContext()`/`createServerSupabase()` (those need live Next.js
 * cookies) -- src/modules/projects/actions/work-package-actions.test.ts
 * covers that seam instead, by calling the actual exported server action
 * with only that cookie-bound boundary stubbed. Together the two prove the
 * full path: kernel decision, real action wiring, and real RLS.
 */

const createdOrgs: string[] = [];

let org: SeedOrg;
let owner: SeedUser;
let project: SeedProject;
let mandor: SeedUser; // holds a project_role on `project`, orgRole null -- exactly getActionContext()'s shape for an external user
let outsider: SeedUser; // no membership on `project` at all, orgRole null

let workPackageId: string;
let contractId: string;

const mandorContext = (): ActionContext => ({
  userId: mandor.id,
  organizationId: org.id,
  orgRole: null,
  requestId: 'test-req',
});

beforeAll(async () => {
  const seeded = await createOrgWithStaff();
  org = seeded.org;
  owner = seeded.owner;
  project = await createProjectWithClientAndSite(org.id);
  mandor = await createUser({ organizationId: org.id, orgRole: null });
  outsider = await createUser({ organizationId: org.id, orgRole: null });
  await addProjectMember(project.id, mandor.id, 'mandor');
  createdOrgs.push(org.id);

  const workPackageRow = await sql<{ id: string }>(
    'insert into work_packages (organization_id, project_id, name) values ($1, $2, $3) returning id',
    [org.id, project.id, 'Pekerjaan pondasi'],
  );
  workPackageId = workPackageRow[0]!.id;

  const contractRow = await sql<{ id: string }>(
    'insert into contracts (organization_id, project_id, title, contract_amount) values ($1, $2, $3, $4) returning id',
    [org.id, project.id, 'Kontrak utama', '500000000'],
  );
  contractId = contractRow[0]!.id;
});

afterAll(async () => {
  await cleanupOrganizations(createdOrgs);
  await closePool();
});

describe('requirePermission/can now agree with RLS for a mandor, on the resources the matrix means for them', () => {
  it('work_package.view: kernel passes, and RLS backs it up on the actual row', async () => {
    expect(can(mandorContext(), 'work_package', 'view')).toBe(true);
    expect(() => requirePermission(mandorContext(), 'work_package', 'view')).not.toThrow();

    await asUser(mandor.id, async (run) => {
      const rows = await run('select id from work_packages where id = $1', [workPackageId]);
      expect(rows).toHaveLength(1);
    });
  });

  it('project.view: kernel passes, and RLS backs it up on the project the mandor belongs to', async () => {
    expect(can(mandorContext(), 'project', 'view')).toBe(true);

    await asUser(mandor.id, async (run) => {
      const rows = await run('select id from projects where id = $1', [project.id]);
      expect(rows).toHaveLength(1);
    });
  });

  it('project_member.view: kernel passes, and RLS still scopes it to the mandor\'s own row', async () => {
    expect(can(mandorContext(), 'project_member', 'view')).toBe(true);

    await asUser(mandor.id, async (run) => {
      const own = await run('select user_id from project_members where user_id = $1', [mandor.id]);
      expect(own).toHaveLength(1);
    });
  });

  it('the kernel pass is not "any authenticated project role sees any project" -- RLS still owns the instance decision', async () => {
    // roleCan(null, 'work_package', 'view') is true for outsider too (same
    // null role, same matrix entry) -- roleCan has no project id to refuse
    // with. What actually stops outsider from reading projectA's work
    // package is fn_has_project_role() alone, which is exactly ADR 0013's
    // point: the kernel defers, it does not decide.
    const outsiderContext: ActionContext = {
      userId: outsider.id,
      organizationId: org.id,
      orgRole: null,
      requestId: 'test-req',
    };
    expect(can(outsiderContext, 'work_package', 'view')).toBe(true);

    await asUser(outsider.id, async (run) => {
      const rows = await run('select id from work_packages where id = $1', [workPackageId]);
      expect(rows).toHaveLength(0);
    });
  });
});

describe('requirePermission/can still agree with RLS in denying a mandor on staff-only resources', () => {
  it('contract.view: kernel still refuses, and RLS still hides the row', async () => {
    expect(can(mandorContext(), 'contract', 'view')).toBe(false);
    expect(() => requirePermission(mandorContext(), 'contract', 'view')).toThrow(PermissionError);

    await asUser(mandor.id, async (run) => {
      const rows = await run('select id from contracts where id = $1', [contractId]);
      expect(rows).toHaveLength(0);
    });
  });

  it('audit_log.view: kernel still refuses, and RLS still hides the org\'s audit trail', async () => {
    expect(can(mandorContext(), 'audit_log', 'view')).toBe(false);

    await asUser(owner.id, async (run) => {
      // Sanity check the fixture actually produced audit rows for this org
      // before trusting the mandor's empty result below.
      const staffRows = await run('select id from audit_logs where organization_id = $1 limit 1', [org.id]);
      expect(staffRows.length).toBeGreaterThan(0);
    });

    await asUser(mandor.id, async (run) => {
      const rows = await run('select id from audit_logs where organization_id = $1 limit 1', [org.id]);
      expect(rows).toHaveLength(0);
    });
  });

  it('work_package.create: kernel still refuses even though work_package.view now defers', async () => {
    // The defer branch is per resource/action, not per resource -- create
    // lists no project role, so it is denied exactly as before ADR 0013.
    expect(can(mandorContext(), 'work_package', 'create')).toBe(false);
  });
});
