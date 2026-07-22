import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asUser, closePool, sql } from './db';
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
 * Integration/DB tests for Fase 6's client-portal (CP8, ADR 0016).
 * ARCHITECTURE.md 2.1's exit criterion is "klien demo hanya melihat yang
 * halal (dibuktikan RLS test)" -- proven here the same way Fase 5 proved
 * hold points: write SQL directly, sign in as the actual role, observe what
 * comes back, independent of any application code that could be bypassed.
 */

type SeedProjectWithClientAndSite = SeedProject & { clientRow: SeedClient; siteRow: SeedSite };

const createdOrgs: string[] = [];

let org: SeedOrg;
let owner: SeedUser;
let clientApproverA: SeedUser; // member of projectA
let clientViewerA: SeedUser; // member of projectA
let clientViewerB: SeedUser; // member of projectB, not projectA
let projectA: SeedProjectWithClientAndSite;
let projectB: SeedProjectWithClientAndSite;

beforeAll(async () => {
  const a = await createOrgWithStaff();
  org = a.org;
  owner = a.owner;

  projectA = await createProjectWithClientAndSite(org.id);
  projectB = await createProjectWithClientAndSite(org.id);

  clientApproverA = await createUser({ organizationId: org.id, orgRole: null });
  await addProjectMember(projectA.id, clientApproverA.id, 'client_approver');

  clientViewerA = await createUser({ organizationId: org.id, orgRole: null });
  await addProjectMember(projectA.id, clientViewerA.id, 'client_viewer');

  clientViewerB = await createUser({ organizationId: org.id, orgRole: null });
  await addProjectMember(projectB.id, clientViewerB.id, 'client_viewer');

  createdOrgs.push(org.id);
});

afterAll(async () => {
  await cleanupOrganizations(createdOrgs);
  await closePool();
});

async function insertContract(projectId: string, amount = 500_000_000): Promise<string> {
  const rows = await sql<{ id: string }>(
    `insert into contracts (organization_id, project_id, title, contract_amount) values ($1, $2, 'Kontrak Uji', $3) returning id`,
    [org.id, projectId, amount],
  );
  return rows[0]!.id;
}

/** Prepares a change order right up to the edge of awaiting_client_approval -- draft -> under_review -> impacts filled in -- so a test only needs one more UPDATE to trigger fn_change_orders_sync_client_decision. */
async function insertChangeOrder(projectId: string): Promise<string> {
  const rows = await sql<{ id: string }>(
    `insert into change_orders (organization_id, project_id, title, requested_by, status)
     values ($1, $2, 'Tambah kamar mandi', $3, 'draft') returning id`,
    [org.id, projectId, owner.id],
  );
  const changeOrderId = rows[0]!.id;
  await sql(`update change_orders set status = 'under_review' where id = $1`, [changeOrderId]);
  await sql(`update change_orders set cost_impact_amount = 10000000, schedule_impact_days = 3 where id = $1`, [
    changeOrderId,
  ]);
  return changeOrderId;
}

describe('client_decisions -- RLS', () => {
  it('lets staff see every decision in their organisation', async () => {
    const changeOrderId = await insertChangeOrder(projectA.id);
    await sql(`update change_orders set status = 'awaiting_client_approval' where id = $1`, [changeOrderId]);

    await asUser(owner.id, async (run) => {
      const rows = await run('select id from client_decisions where change_order_id = $1', [changeOrderId]);
      expect(rows).toHaveLength(1);
    });
  });

  it("lets a project's client_approver/client_viewer see its own decisions", async () => {
    const changeOrderId = await insertChangeOrder(projectA.id);
    await sql(`update change_orders set status = 'awaiting_client_approval' where id = $1`, [changeOrderId]);

    await asUser(clientApproverA.id, async (run) => {
      const rows = await run('select id from client_decisions where change_order_id = $1', [changeOrderId]);
      expect(rows).toHaveLength(1);
    });
    await asUser(clientViewerA.id, async (run) => {
      const rows = await run('select id from client_decisions where change_order_id = $1', [changeOrderId]);
      expect(rows).toHaveLength(1);
    });
  });

  it("hides Project A's decisions from Project B's client_viewer -- structurally, not just by convention", async () => {
    const changeOrderId = await insertChangeOrder(projectA.id);
    await sql(`update change_orders set status = 'awaiting_client_approval' where id = $1`, [changeOrderId]);

    await asUser(clientViewerB.id, async (run) => {
      const rows = await run('select id from client_decisions where change_order_id = $1', [changeOrderId]);
      expect(rows).toHaveLength(0);
    });
  });
});

