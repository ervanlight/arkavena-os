import { expect, test } from '@playwright/test';
import { signInAs } from './support/auth';
import { createExternalUser, createStaffUser } from './support/factories';
import { closePool, sql } from '../supabase/tests/db';
import { addProjectMember, cleanupOrganizations, createOrganization, createProjectWithClientAndSite } from '../supabase/tests/factories';

/**
 * CLAUDE.md 8's second named critical flow: "variation approve -> bayar ->
 * work package variation muncul di SiteFlow". SiteFlow itself is Fase 4 and
 * does not exist yet -- the project's own work-packages list (Command
 * Center) is what this codebase actually has today, the same substitution
 * flagged to the owner before Fase 3's UI was built and confirmed during
 * the manual SV10 walkthrough this test codifies.
 *
 * Two real sessions in one test -- a client_approver and an owner -- each
 * its own browser context, since a real deployment would have these be two
 * different people on two different devices.
 */

const createdOrgs: string[] = [];
let projectId: string;
let changeOrderId: string;
let ownerEmail: string;
let clientApproverEmail: string;

test.beforeAll(async () => {
  const org = await createOrganization();
  createdOrgs.push(org.id);
  const owner = await createStaffUser(org.id, 'owner', 'owner');
  ownerEmail = owner.email;

  const project = await createProjectWithClientAndSite(org.id);
  projectId = project.id;

  const clientApprover = await createExternalUser(org.id, 'client-approver');
  clientApproverEmail = clientApprover.email;
  await addProjectMember(projectId, clientApprover.id, 'client_approver');

  const coRows = await sql<{ id: string }>(
    `insert into change_orders (organization_id, project_id, title, description, status, requested_by)
     values ($1, $2, 'Tambah kamar mandi lantai 2', 'Klien minta tambah 1 kamar mandi baru', 'draft'::change_order_status, $3)
     returning id`,
    [org.id, projectId, owner.id],
  );
  changeOrderId = coRows[0]!.id;
  await sql(`update change_orders set status = 'under_review' where id = $1`, [changeOrderId]);
  await sql(`update change_orders set cost_impact_amount = 45000000, schedule_impact_days = 7 where id = $1`, [changeOrderId]);
  await sql(`update change_orders set status = 'awaiting_client_approval' where id = $1`, [changeOrderId]);
});

test.afterAll(async () => {
  await cleanupOrganizations(createdOrgs);
  await closePool();
});

test('klien approve variation -> dana masuk -> paket kerja muncul di daftar kerja proyek', async ({ browser }) => {
  const clientContext = await browser.newContext();
  const ownerContext = await browser.newContext();

  try {
    await signInAs(clientContext, clientApproverEmail);
    await signInAs(ownerContext, ownerEmail);

    const clientPage = await clientContext.newPage();
    const ownerPage = await ownerContext.newPage();

    await test.step('client_approver approves via the secure link', async () => {
      await clientPage.goto(`/variations/${changeOrderId}/approve`);
      await expect(clientPage.getByText('Rp 45.000.000')).toBeVisible();

      await clientPage.getByLabel('Catatan persetujuan').fill('Setuju, silakan lanjutkan.');
      await clientPage.getByRole('button', { name: 'Setujui variation ini' }).click();

      await expect(clientPage.getByText(/Anda setujui/)).toBeVisible();
    });

    await test.step('owner marks the funding received', async () => {
      await ownerPage.goto(`/cc/projects/${projectId}/variations/${changeOrderId}`);
      await expect(ownerPage.getByText('Disetujui, menunggu dana')).toBeVisible();

      await ownerPage.getByRole('button', { name: 'Tandai dana masuk' }).click();
      await expect(ownerPage.getByText('Dana masuk, siap dikerjakan')).toBeVisible();
    });

    await test.step('owner opens the work package', async () => {
      await ownerPage.getByLabel('Nama paket kerja').fill('Pemasangan kamar mandi lantai 2');
      await ownerPage.getByRole('button', { name: 'Buka paket kerja' }).click();
      // Next.js's own route-announcer (`__next-route-announcer__`) is
      // *always* rendered with role="alert" for a11y, so `getByRole('alert')`
      // alone is not a reliable "no error" check -- this module's own error
      // spans always carry visible text, the announcer never does.
      await expect(ownerPage.getByRole('alert').filter({ hasText: /.+/ })).toHaveCount(0);
    });

    await test.step('the work package genuinely appears in the project work-packages list', async () => {
      await ownerPage.goto(`/cc/projects/${projectId}`);
      const row = ownerPage.getByRole('listitem').filter({ hasText: 'Pemasangan kamar mandi lantai 2' });
      await expect(row).toBeVisible();
      await expect(row.getByText('Dari variation')).toBeVisible();
      await expect(row.getByText('Belum mulai')).toBeVisible();
    });
  } finally {
    await clientContext.close();
    await ownerContext.close();
  }
});
