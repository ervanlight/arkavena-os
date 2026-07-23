import { expect, test } from '@playwright/test';
import { signInAs } from './support/auth';
import { createStaffUser } from './support/factories';
import { closePool, sql } from '../supabase/tests/db';
import { cleanupOrganizations, createOrganization, createProjectWithClientAndSite } from '../supabase/tests/factories';

/**
 * Fase 11's own exit criteria (ADR 0024): a supplier invited through the
 * Command Center's vendor detail page can sign in to Partner Desk and see
 * their own vendor's quotes/purchase-orders -- and never another vendor's,
 * even on the same project. Same reasoning as every other phase's own
 * spec.ts this session: a full server-action/RLS layer existed already
 * (partner-desk.test.ts proves RLS directly), but this proves the whole
 * pipeline -- invite UI, real provisioning, real sign-in, real RLS -- works
 * end to end through an actual browser, not just assertions against
 * individual layers.
 */

const createdOrgs: string[] = [];
let ownerEmail: string;
let projectId: string;
let projectName: string;
let vendorAId: string;
let vendorBId: string;
const supplierEmail = `supplier-${Date.now()}@test.local`;

test.beforeAll(async () => {
  const org = await createOrganization();
  createdOrgs.push(org.id);
  const owner = await createStaffUser(org.id, 'owner', 'owner');
  ownerEmail = owner.email;

  const project = await createProjectWithClientAndSite(org.id);
  projectId = project.id;
  projectName = project.name;

  const vendorARows = await sql<{ id: string }>(
    `insert into vendors (organization_id, name) values ($1, 'Vendor Semen Jaya') returning id`,
    [org.id],
  );
  vendorAId = vendorARows[0]!.id;

  const vendorBRows = await sql<{ id: string }>(
    `insert into vendors (organization_id, name) values ($1, 'Vendor Besi Makmur') returning id`,
    [org.id],
  );
  vendorBId = vendorBRows[0]!.id;

  await sql(
    `insert into vendor_quotes (organization_id, project_id, vendor_id, description, amount)
     values ($1, $2, $3, 'Semen 100 sak', 9600000)`,
    [org.id, projectId, vendorAId],
  );
  await sql(
    `insert into vendor_quotes (organization_id, project_id, vendor_id, description, amount)
     values ($1, $2, $3, 'Besi beton 12mm', 15000000)`,
    [org.id, projectId, vendorBId],
  );
});

test.afterAll(async () => {
  await cleanupOrganizations(createdOrgs);
  await closePool();
});

test('staff invites a supplier from the vendor page; supplier signs in and sees only their own vendor’s quote', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const NAV_TIMEOUT = { timeout: 30_000 };

  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  await signInAs(ownerContext, ownerEmail);

  await ownerPage.goto(`/cc/vendors/${vendorAId}`, NAV_TIMEOUT);
  await expect(ownerPage.getByRole('heading', { name: 'Vendor Semen Jaya' })).toBeVisible();

  await ownerPage.getByLabel('Nama kontak *').fill('Pak Slamet');
  await ownerPage.getByLabel('Email *').fill(supplierEmail);
  await ownerPage.getByLabel('Proyek (opsional)').selectOption({ label: projectName });
  await ownerPage.getByRole('button', { name: 'Undang ke Partner Desk' }).click();
  await expect(ownerPage.getByText('Kontak vendor berhasil diundang.')).toBeVisible();

  await ownerContext.close();

  const supplierContext = await browser.newContext();
  const supplierPage = await supplierContext.newPage();
  await signInAs(supplierContext, supplierEmail);

  await supplierPage.goto('/partner', NAV_TIMEOUT);
  await supplierPage.waitForURL(new RegExp(`/partner/${projectId}`), NAV_TIMEOUT);

  await expect(supplierPage.getByText('Semen 100 sak')).toBeVisible();
  await expect(supplierPage.getByText('Besi beton 12mm')).toHaveCount(0);

  await supplierContext.close();
});
