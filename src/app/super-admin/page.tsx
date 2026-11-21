import { logoutAction } from "@/app/actions/auth";
import { requireSuperAdmin } from "@/lib/authorization";

export default async function SuperAdminPage() {
  const user = await requireSuperAdmin();
  return (
    <main className="mx-auto max-w-4xl space-y-5 p-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Domain utama</p>
          <h1 className="text-3xl font-bold">Super admin</h1>
        </div>
        <form action={logoutAction}><button className="rounded-lg border px-4 py-2">Keluar</button></form>
      </div>
      <p>Masuk sebagai {user.email}. Pengelolaan tenant akan ditambahkan pada tahap CRUD admin.</p>
    </main>
  );
}
