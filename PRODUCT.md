# PRODUCT.md — BuildTrust OS

> Ini dokumen *produk*, bukan dokumen teknis. `ARCHITECTURE.md` menjawab "bagaimana sistem ini dibangun". `CLAUDE.md` menjawab "aturan apa yang tidak boleh dilanggar". Dokumen ini menjawab satu pertanyaan yang lebih tinggi: **mengapa BuildTrust OS ada, dan untuk siapa.**

> **Riwayat revisi:** Revisi 1 (2026-07-25) memperkenalkan "Project Confidence Score" sebagai north star — sebuah skor numerik tunggal untuk klien. Revisi 2 (2026-07-25, hari yang sama) **membatalkan pendekatan itu atas keputusan Owner secara eksplisit**: skor numerik untuk klien dianggap mengundang klien menghakimi performa operasional tanpa memahami realita konstruksi, dan bertentangan dengan tujuan produk (mengurangi kecemasan, bukan mengundang pengawasan). Dicatat di sini secara visibel, bukan dihapus diam-diam, mengikuti konvensi ADR di `docs/decisions/`. Lihat [ADR 0026](docs/decisions/0026-trust-os-transformation.md) untuk riwayat lengkap dan rasionalnya.

---

## Mission

Mengurangi kecemasan klien terhadap proyek konstruksi mereka, **sambil melindungi kebebasan operasional kontraktor** untuk menjalankan proyek dengan caranya sendiri.

Klien menyewa Arkavena justru supaya **mereka tidak perlu menjadi manajer proyek sendiri**. BuildTrust OS tidak boleh membalikkan itu — aplikasi ini tidak mengundang klien untuk mengawasi setiap aktivitas. Aplikasi ini membuat klien merasa **cukup terinformasi**, titik.

BuildTrust OS **BUKAN**:
- sistem monitoring klien,
- dashboard transparansi,
- ERP yang dibuka ke klien.

## Vision

Dalam waktu 3 tahun, BuildTrust OS adalah standar cara kontraktor profesional berkomunikasi dengan klien mereka — bukan karena klien bisa melihat *semuanya*, tapi karena klien tidak pernah harus bertanya-tanya. Kontraktor yang memakainya menang bukan lewat "transparansi radikal", tapi lewat ketenangan yang konsisten: klien tahu proyek mereka hidup, tahu kapan mereka perlu bertindak, dan tidak pernah merasa diabaikan — tanpa pernah harus memahami bagaimana dapur mereka sungguh-sungguh dibangun.

## Product Principles

Setiap informasi, sebelum ditampilkan ke klien, diuji dengan satu pertanyaan:

> **"Apakah informasi ini membantu klien mengambil keputusan?"**

Kalau jawabannya tidak, informasi itu **tetap internal**. Klien tidak perlu tahu semuanya. Klien hanya perlu tahu yang relevan.

Lima prinsip turunan:

1. **Relevansi keputusan, bukan kelengkapan.** Data operasional (jumlah isu terbuka, status cash gate mentah, nomor variation) tidak pernah ditampilkan apa adanya ke klien — hanya diterjemahkan menjadi kalimat yang membantu mereka memahami atau memutuskan sesuatu.
2. **Evidence ada untuk akuntabilitas internal dulu, visibilitas klien itu pilihan.** Setiap aktivitas tetap terdokumentasi penuh (foto, timestamp, hasil QC, penanggung jawab) — tapi tidak semua evidence otomatis terlihat klien. Visibilitas evidence punya tingkatan (lihat ADR 0026 §3), dan defaultnya adalah **tidak terlihat** kecuali sengaja dipilih untuk ditampilkan.
3. **Komunikasi di atas data.** Selalu terjemahkan bahasa operasional internal ke bahasa pemilik rumah. "4 Isu Terbuka" menjadi "Ada penyesuaian kecil pipa yang sedang ditangani tim kami." "Cash Gate Pending" menjadi "Pendanaan proyek masih mencukupi untuk tahap pembangunan saat ini." Klien tidak pernah melihat kosakata internal.
4. **Linimasa yang tenang, bukan dashboard.** Beranda klien adalah jurnal progres (Hari Ini / Minggu Ini / Akan Datang / Menunggu Anda / Update Terbaru), bukan ruang kontrol dengan angka-angka. Tujuannya menenangkan, bukan melaporkan.
5. **AI mengurangi kerja komunikasi manual, tidak pernah mengarang kepastian.** Ringkasan mingguan, ringkasan harian lapangan, ringkasan rapat, pengingat approval, ringkasan progres, penjelasan keterlambatan — semua ditulis AI sebagai draft yang direview manusia. AI **tidak pernah** menghasilkan skor, persentase risiko, atau rating apa pun yang terasa seperti kepastian buatan.

