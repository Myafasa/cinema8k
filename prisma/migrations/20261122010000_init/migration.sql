CREATE TYPE "TenantPlan" AS ENUM ('FREE', 'BASIC', 'PRO');
CREATE TYPE "GlobalRole" AS ENUM ('USER', 'SUPER_ADMIN');
CREATE TYPE "UserRole" AS ENUM ('TENANT_ADMIN', 'CASHIER', 'CUSTOMER');
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED');
CREATE TYPE "SeatStatus" AS ENUM ('HELD', 'SOLD', 'RELEASED');

CREATE TABLE tenants (
  id UUID PRIMARY KEY,
  nama TEXT NOT NULL,
  subdomain TEXT NOT NULL UNIQUE,
  plan "TenantPlan" NOT NULL DEFAULT 'FREE',
  aktif BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nama TEXT NOT NULL,
  global_role "GlobalRole" NOT NULL DEFAULT 'USER',
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role "UserRole" NOT NULL,
  CONSTRAINT memberships_tenant_user_key UNIQUE (tenant_id, user_id)
);
CREATE INDEX memberships_user_id_idx ON memberships(user_id);

CREATE TABLE movies (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  judul TEXT NOT NULL,
  durasi_menit INTEGER NOT NULL,
  sinopsis TEXT NOT NULL,
  poster_url TEXT,
  CONSTRAINT movies_tenant_id_id_key UNIQUE (tenant_id, id)
);
CREATE INDEX movies_tenant_id_idx ON movies(tenant_id);

CREATE TABLE studios (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nama TEXT NOT NULL,
  jumlah_baris INTEGER NOT NULL,
  jumlah_kolom INTEGER NOT NULL,
  CONSTRAINT studios_tenant_id_id_key UNIQUE (tenant_id, id)
);
CREATE INDEX studios_tenant_id_idx ON studios(tenant_id);

CREATE TABLE showtimes (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  movie_id UUID NOT NULL,
  studio_id UUID NOT NULL,
  mulai TIMESTAMPTZ(6) NOT NULL,
  harga INTEGER NOT NULL,
  CONSTRAINT showtimes_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT showtimes_movie_tenant_fkey FOREIGN KEY (tenant_id, movie_id)
    REFERENCES movies(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT showtimes_studio_tenant_fkey FOREIGN KEY (tenant_id, studio_id)
    REFERENCES studios(tenant_id, id) ON DELETE RESTRICT
);
CREATE INDEX showtimes_tenant_id_mulai_idx ON showtimes(tenant_id, mulai);

CREATE TABLE bookings (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  showtime_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  kode TEXT NOT NULL UNIQUE,
  status "BookingStatus" NOT NULL DEFAULT 'PENDING',
  expires_at TIMESTAMPTZ(6) NOT NULL,
  total INTEGER NOT NULL,
  dibuat_pada TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT bookings_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT bookings_showtime_tenant_fkey FOREIGN KEY (tenant_id, showtime_id)
    REFERENCES showtimes(tenant_id, id) ON DELETE RESTRICT
);
CREATE INDEX bookings_tenant_status_expiry_idx ON bookings(tenant_id, status, expires_at);

CREATE TABLE booking_seats (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL,
  showtime_id UUID NOT NULL,
  kode_kursi TEXT NOT NULL,
  status "SeatStatus" NOT NULL DEFAULT 'HELD',
  CONSTRAINT booking_seats_booking_tenant_fkey FOREIGN KEY (tenant_id, booking_id)
    REFERENCES bookings(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT booking_seats_showtime_tenant_fkey FOREIGN KEY (tenant_id, showtime_id)
    REFERENCES showtimes(tenant_id, id) ON DELETE RESTRICT
);
CREATE INDEX booking_seats_tenant_showtime_idx ON booking_seats(tenant_id, showtime_id);
-- Constraint ini menyelesaikan race perebutan kursi di seluruh replika aplikasi.
CREATE UNIQUE INDEX booking_seats_active_showtime_seat_key
  ON booking_seats(showtime_id, kode_kursi)
  WHERE status IN ('HELD', 'SOLD');

CREATE TABLE tickets (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL,
  kode TEXT NOT NULL UNIQUE,
  used_at TIMESTAMPTZ(6),
  CONSTRAINT tickets_booking_tenant_fkey FOREIGN KEY (tenant_id, booking_id)
    REFERENCES bookings(tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX tickets_tenant_booking_idx ON tickets(tenant_id, booking_id);

-- Jalankan bootstrap-roles.sql sebagai administrator PostgreSQL sebelum migrasi.
GRANT USAGE ON SCHEMA public TO cinema_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenants, users TO cinema_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON memberships, movies, studios, showtimes,
  bookings, booking_seats, tickets TO cinema_app;

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON memberships
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE movies FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON movies
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE studios ENABLE ROW LEVEL SECURITY;
ALTER TABLE studios FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON studios
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE showtimes ENABLE ROW LEVEL SECURITY;
ALTER TABLE showtimes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON showtimes
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON bookings
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE booking_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_seats FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON booking_seats
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tickets
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
