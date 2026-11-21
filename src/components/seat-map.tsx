"use client";

import { useEffect, useState } from "react";
import { holdSeatsAction } from "@/app/actions/bookings";
import { seatRowCode } from "@/lib/seat-codes";

type SeatMapProps = {
  slug: string;
  showtimeId: string;
  rows: number;
  columns: number;
  initialOccupied: string[];
};

export function SeatMap({ slug, showtimeId, rows, columns, initialOccupied }: SeatMapProps) {
  const [occupied, setOccupied] = useState(() => new Set(initialOccupied));
  const [selected, setSelected] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/showtimes/${showtimeId}/seats`, { cache: "no-store" });
        if (!response.ok) return;
        const data: { occupied: string[] } = await response.json();
        if (active) {
          const latest = new Set(data.occupied);
          setOccupied(latest);
          setSelected((current) => current.filter((seat) => !latest.has(seat)));
        }
      } catch {
        // The next five-second poll retries transient connection failures.
      } finally {
        if (active) setRefreshing(false);
      }
    };

    const timer = window.setInterval(() => {
      setRefreshing(true);
      void refresh();
    }, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [showtimeId]);

  function toggle(code: string) {
    if (occupied.has(code)) return;
    setSelected((current) => {
      if (current.includes(code)) return current.filter((seat) => seat !== code);
      return current.length < 10 ? [...current, code] : current;
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-4 text-xs text-zinc-600">
        <span><i className="mr-2 inline-block size-3 rounded border bg-white" />Tersedia</span>
        <span><i className="mr-2 inline-block size-3 rounded bg-zinc-400" />Dipilih</span>
        <span><i className="mr-2 inline-block size-3 rounded bg-red-700" />Terisi</span>
        <span className="ml-auto">{refreshing ? "Memperbarui…" : "Kursi diperbarui tiap 5 detik"}</span>
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-white p-5">
        <div className="mx-auto mb-8 h-2 min-w-80 max-w-2xl rounded-full bg-zinc-300" />
        <div className="mx-auto grid w-fit gap-2" style={{ gridTemplateColumns: `repeat(${columns + 1}, minmax(2.25rem, 1fr))` }}>
          <span />
          {Array.from({ length: columns }, (_, column) => <span key={`h${column}`} className="grid size-9 place-items-center text-xs text-zinc-500">{column + 1}</span>)}
          {Array.from({ length: rows }, (_, row) => {
            const rowCode = seatRowCode(row);
            return (
              <div key={rowCode} className="contents">
                <span className="grid size-9 place-items-center text-xs font-semibold text-zinc-500">{rowCode}</span>
                {Array.from({ length: columns }, (_, column) => {
                  const code = `${rowCode}${column + 1}`;
                  const isOccupied = occupied.has(code);
                  const isSelected = selected.includes(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      disabled={isOccupied}
                      aria-pressed={isSelected}
                      aria-label={`Kursi ${code}${isOccupied ? ", terisi" : ""}`}
                      onClick={() => toggle(code)}
                      className={`size-9 rounded-t-lg border text-[10px] transition ${isOccupied ? "cursor-not-allowed border-red-800 bg-red-700 text-white" : isSelected ? "border-zinc-500 bg-zinc-400 text-white" : "border-zinc-300 bg-white hover:border-zinc-600"}`}
                    >{column + 1}</button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <form action={holdSeatsAction} className="space-y-3">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="showtimeId" value={showtimeId} />
        {selected.map((seat) => <input key={seat} type="hidden" name="seats" value={seat} />)}
        <p className="text-sm text-zinc-600">Kursi pilihan: {selected.length > 0 ? selected.join(", ") : "belum dipilih"} (maksimal 10 kursi)</p>
        <button type="submit" disabled={selected.length === 0} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
          Pesan kursi
        </button>
      </form>
    </div>
  );
}
