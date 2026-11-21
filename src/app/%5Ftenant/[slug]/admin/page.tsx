import { UserRole } from "@prisma/client";
import { requireTenantUser } from "@/lib/authorization";

export default async function TenantAdminPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant, role } = await requireTenantUser(slug, [UserRole.TENANT_ADMIN]);

  return (
    <section className="space-y-3">
      <p className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Panel tenant</p>
      <h1 className="text-3xl font-bold">Halo, admin {tenant.nama}</h1>
      <p>Peran aktif: {role}. CRUD film, studio, dan jadwal masuk tahap berikutnya.</p>
    </section>
  );
}
