import { expect, test } from '@playwright/test';
import { signInAs } from './support/auth';
import { createStaffUser } from './support/factories';
import { closePool, sql } from '../supabase/tests/db';
import {
  cleanupOrganizations,
  createOrganization,
  createProjectWithClientAndSite,
} from '../supabase/tests/factories';

/**
 * Fase 9's own exit criteria (ARCHITECTURE.md 7): "proyek selesai otomatis
 * membentuk warranty register + galeri before-after; tiket servis jalan."
 * Same reasoning as fase8-lead-to-baseline.spec.ts: this phase shipped with
 * a full server-action/RLS layer (F9-1/F9-2) but needed an actual browser
 * click-through to prove its own exit criteria, not just assert it.
 *
 * "Proyek selesai" has no Command Center UI of its own (a pre-existing
 * Fase 1 gap -- updateProjectAction already allows setting status =
 * 'completed', nothing in the UI exposes it yet, same class of gap as
 * fase8-lead-to-baseline.spec.ts's own "kontrak" step), so it's set directly
 * via SQL here, same precedent. "Galeri before-after" similarly has no
 * photo-upload UI in Command Center to click through (that lives in
 * SiteFlow/field-reporting, a different module, out of this phase's scope
 * to rebuild) -- verified directly at the schema level instead.
 *
 * One owner session throughout: everything in this flow is staff-only
 * (ADR 0019, no client/project-role surface exists for any Fase 9 table).
 */

const createdOrgs: string[] = [];
let ownerEmail: string;
let ownerId: string;
let projectId: string;
let siteName: string;

test.beforeAll(async () => {
  const org = await createOrganization();
  createdOrgs.push(org.id);
  const owner = await createStaffUser(org.id, 'owner', 'owner');
  ownerEmail = owner.email;
  ownerId = owner.id;

  const project = await createProjectWithClientAndSite(org.id);
  projectId = project.id;
  siteName = project.siteRow.name;
});

test.afterAll(async () => {
  await cleanupOrganizations(createdOrgs);
  await closePool();
});

