import { Prisma, SeatStatus } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { withTenant } from "@/lib/db";
import { seatRowCode } from "@/lib/seat-codes";

export class SeatTakenError extends Error {
  constructor() {
    super("Kursi sudah diambil.");
  }
}

export class BookingStateError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export function seatIsInLayout(code: string, rows: number, columns: number) {
  const match = /^([A-Z]+)([1-9]\d*)$/.exec(code);
  if (!match) return false;
  let row = 0;
  for (const letter of match[1]) row = row * 26 + letter.charCodeAt(0) - 64;
  row -= 1;
  const column = Number(match[2]);
  return row >= 0 && row < rows && column >= 1 && column <= columns && seatRowCode(row) === match[1];
}

export async function holdSeats(input: {
  tenantId: string;
  userId: string;
  showtimeId: string;
  seats: string[];
}) {
  const now = new Date();
  try {
    return await withTenant(input.tenantId, async (tx) => {
      const showtime = await tx.showtime.findFirst({
        where: { tenantId: input.tenantId, id: input.showtimeId, mulai: { gt: now } },
        include: { studio: true },
      });
      if (!showtime) throw new BookingStateError("Jadwal tidak tersedia.");
      if (input.seats.length === 0 || input.seats.some((seat) => !seatIsInLayout(seat, showtime.studio.jumlahBaris, showtime.studio.jumlahKolom))) {
        throw new BookingStateError("Pilihan kursi tidak sesuai layout studio.");
      }

      const booking = await tx.booking.create({
        data: {
          tenantId: input.tenantId,
          showtimeId: input.showtimeId,
          userId: input.userId,
          kode: `B-${randomBytes(10).toString("hex").toUpperCase()}`,
          status: "PENDING",
          expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
          total: showtime.harga * input.seats.length,
        },
      });

      // The partial unique index is the race-safe authority across all app replicas.
      await tx.bookingSeat.createMany({
        data: input.seats.map((kodeKursi) => ({
          tenantId: input.tenantId,
          bookingId: booking.id,
          showtimeId: input.showtimeId,
          kodeKursi,
          status: SeatStatus.HELD,
        })),
      });
      return booking;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new SeatTakenError();
    }
    throw error;
  }
}

export type PaymentResult = "paid" | "already-paid" | "expired" | "not-found";

export async function payBooking(input: { tenantId: string; userId: string; bookingId: string }): Promise<PaymentResult> {
  return withTenant(input.tenantId, async (tx) => {
    const now = new Date();
    const changed = await tx.booking.updateMany({
      where: {
        id: input.bookingId,
        tenantId: input.tenantId,
        userId: input.userId,
        status: "PENDING",
        expiresAt: { gt: now },
      },
      data: { status: "PAID", paidAt: now },
    });

    if (changed.count === 1) {
      const sold = await tx.bookingSeat.updateMany({
        where: { tenantId: input.tenantId, bookingId: input.bookingId, status: "HELD" },
        data: { status: SeatStatus.SOLD },
      });
      if (sold.count === 0) throw new BookingStateError("Booking tidak memiliki kursi yang sedang di-hold.");

      await tx.ticket.create({
        data: {
          tenantId: input.tenantId,
          bookingId: input.bookingId,
          kode: `T-${randomBytes(18).toString("hex").toUpperCase()}`,
        },
      });
      return "paid";
    }

    const booking = await tx.booking.findFirst({
      where: { id: input.bookingId, tenantId: input.tenantId, userId: input.userId },
      select: { status: true, expiresAt: true },
    });
    if (!booking) return "not-found";
    if (booking.status === "PAID") return "already-paid";
    if (booking.status === "PENDING" && booking.expiresAt <= now) {
      await tx.booking.updateMany({
        where: { id: input.bookingId, tenantId: input.tenantId, status: "PENDING" },
        data: { status: "EXPIRED" },
      });
      await tx.bookingSeat.updateMany({
        where: { tenantId: input.tenantId, bookingId: input.bookingId, status: "HELD" },
        data: { status: SeatStatus.RELEASED },
      });
    }
    return "expired";
  });
}
