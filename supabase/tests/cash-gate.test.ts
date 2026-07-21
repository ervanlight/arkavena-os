import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CASH_GATE_GREEN_BP, CASH_GATE_YELLOW_FLOOR_BP } from '@/core/money/rupiah';
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
 * Integration/DB tests for Fase 2's Cash Gate (CG7, ARCHITECTURE.md 0.2 /
 * 4.5's "trigger genuinely rejects, not just the domain layer" requirement).
 *
 * These write SQL directly, the same way audit.test.ts and fase1-rls.test.ts
 * do -- proving the database itself refuses, independent of any application
 * code that could be bypassed.
 */

type SeedProjectWithClientAndSite = SeedProject & { clientRow: SeedClient; siteRow: SeedSite };

const createdOrgs: string[] = [];

let org: SeedOrg;
let owner: SeedUser;
let finance: SeedUser;
let mandor: SeedUser;
let clientViewer: SeedUser;

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

/** A fresh project per scenario, so one test's forecasts/receipts never leak into another's ratio. */
async function newProject(): Promise<SeedProjectWithClientAndSite> {
  return createProjectWithClientAndSite(org.id);
}

async function setGateInputs(
  projectId: string,
  input: { clearedFunds: number; next14DayNeeds: number },
): Promise<void> {
  await sql(
    `insert into funding_receipts (organization_id, project_id, amount, expected_date, cleared_at)
     values ($1, $2, $3, current_date, now())`,
    [org.id, projectId, input.clearedFunds],
  );
  await sql(
    `insert into cash_forecasts (organization_id, project_id, needed_amount, needed_by_date)
     values ($1, $2, $3, current_date)`,
    [org.id, projectId, input.next14DayNeeds],
  );
}

async function insertWorkPackage(projectId: string, status: 'not_started' | 'in_progress' = 'not_started') {
  const rows = await sql<{ id: string }>(
    `insert into work_packages (organization_id, project_id, name, status) values ($1, $2, $3, $4::work_package_status) returning id`,
    [org.id, projectId, `Pekerjaan ${status}`, status],
  );
  return rows[0]!.id;
}

async function insertOverride(
  projectId: string,
  overriddenBy: string,
  options: { reason?: string; createdAt?: string } = {},
) {
  const rows = await sql<{ id: string }>(
    `insert into cash_gate_overrides (organization_id, project_id, action, reason, overridden_by, created_at)
     values ($1, $2, 'open_work_package'::cash_gate_action, $3, $4, coalesce($5::timestamptz, now()))
     returning id`,
    [org.id, projectId, options.reason ?? 'Termin cair, bukti menyusul', overriddenBy, options.createdAt ?? null],
  );
  return rows[0]!.id;
}

describe('fn_cash_gate_status -- mirrors computeFundingCoverage exactly, at the exact thresholds', () => {
  it('is green at the exact green boundary', async () => {
    const project = await newProject();
    await setGateInputs(project.id, { clearedFunds: CASH_GATE_GREEN_BP, next14DayNeeds: 10_000 });
    const rows = await sql<{ status: string }>('select fn_cash_gate_status($1) as status', [project.id]);
    expect(rows[0]!.status).toBe('green');
  });

  it('is yellow one basis point below the green boundary', async () => {
    const project = await newProject();
    await setGateInputs(project.id, { clearedFunds: CASH_GATE_GREEN_BP - 1, next14DayNeeds: 10_000 });
    const rows = await sql<{ status: string }>('select fn_cash_gate_status($1) as status', [project.id]);
    expect(rows[0]!.status).toBe('yellow');
  });

  it('is yellow at the exact yellow floor', async () => {
    const project = await newProject();
    await setGateInputs(project.id, { clearedFunds: CASH_GATE_YELLOW_FLOOR_BP, next14DayNeeds: 10_000 });
    const rows = await sql<{ status: string }>('select fn_cash_gate_status($1) as status', [project.id]);
    expect(rows[0]!.status).toBe('yellow');
  });

  it('is red one basis point below the yellow floor', async () => {
    const project = await newProject();
    await setGateInputs(project.id, { clearedFunds: CASH_GATE_YELLOW_FLOOR_BP - 1, next14DayNeeds: 10_000 });
    const rows = await sql<{ status: string }>('select fn_cash_gate_status($1) as status', [project.id]);
    expect(rows[0]!.status).toBe('red');
  });

  it('is green when nothing is needed at all, even with zero cleared funds', async () => {
    const project = await newProject();
    const rows = await sql<{ status: string }>('select fn_cash_gate_status($1) as status', [project.id]);
    expect(rows[0]!.status).toBe('green');
  });

  it('is overdue regardless of how healthy the ratio is', async () => {
    const project = await newProject();
    await setGateInputs(project.id, { clearedFunds: 999_999_999, next14DayNeeds: 1 });
    await sql(
      `insert into funding_receipts (organization_id, project_id, amount, expected_date)
       values ($1, $2, $3, current_date - 8)`,
      [org.id, project.id, 500_000],
    );
    const rows = await sql<{ status: string }>('select fn_cash_gate_status($1) as status', [project.id]);
    expect(rows[0]!.status).toBe('overdue');
  });
});

