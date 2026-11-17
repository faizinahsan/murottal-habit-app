# DESIGN.md: Murottal Juz 30

Status: **revisi 2 (taste-skill), menunggu persetujuan pemilik.** Revisi 1 (palet dan font Arab) sudah disetujui dan tidak berubah.

## 0. Yang berubah di revisi 2

taste-skill dibuat untuk website perusahaan (hero, foto, satu section per layar). Halaman baca Al-Quran bukan landing page, jadi hanya aturan yang cocok untuk app yang diambil:

| Diambil dari taste-skill | Wujudnya di app ini |
|---|---|
| Satu momen yang diingat | Sorotan per kata mengikuti bacaan Mishari (Bagian 5) |
| Hero masuk sekali saat dibuka | Header surah masuk sekali saat halaman dibuka |
| Lapisan hover dan tekan | Token gerak dan jarak persis dari taste-skill (Bagian 6) |
| Font yang lebih baik | Literata untuk teks Latin pengiring (Bagian 7) |
| Tepi kiri dan kanan sama | Satu kolom isi, player bar ikut kolom yang sama |
| Tombol = kata kerja + objek | Semua label tombol ditulis ulang (Bagian 4) |

Tidak diambil, karena tidak ada padanannya di app: foto, hero, satu section per layar, efek shader, kartu fitur, dan script gate taste-skill. Pemeriksaannya memakai click-through di browser dan Delivery Gate antislop.

Stack (revisi 3): PWA HTML/CSS/JS tanpa framework di `app/`, API Node `node:http` tanpa dependensi di `api/`. Flutter ditunda.

## 1. Design Read

Reading this as: aplikasi dengar dan baca murottal untuk pemakaian harian (didengar sambil membaca, sering malam hari), dalam bahasa visual mushaf cetak yang tenang, dial **ENERGY 1 / RHYTHM 1 / MOTION 2**.

- ENERGY 1: teks Al-Quran adalah isi utama, UI tidak boleh bersaing dengannya.
- RHYTHM 1: dua layar dengan struktur daftar. Keseragaman disengaja supaya surah dan ayat mudah dipindai.
- MOTION 2 (naik dari 1): ada satu momen bergerak, yaitu sorotan per kata, dan header surah yang masuk sekali. Selain itu hanya respons hover dan tekan.

## 2. Alur kerja desain

Desain dikerjakan langsung di kode PWA dengan data asli, karena hanya ada dua layar. Referensi visual ada di file Figma "Murottal Juz 30".

| Tahap | Hasil | Selesai jika |
|---|---|---|
| 1. Arah | Dokumen ini disetujui | Revisi 2 dikonfirmasi |
| 2. Alur & layar | Bagian 3 dan 4 | Setiap layar punya state lengkap |
| 3. Wireframe di kode | Dua layar PWA, data API asli | Alur bisa dicoba sampai akhir surah |
| 4. Token visual | Variabel CSS terang dan gelap di `app/style.css` dari Bagian 7 | Tidak ada warna atau durasi hardcode di luar `:root` |
| 5. Momen dan gerak | Sorotan per kata, header masuk, lapisan tekan | Sesuai Bagian 5 dan 6, dan diam saat reduce motion |
| 6. Verifikasi | Laporan Delivery Gate antislop | Semua kontrol diklik di mobile dan web, kedua tema, keyboard |

## 3. Alur pengguna

```
Buka aplikasi
  └─ Daftar Surah (78 sampai 114)
       └─ tap surah
            └─ Halaman Surah
                 ├─ tap ayat → putar ayat itu, sorot ayat, kata menyala mengikuti bacaan
                 ├─ ayat selesai + lanjut otomatis ON  → ayat berikutnya
                 ├─ ayat selesai + lanjut otomatis OFF → berhenti
                 ├─ tap ayat yang sedang diputar → jeda
                 └─ ayat terakhir selesai → kartu "Surah selesai"
                      └─ tombol "Buka surah <nama>" (tidak muncul di An-Nas)
```

