"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTenantUser } from "@/lib/authorization";
import { BookingStateError, SeatTakenError } from "@/lib/bookings";
import { sellCounterSeats } from "@/lib/counter-sales";
import { consumeTicket } from "@/lib/tickets";
import { verifyTicketPayload } from "@/lib/ticket-signature";

const saleSchema = z.object({
  slug: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/),
  showtimeId: z.string().uuid(),
  seatText: z.string().trim().min(1).max(300),
}).transform((value) => ({ ...value, seats: value.seatText.split(",").map((seat) => seat.trim().toUpperCase()).filter(Boolean) }))
  .refine(({ seats }) => seats.length > 0 && seats.length <= 10 && seats.every((seat) => /^[A-Z]+[1-9]\d*$/.test(seat)), {
    message: "Masukkan 1–10 kode kursi, misalnya A1, A2.",
    path: ["seatText"],
  })
  .refine(({ seats }) => new Set(seats).size === seats.length, { message: "Kode kursi tidak boleh duplikat." });

const validateSchema = z.object({
  slug: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/),
  payload: z.string().trim().min(1).max(256),
});

export type TicketValidationState = { success?: string; error?: string };

export async function sellCounterSeatsAction(formData: FormData) {
  const parsed = saleSchema.safeParse({
    slug: formData.get("slug"),
    showtimeId: formData.get("showtimeId"),
    seatText: formData.get("seatText"),
  });
  if (!parsed.success) redirect("/kasir?error=invalid-sale");
  const { tenant, userId } = await requireTenantUser(parsed.data.slug, ["CASHIER"]);
  try {
    const result = await sellCounterSeats({
      tenantId: tenant.id,
      cashierUserId: userId,
      showtimeId: parsed.data.showtimeId,
      seats: parsed.data.seats,
    });
    redirect(`/kasir/tiket/${result.booking.id}`);
  } catch (error) {
    if (error instanceof SeatTakenError) redirect("/kasir?error=seat-taken");
    if (error instanceof BookingStateError) redirect("/kasir?error=invalid-seat");
    throw error;
  }
}

export async function validateTicketAction(
  _previous: TicketValidationState,
  formData: FormData,
): Promise<TicketValidationState> {
  const parsed = validateSchema.safeParse({ slug: formData.get("slug"), payload: formData.get("payload") });
  if (!parsed.success) return { error: "Masukkan kode tiket atau payload QR yang valid." };
  const { tenant } = await requireTenantUser(parsed.data.slug, ["CASHIER"]);

  const rawCode = parsed.data.payload;
  const code = rawCode.includes(".")
    ? verifyTicketPayload(rawCode)
    : (/^T-[A-F0-9]{36}$/.test(rawCode) ? rawCode : null);
  if (!code) return { error: "Kode atau tanda tangan QR tidak valid." };

  const changed = await consumeTicket(tenant.id, code);
  return changed === 1
    ? { success: `Tiket ${code} valid dan sudah ditandai digunakan.` }
    : { error: "Tiket sudah dipakai atau tidak valid." };
}
