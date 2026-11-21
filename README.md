# Sistem Booking Tiket Bioskop

MVP SaaS multi-tenant untuk bioskop. Aplikasi Next.js App Router memakai satu database PostgreSQL 16 dan satu schema. Data tenant dibatasi RLS dan akses tenant melewati `withTenant`, yang menetapkan konteks tenant di transaksi PostgreSQL.

## Status implementasi

- [x] Tahap 1: schema, migrasi, role/RLS, partial unique index kursi, seed dua tenant
- [x] Tahap 2: routing tenant, `withTenant`, autentikasi JWT dan otorisasi
- [x] Tahap 3: onboarding tenant dan CRUD film, studio, jadwal, serta staf
- [x] Tahap 4: halaman publik dan peta kursi dengan polling lima detik
- [x] Tahap 5: booking, pembayaran simulasi, tiket QR bertanda tangan, worker expiry
- [x] Tahap 6: kasir, penjualan loket, validasi tiket, dan laporan
- [x] Tahap 7: Docker standalone, compose tiga node, Caddy, backup, dan panduan operasi

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

## Deploy tiga node

File ada di `deploy/node1`, `deploy/node2`, dan `deploy/node3`. Salin repo dan `.env` yang sama ke tiap node. Isi IP private sebenarnya untuk `NODE1_IP`, `NODE2_IP`, dan `NODE3_IP`, domain `ROOT_DOMAIN`, URL database, serta password/secret yang kuat. Password di URL database sebaiknya alfanumerik dan tanda hubung atau di-URL-encode.

### Node 3: PostgreSQL dan backup

Compose membuat PostgreSQL 16, database `cinema`, dan role `cinema_runtime`, `cinema_migrator`, `cinema_backup`. `pg_hba.conf` hanya mengizinkan koneksi TCP dari IP node 1 dan 2 serta loopback untuk backup lokal. Batasi juga port 5432 di firewall host ke dua IP tersebut. Database hanya bind ke `NODE3_IP`.

```sh
docker compose -f deploy/node3/compose.yml up -d
```

### Migrasi dan seed satu kali

Migrasi tidak berjalan saat app start. Jalankan migrasi dari node 1 (atau node 2) setelah membangun image, supaya koneksi ke PostgreSQL berasal dari IP yang diizinkan `pg_hba.conf`. Ganti placeholder password dan IP dengan nilai `.env`:

```sh
docker compose -f deploy/node1/compose.yml build app
docker compose -f deploy/node1/compose.yml run --rm --no-deps \
  -e DATABASE_URL='postgresql://cinema_migrator:<password>@<NODE3_IP>:5432/cinema?schema=public' \
  app npm run db:migrate
docker compose -f deploy/node1/compose.yml run --rm --no-deps app npm run db:seed
```

URL migrator hanya untuk migrasi. Seed memakai URL runtime dari `.env`; jalankan sekali. `cinema_backup` memiliki `BYPASSRLS` hanya untuk membuat dump penuh; kredensial ini tidak diberikan ke app.

### Node 1: Caddy dan replika aplikasi pertama

```sh
docker compose -f deploy/node1/compose.yml up -d --build
```

Caddy menerima domain utama dan wildcard subdomain, lalu round-robin ke app lokal dan `NODE2_IP:3000`. Health check `/api/health` mengeluarkan replika yang tidak sehat. TLS `internal` memakai CA internal Caddy; distribusikan root CA Caddy ke perangkat lab agar browser mempercayainya.

### Node 2: replika kedua dan worker

```sh
docker compose -f deploy/node2/compose.yml up -d --build
```

Port 3000 hanya perlu dapat diakses dari node 1; batasi dengan firewall node 2. App dan worker memakai Dockerfile serta image aplikasi yang sama. Kedua replika memakai `AUTH_SECRET` yang sama agar sesi JWT tetap berlaku saat request berpindah replika. Compose node 2 menjalankan satu worker.

Untuk memastikan image identik byte demi byte, build image sekali pada mesin dengan arsitektur yang sama lalu distribusikan tag tersebut ke node 1 dan 2. Compose menyediakan build lokal agar lab mandiri dapat menjalankan perintah di atas.

Backup custom-format dibuat harian di `deploy/node3/backups`; file lebih lama dari 14 hari dihapus. Simpan salinan backup di luar node 3 untuk pemulihan bencana.

### HTTPS wildcard publik

Sertifikat wildcard publik memerlukan DNS challenge. Image Caddy standar pada compose memakai CA internal; untuk publik, buat image Caddy dengan plugin DNS provider yang sesuai penyedia DNS (misalnya `xcaddy`), berikan token API DNS lewat secret environment, lalu ganti `tls internal` dengan konfigurasi DNS challenge provider itu. Wildcard memerlukan DNS challenge dan modul provider DNS; jangan menaruh token API di Caddyfile.

### Proxmox dan LXC

Aktifkan fitur LXC `nesting` dan `keyctl` untuk container yang menjalankan Docker. Gunakan alamat IP private statis atau reservasi DHCP. Pastikan node 1 dapat mencapai node 2 port 3000 dan node 3 port 5432; node lain tidak perlu mengakses port database.

## Catatan keamanan dan operasi

- `ROOT_DOMAIN`, `DATABASE_URL`, `AUTH_SECRET`, dan `TICKET_HMAC_SECRET` wajib disetel sesuai lingkungan. Jangan memakai nilai contoh untuk deployment.
- Cookie Auth.js host-only tanpa atribut `Domain`, jadi sesi tidak dibagikan antar-subdomain.
- RLS dipaksa pada semua tabel yang memiliki `tenant_id`. Tabel global `tenants` dan `users` tidak memakai RLS.
- Migrasi tidak dijalankan otomatis oleh app atau worker. Jalankan `npm run db:migrate` satu kali sebagai role migrator sebelum deploy versi baru.
- Bila satu replika app mati, Caddy tetap melayani lewat replika yang sehat. Node 1 tetap menjadi reverse proxy.

