import { LoginForm } from "@/components/auth-forms";

export default async function RootLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-zinc-50 p-6">
      <div className="w-full max-w-sm">
        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-zinc-500">Domain utama</p>
        <h1 className="mb-5 text-3xl font-bold">Masuk sebagai super admin</h1>
      </div>
      <LoginForm
        error={typeof query.error === "string" ? query.error : undefined}
        registered={query.registered === "1"}
      />
    </main>
  );
}
