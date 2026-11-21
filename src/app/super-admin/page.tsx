import { logoutAction } from "@/app/actions/auth";
import { createTenantAction, toggleTenantAction, updateTenantPlanAction } from "@/app/actions/super-admin";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireSuperAdmin } from "@/lib/authorization";
import { prisma } from "@/lib/db";

export default async function SuperAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireSuperAdmin();
  const [tenants, query] = await Promise.all([prisma.tenant.findMany({ orderBy: { nama: "asc" } }), searchParams]);
  return (
    <main className="mx-auto max-w-4xl space-y-5 p-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Domain utama</p>
          <h1 className="text-3xl font-bold">Super admin</h1>
        </div>
        <form action={logoutAction}><button className="rounded-lg border px-4 py-2">Keluar</button></form>
      </div>
      <p>Masuk sebagai {user.email}.</p>
      {query.notice && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">Perubahan berhasil ({query.notice}).</p>}
      {query.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">Tidak dapat menyimpan ({query.error}). Periksa subdomain dan email.</p>}
      <Card>
        <h2 className="mb-4 text-xl font-semibold">Buat tenant dan admin awal</h2>
        <form action={createTenantAction} className="grid gap-3 md:grid-cols-2">
          <Input name="nama" placeholder="Nama bioskop" required minLength={2} maxLength={100} />
          <Input name="subdomain" placeholder="Subdomain (contoh: aurora)" required pattern="[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?" />
          <select className="h-10 rounded-lg border px-3" name="plan" defaultValue="FREE">
            <option value="FREE">Free</option><option value="BASIC">Basic</option><option value="PRO">Pro</option>
          </select>
          <Input name="adminNama" placeholder="Nama admin awal" required minLength={2} maxLength={100} />
          <Input name="adminEmail" type="email" placeholder="Email admin awal" required />
          <Input name="adminPassword" type="password" placeholder="Password awal (min. 10 karakter)" required minLength={10} />
          <Button className="md:col-span-2 md:w-fit">Buat tenant</Button>
        </form>
      </Card>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Tenant terdaftar</h2>
        {tenants.map((tenant) => (
          <Card key={tenant.id} className="flex flex-wrap items-center justify-between gap-4">
            <div><h3 className="font-semibold">{tenant.nama}</h3><p className="text-sm text-zinc-500">{tenant.subdomain} · {tenant.aktif ? "Aktif" : "Nonaktif"}</p></div>
            <form action={updateTenantPlanAction} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={tenant.id} />
              <select className="h-10 rounded-lg border px-3" name="plan" defaultValue={tenant.plan}>
                <option value="FREE">Free</option><option value="BASIC">Basic</option><option value="PRO">Pro</option>
              </select>
              <Button variant="outline">Simpan plan</Button>
            </form>
            <form action={toggleTenantAction}>
              <input type="hidden" name="id" value={tenant.id} />
              <input type="hidden" name="aktif" value={tenant.aktif ? "false" : "true"} />
              <Button variant={tenant.aktif ? "destructive" : "outline"}>{tenant.aktif ? "Nonaktifkan" : "Aktifkan"}</Button>
            </form>
          </Card>
        ))}
      </section>
    </main>
  );
}
