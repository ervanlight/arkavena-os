-- Reference data. Runs in every environment, production included, so it must
-- stay idempotent: re-running it changes nothing (ARCHITECTURE.md 2.5).
--
-- ARCHITECTURE.md 2.5 also lists Cash Gate thresholds, issue categories and a
-- starter cost library for this file. None of them have tables yet -- they
-- arrive in Waves 2, 7 and 8. They will be appended here as their waves land.
-- Seeding ahead of the schema is the same mistake as building ahead of the
-- phase (CLAUDE.md law 7).
--
-- The Cash Gate thresholds specifically are not lost: they live as named
-- constants in core/money (11000 bp green, 10000 bp yellow floor) and will be
-- mirrored into fn_cash_gate_status() in Fase 2, which is where
-- ARCHITECTURE.md 2.2 puts them.

-- ---------------------------------------------------------------------------
-- The eleven roles (ARCHITECTURE.md 6.1).
--
-- Two axes. Organisation roles sit on users.org_role and describe internal
-- staff. Project roles sit on project_members (Wave 4) and describe anyone's
-- part in a specific project, internal or external.
--
-- name_id and description_id are Indonesian: this is the text the UI shows
-- (owner decision D10).
--
-- A db test asserts these keys match the org_role and project_role enums
-- exactly, in both directions -- so a role added to an enum but forgotten here,
-- or seeded here but missing from the enum, fails CI.
-- ---------------------------------------------------------------------------

insert into roles (key, scope, name_id, description_id) values
  ('owner',              'organization', 'Pemilik / CEO',
   'Akses penuh. Satu-satunya yang boleh melakukan override Cash Gate dan menyetujui invoice.'),

  ('technical_director', 'organization', 'Direktur Teknik',
   'Penanggung jawab mutu dan teknis. Satu-satunya yang boleh override hold point kualitas.'),

  ('finance',            'organization', 'Keuangan',
   'Mencatat penerimaan kas, menerbitkan invoice, dan menagih pembayaran.'),

  ('qs',                 'organization', 'QS / Estimator',
   'Menyusun estimasi biaya, meninjau variation, dan menjaga margin.'),

  ('procurement',        'organization', 'Pengadaan',
   'Mengelola vendor, permintaan penawaran, dan purchase order.'),

  ('site_coordinator',   'project',      'Koordinator Lapangan',
   'Membuat laporan harian, mencatat progres, dan mengunggah foto dari lokasi.'),

  ('mandor',             'project',      'Mandor',
   'Melaksanakan work package dan melaporkan progres pekerjaan hariannya.'),

  ('client_approver',    'project',      'Klien - Penyetuju',
   'Wakil klien yang berwenang menyetujui variation dan keputusan proyek.'),

  ('client_viewer',      'project',      'Klien - Peninjau',
   'Wakil klien yang hanya dapat melihat perkembangan proyek, tanpa hak menyetujui.'),

  ('supplier',           'project',      'Pemasok',
   'Menerima purchase order dan mencatat pengiriman material.'),

  ('subcontractor',      'project',      'Subkontraktor',
   'Mengerjakan lingkup pekerjaan tertentu di bawah kontrak utama.')
on conflict (key) do nothing;
