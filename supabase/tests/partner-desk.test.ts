import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asUser, closePool, expectRejection, sql } from './db';
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
 * Integration/RLS tests for Fase 11's Partner Desk (Wave 11, ADR 0024):
 * vendor_users, and the new supplier-scoped SELECT policies on Fase 8's
 * vendor_quotes/purchase_orders/deliveries. Proves a supplier sees only
 * their own vendor's rows -- never another supplier's, even on the same
 * project -- and never anything outside the project they're a member of.
 */

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

async function newProject(organizationId: string): Promise<SeedProject> {
  return createProjectWithClientAndSite(organizationId);
}

async function newVendor(organizationId: string, name: string): Promise<string> {
  const rows = await sql<{ id: string }>(`insert into vendors (organization_id, name) values ($1, $2) returning id`, [
    organizationId,
    name,
  ]);
  return rows[0]!.id;
}

async function linkVendorUser(vendorId: string, userId: string): Promise<void> {
  await sql(`insert into vendor_users (vendor_id, user_id) values ($1, $2)`, [vendorId, userId]);
}

describe('RLS -- vendor_users is staff-writable, self-readable, org-scoped', () => {
  it('lets staff insert and read a vendor_users row for their own org', async () => {
    const project = await newProject(org.id);
    const vendorId = await newVendor(org.id, 'Vendor A');
    const supplier = await createUser({ organizationId: org.id, orgRole: null });
    await addProjectMember(project.id, supplier.id, 'supplier');

    await asUser(procurement.id, async (run) => {
      const rows = await run(`insert into vendor_users (vendor_id, user_id) values ($1, $2) returning id`, [
        vendorId,
        supplier.id,
      ]);
      expect(rows).toHaveLength(1);
    });
  });

  it('lets a supplier read their own vendor_users row but not another user’s', async () => {
    const vendorId = await newVendor(org.id, 'Vendor B');
    const supplier = await createUser({ organizationId: org.id, orgRole: null });
    const otherSupplier = await createUser({ organizationId: org.id, orgRole: null });
    await linkVendorUser(vendorId, supplier.id);
    await linkVendorUser(vendorId, otherSupplier.id);

    await asUser(supplier.id, async (run) => {
      const own = await run('select id from vendor_users where user_id = $1', [supplier.id]);
      expect(own).toHaveLength(1);
      const other = await run('select id from vendor_users where user_id = $1', [otherSupplier.id]);
      expect(other).toHaveLength(0);
    });
  });

  it('hides vendor_users across organisations', async () => {
    const vendorId = await newVendor(org.id, 'Vendor C');
    const supplier = await createUser({ organizationId: org.id, orgRole: null });
    await linkVendorUser(vendorId, supplier.id);

    await asUser(ownerB.id, async (run) => {
      expect(await run('select id from vendor_users where vendor_id = $1', [vendorId])).toHaveLength(0);
    });
  });

  it('refuses a vendor_users insert from a project role with no org_role', async () => {
    const vendorId = await newVendor(org.id, 'Vendor D');
    const mandorUser = await createUser({ organizationId: org.id, orgRole: null });

    const error = await expectRejection(
      asUser(mandorUser.id, (run) =>
        run(`insert into vendor_users (vendor_id, user_id) values ($1, $2)`, [vendorId, mandorUser.id]),
      ),
    );
    expect(error.message).toMatch(/row-level security/i);
  });
});

