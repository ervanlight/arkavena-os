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

/**
 * Integration/RLS tests for Fase 9's maintenance-engine tables (Wave 9-10,
 * ADR 0019): handover_items, warranties, assets, maintenance_plans,
 * service_tickets, plus the two cross-cutting mechanisms ADR 0019 introduced
 * -- fn_projects_sync_warranties_on_completion and
 * fn_service_tickets_guard_transition.
 */

type SeedProjectWithClientAndSite = SeedProject & { clientRow: SeedClient; siteRow: SeedSite };

const createdOrgs: string[] = [];

let org: SeedOrg;
let owner: SeedUser;
let procurement: SeedUser;

let orgB: SeedOrg;
let ownerB: SeedUser;

beforeAll(async () => {
  const a = await createOrgWithStaff();
  org = a.org;
  owner = a.owner;
  procurement = a.procurement;

  const b = await createOrgWithStaff();
  orgB = b.org;
  ownerB = b.owner;

  createdOrgs.push(org.id, orgB.id);
});

afterAll(async () => {
  await cleanupOrganizations(createdOrgs);
  await closePool();
});

async function newProject(): Promise<SeedProjectWithClientAndSite> {
  return createProjectWithClientAndSite(org.id);
}

async function newAsset(siteId: string, clientId: string): Promise<string> {
  const rows = await sql<{ id: string }>(
    `insert into assets (organization_id, site_id, client_id, name) values ($1, $2, $3, 'AC Split 1PK') returning id`,
    [org.id, siteId, clientId],
  );
  return rows[0]!.id;
}

describe('RLS -- handover_items/warranties/assets/maintenance_plans/service_tickets are staff-only, org-scoped', () => {
  it('lets staff insert and read a handover item for their own org', async () => {
    const project = await newProject();
    await asUser(procurement.id, async (run) => {
      const rows = await run(
        `insert into handover_items (organization_id, project_id, item_type, recorded_by)
         values ($1, $2, 'key', $3) returning id`,
        [org.id, project.id, procurement.id],
      );
      expect(rows).toHaveLength(1);
      expect(await run('select id from handover_items where id = $1', [rows[0]!.id])).toHaveLength(1);
    });
  });

  it('hides handover_items across organisations', async () => {
    const project = await newProject();
    const rows = await sql<{ id: string }>(
      `insert into handover_items (organization_id, project_id, item_type, recorded_by)
       values ($1, $2, 'certificate', $3) returning id`,
      [org.id, project.id, owner.id],
    );
    await asUser(ownerB.id, async (run) => {
      expect(await run('select id from handover_items where id = $1', [rows[0]!.id])).toHaveLength(0);
    });
  });

  it('refuses an assets insert from a project role (mandor)', async () => {
    const project = await newProject();
    const mandor = await createUser({ organizationId: org.id, orgRole: null });
    await addProjectMember(project.id, mandor.id, 'mandor');

    const error = await expectRejection(
      asUser(mandor.id, (run) =>
        run(`insert into assets (organization_id, site_id, client_id, name) values ($1, $2, $3, 'Pompa air')`, [
          org.id,
          project.siteRow.id,
          project.clientRow.id,
        ]),
      ),
    );
    expect(error.message).toMatch(/row-level security/i);
  });

  it('lets staff read and write maintenance_plans/service_tickets for their own org, hidden across organisations', async () => {
    const project = await newProject();
    const assetId = await newAsset(project.siteRow.id, project.clientRow.id);

    let planId = '';
    let ticketId = '';
    await asUser(procurement.id, async (run) => {
      const planRows = await run(
        `insert into maintenance_plans (organization_id, asset_id, title, interval_days, starts_at)
         values ($1, $2, 'Servis rutin AC', 90, current_date) returning id`,
        [org.id, assetId],
      );
      planId = planRows[0]!.id as string;

      const ticketRows = await run(
        `insert into service_tickets (organization_id, asset_id, client_id, maintenance_plan_id, title)
         values ($1, $2, $3, $4, 'Servis 90 hari') returning id`,
        [org.id, assetId, project.clientRow.id, planId],
      );
      ticketId = ticketRows[0]!.id as string;

      expect(await run('select id from maintenance_plans where id = $1', [planId])).toHaveLength(1);
      expect(await run('select id from service_tickets where id = $1', [ticketId])).toHaveLength(1);
    });

    await asUser(ownerB.id, async (run) => {
      expect(await run('select id from maintenance_plans where id = $1', [planId])).toHaveLength(0);
      expect(await run('select id from service_tickets where id = $1', [ticketId])).toHaveLength(0);
    });
  });
});

