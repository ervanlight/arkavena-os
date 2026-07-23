# ARCHITECTURE.md — BuildTrust OS

> **Controlled Construction Delivery System**
> Dokumen ini adalah kontrak arsitektur. Semua sesi pengembangan (termasuk sesi Claude Code) WAJIB mengikuti dokumen ini. Perubahan arsitektur dicatat sebagai revisi dokumen ini, bukan diputuskan diam-diam di tengah coding.

**Status:** LOCKED — disetujui Owner (Ervan), 20 Juli 2026
**Versi:** 1.0
**Stack:** Next.js (App Router) + TypeScript + Tailwind CSS · Supabase (PostgreSQL, Auth, Storage) · PWA untuk SiteFlow · Claude API (server-side)

---

## 0. Prinsip Arsitektur (Non-Negotiable)

Lima prinsip ini diturunkan langsung dari lima risiko bisnis di dokumen rancangan (kas, scope, progres, mutu, dokumentasi):

1. **Money logic tidak boleh hidup di UI.** Cash Gate, Variation state machine, dan Quality Hold Point adalah pure functions yang bisa di-unit-test tanpa database dan tanpa browser.
2. **Database adalah benteng terakhir.** Aturan kritis (blokir PO saat Cash Gate merah, variation harus `approved_funded` sebelum dikerjakan) ditegakkan DUA lapis: di domain layer DAN di database (constraint/trigger/RLS). UI hanya lapis ketiga (kosmetik).
3. **Satu sumber kebenaran untuk types.** Schema database → generated types → domain types → UI. Tidak ada type yang ditulis tangan menduplikasi struktur tabel.
4. **Semua yang menyentuh uang, approval, dan override punya audit trail.** Bukan opsional, bukan per-fitur — satu mekanisme terpusat.
5. **Uang = integer Rupiah (BIGINT).** Tidak pernah float, tidak pernah `number` desimal untuk nominal. Semua kalkulasi margin/coverage pakai integer + fungsi pembagi eksplisit.

---

## 1. FOLDER STRUCTURE

### 1.1 Struktur

```text
buildtrust-os/
├── ARCHITECTURE.md
├── CLAUDE.md
├── docs/
│   ├── rls-matrix.md              # Matriks RLS per tabel per role (Bab 2.4)
│   ├── error-codes.md             # Katalog error code (Bab 5)
│   ├── decisions/                 # ADR: Architecture Decision Records
│   │   ├── 0001-domain-modules.md
│   │   ├── 0002-money-as-bigint.md
│   │   └── ...
│   └── runbooks/                  # Cara debug/recover masalah umum
├── supabase/
│   ├── migrations/                # SQL migrations, timestamped, append-only
│   ├── seed/
│   │   ├── 01_reference.sql       # roles, enums lookup, cost library dasar
│   │   ├── 02_demo_org.sql        # organisasi + user demo
│   │   └── 03_demo_project.sql    # 1 proyek lengkap utk demo penjualan
│   └── tests/                     # pgTAP / SQL tests untuk RLS & trigger
├── src/
│   ├── app/                       # Next.js App Router — ROUTING SAJA, tipis
│   │   ├── (command-center)/      # /cc/*      — Owner, TD, Finance, QS, dst
│   │   ├── (siteflow)/            # /site/*    — Site coordinator, mandor (PWA)
│   │   ├── (client-portal)/       # /portal/*  — Client approver & viewer
│   │   ├── (partner-desk)/        # /partner/* — Supplier, subcontractor
│   │   ├── api/                   # Route handlers (webhook, AI, upload)
│   │   └── layout.tsx
│   ├── core/                      # SHARED KERNEL — tidak tahu domain apa pun
│   │   ├── db/
│   │   │   ├── database.types.ts  # GENERATED — jangan diedit manual
│   │   │   ├── enums.ts           # Konstanta enum (mirror Postgres enums)
│   │   │   ├── client.server.ts   # Supabase server client (RLS aktif)
│   │   │   ├── client.browser.ts  # Supabase browser client
│   │   │   └── admin.server.ts    # Service-role client (HANYA utk job sistem)
│   │   ├── auth/                  # Session, current user, org context
│   │   ├── permissions/
│   │   │   ├── matrix.ts          # SATU-SATUNYA definisi role × resource × action
│   │   │   ├── guard.ts           # requirePermission() utk server actions
│   │   │   └── use-can.ts         # Hook UI: can('invoice','create')
│   │   ├── audit/
│   │   │   ├── audit.ts           # recordAudit(), withAudit() wrapper
│   │   │   └── types.ts
│   │   ├── errors/
│   │   │   ├── app-error.ts       # Hierarki error + Result<T,E>
│   │   │   ├── handle.ts          # Konversi error → ActionResult
│   │   │   └── codes.ts           # Error code constants
│   │   ├── money/
│   │   │   └── rupiah.ts          # Tipe Rupiah (bigint), format, aritmetika
│   │   ├── storage/               # Upload foto: kompresi, path, signed URL
│   │   ├── notifications/         # Email + in-app + share-WA link
│   │   └── ui/                    # Design system: Button, Card, StatusBadge, dst
│   ├── modules/                   # DOMAIN MODULES — jantung aplikasi
│   │   ├── projects/              # OWNER dari: projects, zones, work_packages,
│   │   │   │                      #   project_members, contracts, milestones
│   │   │   ├── domain/            # Pure logic (tanpa import supabase/react)
│   │   │   ├── data/              # Repository: semua query tabel milik modul ini
│   │   │   ├── actions/           # Server actions (validasi → guard → domain → data → audit)
│   │   │   ├── components/        # UI khusus modul ini
│   │   │   ├── schemas.ts         # Zod schemas input
│   │   │   ├── types.ts           # Domain types (derive dari database.types)
│   │   │   └── index.ts           # PUBLIC API modul — satu-satunya pintu impor
│   │   ├── cash-gate/             # funding_receipts, cash_forecasts + FCR engine
│   │   ├── scope-variation/       # change_orders + ScopeLock state machine
│   │   ├── field-reporting/       # daily_logs, progress_entries, photos,
│   │   │                          #   material_requests, issues (SiteFlow backend)
│   │   ├── quality-gate/          # inspections, nonconformities, hold points
│   │   ├── client-portal/         # client_decisions, tampilan klien (baca lintas modul
│   │   │                          #   via public API modul lain — tidak punya banyak tabel sendiri)
│   │   ├── billing/               # invoices, payments, billing pack, collection
│   │   ├── crm/                   # leads, clients, client_users, sites
│   │   ├── assessment/            # assessments + report generator
│   │   ├── estimating/            # cost_library, estimates, estimate_items, proposals
│   │   ├── procurement/           # vendors, vendor_quotes, purchase_orders, deliveries
│   │   ├── maintenance-engine/    # assets, maintenance_plans, service_tickets,
│   │   │                          #   warranties, handover_items (Facility Passport)
│   │   └── ai-scribe/             # Claude API calls, prompt templates, draft outputs
│   └── lib/                       # Util generik (date, slug, dsb) — tanpa domain
├── e2e/                           # Playwright: alur kritis end-to-end
└── package.json
```

