"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { prisma, withTenant } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { tenantSlugFromHost } from "@/lib/tenant-host";

const loginSchema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(128) });
const registerSchema = z
  .object({
    nama: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(254),
    password: z.string().min(10).max(128),
    confirmPassword: z.string().min(1),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Konfirmasi password tidak sama.",
    path: ["confirmPassword"],
  });

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) redirect("/login?error=input");

  try {
    await signIn("credentials", {
      email: parsed.data.email.toLowerCase(),
      password: parsed.data.password,
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) redirect("/login?error=credentials");
    throw error;
  }
}

export type RegisterState = { error?: string };

export async function registerAction(_previous: RegisterState, formData: FormData): Promise<RegisterState> {
  const parsed = registerSchema.safeParse({
    nama: formData.get("nama"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data pendaftaran tidak valid." };

  const host = (await headers()).get("host") ?? "";
  const slug = tenantSlugFromHost(host);
  if (!slug) return { error: "Pendaftaran pelanggan hanya tersedia di domain bioskop." };
  const tenant = await prisma.tenant.findUnique({ where: { subdomain: slug } });
  if (!tenant?.aktif) return { error: "Bioskop tidak ditemukan atau sedang nonaktif." };

  try {
    const passwordHash = hashPassword(parsed.data.password);
    await withTenant(tenant.id, async (tx) => {
      const user = await tx.user.create({
        data: {
          email: parsed.data.email.toLowerCase(),
          nama: parsed.data.nama,
          passwordHash,
        },
      });
      await tx.membership.create({
        data: { tenantId: tenant.id, userId: user.id, role: "CUSTOMER" },
      });
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return { error: "Email sudah terdaftar." };
    }
    throw error;
  }

  redirect("/login?registered=1");
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}
