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
 * Integration/RLS tests for Fase 8's procurement tables (Wave 2-3, 7-9, ADR
 * 0018 SS6): vendors, vendor_quotes, purchase_orders, deliveries. Proves the
 * Cash Gate guard on purchase_orders actually blocks/allows at the database
 * layer (ARCHITECTURE.md 0.2 / 4.5), the same standard cash-gate.test.ts
 * holds work_packages to.
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

async function newVendor(): Promise<string> {
  const rows = await sql<{ id: string }>(
    `insert into vendors (organization_id, name) values ($1, 'Vendor Uji') returning id`,
    [org.id],
  );
  return rows[0]!.id;
}

/** Zero cleared funds against a real 14-day need -- the same red-gate setup cash-gate.test.ts uses. */
async function setGateRed(projectId: string): Promise<void> {
  await sql(
    `insert into cash_forecasts (organization_id, project_id, needed_amount, needed_by_date)
     values ($1, $2, 10000000, current_date)`,
    [org.id, projectId],
  );
}

describe('RLS -- vendors/vendor_quotes/purchase_orders/deliveries are staff-only, org-scoped', () => {
  it('lets staff insert and read a vendor for their own org', async () => {
    await asUser(procurement.id, async (run) => {
      const rows = await run(`insert into vendors (organization_id, name) values ($1, 'Toko Bangunan Jaya') returning id`, [
        org.id,
      ]);
      expect(rows).toHaveLength(1);
      expect(await run('select id from vendors where id = $1', [rows[0]!.id])).toHaveLength(1);
    });
  });

  it('hides vendors across organisations', async () => {
    const vendorId = await newVendor();
    await asUser(ownerB.id, async (run) => {
      expect(await run('select id from vendors where id = $1', [vendorId])).toHaveLength(0);
    });
  });

  it('refuses a vendor_quotes insert from a project role (mandor)', async () => {
    const project = await newProject();
    const vendorId = await newVendor();
    const mandorUser = await createUser({ organizationId: org.id, orgRole: null });
    await addProjectMember(project.id, mandorUser.id, 'mandor');

    const error = await expectRejection(
      asUser(mandorUser.id, (run) =>
        run(
          `insert into vendor_quotes (organization_id, project_id, vendor_id, description, amount)
           values ($1, $2, $3, 'Semen 50 sak', 4800000)`,
          [org.id, project.id, vendorId],
        ),
      ),
    );
    expect(error.message).toMatch(/row-level security/i);
  });

  it('lets staff read and write deliveries for their own org, hidden across organisations', async () => {
    const project = await newProject();
    const vendorId = await newVendor();
    const po = await sql<{ id: string }>(
      `insert into purchase_orders (organization_id, project_id, vendor_id, description, amount, issued_by)
       values ($1, $2, $3, 'Semen 50 sak', 4800000, $4) returning id`,
      [org.id, project.id, vendorId, owner.id],
    );

    let deliveryId = '';
    await asUser(procurement.id, async (run) => {
      const rows = await run(
        `insert into deliveries (organization_id, purchase_order_id, received_by) values ($1, $2, $3) returning id`,
        [org.id, po[0]!.id, procurement.id],
      );
      deliveryId = rows[0]!.id as string;
      expect(await run('select id from deliveries where id = $1', [deliveryId])).toHaveLength(1);
    });

    await asUser(ownerB.id, async (run) => {
      expect(await run('select id from deliveries where id = $1', [deliveryId])).toHaveLength(0);
    });
  });
});

