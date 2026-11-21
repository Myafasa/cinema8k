import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { prisma, withTenant } from "@/lib/db";
import { tenantSlugFromHost } from "@/lib/tenant-host";
import { verifyPassword } from "@/lib/password";

const credentialsSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});

const production = process.env.NODE_ENV === "production";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  cookies: {
    sessionToken: {
      name: production ? "__Secure-authjs.session-token" : "authjs.session-token",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: production },
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials, request) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
        if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) return null;

        const host = request.headers.get("host") ?? "";
        const rootDomain = (process.env.ROOT_DOMAIN ?? "localhost").toLowerCase();
        const hostname = host.split(":")[0].toLowerCase();
        const slug = tenantSlugFromHost(host, rootDomain);

        if (slug) {
          const tenant = await prisma.tenant.findUnique({ where: { subdomain: slug } });
          if (!tenant?.aktif) return null;
          const membership = await withTenant(tenant.id, (tx) =>
            tx.membership.findUnique({ where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } } }),
          );
          if (!membership) return null;
          return {
            id: user.id,
            email: user.email,
            name: user.nama,
            globalRole: user.globalRole,
            tenantId: tenant.id,
            role: membership.role,
          };
        }

        if (hostname.replace(/\.$/, "") !== rootDomain.replace(/^\.+|\.+$/g, "")) return null;
        if (user.globalRole !== "SUPER_ADMIN") return null;
        return { id: user.id, email: user.email, name: user.nama, globalRole: user.globalRole };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.globalRole = user.globalRole;
        token.tenantId = user.tenantId;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId;
        session.user.globalRole = token.globalRole;
        session.user.tenantId = token.tenantId;
        session.user.role = token.role;
      }
      return session;
    },
  },
});
