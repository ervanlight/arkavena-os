import { expect, test } from '@playwright/test';
import { signInAs } from './support/auth';
import { createExternalUser } from './support/factories';
import { closePool, sql } from '../supabase/tests/db';
import { addProjectMember, cleanupOrganizations, createOrganization, createProjectWithClientAndSite } from '../supabase/tests/factories';

/**
 * The offline scenario the owner named explicitly (FR9): a daily report
 * saved with no connectivity appears once the connection returns.
 *
 * `context.setOffline(true)` genuinely severs the browser's network layer
 * (Playwright's CDP-backed offline emulation) -- the form's submit handler
 * (submit-with-offline-fallback.ts) sees a real thrown fetch failure, the
 * same condition a mandor's phone losing signal mid-tap produces, and falls
 * back to the IndexedDB outbox (core/offline). Flipping `setOffline(false)`
 * fires the browser's own `online` event, which is one of the three signals
 * useOutboxSync listens for -- the assertion polls the database rather than
 * waiting a fixed delay, since the drain is a real network round trip.
 */

const createdOrgs: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizations(createdOrgs);
  await closePool();
});

test('a daily log saved offline appears once the connection returns', async ({ browser }) => {
  const org = await createOrganization();
  createdOrgs.push(org.id);
  const project = await createProjectWithClientAndSite(org.id);
  const mandor = await createExternalUser(org.id, 'e2e-offline-mandor');
  await addProjectMember(project.id, mandor.id, 'mandor');

  const context = await browser.newContext();
  await signInAs(context, mandor.email);
  const page = await context.newPage();

  await page.goto(`/site/laporan-harian?projectId=${project.id}`);

  await context.setOffline(true);

  await page.getByLabel('Cuaca').fill('Badai offline test');
  await page.getByLabel('Jumlah pekerja').fill('7');
  await page.getByRole('button', { name: 'Simpan Laporan' }).click();

  await expect(page.getByText('Tersimpan offline')).toBeVisible();

  // Genuinely queued locally, not already synced through some other path.
  const beforeSync = await sql('select id from daily_logs where project_id = $1', [project.id]);
  expect(beforeSync).toHaveLength(0);

  await context.setOffline(false);

  await expect
    .poll(
      async () => {
        const rows = await sql('select id from daily_logs where project_id = $1', [project.id]);
        return rows.length;
      },
      { timeout: 15_000 },
    )
    .toBe(1);

  const [row] = await sql<{ weather: string; manpower_count: number }>(
    'select weather, manpower_count from daily_logs where project_id = $1',
    [project.id],
  );
  expect(row).toMatchObject({ weather: 'Badai offline test', manpower_count: 7 });

  await context.close();
});
