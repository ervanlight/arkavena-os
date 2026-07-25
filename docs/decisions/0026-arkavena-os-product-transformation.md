# ADR 0026 — Arkavena OS product transformation: Client Status, Evidence visibility, module classification

**Status:** Accepted — kelima keputusan terbuka di §7 sudah tuntas (lihat catatan di §7). Fase 12 boleh berjalan.
**Date:** 2026-07-25 (Revisi 2, hari yang sama dengan Revisi 1)
**Trigger:** Instruksi eksplisit Owner untuk mengevaluasi ulang arsitektur produk sebagai "Trust Operating System" — lalu, di hari yang sama, koreksi arah eksplisit: Arkavena OS bukan sistem monitoring klien atau dashboard transparansi, melainkan alat yang mengurangi kecemasan klien **sambil melindungi kebebasan operasional Arkavena**.

Dokumen pendamping: [PRODUCT.md](../../PRODUCT.md) (mission/vision/prinsip, sudah direvisi mengikuti ADR ini).

---

## 0. Riwayat revisi — dicatat visibel, tidak dihapus diam-diam

**Revisi 1** (dokumen asli, hari yang sama) mengusulkan **Project Confidence Score**: skor numerik 0–100 dari 8 sinyal berbobot, ditampilkan ke klien sebagai north star metric.

**Revisi 2 (ini) membatalkan pendekatan itu sepenuhnya**, atas keputusan Owner secara eksplisit:

> Skor numerik mengundang diskusi yang tidak perlu dan mendorong klien menghakimi performa operasional tanpa memahami realita konstruksi. Metrik internal boleh tetap ada untuk tim Arkavena, tapi tidak boleh menjadi pengalaman utama klien.

**Apa yang berubah:**
- `modules/trust-score` dan seluruh §2 (arsitektur Confidence Score) di Revisi 1 **dibatalkan** — tidak dibangun.
- Digantikan oleh **Client Project Status**: 5 kondisi berbahasa manusia + penjelasan singkat, tanpa angka apa pun (§2 baru di dokumen ini).
- Domain Evidence (Revisi 1 §3) **dipertahankan**, tapi diperkaya dengan **tingkat visibilitas per-record** — karena "evidence exists primarily for accountability, client visibility is selective" (§3 baru).
- Reframing Client Portal (Revisi 1 §4) **dipertahankan dan diperjelas** menjadi Client Timeline dengan struktur konkret (§4 baru).
- Audit modul (Revisi 1 §6, klasifikasi "ERP vs Trust-centric") **diganti total** dengan klasifikasi 4 kategori yang lebih tajam dan actionable: Internal Only / Internal + Management / Client Visible / Client Decision Required (§5 baru).

**Kenapa dicatat begini, bukan file dihapus dan ditulis ulang tanpa jejak**: ADR ini masih berstatus PROPOSED (belum Accepted, belum ada kode dibangun di atasnya) — jadi secara teknis boleh diedit bebas. Tapi karena PRODUCT.md Revisi 1 sempat di-commit dan di-push sebagai dokumen resmi, riwayat ini dicatat supaya siapa pun yang membaca commit history paham *kenapa* arah berubah dalam hari yang sama, bukan cuma melihat file berbeda tanpa konteks.

---

## 1. Ringkasan keputusan yang diusulkan (Revisi 2)

1. **Tidak ada skor numerik untuk klien** — dibatalkan total, lihat §0.
2. **Client Project Status** — 5 kondisi berbahasa manusia + penjelasan naratif, dikurasi manusia (dengan bantuan draft AI), bukan dihitung otomatis dari formula (§2).
3. **Evidence tetap dibangun sebagai domain**, dengan tambahan penting: **tingkat visibilitas per-record** (Internal Only / Internal + Management / Visible to Client / Visible After Approval) — evidence untuk akuntabilitas dulu, visibilitas klien itu keputusan sadar per item (§3).
4. **Client Timeline** menggantikan struktur tab lama — beranda klien berbentuk jurnal (Hari Ini / Minggu Ini / Akan Datang / Menunggu Anda / Update Terbaru), bukan dashboard (§4).
5. **Klasifikasi 4 kategori untuk setiap modul** — Internal Only / Internal + Management / Client Visible / Client Decision Required, dengan alasan eksplisit (§5).
6. **Peran AI diperjelas**: mengurangi kerja komunikasi manual (draft ringkasan/penjelasan), **tidak pernah** menghasilkan skor, persentase risiko, atau rating (§7).