### 1.2 Aturan Dependensi (ditegakkan ESLint `import/no-restricted-paths` atau `eslint-plugin-boundaries`)

```text
app/        → boleh impor: modules/*/index.ts, core
modules/X   → boleh impor: core, modules/Y/index.ts (public API saja)
modules/X/domain → boleh impor: core/money, core/errors, lib SAJA
                   (DILARANG: supabase, react, next, modules lain)
core        → boleh impor: lib SAJA (tidak boleh impor modules)
```

**Ownership tabel bersifat eksklusif.** Setiap tabel dimiliki tepat satu modul; modul lain mengaksesnya lewat fungsi di `index.ts` modul pemilik, bukan query langsung. Contoh: `cash-gate` butuh data milestone → panggil `projects.getMilestoneFunding(projectId)`, bukan `supabase.from('milestones')` sendiri.

### 1.3 Kenapa struktur ini, dan trade-off-nya

**Kenapa domain-module, bukan layer teknis (components/utils/pages):**

1. **Debugging terlokalisasi.** Bug Cash Gate → semua kode relevan (logic, query, UI, types) di satu folder. Di struktur layer, satu bug menyebar ke 5 folder.
2. **Logic kritis bisa diisolasi & di-test.** Folder `domain/` yang dilarang impor infrastruktur adalah syarat teknis agar Cash Gate/Variation/Hold Point bisa di-unit-test murni (Bab 4).
3. **Sesuai urutan bisnis.** Urutan build di dokumen (Cash Gate → Scope → Field → Quality → Portal → Billing → Maintenance → AI) memetakan 1:1 ke folder. Progress terlihat, tidak ada "semua setengah jadi".
4. **Ramah AI-assisted development.** Claude Code bekerja jauh lebih konsisten kalau konteks satu fitur muat dalam satu folder, dengan `index.ts` sebagai kontrak yang jelas.
5. **Siap dipecah nanti.** Kalau suatu saat `maintenance-engine` mau jadi produk terpisah, batasnya sudah ada.

**Trade-off yang diterima secara sadar:**

| Trade-off | Mitigasi |
| --- | --- |
| Butuh disiplin — tanpa penegakan, orang menyeberang batas modul | ESLint boundaries di CI, PR gagal kalau melanggar |
| Entitas lintas modul (work_packages disentuh cash-gate, quality-gate, billing) bisa jadi rebutan | Aturan ownership eksklusif + public API (1.2). Modul lain hanya boleh *membaca* atau memanggil fungsi mutasi milik owner |
| Sedikit lebih banyak boilerplate (index.ts, repository per modul) | Diterima; harganya jauh lebih murah daripada bongkar ulang |
| Kode shared UI berisiko diduplikasi antarmodul | Komponen generik naik ke `core/ui`; aturan: kalau dipakai ≥2 modul dan tidak berisi logic domain → pindah ke core |

---

## 2. DATABASE & MIGRATION STRATEGY

### 2.1 Urutan migration (dependency chain)

Catatan: daftar di dokumen rancangan sebenarnya berisi **42 tabel** (bukan 32). Semua diurutkan di sini. Setiap "wave" = satu atau beberapa file migration; wave N boleh mereferensi FK ke wave ≤ N saja.

```text
WAVE 0 — Fondasi (bukan tabel)
  extensions (pgcrypto, pg_trgm), semua ENUM types,
  fn_set_updated_at(), fn_audit_row_change(), fn_current_org_id(),
  fn_has_project_role(project_id uuid, roles text[])

WAVE 1 — Identitas & kernel
  organizations
  roles                          (referensi statis 11 role)
  users                          (profil; auth.users milik Supabase)
  audit_logs                     (dibuat awal agar SEMUA wave berikutnya ter-audit)
  notifications

WAVE 2 — Master data
  clients            → organizations
  client_users       → clients, users
  vendors            → organizations
  cost_library       → organizations

WAVE 3 — Pra-proyek
  leads              → organizations, clients?
  sites              → clients

WAVE 4 — Proyek inti
  assessments        → leads/sites, users
  projects           → organizations, clients, sites
  project_members    → projects, users, roles

WAVE 5 — Struktur proyek
  zones              → projects
  contracts          → projects
  estimates          → projects, assessments?

WAVE 6 — Turunan kontrak & estimasi
  milestones         → contracts
  estimate_items     → estimates, cost_library, zones?
  proposals          → projects, estimates
  work_packages      → projects, zones, milestones?

WAVE 7 — Kas, perubahan, harian
  funding_receipts   → projects, milestones
  cash_forecasts     → projects, work_packages
  change_orders      → projects, zones?, work_packages?
  daily_logs         → projects, users
  vendor_quotes      → vendors, projects
  material_requests  → projects, work_packages, zones?

WAVE 8 — Eksekusi & kontrol
  purchase_orders    → projects, vendors, vendor_quotes?, material_requests?
  progress_entries   → work_packages, daily_logs
  photos             → projects, zones, work_packages?, daily_logs?, inspections?†
  issues             → projects, zones?, work_packages?
  client_decisions   → projects, zones?, change_orders?
  inspections        → work_packages, zones
  nonconformities    → inspections
  invoices           → projects, milestones, change_orders?

  † FK photos→inspections dibuat sebagai migration ALTER terpisah
    setelah inspections ada (atau photos dipindah ke akhir wave 8).

WAVE 9 — Penyelesaian
  deliveries         → purchase_orders
  payments           → invoices
  handover_items     → projects, zones
  warranties         → projects, handover_items?
  assets             → sites, clients (Facility Passport)

WAVE 10 — Recurring
  maintenance_plans  → assets, clients
  service_tickets    → assets, warranties?, clients
```

**Aturan migration:**

