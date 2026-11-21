# Sistem Booking Tiket Bioskop

MVP SaaS multi-tenant untuk pengelolaan jadwal dan pemesanan kursi bioskop. Setiap bioskop berbagi satu database PostgreSQL, dengan isolasi tenant melalui Row Level Security (RLS).

## Fondasi database (tahap 1)

Stack memakai Next.js App Router dengan output standalone, TypeScript, Prisma, dan PostgreSQL 16. Skema Prisma ada di `prisma/schema.prisma`; SQL RLS, role aplikasi, dan indeks kursi ada di `prisma/migrations`.

1. Buat database PostgreSQL bernama `cinema`.
2. Sebagai administrator PostgreSQL, jalankan `prisma/bootstrap-roles.sql` pada database tersebut. Tetapkan password kuat untuk `cinema_migrator` dan buat login runtime anggota `cinema_app`. Jangan beri login runtime hak superuser, `BYPASSRLS`, atau kepemilikan tabel.
3. Salin `.env.example` ke `.env`, lalu atur `DATABASE_URL` untuk role runtime.
4. Jalankan `npm install`, `npm run db:generate`, `npm run db:migrate`, lalu `npm run db:seed`.

Seed membuat dua tenant contoh: `aurora` dan `bintang`. Semua akun demo menggunakan password `Cinema123!`:

- Super admin: `superadmin@bioskop.test`
- Tenant Aurora: `admin@aurora.test`, `kasir@aurora.test`, `customer@aurora.test`
- Tenant Bintang: `admin@bintang.test`, `kasir@bintang.test`, `customer@bintang.test`

Password seed disimpan sebagai hash scrypt. Ganti akun dan password demo sebelum dipakai di lingkungan selain lokal.

## Status implementasi

- [x] Tahap 1: schema, migrasi awal, role/RLS, partial unique index kursi, seed dua tenant
- [ ] Tahap 2: routing tenant, `withTenant`, autentikasi dan otorisasi
- [ ] Tahap 3: CRUD admin
- [ ] Tahap 4: halaman publik dan peta kursi
- [ ] Tahap 5: booking, pembayaran simulasi, tiket QR, worker expiry
- [ ] Tahap 6: kasir dan laporan
- [ ] Tahap 7: deployment tiga node