Tidak ada satu pun dari ini yang mengubah D1–D10 (ARCHITECTURE.md §9). Tidak ada tabel lama yang di-drop. Tidak ada modul yang pindah kepemilikan tabel.

---

## 2. Client Project Status — pengganti Confidence Score

### 2.1 Prinsip

Status proyek yang dilihat klien **bukan hasil formula otomatis**. Ini keputusan editorial manusia (dengan bantuan draft AI), persis karena menerjemahkan realita operasional menjadi ketenangan klien butuh penilaian — sistem otomatis yang langsung mengubah status begitu satu angka internal berubah adalah versi lain dari "skor" yang justru ingin dihindari (contoh: Cash Gate sempat kuning selama sehari lalu pulih — klien tidak perlu tahu itu terjadi sama sekali kalau tidak berdampak nyata ke mereka).

### 2.2 Lima kondisi

| Status | Kapan dipakai | Contoh kalimat penjelasan |
|---|---|---|
| **Berjalan Normal** | Tidak ada yang perlu diketahui klien saat ini | *(biasanya tanpa penjelasan tambahan — keadaan default yang tenang)* |
| **Menunggu Keputusan Anda** | Ada `client_decision` berstatus pending yang genuinely butuh input klien | "Pemilihan meja dapur sedang menunggu konfirmasi Anda." |
| **Menunggu Pihak Eksternal** | Delay yang sumbernya di luar kendali langsung tim (cuaca, izin, pengiriman vendor) | "Produksi kabinet dapur sudah dimulai. Pemasangan dijadwalkan minggu depan." |
| **Penyesuaian Jadwal** | Ada pergeseran target, tapi terkendali/dijelaskan | "Hujan deras menunda pekerjaan cor selama dua hari. Target penyelesaian saat ini tidak berubah." |
| **Selesai** | Proyek sudah handover | — |

Setiap status **wajib** disertai kalimat penjelasan singkat (1–2 kalimat), bukan status kosong — status tanpa penjelasan terasa seperti label administratif, bukan komunikasi manusia.

### 2.3 Implementasi teknis

Dimiliki `modules/client-portal` (bukan modul baru — ini genuinely bagian dari permukaan klien yang sudah dimiliki modul itu):

```
modules/client-portal/
  types.ts                          # + ClientProjectStatus enum, ClientStatusUpdate row type
  data/
    client-status-repository.ts     # baca/tulis client_status_updates
  actions/
    publish-client-status-action.ts # staff action: pilih status + tulis/edit penjelasan, publish
    get-current-client-status-action.ts
```

Migration baru: `client_status_updates(id, organization_id, project_id, status client_project_status, headline text, detail text, published_by uuid references users, published_at timestamptz, created_at, updated_at)` — RLS: staff menulis, klien membaca via `vw_client_project_status` (hanya baris terbaru per proyek + field yang memang untuk klien).

**AI membantu menulis draft** `headline`/`detail` dari sinyal internal (mis. cuaca dari daily log, delay flag dari `ai-scribe`, milestone yang baru pindah tahap) — tapi publikasi selalu aksi manusia (`published_by` wajib terisi, tidak pernah `system`). Ini konsisten dengan hukum AI di CLAUDE.md §9: AI menghasilkan draft, manusia menyimpan lewat action modul pemilik yang sudah ada.

### 2.4 Yang secara sadar TIDAK dibangun

- Tidak ada kolom skor/persentase di `client_status_updates`.
- Tidak ada logic yang otomatis mengubah status tanpa staf mempublikasikannya — bahkan kalau semua sinyal internal (cash gate, QC, issues) berubah, status klien **tidak bergerak** sampai staf secara sadar memutuskan itu relevan diketahui klien. Ini bukan celah, ini **fitur** — persis prinsip "does this help the client decide."

---

## 3. Domain Evidence — akuntabilitas dulu, visibilitas klien itu pilihan

### 3.1 Hierarki (tidak berubah dari Revisi 1)

```
Project → Milestone → Activity (konsep logis) → Evidence → Approval → Knowledge (Fase lanjutan)
```

Alasan "Activity" tetap konsep logis, bukan tabel baru, dan alasan `evidence` sebagai lapisan indeks lintas-modul (bukan pengganti `photos`) — **tidak berubah dari Revisi 1**, tetap berlaku penuh (lihat riwayat commit ADR ini untuk detail penalaran itu kalau dibutuhkan).