- Satu perubahan = satu file: `YYYYMMDDHHMMSS_deskripsi_singkat.sql`. Append-only — migration yang sudah applied **tidak pernah diedit**, kesalahan diperbaiki lewat migration baru.
- Setiap tabel dibuat lengkap dalam satu paket: kolom + PK + FK + index + trigger `updated_at` + trigger audit + `ENABLE ROW LEVEL SECURITY` + policy — di file yang sama. **Tabel tanpa RLS tidak boleh masuk main branch** (dicek oleh SQL test di CI: query `pg_tables` vs `pg_policies`).
- FK selalu eksplisit `ON DELETE`: default `RESTRICT` (data konstruksi jarang boleh cascade); `CASCADE` hanya untuk child murni (mis. `estimate_items` ikut `estimates`).
- Perubahan skema destruktif (drop kolom/tabel) wajib lewat pola *expand → migrate data → contract* dalam 3 migration terpisah.

### 2.2 Konvensi penamaan

| Objek | Konvensi | Contoh |
| --- | --- | --- |
| Tabel | `snake_case`, jamak | `work_packages` |
| PK | `id UUID DEFAULT gen_random_uuid()` | — |
| FK kolom | `<singular>_id` | `project_id`, `approved_by` (→ users) |
| Timestamps | `created_at`, `updated_at` (`timestamptz`, trigger), soft-delete `deleted_at` | — |
| Uang | `*_amount BIGINT` — Rupiah utuh, tanpa desimal | `contract_amount` |
| Persen/rasio | `*_bps INTEGER` (basis points; 1,10 = 11000... **tidak** — lihat catatan) | `coverage_ratio_bp` |
| Status | Postgres `ENUM` bernama `<table>_status` | `change_order_status` |
| Boolean | prefix `is_`/`has_` | `is_funded` |
| Index | `idx_<table>_<kolom...>` | `idx_photos_project_id_zone_id` |
| Unique | `uq_<table>_<kolom...>` | `uq_project_members_project_id_user_id` |
| FK constraint | `fk_<table>_<ref>` | `fk_invoices_milestone` |
| Check | `ck_<table>_<aturan>` | `ck_invoices_amount_positive` |
| Trigger | `trg_<table>_<aksi>` | `trg_invoices_audit` |
| Function | `fn_<verba>` | `fn_has_project_role` |
| RLS policy | `<table>_<aksi>_<role_group>` | `invoices_select_finance` |

Catatan rasio: Funding Coverage Ratio disimpan/dihitung sebagai **basis points integer** (`11000` = 1,1000) agar bebas float. Semua threshold (`11000`, `10000`) jadi konstanta di `core/money` dan di-mirror sebagai SQL constant di `fn_cash_gate_status()`.

### 2.3 Enum vs lookup table

- **Postgres ENUM** untuk state machine yang dikontrol kode (status change order, status work package, status Cash Gate) — karena transisinya divalidasi domain layer dan penambahan nilai adalah keputusan arsitektur.
- **Lookup table** untuk hal yang mungkin ditambah lewat UI oleh admin (kategori issue, jenis aset) — supaya tidak butuh migration untuk menambah nilai.

### 2.4 RLS: didokumentasikan sebagai artefak hidup, bukan tulisan sekali pakai

Tiga lapis, semuanya di-commit ke repo:

1. **Sumber kebenaran eksekusi:** policy SQL di file migration (co-located dengan tabelnya).
2. **Dokumentasi audit-friendly:** `docs/rls-matrix.md` — tabel matriks `tabel × role → SELECT/INSERT/UPDATE/DELETE + syarat` yang WAJIB di-update di PR yang sama dengan perubahan policy. Contoh baris:

   | Tabel | Owner | Finance | Site Coord | Client Approver | Supplier |
   | --- | --- | --- | --- | --- | --- |
   | invoices | CRUD (org) | CRUD (org) | — | SELECT (proyeknya, tanpa kolom margin*) | — |

   *Kolom sensitif (margin, harga beli) tidak diekspos lewat kolom di tabel yang sama dengan data klien — lihat 2.6.

3. **Bukti otomatis:** `supabase/tests/` berisi test yang login sebagai tiap role dummy lalu meng-assert matriks di atas (contoh assertion: "client Proyek A tidak bisa SELECT baris Proyek B", "site coordinator tidak bisa INSERT invoices"). CI menjalankan test ini terhadap Supabase lokal. **Kalau matrix.md dan test tidak sinkron dengan policy, CI merah.** Inilah yang membuat RLS "gampang di-audit nanti": auditnya berjalan otomatis setiap commit.

Pola policy standar (agar seragam & mudah dibaca):

```text
-- semua policy proyek memakai satu fungsi helper:
USING ( fn_has_project_role(project_id, ARRAY['owner','finance']) )
-- data org-level:
USING ( organization_id = fn_current_org_id() )
```

### 2.5 Seed data

- `01_reference.sql` — 11 roles, konfigurasi threshold Cash Gate, kategori issue, cost library dasar. Idempotent (`ON CONFLICT DO NOTHING`). Dijalankan di semua environment termasuk production.
- `02_demo_org.sql` + `03_demo_project.sql` — organisasi demo + **satu proyek rumah lengkap** (zona, work packages, foto placeholder, 1 variation di tiap status, 1 Cash Gate merah, 1 hijau, inspeksi lulus & menunggu). Dev/staging only. Ini sekaligus jadi **demo penjualan** yang disebut di dokumen rancangan (Bab 15 rancangan aplikasi) — satu investasi, dua kegunaan.
- Factory functions TypeScript di `supabase/tests/factories.ts` untuk data test terprogram (unit/integration test tidak bergantung pada seed demo).
- Aturan: test tidak boleh bergantung pada urutan test lain; setiap suite membangun datanya sendiri via factory dalam transaksi/schema terpisah.

### 2.6 Pemisahan data sensitif (margin tidak bocor ke klien)

Kolom internal (harga beli, upah, markup, margin, internal notes) **tidak diletakkan di tabel yang dibaca portal klien**. Pola:

- `estimates` / `estimate_items` (internal, RLS: staf saja) terpisah dari `contracts` / `milestones` (nilai kontrak, boleh dilihat klien).
- Portal klien membaca lewat **database views** khusus (`vw_client_project_overview`, dll) yang secara eksplisit hanya memuat kolom halal-klien. Klien tidak pernah diberi akses tabel mentah internal. Ini membuat "apa yang klien bisa lihat" bisa diaudit dari satu tempat: daftar view + RLS-nya.

