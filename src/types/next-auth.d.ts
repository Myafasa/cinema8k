import type { GlobalRole, UserRole } from "@prisma/client";

declare module "next-auth" {
  interface User {
    globalRole: GlobalRole;
    tenantId?: string;
    role?: UserRole;
  }

  interface Session {
    user: {
      id: string;
      globalRole: GlobalRole;
      tenantId?: string;
      role?: UserRole;
    } & NonNullable<Session["user"]>;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    globalRole: GlobalRole;
    tenantId?: string;
    role?: UserRole;
  }
}
