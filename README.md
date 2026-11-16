# Campus Queue

Aplikasi antrean kampus berbasis Expo React Native dengan API `json-server`. API menerbitkan tiket, memvalidasi antrean ganda, dan menghitung kuota pada server untuk tanggal `Asia/Jakarta`.

## Menjalankan aplikasi Android

1. Pasang Node.js 20 atau lebih baru.
2. Jalankan `npm install`.
3. Jalankan Android Emulator dari Android Studio (Device Manager).
4. Di terminal pertama, jalankan API: `npm run api`.
5. Di terminal kedua, jalankan `npm run android`. Perintah ini membangun dan menjalankan aplikasi Campus Queue di emulator, bukan membuka halaman JSON API.

### Membuka proyek di Android Studio

1. Jalankan `npm run android:prebuild` untuk membuat folder proyek native `android`.
2. Buka folder `android` dari Android Studio, tunggu Gradle Sync, dan pastikan emulator tersedia.
3. Jalankan Metro dari root proyek dengan `npm start`.
4. Tekan **Run** di Android Studio untuk memasang dan menjalankan Campus Queue di emulator.

Untuk Android Emulator, aplikasi otomatis memakai `http://10.0.2.2:3001` agar dapat menghubungi API di komputer. Konfigurasi Android development mengizinkan HTTP untuk API lokal; jangan gunakan HTTP untuk deployment produksi. Untuk ponsel Android fisik, set `EXPO_PUBLIC_API_URL` ke alamat IP LAN komputer yang menjalankan API, misalnya `http://192.168.1.10:3001`, lalu mulai ulang Expo. Jangan membuka alamat API sebagai halaman aplikasi: halaman tersebut memang menampilkan JSON karena itu endpoint backend.

## Akun demo

| Peran | Email | Kata sandi |
| --- | --- | --- |
| Mahasiswa | `user@kampus.id` | `user123` |
| Petugas | `petugas@kampus.id` | `staff123` |
| Admin | `admin@kampus.id` | `admin123` |

Data contoh tersimpan di `db.json`; perubahan antrean ditulis kembali ke file tersebut.

## Endpoint utama

- `POST /login` dengan `{ "email", "password" }`
- `GET /queue-summary` untuk status layanan, antrean menunggu, dan sisa kuota hari ini
- `POST /take-queue` dengan `{ "userId", "eventId" }`; nomor tiket selalu dibuat server
- `GET /queues` dan `PATCH /queues/:id` untuk melihat/memperbarui status panggilan petugas

Pembuatan nomor antrean diserialisasi pada satu proses server. Ini sesuai untuk demo lokal; sistem produksi perlu autentikasi/token, penyimpanan transaksi (misalnya database), dan kontrol konkurensi lintas proses.

## Pengujian

Jalankan `npm test` untuk menguji pengambilan tiket bersamaan, batas kuota, dan pencegahan antrean ganda.
