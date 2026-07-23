import { expect, test } from '@playwright/test';
import { signInAs } from './support/auth';
import { createStaffUser } from './support/factories';
import { closePool, sql } from '../supabase/tests/db';
import { cleanupOrganizations, createOrganization } from '../supabase/tests/factories';

/**
 * Fase 8's own exit criteria (ARCHITECTURE.md 7): "alur lead -> assessment ->
 * proposal -> kontrak -> baseline jalan; margin di bawah floor memicu
 * warning." Unlike Fase 2/3/5's own named critical flows (CLAUDE.md 8),
 * Fase 8 was built entirely without a Command Center UI or an E2E test --
 * this is the one that closes that gap, clicking through the real pages
 * (leads, assessments, estimates, proposals) exactly the way variation.spec.ts
 * and quality-gate.spec.ts already do for their own phases.
 *
 * "kontrak" has no Command Center UI of its own yet (a pre-existing Fase 1
 * gap, not this phase's to fix) -- inserted via SQL here, the same way
 * variation.spec.ts sets up change_orders state it has no UI path for.
 *
 * One owner session throughout: everything in this flow is staff-only
 * (ADR 0018, no client/project-role surface exists for any Fase 8 table).
 */

const createdOrgs: string[] = [];
let ownerEmail: string;

test.beforeAll(async () => {
  const org = await createOrganization();
  createdOrgs.push(org.id);
  const owner = await createStaffUser(org.id, 'owner', 'owner');
  ownerEmail = owner.email;
  // Below the default Rp 500.000.000 threshold marker isn't asserted on --
  // the score is cosmetic here, the flow itself is what this test proves.
});

test.afterAll(async () => {
  await cleanupOrganizations(createdOrgs);
  await closePool();
});

