# PRODUCT.md — BuildTrust OS

> Ini dokumen *produk*, bukan dokumen teknis. `ARCHITECTURE.md` menjawab "bagaimana sistem ini dibangun". `CLAUDE.md` menjawab "aturan apa yang tidak boleh dilanggar". Dokumen ini menjawab satu pertanyaan yang lebih tinggi: **mengapa BuildTrust OS ada, dan untuk siapa.**

---

## Mission

Menghilangkan ketidakpastian antara pemilik proyek dan tim pembangun, sepanjang siklus hidup sebuah proyek konstruksi — dari assessment pertama sampai garansi berakhir.

Bukan mengelola proyek lebih efisien untuk kontraktor. Membuat klien **tahu, tanpa harus bertanya**, apa yang sedang terjadi pada rumah/bangunan mereka, dan **percaya** pada apa yang mereka lihat karena setiap klaim status punya bukti di baliknya.

## Vision

Dalam waktu 3 tahun, BuildTrust OS adalah standar antarmuka antara tim konstruksi profesional dan klien mereka — pengalaman yang klien *harapkan* ada, bukan fitur tambahan yang mereka syukuri kalau ada. Kontraktor yang memakainya menang tender bukan karena harga, tapi karena calon klien pernah melihat demo Project Journey dan berkata: *"saya ingin proses seperti ini untuk rumah saya."*

## Product Principles

Setiap fitur, sebelum dibangun, diuji dengan satu pertanyaan:

> **"Apakah ini mengurangi ketidakpastian klien?"**

Kalau jawabannya tidak, itu bukan prioritas — walau mungkin tetap berguna secara operasional (dan boleh dibangun sebagai *dukungan internal*, bukan diklaim sebagai fitur inti).

Lima prinsip turunan:

1. **Legibilitas 5 detik.** Klien login → tahu kesehatan proyeknya dalam 5 detik, tanpa membaca laporan, tanpa bertanya ke PM. Kalau sebuah layar butuh penjelasan lisan untuk dipahami, layar itu gagal.
2. **Tidak ada status tanpa bukti.** "Selesai" bukan kata yang cukup. Foto, video, timestamp, GPS (opsional), hasil QC, dan penanggung jawab — itu yang membuat status bisa dipercaya, bukan sekadar diklaim. Status tanpa bukti dianggap **belum selesai**, bukan "selesai tapi belum terdokumentasi."
3. **Ini rumah mereka, bukan software kita.** Klien membuka BuildTrust OS bukan untuk "memakai dashboard kontraktor" — mereka membuka untuk **melihat rumah mereka sendiri**. Bahasa, urutan informasi, dan nada harus terasa personal dan emosional (rumah, keluarga, masa depan), bukan administratif (tiket, modul, status enum).
4. **AI proaktif, bukan reaktif.** Sistem yang menunggu klien atau staf bertanya sudah kalah. Ringkasan mingguan, ringkasan harian lapangan, analisis keterlambatan, prediksi risiko, update untuk klien, ringkasan eksekutif, dan insight QC harus **muncul sendiri** — draft yang ditinjau manusia, bukan laporan yang harus diminta.
5. **Setiap modul harus menaikkan trust, bukan cuma produktivitas.** Modul yang hanya mempercepat pekerjaan internal (procurement, cost library) tetap sah ada — tapi statusnya "pendukung", bukan "wajah produk". Modul yang bersentuhan dengan klien harus secara eksplisit dirancang untuk menaikkan kepercayaan, bukan sekadar menampilkan data.

## Target Users

**Internal (operator kepercayaan):**
- **Owner / Direktur** — pemilik hasil akhir: apakah klien percaya, apakah kas sehat, apakah proyek selesai tepat waktu.
- **Technical Director** — penjaga gerbang kualitas & keamanan teknis (Quality Gate, override Cash Gate).
- **Finance** — penjaga kesehatan kas (Cash Gate, billing) — trust internal terhadap uang klien.
- **QS (Quantity Surveyor) / Estimator** — penjaga akurasi angka sebelum janji dibuat ke klien.
- **Site Coordinator / Mandor** — sumber bukti utama: setiap laporan harian, foto, dan progres mereka *adalah* bahan baku trust.

**Eksternal (penerima kepercayaan):**
- **Klien (pemilik proyek)** — pengguna utama Project Journey. Sering non-teknis, sering cemas (ini biasanya investasi terbesar dalam hidup mereka), sering mengandalkan orang lain (pasangan, anak) untuk ikut memutuskan.
- **Pengambil keputusan pendamping klien** (pasangan, keluarga) — tidak login setiap hari, tapi harus bisa diyakinkan lewat satu tautan/ringkasan yang dikirim klien utama.
- *(Masa depan, belum dibangun)* — pihak ketiga yang butuh visibilitas terbatas: bank/lender pembiayaan, arsitek eksternal, konsultan pengawas independen.

## North Star Metric

**Project Confidence Score** (median lintas seluruh proyek aktif dalam organisasi, dilacak mingguan).

