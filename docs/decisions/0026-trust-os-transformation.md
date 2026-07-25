# ADR 0026 — Trust OS transformation: Project Confidence Score, Evidence domain, module reframing

**Status:** PROPOSED — belum diimplementasikan, butuh keputusan Owner per item di bagian "Keputusan yang dibutuhkan Owner" sebelum Fase 12 dimulai.
**Date:** 2026-07-25
**Trigger:** Instruksi eksplisit Owner untuk mengevaluasi ulang arsitektur produk sebagai "Trust Operating System", bukan menambah fitur ERP.

Dokumen pendamping: [PRODUCT.md](../../PRODUCT.md) (mission/vision/prinsip). ADR ini adalah desain teknisnya.

---

## 1. Ringkasan keputusan yang diusulkan

1. Modul baru **`modules/evidence`** — domain baru yang menghubungkan bukti (foto/video/QC/GPS/penanggung jawab) ke aktivitas apa pun di sistem, memakai pola polymorphic reference yang **sudah ada preseden**-nya di `audit_logs` (`entity_table`/`entity_id`) — bukan pola baru yang harus dipelajari ulang.
2. Modul baru **`modules/trust-score`** — menghitung **Project Confidence Score** dari 8 sinyal yang masing-masing sudah dimiliki modul lain (tidak ada modul yang kehilangan kepemilikan datanya).
3. **Evidence-gating pada penyelesaian pekerjaan** — perpanjangan pola yang sudah terbukti di Cash Gate/Quality Gate (aturan ditegakkan di domain *dan* trigger DB) — diterapkan ke work package/milestone completion.
4. **Reframing Client Portal → Project Journey** — perubahan IA (information architecture), bukan penggantian modul; `modules/client-portal` tetap pemilik datanya.
5. Audit tiap modul yang ada: mana yang condong ERP, dan saran konkret untuk membuatnya lebih client-centric tanpa merusak batas modul yang sudah bersih.

Tidak ada satu pun dari ini yang mengubah D1–D10 (ARCHITECTURE.md §9). Tidak ada tabel lama yang di-drop. Tidak ada modul yang pindah kepemilikan tabel.

---

## 2. Project Confidence Score — arsitektur

### 2.1 Prinsip desain

Skor **dihitung, bukan disimpan sebagai sumber kebenaran** — persis seperti `GateState` di Cash Gate (`computeFundingCoverage`, dihitung ulang setiap dibaca, bukan kolom yang di-`UPDATE`). Ini menghindari kelas bug "skor basi karena lupa di-refresh setelah mutasi" yang sama yang sudah dihindari Cash Gate.

Untuk kebutuhan tren historis (North Star metric butuh grafik mingguan), skor **di-snapshot** ke tabel baru `confidence_score_snapshots` oleh proses terjadwal (lihat §2.4) — snapshot adalah *catatan sejarah*, bukan sumber kebenaran saat ini.

### 2.2 Delapan komponen & bobot

| # | Komponen | Sumber (modul pemilik) | Bobot | Cara hitung (ringkas) |
|---|----------|------------------------|-------|------------------------|
| 1 | **Cash Gate** | `cash-gate` (`getGateStateAction`) | 20% | `green`→100, `yellow`→60, `red`→20, `overdue`→0 |
| 2 | **QC Completion** | `quality-gate` (inspections + nonconformities) | 15% | % hold point wajib yang `passed` dari yang seharusnya sudah diperiksa pada tahap ini, dikurangi penalti per nonconformity `open` (bobot lebih berat untuk severity tinggi) |
| 3 | **Schedule Performance** | `projects` (milestones/work_packages) + `ai-scribe` (delay detection yang sudah ada) | 15% | 100 dikurangi penalti non-linear dari jumlah hari keterlambatan ter-normalisasi terhadap durasi total proyek |
| 4 | **Documentation Completeness** | `evidence` (baru, §3) | 15% | % aktivitas yang *seharusnya* py punya evidence (work package/milestone yang sudah `completed`) yang benar-benar punya ≥1 evidence lengkap (foto + QC + penanggung jawab + timestamp) |
| 5 | **Budget Health** | `billing` (`listAgingDashboardAction`) | 10% | 100 dikurangi penalti dari % invoice yang berada di tier `overdue_*`, tertimbang durasi keterlambatan |
| 6 | **Open Issues** | `field-reporting` (issues) | 10% | 100 dikurangi penalti dari jumlah issue `open`, tertimbang `severity` dan usia (issue lama lebih berat) |
| 7 | **Client Approvals** | `client-portal` (Decision Clock) | 10% | 100 dikurangi penalti dari distribusi `clockTier` pending decisions (`aging`/`overdue` menurunkan skor) |
| 8 | **Variation Status** | `scope-variation` (change orders) | 5% | 100 dikurangi penalti dari change order yang macet (`submitted_for_review`/`awaiting_client_approval` melebihi ambang waktu wajar) |