---

## 3. SHARED TYPES & CONTRACT

Rantai type satu arah — **schema DB adalah hulu, bukan hilir:**

```text
Postgres schema (migrations)
      │  supabase gen types typescript  (script: pnpm db:types, jalan di CI)
      ▼
core/db/database.types.ts        ← GENERATED, dilarang edit manual
      │  derive
      ▼
modules/X/types.ts               ← domain types per modul
      │
      ├── modules/X/schemas.ts   ← Zod schema INPUT (form/action), infer type dari sini
      ▼
components & app                 ← hanya impor dari modules/X (index.ts)
```

**Aturan:**

1. **Row types selalu derive, tidak pernah ditulis ulang:**
   ```ts
   // modules/billing/types.ts
   import type { Tables, TablesInsert, Enums } from '@/core/db/database.types';
   export type Invoice = Tables<'invoices'>;
   export type NewInvoice = TablesInsert<'invoices'>;
   export type InvoiceStatus = Enums<'invoice_status'>;
   ```
   Kalau butuh bentuk berbeda (join, subset), definisikan sebagai `Pick`/`Omit`/composed type dari row type — sehingga rename kolom di DB langsung jadi compile error di semua pemakainya. Bug "field beda nama frontend vs backend" mati di compile time, bukan di runtime.

2. **Enum satu sumber.** Nilai enum didefinisikan di Postgres; `core/db/enums.ts` mengekspor konstanta yang diturunkan dari generated types (`satisfies` check) supaya string literal di kode tidak bisa menyimpang dari DB.

3. **Zod di tepi, bukan di tengah.** Validasi Zod hanya di boundary (input server action, payload API, response AI). Di dalam domain layer, data sudah bertipe kuat — tidak ada re-validasi berulang.

4. **Kontrak server action seragam.** Semua server action mengembalikan satu bentuk:
   ```ts
   type ActionResult<T> =
     | { ok: true; data: T }
     | { ok: false; error: { code: ErrorCode; message: string; field?: string } };
   ```
   UI cukup punya satu handler pola ini (toast/inline error), tidak ada parsing error ad-hoc.

5. **CI gate:** `pnpm db:types` dijalankan di CI; kalau hasil generate berbeda dengan yang ter-commit → build gagal. Ini menjamin types tidak pernah basi terhadap schema.

6. **Tipe uang branded:** `core/money/rupiah.ts` mengekspor `type Rupiah = bigint & { __brand: 'Rupiah' }` + `addRp/subRp/ratioBp/formatRp`. Operasi aritmetika langsung `a + b` pada nominal dilarang lint di luar modul money.

---

## 4. BUSINESS LOGIC ISOLATION

### 4.1 Pola umum: Functional Core, Imperative Shell

Tiga logic kritis (Cash Gate, ScopeLock/Variation, Quality Hold Point) hidup di `modules/<x>/domain/` sebagai **pure functions**: input plain data → output keputusan. Tanpa I/O, tanpa `Date.now()` tersembunyi (waktu selalu jadi parameter), tanpa import supabase/react/next (ditegakkan ESLint).

Alur setiap server action yang menyentuh logic kritis:

```text
actions/approve-variation.ts
  1. parse input (Zod)
  2. requirePermission(user, 'change_order', 'approve')      ← core/permissions
  3. load state via data/ (repository)
  4. decision = domain.transition(state, event)              ← PURE, bisa di-unit-test
  5. if decision.ok → data/ menulis DALAM SATU TRANSAKSI
  6. withAudit(...) mencatat perubahan + reason               ← core/audit
  7. return ActionResult
```

Lapis kedua: keputusan yang sama ditegakkan di DB (trigger/constraint), sehingga bug di shell tidak bisa menembus aturan uang.

### 4.2 Cash Gate (`modules/cash-gate/domain/`)

```ts
// funding-coverage.ts — contoh signature, bukan implementasi
export function computeFundingCoverage(input: {
  clearedFunds: Rupiah;          // kas klien cleared & teralokasi ke proyek
  committedCosts: Rupiah;        // PO & komitmen belum dibayar
  next14DayNeeds: Rupiah;        // dari cash_forecasts
  riskReserve: Rupiah;
}): { ratioBp: number; status: 'green' | 'yellow' | 'red' };

export function evaluateGateAction(input: {
  gate: GateState;               // status + overdue info
  action: 'issue_po' | 'open_work_package' | 'mobilize_sub' | 'start_variation' | 'order_material';
  override?: { byUserId: string; reason: string };
}): Result<Allowed, GateBlocked>;
```

Aturan tegas:
- Threshold (`≥11000` hijau, `10000–10999` kuning, `<10000` merah, overdue = suspend) adalah konstanta bernama, dites eksplisit.
- Override hanya valid dengan `reason` non-kosong dan role Owner; hasil override SELALU memicu audit entry — ini dites, bukan diasumsikan.
- Enforcement DB: trigger `BEFORE INSERT` pada `purchase_orders` dan `BEFORE UPDATE status→in_progress` pada `work_packages` memanggil `fn_cash_gate_status(project_id)`; kalau merah dan tidak ada override record → `RAISE EXCEPTION`.

### 4.3 ScopeLock / Variation state machine (`modules/scope-variation/domain/`)

State machine dideklarasikan sebagai **data**, bukan if-else tersebar:

```ts
const TRANSITIONS: Record<ChangeOrderStatus, Partial<Record<ChangeOrderEvent, ChangeOrderStatus>>> = {
  draft:                  { submit_review: 'under_review' },
  under_review:           { send_to_client: 'awaiting_client_approval', reject: 'rejected' },
  awaiting_client_approval:{ client_approve: 'approved_unpaid', client_reject: 'rejected' },
  approved_unpaid:        { funding_received: 'approved_funded' },
  approved_funded:        { complete: 'completed' },
  rejected: {}, completed: {},
};
export function transition(current, event, ctx): Result<NextState, InvalidTransition>;
```

- Guard tambahan di `client_approve`: harus ada dampak biaya + dampak jadwal terisi, dan approver adalah `client_approver` proyek tsb.
- Work package variation hanya bisa dibuat/di-assign kalau status = `approved_funded` — ditegakkan di domain DAN di FK+check constraint (`change_orders.status = 'approved_funded'` via trigger).
- Setiap transisi = satu audit entry dengan `previous_value`/`new_value` status.

### 4.4 Quality Hold Point (`modules/quality-gate/domain/`)

