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

## Deploy fresh di Proxmox LXC dengan Cloudflare Tunnel

Contoh ini mengasumsikan tiga LXC Debian 12 (Bookworm), domain sudah memakai Cloudflare DNS, dan nama repo tersedia sebagai Git remote. Ganti CTID, IP, domain, dan URL repo contoh di bawah dengan milikmu. Gunakan IP private statis/reservasi DHCP pada bridge/VLAN yang sama.

### 1. Siapkan LXC dari Proxmox

Buat tiga LXC Debian 12 melalui UI Proxmox, misalnya CTID 201/202/203 untuk node 1/2/3. Beri IP yang dapat saling dirutekan dan storage cukup untuk image Docker; node 3 perlu ruang tambahan untuk database dan backup. Sebelum menyalakan container, jalankan pada shell Proxmox:

```sh
pct set 201 -features nesting=1,keyctl=1
pct set 202 -features nesting=1,keyctl=1
pct set 203 -features nesting=1,keyctl=1
pct start 201
pct start 202
pct start 203
```

Masuk ke setiap LXC dengan `pct enter 201` (ganti CTID). Jalankan bagian instalasi berikut di **ketiga** LXC sebagai root.

### 2. Pasang Git, Docker Engine, dan Compose

```sh
apt update
apt install -y ca-certificates curl git
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
cat > /etc/apt/sources.list.d/docker.sources <<'EOF'
Types: deb
URIs: https://download.docker.com/linux/debian
Suites: bookworm
Components: stable
Architectures: amd64
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
docker run --rm hello-world
```