test('lead -> assessment -> estimasi -> proposal -> kontrak -> baseline, end to end', async ({ browser }) => {
  // Generous timeouts throughout this spec: every step's page loads several
  // server actions in Promise.all (project/estimate/margin/proposals, ...),
  // and this container's dev server logged its own "Slow filesystem
  // detected" warning -- a cold Turbopack compile plus that combination
  // legitimately took 6+ seconds per navigation during manual verification,
  // well past Playwright's 5s assertion default.
  test.setTimeout(180_000);
  const NAV_TIMEOUT = { timeout: 30_000 };

  const context = await browser.newContext();
  try {
    await signInAs(context, ownerEmail);
    const page = await context.newPage();

    let projectId = '';
    let projectUrl = '';

    await test.step('buat lead baru', async () => {
      await page.goto('/cc/leads/new');
      await page.getByLabel('Nama kontak *').fill('Budi Santoso');
      await page.getByLabel('Estimasi nilai (Rp)').fill('750000000');
      await page.getByRole('button', { name: 'Simpan lead' }).click();
      await expect(page).toHaveURL(/\/cc\/leads\/[0-9a-f-]+$/, NAV_TIMEOUT);
    });

    await test.step('lead maju ke qualified (new -> contacted -> qualified)', async () => {
      // The status badge, not the <option> text of the same name inside the
      // status-change <select> just below it -- getByText alone matches both.
      const statusBadge = page.locator('span.rounded-full');

      await page.getByLabel('Status baru').selectOption('contacted');
      await page.getByRole('button', { name: 'Ubah status' }).click();
      await expect(statusBadge).toHaveText('Dihubungi', NAV_TIMEOUT);

      await page.getByLabel('Status baru').selectOption('qualified');
      await page.getByRole('button', { name: 'Ubah status' }).click();
      await expect(statusBadge).toHaveText('Qualified', NAV_TIMEOUT);
    });

    await test.step('konversi lead menjadi proyek (klien + lokasi baru sekaligus)', async () => {
      await page.getByLabel('Nama proyek *').fill('Renovasi Rumah Budi');
      await page.getByLabel('Nama klien baru *').fill('Budi Santoso');
      await page.getByLabel('Nama lokasi baru *').fill('Rumah Budi - Jl. Merdeka 10');
      await page.getByRole('button', { name: 'Konversi ke proyek' }).click();

      await expect(page).toHaveURL(/\/cc\/projects\/[0-9a-f-]+$/, NAV_TIMEOUT);
      projectUrl = page.url();
      projectId = projectUrl.split('/cc/projects/')[1]!.replace(/\/$/, '');
      expect(projectId).toMatch(/^[0-9a-f-]+$/);
    });

    await test.step('buat assessment untuk lokasi yang baru dibuat', async () => {
      await page.goto('/cc/assessments/new');
      await page.getByLabel('Lokasi *').selectOption({ label: 'Rumah Budi - Jl. Merdeka 10' });
      await page.getByLabel('Lead terkait').selectOption({ label: 'Budi Santoso' });
      await page.getByLabel('Kondisi lokasi').fill('Atap bocor di sisi timur, dinding retak ringan.');
      await page.getByLabel('Ruang lingkup direkomendasikan').fill('Perbaikan atap dan pengecatan ulang.');
      await page.getByRole('button', { name: 'Simpan assessment' }).click();

      await expect(page).toHaveURL(/\/cc\/assessments\/[0-9a-f-]+$/, NAV_TIMEOUT);
    });

    await test.step('selesaikan assessment', async () => {
      await page.getByRole('button', { name: 'Tandai selesai' }).click();
      // Exact text on the status badge, not a substring match against
      // "Selesaikan assessment" (the heading) or "...selesai, dengan..." (the
      // form's own helper text) -- getByText does substring matching by default.
      await expect(page.locator('span.rounded-full')).toHaveText('Selesai', NAV_TIMEOUT);
    });

    let estimateUrl = '';

    await test.step('buat estimasi untuk proyek', async () => {
      await page.goto(`/cc/projects/${projectId}/estimates/new`);
      await page.getByLabel('Judul *').fill('Estimasi awal');
      await page.getByRole('button', { name: 'Buat estimasi' }).click();

      await expect(page).toHaveURL(new RegExp(`/cc/projects/${projectId}/estimates/[0-9a-f-]+$`), NAV_TIMEOUT);
      estimateUrl = page.url();
    });

    await test.step('tambah item dan lihat margin terhitung', async () => {
      await page.getByLabel('Deskripsi *').fill('Perbaikan atap');
      await page.getByLabel('Satuan *').fill('m2');
      await page.getByLabel('Kuantitas *').fill('20');
      await page.getByLabel('Biaya satuan (Rp) *').fill('100000');
      await page.getByLabel('Harga satuan (Rp) *').fill('150000');
      await page.getByRole('button', { name: 'Tambah item' }).click();

      await expect(page.getByText('Rp 2.000.000')).toBeVisible(NAV_TIMEOUT); // total cost
      await expect(page.getByText('Rp 3.000.000')).toBeVisible(NAV_TIMEOUT); // total price
    });

    await test.step('buat dan kirim proposal dari estimasi ini', async () => {
      await page.getByRole('button', { name: 'Buat proposal dari estimasi ini' }).click();
      await expect(page).toHaveURL(new RegExp(`/cc/projects/${projectId}/proposals/[0-9a-f-]+$`), NAV_TIMEOUT);

      await page.getByRole('button', { name: 'Kirim proposal' }).click();
      // "Terkirim pada" (a <dt> label) also contains this substring --
      // getByText matches substrings by default, so the status badge needs
      // an exact match, same as the lead/assessment status badges above.
      await expect(page.locator('span.rounded-full')).toHaveText('Terkirim', NAV_TIMEOUT);
    });

    await test.step('klien menerima proposal (diinput oleh staf)', async () => {
      await page.getByLabel('Keputusan *').selectOption('accepted');
      await page.getByLabel('Alasan *').fill('Klien setuju dengan harga dan lingkup pekerjaan.');
      await page.getByRole('button', { name: 'Simpan keputusan' }).click();
      await expect(page.locator('span.rounded-full')).toHaveText('Diterima', NAV_TIMEOUT);
    });

    await test.step('kontrak diterbitkan (belum ada UI Command Center untuk ini -- gap Fase 1, dicatat langsung)', async () => {
      await sql(
        `insert into contracts (organization_id, project_id, title, contract_amount, status, signed_date)
         values ((select organization_id from projects where id = $1), $1, 'Kontrak Renovasi Rumah Budi', 3000000, 'active'::contract_status, current_date)`,
        [projectId],
      );
      const rows = await sql<{ id: string }>('select id from contracts where project_id = $1', [projectId]);
      expect(rows).toHaveLength(1);
    });

    await test.step('jadikan estimasi ini baseline proyek', async () => {
      await page.goto(estimateUrl);
      await page.getByRole('button', { name: 'Jadikan baseline' }).click();
      // getByText is case-insensitive and substring-matching by default, so a
      // plain 'Baseline' would also match the still-rendered "Jadikan
      // baseline" heading before the post-mutation refresh lands -- a false
      // positive that would pass even if the mutation never actually landed
      // client-side. The emerald badge is the one unambiguous signal.
      await expect(page.locator('span.bg-emerald-100')).toHaveText('Baseline', NAV_TIMEOUT);
    });

    await test.step('baseline benar-benar tercatat di database, bukan cuma di UI', async () => {
      const rows = await sql<{ is_baseline: boolean }>(
        `select is_baseline from estimates where project_id = $1 and is_baseline = true`,
        [projectId],
      );
      expect(rows).toHaveLength(1);
    });
  } finally {
    await context.close();
  }
});