Keluar dari Halaman Surah menghentikan audio di v1 (shortcut: belum ada mini player global, tambahkan saat ada audio background).

## 4. Layar, state, dan teks

### 4.1 Daftar Surah

Per baris: nomor surah, nama Latin, nama Arab, jumlah ayat. Fokus layar: nama Arab. Judul layar: "Juz 30".

| State | Tampilan |
|---|---|
| Memuat | 8 baris kerangka setinggi baris asli |
| Gagal | "Daftar surah gagal dimuat. Periksa koneksi internet." + tombol "Muat ulang daftar" |
| Kosong | Data tetap 37 surah; kalau API mengembalikan 0, tampilkan state Gagal |
| Pencarian tanpa hasil | "Tidak ada surah untuk "xyz"." + "Coba ejaan lain, arti surah, atau nomornya, misalnya 112." + tombol "Hapus pencarian" |

**Cari surah** (di atas daftar, label terlihat "Cari surah", placeholder "Nama, arti, atau nomor", radius 12, garis tepi `inkMuted`):
- Menyaring sambil mengetik. Cocok dengan nama Latin, arti, nama lain (Al-Insyirah, Al-Lahab, Iqra), nomor (awalan), dan nama Arab.
- Ejaan Indonesia dan Inggris disamakan: sy/sh, dh/dz, th/ts, q/k, y/i, w/u, huruf ganda dilebur. Jadi "Asy-Syams" menemukan Ash-Shams dan "Al-Kautsar" menemukan Al-Kawthar.
- Hasil diurutkan menurut kecocokan: nama persis (tanpa memandang Al-/An-/Asy-), lalu nama yang diawali kata kunci, lalu nama yang mengandungnya, lalu arti. Kalau seri, urut nomor surah.
- Enter membuka hasil teratas. Kata kunci tetap ada saat kembali dari halaman surah.
- Jumlah hasil diumumkan ke pembaca layar ("3 surah cocok").

### 4.2 Halaman Surah

Setiap ayat: teks Arab (kanan), lalu terjemahan Indonesia Kementerian Agama RI (kiri, Literata 16, `inkMuted`). Saat ayat diputar, seluruh blok berlatar `accentSoft` dan terjemahannya berubah ke `ink` dalam 200 ms. Sorotan terjemahan per ayat, bukan per kata, karena terjemahan tidak sejajar kata demi kata dengan teks Arab. Sumber ditulis di bawah daftar ayat: "Terjemahan: Kementerian Agama RI, lewat Quran.com."

**Basmalah:** blok basmalah di bawah nama surah adalah tombol. Diketuk, basmalah dibacakan sendiri (audio Alafasy Al-Fatihah 1:1) lalu berhenti, dan statusnya kembali ke "Ketuk ayat untuk mulai mendengarkan". Memutar surah (ketuk ayat 1, tombol putar, putar ulang) langsung mulai dari ayat 1 tanpa basmalah. Alasannya: menyambung basmalah ke surah butuh pemutaran kedua, dan HP yang terkunci menolaknya. Selama basmalah, bloknya menyala seperti ayat (latar `accentSoft`, kata menyala, arti kata), dengan status "Memuat basmalah", "Basmalah", "Dijeda di basmalah", dan saat gagal "Putar ulang basmalah". Tombol "Ayat berikutnya" dari basmalah masuk ke ayat 1.

Atas: nama surah Arab besar (momen tipografi, lihat 7), nama Latin, arti, jumlah ayat. Lalu basmalah sebagai header (semua surah di Juz 30 diawali basmalah). Lalu daftar ayat. Player bar menempel di bawah.

Player bar: "Ayat sebelumnya", "Putar ayat" / "Jeda", "Ayat berikutnya", switch "Lanjut otomatis", label "Ayat 5 dari 40".

