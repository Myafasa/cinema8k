import { withTenant } from "@/lib/db";

export type DailySalesRow = { tanggal: string; jumlah_booking: bigint; pendapatan: bigint };
export type FilmOccupancyRow = { judul: string; kapasitas: bigint; terjual: bigint };

export async function getTenantReports(tenantId: string) {
  return withTenant(tenantId, async (tx) => {
    const [sales, occupancy] = await Promise.all([
      tx.$queryRaw<DailySalesRow[]>`
        SELECT to_char((paid_at AT TIME ZONE 'Asia/Jakarta')::date, 'YYYY-MM-DD') AS tanggal,
               COUNT(*) AS jumlah_booking,
               COALESCE(SUM(total), 0) AS pendapatan
        FROM bookings
        WHERE tenant_id = ${tenantId}::uuid
          AND status = 'PAID'
          AND paid_at >= now() - interval '30 days'
        GROUP BY 1
        ORDER BY 1 DESC
      `,
      tx.$queryRaw<FilmOccupancyRow[]>`
        WITH sold_by_showtime AS (
          SELECT tenant_id, showtime_id, COUNT(*) AS terjual
          FROM booking_seats
          WHERE tenant_id = ${tenantId}::uuid AND status = 'SOLD'
          GROUP BY tenant_id, showtime_id
        )
        SELECT m.judul,
               SUM(studio.jumlah_baris * studio.jumlah_kolom) AS kapasitas,
               SUM(COALESCE(sold_by_showtime.terjual, 0)) AS terjual
        FROM showtimes st
        JOIN movies m ON m.tenant_id = st.tenant_id AND m.id = st.movie_id
        JOIN studios studio ON studio.tenant_id = st.tenant_id AND studio.id = st.studio_id
        LEFT JOIN sold_by_showtime
          ON sold_by_showtime.tenant_id = st.tenant_id AND sold_by_showtime.showtime_id = st.id
        WHERE st.tenant_id = ${tenantId}::uuid
          AND st.mulai >= now() - interval '30 days'
        GROUP BY m.id, m.judul
        ORDER BY m.judul
      `,
    ]);
    return { sales, occupancy };
  });
}
