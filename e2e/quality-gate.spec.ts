import { expect, test } from '@playwright/test';
import { signInAs } from './support/auth';
import { createStaffUser } from './support/factories';
import { closePool, sql } from '../supabase/tests/db';
import { cleanupOrganizations, createOrganization, createProjectWithClientAndSite } from '../supabase/tests/factories';

/**
 * CLAUDE.md 8's third named critical flow: "inspeksi gagal -> pekerjaan
 * penutup terkunci -> override TD -> terbuka + audit terlihat." The
 * waterproofing scenario ARCHITECTURE.md 4.5 names by example: a flood test
 * fails, the work package that would close over it is refused, and only a
 * Technical Director's reasoned override reopens it.
 */

const createdOrgs: string[] = [];
let projectId: string;
let technicalDirectorEmail: string;

test.beforeAll(async () => {
  const org = await createOrganization();
  createdOrgs.push(org.id);
  const technicalDirector = await createStaffUser(org.id, 'technical_director', 'td');
  technicalDirectorEmail = technicalDirector.email;

  const project = await createProjectWithClientAndSite(org.id);
  projectId = project.id;

  const zoneRows = await sql<{ id: string }>(
    `insert into zones (organization_id, project_id, name) values ($1, $2, 'Kamar mandi lantai 2') returning id`,
    [org.id, projectId],
  );
  const zoneId = zoneRows[0]!.id;

  await sql(
    `insert into hold_point_templates (organization_id, work_type, name) values ($1, 'waterproofing', 'Flood test')`,
    [org.id],
  );

  await sql(
    `insert into work_packages (organization_id, project_id, zone_id, name, work_type)
     values ($1, $2, $3, 'Waterproofing kamar mandi lantai 2', 'waterproofing')`,
    [org.id, projectId, zoneId],
  );
});

test.afterAll(async () => {
  await cleanupOrganizations(createdOrgs);
  await closePool();
});

test('inspeksi gagal -> pekerjaan terkunci -> override TD -> terbuka + alasan terlihat', async ({ page, context }) => {
  await signInAs(context, technicalDirectorEmail);

  await test.step('start the flood test inspection and record it as failed', async () => {
    await page.goto(`/cc/projects/${projectId}/quality-gate`);
    await expect(page.getByText('Flood test')).toBeVisible();

    await page.getByRole('button', { name: 'Mulai pemeriksaan' }).click();
    await expect(page.getByRole('button', { name: 'Tidak lulus' })).toBeVisible();

    await page.getByRole('button', { name: 'Tidak lulus' }).click();
    // The status badge is a <span>, distinct from the "Tidak lulus" <button>
    // that stays visible alongside it -- getByText alone would match both.
    await expect(page.locator('span', { hasText: 'Tidak lulus' })).toBeVisible();
  });

  await test.step('the work package is refused: a failed hold point blocks it', async () => {
    await page.goto(`/cc/projects/${projectId}`);
    await page.getByRole('button', { name: 'Mulai pekerjaan' }).click();

    // Same assertion shape as cash-gate.spec.ts's equivalent step: an alert
    // appears and the transition never happens. It does not check the exact
    // text -- repositories collapse every Postgres error to InfraError's
    // generic message before core/errors/handle.ts's specific-message mapping
    // ever sees it (a pre-existing, cross-cutting gap found while writing
    // this test, flagged separately rather than fixed here).
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText('Belum mulai')).toBeVisible();
  });

  await test.step('Technical Director overrides the failed hold point with a reason', async () => {
    await page.goto(`/cc/projects/${projectId}/quality-gate`);
    await page.getByPlaceholder('Alasan override (wajib, tercatat di audit log)').fill(
      'Genangan sudah dites ulang manual dan aman, klien butuh lanjut hari ini.',
    );
    await page.getByRole('button', { name: 'Override (Technical Director)' }).click();

    await expect(page.getByText('Di-override TD')).toBeVisible();
    await expect(page.getByText(/Genangan sudah dites ulang manual/)).toBeVisible();
  });

  await test.step('the work package now starts, and stays started', async () => {
    await page.goto(`/cc/projects/${projectId}`);
    await page.getByRole('button', { name: 'Mulai pekerjaan' }).click();

    await expect(page.getByText('Berjalan')).toBeVisible();
  });
});
