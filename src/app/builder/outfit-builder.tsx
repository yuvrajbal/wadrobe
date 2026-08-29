"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Category = "top" | "bottom" | "shoes" | "outerwear" | "accessory";

type WardrobeItem = {
  id: string;
  imageUrl: string;
  name: string;
  category: Category;
  colors: string[];
  pattern: string;
  formality: number;
  season: string[];
  material: string | null;
  fit: string | null;
  available: boolean;
};

type Critique = {
  verdict: "works" | "almost" | "rethink";
  summary: string;
  strengths: string[];
  suggestion: string | null;
};

type RequestState = "idle" | "loading" | "success" | "error";

const slots = [
  { category: "top", label: "Top", required: true, hint: "Shirt, tee, knit" },
  {
    category: "bottom",
    label: "Bottom",
    required: true,
    hint: "Trousers, jeans, skirt",
  },
  {
    category: "shoes",
    label: "Shoes",
    required: true,
    hint: "Sneakers, boots, heels",
  },
  {
    category: "outerwear",
    label: "Outerwear",
    required: false,
    hint: "Jacket or coat",
  },
  {
    category: "accessory",
    label: "Accessory",
    required: false,
    hint: "Bag, belt, jewelry",
  },
] as const;

async function responseError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return body?.error ?? fallback;
}

