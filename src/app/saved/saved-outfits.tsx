"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

type WardrobeItem = { id: string; imageUrl: string; name: string };
type Outfit = { id: string; itemIds: string[]; createdAt: string };

export function SavedOutfits() {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    async function load() {
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
    }
    void load();
  }, []);

  const itemMap = new Map(items.map((item) => [item.id, item]));

  return (
    <main className="min-h-screen pb-28 md:pb-16">
      <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <p className="text-xs font-semibold tracking-[0.18em] text-emerald-700 uppercase">
          Saved outfits
        </p>
        <h1 className="mt-3 text-4xl leading-none font-semibold tracking-[-0.045em] text-emerald-950 sm:text-6xl">
          Looks worth returning to.
        </h1>

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
          <p className="mt-9 rounded-3xl bg-red-50 p-6 text-sm text-red-900">
            Saved outfits could not be loaded. Refresh to try again.
          </p>
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
          <div className="mt-9 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {outfits.map((outfit) => {
              const outfitItems = outfit.itemIds
                .map((id) => itemMap.get(id))
                .filter((item): item is WardrobeItem => Boolean(item));
              return (
                <article
                  key={outfit.id}
                  className="overflow-hidden rounded-[2rem] border border-emerald-950/10 bg-white/65 p-4"
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
                          sizes="25vw"
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 font-semibold text-emerald-950">
                    {outfitItems.length} piece outfit
                  </p>
                  <p className="mt-1 text-xs text-emerald-950/45">
                    Saved {new Date(outfit.createdAt).toLocaleDateString()}
                  </p>
                </article>
              );
            })}
          </div>
        ) : null}
      </div>
    </main>
  );
}
