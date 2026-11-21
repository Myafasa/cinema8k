import { notFound } from "next/navigation";
import { prisma, withTenant } from "@/lib/db";
import { tenantSlugFromHost } from "@/lib/tenant-host";

export { tenantSlugFromHost };

export async function resolveTenant(slug: string) {
  const tenantSlug = tenantSlugFromHost(`${slug}.localhost`, "localhost");
  if (!tenantSlug || tenantSlug !== slug) notFound();

  const tenant = await prisma.tenant.findUnique({ where: { subdomain: tenantSlug } });
  if (!tenant?.aktif) notFound();
  return tenant;
}

export async function getMembership(tenantId: string, userId: string) {
  return withTenant(tenantId, (tx) =>
    tx.membership.findUnique({ where: { tenantId_userId: { tenantId, userId } } }),
  );
}