describe('fn_projects_sync_warranties_on_completion -- the trigger actually creates warranties, not just the domain layer', () => {
  it('creates a warranty for a real installed item, skips a bare key, and never re-fires', async () => {
    const project = await newProject();

    const keyItem = await sql<{ id: string }>(
      `insert into handover_items (organization_id, project_id, item_type, handed_over_at, recorded_by)
       values ($1, $2, 'key', now(), $3) returning id`,
      [org.id, project.id, owner.id],
    );
    const acItem = await sql<{ id: string }>(
      `insert into handover_items (organization_id, project_id, item_type, handed_over_at, recorded_by)
       values ($1, $2, 'ac_unit', now(), $3) returning id`,
      [org.id, project.id, owner.id],
    );

    await asUser(owner.id, async (run) => {
      await run(`update projects set status = 'completed' where id = $1`, [project.id]);

      const warranties = await run('select handover_item_id from warranties where project_id = $1', [project.id]);
      expect(warranties).toHaveLength(1);
      expect(warranties[0]!.handover_item_id).toBe(acItem[0]!.id);
      expect(warranties.some((w) => w.handover_item_id === keyItem[0]!.id)).toBe(false);

      await run(`update projects set name = 'Renamed after completion' where id = $1`, [project.id]);
      const stillOne = await run('select id from warranties where project_id = $1', [project.id]);
      expect(stillOne).toHaveLength(1);
    });
  });
});

/**
 * Phase 3 milestone 3.1 (F4): client-facing warranty/handover/asset/
 * service-ticket visibility, plus a client-originated service ticket.
 * warranties/handover_items carry project_id -- their client policies mirror
 * proposals_select_client exactly. assets/service_tickets carry no
 * project_id at all (Facility Passport outlives a single project, ADR 0019
 * SS1) -- fn_client_has_role_for_client is the client_id-scoped equivalent.
 */
describe('RLS -- warranties/handover_items/assets/service_tickets client visibility (Phase 3, F4)', () => {
  it("lets a project's client_approver/client_viewer see its own warranty and handover item, hides another project's", async () => {
    const projectA = await newProject();
    const projectB = await newProject();
    const clientApproverA = await createUser({ organizationId: org.id, orgRole: null });
    await addProjectMember(projectA.id, clientApproverA.id, 'client_approver');
    const clientViewerB = await createUser({ organizationId: org.id, orgRole: null });
    await addProjectMember(projectB.id, clientViewerB.id, 'client_viewer');

    const [handoverItem] = await sql<{ id: string }>(
      `insert into handover_items (organization_id, project_id, item_type, recorded_by) values ($1, $2, 'ac_unit', $3) returning id`,
      [org.id, projectA.id, owner.id],
    );
    const [warranty] = await sql<{ id: string }>(
      `insert into warranties (organization_id, project_id, handover_item_id, title, starts_at, ends_at)
       values ($1, $2, $3, 'Garansi AC', current_date, current_date + interval '1 year') returning id`,
      [org.id, projectA.id, handoverItem!.id],
    );

    await asUser(clientApproverA.id, async (run) => {
      expect(await run('select id from handover_items where id = $1', [handoverItem!.id])).toHaveLength(1);
      expect(await run('select id from warranties where id = $1', [warranty!.id])).toHaveLength(1);
    });
    await asUser(clientViewerB.id, async (run) => {
      expect(await run('select id from handover_items where id = $1', [handoverItem!.id])).toHaveLength(0);
      expect(await run('select id from warranties where id = $1', [warranty!.id])).toHaveLength(0);
    });
  });

  it("lets a client see their own client's assets and service tickets, hides another client's", async () => {
    const projectA = await newProject();
    const projectC = await newProject();
    const clientApproverA = await createUser({ organizationId: org.id, orgRole: null });
    await addProjectMember(projectA.id, clientApproverA.id, 'client_approver');
    const clientViewerC = await createUser({ organizationId: org.id, orgRole: null });
    await addProjectMember(projectC.id, clientViewerC.id, 'client_viewer');

    const assetId = await newAsset(projectA.siteRow.id, projectA.clientRow.id);
    const [ticket] = await sql<{ id: string }>(
      `insert into service_tickets (organization_id, asset_id, client_id, title, reported_by)
       values ($1, $2, $3, 'AC bocor', $4) returning id`,
      [org.id, assetId, projectA.clientRow.id, owner.id],
    );

    await asUser(clientApproverA.id, async (run) => {
      expect(await run('select id from assets where id = $1', [assetId])).toHaveLength(1);
      expect(await run('select id from service_tickets where id = $1', [ticket!.id])).toHaveLength(1);
    });
    await asUser(clientViewerC.id, async (run) => {
      expect(await run('select id from assets where id = $1', [assetId])).toHaveLength(0);
      expect(await run('select id from service_tickets where id = $1', [ticket!.id])).toHaveLength(0);
    });
  });

  it('lets a client_approver report a new service ticket for their own asset, correctly shaped', async () => {
    const project = await newProject();
    const clientApprover = await createUser({ organizationId: org.id, orgRole: null });
    await addProjectMember(project.id, clientApprover.id, 'client_approver');
    const assetId = await newAsset(project.siteRow.id, project.clientRow.id);

    await asUser(clientApprover.id, async (run) => {
      const rows = await run(
        `insert into service_tickets (organization_id, asset_id, client_id, title, reported_by)
         values ($1, $2, $3, 'AC tidak dingin', $4) returning status, reported_by, assigned_to, maintenance_plan_id`,
        [org.id, assetId, project.clientRow.id, clientApprover.id],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]!.status).toBe('open');
      expect(rows[0]!.reported_by).toBe(clientApprover.id);
      expect(rows[0]!.assigned_to).toBeNull();
      expect(rows[0]!.maintenance_plan_id).toBeNull();
    });
  });

  it('rejects a client_viewer attempting to report a ticket (read-only role)', async () => {
    const project = await newProject();
    const clientViewer = await createUser({ organizationId: org.id, orgRole: null });
    await addProjectMember(project.id, clientViewer.id, 'client_viewer');
    const assetId = await newAsset(project.siteRow.id, project.clientRow.id);

    await expectRejection(
      asUser(clientViewer.id, (run) =>
        run(
          `insert into service_tickets (organization_id, asset_id, client_id, title, reported_by)
           values ($1, $2, $3, 'Coba lapor', $4)`,
          [org.id, assetId, project.clientRow.id, clientViewer.id],
        ),
      ),
    );
  });

  it('rejects a client_approver trying to report a ticket claiming to be assigned/resolved already (service_tickets_insert_client with check)', async () => {
    const project = await newProject();
    const clientApprover = await createUser({ organizationId: org.id, orgRole: null });
    await addProjectMember(project.id, clientApprover.id, 'client_approver');
    const assetId = await newAsset(project.siteRow.id, project.clientRow.id);

    await expectRejection(
      asUser(clientApprover.id, (run) =>
        run(
          `insert into service_tickets (organization_id, asset_id, client_id, title, reported_by, assigned_to)
           values ($1, $2, $3, 'Coba assign sendiri', $4, $5)`,
          [org.id, assetId, project.clientRow.id, clientApprover.id, owner.id],
        ),
      ),
    );
  });
});

