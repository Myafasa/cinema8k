import { z } from "zod";
import QRCode from "qrcode";
import Image from "next/image";
import { notFound } from "next/navigation";
import { requireTenantUser } from "@/lib/authorization";
import { withTenant } from "@/lib/db";
import { formatJakartaDateTime } from "@/lib/seat-codes";
import { ticketPayload } from "@/lib/ticket-signature";
import { Card } from "@/components/ui/card";

const paramsSchema = z.object({ slug: z.string(), bookingId: z.string().uuid() });

export default async function TicketPage({ params }: { params: Promise<{ slug: string; bookingId: string }> }) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  const { tenant, userId } = await requireTenantUser(parsed.data.slug, ["CUSTOMER"]);
  const booking = await withTenant(tenant.id, (tx) => tx.booking.findFirst({
    where: { id: parsed.data.bookingId, tenantId: tenant.id, userId, status: "PAID" },
    include: { showtime: { include: { movie: true, studio: true } }, seats: true, tickets: true },
  }));
  const ticket = booking?.tickets[0];
  if (!booking || !ticket) notFound();

  const qrDataUrl = await QRCode.toDataURL(ticketPayload(ticket.kode), {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 280,
  });

  return (
    <section className="mx-auto max-w-lg space-y-5">
      <h1 className="text-3xl font-bold">E-tiket</h1>
      <Card className="space-y-3 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-green-700">Pembayaran berhasil</p>
        <h2 className="text-2xl font-bold">{booking.showtime.movie.judul}</h2>
        <p>{tenant.nama} · {booking.showtime.studio.nama}</p>
        <p>{formatJakartaDateTime(booking.showtime.mulai)}</p>
        <p className="font-medium">Kursi {booking.seats.map((seat) => seat.kodeKursi).join(", ")}</p>
        <Image className="mx-auto size-64" src={qrDataUrl} alt={`QR tiket ${ticket.kode}`} width={280} height={280} unoptimized />
        <p className="font-mono text-sm">{ticket.kode}</p>
        <p className="text-xs text-zinc-500">Tunjukkan QR ini kepada petugas bioskop.</p>
      </Card>
    </section>
  );
}