### 3.2 Yang BARU di Revisi 2: `visibility` sebagai kolom wajib

```sql
create type evidence_visibility as enum (
  'internal_only',        -- default. staf mana pun (org role apa pun) bisa lihat.
  'internal_management',  -- staf tier manajemen saja (owner, technical_director, finance).
  'client_visible',       -- langsung tampil di Client Timeline begitu dibuat.
  'visible_after_approval' -- tersembunyi dari klien sampai sebuah Approval (§3.3) membukanya.
);

create table evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  project_id uuid not null references projects(id),
  activity_table text not null,
  activity_id uuid not null,
  evidence_type evidence_type not null,         -- 'photo' | 'video' | 'document'
  visibility evidence_visibility not null default 'internal_only',
  storage_path text not null,
  thumbnail_path text,
  captured_at timestamptz not null default now(),
  gps_lat double precision,
  gps_lng double precision,
  qc_result evidence_qc_result,                 -- 'pass' | 'fail' | 'not_applicable', nullable
  responsible_user_id uuid not null references users(id),
  notes text,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
```

**Default-nya `internal_only`** — evidence baru tidak otomatis terlihat klien. Menaikkan visibilitas adalah keputusan sadar (staf memilih saat upload, atau mengubahnya kemudian), bukan opt-out. Ini menegakkan prinsip produk "klien tidak perlu tahu semuanya" secara struktural di skema, bukan cuma di UI.

### 3.3 `visible_after_approval` — Approval sebagai gerbang visibilitas, bukan cuma gerbang status

Ini pengayaan baru terhadap hierarki: **Approval** (tahap ke-5 di hierarki) sekarang punya dua fungsi berbeda yang keduanya valid:
1. Fungsi lama: menyetujui aktivitas itu sendiri (inspeksi lulus, klien approve variation).
2. Fungsi baru: **membuka visibilitas evidence yang menunggu** — mis. foto before/after ditahan (`visible_after_approval`) sampai QC menyetujui hasil pekerjaan, baru muncul di Client Timeline sebagai satu paket "before → sesudah diperiksa → sesudah" yang meyakinkan, bukan foto mentah yang bisa disalahpahami sebelum benar-benar selesai.

Tidak butuh tabel approval baru — perubahan status `evidence.visibility` dari `visible_after_approval` ke `client_visible` terjadi sebagai efek samping dari action approval yang **sudah ada** (mis. `recordInspectionResultAction` di `quality-gate`, atau `clientApproveChangeOrderAction`), dipanggil lewat `evidence`'s public API (`modules/evidence` mengekspos `releaseEvidenceAction`, dipanggil dari modul lain yang mengalami approval-nya sendiri — bukan modul lain menulis langsung ke tabel `evidence`, tetap menghormati satu-tabel-satu-modul).

### 3.4 Evidence-gating pada completion — tetap diusulkan, dengan catatan

