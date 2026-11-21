import { z } from "zod";
import QRCode from "qrcode";
import Image from "next/image";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { requireTenantUser } from "@/lib/authorization";
import { withTenant } from "@/lib/db";
import { formatJakartaDateTime } from "@/lib/seat-codes";
import { ticketPayload } from "@/lib/ticket-signature";

const paramsSchema = z.object({ slug: z.string().min(1).max(63), bookingId: z.string().uuid() });

export default async function CounterTicketPage({
  params,
}: {
  params: Promise<{ slug: string; bookingId: string }>;
}) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  const { tenant } = await requireTenantUser(parsed.data.slug, [UserRole.CASHIER]);
  const booking = await withTenant(tenant.id, (tx) => tx.booking.findFirst({
    where: { id: parsed.data.bookingId, tenantId: tenant.id, status: "PAID" },
    include: { showtime: { include: { movie: true, studio: true } }, seats: true, tickets: true },
  }));
  const ticket = booking?.tickets[0];
  if (!booking || !ticket) notFound();
  const qr = await QRCode.toDataURL(ticketPayload(ticket.kode), { errorCorrectionLevel: "M", margin: 2, width: 280 });

  return (
    <section className="mx-auto max-w-lg space-y-5">
      <p className="text-sm font-semibold uppercase tracking-widest text-green-700">Penjualan berhasil</p>
      <Card className="space-y-3 text-center">
        <h1 className="text-2xl font-bold">{booking.showtime.movie.judul}</h1>
        <p>{tenant.nama} · {booking.showtime.studio.nama}</p>
        <p>{formatJakartaDateTime(booking.showtime.mulai)}</p>
        <p>Kursi {booking.seats.map((seat) => seat.kodeKursi).join(", ")}</p>
        <Image className="mx-auto size-64" src={qr} alt={`QR tiket ${ticket.kode}`} width={280} height={280} unoptimized />
        <p className="font-mono text-sm">{ticket.kode}</p>
        <p className="text-xs text-zinc-500">Cetak halaman ini atau tunjukkan QR kepada pelanggan.</p>
      </Card>
      <a className="inline-block rounded-lg border px-4 py-2 text-sm" href="/kasir">Kembali ke kasir</a>
    </section>
  );
}
