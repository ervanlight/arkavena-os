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

/**
 * Prepares a proposal already at 'sent' -- an estimate is required first
 * (proposals.estimate_id, not null). Inserted directly at 'sent' rather
 * than draft-then-UPDATE: fn_proposals_guard_client_columns is an UPDATE
 * trigger, and the plain privileged `sql()` connection has no JWT claims
 * set, so fn_current_org_role() reads null on it -- the same "not staff"
 * branch a real client hits, which would block sent_at/client_summary from
 * an UPDATE. An INSERT never crosses that trigger at all.
 */
async function insertProposal(projectId: string): Promise<string> {
  const estimateRows = await sql<{ id: string }>(
    `insert into estimates (organization_id, project_id, version, title, created_by)
     values ($1, $2, 100000 + floor(random() * 100000)::int, 'Estimasi Uji', $3) returning id`,
    [org.id, projectId, owner.id],
  );
  const rows = await sql<{ id: string }>(
    `insert into proposals (organization_id, project_id, estimate_id, status, sent_at, client_summary)
     values ($1, $2, $3, 'sent', now(), 'Proposal renovasi dapur') returning id`,
    [org.id, projectId, estimateRows[0]!.id],
  );
  return rows[0]!.id;
}

/**
 * Post-implementation review fix (C1, ADR 0026 §7 item 7): client-portal
 * must not import `@/modules/estimating` directly (ARCHITECTURE.md 1.2,
 * F25). These mirror the fn_change_orders_sync_client_decision section
 * above exactly, sourced from proposals instead of change_orders.
 */
