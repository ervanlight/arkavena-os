# Pre-launch checklist — utang yang WAJIB direview sebelum deploy ke klien/pilot sungguhan

Ini bukan daftar tugas teknis biasa (itu ada di ARCHITECTURE.md §7's Build
Sequence dan di ADR masing-masing fase). Ini daftar **keputusan yang sengaja
ditunda** dan **validasi yang sengaja di-skip** selama seluruh proses build —
setiap satunya adalah sesuatu yang *bisa* menyakiti pengguna nyata (klien,
partner, mandor) kalau lolos tanpa direview. CI hijau tidak berarti item di
bawah ini selesai; item-item ini secara definisi tidak bisa diverifikasi oleh
CI.

**Tidak ada item di sini yang boleh dihapus dengan cara ditandai selesai oleh
sesi Claude Code mana pun.** Hanya Owner yang menutup item di daftar ini,
dengan keputusan eksplisit atau hasil uji nyata — bukan dengan "sudah dicek
dan sepertinya aman."

---

## 1. ADR 0015 — potensi pesan error mentah bocor ke klien portal

**Status:** menunggu konfirmasi/keputusan Owner lebih lanjut. Ini BUKAN
tentang keputusan ADR 0015 itu sendiri (yang sudah confirmed dan
diimplementasikan — repositori kini melempar error Postgrest mentah, bukan
`InfraError` yang membungkusnya, supaya pesan `hint` dari trigger bisa sampai
ke pengguna). Ini tentang **konsekuensi lanjutan** dari keputusan itu yang
belum pernah dianalisis untuk jalur klien portal secara spesifik.

**Ringkasan risiko:**

- Setiap `safeAction` (`core/actions/safe-action.ts`) memanggil `asAppError()`
  lalu `toActionResult()` dengan pipeline yang **sama persis** untuk aksi yang
  dipanggil dari Command Center (staf internal) maupun dari client-portal
  (klien eksternal) — tidak ada percabangan berdasarkan siapa pemanggilnya.
- Untuk error yang berasal dari trigger DB dengan `hint` terisi (mis.
  `fn_work_packages_guard_hold_point`, `fn_work_packages_guard_cash_gate`,
  guard transisi `change_orders`), `asAppError` sengaja meneruskan teks
  `hint` itu **verbatim** sebagai pesan yang dilihat pengguna (`handle.ts`,
  komentar: "the message itself is already user-safe Indonesian text").
  Ini benar untuk pembaca staf internal — teks itu ditulis dengan asumsi
  pembacanya paham istilah seperti "hold point", "cash gate", "termin".
- **Belum pernah dianalisis:** apakah ada jalur aksi yang bisa dipanggil dari
  client-portal yang menyentuh salah satu trigger berhint ini. Kalau ada,
  klien eksternal akan melihat pesan teknis internal yang tidak ditulis untuk
  mereka — bukan kebocoran data (tidak ada nominal/nama pihak lain yang
  bocor), tapi kebocoran istilah/proses internal yang seharusnya tidak perlu
  diketahui klien.

**Yang perlu terjadi sebelum ini ditutup:**
1. Audit semua action yang bisa dipanggil dari `(client-portal)` — daftar
   lengkap trigger berhint yang bisa mereka pengaruhi.