Prinsip "status tanpa evidence dianggap belum selesai" (PRODUCT.md prinsip #2 versi lama, sekarang jadi bagian dari akuntabilitas internal) tetap diusulkan, ditegakkan dua lapis (domain + trigger DB) seperti Cash Gate/Quality Gate — **tapi ini murni soal disiplin internal (Internal Only/Internal+Management), sama sekali tidak tentang mengekspos apa pun ke klien.** Evidence yang mengunci completion tidak perlu berstatus `client_visible` — foto dokumentasi rutin cukup `internal_only`, tetap menegakkan akuntabilitas tanpa membanjiri klien. Ini keputusan Owner terpisah (§6.2), tidak berubah substansinya dari Revisi 1.

### 3.5 Knowledge — tidak berubah dari Revisi 1

Tetap diusulkan sebagai Fase 13+, tidak masuk rencana kerja Fase 12. Lihat Revisi 1 untuk detail (dipertahankan, tidak perlu ditulis ulang di sini).

---

## 4. Client Timeline — beranda klien

### 4.1 Struktur (menggantikan tab Ringkasan/Timeline/Zona/Foto/Keputusan)

```
┌─────────────────────────────────────┐
│  [Client Project Status saat ini]    │  ← §2, selalu di atas, 1-2 kalimat
├─────────────────────────────────────┤
│  Menunggu Anda                       │  ← client_decisions pending, bahasa awam
├─────────────────────────────────────┤
│  Hari Ini                            │  ← evidence client_visible hari ini + status update baru
├─────────────────────────────────────┤
│  Minggu Ini                          │  ← ringkasan naratif (bisa draft AI), evidence minggu berjalan
├─────────────────────────────────────┤
│  Akan Datang                         │  ← milestone/work package terjadwal, diterjemahkan
│                                       │     ("Pemasangan kabinet dapur minggu depan")
├─────────────────────────────────────┤
│  Update Terbaru                      │  ← linimasa kronologis mundur, evidence + status history
└─────────────────────────────────────┘
```

### 4.2 Sumber data per bagian (semua lewat public API modul pemilik, tidak ada query lintas-modul langsung)

- **Menunggu Anda**: `client-portal.listPendingClientDecisionsAction` (sudah ada) — judul teknis (`change_order.title`) **tidak** ditampilkan mentah; ditambahkan field baru `client_summary` (opsional) di `client_decisions` untuk kalimat awam yang staf isi saat mempresentasikan keputusan ("Pemilihan meja dapur menunggu konfirmasi Anda") — fallback ke template generik kalau kosong, tidak pernah menampilkan judul internal.
- **Hari Ini / Update Terbaru**: `evidence` dengan `visibility IN ('client_visible')` (setelah difilter RLS/view klien), digabung dengan `client_status_updates` (§2).
- **Minggu Ini**: bisa berisi narasi hasil draft AI (§7) yang staf setujui — tidak wajib evidence terlampir, boleh murni teks ("Tim mulai finishing dinding kamar utama minggu ini").
- **Akan Datang**: `projects.listWorkPackagesForProjectAction`/milestone yang statusnya belum mulai tapi terjadwal dekat — diterjemahkan lewat lapisan presentasi (mis. nama paket kerja teknis → kalimat awam), **tanpa tanggal pasti kalau berisiko meleset** (cukup "minggu depan", bukan tanggal presisi yang bisa terasa seperti janji kaku).

### 4.3 Yang TIDAK ada di beranda ini

Tidak ada angka isu terbuka, tidak ada rasio kas, tidak ada progress bar persentase generik, tidak ada tabel/daftar module teknis apa pun. Kalau sebuah data butuh terjemahan lebih dari satu kalimat untuk masuk akal ke klien, itu sinyal data itu **tidak seharusnya** ada di sini (lihat §5 untuk klasifikasi per modul).

---

## 5. Klasifikasi modul: Internal Only / Internal + Management / Client Visible / Client Decision Required

**Definisi kategori:**
- **Internal Only** — staf mana pun (role organisasi apa pun) boleh akses; klien tidak pernah melihat apa pun dari modul ini, bahkan tidak tahu modul ini ada.
- **Internal + Management** — dibatasi ke tier manajemen (owner, technical_director, finance) bahkan di antara staf; substansinya trust-critical tapi kompleksitasnya justru yang dibayar klien supaya tidak perlu mereka pikirkan.
- **Client Visible** — muncul di Client Timeline, selalu dalam bentuk sudah diterjemahkan (bahasa awam), tidak pernah sebagai cermin modul internal.
- **Client Decision Required** — klien harus bertindak (approve/reject/pilih/konfirmasi); ini kategori paling langka secara sengaja, karena setiap butir di sini menambah beban keputusan klien.

| Modul | Klasifikasi | Kenapa |
|---|---|---|
| `crm` | **Internal Only** | Skor lead, tahap pipeline, catatan sales adalah mekanisme internal Arkavena mendapatkan klien — tidak membantu klien (yang sudah jadi klien) memutuskan apa pun. |
| `assessment` | **Internal Only** (proses) / **Client Decision Required** (laporan hasil) | Proses skoring/checklist internal murni internal. Tapi laporan assessment yang diterima calon klien adalah momen mereka memutuskan lanjut atau tidak — itu artefak keputusan, bukan sekadar laporan yang dibaca. |
| `projects` | **Internal + Management** | Data mentah zona/kontrak/paket kerja adalah alat operasional tim menjalankan proyek. Klien tidak perlu tahu ada 40 paket kerja dengan status masing-masing — cukup terjemahan yang muncul di Client Timeline. |
| `cash-gate` | **Internal + Management** | Ini persis kompleksitas yang klien bayar Arkavena untuk menyerapnya. Rasio kas, cadangan risiko, status gate mentah tidak pernah membantu klien memutuskan apa pun — malah berisiko mereka menghakimi keputusan finansial teknis tanpa konteks penuh. Yang sampai ke klien hanya lewat Client Project Status, kalau memang relevan ("pendanaan mencukupi untuk tahap ini") — dan itu pun cuma kalau staf memutuskan itu perlu dikatakan. |
| `scope-variation` | **Client Decision Required** (titik approval) / **Internal + Management** (mekanisme) | Variation genuinely butuh keputusan klien (mengubah biaya/desain) — tapi disajikan sebagai pertanyaan bisnis sederhana ("pemilihan meja dapur menunggu konfirmasi"), bukan "Variation Request #24" dengan tabel dampak biaya. Nomor, state machine, dan cost impact tetap Internal + Management. |
| `field-reporting` | **Internal Only** | SiteFlow, daily log, permintaan material, issue — ini pabrik data operasional harian. Tidak satu pun perlu dilihat klien apa adanya; ini murni bahan baku bagi Evidence dan Client Status, bukan permukaan klien itu sendiri. |
| `quality-gate` | **Internal + Management** | Hold point, nonconformity, hasil inspeksi adalah *tepat* jenis kompleksitas yang klien serahkan ke Arkavena. Klien tidak perlu tahu detail "Hold Point Pending" — paling jauh, dampaknya terasa sebagai kalimat singkat di linimasa kalau memang menyebabkan penyesuaian jadwal. |
| `client-portal` | **Client Visible** & **Client Decision Required** | Ini secara definisi permukaan klien — sekarang direstrukturisasi jadi Client Timeline (§4) alih-alih tab admin-style. |
| `billing` | **Internal + Management** (mekanisme) / **Client Visible** terbatas (tagihan yang jatuh tempo) | Aging dashboard, DSO, analitik koleksi murni internal. Tapi "ada tagihan yang perlu dibayar, jatuh tempo tanggal X" adalah informasi yang genuinely relevan buat klien bertindak — itu satu-satunya irisan billing yang boleh muncul di Client Timeline, dan hanya sebagai notifikasi sederhana, bukan laporan aging. |
| `estimating` | **Client Decision Required** (titik terima/tolak proposal) / **Internal Only** (mekanisme — margin, harga beli, breakdown biaya) — *diamendemen 2026-07-25 saat implementasi F1, lihat §7 item 6* | Margin, harga beli, breakdown biaya internal tetap dilindungi secara struktural (D2.6), tidak berubah. Tapi momen klien menerima/menolak proposal genuinely butuh keputusan klien — pola identik `scope-variation`'s split (baris di atas): `proposals.status`/`decided_at`/`decided_by`/`decision_reason` jadi permukaan keputusan sempit dengan RLS client-scoped + `client_summary` (kalimat awam, bukan judul/breakdown internal), sementara `estimates`/`estimate_items`/`cost_library` tetap 100% Internal Only tanpa perubahan apa pun. |
| `procurement` | **Internal Only** | RFQ, perbandingan quote vendor, PO — seratus persen urusan operasional Arkavena. Kalau ada nilai untuk klien, itu cuma "material sudah tiba di lokasi" — dan itu representasinya lewat evidence `client_visible`, bukan lewat modul ini secara langsung. |
| `maintenance-engine` | **Internal + Management** (perencanaan aset) / **Client Visible** (info garansi & status tiket servis milik klien) / **Client Decision Required** (jadwalkan kunjungan servis) | Facility Passport dan rencana pemeliharaan internal murni operasional. Tapi status garansi rumah mereka dan tiket servis yang *mereka* laporkan genuinely perlu klien tahu — dan menjadwalkan waktu kunjungan teknisi genuinely butuh konfirmasi mereka. |
| `partner-desk` | **Internal Only** | Modul B2B ke supplier/subkontraktor — di luar hubungan klien sepenuhnya, bukan soal disembunyikan, memang bukan bagian dari pengalaman klien sama sekali. |
| `ai-scribe` | **Internal Only** (sebagai modul) | Alat drafting staf — prompt, draft, log biaya tidak pernah dilihat klien. Keluarannya (setelah disetujui staf) bisa menjadi konten Client Visible lewat `client-portal`/Client Timeline, tapi modul `ai-scribe` itu sendiri tidak pernah jadi permukaan klien. |
| `evidence` (domain baru) | **Bervariasi per baris** (lihat §3.2) | Satu-satunya domain yang klasifikasinya bukan di level modul, melainkan di level record (`visibility` enum) — karena tujuan intinya justru memisahkan "evidence untuk akuntabilitas" (mayoritas, Internal Only/Internal+Management) dari "evidence untuk ketenangan klien" (minoritas yang sengaja dipilih, Client Visible/Visible After Approval). |
| ~~`trust-score`~~ | **Dibatalkan** | Lihat §0 — tidak dibangun. Kebutuhan visibilitas kesehatan proyek untuk staf (Owner/TD/Finance) sudah terlayani oleh dashboard Command Center yang ada (`/cc`, kartu proyek + strip "Perlu perhatian", dibangun Pillar 2) — **Internal + Management**, tidak pernah jadi angka yang ditampilkan ke klien. |

**Pola yang konsisten:** hampir semua modul teknis inti (cash-gate, quality-gate, procurement, estimating, field-reporting) memang seharusnya **Internal Only** atau **Internal + Management** — ini bukan kekurangan, ini justru produk yang bekerja sesuai mission-nya (klien tidak perlu jadi manajer proyek). Satu-satunya kategori yang butuh perhatian desain aktif adalah **Client Visible** dan **Client Decision Required** — dan keduanya sekarang punya rumah yang jelas: Client Timeline (§4) dan mekanisme visibilitas Evidence (§3.2).

---

## 6. Peran AI — diperjelas, bukan diperluas tanpa batas

Sesuai instruksi: AI mengurangi kerja komunikasi manual, **tidak pernah menghasilkan skor, persentase risiko, atau kepastian buatan.**

**Dibangun sebagai draft (direview manusia, hukum AI CLAUDE.md §9 tidak berubah):**
- Update Klien Mingguan (draft `client_status_updates`/ringkasan Minggu Ini)
- Ringkasan Harian Lapangan (untuk konsumsi internal — staf memutuskan mana yang layak diringkas jadi Client Visible)
- Ringkasan Rapat
- Pengingat Approval (untuk staf: "3 keputusan klien menunggu > 5 hari, pertimbangkan follow-up") — **bukan** untuk klien
- Ringkasan Progres (bahan draft entri "Minggu Ini"/"Akan Datang")
- Penjelasan Keterlambatan (draft kalimat untuk status "Penyesuaian Jadwal"/"Menunggu Pihak Eksternal")

**Secara eksplisit TIDAK dibangun:**
- Skor risiko/prediksi persentase apa pun (mis. "80% kemungkinan selesai tepat waktu") — ini persis jenis kepastian buatan yang dilarang prinsip produk.
- AI tidak pernah mempublikasikan langsung ke klien — `published_by` di `client_status_updates` selalu user staf, tidak pernah proses otomatis.

`ai-scribe`'s delay-detection yang sudah ada (Fase 10) tetap boleh dipakai **secara internal** untuk membantu staf memutuskan kapan status "Penyesuaian Jadwal" relevan dipublikasikan — tapi keluarannya tidak pernah berupa angka/persentase yang sampai ke klien, hanya sinyal internal yang memicu staf menulis (dibantu draft AI) kalimat manusia.

---

## 7. Keputusan yang dibutuhkan Owner sebelum implementasi — status akhir

Kelima keputusan berikut sudah tuntas, dicatat di sini untuk jejak audit:

1. **Definisi tier "Management"** — **Resolved, [ADR 0028](0028-fase12-project-status-gating-and-management-tier.md) Keputusan 2.** Label dokumentasi visibilitas klien (owner, technical_director, finance), bukan tier permission yang ditegakkan kode — `core/permissions/matrix.ts` tidak berubah.
2. **Default visibility Evidence** — **Resolved.** `internal_only` sebagai default dikonfirmasi tanpa keberatan; desain [ADR 0029](0029-evidence-domain-open-decisions.md) dibangun di atas default ini tanpa perubahan.
3. **Siapa yang berwenang mempublikasikan Client Project Status** — **Resolved, saat penyelarasan dokumen ini (2026-07-25).** Owner + Technical Director — dua role yang sama dipercaya untuk kontrol paling sensitif lainnya (Cash Gate override, Quality Gate override), memastikan nada komunikasi ke klien tetap konsisten. Finance sengaja tidak diikutkan (Finance mengelola kas, bukan hubungan klien, per `PRODUCT.md` Target Users). Diterapkan sebagai entri permission-matrix baru (`client_status.publish`, `['owner', 'technical_director']`) saat F5 dibangun.
4. **Evidence-gating completion** — **Resolved, [ADR 0029](0029-evidence-domain-open-decisions.md) Keputusan 1.** Hard block, dibatasi ke milestone client-facing, override oleh Technical Director (bukan Owner — amandemen dari draf awal ADR 0029 setelah design review).
5. **Timing Fase 12** relatif terhadap Fase 11 — **Resolved by direction.** Owner sudah mengarahkan berulang kali secara eksplisit untuk melanjutkan Fase 12 sekarang (sesi 2026-07-25) — pola yang sama seperti ADR 0023 meng-override volume gate ADR 0022: kondisi Fase 11 (pre-launch checklist belum sepenuhnya tuntas) tidak berubah, tapi Owner sadar memutuskan tidak menunggu.
6. **(Amandemen, bukan bagian dari lima keputusan asli) Klasifikasi `estimating` vs F1** — ditemukan konflik nyata saat mengimplementasikan F1 (`IMPLEMENTATION_PRIORITIES.md`'s "client-facing proposal acceptance path", milestone 2.3): dokumen itu meminta RLS client-facing langsung di `proposals`, sementara §5 di atas (sebelum amandemen ini) mengklasifikasikan seluruh `estimating` sebagai Internal Only dan secara eksplisit bilang keputusan klien terjadi lewat `assessment`/kontrak, bukan `proposals`. Dihentikan dan ditanyakan ke Owner (2026-07-25); **Owner memilih: klien memutuskan langsung di `proposals`**, dengan `estimating` diamendemen memakai split yang sama seperti `scope-variation` (Client Decision Required di titik approval / Internal Only untuk mekanisme) — lihat baris `estimating` di §5, sudah diperbarui.
7. **(Amandemen, koreksi implementasi pasca-review) Boundary fix untuk F1 (C1) dan F2 (C2)** — Post-Implementation Review Phase 2 (2026-07-25) menemukan bahwa implementasi F1 melanggar aturan `ARCHITECTURE.md` 1.2 (F25): client-portal (baik app route maupun modulnya sendiri) mengimpor `@/modules/estimating` secara langsung (`getProposalAction`, `listProposalsForProjectAction`, `clientDecideProposalAction`) — pelanggaran yang persis diprediksi `ARCHITECTURE_REVIEW.md`'s catatan asal aturan itu sendiri. Owner diminta memilih antara mempertahankan F25 secara absolut (implementasi menyesuaikan) atau mengamandemen F25 dengan pengecualian sempit; **Owner memilih mempertahankan F25 secara absolut** — keputusan klasifikasi §5's item 6 di atas (proposals = Client Decision Required) tetap berlaku, tapi *mekanisme* aksesnya diperbaiki: `client_decisions.proposal_id` (kolom baru, mirroring `change_order_id` persis) + `fn_proposals_sync_client_decision` menggantikan pembacaan `proposals` langsung; `fn_client_decide_proposal` (RPC database, bukan impor TypeScript) menggantikan `clientDecideProposalAction` yang sebelumnya hidup di `modules/estimating`. Review yang sama menemukan C2: halaman `/variations/[id]/approve` masih menampilkan `title`/`description`/`cost_impact_amount`/`schedule_impact_days` mentah, langsung bertentangan dengan kalimat eksplisit §5's baris `scope-variation` ("bukan 'Variation Request #24' dengan tabel dampak biaya") — diperbaiki dengan `change_orders.client_summary` (sudah ada, belum pernah dipakai di halaman itu). Detail teknis lengkap di `docs/rls-matrix.md` (bagian "Post-implementation review fix") dan `docs/client-visibility-matrix.md`.

Kelima keputusan asli plus kedua amandemen di atas tuntas — status ADR ini **Accepted**.

---

## 8. Yang TIDAK berubah

- D1–D10 tetap terkunci.
- Tidak ada tabel yang di-drop atau modul yang kehilangan kepemilikan data.
- Pola `safeAction`, `ActionResult`, audit dua-kanal, RLS-per-tabel — semua dipertahankan penuh; Evidence dan Client Status dibangun *mengikuti* pola ini, bukan menggantinya.
- Build Sequence tetap berlaku — ADR ini mengusulkan kerja sebagai Fase 12 setelah Fase 11 (Partner Desk) benar-benar tuntas, bukan menyela fase yang sedang berjalan.
