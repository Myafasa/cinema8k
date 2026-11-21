import { PrismaClient, GlobalRole, UserRole } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

const prisma = new PrismaClient();
const demoPassword = "Cinema123!";

function passwordHash(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

async function main() {
  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@bioskop.test" },
    update: { globalRole: GlobalRole.SUPER_ADMIN },
    create: {
      email: "superadmin@bioskop.test",
      nama: "Super Admin",
      passwordHash: passwordHash(demoPassword),
      globalRole: GlobalRole.SUPER_ADMIN,
    },
  });

  const samples = [
    {
      nama: "Bioskop Aurora",
      subdomain: "aurora",
      movie: {
        judul: "Senja Terakhir",
        durasiMenit: 118,
        sinopsis: "Dua sahabat pulang ke kota kecil untuk memulai kembali.",
        posterUrl: null,
      },
      adminEmail: "admin@aurora.test",
      cashierEmail: "kasir@aurora.test",
      customerEmail: "customer@aurora.test",
    },
    {
      nama: "Bioskop Bintang",
      subdomain: "bintang",
      movie: {
        judul: "Orbit Merah",
        durasiMenit: 132,
        sinopsis: "Misi penyelamatan membawa kru menjauh dari bumi.",
        posterUrl: null,
      },
      adminEmail: "admin@bintang.test",
      cashierEmail: "kasir@bintang.test",
      customerEmail: "customer@bintang.test",
    },
  ];

  for (const sample of samples) {
    const tenant = await prisma.tenant.upsert({
      where: { subdomain: sample.subdomain },
      update: { nama: sample.nama, aktif: true },
      create: { nama: sample.nama, subdomain: sample.subdomain },
    });

    const people = [
      { email: sample.adminEmail, nama: `Admin ${sample.nama}`, role: UserRole.TENANT_ADMIN },
      { email: sample.cashierEmail, nama: `Kasir ${sample.nama}`, role: UserRole.CASHIER },
      { email: sample.customerEmail, nama: `Pelanggan ${sample.nama}`, role: UserRole.CUSTOMER },
    ];
    const users = await Promise.all(
      people.map((person) =>
        prisma.user.upsert({
          where: { email: person.email },
          update: { nama: person.nama },
          create: {
            email: person.email,
            nama: person.nama,
            passwordHash: passwordHash(demoPassword),
          },
        }),
      ),
    );

    await prisma.$transaction(async (tx) => {
      // RLS applies to memberships and all cinema data, including the seed.
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenant.id}, true)`;
      for (let index = 0; index < people.length; index += 1) {
        await tx.membership.upsert({
          where: { tenantId_userId: { tenantId: tenant.id, userId: users[index].id } },
          update: { role: people[index].role },
          create: { tenantId: tenant.id, userId: users[index].id, role: people[index].role },
        });
      }

      let movie = await tx.movie.findFirst({ where: { tenantId: tenant.id, judul: sample.movie.judul } });
      if (!movie) movie = await tx.movie.create({ data: { tenantId: tenant.id, ...sample.movie } });

      let studio = await tx.studio.findFirst({ where: { tenantId: tenant.id, nama: "Studio 1" } });
      if (!studio) {
        studio = await tx.studio.create({
          data: { tenantId: tenant.id, nama: "Studio 1", jumlahBaris: 8, jumlahKolom: 10 },
        });
      }

      const existingShowtime = await tx.showtime.findFirst({
        where: { tenantId: tenant.id, movieId: movie.id, studioId: studio.id },
      });
      if (!existingShowtime) {
        const mulai = new Date();
        mulai.setDate(mulai.getDate() + 1);
        mulai.setHours(19, 0, 0, 0);
        await tx.showtime.create({
          data: { tenantId: tenant.id, movieId: movie.id, studioId: studio.id, mulai, harga: 50000 },
        });
      }
    });
  }

  console.log(`Seed selesai. Password demo semua akun: ${demoPassword}`);
  console.log(`Super admin: ${superAdmin.email}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
