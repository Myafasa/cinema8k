# Sistem Booking Tiket Bioskop

MVP SaaS multi-tenant untuk bioskop. Aplikasi Next.js App Router memakai satu database PostgreSQL 16 dan satu schema. Data tenant dibatasi RLS dan akses tenant melewati `withTenant`, yang menetapkan konteks tenant di transaksi PostgreSQL.

## Status implementasi

- [x] Tahap 1: schema, migrasi, role/RLS, partial unique index kursi, seed dua tenant
- [x] Tahap 2: routing tenant, `withTenant`, autentikasi JWT dan otorisasi
- [x] Tahap 3: onboarding tenant dan CRUD film, studio, jadwal, serta staf
- [x] Tahap 4: halaman publik dan peta kursi dengan polling lima detik
- [x] Tahap 5: booking, pembayaran simulasi, tiket QR bertanda tangan, worker expiry
- [x] Tahap 6: kasir, penjualan loket, validasi tiket, dan laporan
- [ ] Tahap 7: Docker standalone, compose tiga node, Caddy, backup, dan panduan operasi

## Menjalankan lokal

1. Siapkan PostgreSQL 16 dan buat database `cinema`.
2. Sebagai administrator PostgreSQL jalankan `prisma/bootstrap-roles.sql`, lalu tetapkan password kuat untuk `cinema_migrator` dan `cinema_runtime`. Runtime harus anggota `cinema_app`, bukan superuser, bukan `BYPASSRLS`, dan bukan pemilik tabel.
3. Salin `.env.example` ke `.env`; atur `DATABASE_URL` untuk role `cinema_runtime`, `ROOT_DOMAIN`, `AUTH_SECRET`, dan `TICKET_HMAC_SECRET`.
4. Jalankan `npm install`, `npm run db:generate`, lalu migrasi memakai role migrator. Contoh PowerShell:

   ```powershell
   $env:DATABASE_URL = 'postgresql://cinema_migrator:password@localhost:5432/cinema?schema=public'
   npm run db:migrate
   $env:DATABASE_URL = 'postgresql://cinema_runtime:password@localhost:5432/cinema?schema=public'
   npm run db:seed
   npm run dev
   ```

   Di Linux/macOS, set `DATABASE_URL` dengan `export` sebelum tiap perintah.

Halaman tenant lokal: `http://aurora.localhost:3000` dan `http://bintang.localhost:3000`. Domain utama `http://localhost:3000` melayani landing page dan `/super-admin`.

Seed membuat dua tenant contoh. Password semua akun demo `Cinema123!`:

- Super admin: `superadmin@bioskop.test`
- Aurora: `admin@aurora.test`, `kasir@aurora.test`, `customer@aurora.test`
- Bintang: `admin@bintang.test`, `kasir@bintang.test`, `customer@bintang.test`

Ganti kredensial demo sebelum pemakaian selain lokal.

## Fitur

- Super admin membuat/nonaktifkan tenant dan menetapkan plan di `/super-admin`.
- Admin tenant mengelola film, studio, layout, jadwal, staf, dan laporan di `/admin` dan `/laporan`.
- Halaman publik tenant menampilkan film, jadwal, peta kursi, dan polling status kursi setiap lima detik.
- Customer memegang kursi selama sepuluh menit, membayar simulasi, lalu melihat e-ticket QR.
- Kasir dapat menjual kursi langsung dari `/kasir`, membuka tiket loket, serta memvalidasi QR atau kode tiket.
- Booking kursi ditentukan oleh partial unique index PostgreSQL. Perubahan booking, kursi, dan tiket dilakukan dalam transaksi.
- Worker Node terpisah mengubah booking lewat waktu menjadi `EXPIRED` dan melepas kursi dengan `FOR UPDATE SKIP LOCKED`.
- QR memuat kode tiket dan HMAC. Penggunaan tiket atomik melalui `UPDATE ... WHERE used_at IS NULL`.

## Verifikasi

Jalankan sesudah migrasi dan seed. Verifikasi integrasi memerlukan PostgreSQL dan `DATABASE_URL` role runtime.

```sh
npm run verify:rls
npm run verify:booking-race
npm run verify:booking-expiry
npm run verify:ticket-atomic
npm run verify:counter-sale
```

Race test mengirim 20 hold bersamaan untuk kursi yang sama; tepat satu harus berhasil. Verifikasi RLS mencoba baca dan ubah tenant lain. Verifikasi tiket memulai 20 validasi paralel; satu saja yang berhasil.

