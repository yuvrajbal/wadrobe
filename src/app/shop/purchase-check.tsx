"use client";

import Image from "next/image";
import Link from "next/link";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { notifications, safeNotificationMessage } from "@/lib/notifications";
import type {
  CategoryCounts,
  PurchaseCheck as PurchaseCheckResult,
  PurchaseVerdict,
} from "@/lib/purchase-check-schema";
import {
  ACCEPTED_IMAGE_TYPES,
  prepareImageForUpload,
} from "@/lib/resize-image";

type Category = keyof CategoryCounts;
type WardrobeItem = {
  id: string;
  imageUrl: string;
  name: string;
  category: Category;
};
type Photo = { file: File; previewUrl: string };

const fieldClass =
  "mt-2 w-full rounded-2xl border border-ink/15 bg-card px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-emerald-700 dark:focus:border-emerald-400 focus:ring-4 focus:ring-emerald-700/10 dark:focus:ring-emerald-400/10";

const categoryLabels: Record<Category, [singular: string, plural: string]> = {
  top: ["top", "tops"],
  bottom: ["bottom", "bottoms"],
  shoes: ["pair of shoes", "pairs of shoes"],
  outerwear: ["layer", "layers"],
  accessory: ["accessory", "accessories"],
};

const verdictStyles: Record<
  PurchaseVerdict,
  { label: string; className: string }
> = {
  buy: { label: "Buy it", className: "bg-brand text-white" },
  maybe: {
    label: "Maybe",
    className:
      "bg-amber-100 text-amber-950 dark:bg-amber-900/50 dark:text-amber-50",
  },
  skip: { label: "Skip it", className: "bg-[#c7623d] text-white" },
};

async function responseError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return body?.error ?? fallback;
}

function errorMessage(error: unknown, fallback: string) {
  return safeNotificationMessage(
    error instanceof Error ? error.message : null,
    fallback,
  );
}

