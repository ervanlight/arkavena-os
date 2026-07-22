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
 * Integration/DB tests for Fase 7's Billing issuance gate (BL8,
 * ARCHITECTURE.md 7's exit criterion, ADR 0017). Same discipline as
 * quality-gate.test.ts: write SQL directly, sign in as the actual role,
 * prove the database itself refuses -- independent of any application code
 * that could be bypassed.
 */

type SeedProjectWithClientAndSite = SeedProject & { clientRow: SeedClient; siteRow: SeedSite };

const createdOrgs: string[] = [];

let org: SeedOrg;
let owner: SeedUser;
let technicalDirector: SeedUser;
let clientApprover: SeedUser;
let project: SeedProjectWithClientAndSite;
let contractId: string;

let orgB: SeedOrg;
let clientApproverB: SeedUser;
let projectB: SeedProjectWithClientAndSite;

beforeAll(async () => {
  const a = await createOrgWithStaff();
  org = a.org;
  owner = a.owner;
  technicalDirector = a.technicalDirector;
  project = await createProjectWithClientAndSite(org.id);
  clientApprover = await createUser({ organizationId: org.id, orgRole: null });
  await addProjectMember(project.id, clientApprover.id, 'client_approver');

  const contractRows = await sql<{ id: string }>(
    `insert into contracts (organization_id, project_id, title, contract_amount) values ($1, $2, 'Kontrak Uji', 200000000) returning id`,
    [org.id, project.id],
  );
  contractId = contractRows[0]!.id;

  const b = await createOrgWithStaff();
  orgB = b.org;
  projectB = await createProjectWithClientAndSite(orgB.id);
  clientApproverB = await createUser({ organizationId: orgB.id, orgRole: null });
  await addProjectMember(projectB.id, clientApproverB.id, 'client_approver');

  createdOrgs.push(org.id, orgB.id);
});

afterAll(async () => {
  await cleanupOrganizations(createdOrgs);
  await closePool();
});

async function insertMilestone(status: 'pending' | 'completed' = 'completed'): Promise<string> {
  const rows = await sql<{ id: string }>(
    `insert into milestones (organization_id, contract_id, name, amount, status) values ($1, $2, 'Termin Uji', 50000000, $3) returning id`,
    [org.id, contractId, status],
  );
  return rows[0]!.id;
}

async function insertInvoice(milestoneId: string, changeOrderId: string | null = null): Promise<string> {
  const rows = await sql<{ id: string }>(
    `insert into invoices (organization_id, project_id, milestone_id, change_order_id, title, amount, due_date, created_by)
     values ($1, $2, $3, $4, 'Invoice Uji', 50000000, current_date, $5) returning id`,
    [org.id, project.id, milestoneId, changeOrderId, owner.id],
  );
  return rows[0]!.id;
}

