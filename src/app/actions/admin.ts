"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTenantUser } from "@/lib/authorization";
import { withTenant } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { parseJakartaDateTimeLocal } from "@/lib/seat-codes";

const contextSchema = z.object({ slug: z.string().min(1).max(63) });
const movieSchema = contextSchema.extend({
  id: z.string().uuid().optional(),
  judul: z.string().trim().min(1).max(160),
  durasiMenit: z.coerce.number().int().positive().max(600),
  sinopsis: z.string().trim().max(5000),
  posterUrl: z.union([z.string().url().max(2048), z.literal("")]).optional(),
});
const studioSchema = contextSchema.extend({
  id: z.string().uuid().optional(),
  nama: z.string().trim().min(1).max(80),
  jumlahBaris: z.coerce.number().int().positive().max(100),
  jumlahKolom: z.coerce.number().int().positive().max(100),
});
const showtimeSchema = contextSchema.extend({
  id: z.string().uuid().optional(),
  movieId: z.string().uuid(),
  studioId: z.string().uuid(),
  mulai: z.string().min(1),
  harga: z.coerce.number().int().positive().max(10_000_000),
});
const idSchema = contextSchema.extend({ id: z.string().uuid() });
const staffSchema = contextSchema.extend({
  nama: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(128),
  role: z.enum(["TENANT_ADMIN", "CASHIER"]),
});
const staffUpdateSchema = contextSchema.extend({
  userId: z.string().uuid(),
  nama: z.string().trim().min(2).max(100),
  role: z.enum(["TENANT_ADMIN", "CASHIER"]),
});
const staffDeleteSchema = contextSchema.extend({ userId: z.string().uuid() });

function values(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function redirectAdmin(slug: string, query: string): never {
  revalidatePath(`/_tenant/${slug}/admin`);
  redirect(`/admin?${query}`);
}

function isConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2003", "P2014"].includes(error.code);
}

class AdminConflictError extends Error {}

export async function saveMovieAction(formData: FormData) {
  const parsed = movieSchema.safeParse(values(formData));
  if (!parsed.success) redirect("/admin?error=invalid");
  const { slug, id, judul, durasiMenit, sinopsis, posterUrl } = parsed.data;
  const { tenant } = await requireTenantUser(slug, ["TENANT_ADMIN"]);
  try {
    await withTenant(tenant.id, async (tx) => {
      if (id) {
        await tx.movie.updateMany({
          where: { id, tenantId: tenant.id },
          data: { judul, durasiMenit, sinopsis, posterUrl: posterUrl || null },
        });
      } else {
        await tx.movie.create({
          data: { tenantId: tenant.id, judul, durasiMenit, sinopsis, posterUrl: posterUrl || null },
        });
      }
    });
  } catch (error) {
    if (isConstraintError(error)) redirectAdmin(slug, "error=movie-in-use");
    throw error;
  }
  redirectAdmin(slug, "notice=movie-saved");
}

export async function deleteMovieAction(formData: FormData) {
  const parsed = idSchema.safeParse(values(formData));
  if (!parsed.success) redirect("/admin?error=invalid");
  const { slug, id } = parsed.data;
  const { tenant } = await requireTenantUser(slug, ["TENANT_ADMIN"]);
  try {
    await withTenant(tenant.id, (tx) => tx.movie.deleteMany({ where: { id, tenantId: tenant.id } }));
  } catch (error) {
    if (isConstraintError(error)) redirectAdmin(slug, "error=movie-in-use");
    throw error;
  }
  redirectAdmin(slug, "notice=movie-deleted");
}

