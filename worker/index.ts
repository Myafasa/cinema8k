import cron from "node-cron";
import { prisma } from "../src/lib/db";
import { expireExpiredBookings } from "../src/lib/booking-expiry";

async function runExpiry() {
  try {
    const count = await expireExpiredBookings();
    if (count > 0) console.log(`Worker: ${count} booking kedaluwarsa dilepas.`);
  } catch (error) {
    console.error("Worker gagal memproses booking kedaluwarsa:", error);
  }
}

const task = cron.schedule("* * * * *", () => void runExpiry());
console.log("Worker booking aktif; expiry berjalan setiap menit.");
void runExpiry();

async function shutdown() {
  task.stop();
  await prisma.$disconnect();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
