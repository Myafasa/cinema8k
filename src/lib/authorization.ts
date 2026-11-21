import { UserRole } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma, withTenant } from "@/lib/db";
import { resolveTenant } from "@/lib/tenant";

export async function requireTenantUser(slug: string, allowedRoles?: UserRole[]) {
  const tenant = await resolveTenant(slug);
  const session = await auth();
  if (!session?.user?.id || session.user.tenantId !== tenant.id) redirect("/login");

  // Check membership again so role changes or removals take effect before the JWT expires.
  const membership = await withTenant(tenant.id, (tx) =>
    tx.membership.findUnique({
      where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    }),
  );
  if (!membership) redirect("/login");
  if (allowedRoles && !allowedRoles.includes(membership.role)) notFound();

  return { tenant, userId: session.user.id, role: membership.role };
}

export async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.globalRole !== "SUPER_ADMIN") redirect("/login");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, globalRole: true },
  });
  if (!user || user.globalRole !== "SUPER_ADMIN") redirect("/login");
  return user;
}