describe('trg_work_packages_guard_cash_gate -- the trigger actually blocks, not just the domain layer', () => {
  it('refuses an INSERT straight into in_progress under a red gate', async () => {
    const project = await newProject();
    await setGateInputs(project.id, { clearedFunds: 0, next14DayNeeds: 10_000 });

    const error = await expectRejection(
      asUser(finance.id, (run) =>
        run(
          `insert into work_packages (organization_id, project_id, name, status)
           values ($1, $2, 'Pekerjaan liar', 'in_progress'::work_package_status)`,
          [org.id, project.id],
        ),
      ),
    );
    expect(error.message).toMatch(/Cash Gate red/i);
  });

  it('refuses an UPDATE into in_progress under a red gate, then allows it once a fresh override exists', async () => {
    const project = await newProject();
    await setGateInputs(project.id, { clearedFunds: 0, next14DayNeeds: 10_000 });
    const workPackageId = await insertWorkPackage(project.id);

    const blocked = await expectRejection(
      asUser(finance.id, (run) =>
        run(`update work_packages set status = 'in_progress' where id = $1`, [workPackageId]),
      ),
    );
    expect(blocked.message).toMatch(/Cash Gate red/i);

    await insertOverride(project.id, owner.id);

    await asUser(finance.id, async (run) => {
      await run(`update work_packages set status = 'in_progress' where id = $1`, [workPackageId]);
      const rows = await run(`select status from work_packages where id = $1`, [workPackageId]);
      expect(rows[0]!.status).toBe('in_progress');
    });
  });

  it('still refuses once the override is older than its 5-minute validity window', async () => {
    const project = await newProject();
    await setGateInputs(project.id, { clearedFunds: 0, next14DayNeeds: 10_000 });
    const workPackageId = await insertWorkPackage(project.id);

    await insertOverride(project.id, owner.id, { createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString() });

    const error = await expectRejection(
      asUser(finance.id, (run) =>
        run(`update work_packages set status = 'in_progress' where id = $1`, [workPackageId]),
      ),
    );
    expect(error.message).toMatch(/Cash Gate red/i);
  });

  it('does not re-fire when a work package is already in_progress and gets some other update', async () => {
    const project = await newProject();
    await setGateInputs(project.id, { clearedFunds: 0, next14DayNeeds: 10_000 });
    await insertOverride(project.id, owner.id);
    const workPackageId = await insertWorkPackage(project.id);
    await sql(`update work_packages set status = 'in_progress' where id = $1`, [workPackageId]);

    // The one-time override has already been consumed conceptually, but the
    // trigger only re-checks on a transition *into* in_progress -- renaming a
    // work package that is already there must not require a fresh override.
    await asUser(finance.id, async (run) => {
      await run(`update work_packages set name = 'Nama baru' where id = $1`, [workPackageId]);
      const rows = await run(`select name from work_packages where id = $1`, [workPackageId]);
      expect(rows[0]!.name).toBe('Nama baru');
    });
  });

  it('leaves work packages alone under a green gate', async () => {
    const project = await newProject();
    await setGateInputs(project.id, { clearedFunds: CASH_GATE_GREEN_BP, next14DayNeeds: 10_000 });
    const workPackageId = await insertWorkPackage(project.id);

    await asUser(finance.id, async (run) => {
      await run(`update work_packages set status = 'in_progress' where id = $1`, [workPackageId]);
      const rows = await run(`select status from work_packages where id = $1`, [workPackageId]);
      expect(rows[0]!.status).toBe('in_progress');
    });
  });
});