describe('fn_invoices_guard_issuance -- the real DB-layer block for issuance', () => {
  it('rejects issuing when the milestone is not completed', async () => {
    const milestoneId = await insertMilestone('pending');
    const invoiceId = await insertInvoice(milestoneId);

    const error = await expectRejection(
      sql(`update invoices set status = 'issued', approved_by = $2 where id = $1`, [invoiceId, technicalDirector.id]),
    );
    expect(error.message).toMatch(/milestone belum selesai/i);
  });

  it('rejects issuing when a required hold point on the milestone has no passing/overridden inspection', async () => {
    const milestoneId = await insertMilestone('completed');
    const workType = `billing_qc_${milestoneId.slice(0, 8)}`;
    await sql(`insert into hold_point_templates (organization_id, work_type, name) values ($1, $2, 'Flood test')`, [
      org.id,
      workType,
    ]);
    await sql(
      `insert into work_packages (organization_id, project_id, milestone_id, name, work_type) values ($1, $2, $3, 'Waterproofing', $4)`,
      [org.id, project.id, milestoneId, workType],
    );
    const invoiceId = await insertInvoice(milestoneId);

    const error = await expectRejection(
      sql(`update invoices set status = 'issued', approved_by = $2 where id = $1`, [invoiceId, technicalDirector.id]),
    );
    expect(error.message).toMatch(/qc belum lulus/i);
  });

  it('rejects issuing when the linked variation is not approved_funded', async () => {
    const milestoneId = await insertMilestone('completed');
    const [changeOrder] = await sql<{ id: string }>(
      `insert into change_orders (organization_id, project_id, title, requested_by, status)
       values ($1, $2, 'Variasi Uji', $3, 'draft') returning id`,
      [org.id, project.id, owner.id],
    );
    const invoiceId = await insertInvoice(milestoneId, changeOrder!.id);

    const error = await expectRejection(
      sql(`update invoices set status = 'issued', approved_by = $2 where id = $1`, [invoiceId, technicalDirector.id]),
    );
    expect(error.message).toMatch(/variation terkait belum approved_funded/i);
  });

  it('rejects issuing without any approver set at all', async () => {
    const milestoneId = await insertMilestone('completed');
    const invoiceId = await insertInvoice(milestoneId);

    const error = await expectRejection(sql(`update invoices set status = 'issued' where id = $1`, [invoiceId]));
    expect(error.message).toMatch(/wajib disetujui technical director/i);
  });

  it('rejects issuing when the approver is not a Technical Director, even the Owner', async () => {
    const milestoneId = await insertMilestone('completed');
    const invoiceId = await insertInvoice(milestoneId);

    const error = await expectRejection(
      sql(`update invoices set status = 'issued', approved_by = $2 where id = $1`, [invoiceId, owner.id]),
    );
    expect(error.message).toMatch(/hanya technical director/i);
  });

  it('allows issuing once milestone is completed, QC passes, variation is funded, and a TD approves', async () => {
    const milestoneId = await insertMilestone('completed');
    const workType = `billing_qc_ok_${milestoneId.slice(0, 8)}`;
    const [template] = await sql<{ id: string }>(
      `insert into hold_point_templates (organization_id, work_type, name) values ($1, $2, 'Flood test') returning id`,
      [org.id, workType],
    );
    const [workPackage] = await sql<{ id: string }>(
      `insert into work_packages (organization_id, project_id, milestone_id, name, work_type) values ($1, $2, $3, 'Waterproofing', $4) returning id`,
      [org.id, project.id, milestoneId, workType],
    );
    const [zone] = await sql<{ id: string }>(
      `insert into zones (organization_id, project_id, name) values ($1, $2, 'Zona Uji') returning id`,
      [org.id, project.id],
    );
    await sql(
      `insert into inspections (organization_id, project_id, work_package_id, zone_id, hold_point_template_id, status)
       values ($1, $2, $3, $4, $5, 'passed')`,
      [org.id, project.id, workPackage!.id, zone!.id, template!.id],
    );
    // A new change order must start as draft (fn_change_orders_guard_insert_status,
    // ADR 0012) -- walk it through the real transition graph to approved_funded.
    const [changeOrder] = await sql<{ id: string }>(
      `insert into change_orders (organization_id, project_id, title, requested_by, status)
       values ($1, $2, 'Variasi Uji', $3, 'draft') returning id`,
      [org.id, project.id, owner.id],
    );
    await sql(`update change_orders set status = 'under_review' where id = $1`, [changeOrder!.id]);
    await sql(`update change_orders set cost_impact_amount = 10000000, schedule_impact_days = 3 where id = $1`, [
      changeOrder!.id,
    ]);
    await sql(`update change_orders set status = 'awaiting_client_approval' where id = $1`, [changeOrder!.id]);
    await sql(
      `update change_orders set status = 'approved_unpaid', client_approved_by = $2, client_approved_at = now() where id = $1`,
      [changeOrder!.id, clientApprover.id],
    );
    await sql(`update change_orders set status = 'approved_funded', funded_by = $2, funded_at = now() where id = $1`, [
      changeOrder!.id,
      owner.id,
    ]);
    const invoiceId = await insertInvoice(milestoneId, changeOrder!.id);

    await sql(`update invoices set status = 'issued', approved_by = $2 where id = $1`, [invoiceId, technicalDirector.id]);
    const rows = await sql<{ status: string; issued_at: string | null }>(
      'select status, issued_at from invoices where id = $1',
      [invoiceId],
    );
    expect(rows[0]!.status).toBe('issued');
    expect(rows[0]!.issued_at).not.toBeNull();
  });
});

