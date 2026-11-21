import { UserRole } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deleteMovieAction,
  deleteShowtimeAction,
  deleteStudioAction,
  saveMovieAction,
  saveShowtimeAction,
  saveStudioAction,
} from "@/app/actions/admin";
import { requireTenantUser } from "@/lib/authorization";
import { withTenant } from "@/lib/db";
import { formatJakartaDateTime, toJakartaDateTimeLocal } from "@/lib/seat-codes";

type AdminParams = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TenantAdminPage({ params, searchParams }: AdminParams) {
  const { slug } = await params;
  const query = await searchParams;
  const { tenant } = await requireTenantUser(slug, [UserRole.TENANT_ADMIN]);
  const data = await withTenant(tenant.id, async (tx) => {
    const [movies, studios, showtimes] = await Promise.all([
      tx.movie.findMany({ where: { tenantId: tenant.id }, orderBy: { judul: "asc" } }),
      tx.studio.findMany({ where: { tenantId: tenant.id }, orderBy: { nama: "asc" } }),
      tx.showtime.findMany({
        where: { tenantId: tenant.id },
        include: { movie: true, studio: true },
        orderBy: { mulai: "asc" },
      }),
    ]);
    return { movies, studios, showtimes };
  });

  const notice = typeof query.notice === "string" ? query.notice : "";
  const error = typeof query.error === "string" ? query.error : "";

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Admin · {tenant.nama}</p>
        <h1 className="text-3xl font-bold">Kelola katalog dan jadwal</h1>
        <p className="text-zinc-600">Semua data di halaman ini dibaca dalam konteks tenant yang sedang masuk.</p>
        {notice && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">Perubahan tersimpan ({notice}).</p>}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">Tidak dapat menyimpan perubahan ({error}). Jadwal dan layout yang sudah punya booking terlindungi dari perubahan yang mengubah tiket.</p>}
      </header>

      <section id="movies" className="space-y-4">
        <h2 className="text-2xl font-semibold">Film</h2>
        <Card>
          <h3 className="mb-4 font-semibold">Tambah film</h3>
          <form action={saveMovieAction} className="grid gap-3 md:grid-cols-2">
            <input type="hidden" name="slug" value={slug} />
            <Input name="judul" placeholder="Judul film" required maxLength={160} />
            <Input name="durasiMenit" type="number" placeholder="Durasi (menit)" required min={1} max={600} />
            <Input name="posterUrl" type="url" placeholder="URL poster (opsional)" />
            <textarea className="min-h-24 rounded-lg border p-3 md:col-span-2" name="sinopsis" placeholder="Sinopsis" maxLength={5000} />
            <Button className="md:col-span-2 md:w-fit">Tambah film</Button>
          </form>
        </Card>
        <div className="grid gap-4">
          {data.movies.map((movie) => (
            <Card key={movie.id}>
              <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                <form action={saveMovieAction} className="grid gap-3 md:grid-cols-2">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={movie.id} />
                  <Input name="judul" defaultValue={movie.judul} required maxLength={160} />
                  <Input name="durasiMenit" type="number" defaultValue={movie.durasiMenit} required min={1} max={600} />
                  <Input name="posterUrl" type="url" defaultValue={movie.posterUrl ?? ""} placeholder="URL poster (opsional)" />
                  <textarea className="min-h-20 rounded-lg border p-3" name="sinopsis" defaultValue={movie.sinopsis} maxLength={5000} />
                  <Button variant="outline" className="md:col-span-2 md:w-fit">Simpan film</Button>
                </form>
                <form action={deleteMovieAction}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={movie.id} />
                  <Button variant="destructive">Hapus</Button>
                </form>
              </div>
            </Card>
          ))}
          {data.movies.length === 0 && <p className="text-sm text-zinc-500">Belum ada film.</p>}
        </div>
      </section>

      <section id="studios" className="space-y-4">
        <h2 className="text-2xl font-semibold">Studio dan layout kursi</h2>
        <Card>
          <h3 className="mb-4 font-semibold">Tambah studio</h3>
          <form action={saveStudioAction} className="grid gap-3 md:grid-cols-4">
            <input type="hidden" name="slug" value={slug} />
            <Input name="nama" placeholder="Nama studio" required maxLength={80} />
            <Input name="jumlahBaris" type="number" placeholder="Jumlah baris" required min={1} max={100} />
            <Input name="jumlahKolom" type="number" placeholder="Jumlah kolom" required min={1} max={100} />
            <Button>Tambah studio</Button>
          </form>
        </Card>
        <div className="grid gap-4 md:grid-cols-2">
          {data.studios.map((studio) => (
            <Card key={studio.id}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div><h3 className="font-semibold">{studio.nama}</h3><p className="text-sm text-zinc-500">{studio.jumlahBaris} baris × {studio.jumlahKolom} kolom</p></div>
                <form action={deleteStudioAction}>
                  <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={studio.id} />
                  <Button variant="destructive">Hapus</Button>
                </form>
              </div>
              <form action={saveStudioAction} className="grid gap-2 sm:grid-cols-3">
                <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={studio.id} />
                <Input name="nama" defaultValue={studio.nama} required maxLength={80} />
                <Input name="jumlahBaris" type="number" defaultValue={studio.jumlahBaris} required min={1} max={100} />
                <Input name="jumlahKolom" type="number" defaultValue={studio.jumlahKolom} required min={1} max={100} />
                <Button variant="outline" className="sm:col-span-3 sm:w-fit">Simpan layout</Button>
              </form>
            </Card>
          ))}
          {data.studios.length === 0 && <p className="text-sm text-zinc-500">Belum ada studio.</p>}
        </div>
      </section>

      <section id="showtimes" className="space-y-4">
        <h2 className="text-2xl font-semibold">Jadwal dan harga</h2>
        {data.movies.length > 0 && data.studios.length > 0 ? (
          <Card>
            <h3 className="mb-4 font-semibold">Tambah jadwal</h3>
            <form action={saveShowtimeAction} className="grid gap-3 md:grid-cols-2">
              <input type="hidden" name="slug" value={slug} />
              <select className="h-10 rounded-lg border px-3" name="movieId" required defaultValue="">
                <option value="" disabled>Pilih film</option>{data.movies.map((movie) => <option key={movie.id} value={movie.id}>{movie.judul}</option>)}
              </select>
              <select className="h-10 rounded-lg border px-3" name="studioId" required defaultValue="">
                <option value="" disabled>Pilih studio</option>{data.studios.map((studio) => <option key={studio.id} value={studio.id}>{studio.nama}</option>)}
              </select>
              <Input name="mulai" type="datetime-local" required />
              <Input name="harga" type="number" placeholder="Harga tiket (Rp)" required min={1} max={10000000} />
              <Button className="md:col-span-2 md:w-fit">Tambah jadwal</Button>
            </form>
          </Card>
        ) : <p className="text-sm text-zinc-500">Buat minimal satu film dan satu studio lebih dulu.</p>}
        <div className="grid gap-4">
          {data.showtimes.map((showtime) => (
            <Card key={showtime.id}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div><h3 className="font-semibold">{showtime.movie.judul} · {showtime.studio.nama}</h3><p className="text-sm text-zinc-500">{formatJakartaDateTime(showtime.mulai)} · Rp {showtime.harga.toLocaleString("id-ID")}</p></div>
                <form action={deleteShowtimeAction}>
                  <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={showtime.id} />
                  <Button variant="destructive">Hapus</Button>
                </form>
              </div>
              <form action={saveShowtimeAction} className="grid gap-3 md:grid-cols-2">
                <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={showtime.id} />
                <select className="h-10 rounded-lg border px-3" name="movieId" defaultValue={showtime.movieId} required>
                  {data.movies.map((movie) => <option key={movie.id} value={movie.id}>{movie.judul}</option>)}
                </select>
                <select className="h-10 rounded-lg border px-3" name="studioId" defaultValue={showtime.studioId} required>
                  {data.studios.map((studio) => <option key={studio.id} value={studio.id}>{studio.nama}</option>)}
                </select>
                <Input name="mulai" type="datetime-local" defaultValue={toJakartaDateTimeLocal(showtime.mulai)} required />
                <Input name="harga" type="number" defaultValue={showtime.harga} required min={1} max={10000000} />
                <Button variant="outline" className="md:col-span-2 md:w-fit">Simpan jadwal</Button>
              </form>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