## Target Users

**Internal (menjalankan proyek):**
- **Owner / Direktur** — pemilik hubungan dengan klien; memutuskan apa yang layak dikomunikasikan dan kapan.
- **Technical Director** — penjaga kualitas & keamanan teknis (Quality Gate, override Cash Gate) — kompleksitas yang sengaja tidak dibagikan ke klien.
- **Finance** — penjaga kesehatan kas (Cash Gate, billing) — kompleksitas keuangan yang klien percayakan sepenuhnya ke Arkavena.
- **QS (Quantity Surveyor) / Estimator** — penjaga akurasi angka sebelum janji dibuat ke klien.
- **Site Coordinator / Mandor** — sumber evidence utama: laporan harian dan foto mereka menjadi bahan baku akuntabilitas internal *dan*, bila dipilih, bahan komunikasi ke klien.

**Eksternal (menerima ketenangan):**
- **Klien (pemilik proyek)** — pengguna Client Timeline. Non-teknis, sering cemas (biasanya investasi terbesar dalam hidup mereka), **tidak ingin mengelola proyek** — mereka menyewa Arkavena justru untuk tidak melakukan itu.
- **Pengambil keputusan pendamping klien** (pasangan, keluarga) — perlu bisa diyakinkan lewat ringkasan singkat yang dikirim klien utama, tanpa harus login dan menelusuri detail.
- *(Masa depan, belum dibangun)* — pihak ketiga dengan kebutuhan informasi sangat terbatas (bank/lender pembiayaan) — kalau pernah dibangun, mendapat pandangan yang jauh lebih sempit dari klien sendiri, bukan lebih luas.

## North Star Metric

**Communication Latency** (rata-rata waktu antara sesuatu yang relevan terjadi di lapangan, dan update berbahasa manusia yang relevan sampai ke klien) — metrik **internal**, tidak pernah ditampilkan ke klien sebagai angka.

Ini secara sadar menggantikan pendekatan skor-untuk-klien dari Revisi 1. Communication Latency mengukur perilaku yang benar-benar ingin kita optimalkan — seberapa cepat Arkavena mengubah kejadian operasional menjadi ketenangan bagi klien — tanpa pernah mengekspos mekanisme operasional itu sendiri ke klien. Skor internal semacam ini boleh ada untuk tim Arkavena (lihat Success Metrics), tapi **tidak pernah menjadi pengalaman utama klien**.

Metrik pendukung (internal juga): tingkat respons keputusan klien tepat waktu (Decision Clock, sudah ada), dan tingkat adopsi draft AI (berapa persen draft komunikasi yang benar-benar dipakai staf tanpa revisi besar).

## User Experience Philosophy

**Linimasa, bukan dashboard. Jurnal, bukan laporan.**

Klien harus bisa menjawab empat pertanyaan ini dalam 30 detik setelah membuka aplikasi, tidak lebih:

1. Apakah proyek saya berjalan normal?
2. Apakah ada yang perlu saya setujui?
3. Apakah ada masalah yang berdampak ke saya?
4. Apa yang terjadi sejak terakhir saya buka?

Implikasi konkret terhadap desain:

- **Status proyek pakai bahasa manusia, bukan enum teknis** — lima kondisi: *Berjalan Normal*, *Menunggu Keputusan Anda*, *Menunggu Pihak Eksternal*, *Penyesuaian Jadwal*, *Selesai* — masing-masing selalu disertai satu-dua kalimat penjelasan yang menenangkan dan spesifik. Contoh: *"Hujan deras menunda pekerjaan cor selama dua hari. Target penyelesaian saat ini tidak berubah."* — bukan "Schedule Adjustment: -2 hari."
- **Beranda berbentuk linimasa**: Hari Ini / Minggu Ini / Akan Datang / Menunggu Anda / Update Terbaru. Setiap entri terasa seperti jurnal progres, bukan baris tabel.
- **Bukti (foto/video) tampil sebagai konten**, tapi **tidak semua bukti otomatis tampil** — visibilitas per-item, dipilih secara sadar (lihat ADR 0026 §3), bukan default terbuka.
- **Tidak ada angka mentah operasional** di permukaan klien — tidak ada jumlah isu, tidak ada rasio kas, tidak ada persentase risiko, tidak ada skor apa pun.
- Bahasa visual iOS/macOS-grade yang sudah ada (design tokens, `core/ui`) tetap dipakai — filosofi ini mengubah *arsitektur informasi*, bukan bahasa visualnya.

## Competitive Advantage

BuildTrust OS tidak bersaing lewat daftar fitur ERP, dan juga tidak bersaing lewat "transparansi radikal" (itu justru beban bagi klien yang tidak ingin, dan tidak seharusnya, menjadi manajer proyek mereka sendiri). Keunggulannya:

1. **Ketenangan yang benar-benar berdasar, bukan sekadar UI yang menenangkan.** Di baliknya tetap ada Cash Gate dan Quality Gate yang literal — trigger database, bukan kebijakan yang bisa dilanggar diam-diam — sehingga kalimat "pendanaan mencukupi" atau "sudah lulus pemeriksaan independen" yang dibaca klien benar-benar berarti, bukan basa-basi hubungan masyarakat.
2. **Evidence untuk akuntabilitas, bukan untuk pengawasan.** Setiap aktivitas terdokumentasi penuh secara internal — tapi klien tidak dibanjiri olehnya. Kontrol visibilitas per-level membuat kompleksitas operasional tetap menjadi urusan Arkavena, persis seperti yang klien harapkan saat menyewa kontraktor profesional.
3. **Komunikasi yang diterjemahkan secara konsisten**, bukan data mentah yang dibagikan mentah-mentah — klien selalu mendapat bahasa pemilik rumah, tidak pernah bahasa manajemen proyek.
4. **Audit trail internal yang tidak bisa disunting** (`audit_logs` append-only) — kepercayaan Owner terhadap sistemnya sendiri, terlepas dari apa yang dipilih untuk dibagikan ke klien.

## Success Metrics

Metrik-metrik ini **internal** (untuk tim Arkavena) kecuali disebutkan sebaliknya — tidak ada satu pun yang ditampilkan ke klien sebagai skor:

- **Communication Latency** (North Star) — rata-rata waktu kejadian relevan → update klien terpublikasi.
- **Adopsi evidence internal**: % aktivitas yang terdokumentasi lengkap (foto + hasil QC + penanggung jawab) — ukuran akuntabilitas internal, independen dari apa pun yang dibagikan ke klien.
- **Kecepatan resolusi**: waktu isu lapangan dilaporkan → ditutup; waktu keputusan dipresentasikan ke klien → diputuskan (Decision Clock).
- **Tingkat kontak cemas** (proxy kepercayaan): frekuensi klien menghubungi tim di luar aplikasi untuk bertanya "bagaimana progresnya" — target: menurun seiring waktu, tanda linimasa sudah menjawab pertanyaan itu duluan.
- **Adopsi draft AI**: % draft komunikasi (update mingguan, ringkasan harian, penjelasan keterlambatan) yang dipakai staf dengan revisi minimal — sinyal apakah AI benar-benar mengurangi beban komunikasi, bukan menambah pekerjaan review.

---

*Dokumen ini hidup — direvisi setiap kali prinsip produk berubah, bukan ditulis sekali lalu dilupakan. Perubahan besar (target users baru, north star baru) selalu disertai ADR di `docs/decisions/`, dan revisi yang membatalkan pendekatan sebelumnya dicatat secara visibel di sini (lihat catatan riwayat revisi di atas), tidak pernah dihapus diam-diam.*