export function OutfitBuilder({
  initialItemIds = [],
}: {
  initialItemIds?: string[];
}) {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [loadError, setLoadError] = useState("");
  const [selection, setSelection] = useState<Partial<Record<Category, string>>>(
    {},
  );
  const [picker, setPicker] = useState<Category | null>(null);
  const [saveState, setSaveState] = useState<RequestState>("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [critiqueState, setCritiqueState] = useState<RequestState>("idle");
  const [critique, setCritique] = useState<Critique | null>(null);
  const [critiqueError, setCritiqueError] = useState("");

  const loadItems = useCallback(async () => {
    setLoadState("loading");
    setLoadError("");
    try {
      const response = await fetch("/api/items?available=true", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(
          await responseError(response, "Your wardrobe could not be loaded."),
        );
      }
      const body = (await response.json()) as { items: WardrobeItem[] };
      setItems(body.items);
      if (initialItemIds.length > 0) {
        const requestedIds = new Set(initialItemIds);
        setSelection((current) => {
          if (Object.keys(current).length > 0) return current;
          return Object.fromEntries(
            body.items
              .filter((item) => requestedIds.has(item.id))
              .map((item) => [item.category, item.id]),
          );
        });
      }
      setLoadState("ready");
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Your wardrobe could not be loaded.",
      );
      setLoadState("error");
    }
  }, [initialItemIds]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadItems();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadItems]);

  const selectedItems = useMemo(
    () =>
      slots
        .map((slot) =>
          items.find((item) => item.id === selection[slot.category]),
        )
        .filter((item): item is WardrobeItem => Boolean(item)),
    [items, selection],
  );

  const complete = ["top", "bottom", "shoes"].every(
    (category) => selection[category as Category],
  );

  function resetRequestStates() {
    setSaveState("idle");
    setSaveMessage("");
    setCritiqueState("idle");
    setCritique(null);
    setCritiqueError("");
  }

  function chooseItem(item: WardrobeItem) {
    setSelection((current) => ({ ...current, [item.category]: item.id }));
    setPicker(null);
    resetRequestStates();
  }

  function removeItem(category: Category) {
    setSelection((current) => {
      const next = { ...current };
      delete next[category];
      return next;
    });
    resetRequestStates();
  }

  async function saveOutfit() {
    if (!complete) {
      setSaveState("error");
      setSaveMessage("Choose a top, bottom, and shoes before saving.");
      return;
    }

    setSaveState("loading");
    setSaveMessage("");
    try {
      const response = await fetch("/api/outfits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemIds: selectedItems.map((item) => item.id) }),
      });
      if (!response.ok) {
        throw new Error(
          await responseError(response, "The outfit could not be saved."),
        );
      }
      setSaveState("success");
      setSaveMessage("Outfit saved to your collection.");
    } catch (error) {
      setSaveState("error");
      setSaveMessage(
        error instanceof Error
          ? error.message
          : "The outfit could not be saved.",
      );
    }
  }

  async function requestCritique() {
    if (!complete) {
      setCritiqueState("error");
      setCritiqueError(
        "Choose a top, bottom, and shoes before asking for a critique.",
      );
      return;
    }

    setCritiqueState("loading");
    setCritiqueError("");
    setCritique(null);
    try {
      const response = await fetch("/api/outfits/critique", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemIds: selectedItems.map((item) => item.id) }),
      });
      if (!response.ok) {
        throw new Error(
          await responseError(response, "The outfit could not be critiqued."),
        );
      }
      const body = (await response.json()) as { critique: Critique };
      setCritique(body.critique);
      setCritiqueState("success");
    } catch (error) {
      setCritiqueError(
        error instanceof Error
          ? error.message
          : "The outfit could not be critiqued.",
      );
      setCritiqueState("error");
    }
  }

  return (
    <main className="min-h-screen pb-32 md:pb-16">
      <div className="mx-auto w-full max-w-7xl px-5 py-9 sm:px-8 sm:py-14">
        <section className="max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.18em] text-emerald-700 uppercase">
            Manual outfit builder
          </p>
          <h1 className="mt-3 text-4xl leading-none font-semibold tracking-[-0.045em] text-emerald-950 sm:text-6xl">
            Build it piece by piece.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-emerald-950/60 sm:text-base">
            Start with the essentials, then layer if you want. Only available
            pieces appear in your picker.
          </p>
        </section>

        {loadState === "loading" ? <BuilderSkeleton /> : null}

        {loadState === "error" ? (
          <div className="mt-10 rounded-3xl border border-red-900/10 bg-red-50/70 p-7">
            <p className="font-semibold text-red-950">
              Couldn’t open your wardrobe.
            </p>
            <p className="mt-2 text-sm text-red-950/65">{loadError}</p>
            <button
              type="button"
              onClick={() => void loadItems()}
              className="mt-5 rounded-full bg-red-950 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Try again
            </button>
          </div>
        ) : null}

        {loadState === "ready" && items.length === 0 ? (
          <div className="mt-10 rounded-[2rem] border border-dashed border-emerald-950/20 bg-white/40 px-6 py-14 text-center">
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-emerald-950">
              Your available wardrobe is empty
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-emerald-950/55">
              Add garments or mark existing pieces as available before building
              an outfit.
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex rounded-full bg-emerald-950 px-5 py-3 text-sm font-semibold text-white"
            >
              Open wardrobe
            </Link>
          </div>
        ) : null}

        {loadState === "ready" && items.length > 0 ? (
          <div className="mt-9 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)] lg:items-start">
            <section className="rounded-[2rem] border border-emerald-950/10 bg-white/55 p-3 shadow-[0_30px_80px_-60px_rgba(6,78,59,0.7)] sm:p-5">
              <div className="mb-4 flex items-center justify-between px-2 pt-1">
                <div>
                  <h2 className="text-lg font-semibold tracking-[-0.02em] text-emerald-950">
                    Outfit board
                  </h2>
                  <p className="mt-0.5 text-xs text-emerald-950/45">
                    {selectedItems.length} of {slots.length} slots filled
                  </p>
                </div>
                {selectedItems.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelection({});
                      resetRequestStates();
                    }}
                    className="rounded-full px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-950/5"
                  >
                    Clear all
                  </button>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {slots.map((slot) => {
                  const item = items.find(
                    (candidate) => candidate.id === selection[slot.category],
                  );
                  return (
                    <OutfitSlot
                      key={slot.category}
                      label={slot.label}
                      hint={slot.hint}
                      required={slot.required}
                      item={item}
                      onPick={() => setPicker(slot.category)}
                      onRemove={() => removeItem(slot.category)}
                    />
                  );
                })}
              </div>
            </section>

            <aside className="rounded-[2rem] bg-emerald-950 p-5 text-white sm:p-6 lg:sticky lg:top-24">
              <p className="text-xs font-semibold tracking-[0.16em] text-emerald-200 uppercase">
                Finishing touch
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
                {complete
                  ? "Your base look is ready."
                  : "Complete the core three."}
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/60">
                {complete
                  ? "Save it as-is, or get a compact AI assessment before you decide."
                  : "A top, bottom, and shoes are required. Layers and accessories are optional."}
              </p>

              <div className="mt-6 grid gap-2.5">
                <button
                  type="button"
                  disabled={saveState === "loading"}
                  onClick={() => void saveOutfit()}
                  className="min-h-12 rounded-full bg-white px-5 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-65"
                >
                  {saveState === "loading" ? "Saving outfit…" : "Save outfit"}
                </button>
                <button
                  type="button"
                  disabled={critiqueState === "loading"}
                  onClick={() => void requestCritique()}
                  className="min-h-12 rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-wait disabled:opacity-65"
                >
                  {critiqueState === "loading"
                    ? "Considering the look…"
                    : "Critique this outfit"}
                </button>
              </div>

              {saveMessage ? (
                <div
                  role="status"
                  className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
                    saveState === "success"
                      ? "bg-emerald-700/50 text-emerald-50"
                      : "bg-red-950/55 text-red-50"
                  }`}
                >
                  {saveMessage}
                  {saveState === "success" ? (
                    <Link
                      href="/saved"
                      className="ml-2 font-semibold underline"
                    >
                      View saved
                    </Link>
                  ) : null}
                </div>
              ) : null}

              {critique ? <CritiqueCard critique={critique} /> : null}
              {critiqueError ? (
                <p
                  role="alert"
                  className="mt-4 rounded-2xl bg-red-950/55 px-4 py-3 text-sm text-red-50"
                >
                  {critiqueError}
                </p>
              ) : null}
            </aside>
          </div>
        ) : null}
      </div>

      {picker ? (
        <ItemPicker
          category={picker}
          items={items.filter((item) => item.category === picker)}
          selectedId={selection[picker]}
          onChoose={chooseItem}
          onClose={() => setPicker(null)}
        />
      ) : null}
    </main>
  );
}

function OutfitSlot({
  label,
  hint,
  required,
  item,
  onPick,
  onRemove,
}: {
  label: string;
  hint: string;
  required: boolean;
  item?: WardrobeItem;
  onPick: () => void;
  onRemove: () => void;
}) {
  if (!item) {
    return (
      <button
        type="button"
        onClick={onPick}
        className="group flex min-h-52 flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-emerald-950/20 bg-[#f7f5ef]/65 p-5 text-center transition hover:border-emerald-700/45 hover:bg-emerald-50/60 sm:min-h-64"
      >
        <span className="grid h-11 w-11 place-items-center rounded-full bg-emerald-950/6 text-xl text-emerald-900 transition group-hover:bg-emerald-900 group-hover:text-white">
          +
        </span>
        <span className="mt-4 font-semibold text-emerald-950">{label}</span>
        <span className="mt-1 text-xs text-emerald-950/45">{hint}</span>
        <span className="mt-3 rounded-full bg-white px-2.5 py-1 text-[0.65rem] font-semibold tracking-wide text-emerald-800 uppercase">
          {required ? "Required" : "Optional"}
        </span>
      </button>
    );
  }

  return (
    <article className="overflow-hidden rounded-[1.5rem] border border-emerald-950/10 bg-white shadow-sm">
      <div className="relative aspect-[4/5] bg-emerald-950/5">
        <Image
          src={item.imageUrl}
          alt={item.name}
          fill
          sizes="(max-width: 640px) 50vw, 30vw"
          className="object-cover"
        />
        <span className="absolute top-3 left-3 rounded-full bg-emerald-950/80 px-2.5 py-1 text-[0.65rem] font-semibold text-white backdrop-blur">
          {label}
        </span>
      </div>
      <div className="p-3.5">
        <p className="truncate text-sm font-semibold text-emerald-950">
          {item.name}
        </p>
        <p className="mt-1 truncate text-xs text-emerald-950/45 capitalize">
          {item.colors.join(", ")} · {item.pattern}
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onPick}
            className="flex-1 rounded-full bg-emerald-950 px-3 py-2 text-xs font-semibold text-white"
          >
            Replace
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${item.name}`}
            className="grid h-8 w-8 place-items-center rounded-full border border-emerald-950/10 text-emerald-950/55"
          >
            ×
          </button>
        </div>
      </div>
    </article>
  );
}