```ts
export function canProceed(input: {
  workPackage: WorkPackageState;
  holdPoints: HoldPointState[];     // tiap hold point: required?, passed?, overridden?
  cashGate: CashGateStatus;
}): Result<Proceed, Blocked>;       // Blocked memuat DAFTAR alasan, bukan cuma boolean
```

- Hold point template per jenis pekerjaan (waterproofing, plumbing, struktur) = data di DB, bukan hardcode — supaya nambah jenis pekerjaan tidak ubah kode.
- Override teknis hanya oleh Technical Director + reason + audit.
- Output `Blocked` selalu berisi alasan terstruktur → langsung dipakai UI ("Tidak bisa lanjut: flood test belum disetujui").

### 4.5 Testing minimum WAJIB sebelum tiga logic ini dianggap "selesai"

| Lapis | Tool | Wajib mencakup |
| --- | --- | --- |
| Unit (domain) | Vitest | **Cash Gate:** nilai batas persis 11000/10999/10000/9999; pembagian nol (kebutuhan 14 hari = 0); overdue menimpa status hijau; override tanpa reason → error; semua nominal bigint (test dengan angka > 2^53 rupiah untuk membuktikan tak ada float). **Variation:** SEMUA transisi legal + tabel lengkap transisi ilegal (loop semua status × semua event, assert yang tidak ada di map → error); guard approver salah role; funded tanpa funding_receipt → error. **Hold point:** kombinasi lulus/belum/override; blocked reasons lengkap; cash gate merah tetap memblokir walau semua QC lulus. |
| Integration (DB) | Vitest + Supabase lokal (atau pgTAP) | Trigger DB benar-benar menolak: INSERT PO saat gate merah; UPDATE work_package → in_progress saat hold point belum lulus; work package variation saat status ≠ approved_funded. RLS test sesuai matriks 2.4. Audit row muncul untuk tiap mutasi + override. |
| E2E (alur kritis) | Playwright | 3 skenario saja dulu: (1) termin dibayar → gate hijau → PO bisa terbit; (2) klien approve variation → bayar → work package variation muncul di SiteFlow; (3) inspeksi gagal → pekerjaan penutup terkunci → override TD → terbuka + audit terlihat. |

**Definition of Done untuk modul kritis:** unit coverage domain ≥ 90% *branch* (bukan sekadar line), integration test hijau, mutasi tanpa audit entry = test gagal. Tanpa ini, modul tidak boleh disebut selesai walaupun UI-nya jalan.

---

## 5. ERROR HANDLING & AUDIT LOG CONVENTION

### 5.1 Error handling — satu pola untuk seluruh app

Hierarki di `core/errors/app-error.ts`:

```text
AppError (abstract: code, message, httpStatus, meta)
├── ValidationError      (input tidak valid — dari Zod)
├── PermissionError      (role/RLS menolak)
├── DomainRuleError      (aturan bisnis: CASH_GATE_RED, INVALID_TRANSITION, HOLD_POINT_PENDING)
├── NotFoundError
├── ConflictError        (versi data berubah — optimistic locking)
└── InfraError           (Supabase/Claude API/storage gagal)
```

Aturan:

1. **Domain layer tidak melempar exception untuk aturan bisnis** — ia mengembalikan `Result<T, DomainRuleError>`. Exception hanya untuk hal yang benar-benar exceptional (infra).
2. **Server actions dibungkus satu wrapper** `safeAction(schema, guard, handler)` yang: parse Zod → cek permission → jalankan → tangkap semua error → petakan ke `ActionResult` (kontrak Bab 3.4). Tidak ada try/catch ad-hoc di tiap action.
3. **Error code katalog** di `core/errors/codes.ts` + `docs/error-codes.md` — kode stabil (`CASH_GATE_RED`, `VARIATION_INVALID_TRANSITION`, …) yang dipakai UI untuk pesan Bahasa Indonesia dan dipakai log untuk agregasi. Menambah error = menambah code, bukan menulis string bebas.
4. **Pesan ke user vs pesan ke log dipisah.** User melihat pesan Indonesia yang aman ("Pembayaran termin belum diterima, pekerjaan tahap ini belum bisa dimulai"); log menyimpan detail teknis + context (`org_id, project_id, user_id, request_id`). `InfraError` tidak pernah membocorkan detail internal ke klien portal.
5. **Logging terstruktur** (JSON) via satu logger di `core`; setiap request server action membawa `request_id` yang ikut ke audit log → satu insiden bisa ditelusuri dari toast UI sampai baris DB.

### 5.2 Audit log — satu mekanisme, dua kanal

Tabel tunggal `audit_logs`:

```text
id, occurred_at, actor_user_id, organization_id, project_id?,
entity_table, entity_id, action,            -- 'insert' | 'update' | 'status_change' | 'override' | ...
previous_value JSONB, new_value JSONB,      -- hanya kolom yang berubah (diff), bukan seluruh row
reason TEXT,                                -- WAJIB utk override & approval
request_id, source                          -- 'app' | 'trigger' | 'system'
```

**Kanal 1 — Trigger DB generik (jaring pengaman):** satu fungsi `fn_audit_row_change()` dipasang sebagai trigger di semua tabel bernilai audit (daftar tabel = konfigurasi migration, bukan copy-paste fungsi). Menangkap diff OLD vs NEW otomatis. Menjamin *tidak ada jalur mutasi yang lolos audit*, termasuk hotfix SQL manual.

**Kanal 2 — Application audit (konteks bisnis):** `withAudit()` di server action menambahkan hal yang trigger tidak tahu: `reason`, `request_id`, actor sebenarnya, semantik aksi (`'override_cash_gate'` alih-alih sekadar `'update'`). Wrapper ini yang **memaksa** `reason` untuk aksi kategori override/approval — kompilasi gagal kalau action ditandai `requiresReason: true` tapi reason tidak diberikan.

Aturan keras:
- `audit_logs` append-only: tidak ada policy UPDATE/DELETE untuk siapa pun (termasuk service role di kode aplikasi).
- Dilarang menulis `insert into audit_logs` manual di modul — hanya via `core/audit`.
- UI riwayat ("siapa mengubah apa") dibangun SEKALI sebagai komponen `<AuditTrail entityTable entityId />` di `core/ui`, dipakai semua modul.

---

## 6. ROLE & PERMISSION IMPLEMENTATION

### 6.1 Model

Dua sumbu, jangan dicampur:

