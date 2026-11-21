import { RegisterForm } from "@/components/auth-forms";

export default function TenantRegisterPage() {
  return (
    <section className="space-y-5">
      <h1 className="text-3xl font-bold">Buat akun pelanggan</h1>
      <RegisterForm />
    </section>
  );
}
