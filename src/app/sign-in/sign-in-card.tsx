"use client";

import { useState } from "react";

import { authClient } from "@/lib/auth-client";

export function SignInCard({ callbackUrl }: { callbackUrl: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function signIn() {
    setError(null);
    setPending(true);

    const result = await authClient.signIn.social({
      callbackURL: callbackUrl,
      provider: "github",
    });

    if (result.error) {
      setError("GitHub sign-in could not be started. Please try again.");
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-5 py-12">
      <section className="w-full max-w-md rounded-[2rem] border border-emerald-950/10 bg-white/70 p-8 text-center shadow-[0_28px_80px_-42px_rgba(6,78,59,0.5)] backdrop-blur-xl sm:p-10">
        <span className="display-type mx-auto grid h-14 w-14 place-items-center rounded-[1.2rem] bg-emerald-950 text-xl text-white">
          w.
        </span>
        <p className="mt-7 text-xs font-semibold tracking-[0.2em] text-emerald-800 uppercase">
          Your closet, private
        </p>
        <h1 className="display-type mt-3 text-4xl tracking-[-0.04em] text-emerald-950">
          Sign in to Wadrobe
        </h1>
        <p className="mt-4 text-sm leading-6 text-emerald-950/60">
          Your wardrobe, outfits, feedback, and photos are isolated to your
          account.
        </p>
        <button
          type="button"
          onClick={signIn}
          disabled={pending}
          className="mt-8 flex min-h-12 w-full items-center justify-center rounded-full bg-emerald-950 px-5 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Opening GitHub…" : "Continue with GitHub"}
        </button>
        {error ? (
          <p className="mt-4 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        <p className="mt-6 text-xs leading-5 text-emerald-950/45">
          Account access and recovery are managed by GitHub.
        </p>
      </section>
    </main>
  );
}
