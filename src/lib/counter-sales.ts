import { Prisma, SeatStatus } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { withTenant } from "@/lib/db";
import { BookingStateError, seatIsInLayout, SeatTakenError } from "@/lib/bookings";

export async function sellCounterSeats(input: {
  tenantId: string;
  cashierUserId: string;
  showtimeId: string;
  seats: string[];
}) {
  const now = new Date();
  if (input.seats.length === 0 || new Set(input.seats).size !== input.seats.length) {
    throw new BookingStateError("Pilihan kursi tidak valid.");
  }

  try {
    return await withTenant(input.tenantId, async (tx) => {
      const showtime = await tx.showtime.findFirst({
        where: { tenantId: input.tenantId, id: input.showtimeId, mulai: { gt: now } },
        include: { studio: true },
      });
      if (!showtime) throw new BookingStateError("Jadwal tidak tersedia.");
      if (input.seats.some((seat) => !seatIsInLayout(seat, showtime.studio.jumlahBaris, showtime.studio.jumlahKolom))) {
        throw new BookingStateError("Kursi tidak sesuai layout studio.");
      }

      const booking = await tx.booking.create({
        data: {
          tenantId: input.tenantId,
          showtimeId: showtime.id,
          userId: input.cashierUserId,
          kode: `C-${randomBytes(10).toString("hex").toUpperCase()}`,
          status: "PAID",
          expiresAt: now,
          paidAt: now,
          total: showtime.harga * input.seats.length,
        },
      });
      // Counter sales also rely on the same partial unique seat index as web bookings.
      await tx.bookingSeat.createMany({
        data: input.seats.map((kodeKursi) => ({
          tenantId: input.tenantId,
          bookingId: booking.id,
          showtimeId: showtime.id,
          kodeKursi,
          status: SeatStatus.SOLD,
        })),
      });
      const ticket = await tx.ticket.create({
        data: {
          tenantId: input.tenantId,
          bookingId: booking.id,
          kode: `T-${randomBytes(18).toString("hex").toUpperCase()}`,
        },
      });
      return { booking, ticket };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new SeatTakenError();
    throw error;
  }
}
