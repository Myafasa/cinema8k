import { resolveTenant } from "@/lib/tenant";
import { withTenant } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { formatJakartaDateTime } from "@/lib/seat-codes";

export default async function TenantHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await resolveTenant(slug);
  const showtimes = await withTenant(tenant.id, (tx) =>
    tx.showtime.findMany({
      where: { tenantId: tenant.id, mulai: { gte: new Date() } },
      include: { movie: true, studio: true },
      orderBy: { mulai: "asc" },
      take: 30,
    }),
  );

  return (
    <section className="space-y-4">
      <p className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Bioskop</p>
      <h1 className="text-4xl font-bold">Selamat datang di {tenant.nama}</h1>
      <p className="max-w-xl text-zinc-600">Pilih jadwal untuk melihat dan memilih kursi.</p>
      <div className="grid gap-4 pt-4 md:grid-cols-2">
        {showtimes.map((showtime) => (
          <Card key={showtime.id}>
            <p className="text-sm text-zinc-500">{formatJakartaDateTime(showtime.mulai)}</p>
            <h2 className="mt-1 text-xl font-semibold">{showtime.movie.judul}</h2>
            <p className="text-sm text-zinc-600">{showtime.studio.nama} · {showtime.movie.durasiMenit} menit</p>
            <p className="mt-3 font-medium">Rp {showtime.harga.toLocaleString("id-ID")}</p>
            <a className="mt-4 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white" href={`/showtimes/${showtime.id}`}>
              Lihat kursi
            </a>
          </Card>
        ))}
      </div>
      {showtimes.length === 0 && <p className="rounded-xl border border-dashed p-6 text-zinc-500">Belum ada jadwal mendatang.</p>}
    </section>
  );
}
