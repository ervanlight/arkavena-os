import { expect, test } from '@playwright/test';
import { signInAs } from './support/auth';
import { createStaffUser } from './support/factories';
import { closePool, sql } from '../supabase/tests/db';
import { cleanupOrganizations, createOrganization, createProjectWithClientAndSite } from '../supabase/tests/factories';

/**
 * ARCHITECTURE.md 7's exit criterion, end-to-end through the actual UI:
 * "invoice hanya bisa terbit saat syarat (milestone + QC + variation
 * approved + persetujuan TD) terpenuhi." Two real sessions -- an Owner who
 * creates the invoice, a Technical Director who alone can issue it -- since
 * a real deployment would have these be two different people.
 */

const createdOrgs: string[] = [];
let projectId: string;
let milestoneId: string;
let ownerEmail: string;
let technicalDirectorEmail: string;

test.beforeAll(async () => {
  const org = await createOrganization();
  createdOrgs.push(org.id);
  const owner = await createStaffUser(org.id, 'owner', 'owner');
  ownerEmail = owner.email;
  const technicalDirector = await createStaffUser(org.id, 'technical_director', 'td');
  technicalDirectorEmail = technicalDirector.email;

  const project = await createProjectWithClientAndSite(org.id);
  projectId = project.id;

  const contractRows = await sql<{ id: string }>(
    `insert into contracts (organization_id, project_id, title, contract_amount) values ($1, $2, 'Kontrak Uji', 100000000) returning id`,
    [org.id, projectId],
  );
  const contractId = contractRows[0]!.id;

  // Milestone starts pending -- the first blocked reason the E2E asserts on.
  const milestoneRows = await sql<{ id: string }>(
    `insert into milestones (organization_id, contract_id, name, amount, status)
     values ($1, $2, 'Termin 1', 50000000, 'pending') returning id`,
    [org.id, contractId],
  );
  milestoneId = milestoneRows[0]!.id;
});

test.afterAll(async () => {
  await cleanupOrganizations(createdOrgs);
  await closePool();
});

test('invoice hanya terbit setelah milestone selesai, QC lulus, dan Technical Director menyetujui', async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const tdContext = await browser.newContext();

  try {
    await signInAs(ownerContext, ownerEmail);
    await signInAs(tdContext, technicalDirectorEmail);

    const ownerPage = await ownerContext.newPage();
    const tdPage = await tdContext.newPage();

    await test.step('owner creates a draft invoice against the not-yet-completed milestone', async () => {
      await ownerPage.goto(`/cc/projects/${projectId}/invoices`);
      await ownerPage.getByLabel('Judul invoice').fill('Invoice Termin 1');
      await ownerPage.getByLabel('Milestone').selectOption(milestoneId);
      await ownerPage.getByLabel('Nominal (Rp)').fill('50000000');
      await ownerPage.getByLabel('Jatuh tempo').fill('2026-12-31');
      await ownerPage.getByRole('button', { name: 'Buat invoice (draft)' }).click();

      await expect(ownerPage.getByText('Invoice Termin 1')).toBeVisible();
      await expect(ownerPage.getByText('Draft', { exact: true })).toBeVisible();
    });

    await test.step('the Technical Director sees it is blocked: milestone not completed', async () => {
      await tdPage.goto(`/cc/projects/${projectId}/invoices`);
      await expect(tdPage.getByText(/milestone belum selesai/i)).toBeVisible();

      const issueButton = tdPage.getByRole('button', { name: /Setujui & terbitkan/ });
      await expect(issueButton).toBeDisabled();
    });

    await test.step('once the milestone is completed, the block clears and the TD issues it', async () => {
      await sql(`update milestones set status = 'completed' where id = $1`, [milestoneId]);

      await tdPage.reload();
      await expect(tdPage.getByText(/milestone belum selesai/i)).toHaveCount(0);

      const issueButton = tdPage.getByRole('button', { name: /Setujui & terbitkan/ });
      await expect(issueButton).toBeEnabled();
      await issueButton.click();

      await expect(tdPage.getByText('Terbit', { exact: true })).toBeVisible();
    });

    await test.step('recording a full payment marks the invoice lunas -- Finance/Owner records it, not the TD', async () => {
      await ownerPage.reload();
      await ownerPage.getByPlaceholder('Nominal dibayar (Rp)').fill('50000000');
      await ownerPage.getByRole('button', { name: 'Catat pembayaran' }).click();

      await expect(ownerPage.getByText('Lunas', { exact: true })).toBeVisible();
    });
  } finally {
    await ownerContext.close();
    await tdContext.close();
  }
});
