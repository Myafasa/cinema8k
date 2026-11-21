import assert from "node:assert/strict";
import { prisma, withTenant } from "../src/lib/db";
import { sellCounterSeats } from "../src/lib/counter-sales";
import { getTenantReports } from "../src/lib/reports";
import { seatRowCode } from "../src/lib/seat-codes";

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { subdomain: "aurora" } });
  assert(tenant, "Jalankan seed tenant aurora lebih dulu.");
  const setup = await withTenant(tenant.id, async (tx) => {
    const showtime = await tx.showtime.findFirst({
      where: { tenantId: tenant.id, mulai: { gt: new Date() } },
      include: { studio: true },
    });
    const cashier = await tx.membership.findFirst({ where: { tenantId: tenant.id, role: "CASHIER" } });
    assert(showtime && cashier, "Seed harus membuat jadwal dan akun kasir.");
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
    return { showtimeId: showtime.id, cashierUserId: cashier.userId, seat, harga: showtime.harga };
  });

  const before = await getTenantReports(tenant.id);
  const { booking, ticket } = await sellCounterSeats({
    tenantId: tenant.id,
    cashierUserId: setup.cashierUserId,
    showtimeId: setup.showtimeId,
    seats: [setup.seat],
  });
  assert.equal(booking.status, "PAID");
  assert(booking.paidAt, "Penjualan kasir harus mencatat waktu pembayaran.");
  assert.equal(booking.total, setup.harga);
  assert(ticket.kode.startsWith("T-"));
  const seat = await withTenant(tenant.id, (tx) => tx.bookingSeat.findFirst({ where: { tenantId: tenant.id, bookingId: booking.id } }));
  assert.equal(seat?.status, "SOLD");

  const after = await getTenantReports(tenant.id);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(booking.paidAt);
  const dailyRow = after.sales.find((row) => row.tanggal === today);
  assert(dailyRow, "Laporan harian harus memuat pembayaran kasir hari ini.");
  const previousDailyRow = before.sales.find((row) => row.tanggal === today);
  assert.equal(Number(dailyRow.pendapatan) - Number(previousDailyRow?.pendapatan ?? BigInt(0)), setup.harga);
  const filmRow = after.occupancy.find((row) => row.terjual > (before.occupancy.find((old) => old.judul === row.judul)?.terjual ?? BigInt(0)));
  assert(filmRow, "Okupansi harus naik setelah kursi kasir dijual.");

  await withTenant(tenant.id, async (tx) => {
    await tx.ticket.delete({ where: { id: ticket.id } });
    await tx.bookingSeat.updateMany({ where: { tenantId: tenant.id, bookingId: booking.id }, data: { status: "RELEASED" } });
    await tx.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });
  });
  console.log("Counter sale OK: booking, kursi, tiket, dan laporan tercatat atomik.");
}

main().finally(async () => prisma.$disconnect());
