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
 * Integration/DB tests for Fase 3's Variation state machine (SV8,
 * ARCHITECTURE.md 0.2 / 4.5's "trigger genuinely rejects" requirement).
 *
 * Same discipline as cash-gate.test.ts: write SQL directly, proving the
 * database itself refuses, independent of any application code that could
 * be bypassed.
 */

type SeedProjectWithClientAndSite = SeedProject & { clientRow: SeedClient; siteRow: SeedSite };

const createdOrgs: string[] = [];

let org: SeedOrg;
let owner: SeedUser;
let finance: SeedUser;
let clientApprover: SeedUser;
let mandor: SeedUser;

let orgB: SeedOrg;
let ownerB: SeedUser;

beforeAll(async () => {
  const a = await createOrgWithStaff();
  org = a.org;
  owner = a.owner;
  finance = a.finance;

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

/**
 * trg_change_orders_guard_transition (correctly) requires every INSERT to
 * start as 'draft' and every status change to be a legal graph edge -- even
 * for this privileged test connection, since the trigger has no
 * current_user exemption (unlike trg_users_guard_privileged_columns).
 * Reaching a non-draft fixture status means walking the same chain a real
 * change order would.
 */
const STATUS_CHAIN = [
  'draft',
  'under_review',
  'awaiting_client_approval',
  'approved_unpaid',
  'approved_funded',
  'completed',
] as const;

async function insertChangeOrder(
  projectId: string,
  overrides: { status?: string; costImpactAmount?: number | null; scheduleImpactDays?: number | null } = {},
): Promise<string> {
  const rows = await sql<{ id: string }>(
    `insert into change_orders (organization_id, project_id, title, status, cost_impact_amount, schedule_impact_days, requested_by)
     values ($1, $2, 'Tambah kamar mandi', 'draft'::change_order_status, $3, $4, $5)
     returning id`,
    [org.id, projectId, overrides.costImpactAmount ?? null, overrides.scheduleImpactDays ?? null, owner.id],
  );
  const id = rows[0]!.id;

  const target = overrides.status ?? 'draft';
  const targetIndex = STATUS_CHAIN.indexOf(target as (typeof STATUS_CHAIN)[number]);
  for (let i = 1; i <= targetIndex; i += 1) {
    await sql(`update change_orders set status = $2::change_order_status where id = $1`, [id, STATUS_CHAIN[i]]);
  }
  return id;
}

describe('trg_change_orders_guard_transition -- mirrors the state machine, fires on INSERT too', () => {
  it('refuses a direct INSERT that skips straight to a non-draft status', async () => {
    const project = await newProject();
    const error = await expectRejection(
      sql(
        `insert into change_orders (organization_id, project_id, title, status, requested_by)
         values ($1, $2, 'Sneaky', 'approved_funded'::change_order_status, $3)`,
        [org.id, project.id, owner.id],
      ),
    );
    expect(error.message).toMatch(/must start as draft/i);
  });

  it('allows a normal draft INSERT', async () => {
    const project = await newProject();
    const id = await insertChangeOrder(project.id);
    const rows = await sql<{ status: string }>('select status from change_orders where id = $1', [id]);
    expect(rows[0]!.status).toBe('draft');
  });

  it('refuses an illegal UPDATE transition (draft straight to approved_funded)', async () => {
    const project = await newProject();
    const id = await insertChangeOrder(project.id);

    const error = await expectRejection(
      asUser(owner.id, (run) => run(`update change_orders set status = 'approved_funded' where id = $1`, [id])),
    );
    expect(error.message).toMatch(/tidak diperbolehkan/i);
  });

  it('refuses an illegal UPDATE transition (completed backwards to draft)', async () => {
    const project = await newProject();
    const id = await insertChangeOrder(project.id, { status: 'completed' });

    const error = await expectRejection(
      asUser(owner.id, (run) => run(`update change_orders set status = 'draft' where id = $1`, [id])),
    );
    expect(error.message).toMatch(/tidak diperbolehkan/i);
  });

  it('allows the legal chain: draft -> under_review -> awaiting_client_approval -> approved_unpaid -> approved_funded -> completed', async () => {
    const project = await newProject();
    const id = await insertChangeOrder(project.id, { costImpactAmount: 45_000_000, scheduleImpactDays: 7 });

    await asUser(owner.id, async (run) => {
      await run(`update change_orders set status = 'under_review' where id = $1`, [id]);
      await run(`update change_orders set status = 'awaiting_client_approval' where id = $1`, [id]);
      await run(`update change_orders set status = 'approved_unpaid' where id = $1`, [id]);
      await run(`update change_orders set status = 'approved_funded' where id = $1`, [id]);
      await run(`update change_orders set status = 'completed' where id = $1`, [id]);
      const rows = await run(`select status from change_orders where id = $1`, [id]);
      expect(rows[0]!.status).toBe('completed');
    });
  });
});

describe('trg_change_orders_guard_client_columns -- a client_approver may only record their own decision', () => {
  let project: SeedProjectWithClientAndSite;

  beforeAll(async () => {
    project = await newProject();
    clientApprover = await createUser({ organizationId: org.id, orgRole: null });
    mandor = await createUser({ organizationId: org.id, orgRole: null });
    await addProjectMember(project.id, clientApprover.id, 'client_approver');
    await addProjectMember(project.id, mandor.id, 'mandor');
  });

  it('lets a client_approver record status + their own decision columns together', async () => {
    const id = await insertChangeOrder(project.id, {
      status: 'awaiting_client_approval',
      costImpactAmount: 45_000_000,
      scheduleImpactDays: 7,
    });

    await asUser(clientApprover.id, async (run) => {
      await run(
        `update change_orders
         set status = 'approved_unpaid', client_approved_by = $2, client_approved_at = now(), client_approved_reason = 'Setuju'
         where id = $1`,
        [id, clientApprover.id],
      );
      const rows = await run(`select status, client_approved_reason from change_orders where id = $1`, [id]);
      expect(rows[0]!.status).toBe('approved_unpaid');
      expect(rows[0]!.client_approved_reason).toBe('Setuju');
    });
  });

  it('refuses a client_approver who also tries to change cost_impact_amount in the same statement', async () => {
    const id = await insertChangeOrder(project.id, {
      status: 'awaiting_client_approval',
      costImpactAmount: 45_000_000,
      scheduleImpactDays: 7,
    });

    const error = await expectRejection(
      asUser(clientApprover.id, (run) =>
        run(
          `update change_orders
           set status = 'approved_unpaid', cost_impact_amount = 1, client_approved_by = $2, client_approved_reason = 'Setuju'
           where id = $1`,
          [id, clientApprover.id],
        ),
      ),
    );
    expect(error.message).toMatch(/only record their own approve\/reject decision/i);
  });

  it('lets staff change cost_impact_amount and status together -- the client-column guard is client-only', async () => {
    const id = await insertChangeOrder(project.id, { status: 'draft' });

    await asUser(owner.id, async (run) => {
      await run(`update change_orders set status = 'under_review', cost_impact_amount = 50000000 where id = $1`, [id]);
      const rows = await run(`select status, cost_impact_amount from change_orders where id = $1`, [id]);
      expect(rows[0]!.status).toBe('under_review');
      expect(rows[0]!.cost_impact_amount).toBe('50000000');
    });
  });
});

describe('trg_work_packages_guard_change_order_funded -- the literal Fase 3 exit-criteria demo', () => {
  it('refuses attaching a work package to a change order that is not approved_funded', async () => {
    const project = await newProject();
    const id = await insertChangeOrder(project.id, { status: 'approved_unpaid' });

    const error = await expectRejection(
      sql(
        `insert into work_packages (organization_id, project_id, name, change_order_id) values ($1, $2, 'Kamar mandi baru', $3)`,
        [org.id, project.id, id],
      ),
    );
    expect(error.message).toMatch(/approved_funded/i);
  });

  it('refuses updating an existing work package to attach an unfunded change order', async () => {
    const project = await newProject();
    const changeOrderId = await insertChangeOrder(project.id, { status: 'under_review' });
    const wpRows = await sql<{ id: string }>(
      `insert into work_packages (organization_id, project_id, name) values ($1, $2, 'Pekerjaan biasa') returning id`,
      [org.id, project.id],
    );
    const workPackageId = wpRows[0]!.id;

    const error = await expectRejection(
      sql(`update work_packages set change_order_id = $1 where id = $2`, [changeOrderId, workPackageId]),
    );
    expect(error.message).toMatch(/approved_funded/i);
  });

  it('allows attaching once the change order is genuinely approved_funded', async () => {
    const project = await newProject();
    const changeOrderId = await insertChangeOrder(project.id, { status: 'approved_funded' });

    const rows = await sql<{ id: string }>(
      `insert into work_packages (organization_id, project_id, name, change_order_id) values ($1, $2, 'Kamar mandi baru', $3) returning id`,
      [org.id, project.id, changeOrderId],
    );
    expect(rows).toHaveLength(1);
  });

  it('does not re-check when change_order_id is untouched by an unrelated update', async () => {
    const project = await newProject();
    const changeOrderId = await insertChangeOrder(project.id, { status: 'approved_funded' });
    const wpRows = await sql<{ id: string }>(
      `insert into work_packages (organization_id, project_id, name, change_order_id) values ($1, $2, 'Kamar mandi baru', $3) returning id`,
      [org.id, project.id, changeOrderId],
    );
    const workPackageId = wpRows[0]!.id;

    await sql(`update work_packages set name = 'Kamar mandi baru (revisi)' where id = $1`, [workPackageId]);
    const rows = await sql<{ name: string }>('select name from work_packages where id = $1', [workPackageId]);
    expect(rows[0]!.name).toBe('Kamar mandi baru (revisi)');
  });
});

describe('RLS -- change_orders is staff-only to read/write, plus client_approver for their own project', () => {
  let project: SeedProjectWithClientAndSite;
  let changeOrderId: string;

  beforeAll(async () => {
    project = await newProject();
    changeOrderId = await insertChangeOrder(project.id, {
      status: 'awaiting_client_approval',
      costImpactAmount: 10_000_000,
      scheduleImpactDays: 3,
    });
    await addProjectMember(project.id, clientApprover.id, 'client_approver');
  });

  it('lets staff read it', async () => {
    await asUser(finance.id, async (run) => {
      const rows = await run('select id from change_orders where id = $1', [changeOrderId]);
      expect(rows).toHaveLength(1);
    });
  });

  it('hides it across organisations', async () => {
    await asUser(ownerB.id, async (run) => {
      const rows = await run('select id from change_orders where id = $1', [changeOrderId]);
      expect(rows).toHaveLength(0);
    });
  });

  it('hides it from a project role other than client_approver, e.g. mandor', async () => {
    await asUser(mandor.id, async (run) => {
      const rows = await run('select id from change_orders where id = $1', [changeOrderId]);
      expect(rows).toHaveLength(0);
    });
  });

  it('lets the client_approver on this project read it once it is past draft/under_review', async () => {
    await asUser(clientApprover.id, async (run) => {
      const rows = await run('select id, cost_impact_amount from change_orders where id = $1', [changeOrderId]);
      expect(rows).toHaveLength(1);
    });
  });

  it('hides a draft/under_review change order from the client_approver', async () => {
    const draftId = await insertChangeOrder(project.id, { status: 'draft' });
    const underReviewId = await insertChangeOrder(project.id, { status: 'under_review' });

    await asUser(clientApprover.id, async (run) => {
      expect(await run('select id from change_orders where id = $1', [draftId])).toHaveLength(0);
      expect(await run('select id from change_orders where id = $1', [underReviewId])).toHaveLength(0);
    });
  });

  it('refuses an INSERT from a client_approver -- only staff may create a variation', async () => {
    const error = await expectRejection(
      asUser(clientApprover.id, (run) =>
        run(
          `insert into change_orders (organization_id, project_id, title, requested_by) values ($1, $2, 'Liar', $3)`,
          [org.id, project.id, clientApprover.id],
        ),
      ),
    );
    expect(error.message).toMatch(/row-level security/i);
  });
});

describe('audit trail -- every transition and the client decision leave a trigger-channel record', () => {
  it('records a status_change row for an ordinary staff transition', async () => {
    const project = await newProject();
    const id = await insertChangeOrder(project.id);

    await sql(`update change_orders set status = 'under_review' where id = $1`, [id]);

    const rows = await sql(
      `select 1 from audit_logs where entity_table = 'change_orders' and entity_id = $1 and action = 'status_change' and source = 'trigger'`,
      [id],
    );
    expect(rows).toHaveLength(1);
  });

  it('records a status_change row for a client-decision-shaped update (the trigger fires regardless of actor)', async () => {
    // fn_audit_row_change is a generic AFTER trigger keyed off OLD/NEW row
    // values, not the caller's role -- audit_logs itself is staff-only to
    // *read* (no project role at all, unlike change_orders), so proving this
    // through the client_approver's own session would only prove RLS hides
    // audit_logs from them, which the RLS describe block above already
    // covers for cash_gate_overrides' identical staff-only shape. The
    // client_approver's own RLS-scoped write path is proven separately, in
    // "trg_change_orders_guard_client_columns" above, by reading
    // change_orders itself (which they can see) inline inside asUser.
    const project = await newProject();
    const id = await insertChangeOrder(project.id, {
      status: 'awaiting_client_approval',
      costImpactAmount: 20_000_000,
      scheduleImpactDays: 2,
    });

    await sql(
      `update change_orders set status = 'approved_unpaid', client_approved_by = $2, client_approved_reason = 'Setuju saja' where id = $1`,
      [id, owner.id],
    );

    // insertChangeOrder's own walk to awaiting_client_approval already left
    // status_change rows behind; find the one this specific update produced.
    const rows = await sql<{ new_value: { status: string } }>(
      `select new_value from audit_logs
       where entity_table = 'change_orders' and entity_id = $1 and action = 'status_change' and source = 'trigger'
       order by occurred_at desc limit 1`,
      [id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.new_value.status).toBe('approved_unpaid');
  });
});
