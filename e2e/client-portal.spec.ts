import { expect, test } from '@playwright/test';
import { signInAs } from './support/auth';
import { createExternalUser, createStaffUser } from './support/factories';
import { closePool, sql } from '../supabase/tests/db';
import { addProjectMember, cleanupOrganizations, createOrganization, createProjectWithClientAndSite } from '../supabase/tests/factories';

/**
 * ARCHITECTURE.md's Fase 6 exit criterion: "klien demo hanya melihat yang
 * halal (dibuktikan RLS test)" -- CP8 proved the RLS half with raw SQL,
 * this proves the same thing end-to-end through the actual portal UI a
 * client would use: sign in, see your own project's overview and a
 * pending decision with its Decision Clock, approve it through the portal
 * (ADR 0016, "approval variation pindah ke portal"), and see it move to
 * history. A second client, unrelated to this project, sees none of it.
 */

const createdOrgs: string[] = [];
let projectId: string;
let clientApproverEmail: string;
let unrelatedClientEmail: string;
let changeOrderId: string;

test.beforeAll(async () => {
  const org = await createOrganization();
  createdOrgs.push(org.id);
  const owner = await createStaffUser(org.id, 'owner', 'owner');

  const project = await createProjectWithClientAndSite(org.id);
  projectId = project.id;

  const clientApprover = await createExternalUser(org.id, 'client-approver');
  clientApproverEmail = clientApprover.email;
  await addProjectMember(projectId, clientApprover.id, 'client_approver');

  // A second, unrelated project's client -- must see none of the above.
  const otherProject = await createProjectWithClientAndSite(org.id);
  const unrelatedClient = await createExternalUser(org.id, 'unrelated-client');
  unrelatedClientEmail = unrelatedClient.email;
  await addProjectMember(otherProject.id, unrelatedClient.id, 'client_viewer');

  await sql(
    `insert into contracts (organization_id, project_id, title, contract_amount) values ($1, $2, 'Kontrak Renovasi', 250000000)`,
    [org.id, projectId],
  );

  const coRows = await sql<{ id: string }>(
    `insert into change_orders (organization_id, project_id, title, description, status, requested_by)
     values ($1, $2, 'Tambah kamar mandi lantai 2', 'Klien minta tambah 1 kamar mandi baru', 'draft'::change_order_status, $3)
     returning id`,
    [org.id, projectId, owner.id],
  );
  changeOrderId = coRows[0]!.id;
  await sql(`update change_orders set status = 'under_review' where id = $1`, [changeOrderId]);
  await sql(`update change_orders set cost_impact_amount = 45000000, schedule_impact_days = 7 where id = $1`, [
    changeOrderId,
  ]);
  await sql(`update change_orders set status = 'awaiting_client_approval' where id = $1`, [changeOrderId]);
});

test.afterAll(async () => {
  await cleanupOrganizations(createdOrgs);
  await closePool();
});

test('klien melihat portal proyeknya, memutuskan variation dari dalam portal, dan tetangga proyek lain tidak melihat apa pun', async ({
  browser,
}) => {
  const clientContext = await browser.newContext();
  const unrelatedContext = await browser.newContext();

  try {
    await signInAs(clientContext, clientApproverEmail);
    await signInAs(unrelatedContext, unrelatedClientEmail);

    const clientPage = await clientContext.newPage();
    const unrelatedPage = await unrelatedContext.newPage();

    await test.step('the project client lands on their own overview (single project, no picker)', async () => {
      await clientPage.goto('/portal');
      // Redirected straight past the project picker -- exactly one project.
      await expect(clientPage).toHaveURL(new RegExp(`/portal/${projectId}$`));
      await expect(clientPage.getByText('Rp 250.000.000')).toBeVisible();
    });

    await test.step('the pending decision shows its Decision Clock and links into the approve flow', async () => {
      await expect(clientPage.getByText('Menunggu keputusan Anda')).toBeVisible();
      await expect(clientPage.getByText('Baru')).toBeVisible();

      await clientPage.getByRole('link', { name: 'Lihat & putuskan' }).click();
      await expect(clientPage).toHaveURL(new RegExp(`/variations/${changeOrderId}/approve`));
      await expect(clientPage.getByText('Rp 45.000.000')).toBeVisible();

      await clientPage.getByLabel('Catatan persetujuan').fill('Setuju, silakan lanjutkan.');
      await clientPage.getByRole('button', { name: 'Setujui variation ini' }).click();
      await expect(clientPage.getByText(/sudah diputuskan sebelumnya/)).toBeVisible();
    });

    await test.step('the Keputusan page now shows it decided, not pending', async () => {
      await clientPage.goto(`/portal/${projectId}/keputusan`);
      await expect(clientPage.getByText('Tidak ada yang menunggu.')).toBeVisible();
      await expect(clientPage.getByText('Disetujui')).toBeVisible();
    });

    await test.step("an unrelated project's client gets a 404, not this project's data", async () => {
      const response = await unrelatedPage.goto(`/portal/${projectId}`);
      // getClientProjectOverviewAction returns null -- RLS shows this user no
      // row for this project_id at all -- and the page calls notFound().
      expect(response?.status()).toBe(404);
      await expect(unrelatedPage.getByText('Rp 250.000.000')).toHaveCount(0);
      await expect(unrelatedPage.getByText('Tambah kamar mandi lantai 2')).toHaveCount(0);
    });
  } finally {
    await clientContext.close();
    await unrelatedContext.close();
  }
});