Perintah di atas untuk host `amd64`; bila Proxmox memakai arsitektur lain, ganti `Architectures` sesuai `dpkg --print-architecture`. Langkah ini mengikuti metode repository apt Docker untuk Debian 12.[Dokumentasi Docker](https://docs.docker.com/engine/install/debian/)

### 3. Salin kode dan isi environment

Di setiap LXC, clone repo ke path yang sama:

```sh
git clone https://github.com/<akun>/<repo>.git /opt/cinema
cd /opt/cinema
cp .env.example .env
nano .env
```

Kalau repo private, siapkan akses Git pada setiap LXC (misalnya deploy key). Kalau kode belum punya Git remote, push dulu dari komputer development atau salin folder repo ke LXC dengan `scp`.

Isi `.env` **identik di ketiga node**: `ROOT_DOMAIN`, `NODE1_IP`, `NODE2_IP`, `NODE3_IP`, `DATABASE_URL`, `AUTH_SECRET`, `TICKET_HMAC_SECRET`, serta password PostgreSQL. Pakai password kuat; password dalam `DATABASE_URL` harus URL-encoded jika berisi karakter khusus. `DATABASE_URL` menunjuk ke `NODE3_IP` dan role `cinema_runtime`.

Di Node 1, siapkan file UUID tunnel, config, dan credentials. UUID bukan rahasia, tetapi credentials JSON harus dirahasiakan:

```sh
cd /opt/cinema
cp deploy/node1/cloudflared.env.example deploy/node1/cloudflared.env
nano deploy/node1/cloudflared.env
mkdir -p deploy/node1/cloudflared
cp deploy/node1/cloudflared/config.yml.example deploy/node1/cloudflared/config.yml
nano deploy/node1/cloudflared/config.yml
```

Isi `TUNNEL_ID` dan ganti hostname pada `config.yml` dengan domainmu. Jangan commit config lokal atau credentials JSON.

### 4. Buat Cloudflare Tunnel

Pasang CLI di Node 1. Domain perlu sudah ditambahkan ke Cloudflare dan nameserver-nya mengarah ke Cloudflare:

```sh
mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
  -o /usr/share/keyrings/cloudflare-main.gpg
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" \
  > /etc/apt/sources.list.d/cloudflared.list
apt update
apt install -y cloudflared
cloudflared version
```

Login akan mencetak URL untuk dibuka di browser. Setelah menyetujui zone domain, kembali ke Node 1 dan buat tunnel melalui CLI:

```sh
cloudflared tunnel login
cloudflared tunnel create cinema-booking
cloudflared tunnel list
```

Catat UUID hasilnya. Buat DNS CNAME route untuk domain utama dan wildcard (ganti UUID/domain):

```sh
cloudflared tunnel route dns <UUID> bioskop.example.com
cloudflared tunnel route dns <UUID> '*.bioskop.example.com'
```

Salin credentials JSON tunnel ke folder mount Node 1. Container `cloudflared` berjalan sebagai UID 65532:

```sh
cp /root/.cloudflared/<UUID>.json deploy/node1/cloudflared/credentials.json
chown 65532:65532 deploy/node1/cloudflared/credentials.json
chmod 0400 deploy/node1/cloudflared/credentials.json
```

Pastikan `config.yml` memiliki hostname yang sama dengan DNS routes dan credentials path `/etc/cloudflared/credentials.json`. Set `TUNNEL_ID=<UUID>` dalam `deploy/node1/cloudflared.env`. CLI membuat tunnel dan record DNS, tidak perlu membuat routes lewat dashboard.[Panduan tunnel CLI](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/create-local-tunnel/)

Cloudflare menangani HTTPS publik; di jaringan Docker, cloudflared meneruskan request HTTP ke Caddy port 80. Caddy lalu load-balance ke app Node 1 dan Node 2. Port 80/443 tidak dipublikasikan dari LXC ke internet. Izinkan koneksi **keluar** dari Node 1 ke Cloudflare di TCP/UDP port 7844 serta DNS; Cloudflare Tunnel memakai koneksi outbound dan tidak memerlukan inbound port forwarding.[Cloudflare Tunnel routing](https://developers.cloudflare.com/tunnel/concepts/routing/), [firewall ports](https://developers.cloudflare.com/tunnel/configuration/)

### 5. Nyalakan database di Node 3

```sh
cd /opt/cinema
docker compose -f deploy/node3/compose.yml up -d
docker compose -f deploy/node3/compose.yml ps
docker compose -f deploy/node3/compose.yml logs -f postgres
```

Saat pertama kali berjalan, Compose membuat database dan role. `pg_hba.conf` mengizinkan koneksi dari Node 1/2 saja (serta loopback untuk backup). Batasi juga firewall host Proxmox/LXC: port 5432 hanya dari dua IP app tersebut. Backup harian disimpan di `deploy/node3/backups` dengan retensi 14 hari. Simpan salinan backup di luar Node 3 juga.

### 6. Build image dan migrasi dari Node 1

Di Node 1, build image satu kali. Jalankan migrasi dari Node 1 agar asal koneksi diizinkan `pg_hba.conf`:

```sh
cd /opt/cinema
docker compose --env-file .env --env-file deploy/node1/cloudflared.env \
  -f deploy/node1/compose.yml build app
docker compose --env-file .env --env-file deploy/node1/cloudflared.env \
  -f deploy/node1/compose.yml run --rm --no-deps \
  -e DATABASE_URL='postgresql://cinema_migrator:<password>@<NODE3_IP>:5432/cinema?schema=public' \
  app npm run db:migrate
docker compose --env-file .env --env-file deploy/node1/cloudflared.env \
  -f deploy/node1/compose.yml run --rm --no-deps app npm run db:seed
```

Ganti `<password>` dan `<NODE3_IP>` sesuai `.env`. Migrasi dijalankan satu kali memakai role migrator; seed juga satu kali memakai role runtime.

Untuk memakai **image yang sama persis** di kedua node app, ekspor image dari Node 1 lalu pindahkan ke Node 2:

```sh
docker save cinema-app:local | gzip > /tmp/cinema-app.tar.gz
scp /tmp/cinema-app.tar.gz root@<NODE2_IP>:/tmp/cinema-app.tar.gz
```

### 7. Jalankan replika dan Tunnel

Di Node 2:

```sh
cd /opt/cinema
docker load < /tmp/cinema-app.tar.gz
docker compose -f deploy/node2/compose.yml up -d --no-build
docker compose -f deploy/node2/compose.yml ps
```

Di Node 1:

```sh
cd /opt/cinema
docker compose --env-file .env --env-file deploy/node1/cloudflared.env \
  -f deploy/node1/compose.yml up -d --no-build
docker compose --env-file .env --env-file deploy/node1/cloudflared.env \
  -f deploy/node1/compose.yml ps
docker compose --env-file .env --env-file deploy/node1/cloudflared.env \
  -f deploy/node1/compose.yml logs -f caddy cloudflared
```

Buka `https://aurora.bioskop.example.com` dan `https://bintang.bioskop.example.com`. Cek tunnel berstatus **Healthy** di dashboard. Caddy punya health check app; untuk demo failover, hentikan app Node 2 sementara (`docker compose -f deploy/node2/compose.yml stop app`), muat ulang situs, lalu jalankan kembali dengan `start app`.

### Batas dan firewall

- Tidak ada port publik yang perlu diarahkan ke LXC. Cloudflare Tunnel membuat koneksi keluar dari Node 1; izinkan TCP/UDP 7844 outbound dan DNS.
- Batasi Node 2 port 3000 agar hanya dapat diakses Node 1. Batasi Node 3 port 5432 agar hanya dapat diakses Node 1 dan 2.
- Bila akses internet dari klien harus tetap tersedia saat Node 1 mati, Caddy dan cloudflared perlu dirancang ulang sebagai replika juga; konfigurasi MVP ini hanya failover untuk app Node 2.
- `nesting` dan `keyctl` wajib diaktifkan untuk Docker di LXC.

## Catatan keamanan dan operasi

- `ROOT_DOMAIN`, `DATABASE_URL`, `AUTH_SECRET`, dan `TICKET_HMAC_SECRET` wajib disetel sesuai lingkungan. Jangan memakai nilai contoh untuk deployment.
- Cookie Auth.js host-only tanpa atribut `Domain`, jadi sesi tidak dibagikan antar-subdomain.
- RLS dipaksa pada semua tabel yang memiliki `tenant_id`. Tabel global `tenants` dan `users` tidak memakai RLS.
- Migrasi tidak dijalankan otomatis oleh app atau worker. Jalankan `npm run db:migrate` satu kali sebagai role migrator sebelum deploy versi baru.
- Bila satu replika app mati, Caddy tetap melayani lewat replika yang sehat. Node 1 tetap menjadi reverse proxy.