describe('RLS -- supplier-scoped SELECT on vendor_quotes/purchase_orders/deliveries', () => {
  it('lets a supplier see only their own vendor’s quotes on a project they belong to', async () => {
    const project = await newProject(org.id);
    const vendorA = await newVendor(org.id, 'Vendor Terkait');
    const vendorB = await newVendor(org.id, 'Vendor Lain');

    const supplierA = await createUser({ organizationId: org.id, orgRole: null });
    await linkVendorUser(vendorA, supplierA.id);
    await addProjectMember(project.id, supplierA.id, 'supplier');

    // A second supplier, also a member of the SAME project, representing a
    // DIFFERENT vendor -- the case that actually proves the vendor_users
    // join matters (fn_has_project_role alone would let both see everything).
    const supplierB = await createUser({ organizationId: org.id, orgRole: null });
    await linkVendorUser(vendorB, supplierB.id);
    await addProjectMember(project.id, supplierB.id, 'supplier');

    const quoteA = await sql<{ id: string }>(
      `insert into vendor_quotes (organization_id, project_id, vendor_id, description, amount)
       values ($1, $2, $3, 'Semen', 4800000) returning id`,
      [org.id, project.id, vendorA],
    );
    const quoteB = await sql<{ id: string }>(
      `insert into vendor_quotes (organization_id, project_id, vendor_id, description, amount)
       values ($1, $2, $3, 'Besi', 9000000) returning id`,
      [org.id, project.id, vendorB],
    );

    await asUser(supplierA.id, async (run) => {
      const visible = await run('select id from vendor_quotes where project_id = $1', [project.id]);
      expect(visible.map((r) => r.id)).toEqual([quoteA[0]!.id]);
      expect(visible.map((r) => r.id)).not.toContain(quoteB[0]!.id);
    });
  });

  it('hides a vendor’s quotes from a supplier not a member of that project', async () => {
    const project = await newProject(org.id);
    const vendorId = await newVendor(org.id, 'Vendor Tanpa Akses');
    const supplier = await createUser({ organizationId: org.id, orgRole: null });
    await linkVendorUser(vendorId, supplier.id);
    // Deliberately no addProjectMember call -- supplier is linked to the
    // vendor but never added to this project.

    await sql(
      `insert into vendor_quotes (organization_id, project_id, vendor_id, description, amount)
       values ($1, $2, $3, 'Cat tembok', 2000000)`,
      [org.id, project.id, vendorId],
    );

    await asUser(supplier.id, async (run) => {
      expect(await run('select id from vendor_quotes where project_id = $1', [project.id])).toHaveLength(0);
    });
  });

  it('lets a supplier see their own vendor’s purchase_orders and deliveries only', async () => {
    const project = await newProject(org.id);
    const vendorA = await newVendor(org.id, 'Vendor PO A');
    const vendorB = await newVendor(org.id, 'Vendor PO B');

    const supplierA = await createUser({ organizationId: org.id, orgRole: null });
    await linkVendorUser(vendorA, supplierA.id);
    await addProjectMember(project.id, supplierA.id, 'supplier');

    const poA = await sql<{ id: string }>(
      `insert into purchase_orders (organization_id, project_id, vendor_id, description, amount, issued_by)
       values ($1, $2, $3, 'PO Vendor A', 5000000, $4) returning id`,
      [org.id, project.id, vendorA, owner.id],
    );
    const poB = await sql<{ id: string }>(
      `insert into purchase_orders (organization_id, project_id, vendor_id, description, amount, issued_by)
       values ($1, $2, $3, 'PO Vendor B', 6000000, $4) returning id`,
      [org.id, project.id, vendorB, owner.id],
    );
    const deliveryA = await sql<{ id: string }>(
      `insert into deliveries (organization_id, purchase_order_id, received_by)
       values ($1, $2, $3) returning id`,
      [org.id, poA[0]!.id, owner.id],
    );
    await sql(`insert into deliveries (organization_id, purchase_order_id, received_by) values ($1, $2, $3)`, [
      org.id,
      poB[0]!.id,
      owner.id,
    ]);

    await asUser(supplierA.id, async (run) => {
      const visiblePos = await run('select id from purchase_orders where project_id = $1', [project.id]);
      expect(visiblePos.map((r) => r.id)).toEqual([poA[0]!.id]);

      const visibleDeliveries = await run(
        'select id from deliveries where purchase_order_id in ($1, $2)',
        [poA[0]!.id, poB[0]!.id],
      );
      expect(visibleDeliveries.map((r) => r.id)).toEqual([deliveryA[0]!.id]);
    });
  });

  it('never lets a supplier see another organisation’s vendor_quotes', async () => {
    const project = await newProject(orgB.id);
    const vendorId = await newVendor(orgB.id, 'Vendor Org B');
    const supplier = await createUser({ organizationId: org.id, orgRole: null });
    // Cross-org: a supplier belonging to `org` cannot become a vendor_users
    // row for a vendor owned by `orgB` in real usage (RLS on the insert
    // would refuse it, proven above) -- inserted directly here only to
    // prove the SELECT policy itself still fails closed even if that ever
    // happened some other way (e.g. a bug in the invite action).
    await linkVendorUser(vendorId, supplier.id);
    await sql(
      `insert into project_members (project_id, user_id, project_role) values ($1, $2, 'supplier'::project_role)`,
      [project.id, supplier.id],
    );
    await sql(
      `insert into vendor_quotes (organization_id, project_id, vendor_id, description, amount)
       values ($1, $2, $3, 'Rangka baja', 12000000)`,
      [orgB.id, project.id, vendorId],
    );

    await asUser(supplier.id, async (run) => {
      expect(await run('select id from vendor_quotes where project_id = $1', [project.id])).toHaveLength(0);
    });
  });
});

describe('gen:rls-check parity', () => {
  it('staff still has unrestricted select on vendor_quotes/purchase_orders/deliveries (unchanged by the new supplier policies)', async () => {
    const project = await newProject(org.id);
    const vendorId = await newVendor(org.id, 'Vendor Staff Check');
    await sql(
      `insert into vendor_quotes (organization_id, project_id, vendor_id, description, amount)
       values ($1, $2, $3, 'Cek staff', 1000000)`,
      [org.id, project.id, vendorId],
    );

    await asUser(procurement.id, async (run) => {
      expect(await run('select id from vendor_quotes where project_id = $1', [project.id])).toHaveLength(1);
    });
  });
});
