import { prisma, withTenant } from "@/lib/db";

export async function expireExpiredBookings() {
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  let expiredCount = 0;

  for (const tenant of tenants) {
    const changed = await withTenant(tenant.id, async (tx) => {
      // SKIP LOCKED lets multiple workers process disjoint bookings safely.
      const expired = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM bookings
        WHERE tenant_id = ${tenant.id}::uuid
          AND status = 'PENDING'
          AND expires_at <= now()
        ORDER BY expires_at
        FOR UPDATE SKIP LOCKED
        LIMIT 100
      `;
      if (expired.length === 0) return 0;
      const ids = expired.map((booking) => booking.id);
      const bookings = await tx.booking.updateMany({
        where: { tenantId: tenant.id, id: { in: ids }, status: "PENDING" },
        data: { status: "EXPIRED" },
      });
      await tx.bookingSeat.updateMany({
        where: { tenantId: tenant.id, bookingId: { in: ids }, status: "HELD" },
        data: { status: "RELEASED" },
      });
      return bookings.count;
    });
    expiredCount += changed;
  }

  return expiredCount;
}