describe('fn_service_tickets_guard_transition -- the trigger actually blocks, not just the domain layer', () => {
  it('refuses skipping straight from open to resolved', async () => {
    const project = await newProject();
    const assetId = await newAsset(project.siteRow.id, project.clientRow.id);
    const [ticket] = await sql<{ id: string }>(
      `insert into service_tickets (organization_id, asset_id, client_id, title, reported_by)
       values ($1, $2, $3, 'AC bocor', $4) returning id`,
      [org.id, assetId, project.clientRow.id, owner.id],
    );

    const error = await expectRejection(
      asUser(procurement.id, (run) =>
        run(`update service_tickets set status = 'resolved', resolved_at = now() where id = $1`, [ticket!.id]),
      ),
    );
    expect(error.message).toMatch(/tidak diperbolehkan/);
  });

  it('allows open -> in_progress -> resolved in order', async () => {
    const project = await newProject();
    const assetId = await newAsset(project.siteRow.id, project.clientRow.id);
    const [ticket] = await sql<{ id: string }>(
      `insert into service_tickets (organization_id, asset_id, client_id, title, reported_by)
       values ($1, $2, $3, 'AC bocor', $4) returning id`,
      [org.id, assetId, project.clientRow.id, owner.id],
    );

    await asUser(procurement.id, async (run) => {
      await run(`update service_tickets set status = 'in_progress' where id = $1`, [ticket!.id]);
      await run(`update service_tickets set status = 'resolved', resolved_at = now() where id = $1`, [ticket!.id]);
      const rows = await run('select status from service_tickets where id = $1', [ticket!.id]);
      expect(rows[0]!.status).toBe('resolved');
    });
  });

  it('refuses resolved without resolved_at (check constraint)', async () => {
    const project = await newProject();
    const assetId = await newAsset(project.siteRow.id, project.clientRow.id);

    const error = await expectRejection(
      sql(
        `insert into service_tickets (organization_id, asset_id, client_id, title, status, reported_by)
         values ($1, $2, $3, 'Langsung resolved', 'resolved', $4)`,
        [org.id, assetId, project.clientRow.id, owner.id],
      ),
    );
    expect(error.message).toMatch(/ck_service_tickets_resolved_requires_resolved_at/);
  });
});
