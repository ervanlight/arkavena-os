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

## Rekomendasi urutan penyelesaian (sebelum app ini boleh dites orang lain di luar Owner)

Diurutkan dari yang paling murah/cepat divalidasi ke yang paling mahal:

1. **ADR 0015 audit** (butuh beberapa jam membaca kode, tidak butuh manusia
   lapangan) — kerjakan duluan karena murni kerja analisis kode, dan hasilnya
   menentukan apakah ada perbaikan kode yang perlu masuk sebelum pilot.
2. **CHECKPOINT #3 uji lapangan** — butuh menjadwalkan satu mandor/koordinator
   lokasi sungguhan; lakukan sebelum pilot klien pertama, bukan sesudahnya,
   karena kalau magic-link gagal ini mengubah arsitektur auth secara mendasar.
3. **Fase 10 voice-note/weekly-report** — paling mahal (butuh keputusan
   vendor + kemungkinan desain ulang jalur review), dan paling tidak
   mendesak: keempat fitur AI Scribe lain sudah lengkap dan aman tanpa dua
   ini. Bisa ditunda sampai setelah pilot pertama berjalan, kecuali Owner
   menilai voice-note esensial untuk adopsi pilot itu sendiri.

Item baru yang ditemukan selama Fase 11 (dan seterusnya) ditambahkan di
bawah ini, bukan menggantikan tiga di atas.