describe("fn_invoices_sync_funding_receipt / fn_payments_sync_invoice_paid -- ADR 0017's Cash Gate mirror", () => {
  it('mirrors an issued invoice into funding_receipts', async () => {
    const milestoneId = await insertMilestone('completed');
    const invoiceId = await insertInvoice(milestoneId);
    await sql(`update invoices set status = 'issued', approved_by = $2 where id = $1`, [invoiceId, technicalDirector.id]);

    const rows = await sql<{ amount: string; cleared_at: string | null }>(
      'select amount, cleared_at from funding_receipts where invoice_id = $1',
      [invoiceId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.amount).toBe('50000000');
    expect(rows[0]!.cleared_at).toBeNull();
  });

  it('marks the invoice paid and clears the mirrored funding_receipts row once payments cover the full amount', async () => {
    const milestoneId = await insertMilestone('completed');
    const invoiceId = await insertInvoice(milestoneId);
    await sql(`update invoices set status = 'issued', approved_by = $2 where id = $1`, [invoiceId, technicalDirector.id]);

    await sql(`insert into payments (organization_id, invoice_id, amount, recorded_by) values ($1, $2, 30000000, $3)`, [
      org.id,
      invoiceId,
      owner.id,
    ]);
    let invoiceRow = await sql<{ status: string }>('select status from invoices where id = $1', [invoiceId]);
    expect(invoiceRow[0]!.status).toBe('issued'); // partial payment -- not yet paid

    await sql(`insert into payments (organization_id, invoice_id, amount, recorded_by) values ($1, $2, 20000000, $3)`, [
      org.id,
      invoiceId,
      owner.id,
    ]);
    invoiceRow = await sql<{ status: string }>('select status from invoices where id = $1', [invoiceId]);
    expect(invoiceRow[0]!.status).toBe('paid');

    const receiptRow = await sql<{ cleared_at: string | null }>(
      'select cleared_at from funding_receipts where invoice_id = $1',
      [invoiceId],
    );
    expect(receiptRow[0]!.cleared_at).not.toBeNull();
  });
});

describe('invoices/payments -- RLS', () => {
  it("lets Project A's client see their own project's issued invoice, but never a draft", async () => {
    const milestoneId = await insertMilestone('completed');
    const invoiceId = await insertInvoice(milestoneId);

    await asUser(clientApprover.id, async (run) => {
      const draftRows = await run('select id from invoices where id = $1', [invoiceId]);
      expect(draftRows).toHaveLength(0);
    });

    await sql(`update invoices set status = 'issued', approved_by = $2 where id = $1`, [invoiceId, technicalDirector.id]);

    await asUser(clientApprover.id, async (run) => {
      const issuedRows = await run('select id from invoices where id = $1', [invoiceId]);
      expect(issuedRows).toHaveLength(1);
    });
  });

  it("hides Project A's invoice from a different organisation's client entirely", async () => {
    const milestoneId = await insertMilestone('completed');
    const invoiceId = await insertInvoice(milestoneId);
    await sql(`update invoices set status = 'issued', approved_by = $2 where id = $1`, [invoiceId, technicalDirector.id]);

    await asUser(clientApproverB.id, async (run) => {
      const rows = await run('select id from invoices where id = $1', [invoiceId]);
      expect(rows).toHaveLength(0);
    });
  });

  it('refuses a client attempting to insert an invoice directly', async () => {
    const milestoneId = await insertMilestone('completed');
    const error = await expectRejection(
      asUser(clientApprover.id, (run) =>
        run(
          `insert into invoices (organization_id, project_id, milestone_id, title, amount, due_date, created_by)
           values ($1, $2, $3, 'Invoice Nakal', 1000000, current_date, $4)`,
          [org.id, project.id, milestoneId, clientApprover.id],
        ),
      ),
    );
    expect(error.message).toMatch(/row-level security/i);
  });
});