describe('fn_change_orders_sync_client_decision -- the trigger that writes client_decisions', () => {
  it('opens a pending decision the moment a change order enters awaiting_client_approval', async () => {
    const changeOrderId = await insertChangeOrder(projectA.id);
    await sql(`update change_orders set status = 'awaiting_client_approval' where id = $1`, [changeOrderId]);

    const rows = await sql<{ presented_at: string; decided_at: string | null; decision: string | null }>(
      'select presented_at, decided_at, decision from client_decisions where change_order_id = $1',
      [changeOrderId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.decided_at).toBeNull();
    expect(rows[0]!.decision).toBeNull();
  });

  it('closes the decision with decision=approved when the client approves', async () => {
    const changeOrderId = await insertChangeOrder(projectA.id);
    await sql(`update change_orders set status = 'awaiting_client_approval' where id = $1`, [changeOrderId]);
    await sql(
      `update change_orders set status = 'approved_unpaid', client_approved_by = $2, client_approved_at = now() where id = $1`,
      [changeOrderId, clientApproverA.id],
    );

    const rows = await sql<{ decided_at: string | null; decision: string | null }>(
      'select decided_at, decision from client_decisions where change_order_id = $1',
      [changeOrderId],
    );
    expect(rows[0]!.decided_at).not.toBeNull();
    expect(rows[0]!.decision).toBe('approved');
  });

  it('closes the decision with decision=rejected when the client rejects', async () => {
    const changeOrderId = await insertChangeOrder(projectA.id);
    await sql(`update change_orders set status = 'awaiting_client_approval' where id = $1`, [changeOrderId]);
    await sql(
      `update change_orders set status = 'rejected', rejected_by = $2, rejected_at = now(), rejected_reason = 'Terlalu mahal' where id = $1`,
      [changeOrderId, clientApproverA.id],
    );

    const rows = await sql<{ decided_at: string | null; decision: string | null }>(
      'select decided_at, decision from client_decisions where change_order_id = $1',
      [changeOrderId],
    );
    expect(rows[0]!.decided_at).not.toBeNull();
    expect(rows[0]!.decision).toBe('rejected');
  });

  it('writes an audit_logs row for the insert, same as every other table (ARCHITECTURE.md 5.2)', async () => {
    const changeOrderId = await insertChangeOrder(projectA.id);
    await sql(`update change_orders set status = 'awaiting_client_approval' where id = $1`, [changeOrderId]);

    const [decision] = await sql<{ id: string }>('select id from client_decisions where change_order_id = $1', [
      changeOrderId,
    ]);
    const rows = await sql(
      `select 1 from audit_logs where entity_table = 'client_decisions' and entity_id = $1 and action = 'insert' and source = 'trigger'`,
      [decision!.id],
    );
    expect(rows).toHaveLength(1);
  });
});

describe('contracts/milestones/photos -- new client-scoped read policies this wave adds', () => {
  it("lets Project A's client see Project A's contract, hides it from Project B's client", async () => {
    const contractId = await insertContract(projectA.id);

    await asUser(clientViewerA.id, async (run) => {
      const rows = await run('select id from contracts where id = $1', [contractId]);
      expect(rows).toHaveLength(1);
    });
    await asUser(clientViewerB.id, async (run) => {
      const rows = await run('select id from contracts where id = $1', [contractId]);
      expect(rows).toHaveLength(0);
    });
  });

  it("lets Project A's client see a milestone under Project A's contract, hides it from Project B's client", async () => {
    const contractId = await insertContract(projectA.id);
    const [milestone] = await sql<{ id: string }>(
      `insert into milestones (organization_id, contract_id, name, amount) values ($1, $2, 'Termin 1', 100000000) returning id`,
      [org.id, contractId],
    );

    await asUser(clientViewerA.id, async (run) => {
      const rows = await run('select id from milestones where id = $1', [milestone!.id]);
      expect(rows).toHaveLength(1);
    });
    await asUser(clientViewerB.id, async (run) => {
      const rows = await run('select id from milestones where id = $1', [milestone!.id]);
      expect(rows).toHaveLength(0);
    });
  });
});

describe('vw_client_* views -- security_invoker, and never the internal-only columns', () => {
  it('vw_client_project_overview shows contract_amount but no risk_reserve_amount column at all', async () => {
    await insertContract(projectA.id, 750_000_000);

    const columns = await sql<{ column_name: string }>(
      `select column_name from information_schema.columns where table_name = 'vw_client_project_overview'`,
    );
    const columnNames = columns.map((c) => c.column_name);
    expect(columnNames).toContain('contract_amount');
    expect(columnNames).not.toContain('risk_reserve_amount');

    await asUser(clientViewerA.id, async (run) => {
      const rows = await run<{ project_id: string; contract_amount: string }>(
        'select project_id, contract_amount from vw_client_project_overview where project_id = $1',
        [projectA.id],
      );
      expect(rows).toHaveLength(1);
      // node-postgres returns bigint as a string, unlike PostgREST's wire
      // format (a JS number, ADR 0008) -- this test goes through the raw pg
      // client (asUser), not supabase-js, so the string comparison is correct
      // here even though application code never treats a money value this way.
      expect(rows[0]!.contract_amount).toBe('750000000');
    });
    await asUser(clientViewerB.id, async (run) => {
      const rows = await run('select project_id from vw_client_project_overview where project_id = $1', [projectA.id]);
      expect(rows).toHaveLength(0);
    });
  });

  it('vw_client_timeline_event never exposes internal notes/estimate columns', async () => {
    const columns = await sql<{ column_name: string }>(
      `select column_name from information_schema.columns where table_name = 'vw_client_timeline_event'`,
    );
    const columnNames = columns.map((c) => c.column_name);
    expect(columnNames).not.toContain('notes');
    expect(columnNames).not.toContain('cost_impact_amount');
  });

  it("vw_client_progress_photo resolves the uploader to a name, never a raw uploaded_by user id column", async () => {
    const columns = await sql<{ column_name: string }>(
      `select column_name from information_schema.columns where table_name = 'vw_client_progress_photo'`,
    );
    const columnNames = columns.map((c) => c.column_name);
    expect(columnNames).toContain('uploaded_by_name');
    expect(columnNames).not.toContain('uploaded_by');
  });
});
