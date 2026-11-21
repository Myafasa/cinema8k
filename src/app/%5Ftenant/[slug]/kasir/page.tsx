import { UserRole } from "@prisma/client";
import { z } from "zod";
import { notFound } from "next/navigation";
import { sellCounterSeatsAction } from "@/app/actions/cashier";
import { requireTenantUser } from "@/lib/authorization";
import { withTenant } from "@/lib/db";
import { formatJakartaDateTime } from "@/lib/seat-codes";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TicketValidationForm } from "@/components/ticket-validation-form";

const paramsSchema = z.object({ slug: z.string().min(1).max(63) });

export default async function CashierPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  const { tenant } = await requireTenantUser(parsed.data.slug, [UserRole.CASHIER]);
  const [showtimes, query] = await Promise.all([
    withTenant(tenant.id, (tx) => tx.showtime.findMany({
      where: { tenantId: tenant.id, mulai: { gt: new Date() } },
      include: { movie: true, studio: true },
      orderBy: { mulai: "asc" },
    })),
    searchParams,
  ]);

  const error = typeof query.error === "string" ? query.error : "";
  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Kasir · {tenant.nama}</p>
        <h1 className="mt-2 text-3xl font-bold">Penjualan tiket dan validasi</h1>
      </header>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
        {error === "seat-taken" ? "Kursi sudah diambil. Periksa peta kursi lalu coba lagi." : "Data penjualan tidak valid."}
      </p>}
      <Card className="space-y-4">
        <div><h2 className="text-xl font-semibold">Jual tiket di tempat</h2><p className="text-sm text-zinc-600">Pilih jadwal dan masukkan kode kursi, dipisahkan koma.</p></div>
        {showtimes.length > 0 ? (
          <form action={sellCounterSeatsAction} className="grid gap-3 md:grid-cols-2">
            <input type="hidden" name="slug" value={tenant.subdomain} />
            <select className="h-10 rounded-lg border px-3 md:col-span-2" name="showtimeId" required defaultValue="">
              <option value="" disabled>Pilih jadwal</option>
              {showtimes.map((showtime) => <option key={showtime.id} value={showtime.id}>
                {showtime.movie.judul} · {showtime.studio.nama} · {formatJakartaDateTime(showtime.mulai)} · Rp {showtime.harga.toLocaleString("id-ID")}
              </option>)}
            </select>
            <Input name="seatText" placeholder="Kursi, contoh A1, A2" required maxLength={300} />
            <Button>Jual dan buat e-tiket</Button>
          </form>
        ) : <p className="text-sm text-zinc-500">Belum ada jadwal mendatang.</p>}
      </Card>
      <Card className="space-y-4">
        <div><h2 className="text-xl font-semibold">Validasi tiket</h2><p className="text-sm text-zinc-600">Scanner QR keyboard dapat mengisi kolom ini. Kode tiket juga bisa dimasukkan manual.</p></div>
        <TicketValidationForm slug={tenant.subdomain} />
      </Card>
    </section>
  );
}