describe('trg_purchase_orders_guard_cash_gate -- the trigger actually blocks, not just the domain layer', () => {
  it('refuses an INSERT under a red gate', async () => {
    const project = await newProject();
    const vendorId = await newVendor();
    await setGateRed(project.id);

    const error = await expectRejection(
      asUser(procurement.id, (run) =>
        run(
          `insert into purchase_orders (organization_id, project_id, vendor_id, description, amount, issued_by)
           values ($1, $2, $3, 'Semen 50 sak', 4800000, $4)`,
          [org.id, project.id, vendorId, procurement.id],
        ),
      ),
    );
    expect(error.message).toMatch(/Cash Gate/i);
  });

  it('leaves purchase_orders alone under a green gate (nothing needed at all)', async () => {
    const project = await newProject();
    const vendorId = await newVendor();

    await asUser(procurement.id, async (run) => {
      const rows = await run(
        `insert into purchase_orders (organization_id, project_id, vendor_id, description, amount, issued_by)
         values ($1, $2, $3, 'Semen 50 sak', 4800000, $4) returning id`,
        [org.id, project.id, vendorId, procurement.id],
      );
      expect(rows).toHaveLength(1);
    });
  });

  it('allows the insert once a fresh issue_po override exists', async () => {
    const project = await newProject();
    const vendorId = await newVendor();
    await setGateRed(project.id);

    await sql(
      `insert into cash_gate_overrides (organization_id, project_id, action, reason, overridden_by)
       values ($1, $2, 'issue_po'::cash_gate_action, 'Termin cair, bukti menyusul', $3)`,
      [org.id, project.id, owner.id],
    );

    await asUser(procurement.id, async (run) => {
      const rows = await run(
        `insert into purchase_orders (organization_id, project_id, vendor_id, description, amount, issued_by)
         values ($1, $2, $3, 'Semen 50 sak', 4800000, $4) returning id`,
        [org.id, project.id, vendorId, procurement.id],
      );
      expect(rows).toHaveLength(1);
    });
  });

  it('still refuses once the override is older than its 5-minute validity window', async () => {
    const project = await newProject();
    const vendorId = await newVendor();
    await setGateRed(project.id);

    await sql(
      `insert into cash_gate_overrides (organization_id, project_id, action, reason, overridden_by, created_at)
       values ($1, $2, 'issue_po'::cash_gate_action, 'Sudah lama', $3, now() - interval '6 minutes')`,
      [org.id, project.id, owner.id],
    );

    const error = await expectRejection(
      asUser(procurement.id, (run) =>
        run(
          `insert into purchase_orders (organization_id, project_id, vendor_id, description, amount, issued_by)
           values ($1, $2, $3, 'Semen 50 sak', 4800000, $4)`,
          [org.id, project.id, vendorId, procurement.id],
        ),
      ),
    );
    expect(error.message).toMatch(/Cash Gate/i);
  });
});

describe('fn_override_and_issue_purchase_order -- the atomic RPC (ADR 0010, ADR 0018 SS6)', () => {
  it('refuses a non-owner, the same way a direct cash_gate_overrides insert would', async () => {
    const project = await newProject();
    const vendorId = await newVendor();
    await setGateRed(project.id);

    const error = await expectRejection(
      asUser(procurement.id, (run) =>
        run(
          `select * from fn_override_and_issue_purchase_order($1, $2, $3, 'Semen 50 sak', 4800000, 'saya procurement, coba override')`,
          [org.id, project.id, vendorId],
        ),
      ),
    );
    expect(error.message).toMatch(/Only an owner/i);

    const rows = await sql('select id from purchase_orders where project_id = $1', [project.id]);
    expect(rows).toHaveLength(0);
  });

  it('lets an owner override and issue the PO in one transaction, leaving an audit trail', async () => {
    const project = await newProject();
    const vendorId = await newVendor();
    await setGateRed(project.id);
    const reason = 'Termin sudah cair, bukti transfer menyusul';

    await asUser(owner.id, async (run) => {
      const result = await run(
        `select * from fn_override_and_issue_purchase_order($1, $2, $3, 'Semen 50 sak', 4800000, $4)`,
        [org.id, project.id, vendorId, reason],
      );
      expect(result[0]?.amount).toBe('4800000');

      const overrides = await run(
        `select id, reason from cash_gate_overrides where project_id = $1 and action = 'issue_po'`,
        [project.id],
      );
      expect(overrides).toHaveLength(1);
      expect(overrides[0]!.reason).toBe(reason);

      const poAudit = await run(
        `select 1 from audit_logs where entity_table = 'purchase_orders' and entity_id = $1 and action = 'insert' and source = 'trigger'`,
        [result[0]!.id],
      );
      expect(poAudit).toHaveLength(1);
    });
  });
});