export async function saveStudioAction(formData: FormData) {
  const parsed = studioSchema.safeParse(values(formData));
  if (!parsed.success) redirect("/admin?error=invalid");
  const { slug, id, nama, jumlahBaris, jumlahKolom } = parsed.data;
  const { tenant } = await requireTenantUser(slug, ["TENANT_ADMIN"]);
  try {
    await withTenant(tenant.id, async (tx) => {
      if (id) {
        const current = await tx.studio.findFirst({ where: { id, tenantId: tenant.id } });
        if (!current) return;
        const layoutChanged = current.jumlahBaris !== jumlahBaris || current.jumlahKolom !== jumlahKolom;
        if (layoutChanged) {
          const hasBookings = await tx.showtime.findFirst({
            where: { tenantId: tenant.id, studioId: id, bookings: { some: {} } },
            select: { id: true },
          });
          if (hasBookings) throw new AdminConflictError("Layout already used by bookings");
        }
        await tx.studio.updateMany({
          where: { id, tenantId: tenant.id },
          data: { nama, jumlahBaris, jumlahKolom },
        });
      } else {
        await tx.studio.create({ data: { tenantId: tenant.id, nama, jumlahBaris, jumlahKolom } });
      }
    });
  } catch (error) {
    if (error instanceof AdminConflictError) redirectAdmin(slug, "error=layout-in-use");
    if (isConstraintError(error)) redirectAdmin(slug, "error=studio-in-use");
    throw error;
  }
  redirectAdmin(slug, "notice=studio-saved");
}

export async function deleteStudioAction(formData: FormData) {
  const parsed = idSchema.safeParse(values(formData));
  if (!parsed.success) redirect("/admin?error=invalid");
  const { slug, id } = parsed.data;
  const { tenant } = await requireTenantUser(slug, ["TENANT_ADMIN"]);
  try {
    await withTenant(tenant.id, (tx) => tx.studio.deleteMany({ where: { id, tenantId: tenant.id } }));
  } catch (error) {
    if (isConstraintError(error)) redirectAdmin(slug, "error=studio-in-use");
    throw error;
  }
  redirectAdmin(slug, "notice=studio-deleted");
}

export async function saveShowtimeAction(formData: FormData) {
  const parsed = showtimeSchema.safeParse(values(formData));
  if (!parsed.success) redirect("/admin?error=invalid");
  const { slug, id, movieId, studioId, mulai, harga } = parsed.data;
  const mulaiDate = parseJakartaDateTimeLocal(mulai);
  if (!mulaiDate) redirect("/admin?error=invalid-date");
  const { tenant } = await requireTenantUser(slug, ["TENANT_ADMIN"]);

  try {
    await withTenant(tenant.id, async (tx) => {
      const [movie, studio] = await Promise.all([
        tx.movie.findFirst({ where: { id: movieId, tenantId: tenant.id }, select: { id: true } }),
        tx.studio.findFirst({ where: { id: studioId, tenantId: tenant.id }, select: { id: true } }),
      ]);
      if (!movie || !studio) throw new Error("Tenant relation not found");
      if (id) {
        const current = await tx.showtime.findFirst({ where: { id, tenantId: tenant.id } });
        if (!current) return;
        const eventChanged = current.movieId !== movieId || current.studioId !== studioId || current.mulai.getTime() !== mulaiDate.getTime();
        if (eventChanged) {
          const hasBookings = await tx.booking.findFirst({ where: { tenantId: tenant.id, showtimeId: id }, select: { id: true } });
          if (hasBookings) throw new AdminConflictError("Showtime already used by bookings");
        }
        await tx.showtime.updateMany({
          where: { id, tenantId: tenant.id },
          data: { movieId, studioId, mulai: mulaiDate, harga },
        });
      } else {
        await tx.showtime.create({ data: { tenantId: tenant.id, movieId, studioId, mulai: mulaiDate, harga } });
      }
    });
  } catch (error) {
    if (error instanceof AdminConflictError) redirectAdmin(slug, "error=showtime-in-use");
    if (isConstraintError(error)) redirectAdmin(slug, "error=showtime-in-use");
    throw error;
  }
  redirectAdmin(slug, "notice=showtime-saved");
}

export async function deleteShowtimeAction(formData: FormData) {
  const parsed = idSchema.safeParse(values(formData));
  if (!parsed.success) redirect("/admin?error=invalid");
  const { slug, id } = parsed.data;
  const { tenant } = await requireTenantUser(slug, ["TENANT_ADMIN"]);
  try {
    await withTenant(tenant.id, (tx) => tx.showtime.deleteMany({ where: { id, tenantId: tenant.id } }));
  } catch (error) {
    if (isConstraintError(error)) redirectAdmin(slug, "error=showtime-in-use");
    throw error;
  }
  redirectAdmin(slug, "notice=showtime-deleted");
}