export function PurchaseCheck() {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [itemsState, setItemsState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [price, setPrice] = useState("");
  const [checkState, setCheckState] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [checkError, setCheckError] = useState("");
  const [check, setCheck] = useState<PurchaseCheckResult | null>(null);
  const [addState, setAddState] = useState<
    "idle" | "loading" | "added" | "error"
  >("idle");

  const loadItems = useCallback(async () => {
    setItemsState("loading");
    try {
      const response = await fetch("/api/items", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const body = (await response.json()) as { items: WardrobeItem[] };
      setItems(body.items);
      setItemsState("ready");
      notifications.dismiss("shop-wardrobe-load");
    } catch {
      setItemsState("error");
      notifications.error({
        id: "shop-wardrobe-load",
        title: "Couldn’t load your wardrobe.",
        description: "Your wardrobe is needed to compare the new piece.",
      });
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadItems();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadItems]);

  useEffect(() => {
    if (!photo) return;
    return () => URL.revokeObjectURL(photo.previewUrl);
  }, [photo]);

  const itemMap = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  );

  function reset() {
    setPhoto(null);
    setPrice("");
    setCheck(null);
    setCheckState("idle");
    setCheckError("");
    setAddState("idle");
  }

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const original = event.target.files?.[0];
    event.target.value = "";
    if (!original) return;

    setPreparing(true);
    setCheck(null);
    setCheckState("idle");
    setCheckError("");
    setAddState("idle");
    try {
      const file = await prepareImageForUpload(original);
      setPhoto({ file, previewUrl: URL.createObjectURL(file) });
    } catch (error) {
      setPhoto(null);
      setCheckState("error");
      setCheckError(
        errorMessage(error, "This photo could not be read. Try another one."),
      );
    } finally {
      setPreparing(false);
    }
  }

  async function runCheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photo) {
      setCheckState("error");
      setCheckError("Take or choose a photo of the item first.");
      return;
    }
    const trimmedPrice = price.trim();
    if (
      trimmedPrice !== "" &&
      !(Number.isFinite(Number(trimmedPrice)) && Number(trimmedPrice) > 0)
    ) {
      setCheckState("error");
      setCheckError("Enter the price as a positive number, or leave it empty.");
      return;
    }

    const formData = new FormData();
    formData.set("file", photo.file);
    if (trimmedPrice !== "") formData.set("price", trimmedPrice);

    setCheckState("loading");
    setCheckError("");
    setCheck(null);
    setAddState("idle");

    try {
      const response = await fetch("/api/purchase-checks", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error(
          await responseError(response, "The item could not be checked."),
        );
      }
      const body = (await response.json()) as { check: PurchaseCheckResult };
      setCheck(body.check);
      setCheckState("success");
    } catch (error) {
      const message = errorMessage(
        error,
        "The item could not be checked. Please try again.",
      );
      setCheckState("error");
      setCheckError(message);
      notifications.error({
        id: "purchase-check",
        title: "Couldn’t check this item.",
        description: message,
      });
    }
  }

  async function addToWardrobe() {
    if (!photo || !check) return;
    setAddState("loading");

    const formData = new FormData();
    formData.set("file", photo.file);
    formData.set("attributes", JSON.stringify(check.candidate));

    try {
      const response = await fetch("/api/items", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error(
          await responseError(response, "The item could not be added."),
        );
      }
      const body = (await response.json()) as { item: WardrobeItem };
      setItems((current) => [body.item, ...current]);
      setAddState("added");
      notifications.success({
        id: "purchase-check-add",
        title: `${check.candidate.name} added to your wardrobe.`,
      });
    } catch (error) {
      setAddState("error");
      notifications.error({
        id: "purchase-check-add",
        title: "Couldn’t add it to your wardrobe.",
        description: errorMessage(error, "Please try again."),
      });
    }
  }

  return (
    <main className="min-h-screen pb-32 md:pb-16">
      <div className="mx-auto w-full max-w-7xl px-5 py-9 sm:px-8 sm:py-14">
        <section className="max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.18em] text-emerald-700 uppercase dark:text-emerald-300">
            Check before you buy
          </p>
          <h1 className="mt-3 text-4xl leading-none font-semibold tracking-[-0.045em] text-ink sm:text-6xl">
            Will it earn its hanger?
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-ink/60 sm:text-base">
            Snap the piece you’re eyeing. Wadrobe compares it with everything
            you own and tells you how much it would get worn, or whether you
            already have it.
          </p>
        </section>

        <div className="mt-9 grid gap-7 lg:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)] lg:items-start">
          <form
            onSubmit={runCheck}
            className="rounded-[2rem] border border-ink/10 bg-card/60 p-5 sm:p-7 lg:sticky lg:top-24"
          >
            <h2 className="text-xl font-semibold tracking-[-0.025em] text-ink">
              What are you looking at?
            </h2>

            <label
              className={`mt-6 block overflow-hidden rounded-[1.4rem] border border-dashed border-ink/20 bg-sheet transition focus-within:ring-4 focus-within:ring-emerald-700/15 ${
                preparing ? "cursor-wait opacity-70" : "cursor-pointer"
              }`}
            >
              {photo ? (
                <span className="relative block aspect-[4/5]">
                  <Image
                    src={photo.previewUrl}
                    unoptimized
                    alt="Item you’re considering"
                    fill
                    sizes="(max-width: 1024px) 90vw, 30vw"
                    className="object-cover"
                  />
                  <span className="absolute right-3 bottom-3 rounded-full bg-emerald-950/75 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
                    Change photo
                  </span>
                </span>
              ) : (
                <span className="grid aspect-[4/3] place-items-center p-6 text-center">
                  <span>
                    <span
                      className="block text-3xl text-ink/35"
                      aria-hidden="true"
                    >
                      ◎
                    </span>
                    <span className="mt-3 block text-sm font-semibold text-ink">
                      {preparing
                        ? "Preparing photo…"
                        : "Take or choose a photo"}
                    </span>
                    <span className="mt-1 block text-xs text-ink/45">
                      Hanger, rack, or flat lay works best.
                    </span>
                  </span>
                </span>
              )}
              <input
                className="sr-only"
                type="file"
                accept={ACCEPTED_IMAGE_TYPES}
                aria-label="Item photo"
                disabled={preparing || checkState === "loading"}
                onChange={(event) => void choosePhoto(event)}
              />
            </label>

            <label className="mt-5 block text-sm font-semibold text-ink/75">
              Price <span className="font-normal text-ink/40">(optional)</span>
              <input
                className={fieldClass}
                value={price}
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                placeholder="79"
                onChange={(event) => setPrice(event.target.value)}
              />
            </label>

            {checkError ? (
              <p
                role="alert"
                className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm leading-5 text-red-900 dark:bg-red-950/40 dark:text-red-200"
              >
                {checkError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={
                preparing ||
                checkState === "loading" ||
                itemsState !== "ready" ||
                items.length === 0
              }
              className="mt-6 min-h-12 w-full rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
            >
              {checkState === "loading" ? "Comparing…" : "Check it"}
            </button>
          </form>

          <section aria-live="polite">
            {itemsState === "loading" ? <CheckSkeleton /> : null}

            {itemsState === "error" ? (
              <div className="rounded-[2rem] bg-red-50 p-7 text-red-950 dark:bg-red-950/40 dark:text-red-100">
                <h2 className="font-semibold">
                  Your wardrobe could not be loaded.
                </h2>
                <button
                  type="button"
                  onClick={() => void loadItems()}
                  className="mt-5 rounded-full bg-red-950 px-5 py-2.5 text-sm font-semibold text-white dark:bg-red-800"
                >
                  Try again
                </button>
              </div>
            ) : null}

            {itemsState === "ready" && items.length === 0 ? (
              <div className="rounded-[2rem] border border-dashed border-ink/20 bg-card/40 p-8 text-center sm:p-12">
                <h2 className="text-2xl font-semibold tracking-[-0.03em] text-ink">
                  Add your wardrobe first
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink/55">
                  A purchase check compares the new piece with what you already
                  own, so it needs a few items to work with.
                </p>
                <Link
                  href="/"
                  className="mt-5 inline-flex rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white"
                >
                  Open wardrobe
                </Link>
              </div>
            ) : null}

            {itemsState === "ready" &&
            items.length > 0 &&
            (checkState === "idle" || checkState === "error") ? (
              <div className="rounded-[2rem] border border-ink/10 bg-brand p-8 text-white sm:p-12">
                <span className="text-3xl text-emerald-200">◎</span>
                <h2 className="mt-5 text-3xl font-semibold tracking-[-0.035em]">
                  Compared against {items.length}{" "}
                  {items.length === 1 ? "piece" : "pieces"} you own.
                </h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-white/60">
                  You’ll see how many outfits it unlocks, what it pairs with,
                  and whether it duplicates something in your closet. Nothing is
                  saved unless you add it.
                </p>
              </div>
            ) : null}

            {checkState === "loading" ? <CheckSkeleton /> : null}

            {checkState === "success" && check && photo ? (
              <CheckResult
                check={check}
                photoUrl={photo.previewUrl}
                itemMap={itemMap}
                addState={addState}
                onAdd={() => void addToWardrobe()}
                onReset={reset}
              />
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}

function CheckResult({
  check,
  photoUrl,
  itemMap,
  addState,
  onAdd,
  onReset,
}: {
  check: PurchaseCheckResult;
  photoUrl: string;
  itemMap: Map<string, WardrobeItem>;
  addState: "idle" | "loading" | "added" | "error";
  onAdd: () => void;
  onReset: () => void;
}) {
  const verdict = verdictStyles[check.verdict];
  const pairings = (Object.keys(categoryLabels) as Category[])
    .filter((category) => check.compatibleCounts[category] > 0)
    .map((category) => {
      const count = check.compatibleCounts[category];
      const [singular, plural] = categoryLabels[category];
      return `${count} ${count === 1 ? singular : plural}`;
    });

  return (
    <div className="grid gap-5">
      <article
        className={`rounded-[2rem] p-6 sm:p-8 ${verdict.className}`}
        aria-label="Verdict"
      >
        <p className="text-xs font-semibold tracking-[0.18em] uppercase opacity-70">
          {check.candidate.name}
        </p>
        <h2 className="mt-2 text-4xl font-semibold tracking-[-0.04em]">
          {verdict.label}
        </h2>
        <p className="mt-3 text-base leading-6 font-semibold">
          {check.headline}
        </p>
        <p className="mt-2 text-sm leading-6 opacity-75">{check.reasoning}</p>
        {check.priceNote ? (
          <p className="mt-3 text-sm leading-6 opacity-75">
            <span className="font-semibold">On price:</span> {check.priceNote}
          </p>
        ) : null}
      </article>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[1.6rem] border border-ink/10 bg-card/65 p-5">
          <p className="text-xs font-semibold tracking-[0.14em] text-emerald-700 uppercase dark:text-emerald-300">
            Outfits it unlocks
          </p>
          <p className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-ink">
            {check.outfitEstimate === 0 ? "None" : `≈ ${check.outfitEstimate}`}
          </p>
          <p className="mt-1 text-xs leading-5 text-ink/50">
            {check.outfitEstimate === 0
              ? "Nothing you own completes a top, bottom, and shoes with it."
              : "Top, bottom, and shoes combinations using pieces it pairs with."}
          </p>
        </div>
        <div className="rounded-[1.6rem] border border-ink/10 bg-card/65 p-5">
          <p className="text-xs font-semibold tracking-[0.14em] text-emerald-700 uppercase dark:text-emerald-300">
            Pairs with
          </p>
          <p className="mt-2 text-sm leading-6 text-ink">
            {pairings.length > 0
              ? pairings.join(" · ")
              : "Nothing you own yet."}
          </p>
          {check.gapsFilled.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {check.gapsFilled.map((gap) => (
                <li
                  key={gap}
                  className="rounded-full bg-emerald-50 px-2.5 py-1 text-[0.7rem] font-semibold text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
                >
                  Fills: {gap}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {check.similarItems.length > 0 ? (
        <section className="rounded-[1.6rem] border border-ink/10 bg-card/65 p-5">
          <h3 className="text-xs font-semibold tracking-[0.14em] text-[#b75533] uppercase dark:text-[#e08a68]">
            You already own something close
          </h3>
          <ul className="mt-3 grid gap-3">
            {check.similarItems.map(({ itemId, note }) => {
              const item = itemMap.get(itemId);
              if (!item) return null;
              return (
                <li key={itemId} className="flex items-center gap-3">
                  <span className="relative h-16 w-13 shrink-0 overflow-hidden rounded-xl bg-ink/5">
                    <Image
                      src={item.imageUrl}
                      unoptimized
                      alt={item.name}
                      fill
                      sizes="52px"
                      className="object-cover"
                    />
                  </span>
                  <span className="text-sm leading-5 text-ink/70">
                    <span className="block font-semibold text-ink">
                      {item.name}
                    </span>
                    {note}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {check.exampleOutfits.length > 0 ? (
        <section className="grid gap-4">
          <h3 className="px-1 text-xl font-semibold tracking-[-0.03em] text-ink">
            How you’d wear it
          </h3>
          {check.exampleOutfits.map((outfit, index) => (
            <article
              key={outfit.itemIds.join(":")}
              className="rounded-[1.6rem] border border-ink/10 bg-card/65 p-4"
            >
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                <OutfitTile
                  src={photoUrl}
                  alt={check.candidate.name}
                  label="New"
                  highlight
                />
                {outfit.itemIds.map((id) => {
                  const item = itemMap.get(id);
                  return item ? (
                    <OutfitTile
                      key={id}
                      src={item.imageUrl}
                      alt={item.name}
                      label={item.category}
                    />
                  ) : null;
                })}
              </div>
              <p className="mt-4 px-1 text-xs font-semibold tracking-[0.14em] text-emerald-700 uppercase dark:text-emerald-300">
                Look {index + 1}
              </p>
              <p className="mt-1 px-1 text-sm leading-6 text-ink/65">
                {outfit.rationale}
              </p>
            </article>
          ))}
        </section>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        {addState === "added" ? (
          <Link
            href="/"
            className="grid min-h-12 place-items-center rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white"
          >
            Added ✓ View wardrobe
          </Link>
        ) : (
          <button
            type="button"
            disabled={addState === "loading"}
            onClick={onAdd}
            className="min-h-12 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
          >
            {addState === "loading"
              ? "Adding…"
              : addState === "error"
                ? "Try adding again"
                : "I bought it — add to wardrobe"}
          </button>
        )}
        <button
          type="button"
          onClick={onReset}
          className="min-h-12 rounded-full border border-ink/15 bg-card px-5 py-3 text-sm font-semibold text-ink"
        >
          Check another item
        </button>
      </div>
    </div>
  );
}

function OutfitTile({
  src,
  alt,
  label,
  highlight = false,
}: {
  src: string;
  alt: string;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`relative aspect-[4/5] overflow-hidden rounded-2xl bg-ink/5 ${
        highlight
          ? "ring-2 ring-[#c7623d] ring-offset-2 ring-offset-canvas"
          : ""
      }`}
    >
      <Image
        src={src}
        unoptimized
        alt={alt}
        fill
        sizes="(max-width: 640px) 33vw, 15vw"
        className="object-cover"
      />
      <span
        className={`absolute right-1.5 bottom-1.5 rounded-full px-2 py-1 text-[0.58rem] font-semibold text-white capitalize backdrop-blur ${
          highlight ? "bg-[#c7623d]" : "bg-emerald-950/75"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function CheckSkeleton() {
  return (
    <div className="grid gap-5">
      <div className="h-56 animate-pulse rounded-[2rem] bg-ink/8" />
      <div className="h-40 animate-pulse rounded-[2rem] bg-ink/8" />
    </div>
  );
}
