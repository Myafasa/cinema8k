"use server";

import { TenantPlan, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/authorization";
import { prisma, withTenant } from "@/lib/db";
import { hashPassword } from "@/lib/password";

const tenantSchema = z.object({
  nama: z.string().trim().min(2).max(100),
  subdomain: z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/),
  plan: z.nativeEnum(TenantPlan),
  adminNama: z.string().trim().min(2).max(100),
  adminEmail: z.string().trim().email().max(254),
  adminPassword: z.string().min(10).max(128),
});
const planSchema = z.object({ id: z.string().uuid(), plan: z.nativeEnum(TenantPlan) });
const activeSchema = z.object({ id: z.string().uuid(), aktif: z.enum(["true", "false"]) });

function formValues(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function createTenantAction(formData: FormData) {
  await requireSuperAdmin();
  const parsed = tenantSchema.safeParse(formValues(formData));
  if (!parsed.success) redirect("/super-admin?error=invalid");
  const input = parsed.data;
  const tenant = await prisma.tenant.create({
    data: { nama: input.nama, subdomain: input.subdomain, plan: input.plan },
  }).catch((error: unknown) => {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      redirect("/super-admin?error=tenant-exists");
    }
    throw error;
  });

  const user = await prisma.user.upsert({
    where: { email: input.adminEmail.toLowerCase() },
    update: { nama: input.adminNama },
    create: {
      email: input.adminEmail.toLowerCase(),
      nama: input.adminNama,
      passwordHash: hashPassword(input.adminPassword),
    },
  });
  await withTenant(tenant.id, (tx) =>
    tx.membership.create({ data: { tenantId: tenant.id, userId: user.id, role: UserRole.TENANT_ADMIN } }),
  );

  revalidatePath("/super-admin");
  redirect("/super-admin?notice=tenant-created");
}

export async function updateTenantPlanAction(formData: FormData) {
  await requireSuperAdmin();
  const parsed = planSchema.safeParse(formValues(formData));
  if (!parsed.success) redirect("/super-admin?error=invalid");
  await prisma.tenant.updateMany({ where: { id: parsed.data.id }, data: { plan: parsed.data.plan } });
  revalidatePath("/super-admin");
  redirect("/super-admin?notice=tenant-updated");
}

export async function toggleTenantAction(formData: FormData) {
  await requireSuperAdmin();
  const parsed = activeSchema.safeParse(formValues(formData));
  if (!parsed.success) redirect("/super-admin?error=invalid");
  await prisma.tenant.updateMany({ where: { id: parsed.data.id }, data: { aktif: parsed.data.aktif === "true" } });
  revalidatePath("/super-admin");
  redirect("/super-admin?notice=tenant-updated");
}
