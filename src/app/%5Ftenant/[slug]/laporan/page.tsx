import { UserRole } from "@prisma/client";
import { z } from "zod";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { requireTenantUser } from "@/lib/authorization";
import { getTenantReports } from "@/lib/reports";

const paramsSchema = z.object({ slug: z.string().min(1).max(63) });

export default async function ReportsPage({ params }: { params: Promise<{ slug: string }> }) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  const { tenant } = await requireTenantUser(parsed.data.slug, [UserRole.TENANT_ADMIN]);
  const { sales, occupancy } = await getTenantReports(tenant.id);

  return (
    <section className="space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Laporan · {tenant.nama}</p>
        <h1 className="mt-2 text-3xl font-bold">Penjualan dan okupansi</h1>
        <p className="mt-2 text-zinc-600">Ringkasan 30 hari terakhir berdasarkan waktu pembayaran dan kursi terjual.</p>
      </header>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Penjualan per hari</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b text-zinc-500"><th className="py-2">Tanggal</th><th>Booking</th><th>Pendapatan</th></tr></thead>
              <tbody>
                {sales.map((row) => (
                  <tr key={row.tanggal} className="border-b last:border-0">
                    <td className="py-2">{row.tanggal}</td>
                    <td>{Number(row.jumlah_booking).toLocaleString("id-ID")}</td>
                    <td>Rp {Number(row.pendapatan).toLocaleString("id-ID")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sales.length === 0 && <p className="text-sm text-zinc-500">Belum ada penjualan dalam periode ini.</p>}
        </Card>
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Okupansi per film</h2>
          <div className="space-y-4">
            {occupancy.map((row) => {
              const capacity = Number(row.kapasitas);
              const sold = Number(row.terjual);
              const percent = capacity > 0 ? Math.round((sold / capacity) * 100) : 0;
              return (
                <div key={row.judul}>
                  <div className="flex justify-between gap-4 text-sm"><span className="font-medium">{row.judul}</span><span>{sold}/{capacity} kursi · {percent}%</span></div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full bg-zinc-800" style={{ width: `${Math.min(percent, 100)}%` }} /></div>
                </div>
              );
            })}
          </div>
          {occupancy.length === 0 && <p className="text-sm text-zinc-500">Belum ada jadwal dalam periode ini.</p>}
        </Card>
      </div>
    </section>
  );
}
