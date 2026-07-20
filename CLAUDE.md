# CLAUDE.md — BuildTrust OS

Instruksi operasional untuk setiap sesi Claude Code di repo ini. Baca `ARCHITECTURE.md` untuk *alasan* di balik aturan; file ini adalah *aturannya* dalam bentuk yang bisa langsung ditegakkan. Kalau instruksi user berbenturan dengan file ini, **berhenti dan tanya** — jangan diam-diam menyimpang dari arsitektur.

Stack: Next.js App Router · TypeScript (strict) · Tailwind · Supabase (Postgres/Auth/Storage) · PWA (SiteFlow) · Claude API server-side. Package manager: **pnpm**.

---

## 0. Hukum yang tidak boleh dilanggar

1. **Uang = `bigint` Rupiah utuh.** Tidak pernah `number`, tidak pernah float untuk nominal. Aritmetika nominal hanya lewat `core/money`. Rasio = basis points integer.
2. **Logic kritis tidak boleh menyentuh UI/DB.** Cash Gate, Variation state machine, Quality Hold Point hidup di `modules/<x>/domain/` sebagai pure function. Dilarang `import` supabase/react/next di dalam `domain/`.
3. **Aturan uang & approval ditegakkan 2 lapis:** domain layer **dan** database (trigger/constraint/RLS). UI = lapis kosmetik, tidak pernah dianggap keamanan.
4. **Types mengalir dari DB, bukan sebaliknya.** Jangan pernah menulis ulang bentuk row secara manual. Jangan pernah mengedit `core/db/database.types.ts` (generated).
5. **Semua mutasi bernilai audit lewat `core/audit`.** Dilarang `insert into audit_logs` manual. Aksi override/approval WAJIB menyertakan `reason`.
6. **Setiap tabel wajib punya RLS + entri di `docs/rls-matrix.md` + test RLS.** Tabel tanpa RLS = CI merah.
7. **Jangan lompati Build Sequence.** Fase N+1 hanya dimulai setelah exit criteria fase N hijau di CI. Jangan bangun modul yang belum gilirannya "karena sekalian".
8. **Sepuluh keputusan Owner (ARCHITECTURE.md §9 D1–D10) mengikat.** Yang paling sering tergoda dilanggar: `organization_id` wajib di SEMUA tabel (D1); auth = magic link saja, tanpa OTP/SMS (D4); tanpa kolom pajak apa pun (D6); `ai-scribe` dibekukan total (D7); tanpa framework i18n (D10). Melanggar salah satunya = revisi arsitektur, bukan pilihan implementasi.

---

## 1. Struktur folder & batas impor

- Routing tipis di `src/app/`. Logika ada di `src/modules/`. Kode shared bebas-domain di `src/core/`. Util generik di `src/lib/`.
- Satu tabel dimiliki **tepat satu modul**. Butuh data tabel modul lain? Panggil fungsi dari `modules/<pemilik>/index.ts`. **Dilarang** query langsung tabel milik modul lain.
- Batas impor (ditegakkan ESLint boundaries — jangan matikan rule-nya):
  ```
  app        → modules/*/index.ts, core
  modules/X  → core, modules/Y/index.ts
  modules/X/domain → core/money, core/errors, lib   (TIDAK BOLEH: supabase, react, next, modul lain)
  core       → lib
  ```
- Struktur tiap modul: `domain/` (pure) · `data/` (repository/query) · `actions/` (server actions) · `components/` · `schemas.ts` (Zod) · `types.ts` · `index.ts` (public API — satu-satunya pintu impor keluar).

## 2. Database & migration

