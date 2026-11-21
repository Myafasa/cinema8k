import { resolveTenant } from "@/lib/tenant";

export default async function TenantHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await resolveTenant(slug);

  return (
    <section className="space-y-4">
      <p className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Bioskop</p>
      <h1 className="text-4xl font-bold">Selamat datang di {tenant.nama}</h1>
      <p className="max-w-xl text-zinc-600">Halaman jadwal dan pemesanan akan tersedia pada tahap fitur publik.</p>
      <a className="inline-block rounded-lg bg-zinc-900 px-4 py-2 text-white" href="/login">Masuk ke akun</a>
    </section>
  );
}
