import { z } from "zod";

const slugSchema = z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/);

export function tenantSlugFromHost(host: string, rootDomain = process.env.ROOT_DOMAIN ?? "localhost") {
  const hostname = host.split(":")[0].toLowerCase().replace(/\.$/, "");
  const root = rootDomain.toLowerCase().replace(/^\.+|\.+$/g, "");
  if (hostname === root || !hostname.endsWith(`.${root}`)) return null;

  const slug = hostname.slice(0, -(root.length + 1));
  if (slug.includes(".")) return null;
  return slugSchema.safeParse(slug).success ? slug : null;
}