| State | Tampilan |
|---|---|
| Memuat teks | 5 blok kerangka ayat |
| Gagal memuat teks | "Ayat surah ini gagal dimuat." + "Muat ulang ayat" |
| Belum diputar | "Ketuk ayat untuk mulai mendengarkan"; tombol putar mulai dari ayat 1 |
| Memuat audio | Ikon putar diganti indikator kecil, label "Memuat ayat 5" |
| Gagal audio | Ayat tetap tersorot; "Audio ayat 5 gagal dimuat." + "Putar ulang ayat 5"; lanjut otomatis berhenti |
| Sedang diputar | Ayat aktif tersorot, kata menyala mengikuti bacaan |
| Surah selesai | Kartu di akhir daftar: "Surah An-Naba' selesai" + "Buka surah An-Nazi'at" |

## 5. Momen: sorotan per kata

Satu-satunya momen di app, dan alasannya fungsional: pendengar bisa mengikuti bacaan kata demi kata, berguna untuk belajar dan menghafal.

- Data: API Quran.com memberi waktu tiap kata untuk audio Alafasy per ayat (`/api/v4/recitations/7/by_chapter/{surah}`, field `segments` berisi `[indeks, posisi kata, mulai ms, selesai ms]`). Sudah dicek untuk surah 78.
- Akibatnya, **sumber audio pindah dari EveryAyah ke file Alafasy milik Quran.com**, supaya waktu kata cocok dengan file yang diputar. Backend mengirim `audioUrl` dan `segments` per ayat.
- Tampilan pada ayat aktif: kata yang belum dibaca `inkMuted`, kata yang sudah dibaca `ink`, kata yang sedang dibaca `accent`. Perpindahan warna 150 ms.
- Reduce motion: warna berganti langsung tanpa transisi (perubahan warna tetap tampil, karena itu informasi, bukan hiasan).
- Fallback: kalau `segments` kosong atau gagal, seluruh ayat tampil `ink` dengan sorotan ayat saja.
- Ayat yang tidak aktif selalu `ink` penuh. Teks harus terbaca utuh tanpa audio.
- **Arti kata:** di ayat aktif, antara teks Arab dan terjemahan, ada baris "Arti kata" berisi kata yang sedang dibaca (Amiri Quran, `accent`) dan artinya dalam bahasa Indonesia (Literata tebal, `ink`). Sumbernya arti per kata Quran.com (`language=id`). Sebelum kata pertama dibaca, baris ini menampilkan kata pertama. Setelah ayat selesai, baris ini menampilkan kata terakhir. Tingginya dicadangkan, jadi teks di bawahnya tidak bergeser setiap kali kata berganti. Hanya visual (`aria-hidden`).
- Pergantian kata dijadwalkan dengan timer tepat di awal kata berikutnya, bukan per frame, supaya kata pendek tidak terlewat saat browser membatasi frame.

## 5b. Putar di latar belakang (layar terkunci)

- Satu surah diputar sebagai **satu file audio** (Alafasy per surah dari quranicaudio, dengan waktu tiap ayat dan kata dari Quran.com). Pindah ayat cukup dengan seek di file yang sama, jadi suara tidak pernah berhenti di antara ayat. Dulu tiap ayat satu file, dan jeda saat berganti file membuat Android menghapus notifikasi lalu menolak memutar lagi saat HP terkunci.
- Basmalah file terpisah (Al-Fatihah 1:1) di elemen audio kedua, hanya diputar manual dan tidak disambung ke surah, jadi pemutaran surah tidak pernah berganti file.
- Kalau "Lanjut otomatis" mati, audio dijeda tepat di akhir ayat. Notifikasi punya seek bar untuk seluruh surah.
- Audio tetap jalan saat HP dikunci, dan lanjut ke ayat berikutnya selama switch "Lanjut otomatis" menyala.
- Media Session: layar kunci dan notifikasi menampilkan "Al-Ikhlas, ayat 2" (atau "Al-Ikhlas, basmalah"), artis "Mishary Rashid Alafasy", album "Murottal Juz 30", dengan tombol putar, jeda, ayat sebelumnya, dan ayat berikutnya. Info ini dihapus saat kembali ke daftar surah.
- Saat layar dibuka lagi, sorotan kata langsung disinkronkan ke posisi audio.