- **Role organisasi** (staf internal): Owner/CEO, Technical Director, Finance, QS/Estimator, Procurement — disimpan di `users` (kolom `org_role`) → masuk **JWT custom claims** saat login (murah dicek di RLS tanpa join).
- **Role per proyek** (semua orang, termasuk eksternal): Site Coordinator, Mandor, Client Approver, Client Viewer, Supplier, Subcontractor — disimpan di `project_members (project_id, user_id, role)`. Staf internal juga bisa punya role proyek spesifik.

### 6.2 Satu sumber kebenaran: permission matrix sebagai data

`core/permissions/matrix.ts`:

```ts
export const PERMISSIONS = {
  invoice:      { create: ['owner','finance'], approve: ['owner'], view: ['owner','finance','qs','client_approver','client_viewer'] },
  change_order: { client_approve: ['client_approver'], review: ['owner','technical_director','qs'], ... },
  cash_gate:    { override: ['owner'] },
  hold_point:   { override: ['technical_director'] },
  ...
} as const satisfies PermissionMatrix;
```

Matrix ini dikonsumsi oleh **tiga penegak**, sehingga menambah role/permission = ubah satu file (+ satu migration kecil):

1. **RLS (penegak sesungguhnya):** semua policy proyek memanggil `fn_has_project_role(project_id, ARRAY[...])` dan `fn_current_org_role() = ANY(...)`. Daftar role di policy di-generate/diverifikasi dari matrix oleh script `pnpm gen:rls-check` (membandingkan matrix.ts ↔ pg_policies; selisih → CI merah). Jadi matrix.ts dan policy tidak bisa saling menyimpang tanpa ketahuan.
2. **Server guard:** `requirePermission(ctx, 'invoice', 'create')` di setiap `safeAction`. Ini lapisan pesan-error-yang-ramah; RLS tetap jaring terakhir.
3. **UI:** hook `can('invoice','create')` untuk menyembunyikan tombol. Murni kosmetik — tidak pernah dianggap keamanan.

### 6.3 Aturan untuk role eksternal

- Client/Supplier/Subcontractor **tidak pernah** mendapat akses tabel internal; mereka membaca lewat views khusus (Bab 2.6) yang policy-nya hanya mengizinkan `project_id` tempat mereka jadi member.
- `client_users` memetakan user ↔ client; policy portal: `EXISTS (project_members …)` — klien Proyek A secara struktural tidak bisa menyentuh Proyek B.
- Partner Desk (wave terakhir) memakai mekanisme yang sama — tidak ada sistem permission kedua.

### 6.4 Menambah role baru (contoh: "Account Manager B2B" di fase ekspansi)

1. Migration: tambah nilai enum role + baris di `roles`.
2. Tambahkan role di `matrix.ts` pada resource yang relevan.
3. Jalankan `pnpm gen:rls-check` → daftar policy yang perlu update ter-flag otomatis.
4. Tambah satu user dummy role tsb di test factories → RLS test suite otomatis mencakupnya.

Empat langkah, semua terdeteksi CI. Tidak ada "cari-cari if(role===…) di 40 file".

---

## 7. BUILD SEQUENCE INTERNAL

Semua modul memang akan dibangun, tapi urutannya mengikuti dependensi teknis + prinsip dokumen rancangan (*Cash Gate → Scope/Variation → Field → Quality → Portal → Billing → Maintenance → AI*). Setiap fase punya **exit criteria** dan **CHECKPOINT** = Anda review sebelum fase berikutnya dibangun di atasnya.

