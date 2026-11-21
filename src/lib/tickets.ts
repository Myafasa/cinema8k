import { withTenant } from "@/lib/db";

// The guarded update makes ticket validation atomic even when two cashiers scan at once.
export async function consumeTicket(tenantId: string, code: string) {
  return withTenant(tenantId, (tx) =>
    tx.$executeRaw`UPDATE tickets SET used_at = now() WHERE kode = ${code} AND used_at IS NULL`,
  );
}
