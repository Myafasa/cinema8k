import { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";

const globalForPrisma = globalThis as typeof globalThis & { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const tenantIdSchema = z.string().uuid();

// Tenant-scoped queries share one transaction-local RLS context; it cannot leak through pool reuse.
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const id = tenantIdSchema.parse(tenantId);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${id}, true)`;
    return fn(tx);
  });
}