export async function saveStaffAction(formData: FormData) {
  const parsed = staffSchema.safeParse(values(formData));
  if (!parsed.success) redirect("/admin?error=invalid");
  const { slug, nama, email, password, role } = parsed.data;
  const { tenant } = await requireTenantUser(slug, ["TENANT_ADMIN"]);
  const passwordHash = hashPassword(password);
  try {
    await withTenant(tenant.id, async (tx) => {
      const existingUser = await tx.user.findUnique({ where: { email: email.toLowerCase() } });
      if (existingUser) {
        const membership = await tx.membership.findUnique({
          where: { tenantId_userId: { tenantId: tenant.id, userId: existingUser.id } },
        });
        if (!membership || !["TENANT_ADMIN", "CASHIER"].includes(membership.role)) {
          throw new AdminConflictError("Email already used");
        }
        await tx.user.update({ where: { id: existingUser.id }, data: { nama } });
        await tx.membership.update({ where: { id: membership.id }, data: { role } });
        return;
      }

      const user = await tx.user.create({
        data: { email: email.toLowerCase(), nama, passwordHash },
      });
      await tx.membership.create({ data: { tenantId: tenant.id, userId: user.id, role } });
    });
  } catch (error) {
    if (error instanceof AdminConflictError) redirectAdmin(slug, "error=staff-email-used");
    if (isConstraintError(error)) redirectAdmin(slug, "error=staff-email-used");
    throw error;
  }
  redirectAdmin(slug, "notice=staff-saved");
}

export async function updateStaffAction(formData: FormData) {
  const parsed = staffUpdateSchema.safeParse(values(formData));
  if (!parsed.success) redirect("/admin?error=invalid");
  const { slug, userId, nama, role } = parsed.data;
  const { tenant, userId: actorId } = await requireTenantUser(slug, ["TENANT_ADMIN"]);
  await withTenant(tenant.id, async (tx) => {
    const current = await tx.membership.findUnique({ where: { tenantId_userId: { tenantId: tenant.id, userId } } });
    if (!current || !["TENANT_ADMIN", "CASHIER"].includes(current.role)) return;
    if (current.role === "TENANT_ADMIN" && role !== "TENANT_ADMIN") {
      const admins = await tx.membership.count({ where: { tenantId: tenant.id, role: "TENANT_ADMIN" } });
      if (admins <= 1) throw new AdminConflictError("Cannot remove last admin");
    }
    await tx.user.update({ where: { id: userId }, data: { nama } });
    await tx.membership.update({ where: { id: current.id }, data: { role } });
  }).catch((error: unknown) => {
    if (error instanceof AdminConflictError) redirectAdmin(slug, "error=last-admin");
    throw error;
  });
  if (userId === actorId && role !== "TENANT_ADMIN") redirect("/login?notice=role-updated");
  redirectAdmin(slug, "notice=staff-saved");
}

export async function removeStaffAction(formData: FormData) {
  const parsed = staffDeleteSchema.safeParse(values(formData));
  if (!parsed.success) redirect("/admin?error=invalid");
  const { slug, userId } = parsed.data;
  const { tenant } = await requireTenantUser(slug, ["TENANT_ADMIN"]);
  await withTenant(tenant.id, async (tx) => {
    const current = await tx.membership.findUnique({ where: { tenantId_userId: { tenantId: tenant.id, userId } } });
    if (!current || !["TENANT_ADMIN", "CASHIER"].includes(current.role)) return;
    if (current.role === "TENANT_ADMIN") {
      const admins = await tx.membership.count({ where: { tenantId: tenant.id, role: "TENANT_ADMIN" } });
      if (admins <= 1) throw new AdminConflictError("Cannot remove last admin");
    }
    await tx.membership.delete({ where: { id: current.id } });
  }).catch((error: unknown) => {
    if (error instanceof AdminConflictError) redirectAdmin(slug, "error=last-admin");
    throw error;
  });
  redirectAdmin(slug, "notice=staff-removed");
}
