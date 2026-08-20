"use client";

import Image from "next/image";
import Link from "next/link";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const categories = [
  { label: "All", value: "all" },
  { label: "Tops", value: "top" },
  { label: "Bottoms", value: "bottom" },
  { label: "Shoes", value: "shoes" },
  { label: "Outerwear", value: "outerwear" },
  { label: "Accessories", value: "accessory" },
] as const;

const seasons = ["spring", "summer", "fall", "winter"] as const;

type ItemCategory = (typeof categories)[number]["value"];
type WardrobeCategory = Exclude<ItemCategory, "all">;
type Season = (typeof seasons)[number];

type WardrobeItem = {
  id: string;
  userId: string;
  imageUrl: string;
  name: string;
  category: WardrobeCategory;
  colors: string[];
  pattern: string;
  formality: number;
  season: string[];
  material: string | null;
  fit: string | null;
  notes: string;
  available: boolean;
  createdAt: string;
};

type ItemDraft = {
  name: string;
  category: WardrobeCategory;
  colors: string;
  pattern: string;
  formality: number;
  season: Season[];
  material: string;
  fit: string;
  notes: string;
  available: boolean;
};

const fieldClass =
  "mt-2 w-full rounded-2xl border border-emerald-950/15 bg-white px-4 py-3 text-sm text-emerald-950 outline-none transition placeholder:text-emerald-950/35 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10";

async function responseError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return body?.error ?? fallback;
}

function itemDraft(item: WardrobeItem): ItemDraft {
  return {
    name: item.name,
    category: item.category,
    colors: item.colors.join(", "),
    pattern: item.pattern,
    formality: item.formality,
    season: item.season.filter((value): value is Season =>
      seasons.includes(value as Season),
    ),
    material: item.material ?? "",
    fit: item.fit ?? "",
    notes: item.notes,
    available: item.available,
  };
}