## 5c. Ulang dan antrean

**Ulang** (tombol paling kiri di player, tiga posisi, tersimpan di perangkat):
- Mati (ikon ulang dicoret) → Ulangi ayat ini (ikon ulang dengan angka 1) → Ulangi surah ini (ikon ulang). Bentuk ikonnya berbeda di setiap posisi, dan saat aktif berwarna `accent`.
- Ulangi ayat: di akhir ayat, posisi audio dikembalikan ke awal ayat di file yang sama. Status menjadi "Ayat 3 dari 6, diulang". Ini mengalahkan switch "Lanjut otomatis".
- Ulangi surah: file surah diputar berulang (`loop`), jadi tidak pernah selesai dan antrean tidak maju. Status menjadi "..., surah diulang".
- Keduanya tidak memanggil `play()` baru, jadi aman saat HP terkunci.

**Antrean** (tersimpan di perangkat):
- Tombol + di setiap baris daftar surah. Kalau surah sudah masuk antrean, ikonnya berubah jadi centang. Label pembaca layarnya "Tambah An-Naba ke antrean" atau "Hapus An-Naba dari antrean".
- Tombol Antrean dengan badge jumlah ada di top bar daftar surah dan di kanan player. Labelnya "Antrean, 2 surah". Tombol ini membuka panel (`<dialog>`, bisa ditutup dengan Escape atau ketuk latar) berisi daftar antrean dengan tombol hapus per surah, "Putar antrean", dan "Kosongkan antrean". Panel kosong menampilkan "Antrean masih kosong. Tambahkan surah dengan tombol + di daftar surah."
- Saat surah selesai (dengan ulang mati), surah pertama di antrean dibuka dan langsung diputar dari ayat 1, lalu dikeluarkan dari antrean.
- Batasan: berganti surah berarti berganti file audio. Kalau HP terkunci, browser bisa menolak memulai surah berikutnya. Dalam kasus itu status menjadi "Ketuk putar untuk memulai An-Nas", dan tombol putar di layar kunci melanjutkannya.

## 6. Gerak

Token diambil dari taste-skill tanpa diubah.

| Token | Nilai | Dipakai untuk |
|---|---|---|
| `motionIn` | 150 ms | hover masuk, warna kata |
| `motionOut` | 120 ms | hover keluar |
| `motionPress` | 90 ms | tekan |
| `motionPanel` | 200 ms | sorotan ayat berpindah |
| `motionScroll` | 300 ms | auto-scroll ke ayat aktif |
| `easeUi` | cubic(.2, .8, .2, 1) | semua langkah UI |
| `easeEnter` | cubic(.22, 1, .36, 1) | header surah masuk |

| Bagian | Gerak |
|---|---|
| Header surah | Masuk sekali saat halaman dibuka: nama Arab naik 8 px sambil muncul, lalu nama Latin dan info, total 600 ms. Tidak diulang saat scroll. |
| Tombol | Hover (web, pointer halus): isi bergeser 14% ke arah `ink`, naik 1 px. Tekan: turun 1 px dan skala 0.985. |
| Baris surah dan ayat | Hover (web): latar `accentSoft` 50%. Tekan: skala 0.985. Tidak naik, karena baris daftar bukan kartu. |
| Sorotan ayat | Latar `accentSoft` berpindah ke ayat baru dalam 200 ms. |
| Reduce motion | Semua di atas langsung ke keadaan akhir; scroll melompat. |

Tidak ada: animasi muncul saat scroll, loop, pantulan, kemiringan, kilau.

## 7. Token visual

### Warna (tidak berubah dari revisi 1)

Semua pasangan dicek dengan alat kontras antislop (WCAG AA, teks normal butuh 4.5:1).