describe('trg_cash_gate_overrides_guard_owner_only -- database-layer owner check', () => {
  it('refuses an override inserted by a non-owner, straight in SQL', async () => {
    const project = await newProject();

    const error = await expectRejection(
      asUser(finance.id, (run) =>
        run(
          `insert into cash_gate_overrides (organization_id, project_id, action, reason, overridden_by)
           values ($1, $2, 'open_work_package'::cash_gate_action, 'saya finance, coba override', $3)`,
          [org.id, project.id, finance.id],
        ),
      ),
    );
    expect(error.message).toMatch(/Only an owner/i);
  });

  it('allows the same insert from an owner', async () => {
    const project = await newProject();

    await asUser(owner.id, async (run) => {
      await run(
        `insert into cash_gate_overrides (organization_id, project_id, action, reason, overridden_by)
         values ($1, $2, 'open_work_package'::cash_gate_action, 'saya owner', $3)`,
        [org.id, project.id, owner.id],
      );
      const rows = await run(`select id from cash_gate_overrides where project_id = $1`, [project.id]);
      expect(rows).toHaveLength(1);
    });
  });
});

describe('fn_override_and_open_work_package -- the atomic RPC (ADR 0010)', () => {
  it('refuses a non-owner, the same way a direct insert would', async () => {
    const project = await newProject();
    await setGateInputs(project.id, { clearedFunds: 0, next14DayNeeds: 10_000 });
    const workPackageId = await insertWorkPackage(project.id);

    const error = await expectRejection(
      asUser(finance.id, (run) =>
        run(`select * from fn_override_and_open_work_package($1, $2)`, [
          workPackageId,
          'saya finance, coba override lewat rpc',
        ]),
      ),
    );
    expect(error.message).toMatch(/Only an owner/i);

    const rows = await sql<{ status: string }>('select status from work_packages where id = $1', [workPackageId]);
    expect(rows[0]!.status).toBe('not_started');
  });

  it('lets an owner override and open the work package in one transaction, leaving an audit trail', async () => {
    const project = await newProject();
    await setGateInputs(project.id, { clearedFunds: 0, next14DayNeeds: 10_000 });
    const workPackageId = await insertWorkPackage(project.id);
    const reason = 'Termin sudah cair, bukti transfer menyusul';

    // Read everything inside the same transaction: asUser always rolls back
    // in its `finally`, so a privileged sql() call made after this block
    // would see none of it (audit.test.ts's "records the acting user" test
    // hits the same thing and reads inline for the same reason).
    await asUser(owner.id, async (run) => {
      const result = await run(`select * from fn_override_and_open_work_package($1, $2)`, [workPackageId, reason]);
      expect(result[0]!.status).toBe('in_progress');

      const overrides = await run(`select id, reason from cash_gate_overrides where project_id = $1`, [project.id]);
      expect(overrides).toHaveLength(1);
      expect(overrides[0]!.reason).toBe(reason);

      // Channel 1 (fn_audit_row_change, trg_cash_gate_overrides_audit /
      // work_packages' own audit trigger from Wave 6) -- proof the database
      // itself recorded both changes, independent of any application-level
      // recordAudit() call that could be skipped.
      const overrideAudit = await run(
        `select 1 from audit_logs where entity_table = 'cash_gate_overrides' and entity_id = $1 and action = 'insert' and source = 'trigger'`,
        [overrides[0]!.id],
      );
      expect(overrideAudit).toHaveLength(1);

      const workPackageAudit = await run(
        `select 1 from audit_logs where entity_table = 'work_packages' and entity_id = $1 and action = 'status_change' and source = 'trigger'`,
        [workPackageId],
      );
      expect(workPackageAudit).toHaveLength(1);
    });
  });
});

