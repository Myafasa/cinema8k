import { LoginForm } from "@/components/auth-forms";

export default async function TenantLoginPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return (
    <section className="space-y-5">
      <h1 className="text-3xl font-bold">Masuk ke akun bioskop</h1>
      <LoginForm
        error={typeof query.error === "string" ? query.error : undefined}
        registered={query.registered === "1"}
      />
    </section>
  );
}