export function WardrobeApp() {
  const [activeCategory, setActiveCategory] = useState<ItemCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [loadError, setLoadError] = useState("");
  const [pendingUpload, setPendingUpload] = useState<{
    file: File;
    previewUrl: string;
  } | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [selectedItem, setSelectedItem] = useState<WardrobeItem | null>(null);
  const pendingFile = pendingUpload?.file ?? null;
  const previewUrl = pendingUpload?.previewUrl ?? "";

  const loadItems = useCallback(async (category: ItemCategory) => {
    setLoadState("loading");
    setLoadError("");

    const query = category === "all" ? "" : `?category=${category}`;

    try {
      const response = await fetch(`/api/items${query}`, { cache: "no-store" });

      if (!response.ok) {
        throw new Error(
          await responseError(response, "Your wardrobe could not be loaded."),
        );
      }

      const body = (await response.json()) as { items: WardrobeItem[] };
      setItems(body.items);
      setLoadState("ready");
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Your wardrobe could not be loaded.",
      );
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadItems(activeCategory);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [activeCategory, loadItems]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  function clearPendingUpload() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPendingUpload(null);
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (file) {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);

      const preview = URL.createObjectURL(file);
      previewUrlRef.current = preview;
      setUploadError("");
      setPendingUpload({ file, previewUrl: preview });
    }
  }

  async function uploadItem() {
    if (!pendingFile) return;

    setIsUploading(true);
    setUploadError("");
    const formData = new FormData();
    formData.set("file", pendingFile);

    try {
      const response = await fetch("/api/items", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(
          await responseError(response, "The garment could not be analyzed."),
        );
      }

      const body = (await response.json()) as { item: WardrobeItem };
      const createdItem = body.item;

      if (!createdItem?.id) {
        throw new Error(
          "The garment was analyzed, but its wardrobe details were incomplete. Please try again.",
        );
      }

      if (activeCategory === "all" || createdItem.category === activeCategory) {
        setItems((current) => [createdItem, ...current]);
      }

      clearPendingUpload();
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : "The garment could not be analyzed.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  function updateItem(updatedItem: WardrobeItem) {
    setItems((current) =>
      activeCategory === "all" || updatedItem.category === activeCategory
        ? current.map((item) =>
            item.id === updatedItem.id ? updatedItem : item,
          )
        : current.filter((item) => item.id !== updatedItem.id),
    );
    setSelectedItem(updatedItem);
  }

  function removeItem(itemId: string) {
    setItems((current) => current.filter((item) => item.id !== itemId));
    setSelectedItem(null);
  }

  const availableCount = items.filter((item) => item.available).length;
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const visibleItems = normalizedSearch
    ? items.filter((item) =>
        [item.name, item.category, item.pattern, ...item.colors].some((value) =>
          value.toLowerCase().includes(normalizedSearch),
        ),
      )
    : items;

  return (
    <main className="min-h-screen pb-28 md:pb-20">
      <div className="mx-auto w-full max-w-7xl px-5 pt-8 sm:px-8 sm:pt-12">
        <section className="relative overflow-hidden rounded-[2rem] bg-emerald-950 px-6 py-8 text-white shadow-[0_35px_90px_-55px_rgba(6,78,59,0.9)] sm:px-10 sm:py-11 lg:px-12">
          <div className="pointer-events-none absolute -top-24 -right-20 h-72 w-72 rounded-full border-[3.5rem] border-white/[0.035]" />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[0.68rem] font-semibold tracking-[0.2em] text-emerald-200 uppercase">
                My wardrobe
              </p>
              <h1 className="mt-3 max-w-3xl text-[2.8rem] leading-[0.94] tracking-[-0.055em] sm:text-6xl lg:text-[4.35rem]">
                Everything you own, ready when you are.
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-6 text-white/58 sm:text-[0.95rem]">
                A calmer way to see what you have, build better outfits, and
                wear more of what you love.
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap gap-3">
              <Link
                href="/suggestions"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/16 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/8"
              >
                Suggest a look
              </Link>
              <label className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-[#c7623d] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_35px_-20px_rgba(0,0,0,0.8)] transition focus-within:ring-4 focus-within:ring-white/20 hover:-translate-y-0.5 hover:bg-[#b75533]">
                <span className="text-lg leading-none" aria-hidden="true">
                  ＋
                </span>
                Add garment
                <input
                  className="sr-only"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={chooseFile}
                />
              </label>
            </div>
          </div>
        </section>

        <section className="pt-8">
          <div className="rounded-[1.6rem] border border-emerald-950/8 bg-white/58 p-3 shadow-[0_20px_55px_-45px_rgba(6,78,59,0.6)] backdrop-blur sm:p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <label className="relative block lg:w-[18rem]">
                <span className="sr-only">Search wardrobe</span>
                <span
                  className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-lg text-emerald-950/38"
                  aria-hidden="true"
                >
                  ⌕
                </span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search name, color, pattern…"
                  className="min-h-11 w-full rounded-full border border-emerald-950/10 bg-[#fbfaf6] py-2.5 pr-4 pl-11 text-sm text-emerald-950 outline-none placeholder:text-emerald-950/35 focus:border-emerald-700/50 focus:ring-4 focus:ring-emerald-700/8"
                />
              </label>

              <div
                className="flex gap-1.5 overflow-x-auto py-0.5"
                aria-label="Wardrobe categories"
              >
                {categories.map((category) => (
                  <button
                    key={category.value}
                    type="button"
                    onClick={() => setActiveCategory(category.value)}
                    className={`shrink-0 rounded-full px-3.5 py-2 text-[0.78rem] font-semibold transition ${
                      activeCategory === category.value
                        ? "bg-emerald-950 text-white shadow-sm"
                        : "text-emerald-950/52 hover:bg-white hover:text-emerald-950"
                    }`}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-end justify-between gap-4 px-1">
            <div>
              <h2 className="display-type text-2xl tracking-[-0.035em] text-emerald-950 sm:text-3xl">
                {activeCategory === "all"
                  ? "Your collection"
                  : categories.find(
                      (category) => category.value === activeCategory,
                    )?.label}
              </h2>
              {loadState === "ready" && items.length > 0 ? (
                <p className="mt-1 text-xs text-emerald-950/45 sm:text-sm">
                  {visibleItems.length}{" "}
                  {visibleItems.length === 1 ? "piece" : "pieces"}
                  {activeCategory === "all"
                    ? ` · ${availableCount} ready to wear`
                    : ""}
                </p>
              ) : null}
            </div>
            <p className="hidden text-xs text-emerald-950/38 sm:block">
              Select an item to view and edit
            </p>
          </div>

          {loadState === "loading" ? <WardrobeSkeleton /> : null}

          {loadState === "error" ? (
            <ErrorState
              message={loadError}
              onRetry={() => void loadItems(activeCategory)}
            />
          ) : null}

          {loadState === "ready" && items.length === 0 ? (
            <EmptyWardrobe
              category={activeCategory}
              onReset={() => setActiveCategory("all")}
            />
          ) : null}

          {loadState === "ready" &&
          items.length > 0 &&
          visibleItems.length === 0 ? (
            <div className="mt-7 rounded-[2rem] border border-dashed border-emerald-950/18 bg-white/35 px-6 py-14 text-center">
              <p className="display-type text-2xl tracking-[-0.03em] text-emerald-950">
                Nothing matches “{searchQuery.trim()}”
              </p>
              <p className="mt-2 text-sm text-emerald-950/50">
                Try a color, garment name, or pattern.
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="mt-5 rounded-full border border-emerald-950/12 bg-white px-5 py-2.5 text-sm font-semibold text-emerald-950"
              >
                Clear search
              </button>
            </div>
          ) : null}

          {loadState === "ready" && visibleItems.length > 0 ? (
            <div className="mt-7 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
              {visibleItems.map((item) => (
                <ItemCard
                  item={item}
                  key={item.id}
                  onOpen={() => setSelectedItem(item)}
                />
              ))}
            </div>
          ) : null}
        </section>
      </div>

      {pendingFile ? (
        <UploadDialog
          file={pendingFile}
          previewUrl={previewUrl}
          isUploading={isUploading}
          error={uploadError}
          onCancel={() => {
            if (!isUploading) clearPendingUpload();
          }}
          onUpload={() => void uploadItem()}
        />
      ) : null}

      {selectedItem ? (
        <ItemDialog
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onUpdate={updateItem}
          onDelete={removeItem}
        />
      ) : null}
    </main>
  );
}

function ItemCard({
  item,
  onOpen,
}: {
  item: WardrobeItem;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group overflow-hidden rounded-[1.4rem] border border-emerald-950/8 bg-[#fbfaf6]/82 text-left shadow-[0_22px_60px_-48px_rgba(6,78,59,0.65)] transition duration-300 hover:-translate-y-1 hover:border-emerald-950/14 hover:bg-white hover:shadow-[0_30px_65px_-42px_rgba(6,78,59,0.68)] focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-700/20 sm:rounded-[1.75rem]"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-emerald-950/5">
        <Image
          src={item.imageUrl}
          alt={item.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover transition duration-500 group-hover:scale-[1.025]"
        />
        <span
          className={`absolute top-3 left-3 rounded-full px-2.5 py-1 text-[0.65rem] font-semibold backdrop-blur ${
            item.available
              ? "bg-emerald-950/80 text-white"
              : "bg-stone-100/90 text-stone-600"
          }`}
        >
          {item.available ? "Available" : "Unavailable"}
        </span>
        <span className="absolute right-3 bottom-3 translate-y-2 rounded-full bg-white/92 px-3 py-1.5 text-[0.68rem] font-semibold text-emerald-950 opacity-0 shadow-sm backdrop-blur transition group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
          View details
        </span>
      </div>
      <div className="p-3.5 sm:p-5">
        <p className="truncate font-semibold tracking-[-0.015em] text-emerald-950 sm:text-lg">
          {item.name}
        </p>
        <p className="mt-1 text-xs text-emerald-950/50 capitalize sm:text-sm">
          {item.category} · {item.pattern}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.colors.slice(0, 2).map((color) => (
            <span
              key={color}
              className="rounded-full bg-emerald-950/5 px-2.5 py-1 text-[0.68rem] font-medium text-emerald-950/65 capitalize"
            >
              {color}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

function WardrobeSkeleton() {
  return (
    <div className="mt-7 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-[1.4rem] border border-emerald-950/5 bg-white/45 sm:rounded-[1.75rem]"
        >
          <div className="aspect-[4/5] animate-pulse bg-emerald-950/8" />
          <div className="space-y-2 p-4">
            <div className="h-4 w-2/3 animate-pulse rounded bg-emerald-950/10" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-emerald-950/7" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="mt-10 rounded-3xl border border-red-900/10 bg-red-50/70 p-8 text-center">
      <p className="font-semibold text-red-950">
        We couldn’t open your wardrobe.
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-red-950/65">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 rounded-full bg-red-950 px-5 py-2.5 text-sm font-semibold text-white"
      >
        Try again
      </button>
    </div>
  );
}

function EmptyWardrobe({
  category,
  onReset,
}: {
  category: ItemCategory;
  onReset: () => void;
}) {
  const filtered = category !== "all";

  return (
    <div className="mt-10 rounded-[2rem] border border-dashed border-emerald-950/20 bg-white/35 px-6 py-16 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-900 text-2xl text-white">
        ◇
      </div>
      <h2 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-emerald-950">
        {filtered ? `No ${category} here yet` : "Your wardrobe starts here"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-emerald-950/55">
        {filtered
          ? "Try another category or add a new garment."
          : "Add a clear photo of one garment and Wadrobe will organize the details for you."}
      </p>
      {filtered ? (
        <button
          type="button"
          onClick={onReset}
          className="mt-5 rounded-full border border-emerald-950/15 bg-white px-5 py-2.5 text-sm font-semibold text-emerald-950"
        >
          View all items
        </button>
      ) : null}
    </div>
  );
}

function DialogShell({
  title,
  onClose,
  disabled,
  children,
}: {
  title: string;
  onClose: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !disabled) onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [disabled, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-emerald-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !disabled) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[94vh] w-full overflow-y-auto rounded-t-[2rem] bg-[#f7f5ef] shadow-2xl sm:max-w-3xl sm:rounded-[2rem]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-emerald-950/10 bg-[#f7f5ef]/95 px-5 py-4 backdrop-blur sm:px-7">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-emerald-950">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close dialog"
            disabled={disabled}
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full border border-emerald-950/10 bg-white/60 text-xl text-emerald-950 transition hover:bg-white disabled:opacity-40"
          >
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function UploadDialog({
  file,
  previewUrl,
  isUploading,
  error,
  onCancel,
  onUpload,
}: {
  file: File;
  previewUrl: string;
  isUploading: boolean;
  error: string;
  onCancel: () => void;
  onUpload: () => void;
}) {
  return (
    <DialogShell
      title="Add a garment"
      onClose={onCancel}
      disabled={isUploading}
    >
      <div className="grid gap-6 p-5 sm:grid-cols-[0.9fr_1.1fr] sm:p-7">
        <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-emerald-950/5">
          {previewUrl ? (
            <Image
              src={previewUrl}
              alt="Selected garment preview"
              fill
              unoptimized
              className="object-cover"
            />
          ) : null}
          {isUploading ? (
            <div className="absolute inset-0 grid place-items-center bg-emerald-950/65 px-6 text-center text-white backdrop-blur-sm">
              <div>
                <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                <p className="mt-4 font-semibold">Analyzing garment…</p>
                <p className="mt-1 text-xs text-white/70">
                  Reading color, pattern, fit, and season.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col justify-center">
          <p className="text-xs font-semibold tracking-[0.15em] text-emerald-700 uppercase">
            One item per photo
          </p>
          <h3 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-emerald-950">
            Is the garment clear and centered?
          </h3>
          <p className="mt-3 text-sm leading-6 text-emerald-950/60">
            Photos containing a full outfit are treated as one primary garment.
            You can correct every detail after analysis.
          </p>
          <p className="mt-5 truncate rounded-2xl bg-white/70 px-4 py-3 text-xs text-emerald-950/55">
            {file.name}
          </p>

          {error ? (
            <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm leading-5 text-red-900">
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              disabled={isUploading}
              onClick={onCancel}
              className="flex-1 rounded-full border border-emerald-950/15 bg-white px-4 py-3 text-sm font-semibold text-emerald-950 disabled:opacity-40"
            >
              Choose another
            </button>
            <button
              type="button"
              disabled={isUploading}
              onClick={onUpload}
              className="flex-1 rounded-full bg-emerald-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isUploading ? "Analyzing…" : "Analyze item"}
            </button>
          </div>
        </div>
      </div>
    </DialogShell>
  );
}

function ItemDialog({
  item,
  onClose,
  onUpdate,
  onDelete,
}: {
  item: WardrobeItem;
  onClose: () => void;
  onUpdate: (item: WardrobeItem) => void;
  onDelete: (itemId: string) => void;
}) {
  const [draft, setDraft] = useState<ItemDraft>(() => itemDraft(item));
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  function setField<Key extends keyof ItemDraft>(
    key: Key,
    value: ItemDraft[Key],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function toggleSeason(season: Season) {
    setDraft((current) => ({
      ...current,
      season: current.season.includes(season)
        ? current.season.filter((value) => value !== season)
        : [...current.season, season],
    }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const colors = draft.colors
      .split(",")
      .map((color) => color.trim())
      .filter(Boolean);

    if (
      !draft.name.trim() ||
      colors.length === 0 ||
      draft.season.length === 0
    ) {
      setError("Add a name, at least one color, and at least one season.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...draft,
          name: draft.name.trim(),
          colors,
          pattern: draft.pattern.trim(),
          material: draft.material.trim() || null,
          fit: draft.fit.trim() || null,
          notes: draft.notes.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error(
          await responseError(response, "The item could not be saved."),
        );
      }

      const body = (await response.json()) as { item: WardrobeItem };
      onUpdate(body.item);
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The item could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteItem() {
    setIsDeleting(true);
    setError("");

    try {
      const response = await fetch(`/api/items/${item.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(
          await responseError(response, "The item could not be deleted."),
        );
      }

      onDelete(item.id);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "The item could not be deleted.",
      );
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  }

  const disabled = isSaving || isDeleting;

  return (
    <DialogShell title="Garment details" onClose={onClose} disabled={disabled}>
      <form onSubmit={save}>
        <div className="grid gap-7 p-5 sm:grid-cols-[0.8fr_1.2fr] sm:p-7">
          <div>
            <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-emerald-950/5">
              <Image
                src={item.imageUrl}
                alt={item.name}
                fill
                sizes="(max-width: 640px) 100vw, 40vw"
                className="object-cover"
              />
            </div>
            <label className="mt-4 flex cursor-pointer items-center justify-between rounded-2xl border border-emerald-950/10 bg-white/65 px-4 py-3.5">
              <span>
                <span className="block text-sm font-semibold text-emerald-950">
                  Available to wear
                </span>
                <span className="mt-0.5 block text-xs text-emerald-950/45">
                  Turn off for laundry or storage.
                </span>
              </span>
              <input
                type="checkbox"
                checked={draft.available}
                onChange={(event) =>
                  setField("available", event.target.checked)
                }
                className="h-5 w-5 accent-emerald-800"
              />
            </label>
          </div>

          <div className="grid content-start gap-5">
            <label className="text-sm font-semibold text-emerald-950/75">
              Name
              <input
                className={fieldClass}
                value={draft.name}
                maxLength={160}
                onChange={(event) => setField("name", event.target.value)}
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-semibold text-emerald-950/75">
                Category
                <select
                  className={fieldClass}
                  value={draft.category}
                  onChange={(event) =>
                    setField("category", event.target.value as WardrobeCategory)
                  }
                >
                  {categories.slice(1).map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-emerald-950/75">
                Formality
                <select
                  className={fieldClass}
                  value={draft.formality}
                  onChange={(event) =>
                    setField("formality", Number(event.target.value))
                  }
                >
                  <option value={1}>1 · Very casual</option>
                  <option value={2}>2 · Casual</option>
                  <option value={3}>3 · Smart casual</option>
                  <option value={4}>4 · Dressy</option>
                  <option value={5}>5 · Formal</option>
                </select>
              </label>
            </div>

            <label className="text-sm font-semibold text-emerald-950/75">
              Colors
              <input
                className={fieldClass}
                value={draft.colors}
                placeholder="navy, white"
                onChange={(event) => setField("colors", event.target.value)}
              />
              <span className="mt-1.5 block text-xs font-normal text-emerald-950/40">
                Separate colors with commas.
              </span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-semibold text-emerald-950/75">
                Pattern
                <input
                  className={fieldClass}
                  value={draft.pattern}
                  maxLength={80}
                  onChange={(event) => setField("pattern", event.target.value)}
                />
              </label>
              <label className="text-sm font-semibold text-emerald-950/75">
                Fit
                <input
                  className={fieldClass}
                  value={draft.fit}
                  maxLength={80}
                  placeholder="regular"
                  onChange={(event) => setField("fit", event.target.value)}
                />
              </label>
            </div>

            <label className="text-sm font-semibold text-emerald-950/75">
              Material
              <input
                className={fieldClass}
                value={draft.material}
                maxLength={120}
                placeholder="cotton"
                onChange={(event) => setField("material", event.target.value)}
              />
            </label>

            <fieldset>
              <legend className="text-sm font-semibold text-emerald-950/75">
                Seasons
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {seasons.map((season) => {
                  const active = draft.season.includes(season);
                  return (
                    <button
                      type="button"
                      key={season}
                      onClick={() => toggleSeason(season)}
                      className={`rounded-full px-3.5 py-2 text-xs font-semibold capitalize transition ${
                        active
                          ? "bg-emerald-900 text-white"
                          : "border border-emerald-950/10 bg-white text-emerald-950/55"
                      }`}
                    >
                      {season}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <label className="text-sm font-semibold text-emerald-950/75">
              Notes
              <textarea
                className={`${fieldClass} min-h-24 resize-y`}
                value={draft.notes}
                maxLength={2_000}
                placeholder="What do you wear this with?"
                onChange={(event) => setField("notes", event.target.value)}
              />
            </label>
          </div>
        </div>

        {error ? (
          <p className="mx-5 mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-900 sm:mx-7">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-emerald-950/10 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-900">Delete permanently?</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => void deleteItem()}
                className="rounded-full bg-red-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {isDeleting ? "Deleting…" : "Yes, delete"}
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-2 text-xs font-semibold text-emerald-950/55"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setConfirmDelete(true)}
              className="self-start px-1 py-2 text-sm font-semibold text-red-800 disabled:opacity-40"
            >
              Delete item
            </button>
          )}

          <div className="flex gap-3 sm:ml-auto">
            <button
              type="button"
              disabled={disabled}
              onClick={onClose}
              className="flex-1 rounded-full border border-emerald-950/15 bg-white px-5 py-3 text-sm font-semibold text-emerald-950 disabled:opacity-40 sm:flex-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={disabled}
              className="flex-1 rounded-full bg-emerald-950 px-6 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:flex-none"
            >
              {isSaving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </form>
    </DialogShell>
  );
}
