import { z } from "zod";
import { withTenant } from "@/lib/db";
import { resolveTenant } from "@/lib/tenant";

const paramsSchema = z.object({
  slug: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/),
  showtimeId: z.string().uuid(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; showtimeId: string }> },
) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return Response.json({ error: "Jadwal tidak valid." }, { status: 400 });
  const tenant = await resolveTenant(parsed.data.slug);

  const seatState = await withTenant(tenant.id, async (tx) => {
    const showtime = await tx.showtime.findFirst({
      where: { tenantId: tenant.id, id: parsed.data.showtimeId },
      select: { id: true, studio: { select: { jumlahBaris: true, jumlahKolom: true } } },
    });
    if (!showtime) return null;
    const occupied = await tx.bookingSeat.findMany({
      where: { tenantId: tenant.id, showtimeId: showtime.id, status: { in: ["HELD", "SOLD"] } },
      select: { kodeKursi: true },
    });
    return { ...showtime.studio, occupied: occupied.map((seat) => seat.kodeKursi) };
  });

  if (!seatState) return Response.json({ error: "Jadwal tidak ditemukan." }, { status: 404 });
  return Response.json(seatState, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