describe('RLS -- funding_receipts, cash_forecasts, cash_gate_overrides, project_risk_reserves are all staff-only, org-scoped', () => {
  let project: SeedProjectWithClientAndSite;
  let fundingReceiptId: string;
  let cashForecastId: string;

  beforeAll(async () => {
    project = await newProject();
    mandor = await createUser({ organizationId: org.id, orgRole: null });
    clientViewer = await createUser({ organizationId: org.id, orgRole: null });
    await addProjectMember(project.id, mandor.id, 'mandor');
    await addProjectMember(project.id, clientViewer.id, 'client_viewer');

    const receipt = await sql<{ id: string }>(
      `insert into funding_receipts (organization_id, project_id, amount, expected_date) values ($1, $2, $3, current_date) returning id`,
      [org.id, project.id, 1_000_000],
    );
    fundingReceiptId = receipt[0]!.id;

    const forecast = await sql<{ id: string }>(
      `insert into cash_forecasts (organization_id, project_id, needed_amount, needed_by_date) values ($1, $2, $3, current_date) returning id`,
      [org.id, project.id, 1_000_000],
    );
    cashForecastId = forecast[0]!.id;

    await sql(`insert into project_risk_reserves (organization_id, project_id, risk_reserve_amount) values ($1, $2, $3)`, [
      org.id,
      project.id,
      5_000_000,
    ]);
  });

  it('lets staff read funding_receipts and cash_forecasts for their org', async () => {
    await asUser(owner.id, async (run) => {
      expect(await run('select id from funding_receipts where id = $1', [fundingReceiptId])).toHaveLength(1);
      expect(await run('select id from cash_forecasts where id = $1', [cashForecastId])).toHaveLength(1);
    });
  });

  it('hides funding_receipts and cash_forecasts from a project role (mandor)', async () => {
    await asUser(mandor.id, async (run) => {
      expect(await run('select id from funding_receipts where id = $1', [fundingReceiptId])).toHaveLength(0);
      expect(await run('select id from cash_forecasts where id = $1', [cashForecastId])).toHaveLength(0);
    });
  });

  it('hides funding_receipts and cash_forecasts across organisations', async () => {
    await asUser(ownerB.id, async (run) => {
      expect(await run('select id from funding_receipts where id = $1', [fundingReceiptId])).toHaveLength(0);
      expect(await run('select id from cash_forecasts where id = $1', [cashForecastId])).toHaveLength(0);
    });
  });

  it('lets staff read the override history for their org', async () => {
    const overrideId = await insertOverride(project.id, owner.id);
    await asUser(finance.id, async (run) => {
      const rows = await run('select id from cash_gate_overrides where id = $1', [overrideId]);
      expect(rows).toHaveLength(1);
    });
  });

  describe('project_risk_reserves -- the ADR 0011 regression: this must NOT repeat the projects leak', () => {
    it('lets staff read the risk reserve for their own org', async () => {
      await asUser(owner.id, async (run) => {
        const rows = await run('select risk_reserve_amount from project_risk_reserves where project_id = $1', [
          project.id,
        ]);
        expect(rows).toHaveLength(1);
        expect(rows[0]!.risk_reserve_amount).toBe('5000000');
      });
    });

    it('hides it from a client-facing project role who can otherwise read the project itself', async () => {
      // The premise that made this a real bug on `projects`: client_viewer
      // really can read the project row.
      await asUser(clientViewer.id, async (run) => {
        const projectRows = await run('select id from projects where id = $1', [project.id]);
        expect(projectRows).toHaveLength(1);

        // But project_risk_reserves must give up nothing, unlike the old
        // projects.risk_reserve_amount column did.
        const reserveRows = await run('select risk_reserve_amount from project_risk_reserves where project_id = $1', [
          project.id,
        ]);
        expect(reserveRows).toHaveLength(0);
      });
    });

    it('hides it from a project role in general (mandor), same as funding_receipts/cash_forecasts', async () => {
      await asUser(mandor.id, async (run) => {
        const rows = await run('select id from project_risk_reserves where project_id = $1', [project.id]);
        expect(rows).toHaveLength(0);
      });
    });

    it('refuses an insert from a project role', async () => {
      const error = await expectRejection(
        asUser(mandor.id, (run) =>
          run('insert into project_risk_reserves (organization_id, project_id, risk_reserve_amount) values ($1, $2, $3)', [
            org.id,
            project.id,
            1,
          ]),
        ),
      );
      expect(error.message).toMatch(/row-level security/i);
    });
  });

  it('confirms the old projects.risk_reserve_amount column is actually gone (ADR 0011 contract step)', async () => {
    const rows = await sql(
      `select 1 from information_schema.columns where table_schema = 'public' and table_name = 'projects' and column_name = 'risk_reserve_amount'`,
    );
    expect(rows).toHaveLength(0);
  });
});
