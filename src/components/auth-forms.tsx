"use client";

import { useActionState } from "react";
import { loginAction, registerAction } from "@/app/actions/auth";

export function LoginForm({ error, registered }: { error?: string; registered?: boolean }) {
  return (
    <form action={loginAction} className="w-full max-w-sm space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <label className="block space-y-1 text-sm font-medium">
        Email
        <input className="w-full rounded-lg border p-2" name="email" type="email" autoComplete="email" required />
      </label>
      <label className="block space-y-1 text-sm font-medium">
        Password
        <input className="w-full rounded-lg border p-2" name="password" type="password" autoComplete="current-password" required />
      </label>
      {error === "credentials" && <p role="alert" className="text-sm text-red-700">Email atau password tidak valid untuk domain ini.</p>}
      {error === "input" && <p role="alert" className="text-sm text-red-700">Periksa kembali email dan password.</p>}
      {registered && <p className="text-sm text-green-700">Akun berhasil dibuat. Silakan masuk.</p>}
      <button className="w-full rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white">Masuk</button>
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, {});
  return (
    <form action={action} className="w-full max-w-sm space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <label className="block space-y-1 text-sm font-medium">
        Nama
        <input className="w-full rounded-lg border p-2" name="nama" autoComplete="name" required minLength={2} maxLength={100} />
      </label>
      <label className="block space-y-1 text-sm font-medium">
        Email
        <input className="w-full rounded-lg border p-2" name="email" type="email" autoComplete="email" required />
      </label>
      <label className="block space-y-1 text-sm font-medium">
        Password (minimal 10 karakter)
        <input className="w-full rounded-lg border p-2" name="password" type="password" autoComplete="new-password" required minLength={10} />
      </label>
      <label className="block space-y-1 text-sm font-medium">
        Konfirmasi password
        <input className="w-full rounded-lg border p-2" name="confirmPassword" type="password" autoComplete="new-password" required />
      </label>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <button disabled={pending} className="w-full rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-50">
        {pending ? "Membuat akun…" : "Daftar sebagai pelanggan"}
      </button>
    </form>
  );
}