function ItemPicker({
  category,
  items,
  selectedId,
  onChoose,
  onClose,
}: {
  category: Category;
  items: WardrobeItem[];
  selectedId?: string;
  onChoose: (item: WardrobeItem) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), a[href]",
        ),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-emerald-950/45 backdrop-blur-sm sm:items-center sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Choose ${category}`}
        className="max-h-[88vh] min-h-0 w-full overflow-y-auto rounded-t-[2rem] bg-[#f7f5ef] shadow-2xl sm:max-w-4xl sm:rounded-[2rem]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-emerald-950/10 bg-[#f7f5ef]/95 px-5 py-4 backdrop-blur sm:px-7">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-emerald-950 capitalize">
              Choose {category}
            </h2>
            <p className="text-xs text-emerald-950/45">Available pieces only</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close picker"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full border border-emerald-950/10 bg-white/60 text-xl text-emerald-950"
          >
            ×
          </button>
        </div>

        {items.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 sm:gap-5 sm:p-7 lg:grid-cols-4">
            {items.map((item) => (
              <button
                type="button"
                key={item.id}
                aria-pressed={selectedId === item.id}
                onClick={() => onChoose(item)}
                className={`overflow-hidden rounded-3xl border bg-white text-left transition hover:-translate-y-0.5 ${
                  selectedId === item.id
                    ? "border-emerald-800 ring-4 ring-emerald-800/10"
                    : "border-emerald-950/10"
                }`}
              >
                <div className="relative aspect-[4/5] bg-emerald-950/5">
                  <Image
                    src={item.imageUrl}
                    alt={item.name}
                    fill
                    sizes="(max-width: 640px) 50vw, 25vw"
                    className="object-cover"
                  />
                </div>
                <div className="p-3.5">
                  <p className="truncate text-sm font-semibold text-emerald-950">
                    {item.name}
                  </p>
                  <p className="mt-1 truncate text-xs text-emerald-950/45 capitalize">
                    {item.colors.join(", ")}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <p className="font-semibold text-emerald-950 capitalize">
              No available {category} items
            </p>
            <p className="mt-2 text-sm text-emerald-950/50">
              Add one in your wardrobe, then return to the builder.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function CritiqueCard({ critique }: { critique: Critique }) {
  const labels = {
    works: "It works",
    almost: "Almost there",
    rethink: "Rethink it",
  };
  return (
    <section className="mt-4 rounded-3xl bg-white/10 p-4" aria-live="polite">
      <p className="text-xs font-semibold tracking-[0.14em] text-emerald-200 uppercase">
        {labels[critique.verdict]}
      </p>
      <p className="mt-2 text-sm leading-6 text-white/85">{critique.summary}</p>
      {critique.strengths.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs leading-5 text-white/60">
          {critique.strengths.map((strength) => (
            <li key={strength}>✓ {strength}</li>
          ))}
        </ul>
      ) : null}
      {critique.suggestion ? (
        <p className="mt-3 border-t border-white/10 pt-3 text-xs leading-5 text-emerald-100">
          Try: {critique.suggestion}
        </p>
      ) : null}
    </section>
  );
}

function BuilderSkeleton() {
  return (
    <div className="mt-9 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
      <div className="grid grid-cols-2 gap-3 rounded-[2rem] bg-white/45 p-5 sm:grid-cols-3">
        {slots.map((slot) => (
          <div
            key={slot.category}
            className="aspect-[4/5] animate-pulse rounded-3xl bg-emerald-950/8"
          />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-[2rem] bg-emerald-950/15" />
    </div>
  );
}