2. Owner memutuskan: apakah cukup aman dibiarkan begini (karena tidak ada
   jalur client-portal yang menyentuh trigger-trigger itu), atau perlu
   percabangan eksplisit (mis. `safeAction` diberi tahu "caller ini eksternal,
   jangan pernah pakai `hint` verbatim, selalu jatuh ke pesan generik").

**Update 2026-07-23 (audit selesai + percabangan diimplementasikan, atas
instruksi Owner "temukan bug dan fix"):**

- Hasil audit: jalur bocor NYATA ada. `clientApproveChangeOrderAction` dan
  `clientRejectChangeOrderAction` (`modules/scope-variation/actions/
  client-decision-actions.ts`) dipanggil dari
  `(client-portal)/variations/[id]/approve` dan menulis ke `change_orders`,
  yang dijaga trigger ber-hint (guard transisi + guard kolom klien). Pada
  race/double-submit, pesan trigger berbahasa staf sampai verbatim ke klien.
  Semua action client-portal dan partner-desk lain read-only, tapi tetap bisa
  memunculkan pesan infra/RLS.
- Perbaikan yang masuk: `safeAction` kini menerima `audience: 'external'`;
  untuk audiens eksternal setiap pesan selain validasi input field-level
  jatuh ke teks katalog `ERROR_MESSAGES_ID` (kode error tetap), dan
  `blockedReasons` di-drop. 11 action eksternal ditandai (6 client-portal,
  3 partner-desk, 2 client-decision scope-variation). Unit test di
  `core/errors/handle.test.ts`.
- Belum ada penegakan otomatis bahwa action eksternal BARU wajib menandai
  `audience: 'external'` — masih konvensi. Kandidat: check di
  `scripts/verify-boundaries.ts` (import graph route-group eksternal →
  actions). Diserahkan ke sesi berikutnya.
- Status: tinggal keputusan formal Owner untuk MENUTUP item ini (aturan file
  ini: hanya Owner yang menutup).

---

## 2. CHECKPOINT #3 — uji lapangan magic link (Fase 4) belum divalidasi

**Status:** di-skip, belum divalidasi. Tidak bisa divalidasi oleh sesi
Claude Code mana pun — checkpoint ini secara eksplisit meminta uji lapangan
dengan mandor sungguhan.

**Ringkasan risiko** (ARCHITECTURE.md, D4 §9, baris 668):

> "Mandor wajib punya alamat email yang bisa dibuka di HP — ini **risiko
> adopsi lapangan yang diterima secara sadar** dan diuji langsung di
> CHECKPOINT #3 (uji lapangan Fase 4). Kalau di uji lapangan magic link
> terbukti menghambat, itu jadi revisi arsitektur, bukan tambal-sulam."

Auth magic-link (D4) dipilih untuk semua role termasuk lapangan, menggantikan
rencana awal HP+OTP, murni karena OTP berbayar per pesan. Ini asumsi yang
belum pernah diuji dengan mandor sungguhan di kondisi nyata: sinyal lemah di
lokasi proyek, HP lama/spek rendah, kebiasaan mandor membuka email di HP
(vs. WhatsApp yang jauh lebih umum dipakai), dan literasi digital yang
bervariasi.

**Yang perlu terjadi sebelum ini ditutup:**
1. Uji lapangan sungguhan: minimal satu mandor/koordinator lokasi nyata
   mencoba alur magic-link end-to-end di lokasi proyek nyata (bukan kantor,
   bukan wifi kantor).
2. Kalau magic-link terbukti menghambat adopsi: ini eksplisit **revisi
   arsitektur** (D4), bukan tambal-sulam UI — kembali ke ARCHITECTURE.md §9
   dan tulis ADR baru sebelum mengubah kode auth.

---

## 3. Fase 10 — voice-note dan draft weekly report (ADR 0021)

**Status:** ditunda secara formal (bukan bug, bukan lupa) — dicatat di sini
supaya tetap terlihat sebagai utang scope, bukan hanya terkubur di ADR.

- **Voice-note → draft daily report**: belum ada keputusan vendor
  speech-to-text (Claude tidak mentranskripsi audio). CHECKPOINT #5
  ("review kualitas draft AI vs voice note nyata berbahasa campuran
  Indonesia/Jawa dari lapangan") melekat pada fitur ini dan **tidak bisa
  lulus tanpa fitur ini ada**. Sebelum pilot lapangan sungguhan mengklaim
  Fase 10 "lengkap", ini harus diputuskan: bangun (perlu vendor STT dipilih
  Owner) atau resmi dicoret dari cakupan produk.
- **Draft weekly report**: halaman client-portal laporan mingguan belum
  punya jalur review staf sama sekali sebelum konten sampai ke klien.
  Menambahkan draft AI di sana tanpa jalur review adalah pelanggaran
  struktural CLAUDE.md §9 ("output AI selalu draft, manusia menyimpan"),
  bukan cuma risiko kecil. Perlu desain jalur review/simpan dulu.

**Yang perlu terjadi sebelum ini ditutup:** lihat
[ADR 0021](decisions/0021-fase10-scope-reduction-voice-note-and-weekly-report-deferred.md)
Consequences section — masing-masing perlu ADR follow-up sendiri saat Owner
siap memutuskan.

---

## 4. Fase 11 — subcontractor Desk dan notifikasi WA API (ADR 0024)

**Status:** ditunda secara formal, sama seperti item Fase 10 di atas.

- **Subcontractor Desk**: hanya sisi supplier dari Partner Desk yang dibangun
  (quotes/purchase-orders/deliveries). Tidak ada tabel `subcontractors` atau
  kolom penugasan subkontraktor di `work_packages` mana pun — belum ada
  entitas bisnis yang bisa dibaca fitur ini. Perlu keputusan desain data model
  dulu sebelum dibangun, bukan sekadar salin pola supplier.
- **Notifikasi WhatsApp API**: `notifications` masih hanya in_app + email.
  Memilih vendor WhatsApp (Meta Cloud API langsung, Twilio, broker seperti
  Wati/Gupshup) adalah keputusan biaya berulang + vendor eksternal baru yang
  menerima nomor telepon dan isi pesan — kategori keputusan yang sama dengan
  pemilihan vendor speech-to-text Fase 10, sengaja tidak diputuskan sepihak.

**Yang perlu terjadi sebelum ini ditutup:** lihat
[ADR 0024](decisions/0024-fase11-partner-desk-scope-decisions.md) SS1 dan SS4
— masing-masing perlu keputusan Owner (desain data model subcontractor;
pemilihan vendor WA + anggaran) sebelum dibangun.

## 5. Onboarding eksternal (client/mandor) masih tanpa UI (ditemukan saat Fase 11)

**Status:** celah lama, ditemukan (bukan diciptakan) saat membangun undangan
supplier Fase 11 — dicatat di sini karena mempengaruhi kesiapan uji orang
luar, bukan hanya Partner Desk.

Sebelum Fase 11, tidak ada satu pun UI atau action di seluruh basis kode ini
yang benar-benar men-provision pengguna eksternal (client_approver, mandor,
dll.) — semua `client_users`/`project_members` untuk role eksternal hanya
pernah dibuat lewat test factory yang memakai service-role client langsung.
Fase 11 menambahkan `core/auth/provision-external-user.ts` (dipakai
`inviteVendorUserAction`) yang menutup celah ini **khusus untuk supplier**.
Jalur yang sama untuk client_approver/client_viewer/mandor belum punya UI
staf — mekanismenya sudah bisa dipakai ulang, tapi belum ada tombol undang
di halaman client/proyek mana pun.

**Yang perlu terjadi sebelum ini ditutup:** kalau uji pilot melibatkan klien
atau mandor sungguhan (bukan hanya supplier), staf butuh cara mengundang
mereka lewat UI, bukan lewat SQL manual. Prioritas tergantung siapa yang
diuji lebih dulu — lihat urutan di bawah.

---

## Rekomendasi urutan penyelesaian (sebelum app ini boleh dites orang lain di luar Owner)

Diurutkan dari yang paling murah/cepat divalidasi ke yang paling mahal:

1. **ADR 0015 audit** (butuh beberapa jam membaca kode, tidak butuh manusia
   lapangan) — kerjakan duluan karena murni kerja analisis kode, dan hasilnya
   menentukan apakah ada perbaikan kode yang perlu masuk sebelum pilot.
2. **CHECKPOINT #3 uji lapangan** — butuh menjadwalkan satu mandor/koordinator
   lokasi sungguhan; lakukan sebelum pilot klien pertama, bukan sesudahnya,
   karena kalau magic-link gagal ini mengubah arsitektur auth secara mendasar.
3. **Onboarding eksternal (client/mandor) belum ada UI** (item 5) — cepat
   dikerjakan (mekanisme sudah ada, tinggal UI), tapi hanya mendesak kalau
   pilot pertama melibatkan klien/mandor sungguhan, bukan hanya staf internal.
4. **Fase 10 voice-note/weekly-report** dan **Fase 11 subcontractor/WA API**
   — paling mahal (masing-masing butuh keputusan vendor dan/atau desain data
   model baru), dan paling tidak mendesak: fitur inti tiap fase sudah lengkap
   dan aman tanpa item-item ini. Bisa ditunda sampai setelah pilot pertama
   berjalan, kecuali Owner menilai salah satunya esensial untuk pilot itu
   sendiri.

Item baru yang ditemukan sesudah ini ditambahkan di bawah, bukan menggantikan
yang di atas.
