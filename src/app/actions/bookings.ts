"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTenantUser } from "@/lib/authorization";
import { BookingStateError, holdSeats, payBooking, SeatTakenError } from "@/lib/bookings";

const holdSchema = z.object({
  slug: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/),
  showtimeId: z.string().uuid(),
  seats: z.array(z.string().regex(/^[A-Z]+[1-9]\d*$/)).min(1).max(10),
}).refine(({ seats }) => new Set(seats).size === seats.length, { message: "Kursi duplikat." });
const paymentSchema = z.object({
  slug: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/),
  bookingId: z.string().uuid(),
});

export async function holdSeatsAction(formData: FormData) {
  const parsed = holdSchema.safeParse({
    slug: formData.get("slug"),
    showtimeId: formData.get("showtimeId"),
    seats: formData.getAll("seats"),
  });
  if (!parsed.success) redirect("/?error=invalid-seat-selection");
  const { tenant, userId } = await requireTenantUser(parsed.data.slug, ["CUSTOMER"]);
  try {
    const booking = await holdSeats({
      tenantId: tenant.id,
      userId,
      showtimeId: parsed.data.showtimeId,
      seats: parsed.data.seats,
    });
    redirect(`/bookings/${booking.id}`);
  } catch (error) {
    if (error instanceof SeatTakenError) {
      redirect(`/showtimes/${parsed.data.showtimeId}?error=seat-taken`);
    }
    if (error instanceof BookingStateError) {
      redirect(`/showtimes/${parsed.data.showtimeId}?error=invalid-seat-selection`);
    }
    throw error;
  }
}

export async function simulatePaymentAction(formData: FormData) {
  const parsed = paymentSchema.safeParse({ slug: formData.get("slug"), bookingId: formData.get("bookingId") });
  if (!parsed.success) redirect("/?error=invalid-booking");
  const { tenant, userId } = await requireTenantUser(parsed.data.slug, ["CUSTOMER"]);
  const result = await payBooking({ tenantId: tenant.id, userId, bookingId: parsed.data.bookingId });
  if (result === "paid" || result === "already-paid") redirect(`/tickets/${parsed.data.bookingId}`);
  if (result === "not-found") redirect("/?error=booking-not-found");
  redirect(`/bookings/${parsed.data.bookingId}?error=expired`);
}
