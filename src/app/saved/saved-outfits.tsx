"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type WardrobeItem = { id: string; imageUrl: string; name: string };
type Outfit = { id: string; itemIds: string[]; createdAt: string };

export function SavedOutfits() {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const [outfitsResponse, itemsResponse] = await Promise.all([
        fetch("/api/outfits?status=saved", { cache: "no-store" }),
        fetch("/api/items", { cache: "no-store" }),
      ]);
      if (!outfitsResponse.ok || !itemsResponse.ok) throw new Error();
      const outfitBody = (await outfitsResponse.json()) as {
        outfits: Outfit[];
      };
      const itemBody = (await itemsResponse.json()) as {
        items: WardrobeItem[];
      };
      setOutfits(outfitBody.outfits);
      setItems(itemBody.items);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const itemMap = new Map(items.map((item) => [item.id, item]));

  return (
    <main className="min-h-screen pb-28 md:pb-16">
      <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <section className="flex flex-col gap-7 border-b border-emerald-950/10 pb-9 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-emerald-700 uppercase">
              Saved outfits
            </p>
            <h1 className="mt-3 text-4xl leading-none tracking-[-0.045em] text-emerald-950 sm:text-6xl">
              Looks worth returning to.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-emerald-950/58 sm:text-base">
              Your personal rotation, all in one place. Reopen any look to make
              it work for a different day.
            </p>
          </div>
          <Link
            href="/suggestions"
            className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-[#c7623d] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_35px_-22px_rgba(150,61,30,0.9)] transition hover:-translate-y-0.5 hover:bg-[#b75533]"
          >
            Find a new look&nbsp; →
          </Link>
        </section>

        {state === "loading" ? (
          <div className="mt-9 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                className="h-80 animate-pulse rounded-[2rem] bg-emerald-950/8"
              />
            ))}
          </div>
        ) : null}

        {state === "error" ? (
          <div className="mt-9 rounded-3xl bg-red-50 p-6 text-sm text-red-900">
            <p>Saved outfits could not be loaded.</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-4 rounded-full bg-red-950 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Try again
            </button>
          </div>
        ) : null}

        {state === "ready" && outfits.length === 0 ? (
          <div className="mt-9 rounded-[2rem] border border-dashed border-emerald-950/20 bg-white/40 px-6 py-14 text-center">
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-emerald-950">
              No saved looks yet
            </h2>
            <p className="mt-2 text-sm text-emerald-950/50">
              Assemble your first look in the manual builder.
            </p>
            <Link
              href="/builder"
              className="mt-5 inline-flex rounded-full bg-emerald-950 px-5 py-3 text-sm font-semibold text-white"
            >
              Build an outfit
            </Link>
          </div>
        ) : null}

        {state === "ready" && outfits.length > 0 ? (
          <section className="mt-8">
            <div className="mb-5 flex items-end justify-between px-1">
              <div>
                <h2 className="display-type text-2xl tracking-[-0.035em] text-emerald-950 sm:text-3xl">
                  Your rotation
                </h2>
                <p className="mt-1 text-xs text-emerald-950/45 sm:text-sm">
                  {outfits.length} saved{" "}
                  {outfits.length === 1 ? "look" : "looks"}
                </p>
              </div>
              <p className="hidden text-xs text-emerald-950/38 sm:block">
                Most recent first
              </p>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {outfits.map((outfit) => {
                const outfitItems = outfit.itemIds
                  .map((id) => itemMap.get(id))
                  .filter((item): item is WardrobeItem => Boolean(item));
                const builderQuery = new URLSearchParams({
                  items: outfit.itemIds.join(","),
                });
                return (
                  <article
                    key={outfit.id}
                    className="group overflow-hidden rounded-[2rem] border border-emerald-950/8 bg-[#fbfaf6]/78 p-3.5 shadow-[0_25px_60px_-48px_rgba(6,78,59,0.65)] transition hover:-translate-y-1 hover:bg-white hover:shadow-[0_30px_65px_-44px_rgba(6,78,59,0.68)]"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      {outfitItems.slice(0, 4).map((item) => (
                        <div
                          key={item.id}
                          className="relative aspect-square overflow-hidden rounded-2xl bg-emerald-950/5"
                        >
                          <Image
                            src={item.imageUrl}
                            alt={item.name}
                            fill
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 18vw"
                            className="object-cover transition duration-500 group-hover:scale-[1.025]"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between gap-4 px-1 pt-4 pb-1">
                      <div>
                        <p className="font-semibold tracking-[-0.015em] text-emerald-950">
                          {outfitItems.length}-piece outfit
                        </p>
                        <p className="mt-1 text-xs text-emerald-950/42">
                          Saved{" "}
                          {new Date(outfit.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Link
                        href={`/builder?${builderQuery}`}
                        className="shrink-0 rounded-full border border-emerald-950/12 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-950 transition hover:border-emerald-950/25"
                      >
                        Edit look
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
