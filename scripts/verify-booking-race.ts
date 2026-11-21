import assert from "node:assert/strict";
import { prisma, withTenant } from "../src/lib/db";
import { holdSeats } from "../src/lib/bookings";
import { seatRowCode } from "../src/lib/seat-codes";

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { subdomain: "aurora" } });
  assert(tenant, "Jalankan seed tenant aurora lebih dulu.");
  const setup = await withTenant(tenant.id, async (tx) => {
    const [showtime, customer] = await Promise.all([
      tx.showtime.findFirst({
        where: { tenantId: tenant.id, mulai: { gt: new Date() } },
        include: { studio: true },
      }),
      tx.membership.findFirst({ where: { tenantId: tenant.id, role: "CUSTOMER" } }),
    ]);
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

  const attempts = await Promise.allSettled(Array.from({ length: 20 }, () =>
    holdSeats({ tenantId: tenant.id, userId: setup.userId, showtimeId: setup.showtimeId, seats: [setup.seat!] }),
  ));
  const winners = attempts.filter((attempt) => attempt.status === "fulfilled");
  const unexpected = attempts.filter((attempt) => attempt.status === "rejected" && !(attempt.reason instanceof Error && attempt.reason.message === "Kursi sudah diambil."));
  assert.equal(unexpected.length, 0, "Hasil paralel hanya boleh sukses atau konflik kursi.");
  assert.equal(winners.length, 1, `Tepat satu dari 20 hold harus berhasil; hasil: ${winners.length}.`);

  const winner = (winners[0] as PromiseFulfilledResult<Awaited<ReturnType<typeof holdSeats>>>).value;
  await withTenant(tenant.id, async (tx) => {
    await tx.bookingSeat.updateMany({ where: { tenantId: tenant.id, bookingId: winner.id, status: "HELD" }, data: { status: "RELEASED" } });
    await tx.booking.update({ where: { id: winner.id }, data: { status: "CANCELLED" } });
  });

  console.log(`Race OK: 1 berhasil, 19 ditolak untuk kursi ${setup.seat}.`);
}

main().finally(async () => prisma.$disconnect());
