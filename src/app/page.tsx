export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
      <section className="w-full max-w-2xl space-y-6 rounded-3xl border bg-white p-10 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Sistem Booking Tiket Bioskop</p>
        <h1 className="text-4xl font-bold">Pilih bioskop Anda</h1>
        <p className="text-zinc-600">Setiap tenant memiliki katalog dan akun terpisah.</p>
        <div className="flex flex-wrap gap-3">
          <a className="rounded-lg bg-zinc-900 px-4 py-2 text-white" href="http://aurora.localhost:3000">Bioskop Aurora</a>
          <a className="rounded-lg border px-4 py-2" href="http://bintang.localhost:3000">Bioskop Bintang</a>
          <a className="rounded-lg border px-4 py-2" href="/login">Login super admin</a>
        </div>
      </section>
    </main>
  );
}
