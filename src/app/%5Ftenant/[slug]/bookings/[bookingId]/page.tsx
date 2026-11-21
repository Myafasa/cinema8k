import { z } from "zod";
import { notFound } from "next/navigation";
import { simulatePaymentAction } from "@/app/actions/bookings";
import { requireTenantUser } from "@/lib/authorization";
import { withTenant } from "@/lib/db";
import { formatJakartaDateTime } from "@/lib/seat-codes";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const paramsSchema = z.object({ slug: z.string(), bookingId: z.string().uuid() });

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; bookingId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  const { tenant, userId } = await requireTenantUser(parsed.data.slug, ["CUSTOMER"]);
  const [booking, query] = await Promise.all([
    withTenant(tenant.id, (tx) => tx.booking.findFirst({
      where: { id: parsed.data.bookingId, tenantId: tenant.id, userId },
      include: { showtime: { include: { movie: true } }, seats: true },
    })),
    searchParams,
  ]);
  if (!booking) notFound();
  const expired = booking.status === "PENDING" && booking.expiresAt <= new Date();

  return (
    <section className="mx-auto max-w-xl space-y-5">
      <h1 className="text-3xl font-bold">Konfirmasi booking</h1>
      <Card className="space-y-2">
        <h2 className="text-xl font-semibold">{booking.showtime.movie.judul}</h2>
        <p>{formatJakartaDateTime(booking.showtime.mulai)}</p>
        <p>Kursi: {booking.seats.map((seat) => seat.kodeKursi).join(", ")}</p>
        <p>Total: Rp {booking.total.toLocaleString("id-ID")}</p>
        <p>Status: {expired ? "EXPIRED" : booking.status}</p>
        {booking.status === "PENDING" && !expired && (
          <p className="text-sm text-zinc-500">Selesaikan pembayaran sebelum {formatJakartaDateTime(booking.expiresAt)}.</p>
        )}
      </Card>
      {query.error === "expired" && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">Booking kedaluwarsa. Pilih ulang kursi yang tersedia.</p>}
      {booking.status === "PENDING" && !expired && (
        <form action={simulatePaymentAction}>
          <input type="hidden" name="slug" value={tenant.subdomain} />
          <input type="hidden" name="bookingId" value={booking.id} />
          <Button>Bayar simulasi</Button>
        </form>
      )}
      {booking.status === "PAID" && <a className="inline-block rounded-lg bg-zinc-900 px-4 py-2 text-white" href={`/tickets/${booking.id}`}>Lihat e-tiket</a>}
    </section>
  );
}