Total 100%. Skor akhir = jumlah tertimbang, dibulatkan ke integer 0–100.

**Kenapa bobot ini** (indikatif, bukan final — perlu divalidasi dengan data proyek nyata, sama seperti Cash Gate's FCR formula divalidasi di CHECKPOINT #2): Cash Gate dan QC dapat bobot tertinggi karena keduanya sudah punya *hard gate* di sistem — kalau keduanya buruk, risiko sudah bersifat struktural, bukan sekadar administratif. Documentation Completeness sengaja diberi bobot signifikan (15%, setara Schedule) supaya prinsip "status tanpa bukti = belum selesai" (PRODUCT.md prinsip #2) benar-benar tercermin di angka yang dilihat semua orang, bukan cuma jadi slogan.

### 2.3 Pita warna (mengikuti pola `StatusBadge`/Cash Gate yang sudah ada)

| Rentang | Label | Tone |
|---|---|---|
| 90–100 | Sangat sehat | `success` |
| 75–89 | Sehat | `success` (redup) atau `info` |
| 60–74 | Perlu perhatian | `warning` |
| 40–59 | Berisiko | `warning`/`danger` |
| 0–39 | Kritis | `danger` |

### 2.4 Implementasi teknis (mengikuti pola yang sudah ada, bukan pola baru)

```
modules/trust-score/
  domain/
    compute-confidence-score.ts   # pure function: ConfidenceInputs -> ConfidenceScore
    compute-confidence-score.test.ts
  types.ts                        # ConfidenceScore, ConfidenceBreakdown, ConfidenceInputs
  actions/
    get-project-confidence-score-action.ts   # orchestrator: panggil 8 modul lain via index.ts masing-masing,
                                              # rakit ConfidenceInputs, panggil domain function
    snapshot-confidence-scores-action.ts     # dipanggil scheduled job harian, tulis ke confidence_score_snapshots
  index.ts
```

`trust-score` **tidak memiliki tabel bisnis apa pun** kecuali `confidence_score_snapshots` (riwayat, bukan sumber kebenaran) — persis pola yang sudah dipakai `/cc/page.tsx` hari ini untuk merakit kartu proyek dari `cash-gate` + `client-portal` + `field-reporting` secara paralel, hanya sekarang dirapikan jadi satu domain function yang bisa diuji unit test-nya secara terisolasi (memenuhi CLAUDE.md §8: modul dengan logic bercabang butuh test cakupan tinggi terhadap nilai batas).

Migration baru yang dibutuhkan (Wave berikutnya setelah Wave 10, mengikuti urutan §2.1 ARCHITECTURE.md): `confidence_score_snapshots(id, organization_id, project_id, score, breakdown jsonb, computed_at)` — RLS staff-only (klien tidak melihat angka mentah breakdown internal seperti margin/cash reserve; klien melihat versi yang disederhanakan, lihat §4).

### 2.5 Apa yang klien lihat vs yang tidak

Sesuai D2.6 (data sensitif tidak bocor ke klien): breakdown mentah (misalnya angka cash reserve) **tidak pernah** dikirim ke `vw_client_*`. Klien melihat **skor tunggal + label 5 kategori di atas + satu kalimat penjelasan per kategori dalam bahasa non-teknis** (misalnya "Kas proyek: sehat" bukan "Cash Gate: green, ratio 142%"), dirakit oleh view klien baru `vw_client_confidence_summary` yang membaca dari action yang sama tapi memfilter field sensitif di lapisan SQL — pola yang identik dengan `vw_client_project_overview` yang sudah ada.

---

## 3. Domain Evidence

### 3.1 Hierarki yang diminta, dipetakan ke realita skema yang ada

```
Project        (sudah ada: projects)
  ↓
Milestone      (sudah ada: milestones, di bawah contracts)
  ↓
Activity       (KONSEP LOGIS, bukan tabel baru — lihat §3.2)
  ↓
Evidence       (TABEL BARU — modules/evidence)
  ↓
Approval       (sudah ada, tersebar: inspections, client_decisions, TD override —
                dihubungkan ke Evidence via FK opsional, bukan tabel approval baru)
  ↓
Knowledge      (TABEL BARU, opsional/Fase lanjutan — lihat §3.5)
```

### 3.2 Kenapa "Activity" TIDAK jadi tabel baru

Opsi yang dipertimbangkan dan ditolak: membuat tabel `activities` sebagai lapisan wajib di antara milestone dan bukti, lalu memigrasikan `work_packages`, `daily_logs`, `progress_entries`, `inspections` supaya semuanya mereferensi baris `activities`. Ini **ditolak** karena:

- Melanggar prinsip "jangan over-engineer" — empat tabel yang sudah stabil dan sudah punya RLS/test/audit sendiri harus dimigrasi ulang murni supaya ada satu lapisan abstraksi baru.
- Setiap tabel itu **sudah** merepresentasikan sebuah "aktivitas" secara natural: satu baris `work_packages` = satu paket kerja; satu baris `daily_logs` = satu hari kerja; satu baris `inspections` = satu pemeriksaan. "Activity" tidak butuh identitas fisik terpisah untuk berfungsi sebagai konsep.

**Activity diperlakukan sebagai konsep logis**: baris apa pun di tabel manapun yang merepresentasikan "sesuatu yang dikerjakan" (work package, daily log, progress entry, inspection, issue resolution). Evidence menempel ke Activity lewat pasangan polymorphic `(activity_table, activity_id)` — pola yang **identik** dengan `audit_logs.entity_table`/`entity_id` yang sudah dipakai di seluruh sistem sejak Fase 0. Tidak ada konsep baru yang harus dipelajari tim.

### 3.3 Skema `evidence` (diusulkan)

```sql
create type evidence_type as enum ('photo', 'video', 'document');
create type evidence_qc_result as enum ('pass', 'fail', 'not_applicable');

create table evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  project_id uuid not null references projects(id),
  activity_table text not null,      -- 'work_packages' | 'daily_logs' | 'progress_entries' | 'inspections' | 'issues' | 'handover_items'
  activity_id uuid not null,         -- polymorphic, sama pola dengan audit_logs
  evidence_type evidence_type not null,
  storage_path text not null,
  thumbnail_path text,
  captured_at timestamptz not null default now(),
  gps_lat double precision,          -- nullable, opsional per PRODUCT.md prinsip #2
  gps_lng double precision,
  qc_result evidence_qc_result,      -- nullable: tidak semua evidence butuh hasil QC (mis. foto progres harian)
  responsible_user_id uuid not null references users(id),
  notes text,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
-- + index (project_id, activity_table, activity_id), trigger updated_at, trigger audit, RLS staff-write/client-read-via-view
```

Catatan penting: ini **bukan pengganti** `photos` yang sudah ada di `field-reporting` — `photos` tetap dimiliki `field-reporting` dan tetap jadi cara staf mengunggah foto harian. `evidence` adalah **lapisan indeks lintas-modul** yang mencatat "bukti apa menempel ke aktivitas mana, dengan kelengkapan apa" — bisa merujuk balik ke sebuah baris `photos` (lewat `storage_path` yang sama) atau berdiri sendiri untuk jenis bukti yang belum ada tabelnya (video, dokumen serah terima). Detail migrasi (apakah `evidence` menyerap `photos` sepenuhnya di masa depan, atau tetap dua tabel paralel) adalah keputusan implementasi Fase 12, dicatat sebagai **keputusan terbuka** di §5, bukan diputuskan sepihak di ADR ini.

### 3.4 Evidence-gating: "status tanpa bukti = belum selesai", ditegakkan dua lapis

Meniru pola Cash Gate/Quality Gate persis (CLAUDE.md hukum §0.3): **domain layer** *dan* **trigger DB**.

- **Domain**: `modules/evidence/domain/evaluate-completion-readiness.ts` — pure function `canMarkComplete(activityTable, activityId, evidenceRows) -> Result` yang menolak transisi ke status selesai kalau tidak ada evidence yang memenuhi syarat minimum (evidence_type foto/video + qc_result bukan null jika aktivitas itu tergolong hold-point-relevant + responsible_user_id terisi).
- **DB trigger**: trigger `BEFORE UPDATE` di `work_packages` (dan tabel completion-bearing lain yang disepakati) yang menolak `status = 'completed'` kalau tidak ada baris `evidence` terkait — jaring pengaman terakhir persis seperti `fn_cash_gate_status` menolak PO saat gate merah.

**Ini adalah keputusan Owner yang butuh CHECKPOINT**, bukan sesuatu yang boleh diam-diam diaktifkan: mengaktifkan trigger ini mengubah perilaku yang sudah berjalan (hari ini, work package bisa ditandai selesai tanpa evidence apa pun). Lihat §5.

### 3.5 Knowledge — lapisan terjauh, diusulkan sebagai Fase lanjutan (bukan sekarang)

`knowledge_entries`: ringkasan yang disarikan (dengan bantuan AI, tetap draft-direview-manusia per hukum AI di CLAUDE.md §9) dari pola evidence + resolusi berulang — misalnya "3 nonconformity waterproofing berulang di 2 proyek berbeda dengan vendor material yang sama, layak jadi item perhatian di `hold_point_templates` proyek berikutnya." Ini bukan kebutuhan mendesak (tidak ada klien yang menunggu ini), dan implementasinya bergantung pada `evidence` sudah terisi cukup data nyata dulu. Diusulkan sebagai **Fase 13+**, dicatat di sini supaya hierarki lengkap terlihat, tapi **tidak masuk rencana kerja Fase 12**.

---

## 4. Reframing Client Portal → Project Journey (IA, bukan modul baru)

`modules/client-portal` **tetap pemilik** `client_decisions` dan semua `vw_client_*` views — ini perubahan *information architecture* di lapisan `src/app/(client-portal)/`, bukan migrasi kepemilikan data.

Perubahan yang diusulkan:

- **Dari tab datar (Ringkasan/Timeline/Zona/Foto/Keputusan) → satu linimasa vertikal** yang mencampur semuanya secara kronologis-emosional: foto progres, keputusan yang perlu diambil, insight QC dalam bahasa awam, dan (baru) skor confidence yang disederhanakan — semua dalam satu aliran cerita, bukan lima laci terpisah yang harus diklik satu-satu.
- **Bahasa status ditulis ulang** di lapisan presentasi (bukan di database — enum tetap teknis di DB, terjemahan terjadi di komponen UI, sama seperti `STATUS_LABEL_ID` yang sudah dipakai di banyak halaman) — misalnya `awaiting_client_approval` tampil sebagai "Menunggu keputusan Anda", bukan istilah state-machine mentah.
- **Bukti tampil sebagai konten utama**: setiap entri linimasa yang punya evidence menampilkan foto/video langsung di kartu, bukan di balik link "lihat foto".
- Halaman `keputusan` (approve/reject variation) tetap ada sebagai aksi, tapi dipromosikan ke linimasa utama, bukan halaman terpisah yang harus dicari.

Ini adalah pekerjaan UI/UX murni terhadap struktur yang sudah bersih — risiko rendah, tidak menyentuh RLS atau skema.

---

## 5. Keputusan yang dibutuhkan Owner sebelum implementasi

Mengikuti pola CHECKPOINT yang sudah dipakai di setiap fase besar (Cash Gate FCR formula, Quality Gate hold points, dsb.) — ini bukan hal yang boleh diputuskan diam-diam oleh Claude:

1. **Bobot 8 komponen Confidence Score** (§2.2) — angka di atas indikatif, perlu divalidasi dengan intuisi bisnis Owner sebelum di-lock, sama seperti FCR Cash Gate dulu.
2. **Evidence-gating hard block** (§3.4) — apakah trigger DB benar-benar menolak completion tanpa evidence sejak hari pertama Fase 12, atau dimulai sebagai *warning* (skor turun, tapi tidak diblokir) selama periode transisi supaya tim lapangan terbiasa dulu.
3. **Cakupan awal Evidence**: semua project baru, atau hanya milestone yang client-facing (lebih murah, dampak trust lebih langsung)?
4. **Hubungan `evidence` vs `photos`**: dua tabel paralel untuk sekarang (lebih aman, tidak mengubah `field-reporting`), atau `evidence` menyerap `photos` sepenuhnya (lebih bersih jangka panjang, tapi migrasi berisiko lebih tinggi)?
5. **Fase 12 dimulai kapan** relatif terhadap Fase 11 (Partner Desk) yang baru saja selesai dan belum lulus pre-launch checklist penuh (lihat `docs/PRE-LAUNCH-CHECKLIST.md`) — apakah Trust Transformation ini menyela urutan Build Sequence atau menunggu giliran resminya (CLAUDE.md hukum §0.7: jangan lompati Build Sequence).

Sampai kelima hal ini diputuskan, ADR ini berstatus **PROPOSED**, bukan **Accepted** — konsisten dengan bagaimana ADR 0012 (Scope Variation) dan lainnya menunggu review Owner sebelum kode ditulis.

---

## 6. Audit modul yang ada: ERP-oriented vs Trust-centric

| Modul | Kondisi saat ini | Klasifikasi | Saran konkret (tanpa merusak batas modul) |
|---|---|---|---|
| `crm` | Pipeline lead + scoring, gaya CRM murni | ERP, dengan satu titik trust tersembunyi | Assessment report adalah *first trust touchpoint* sebelum kontrak ada — jadikan tampilan itu setara kualitas dengan Project Journey (bukan cuma laporan internal), karena ini kesan pertama calon klien terhadap seberapa serius perusahaan ini. |
| `projects` | Fondasi netral (zona, kontrak, milestone) | Netral/infrastruktur | Tidak perlu diubah — tapi jadi tempat alami untuk field `confidence_score` ditampilkan di level Ringkasan proyek. |
| `cash-gate` | Dashboard owner-only, sangat teknis (rasio, cadangan) | ERP secara tampilan, **paling trust-critical secara substansi** | Data mentah tetap internal (benar, per D2.6) — tapi klien berhak tahu *bahwa* mekanisme ini ada dan melindungi uang mereka. Surfacing versi sederhana lewat Confidence Score (§2.5) menyelesaikan ini tanpa membocorkan angka. |
| `scope-variation` | Sudah client-facing (approve/reject) — salah satu modul paling matang secara trust | Trust-centric, perlu polish | Tautkan foto "penyebab" variation langsung di layar approval (evidence linking) — klien memutuskan berdasarkan bukti visual, bukan cuma deskripsi teks. |
| `field-reporting` | Alat internal (SiteFlow) — tapi ini **pabrik bukti** seluruh sistem | Infrastruktur trust, tersembunyi dari klien | Sudah benar secara arsitektur (Pillar 1-2 baru saja menambah Aktivitas/Foto/Laporan feed). Perluasan: field GPS opsional saat capture, caption wajib untuk foto yang menempel ke milestone client-facing. |
| `quality-gate` | Kosakata sangat teknis (hold point, nonconformity) | ERP dalam bahasa, trust-critical dalam substansi | Terjemahkan ke linimasa klien sebagai "lencana" trust ("Lulus pemeriksaan independen sebelum ditutup") — bukan istilah gate/hold point mentah. |
| `client-portal` | Struktur tab admin-style | Trust-centric tapi IA-nya masih terasa software | Reframing linimasa vertikal, §4. |
| `billing` | Modul paling "ERP-rasa" (invoice, aging, DSO) | ERP, dengan mekanisme trust tersembunyi yang bagus (billing pack) | Billing pack (bukti+QC+variation summary sebelum invoice terbit) sudah pola yang benar — pastikan klien *selalu* melihat bundel ini otomatis di linimasa saat invoice terbit, bukan dokumen terpisah yang harus diminta. |
| `estimating` | Internal murni, margin sengaja disembunyikan (benar, D2.6) | ERP by design, correctly hidden | Proposal yang klien terima (bukan estimate internal) harus terasa seperti dokumen komitmen personal, bukan print-out spreadsheet. |
| `procurement` | ERP murni, RFQ/PO/delivery — benar-benar tidak perlu klien lihat detailnya | ERP, correctly hidden | Momen "material tiba di lokasi" bisa jadi entri linimasa client-facing ringan ("Material untuk dapur Anda sudah tiba") tanpa membocorkan harga/vendor — evidence delivery photo cukup. |
| `assessment` | Langkah CRM/pra-kontrak | Perlu diangkat jadi bagian journey, bukan langkah backend | Sama seperti poin `crm` — ini pengalaman pertama klien, perlakukan sebagai awal Project Journey, bukan tahap sales internal. |
| `maintenance-engine` | Dimodelkan sebagai asset registry (ERP: Facility Passport) | Trust moment besar yang under-presented | Reframe sebagai "Catatan Perawatan Rumah Anda" client-facing (warranty + service ticket history) — ini titik kepercayaan pasca-serah-terima yang paling menentukan repeat business/referral. |
| `partner-desk` | B2B/supplier-facing, bukan bagian journey klien | ERP, correctly out of scope | Tidak perlu reframing — bukan permukaan trust klien, tidak melanggar prinsip apa pun dengan tetap ERP. |
| `ai-scribe` | Reaktif & scope dikurangi (ADR 0021) | Justru peluang terbesar untuk prinsip #4 (AI proaktif) | Perluasan langsung: ringkasan mingguan, ringkasan harian lapangan, analisis keterlambatan, prediksi risiko, draft update klien, ringkasan eksekutif, insight QC — semua sebagai draft yang direview manusia (hukum AI di CLAUDE.md §9 tidak berubah, hanya cakupannya bertambah). |

**Pola yang konsisten muncul**: modul yang murni ERP (`procurement`, `estimating`, `partner-desk`) tidak perlu diubah — mereka *seharusnya* tetap ERP dan tersembunyi dari klien (itu justru menjaga D2.6). Modul yang bermasalah adalah yang **secara substansi trust-critical tapi tampil sebagai ERP** (`cash-gate`, `quality-gate`, `billing`) — solusinya bukan mengubah modul itu sendiri, tapi membangun lapisan penerjemah (Confidence Score, evidence linking, bahasa linimasa) yang menyaring sinyal trust-nya ke permukaan klien tanpa membocorkan detail internal yang memang harus tetap tersembunyi.

---

## 7. Yang TIDAK berubah

- D1–D10 tetap terkunci.
- Tidak ada tabel yang di-drop atau modul yang kehilangan kepemilikan data.
- Pola `safeAction`, `ActionResult`, audit dua-kanal, RLS-per-tabel — semua dipertahankan penuh; Evidence dan Trust Score dibangun *mengikuti* pola ini, bukan menggantinya.
- Build Sequence tetap berlaku — ADR ini mengusulkan kerja sebagai Fase 12 setelah Fase 11 (Partner Desk) benar-benar tuntas, bukan menyela fase yang sedang berjalan.
