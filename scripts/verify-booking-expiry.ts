import assert from "node:assert/strict";
import { prisma, withTenant } from "../src/lib/db";
import { expireExpiredBookings } from "../src/lib/booking-expiry";
import { holdSeats } from "../src/lib/bookings";
import { seatRowCode } from "../src/lib/seat-codes";

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { subdomain: "aurora" } });
  assert(tenant, "Jalankan seed tenant aurora lebih dulu.");
  const setup = await withTenant(tenant.id, async (tx) => {
    const showtime = await tx.showtime.findFirst({
      where: { tenantId: tenant.id, mulai: { gt: new Date() } },
      include: { studio: true },
    });
    const customer = await tx.membership.findFirst({ where: { tenantId: tenant.id, role: "CUSTOMER" } });
    assert(showtime && customer, "Seed harus membuat jadwal dan akun customer.");
    const occupied = new Set((await tx.bookingSeat.findMany({
      where: { tenantId: tenant.id, showtimeId: showtime.id, status: { in: ["HELD", "SOLD"] } },
      select: { kodeKursi: true },
    })).map((seat) => seat.kodeKursi));
    let seat: string | undefined;
    for (let row = 0; row < showtime.studio.jumlahBaris && !seat; row += 1) {
      for (let column = 1; column <= showtime.studio.jumlahKolom; column += 1) {
        const code = `${seatRowCode(row)}${column}`;
        if (!occupied.has(code)) { seat = code; break; }
      }
    }
    assert(seat, "Jadwal tidak memiliki kursi kosong untuk simulasi.");
    return { showtimeId: showtime.id, userId: customer.userId, seat };
  });

  const expired = await holdSeats({ tenantId: tenant.id, ...setup, seats: [setup.seat] });
  await withTenant(tenant.id, (tx) => tx.booking.update({
    where: { id: expired.id },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  }));
  const count = await expireExpiredBookings();
  const state = await withTenant(tenant.id, async (tx) => ({
    booking: await tx.booking.findUnique({ where: { id: expired.id } }),
    seat: await tx.bookingSeat.findFirst({ where: { tenantId: tenant.id, bookingId: expired.id } }),
  }));
  assert(count >= 1 && state.booking?.status === "EXPIRED" && state.seat?.status === "RELEASED", "Worker harus expire dan release secara atomik.");

  const replacement = await holdSeats({ tenantId: tenant.id, ...setup, seats: [setup.seat] });
  await withTenant(tenant.id, async (tx) => {
    await tx.bookingSeat.updateMany({ where: { tenantId: tenant.id, bookingId: replacement.id, status: "HELD" }, data: { status: "RELEASED" } });
    await tx.booking.update({ where: { id: replacement.id }, data: { status: "CANCELLED" } });
  });
  console.log(`Expiry OK: booking expired, kursi ${setup.seat} dapat di-hold kembali.`);
}

main().finally(async () => prisma.$disconnect());
