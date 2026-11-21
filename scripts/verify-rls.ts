import assert from "node:assert/strict";
import { prisma, withTenant } from "../src/lib/db";

async function main() {
  const [tenantA, tenantB] = await Promise.all([
    prisma.tenant.findUnique({ where: { subdomain: "aurora" } }),
    prisma.tenant.findUnique({ where: { subdomain: "bintang" } }),
  ]);
  assert(tenantA && tenantB, "Jalankan seed dua tenant lebih dulu.");

  const [movieA, movieB] = await Promise.all([
    withTenant(tenantA.id, (tx) => tx.movie.findFirst({ where: { tenantId: tenantA.id } })),
    withTenant(tenantB.id, (tx) => tx.movie.findFirst({ where: { tenantId: tenantB.id } })),
  ]);
  assert(movieA && movieB, "Seed harus membuat film untuk kedua tenant.");

  const attempted = await withTenant(tenantA.id, async (tx) => {
    const visible = await tx.movie.findUnique({ where: { id: movieB.id } });
    const changed = await tx.movie.updateMany({
      where: { id: movieB.id },
      data: { judul: "INI TIDAK BOLEH BERUBAH" },
    });
    return { visible, changed: changed.count };
  });
  assert.equal(attempted.visible, null, "Tenant A tidak boleh membaca film tenant B melalui ID langsung.");
  assert.equal(attempted.changed, 0, "Tenant A tidak boleh mengubah film tenant B melalui ID langsung.");
  assert.equal(await prisma.movie.count(), 0, "Tanpa app.tenant_id, RLS harus menyembunyikan semua film.");

  const policies = await prisma.$queryRaw<Array<{ tablename: string; rowsecurity: boolean; force_row_security: boolean }>>`
    SELECT c.relname AS tablename,
           c.relrowsecurity AS rowsecurity,
           c.relforcerowsecurity AS force_row_security
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('memberships','movies','studios','showtimes','bookings','booking_seats','tickets')
  `;
  assert.equal(policies.length, 7, "Semua tujuh tabel tenant harus ada.");
  assert(policies.every((row) => row.rowsecurity && row.force_row_security), "Semua tabel tenant harus FORCE RLS.");

  const [role] = await prisma.$queryRaw<Array<{ rolsuper: boolean; rolbypassrls: boolean }>>`
    SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user
  `;
  assert(role && !role.rolsuper && !role.rolbypassrls, "DATABASE_URL tidak boleh memakai superuser/BYPASSRLS.");
  const owners = await prisma.$queryRaw<Array<{ owned_by_runtime: boolean }>>`
    SELECT c.relowner = (SELECT oid FROM pg_roles WHERE rolname = current_user) AS owned_by_runtime
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('memberships','movies','studios','showtimes','bookings','booking_seats','tickets')
  `;
  assert(owners.length === 7 && owners.every((row) => !row.owned_by_runtime), "Role runtime tidak boleh menjadi pemilik tabel tenant.");

  console.log("RLS OK: isolasi baca/tulis, FORCE RLS, owner terpisah, dan koneksi runtime terbatas.");
}

main().finally(async () => prisma.$disconnect());