- File: `supabase/migrations/YYYYMMDDHHMMSS_deskripsi.sql`. **Append-only** — migration yang sudah applied tidak pernah diedit; perbaiki lewat migration baru. Perubahan destruktif = pola expand→migrate→contract (3 migration).
- Satu tabel dibuat lengkap dalam satu paket: kolom + PK + FK + index + trigger `updated_at` + trigger audit + `ENABLE ROW LEVEL SECURITY` + policy, di file yang sama.
- FK selalu eksplisit `ON DELETE` (default `RESTRICT`; `CASCADE` hanya untuk child murni).
- Ikuti urutan Wave 0–10 di ARCHITECTURE.md §2.1. Jangan buat FK ke tabel wave yang lebih tinggi.
- Penamaan: tabel `snake_case` jamak · PK `id uuid default gen_random_uuid()` · FK `<singular>_id` · uang `*_amount bigint` · status = Postgres `ENUM <table>_status` · index `idx_<table>_<kolom>` · unique `uq_...` · fk `fk_...` · check `ck_...` · trigger `trg_...` · function `fn_...` · policy `<table>_<aksi>_<role_group>`.
- Enum terkontrol-kode → Postgres ENUM. Nilai yang mungkin ditambah admin lewat UI → lookup table.
- Data sensitif (harga beli, upah, markup, margin, internal notes) **tidak** di tabel yang dibaca klien. Portal klien membaca lewat `vw_client_*` views saja.

## 3. Types & kontrak

- `pnpm db:types` menghasilkan `core/db/database.types.ts`. CI gagal kalau hasil generate ≠ yang ter-commit.
- Row types selalu derive: `type Invoice = Tables<'invoices'>`. Bentuk lain via `Pick`/`Omit`/composed dari row type.
- Enum: satu sumber di Postgres; mirror di `core/db/enums.ts` dengan `satisfies`.
- Zod hanya di boundary (input action, payload API, output AI). Domain sudah bertipe kuat — jangan re-validasi berulang.
- Semua server action mengembalikan:
  ```ts
  type ActionResult<T> = { ok: true; data: T } | { ok: false; error: { code: ErrorCode; message: string; field?: string } };
  ```

## 4. Pola server action (WAJIB)

Bungkus setiap action dengan `safeAction`:
```
safeAction(schema, permission, async (input, ctx) => {
  // 1. input sudah tervalidasi Zod & permission sudah dicek
  const state = await repo.load(...);           // data/
  const decision = domain.doSomething(state);   // domain/ (pure)
  if (!decision.ok) return fail(decision.error);
  await repo.commit(...);                        // dalam SATU transaksi
  await audit(...);                              // core/audit, sertakan reason bila override/approval
  return ok(result);
})
```
- Domain **mengembalikan `Result`** untuk aturan bisnis, bukan melempar exception. Exception hanya untuk infra.
- Tidak ada try/catch ad-hoc per fitur — `safeAction` yang memetakan error → `ActionResult`.

## 5. Error handling

- Hierarki di `core/errors`: `ValidationError`, `PermissionError`, `DomainRuleError`, `NotFoundError`, `ConflictError`, `InfraError`.
- Error code stabil di `core/errors/codes.ts` + `docs/error-codes.md` (mis. `CASH_GATE_RED`, `VARIATION_INVALID_TRANSITION`, `HOLD_POINT_PENDING`). Tambah error = tambah code, bukan string bebas.
- Pesan user (Bahasa Indonesia, aman) ≠ pesan log (teknis + `org_id/project_id/user_id/request_id`). Jangan bocorkan detail infra ke portal klien.
- Logging JSON terstruktur via logger di `core`. `request_id` ikut sampai ke audit log.

## 6. Audit log

- Tabel tunggal `audit_logs`, **append-only** (tidak ada UPDATE/DELETE policy untuk siapa pun).
- Dua kanal: (1) trigger DB `fn_audit_row_change()` di semua tabel bernilai audit — jaring pengaman diff OLD/NEW; (2) `withAudit()` di action — menambah `reason`, `request_id`, semantik aksi.
- `withAudit` dengan `requiresReason: true` gagal-kompilasi kalau `reason` kosong.
- UI riwayat pakai komponen tunggal `<AuditTrail entityTable entityId />` dari `core/ui`.

## 7. Role & permission

- Sumbu: role org (di JWT claims: owner, technical_director, finance, qs, procurement) + role proyek (di `project_members`: site_coordinator, mandor, client_approver, client_viewer, supplier, subcontractor).
- **Satu sumber kebenaran:** `core/permissions/matrix.ts`. Dikonsumsi 3 penegak: RLS (`fn_has_project_role`), `requirePermission` di action, `can()` di UI.
- `pnpm gen:rls-check` memverifikasi matrix.ts ↔ pg_policies sinkron. Selisih = CI merah.
- Menambah role: (1) migration enum+roles, (2) update matrix.ts, (3) `gen:rls-check`, (4) tambah user dummy di test factories. Jangan sebar `if (role === ...)` di komponen.
- Role eksternal tidak pernah akses tabel internal — hanya `vw_client_*`/`vw_partner_*` views, di-scope per `project_id` keanggotaan.

