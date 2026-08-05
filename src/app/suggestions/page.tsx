import Link from "next/link";

export default function SuggestionsPage() {
  return (
    <main className="min-h-screen pb-28 md:pb-16">
      <div className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-8 sm:py-20">
        <p className="text-xs font-semibold tracking-[0.18em] text-emerald-700 uppercase">
          Suggestions
        </p>
        <h1 className="mt-3 max-w-2xl text-4xl leading-none font-semibold tracking-[-0.045em] text-emerald-950 sm:text-6xl">
          Recommendations are next.
        </h1>
        <div className="mt-8 rounded-[2rem] border border-emerald-950/10 bg-white/55 p-7 sm:p-10">
          <p className="max-w-xl text-sm leading-6 text-emerald-950/60">
            Context-aware outfit suggestions arrive in Phase 3. For now, build a
            look manually and ask for a focused critique.
          </p>
          <Link
            href="/builder"
            className="mt-6 inline-flex rounded-full bg-emerald-950 px-5 py-3 text-sm font-semibold text-white"
          >
            Open outfit builder
          </Link>
        </div>
      </div>
    </main>
  );
}
