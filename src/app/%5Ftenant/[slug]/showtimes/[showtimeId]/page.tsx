import { z } from "zod";
import { notFound } from "next/navigation";
import { SeatMap } from "@/components/seat-map";
import { Card } from "@/components/ui/card";
import { withTenant } from "@/lib/db";
import { formatJakartaDateTime } from "@/lib/seat-codes";
import { resolveTenant } from "@/lib/tenant";

const routeParams = z.object({ slug: z.string(), showtimeId: z.string().uuid() });

export default async function ShowtimeSeatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; showtimeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = routeParams.safeParse(await params);
  if (!parsed.success) notFound();
  const query = await searchParams;
  const tenant = await resolveTenant(parsed.data.slug);
  const showtime = await withTenant(tenant.id, async (tx) => {
    const result = await tx.showtime.findFirst({
      where: { tenantId: tenant.id, id: parsed.data.showtimeId },
      include: { movie: true, studio: true },
    });
    if (!result) return null;
    const occupied = await tx.bookingSeat.findMany({
      where: { tenantId: tenant.id, showtimeId: result.id, status: { in: ["HELD", "SOLD"] } },
      select: { kodeKursi: true },
    });
    return { ...result, occupied: occupied.map((seat) => seat.kodeKursi) };
  });
  if (!showtime) notFound();

  return (
    <div className="space-y-6">
      <Card>
        <p className="text-sm text-zinc-500">{formatJakartaDateTime(showtime.mulai)} · {showtime.studio.nama}</p>
        <h1 className="mt-1 text-3xl font-bold">{showtime.movie.judul}</h1>
        <p className="mt-2 text-zinc-600">{showtime.movie.durasiMenit} menit · Rp {showtime.harga.toLocaleString("id-ID")} per kursi</p>
      </Card>
      {query.error === "seat-taken" && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Salah satu kursi baru saja diambil. Peta kursi telah diperbarui.</p>}
      {query.error === "invalid-seat-selection" && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">Pilihan kursi tidak valid. Silakan pilih ulang.</p>}
      <SeatMap
        slug={tenant.subdomain}
        showtimeId={showtime.id}
        rows={showtime.studio.jumlahBaris}
        columns={showtime.studio.jumlahKolom}
        initialOccupied={showtime.occupied}
      />
    </div>
  );
}
