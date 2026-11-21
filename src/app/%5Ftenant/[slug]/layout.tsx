import type { ReactNode } from "react";
import Link from "next/link";
import { resolveTenant } from "@/lib/tenant";

export default async function TenantLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await resolveTenant(slug);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link className="font-semibold" href="/">{tenant.nama}</Link>
          <nav className="flex gap-4 text-sm">
            <a href="/login">Masuk</a>
            <a href="/register">Daftar</a>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-10">{children}</main>
    </div>
  );
}