```text
FASE 0 — Scaffold & Kernel                                   [~fondasi segalanya]
  Repo, CI (lint boundaries, typecheck, db:types diff, test),
  Supabase lokal, migrations Wave 0–1, core/: errors, money,
  audit, permissions (matrix + guard), auth + login, seed reference.
  Exit: user login, org context jalan, audit trigger terbukti mencatat,
        RLS test harness jalan, satu unit test money lolos bigint.
  ── CHECKPOINT #1 (review Anda): struktur folder nyata, CI hijau,
     konvensi terasa — INI titik termurah untuk koreksi arah. ──

FASE 1 — Core Proyek                                          [modules: crm(dasar), projects]
  Wave 2–6: clients, projects, project_members, zones, contracts,
  milestones, work_packages. CRUD Command Center dasar. ZoneMap v1
  (denah statis per zona, belum interaktif penuh).
  Exit: proyek demo bisa dibuat end-to-end via UI; RLS matrix
        terisi utk semua tabel fase ini; role proyek berfungsi.

FASE 2 — Cash Gate                                            [modules: cash-gate]
  Wave 7 (funding_receipts, cash_forecasts). Domain engine + trigger
  DB blocking + dashboard owner (hijau/kuning/merah/overdue) + override flow.
  Exit: SELURUH test Bab 4.5 kolom Cash Gate hijau; demo: gate merah
        memblokir PO di UI dan di SQL langsung.
  ── CHECKPOINT #2 (review Anda + rekan teknis): validasi rumus FCR,
     threshold, dan perilaku blokir terhadap realitas operasi. Logic
     uang di-freeze setelah ini. ──

FASE 3 — Scope & Variation                                    [modules: scope-variation]
  change_orders + state machine + client approval flow (link aman,
  belum perlu portal penuh) + keterkaitan ke work_packages & Cash Gate.
  Exit: test transisi lengkap hijau; variation hanya tampil di daftar
        kerja setelah approved_funded (dibuktikan integration test).

FASE 4 — Field Reporting / SiteFlow                            [modules: field-reporting]
  daily_logs, progress_entries, photos, material_requests, issues.
  PWA: 6 tombol besar, offline outbox (input tersimpan lokal, sync saat online),
  pipeline foto (kompresi client-side → storage path per proyek/zona/tanggal).
  Exit: site coordinator membuat laporan harian < 3 menit di HP;
        foto selalu terikat proyek+zona; offline queue teruji (airplane mode).
  ── CHECKPOINT #3 (uji lapangan): dipakai di proyek nyata/simulasi
     oleh mandor sungguhan. Feedback UX lapangan sebelum lanjut. ──

FASE 5 — Quality Gate                                          [modules: quality-gate]
  inspections, nonconformities, hold point templates, blocking ke
  work_packages, override TD.
  Exit: test Bab 4.5 kolom Hold Point hijau; skenario waterproofing
        end-to-end (foto sebelum ditutup → approval → lanjut).

FASE 6 — Client Trust Portal v1 (read-only dulu)               [modules: client-portal]
  Views klien (2.6), Overview, ZoneMap klien, timeline, progress evidence,
  Decisions (client_decisions + Decision Clock), approval variation pindah
  ke portal. Weekly report otomatis (halaman privat/PDF — sesuai roadmap hemat).
  Exit: klien demo hanya melihat yang halal (dibuktikan RLS test);
        weekly report tergenerate dari data nyata tanpa tulis ulang.
  ── CHECKPOINT #4 (review Anda): INI wajah perusahaan ke klien.
     Review konten, bahasa, dan apa yang TIDAK tampil. ──

FASE 7 — Billing & Collection                                  [modules: billing]
  invoices, payments, billing pack (invoice + evidence + QC + variation
  summary), aging dashboard, hubungan otomatis overdue → Cash Gate.
  Exit: invoice hanya bisa terbit saat syarat (milestone + QC + variation
        approved + persetujuan TD) terpenuhi — integration test.

FASE 8 — CRM penuh, Assessment, Estimating, Procurement        [modules: crm, assessment,
  leads + lead scoring + pipeline; assessment report;             estimating, procurement]
  cost library, estimates versi (V1/V2/V3/baseline), margin warning;
  RFQ → quote comparison → PO (terikat Cash Gate) → deliveries.
  Exit: alur lead → assessment → proposal → kontrak → baseline jalan;
        margin di bawah floor memicu warning.

FASE 9 — Maintenance Engine                                    [modules: maintenance-engine]
  handover_items, warranties, assets (Facility Passport),
  maintenance_plans, service_tickets, recurring inspection.
  Exit: proyek selesai otomatis membentuk warranty register +
        galeri before–after; tiket servis jalan.

FASE 10 — AI Scribe & Intelligence                             [modules: ai-scribe]
  Voice note → draft daily report; draft weekly report; klasifikasi issue;
  ringkasan quote; draft assessment/proposal; deteksi keterlambatan.
  Semua output AI = status DRAFT, manusia menyimpan. Server-side only,
  log biaya per proyek.
  Exit: draft AI bisa diedit-simpan; tidak ada jalur AI yang meng-approve
        pembayaran/kualitas/variation (dites eksplisit).
  ── CHECKPOINT #5: review kualitas draft AI vs voice note nyata
     berbahasa campuran Indonesia/Jawa dari lapangan. ──

  **Scope dikurangi 2026-07-23** (lihat [ADR 0021](decisions/0021-fase10-scope-reduction-voice-note-and-weekly-report-deferred.md))
  — shipped: klasifikasi issue, deteksi keterlambatan, ringkasan quote, draft
  assessment scope. Ditunda ke fase mendatang: voice note → draft daily
  report (butuh keputusan vendor speech-to-text belum ada) dan CHECKPOINT #5
  yang melekat padanya (tidak bisa lulus tanpa fitur itu ada), serta draft
  weekly report (butuh desain jalur review staf sebelum konten AI boleh
  sampai ke client-portal, belum ada sama sekali). Exit criterion di atas
  dianggap terpenuhi untuk keempat fitur yang sudah dikirim; dua sisanya
  bukan utang teknis fase ini, melainkan menunggu keputusan Owner lebih
  lanjut per ADR 0021.

FASE 11 — Partner Desk + polish                                (setelah internal stabil,
  supplier quotes/delivery/invoice terbatas; notifikasi WA API      sesuai dokumen)
  bila volume sudah tinggi.

  **Sempat ditunda per 2026-07-23** (lihat [ADR 0022](decisions/0022-fase11-deferred-pending-real-partner-volume.md))
  — "setelah internal stabil" sudah benar (Fase 0-10 hijau di CI), tapi
  "bila volume sudah tinggi" adalah kondisi bisnis nyata, bukan kondisi
  teknis, dan Owner sempat mengonfirmasi kondisi itu belum terpenuhi.
  **Owner kemudian memutuskan tetap dibangun sekarang** (lihat
  [ADR 0023](decisions/0023-fase11-owner-override-build-despite-volume-gate.md))
  — fakta volume di ADR 0022 tidak berubah, tapi kode dibangun mendahului
  volume tersebut secara sadar; ADR 0023 menegaskan ini bukan izin untuk
  mengundang partner sungguhan sebelum item `docs/PRE-LAUNCH-CHECKLIST.md`
  ditutup.
```

**Aturan antar-fase:** fase N+1 tidak dimulai kalau exit criteria fase N belum hijau di CI. Setiap fase mengunci: migration wave-nya, RLS matrix ter-update, test-nya, dan seed demo diperluas. Dengan begitu setiap lapisan teruji sebelum lapisan berikutnya berdiri di atasnya — sesuai permintaan Anda: semua dibangun, tapi tidak ada yang dibangun di atas fondasi yang belum terbukti.

---

## 8. CLAUDE.md (draft — file terpisah disertakan)

Draft lengkap ada di file `CLAUDE.md` yang saya sertakan bersama dokumen ini. Isinya adalah versi ringkas-operasional dari konvensi di atas, ditulis sebagai instruksi langsung untuk sesi Claude Code: aturan folder & boundary import, konvensi DB & migration, kontrak types, pola safeAction/Result/audit, aturan uang bigint, definition of done per modul, dan larangan-larangan keras (jangan edit generated types, jangan tulis audit manual, jangan bypass state machine, dsb).

---

## 9. KEPUTUSAN ARSITEKTUR — FINAL & TERKUNCI

> Sepuluh poin di bawah ini **bukan lagi pertanyaan terbuka**. Owner (Ervan) memutuskannya pada 20 Juli 2026 dan keputusan ini adalah bagian dari kontrak arsitektur. Mengubahnya = revisi dokumen ini + ADR baru, bukan keputusan di tengah coding.

### D1 — Multi-tenancy: opsi (b), disiapkan multi-org sejak hari pertama

`organization_id` + RLS org-scope dipasang di **SEMUA tabel sejak migration pertama**. Satu perusahaan sekarang, siap jadi SaaS untuk kontraktor lain nanti tanpa retrofit.

**Konsekuensi teknis:** setiap tabel di setiap wave wajib punya kolom `organization_id uuid not null` + FK ke `organizations` + policy `USING (organization_id = fn_current_org_id())`. Tabel tanpa `organization_id` = CI merah, sama kerasnya dengan tabel tanpa RLS.

### D2 — Storage foto: Supabase Storage free tier, kompresi client-side

