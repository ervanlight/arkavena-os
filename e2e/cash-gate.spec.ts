import { expect, test } from '@playwright/test';
import { signInAs } from './support/auth';
import { createStaffUser } from './support/factories';
import { closePool, sql } from '../supabase/tests/db';
import { cleanupOrganizations, createOrganization, createProjectWithClientAndSite } from '../supabase/tests/factories';

/**
 * CLAUDE.md 8's first named critical flow: "termin dibayar -> gate hijau ->
 * PO bisa terbit". purchase_orders does not exist yet (Fase 8, ADR 0009
 * decision 1) -- work_packages is the real, provable trigger Fase 2 built
 * and this test drives, the same substitution the manual CG9 verification
 * used. Builds its own fixtures via supabase/tests/factories.ts (CLAUDE.md
 * 8's own requirement), and cleans them up itself.
 */

const createdOrgs: string[] = [];
let projectId: string;
let ownerEmail: string;

test.beforeAll(async () => {
  const org = await createOrganization();
  createdOrgs.push(org.id);
  const owner = await createStaffUser(org.id, 'owner', 'owner');
  ownerEmail = owner.email;

  const project = await createProjectWithClientAndSite(org.id);
  projectId = project.id;

  // A real cash need with nothing cleared against it yet -- the gate must
  // start red, not trivially green.
  await sql(
    `insert into cash_forecasts (organization_id, project_id, needed_amount, needed_by_date)
     values ($1, $2, 50000000, current_date)`,
    [org.id, projectId],
  );

  await sql(`insert into work_packages (organization_id, project_id, name) values ($1, $2, 'Pekerjaan pondasi')`, [
    org.id,
    projectId,
  ]);
});

test.afterAll(async () => {
  await cleanupOrganizations(createdOrgs);
  await closePool();
});

test('termin dibayar -> gate hijau -> pekerjaan bisa dimulai', async ({ page, context }) => {
  await signInAs(context, ownerEmail);

  await test.step('gate starts red, and starting the work package is refused', async () => {
    await page.goto(`/cc/projects/${projectId}/cash-gate`);
    await expect(page.getByText('Merah', { exact: true })).toBeVisible();

    await page.goto(`/cc/projects/${projectId}`);
    await page.getByRole('button', { name: 'Mulai pekerjaan' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText('Belum mulai')).toBeVisible();
  });

  await test.step('record and clear a termin covering the need', async () => {
    await page.goto(`/cc/projects/${projectId}/cash-gate`);

    // Both the funding-receipt and cash-forecast forms on this page share
    // the label "Nominal (Rp)" -- the placeholder is what's unique.
    await page.getByPlaceholder('mis. 50000000').fill('60000000');
    await page.getByLabel('Diharapkan cair').fill(new Date().toISOString().slice(0, 10));
    await page.getByRole('button', { name: 'Catat termin' }).click();

    await expect(page.getByRole('button', { name: 'Tandai cair' })).toBeVisible();
    await page.getByRole('button', { name: 'Tandai cair' }).click();
    await expect(page.getByText('Cair', { exact: true })).toBeVisible();
  });

  await test.step('gate turns green, and the work package can now start', async () => {
    await page.reload();
    await expect(page.getByText('Hijau', { exact: true })).toBeVisible();

    await page.goto(`/cc/projects/${projectId}`);
    await page.getByRole('button', { name: 'Mulai pekerjaan' }).click();
    await expect(page.getByText('Berjalan')).toBeVisible();
  });
});
