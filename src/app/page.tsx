const foundations = [
  {
    title: "Wardrobe data",
    detail: "Postgres schema and repeatable migrations are ready.",
  },
  {
    title: "Private AI client",
    detail: "OpenAI credentials stay inside server-only modules.",
  },
  {
    title: "Image storage",
    detail: "Validated JPEG, PNG, and WebP uploads persist locally.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-between px-5 py-8 sm:px-8 sm:py-12">
      <section>
        <div className="mb-14 flex items-center justify-between">
          <p className="text-lg font-semibold tracking-tight">wadrobe</p>
          <span className="rounded-full border border-emerald-900/15 bg-white/70 px-3 py-1 text-xs font-medium text-emerald-950">
            Phase 0
          </span>
        </div>

        <div className="max-w-2xl">
          <p className="mb-4 text-sm font-medium tracking-[0.18em] text-emerald-800 uppercase">
            Your closet, considered
          </p>
          <h1 className="text-5xl leading-[0.98] font-semibold tracking-[-0.05em] text-balance sm:text-7xl">
            A smarter foundation for getting dressed.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-emerald-950/70 sm:text-lg">
            The application shell, storage, database, and secure AI boundary are
            in place. Wardrobe ingestion comes next.
          </p>
        </div>

        <div className="mt-12 grid gap-3 sm:grid-cols-3">
          {foundations.map((foundation, index) => (
            <article
              className="rounded-3xl border border-emerald-950/10 bg-white/65 p-5 shadow-[0_18px_50px_-35px_rgba(6,78,59,0.65)] backdrop-blur"
              key={foundation.title}
            >
              <p className="mb-8 text-xs font-semibold text-emerald-800/70">
                0{index + 1}
              </p>
              <h2 className="font-semibold">{foundation.title}</h2>
              <p className="mt-2 text-sm leading-6 text-emerald-950/65">
                {foundation.detail}
              </p>
            </article>
          ))}
        </div>
      </section>

      <footer className="mt-16 border-t border-emerald-950/10 pt-5 text-xs text-emerald-950/55">
        Images are analyzed once. Outfit reasoning stays fast and text-only.
      </footer>
    </main>
  );
}