test('proyek selesai -> warranty register otomatis + galeri before-after; tiket servis jalan', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const NAV_TIMEOUT = { timeout: 30_000 };

  const context = await browser.newContext();
  try {
    await signInAs(context, ownerEmail);
    const page = await context.newPage();

    await test.step('catat dua item handover -- satu kunci, satu unit AC', async () => {
      await page.goto(`/cc/projects/${projectId}/handover`);
      await page.getByLabel('Jenis item *').fill('key');
      await page.getByLabel('Deskripsi').fill('Kunci pintu utama');
      await page.getByRole('button', { name: 'Tambah item handover' }).click();
      await expect(page.getByRole('cell', { name: 'key', exact: true })).toBeVisible(NAV_TIMEOUT);

      await page.getByLabel('Jenis item *').fill('ac_unit');
      await page.getByLabel('Deskripsi').fill('AC split 1 PK ruang tamu');
      await page.getByRole('button', { name: 'Tambah item handover' }).click();
      await expect(page.getByRole('cell', { name: 'ac_unit', exact: true })).toBeVisible(NAV_TIMEOUT);
    });

    await test.step('proyek ditandai selesai (belum ada UI Command Center untuk ini -- gap Fase 1, dicatat langsung)', async () => {
      await sql(`update projects set status = 'completed' where id = $1`, [projectId]);
    });

    await test.step('warranty register terbentuk otomatis: muncul untuk unit AC, tidak untuk kunci', async () => {
      await page.reload();
      await expect(page.getByText('Garansi -- ac_unit')).toBeVisible(NAV_TIMEOUT);
      await expect(page.getByText('Garansi -- key')).toHaveCount(0);
    });

    await test.step('warranty register benar-benar tercatat di database, bukan cuma di UI', async () => {
      const warranties = await sql<{ title: string }>(
        `select w.title from warranties w
         join handover_items hi on hi.id = w.handover_item_id
         where w.project_id = $1`,
        [projectId],
      );
      expect(warranties).toHaveLength(1);
      expect(warranties[0]!.title).toBe('Garansi -- ac_unit');
    });

    await test.step('galeri before-after: photos.handover_item_id + photo_stage benar-benar bisa dipakai (upload UI ada di SiteFlow, di luar cakupan fase ini)', async () => {
      const [handoverItem] = await sql<{ id: string }>(
        `select id from handover_items where project_id = $1 and item_type = 'ac_unit'`,
        [projectId],
      );
      // photos.zone_id is NOT NULL (ARCHITECTURE.md 7's own exit criteria for
      // Fase 4: "foto selalu terikat proyek+zona") -- createProjectWithClientAndSite
      // does not create one, so this step needs its own.
      const [zone] = await sql<{ id: string }>(
        `insert into zones (organization_id, project_id, name) select organization_id, id, 'Zona Uji' from projects where id = $1 returning id`,
        [projectId],
      );

      const rows = await sql<{ id: string }>(
        `insert into photos (organization_id, project_id, zone_id, storage_path, thumbnail_path, file_size_bytes, uploaded_by, handover_item_id, photo_stage)
         select organization_id, id, $2, 'before.jpg', 'before-thumb.jpg', 1000, $3, $4, 'before'
         from projects where id = $1
         returning id`,
        [projectId, zone!.id, ownerId, handoverItem!.id],
      );
      expect(rows).toHaveLength(1);

      const stages = await sql<{ photo_stage: string }>('select photo_stage from photos where id = $1', [
        rows[0]!.id,
      ]);
      expect(stages[0]!.photo_stage).toBe('before');

      await sql('delete from photos where id = $1', [rows[0]!.id]);
    });

    let assetId = '';

    await test.step('buat aset dan jadwal perawatan', async () => {
      await page.goto('/cc/assets/new');
      await page.getByLabel('Lokasi *').selectOption({ label: siteName });
      await page.getByLabel('Nama aset *').fill('AC Split 1PK');
      await page.getByRole('button', { name: 'Simpan aset' }).click();

      await expect(page).toHaveURL(/\/cc\/assets\/[0-9a-f-]+$/, NAV_TIMEOUT);
      assetId = page.url().split('/cc/assets/')[1]!.replace(/\/$/, '');
    });

    await test.step('tambah jadwal perawatan dan buat tiket servis', async () => {
      await page.getByLabel('Judul jadwal *').fill('Servis rutin AC');
      await page.getByLabel('Interval (hari) *').fill('90');
      await page.getByLabel('Mulai *').fill('2026-01-01');
      await page.getByRole('button', { name: 'Tambah jadwal perawatan' }).click();
      await expect(page.getByText('Servis rutin AC')).toBeVisible(NAV_TIMEOUT);

      await page.getByLabel('Judul tiket *').fill('AC tidak dingin');
      await page.getByLabel('Deskripsi').fill('Klien lapor AC tidak dingin sejak kemarin.');
      await page.getByRole('button', { name: 'Buat tiket servis' }).click();
      await expect(page.getByText('AC tidak dingin', { exact: true })).toBeVisible(NAV_TIMEOUT);
    });

    await test.step('tiket servis jalan: open -> in_progress -> resolved', async () => {
      await expect(page.getByRole('button', { name: 'Mulai dikerjakan' })).toBeVisible(NAV_TIMEOUT);
      await page.getByRole('button', { name: 'Mulai dikerjakan' }).click();

      await expect(page.getByRole('button', { name: 'Selesaikan' })).toBeVisible(NAV_TIMEOUT);
      await page.getByRole('button', { name: 'Selesaikan' }).click();

      await expect(page.getByText('Selesai', { exact: true })).toBeVisible(NAV_TIMEOUT);
    });

    await test.step('status tiket servis benar-benar tercatat di database', async () => {
      const rows = await sql<{ status: string; resolved_at: string | null }>(
        `select status, resolved_at from service_tickets where asset_id = $1`,
        [assetId],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]!.status).toBe('resolved');
      expect(rows[0]!.resolved_at).not.toBeNull();
    });
  } finally {
    await context.close();
  }
});