Kompresi client-side ke **200–400KB** + thumbnail otomatis. Tidak ada object storage eksternal di fase ini.

**Konsekuensi teknis:** ini **metric yang diawasi, bukan set-and-forget**. Supabase Free = 1GB storage. Pada 300KB/foto + thumbnail, plafon praktis ≈ **3.000 foto**. Modul `field-reporting` (Fase 4) wajib menyertakan penghitung pemakaian storage per organisasi dan alert saat menembus 70%. Migrasi ke tier arsip eksternal (mis. R2) dievaluasi ulang saat alert itu menyala — bukan sebelumnya.

### D3 — Offline SiteFlow: read cache + outbox, last-write-wins per field

Tidak ada conflict resolution kompleks. Asumsi: satu koordinator per lokasi.

**Konsekuensi teknis:** outbox menyimpan mutasi per-field, bukan per-row snapshot, agar last-write-wins tidak menimpa field yang tidak disentuh. Tidak ada CRDT, tidak ada vector clock.

### D4 — Auth lapangan: EMAIL + MAGIC LINK (bukan HP+OTP)

> **Direvisi 2026-07-23** — lihat [ADR 0025](docs/decisions/0025-password-auth-reversing-d4.md).
> Sign-in kini email + password untuk semua role, atas permintaan eksplisit
> Owner (preferensi UX, bukan tambal bug). Teks di bawah tetap sebagai
> sejarah keputusan, tidak dihapus.

Supabase Auth built-in, gratis. Berlaku untuk **semua role** — lapangan, kantor, klien, partner.

**Alasan:** OTP berbayar per pesan; kita mulai dari zero-cost. Ini membatalkan rekomendasi awal dokumen ini (HP+OTP untuk lapangan).

**Konsekuensi teknis:** tidak ada provider SMS/WhatsApp di kernel. Mandor wajib punya alamat email yang bisa dibuka di HP — ini **risiko adopsi lapangan yang diterima secara sadar** dan diuji langsung di CHECKPOINT #3 (uji lapangan Fase 4). Kalau di uji lapangan magic link terbukti menghambat, itu jadi revisi arsitektur, bukan tambal-sulam.

### D5 — Cash Gate: sumber kas MANUAL

Finance mengunggah bukti transfer + mengisi tanggal cleared. **Tidak ada rekonsiliasi bank otomatis** dan tidak ada integrasi payment gateway di fase mana pun yang direncanakan sekarang.

**Konsekuensi teknis:** `funding_receipts` punya kolom bukti (path storage) + `cleared_at` yang diisi manusia. Karena angka kas berasal dari input manusia, setiap perubahan `cleared_at` dan nominal wajib ter-audit — ini bukan opsional.

### D6 — Mata uang: IDR, `bigint` utuh, tanpa desimal. Tanpa perhitungan pajak.

PPN/PPh **tidak dihitung sistem di fase mana pun sekarang**. Nominal bruto saja; pajak diurus di pembukuan luar sistem.

**Konsekuensi teknis:** tidak ada kolom `tax_amount`/`ppn_bp`/`pph_bp` di skema mana pun sampai keputusan ini direvisi. Tidak ada currency code — single currency implisit. Menambahkan pajak nanti adalah perubahan expand→migrate→contract yang direncanakan, bukan kolom yang "disiapkan dulu saja".

### D7 — AI runtime: `ai-scribe` DIBEKUKAN sampai instruksi eksplisit Owner

**Dicabut 2026-07-23** (lihat [ADR 0020](decisions/0020-fase10-ai-scribe-unfreeze-and-scope.md)) — Owner secara eksplisit meminta Fase 10 dimulai. Pembekuan di bawah berlaku sampai tanggal tersebut; dicatat di sini apa adanya sebagai riwayat keputusan, bukan diedit menjadi seolah tidak pernah ada.

Modul `ai-scribe` (Fase 10) **tidak disentuh sama sekali** sampai Owner secara eksplisit memintanya.

**Konsekuensi teknis — larangan keras (berlaku sampai tanggal pencabutan di atas):** tidak boleh ada panggilan Claude API di kode mana pun sebelum itu. **Tidak boleh ada stub, placeholder call, prompt template, environment variable API key, atau dependency SDK Anthropic** di fase-fase awal. Folder `modules/ai-scribe/` boleh ada sebagai placeholder kosong demi kelengkapan struktur §1.1, tapi isinya harus tetap kosong.

Aturan operasional Fase 10 setelah pencabutan ada di ADR 0020, bukan diulang di sini — ADR itu satu sumber kebenaran untuk scope, model, dan batasan biaya, dan sesi mendatang harus membacanya sebelum menyentuh modul ini lebih lanjut.

### D8 — E-signature: ditunda

Upload scan manual. Tidak ada integrasi penyedia tanda tangan digital.

### D9 — Hosting: Vercel Hobby (free) + Supabase Free

Semua migration dan pola pemakaian storage dirancang dengan asumsi limit free tier:

| Limit | Angka | Implikasi |
| --- | --- | --- |
| Database Supabase Free | 500 MB | Skema + data operasional harus muat; foto tidak pernah disimpan sebagai bytea di DB |
| Storage Supabase Free | 1 GB | Lihat D2 — plafon praktis ≈3.000 foto |
| Auto-pause project | 7 hari idle | Project staging/produksi yang jarang dipakai akan tidur; butuh ping berkala atau penerimaan cold start |
| Vercel Hobby | non-komersial, tanpa SLA | Perlu ditinjau ulang sebelum dipakai melayani klien berbayar |

**Aturan tegas:** kalau ada keputusan teknis yang berisiko menembus salah satu limit ini lebih cepat dari perkiraan, itu **wajib di-flag eksplisit ke Owner**. Dilarang mengasumsikan Owner akan meng-upgrade paket secara otomatis.

### D10 — Bahasa: UI Indonesia, kode Inggris, tanpa i18n

Seluruh teks yang dilihat pengguna berbahasa Indonesia. Identifier, nama file, komentar kode, dan pesan commit berbahasa Inggris. **Tidak ada framework i18n** — tidak ada `next-intl`, tidak ada file terjemahan, tidak ada key lookup. String Indonesia ditulis langsung di komponen.

---

**Revisi keputusan.** Mengubah salah satu dari D1–D10 memerlukan: (1) ADR baru di `docs/decisions/` yang menjelaskan pemicu perubahan, (2) update bagian ini, (3) persetujuan eksplisit Owner. Tidak ada jalur lain.