Kenapa ini north star dan bukan sekadar salah satu metrik: setiap modul di sistem punya jalur kontribusi eksplisit ke skor ini (lihat rancangan arsitektur di `docs/decisions/0026-trust-os-transformation.md`). Kalau median skor naik, itu berarti *seluruh* sistem — jadwal, kas, dokumentasi, QC, approval klien, isu terbuka, variation, dan cash gate — bergerak ke arah yang benar secara bersamaan. Satu angka yang tidak bisa "dipalsukan" dengan memperbaiki satu dimensi saja sambil mengabaikan yang lain.

Target awal (indikatif, direvisi setelah data nyata terkumpul): skor median ≥ 75 secara konsisten di seluruh proyek aktif dianggap "sehat"; skor apa pun < 40 memicu eskalasi otomatis ke Owner terlepas dari root cause-nya.

## User Experience Philosophy

**"Project Journey", bukan "Client Portal".**

Portal adalah kata dari dunia software administratif — koneksi ke sistem. Journey adalah kata dari dunia yang dialami klien sungguhan: assessment pertama di rumah mereka → proposal → tanda tangan kontrak → progres per minggu → keputusan yang harus mereka ambil → penyerahan kunci → garansi berjalan. Implikasi konkret terhadap desain:

- Struktur informasi mengikuti **linimasa emosional proyek**, bukan struktur tabel modul teknis (Ringkasan/Timeline/Zona/Foto/Keputusan sebagai tab datar terasa seperti dashboard admin, bukan cerita tentang rumah mereka).
- Bahasa selalu personal: "rumah Anda", bukan "proyek #4821". Status ditulis ulang dari kosakata teknis (`hold_point_pending`, `awaiting_client_approval`) ke kosakata manusia ("sedang menunggu pemeriksaan independen sebelum dinding ditutup", "menunggu keputusan Anda").
- Bahasa visual sudah iOS/macOS-grade sejak redesign sebelumnya (design tokens, `core/ui`) — filosofi ini melanjutkan pekerjaan itu ke tingkat *arsitektur informasi*, bukan cuma tingkat piksel.
- Bukti (foto/video) selalu tampil di tempat pertama, bukan di belakang klik "lihat detail" — bukti adalah konten utama, teks status adalah keterangannya, bukan sebaliknya.

## Competitive Advantage

BuildTrust OS tidak bersaing lewat daftar fitur ERP (kontraktor lama sudah punya spreadsheet, WhatsApp grup, dan Excel budgeting — itu "cukup" secara fungsional). Keunggulan bersaingnya struktural, bukan kosmetik:

1. **Gate itu literal, bukan sekadar aturan tertulis.** Cash Gate dan Quality Gate adalah *trigger database*, bukan kebijakan yang bisa dilanggar diam-diam oleh satu orang yang buru-buru. Klien (atau owner) yang tahu ini bisa benar-benar percaya "tidak mungkin ada pekerjaan lanjut tanpa kas siap atau QC lulus" — karena itu benar secara teknis, bukan cuma janji SOP.
2. **Audit trail yang tidak bisa disunting.** `audit_logs` append-only, dua kanal (trigger + aplikasi) — setiap klaim status punya jejak siapa/kapan/kenapa yang tidak bisa dihapus oleh siapa pun, termasuk oleh Owner sendiri.
3. **Evidence-linked completion** (lihat rancangan domain Evidence) — "selesai" secara struktural terikat ke bukti, bukan terpisah darinya.
4. **Legibilitas 5 detik** yang didukung skor tunggal yang bisa diaudit turunannya, bukan "vibe dashboard" yang terlihat rapi tapi tidak bisa dijelaskan asalnya.

## Success Metrics

Diukur, bukan diasumsikan:

- **Adopsi bukti**: % work package/milestone yang ditandai selesai *dengan* evidence lengkap (foto + hasil QC + penanggung jawab) vs tanpa. Target jangka pendek: 100% untuk milestone yang terlihat klien.
- **Project Confidence Score**: median lintas portofolio, tren mingguan, distribusi (berapa % proyek di bawah 40).
- **Kecepatan resolusi**: waktu dari isu lapangan dilaporkan → ditutup; dari keputusan dipresentasikan ke klien → diputuskan (Decision Clock, sudah ada).
- **Keterlibatan klien**: frekuensi & durasi sesi login klien (indikator proxy trust — klien yang percaya penuh mengunjungi lebih santai, bukan hanya saat panik).
- **AI proaktif terpakai**: % ringkasan otomatis (mingguan/harian/eksekutif) yang benar-benar dibaca/disimpan manusia vs diabaikan — sinyal apakah draft AI cukup relevan untuk dipercaya tanpa selalu diedit total.
- **Zero silent completion**: nol insiden status "selesai" yang kemudian terbukti tidak, di proyek yang menjalankan aturan evidence-gating penuh.

---

*Dokumen ini hidup — direvisi setiap kali prinsip produk berubah, bukan ditulis sekali lalu dilupakan. Perubahan besar pada dokumen ini (target users baru, north star baru) sebaiknya disertai ADR di `docs/decisions/`, mengikuti konvensi yang sama seperti keputusan arsitektur teknis.*