describe('fn_proposals_sync_client_decision -- the trigger that writes client_decisions for proposals', () => {
  it('opens a pending decision the moment a proposal enters sent', async () => {
    const proposalId = await insertProposal(projectA.id);

    const rows = await sql<{ presented_at: string; decided_at: string | null; decision: string | null; client_summary: string | null }>(
      'select presented_at, decided_at, decision, client_summary from client_decisions where proposal_id = $1',
      [proposalId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.decided_at).toBeNull();
    expect(rows[0]!.decision).toBeNull();
    expect(rows[0]!.client_summary).toBe('Proposal renovasi dapur');
  });

  it('closes the decision with decision=approved when the proposal is accepted', async () => {
    const proposalId = await insertProposal(projectA.id);
    await sql(`update proposals set status = 'accepted', decided_at = now(), decided_by = $2, decision_reason = 'Setuju' where id = $1`, [
      proposalId,
      owner.id,
    ]);

    const rows = await sql<{ decided_at: string | null; decision: string | null }>(
      'select decided_at, decision from client_decisions where proposal_id = $1',
      [proposalId],
    );
    expect(rows[0]!.decided_at).not.toBeNull();
    expect(rows[0]!.decision).toBe('approved');
  });

  it('closes the decision with decision=rejected when the proposal is rejected', async () => {
    const proposalId = await insertProposal(projectA.id);
    await sql(
      `update proposals set status = 'rejected', decided_at = now(), decided_by = $2, decision_reason = 'Terlalu mahal' where id = $1`,
      [proposalId, owner.id],
    );

    const rows = await sql<{ decided_at: string | null; decision: string | null }>(
      'select decided_at, decision from client_decisions where proposal_id = $1',
      [proposalId],
    );
    expect(rows[0]!.decided_at).not.toBeNull();
    expect(rows[0]!.decision).toBe('rejected');
  });

  it('lets a project\'s client see a pending proposal decision, hides it from another project\'s client', async () => {
    const proposalId = await insertProposal(projectA.id);

    await asUser(clientApproverA.id, async (run) => {
      const rows = await run('select id from client_decisions where proposal_id = $1', [proposalId]);
      expect(rows).toHaveLength(1);
    });
    await asUser(clientViewerB.id, async (run) => {
      const rows = await run('select id from client_decisions where proposal_id = $1', [proposalId]);
      expect(rows).toHaveLength(0);
    });
  });
});

describe('fn_client_decide_proposal -- the RPC client-portal calls instead of importing modules/estimating', () => {
  it('lets a client_approver accept a sent proposal, recording their own decision', async () => {
    const proposalId = await insertProposal(projectA.id);

    // asUser's transaction is rolled back once its callback returns
    // (db.ts), so both the RPC's own effect and the trigger's
    // client_decisions side effect can only be observed here, on the same
    // connection, before that rollback happens -- not from a later,
    // separate sql() call.
    await asUser(clientApproverA.id, async (run) => {
      const rows = await run(
        `select status, decided_by from fn_client_decide_proposal($1, 'accepted', 'Setuju, silakan lanjutkan')`,
        [proposalId],
      );
      expect(rows[0]!.status).toBe('accepted');
      expect(rows[0]!.decided_by).toBe(clientApproverA.id);

      const decisionRows = await run('select decision from client_decisions where proposal_id = $1', [proposalId]);
      expect((decisionRows[0] as { decision: string | null }).decision).toBe('approved');
    });
  });

  it('rejects a client from a different project attempting to decide (proposals_update_client RLS, unchanged from F1)', async () => {
    const proposalId = await insertProposal(projectA.id);

    // Unlike a raw filtered UPDATE, fn_client_decide_proposal raises when
    // its own UPDATE affects zero rows (its whole purpose is being the only
    // path a client_approver has to attempt a decision, so a silent no-op
    // would be a worse UX than an explicit refusal) -- proposals_update_client
    // RLS is still what actually decides the row is unreachable for this user.
    await expectRejection(
      asUser(clientViewerB.id, (run) => run(`select fn_client_decide_proposal($1, 'accepted', 'Mencoba')`, [proposalId])),
    );
  });

  it('rejects a client attempting to skip straight to accepted from draft (trg_proposals_guard_transition, unchanged from F1)', async () => {
    const estimateRows = await sql<{ id: string }>(
      `insert into estimates (organization_id, project_id, version, title, created_by)
       values ($1, $2, 999999, 'Estimasi Draft', $3) returning id`,
      [org.id, projectA.id, owner.id],
    );
    const proposalRows = await sql<{ id: string }>(
      `insert into proposals (organization_id, project_id, estimate_id, status) values ($1, $2, $3, 'draft') returning id`,
      [org.id, projectA.id, estimateRows[0]!.id],
    );
    const proposalId = proposalRows[0]!.id;

    // A draft is invisible to the client (proposals_select_client), so the
    // RPC's own UPDATE affects zero rows and raises, the same as the
    // cross-project case above -- the row truly cannot be reached, not just
    // that the transition guard would refuse it if it could.
    await expectRejection(
      asUser(clientApproverA.id, (run) => run(`select fn_client_decide_proposal($1, 'accepted', 'Mencoba')`, [proposalId])),
    );
  });
});

/**
 * Phase 3 milestone 3.1 (F6): client sign-off/acceptance record at
 * handover. A handover has no single source row the way change_order_id/
 * proposal_id point to one -- handover_signoff is a boolean discriminator
 * against the row's own project_id instead, opened by
 * fn_projects_sync_handover_signoff_decision the moment a project first
 * reaches 'completed' (the same trigger point fn_projects_sync_warranties_on_completion
 * already fires on).
 */
describe('fn_projects_sync_handover_signoff_decision -- opens a pending handover sign-off on project completion', () => {
  it('opens a pending handover_signoff decision the moment a project first reaches completed, never re-fires', async () => {
    const project = await createProjectWithClientAndSite(org.id);

    await sql(`update projects set status = 'completed' where id = $1`, [project.id]);

    const rows = await sql<{ decided_at: string | null; decision: string | null; client_summary: string | null }>(
      'select decided_at, decision, client_summary from client_decisions where project_id = $1 and handover_signoff = true',
      [project.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.decided_at).toBeNull();
    expect(rows[0]!.decision).toBeNull();
    expect(rows[0]!.client_summary).not.toBeNull();

    await sql(`update projects set name = 'Renamed after completion' where id = $1`, [project.id]);
    const stillOne = await sql('select id from client_decisions where project_id = $1 and handover_signoff = true', [
      project.id,
    ]);
    expect(stillOne).toHaveLength(1);
  });
});

describe('fn_client_accept_handover -- the RPC client-portal calls for its own handover_signoff rows', () => {
  it('lets a client_approver accept, recording their own decision', async () => {
    const project = await createProjectWithClientAndSite(org.id);
    const clientApprover = await createUser({ organizationId: org.id, orgRole: null });
    await addProjectMember(project.id, clientApprover.id, 'client_approver');
    await sql(`update projects set status = 'completed' where id = $1`, [project.id]);
    const [decision] = await sql<{ id: string }>(
      'select id from client_decisions where project_id = $1 and handover_signoff = true',
      [project.id],
    );

    // asUser's transaction is rolled back once its callback returns
    // (db.ts), so the RPC's own effect can only be observed here, on the
    // same connection, before that rollback happens.
    await asUser(clientApprover.id, async (run) => {
      const rows = await run(
        `select decision, decided_by from fn_client_accept_handover($1, 'approved', 'Diterima, semua sesuai')`,
        [decision!.id],
      );
      expect(rows[0]!.decision).toBe('approved');
      expect(rows[0]!.decided_by).toBe(clientApprover.id);
    });
  });

  it('rejects a client from a different project attempting to decide (client_decisions_update_client RLS)', async () => {
    const project = await createProjectWithClientAndSite(org.id);
    const otherProject = await createProjectWithClientAndSite(org.id);
    const clientViewerOther = await createUser({ organizationId: org.id, orgRole: null });
    await addProjectMember(otherProject.id, clientViewerOther.id, 'client_viewer');
    await sql(`update projects set status = 'completed' where id = $1`, [project.id]);
    const [decision] = await sql<{ id: string }>(
      'select id from client_decisions where project_id = $1 and handover_signoff = true',
      [project.id],
    );

    // client_viewer is read-only (client_decisions_update_client requires
    // client_approver specifically) and belongs to a different project
    // either way -- the RPC's own UPDATE affects zero rows and raises.
    await expectRejection(
      asUser(clientViewerOther.id, (run) => run(`select fn_client_accept_handover($1, 'approved', 'Mencoba')`, [decision!.id])),
    );
  });

  it('fn_client_decisions_guard_client_columns blocks a client_approver from touching client_summary or project_id', async () => {
    const project = await createProjectWithClientAndSite(org.id);
    const clientApprover = await createUser({ organizationId: org.id, orgRole: null });
    await addProjectMember(project.id, clientApprover.id, 'client_approver');
    await sql(`update projects set status = 'completed' where id = $1`, [project.id]);
    const [decision] = await sql<{ id: string }>(
      'select id from client_decisions where project_id = $1 and handover_signoff = true',
      [project.id],
    );

    const error = await expectRejection(
      asUser(clientApprover.id, (run) =>
        run(`update client_decisions set client_summary = 'saya ubah sendiri' where id = $1`, [decision!.id]),
      ),
    );
    expect(error.message).toMatch(/only record their own accept\/reject decision/);
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
      const rows = (await run(
        'select project_id, contract_amount from vw_client_project_overview where project_id = $1',
        [projectA.id],
      )) as { project_id: string; contract_amount: string }[];
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
