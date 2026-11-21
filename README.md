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
- [x] Tahap 2: routing tenant, `withTenant`, autentikasi JWT dan otorisasi
- [x] Tahap 3: onboarding tenant dan CRUD admin
- [x] Tahap 4: halaman publik dan peta kursi
- [ ] Tahap 5: booking, pembayaran simulasi, tiket QR, worker expiry
- [ ] Tahap 6: kasir dan laporan
- [ ] Tahap 7: deployment tiga node

## Routing dan login (tahap 2)

Next.js 16 menggunakan konvensi `proxy.ts` (pengganti `middleware.ts`). Proxy mengambil satu label subdomain dari `ROOT_DOMAIN`, lalu me-rewrite halaman tenant ke route internal `/_tenant/[slug]/...`. Route tersebut memakai folder `%5Ftenant` agar segmen URL `_tenant` tetap bisa dipetakan tanpa menjadikan folder sebagai private folder Next.js.

Auth.js memakai sesi JWT terenkripsi dengan masa berlaku 8 jam. Cookie tidak menetapkan atribut `Domain`, sehingga browser menyimpannya khusus untuk host tempat login. Login tenant hanya berhasil jika akun punya membership di tenant pada host tersebut; login domain utama hanya menerima akun `SUPER_ADMIN`. Akses role tenant memeriksa membership lagi di database.

Untuk demo lokal setelah database disiapkan dan di-seed, jalankan `npm run dev`, lalu buka `http://localhost:3000`, `http://aurora.localhost:3000`, atau `http://bintang.localhost:3000`. Akun admin tenant dapat membuka `/admin` pada subdomain tenantnya.

## Admin tenant (tahap 3)

Super admin dapat membuat tenant beserta akun admin awal, mengganti plan, dan menonaktifkan tenant dari `/super-admin` di domain utama. Admin tenant mengelola film, studio beserta ukuran layout, dan jadwal/harga di `/admin` pada subdomain masing-masing.

## Jadwal publik dan peta kursi (tahap 4)

Halaman tenant menampilkan jadwal mendatang dan harga. Detail jadwal memetakan kursi sesuai baris dan kolom studio; kursi `HELD` atau `SOLD` ditandai terisi. Status dipoll setiap lima detik dari route tenant dan responsnya tidak di-cache.

