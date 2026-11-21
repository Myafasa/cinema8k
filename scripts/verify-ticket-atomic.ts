import assert from "node:assert/strict";
import { prisma, withTenant } from "../src/lib/db";
import { holdSeats, payBooking } from "../src/lib/bookings";
import { seatRowCode } from "../src/lib/seat-codes";
import { ticketPayload, verifyTicketPayload } from "../src/lib/ticket-signature";
import { consumeTicket } from "../src/lib/tickets";

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { subdomain: "aurora" } });
  assert(tenant, "Jalankan seed tenant aurora lebih dulu.");
  const setup = await withTenant(tenant.id, async (tx) => {
    const showtime = await tx.showtime.findFirst({ where: { tenantId: tenant.id, mulai: { gt: new Date() } }, include: { studio: true } });
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

  const booking = await holdSeats({ tenantId: tenant.id, ...setup, seats: [setup.seat] });
  assert.equal(await payBooking({ tenantId: tenant.id, userId: setup.userId, bookingId: booking.id }), "paid");
  const ticket = await withTenant(tenant.id, (tx) => tx.ticket.findFirst({ where: { tenantId: tenant.id, bookingId: booking.id } }));
  assert(ticket, "Pembayaran harus membuat tiket.");
  const signed = ticketPayload(ticket.kode);
  assert.equal(verifyTicketPayload(signed), ticket.kode, "Signature QR harus valid.");
  assert.equal(verifyTicketPayload(`${ticket.kode}.invalid`), null, "Signature yang dimanipulasi harus ditolak.");

  const results = await Promise.all(Array.from({ length: 20 }, () => consumeTicket(tenant.id, ticket.kode)));
  assert.equal(results.filter((count) => count === 1).length, 1, "Tiket hanya boleh berhasil divalidasi sekali.");
  assert.equal(results.filter((count) => count === 0).length, 19, "Pemindaian berikutnya harus ditolak.");

  await withTenant(tenant.id, async (tx) => {
    await tx.ticket.deleteMany({ where: { tenantId: tenant.id, bookingId: booking.id } });
    await tx.bookingSeat.updateMany({ where: { tenantId: tenant.id, bookingId: booking.id }, data: { status: "RELEASED" } });
    await tx.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });
  });
  console.log("Ticket OK: HMAC tervalidasi dan tepat satu dari 20 pemindaian berhasil.");
}

main().finally(async () => prisma.$disconnect());