## 8. Testing — Definition of Done

- Modul kritis (cash-gate, scope-variation, quality-gate) belum "selesai" tanpa:
  - Unit (Vitest) domain ≥ 90% **branch** coverage, termasuk nilai batas & kasus ekstrem (lihat ARCHITECTURE.md §4.5).
  - Integration (Supabase lokal / pgTAP): trigger DB benar-benar memblokir; RLS sesuai matriks; setiap mutasi memunculkan audit row.
  - E2E (Playwright) untuk 3 alur kritis: termin→gate hijau→PO; variation approve→funded→muncul di SiteFlow; inspeksi gagal→terkunci→override→audit.
- Test membangun datanya sendiri via `supabase/tests/factories.ts`. Tidak bergantung urutan test lain atau seed demo.
- Mutasi tanpa audit entry = test gagal (sengaja).

## 9. AI (ai-scribe) — **MODUL DIBEKUKAN**

> **STOP.** Per keputusan Owner D7 (ARCHITECTURE.md §9), modul `ai-scribe` **tidak disentuh sama sekali** sampai Owner memintanya secara eksplisit. Sampai saat itu, di seluruh repo **dilarang**: memanggil Claude API, membuat stub/placeholder call, menulis prompt template, menambah env var API key, atau memasang dependency SDK Anthropic. Folder `modules/ai-scribe/` tetap kosong. Aturan di bawah baru berlaku setelah pembekuan dicabut.

- Semua panggilan Claude API **server-side only**, API key di backend, budget cap + log biaya per proyek.
- Output AI **selalu status draft**. Manusia mengedit & menyimpan. AI tidak pernah mengesahkan: progress pembayaran, kualitas, biaya, variation, status keselamatan (dites eksplisit).
- Data sensitif tidak dikirim dari browser langsung ke API.

## 10. Perintah pnpm (referensi)

> Sejak [ADR 0006](docs/decisions/0006-cloud-dev-database-instead-of-local.md), development lokal menyasar project Supabase Cloud (`buildtrust-os-dev`) langsung — bukan `supabase start`. CI tidak terpengaruh: tetap pakai Supabase lokal ephemeral di GitHub Actions runner.

```
pnpm dev            # Next.js dev
pnpm db:push        # terapkan migration, via --db-url (butuh SUPABASE_DB_URL)
pnpm db:types       # generate database.types.ts via Management API
                    #   (butuh SUPABASE_ACCESS_TOKEN — lihat ADR 0006 addendum:
                    #   --db-url diam-diam butuh container postgres-meta)
pnpm gen:rls-check  # verifikasi matrix.ts ↔ RLS policies (butuh SUPABASE_DB_URL)
pnpm test           # unit (Vitest), tanpa database
pnpm test:db        # integration + RLS test, terhadap SUPABASE_DB_URL
pnpm test:e2e       # Playwright
pnpm lint           # ESLint termasuk import boundaries
pnpm typecheck      # tsc --noEmit
```
CI menjalankan: lint + typecheck + db:types diff + gen:rls-check + test + test:db, semua terhadap Supabase lokal ephemeral milik runner — bukan project cloud dev. Semua harus hijau sebelum merge.

**Project dev bersifat shared, mutable state, bukan database segar per run.** Anggap disposable (boleh di-reset/truncate), tapi tidak ada "reset lokal" untuk kembali ke kondisi bersih — `test:db` membersihkan data yang ia buat sendiri lewat `cleanupOrganizations`.

## 11. Kalau ragu

- Ambiguitas arsitektur baru → tulis sebagai ADR di `docs/decisions/` dan tanyakan ke user, jangan putuskan diam-diam.
- Jangan menambah dependency besar tanpa alasan tertulis di PR.
- Jangan menonaktifkan rule ESLint/TS untuk "mempercepat". Kalau rule menghalangi, itu biasanya sinyal desain, bukan penghalang.