| Token | Terang | Gelap | Dipakai untuk | Kontras |
|---|---|---|---|---|
| `paper` | `#F6F1E7` | `#14120F` | Latar | |
| `ink` | `#1F1B16` | `#EDE6D8` | Teks Arab, judul | 15.2 / 15.1 |
| `inkMuted` | `#5C5346` | `#A99F8E` | Nama Latin, arti, label, kata belum dibaca | 6.7 / 7.2; di atas `accentSoft` 6.3 / 5.4 |
| `accent` | `#1F5F4A` | `#7FC2A5` | Tombol putar, kata sedang dibaca, penanda ayat aktif | teks di atas accent 6.7 / 9.1; di atas `accentSoft` 6.3 / 6.9 |
| `accentSoft` | `#E3EDE6` | `#1F2E27` | Latar ayat aktif | `ink` di atasnya 14.3 / 11.4 |

Alasan: latar kertas hangat meniru mushaf cetak supaya membaca lama tidak silau. Hijau tua hanya muncul di posisi bacaan. Tidak ada ungu atau gradien. Tema mengikuti sistem, dengan toggle manual di Daftar Surah.

### Tipografi

| Peran | Font | Ukuran awal | Alasan |
|---|---|---|---|
| Teks ayat, basmalah | Amiri Quran (OFL) | 28, line height 2.0 | Dibuat untuk teks Al-Quran, harakat dan tanda waqaf tidak bertabrakan |
| Nama surah Arab di header | Amiri Quran | 56 | Momen tipografi: nama surah dicetak besar seperti kepala surah di mushaf |
| Nama surah Arab di daftar | Amiri Quran | 24 | Satu suara dengan teks ayat |
| Nama Latin, arti, judul layar | Literata (OFL) | 16 sampai 22 | Serif untuk bacaan panjang, berdampingan dengan Naskh tanpa terasa seperti app teknologi |
| Tombol, label, angka player | Font sistem | 14 sampai 16 | Kontrol tetap terasa native dan tidak menambah unduhan |

Font Amiri Quran dan Literata dimuat dari Google Fonts, lalu di-cache oleh service worker supaya kunjungan berikutnya tidak mengunduh lagi. Ukuran teks ayat mengikuti setelan ukuran teks sistem.

### Bentuk, jarak, dan tepi

- Satu kolom isi: lebar maks 720, di tengah. Gutter kiri dan kanan sama: 20 di ponsel, 32 dari lebar 768 ke atas. Player bar berada di kolom yang sama.
- Radius: 12 untuk sorotan ayat dan kartu "Surah selesai", tombol teks, dan switch; lingkaran penuh untuk tombol putar. Elemen lain tanpa radius.
- Switch "Lanjut otomatis" saat mati: garis tepi `inkMuted` (kontras 6.7 / 7.2), supaya tetap terlihat di kedua tema.
- Tanpa bayangan, kecuali satu garis atas tipis di player bar.
- Skala jarak: 4, 8, 16, 24, 40, 64. Antar ayat 24, header surah ke basmalah 40, ruang atas header 64.
- Target sentuh minimal 48 x 48.

### Motif identitas

Penanda akhir ayat gaya mushaf: angka Arab-Indic di dalam bingkai akhir ayat di ujung setiap ayat. Pada ayat aktif, penanda ini berwarna `accent`. Ini satu-satunya ornamen.

## 8. Aksesibilitas dan input

- Setiap ayat satu tombol dengan label pembaca layar "Ayat 5, ketuk untuk memutar".
- Tombol ikon di player bar berlabel: "Ayat sebelumnya", "Putar ayat", "Jeda", "Ayat berikutnya".
- Web: Spasi untuk putar/jeda, panah kiri/kanan untuk pindah ayat, focus ring terlihat di semua kontrol.
- Switch "Lanjut otomatis" punya label teks.
- Sorotan per kata tidak dibacakan ulang oleh pembaca layar (hanya visual), supaya tidak bising.

## 9. Tidak dibuat

Logo (judul cukup teks "Murottal Juz 30" sampai ada logo dari pemilik), ilustrasi, foto, statistik, onboarding, terjemahan, dan fitur habit.
