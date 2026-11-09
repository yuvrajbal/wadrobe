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

import { forEachWithConcurrency } from "@/lib/concurrency";
import { notifications, safeNotificationMessage } from "@/lib/notifications";
import {
  ACCEPTED_IMAGE_TYPES,
  isHeicFile,
  prepareImageForUpload,
} from "@/lib/resize-image";

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

type PendingPhoto = {
  id: number;
  file: File;
  previewUrl: string;
  status: "ready" | "uploading" | "failed";
  error: string;
};

// Each photo is analyzed by the vision model, so keep batches and parallel
// requests small enough to stay quick and affordable.
const MAX_PHOTOS_PER_BATCH = 12;
const UPLOAD_CONCURRENCY = 3;

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
  "mt-2 w-full rounded-2xl border border-ink/15 bg-card px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-emerald-700 dark:focus:border-emerald-400 focus:ring-4 focus:ring-emerald-700/10 dark:focus:ring-emerald-400/10";

async function responseError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return body?.error ?? fallback;
}

async function createWardrobeItem(file: File): Promise<WardrobeItem> {
  const formData = new FormData();
  formData.set("file", await prepareImageForUpload(file));

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
  if (!body.item?.id) {
    throw new Error(
      "The garment was analyzed, but its wardrobe details were incomplete. Please try again.",
    );
  }
  return body.item;
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
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  // Mirrors pendingPhotos so object URLs can be revoked on unmount.
  const pendingPhotosRef = useRef<PendingPhoto[]>([]);
  // Bumped whenever the upload queue is discarded, so slow HEIC conversions
  // from an earlier session do not reopen the dialog.
  const uploadSessionRef = useRef(0);
  const nextPhotoIdRef = useRef(0);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [selectedItem, setSelectedItem] = useState<WardrobeItem | null>(null);

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
      notifications.dismiss("wardrobe-load");
    } catch (error) {
      const message = safeNotificationMessage(
        error instanceof Error ? error.message : null,
        "Your wardrobe could not be loaded.",
      );
      setLoadError(message);
      setLoadState("error");
      notifications.error({
        id: "wardrobe-load",
        title: "Couldn’t refresh your wardrobe.",
        description: message,
      });
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadItems(activeCategory);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [activeCategory, loadItems]);

  useEffect(() => {
    pendingPhotosRef.current = pendingPhotos;
  }, [pendingPhotos]);

  useEffect(() => {
    return () => {
      for (const photo of pendingPhotosRef.current) {
        URL.revokeObjectURL(photo.previewUrl);
      }
    };
  }, []);

  function clearPendingPhotos() {
    uploadSessionRef.current += 1;
    for (const photo of pendingPhotosRef.current) {
      URL.revokeObjectURL(photo.previewUrl);
    }
    pendingPhotosRef.current = [];
    setPendingPhotos([]);
  }

  function removePendingPhoto(id: number) {
    const photo = pendingPhotosRef.current.find((entry) => entry.id === id);
    if (photo) URL.revokeObjectURL(photo.previewUrl);
    setPendingPhotos((current) => current.filter((entry) => entry.id !== id));
  }

  async function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selected.length === 0) return;

    const room = Math.max(
      0,
      MAX_PHOTOS_PER_BATCH - pendingPhotosRef.current.length,
    );
    const accepted = selected.slice(0, room);
    if (accepted.length < selected.length) {
      notifications.info({
        id: "wardrobe-batch-limit",
        title: `You can add up to ${MAX_PHOTOS_PER_BATCH} photos at a time.`,
        description:
          accepted.length > 0
            ? `Only the first ${accepted.length} were added.`
            : "Analyze or remove some photos first.",
      });
    }
    if (accepted.length === 0) return;

    const session = uploadSessionRef.current;
    const hasHeic = accepted.some(isHeicFile);
    const prepared: PendingPhoto[] = [];
    const unreadable: string[] = [];

    // Most browsers cannot preview HEIC, so convert it to JPEG up front.
    if (hasHeic) {
      setIsPreparing(true);
      notifications.info({
        id: "wardrobe-convert",
        title:
          accepted.length > 1
            ? "Converting your photos…"
            : "Converting your photo…",
      });
    }

    try {
      for (const original of accepted) {
        let file = original;
        if (isHeicFile(original)) {
          try {
            file = await prepareImageForUpload(original);
          } catch {
            unreadable.push(original.name);
            continue;
          }
        }
        nextPhotoIdRef.current += 1;
        prepared.push({
          id: nextPhotoIdRef.current,
          file,
          previewUrl: URL.createObjectURL(file),
          status: "ready",
          error: "",
        });
      }
    } finally {
      if (hasHeic) setIsPreparing(false);
    }

    // The dialog was closed while photos were converting.
    if (session !== uploadSessionRef.current) {
      for (const photo of prepared) URL.revokeObjectURL(photo.previewUrl);
      return;
    }

    if (unreadable.length > 0) {
      notifications.error({
        id: "wardrobe-convert",
        title:
          unreadable.length > 1
            ? `Couldn’t open ${unreadable.length} photos.`
            : "Couldn’t open that photo.",
        description:
          unreadable.length > 1
            ? `${unreadable.join(", ")} could not be read. Try JPEG, PNG, or WebP images.`
            : "This photo could not be read. Try a JPEG, PNG, or WebP image.",
      });
    } else if (hasHeic) {
      notifications.dismiss("wardrobe-convert");
    }

    if (prepared.length > 0) {
      const next = [...pendingPhotosRef.current, ...prepared];
      pendingPhotosRef.current = next;
      setPendingPhotos(next);
    }
  }

  async function uploadPendingPhotos() {
    const queue = pendingPhotosRef.current.filter(
      (photo) => photo.status !== "uploading",
    );
    if (queue.length === 0 || isUploading) return;

    setIsUploading(true);
    setUploadProgress({ done: 0, total: queue.length });
    setPendingPhotos((current) =>
      current.map((photo) => ({ ...photo, status: "uploading", error: "" })),
    );

    let added = 0;
    const failures: string[] = [];

    await forEachWithConcurrency(queue, UPLOAD_CONCURRENCY, async (photo) => {
      try {
        const createdItem = await createWardrobeItem(photo.file);
        added += 1;

        if (
          activeCategory === "all" ||
          createdItem.category === activeCategory
        ) {
          setItems((current) => [createdItem, ...current]);
        }

        URL.revokeObjectURL(photo.previewUrl);
        setPendingPhotos((current) =>
          current.filter((entry) => entry.id !== photo.id),
        );
      } catch (error) {
        const message = safeNotificationMessage(
          error instanceof Error ? error.message : null,
          "The garment could not be analyzed. Try another photo.",
        );
        failures.push(message);
        setPendingPhotos((current) =>
          current.map((entry) =>
            entry.id === photo.id
              ? { ...entry, status: "failed", error: message }
              : entry,
          ),
        );
      } finally {
        setUploadProgress((current) => ({
          ...current,
          done: current.done + 1,
        }));
      }
    });

    setIsUploading(false);

    if (failures.length === 0) {
      notifications.success({
        id: "wardrobe-upload",
        title:
          added === 1
            ? "Garment added to your wardrobe."
            : `${added} garments added to your wardrobe.`,
      });
      return;
    }

    notifications.error({
      id: "wardrobe-upload",
      title:
        queue.length === 1
          ? "The garment could not be added."
          : `${failures.length} of ${queue.length} photos couldn’t be added.`,
      description:
        added > 0 ? `${added} added. Retry or remove the rest.` : failures[0],
    });
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
        <section className="relative overflow-hidden rounded-[2rem] bg-brand px-6 py-8 text-white shadow-[0_35px_90px_-55px_rgba(6,78,59,0.9)] sm:px-10 sm:py-11 lg:px-12">
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
              <label
                className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#c7623d] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_35px_-20px_rgba(0,0,0,0.8)] transition focus-within:ring-4 focus-within:ring-white/20 ${
                  isPreparing
                    ? "cursor-wait opacity-70"
                    : "cursor-pointer hover:-translate-y-0.5 hover:bg-[#b75533]"
                }`}
              >
                <span className="text-lg leading-none" aria-hidden="true">
                  ＋
                </span>
                Add garment
                <input
                  className="sr-only"
                  type="file"
                  accept={ACCEPTED_IMAGE_TYPES}
                  multiple
                  disabled={isPreparing}
                  onChange={chooseFiles}
                />
              </label>
            </div>
          </div>
        </section>

        <section className="pt-8">
          <div className="rounded-[1.6rem] border border-ink/8 bg-card/58 p-3 shadow-[0_20px_55px_-45px_rgba(6,78,59,0.6)] backdrop-blur sm:p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <label className="relative block lg:w-[18rem]">
                <span className="sr-only">Search wardrobe</span>
                <span
                  className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-lg text-ink/38"
                  aria-hidden="true"
                >
                  ⌕
                </span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search name, color, pattern…"
                  className="min-h-11 w-full rounded-full border border-ink/10 bg-surface py-2.5 pr-4 pl-11 text-sm text-ink outline-none placeholder:text-ink/35 focus:border-emerald-700/50 focus:ring-4 focus:ring-emerald-700/8 dark:focus:border-emerald-400/50 dark:focus:ring-emerald-400/8"
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
                    aria-pressed={activeCategory === category.value}
                    onClick={() => setActiveCategory(category.value)}
                    className={`shrink-0 rounded-full px-3.5 py-2 text-[0.78rem] font-semibold transition ${
                      activeCategory === category.value
                        ? "bg-brand text-white shadow-sm"
                        : "text-ink/52 hover:bg-card hover:text-ink"
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
              <h2 className="display-type text-2xl tracking-[-0.035em] text-ink sm:text-3xl">
                {activeCategory === "all"
                  ? "Your collection"
                  : categories.find(
                      (category) => category.value === activeCategory,
                    )?.label}
              </h2>
              {loadState === "ready" && items.length > 0 ? (
                <p className="mt-1 text-xs text-ink/45 sm:text-sm">
                  {visibleItems.length}{" "}
                  {visibleItems.length === 1 ? "piece" : "pieces"}
                  {activeCategory === "all"
                    ? ` · ${availableCount} ready to wear`
                    : ""}
                </p>
              ) : null}
            </div>
            <p className="hidden text-xs text-ink/38 sm:block">
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
            <div className="mt-7 rounded-[2rem] border border-dashed border-ink/18 bg-card/35 px-6 py-14 text-center">
              <p className="display-type text-2xl tracking-[-0.03em] text-ink">
                Nothing matches “{searchQuery.trim()}”
              </p>
              <p className="mt-2 text-sm text-ink/50">
                Try a color, garment name, or pattern.
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="mt-5 rounded-full border border-ink/12 bg-card px-5 py-2.5 text-sm font-semibold text-ink"
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

      {pendingPhotos.length > 0 ? (
        <UploadDialog
          photos={pendingPhotos}
          isUploading={isUploading}
          isPreparing={isPreparing}
          progress={uploadProgress}
          onChooseFiles={chooseFiles}
          onRemove={removePendingPhoto}
          onCancel={() => {
            if (!isUploading) clearPendingPhotos();
          }}
          onUpload={() => void uploadPendingPhotos()}
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
      className="group overflow-hidden rounded-[1.4rem] border border-ink/8 bg-surface/82 text-left shadow-[0_22px_60px_-48px_rgba(6,78,59,0.65)] transition duration-300 hover:-translate-y-1 hover:border-ink/14 hover:bg-card hover:shadow-[0_30px_65px_-42px_rgba(6,78,59,0.68)] focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-700/20 sm:rounded-[1.75rem] dark:focus-visible:ring-emerald-400/20"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-ink/5">
        <Image
          src={item.imageUrl}
          unoptimized
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
        <p className="truncate font-semibold tracking-[-0.015em] text-ink sm:text-lg">
          {item.name}
        </p>
        <p className="mt-1 text-xs text-ink/50 capitalize sm:text-sm">
          {item.category} · {item.pattern}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.colors.slice(0, 2).map((color) => (
            <span
              key={color}
              className="rounded-full bg-ink/5 px-2.5 py-1 text-[0.68rem] font-medium text-ink/65 capitalize"
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
          className="overflow-hidden rounded-[1.4rem] border border-ink/5 bg-card/45 sm:rounded-[1.75rem]"
        >
          <div className="aspect-[4/5] animate-pulse bg-ink/8" />
          <div className="space-y-2 p-4">
            <div className="h-4 w-2/3 animate-pulse rounded bg-ink/10" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-ink/7" />
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
    <div className="mt-10 rounded-3xl border border-red-900/10 bg-red-50/70 p-8 text-center dark:border-red-300/15 dark:bg-red-950/40">
      <p className="font-semibold text-red-950 dark:text-red-100">
        We couldn’t open your wardrobe.
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-red-950/65 dark:text-red-100/65">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 rounded-full bg-red-950 px-5 py-2.5 text-sm font-semibold text-white dark:bg-red-800"
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
    <div className="mt-10 rounded-[2rem] border border-dashed border-ink/20 bg-card/35 px-6 py-16 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-900 text-2xl text-white">
        ◇
      </div>
      <h2 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-ink">
        {filtered ? `No ${category} here yet` : "Your wardrobe starts here"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink/55">
        {filtered
          ? "Try another category or add a new garment."
          : "Add a clear photo of one garment and Wadrobe will organize the details for you."}
      </p>
      {filtered ? (
        <button
          type="button"
          onClick={onReset}
          className="mt-5 rounded-full border border-ink/15 bg-card px-5 py-2.5 text-sm font-semibold text-ink"
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
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const disabledRef = useRef(disabled);

  useEffect(() => {
    onCloseRef.current = onClose;
    disabledRef.current = disabled;
  }, [disabled, onClose]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !disabledRef.current) {
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]",
        ),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
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
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-emerald-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !disabled) onClose();
      }}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[94vh] min-h-0 w-full overflow-y-auto rounded-t-[2rem] bg-sheet shadow-2xl sm:max-w-3xl sm:rounded-[2rem]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink/10 bg-sheet/95 px-5 py-4 backdrop-blur sm:px-7">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-ink">
            {title}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close dialog"
            disabled={disabled}
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full border border-ink/10 bg-card/60 text-xl text-ink transition hover:bg-card disabled:opacity-40"
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
  photos,
  isUploading,
  isPreparing,
  progress,
  onChooseFiles,
  onRemove,
  onCancel,
  onUpload,
}: {
  photos: PendingPhoto[];
  isUploading: boolean;
  isPreparing: boolean;
  progress: { done: number; total: number };
  onChooseFiles: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: (id: number) => void;
  onCancel: () => void;
  onUpload: () => void;
}) {
  const isSingle = photos.length === 1;
  const allFailed = photos.every((photo) => photo.status === "failed");
  const canAddMore =
    !isUploading && !isPreparing && photos.length < MAX_PHOTOS_PER_BATCH;

  let uploadLabel: string;
  if (isUploading) {
    uploadLabel =
      progress.total > 1
        ? `Analyzing ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…`
        : "Analyzing…";
  } else if (allFailed) {
    uploadLabel = isSingle ? "Try again" : `Retry ${photos.length} items`;
  } else {
    uploadLabel = isSingle ? "Analyze item" : `Analyze ${photos.length} items`;
  }

  const actions = (
    <div className="mt-6 flex gap-3">
      <label
        className={`flex flex-1 items-center justify-center rounded-full border border-ink/15 bg-card px-4 py-3 text-center text-sm font-semibold text-ink ${
          canAddMore ? "cursor-pointer" : "cursor-not-allowed opacity-40"
        }`}
      >
        Add more photos
        <input
          className="sr-only"
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          multiple
          disabled={!canAddMore}
          onChange={onChooseFiles}
        />
      </label>
      <button
        type="button"
        disabled={isUploading || isPreparing}
        onClick={onUpload}
        className="flex-1 rounded-full bg-brand px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {uploadLabel}
      </button>
    </div>
  );

  const intro = (
    <>
      <p className="text-xs font-semibold tracking-[0.15em] text-emerald-700 uppercase dark:text-emerald-300">
        One item per photo
      </p>
      <h3 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-ink">
        {isSingle
          ? "Is the garment clear and centered?"
          : "Is each garment clear and centered?"}
      </h3>
      <p className="mt-3 text-sm leading-6 text-ink/60">
        Photos containing a full outfit are treated as one primary garment. You
        can correct every detail after analysis.
        {isSingle ? null : ` Up to ${MAX_PHOTOS_PER_BATCH} photos at a time.`}
      </p>
    </>
  );

  return (
    <DialogShell
      title={isSingle ? "Add a garment" : "Add garments"}
      onClose={onCancel}
      disabled={isUploading}
    >
      {isSingle ? (
        <div className="grid gap-6 p-5 sm:grid-cols-[0.9fr_1.1fr] sm:p-7">
          <PendingPhotoTile
            photo={photos[0]}
            large
            removable={false}
            onRemove={onRemove}
          />
          <div className="flex flex-col justify-center">
            {intro}
            <p className="mt-5 truncate rounded-2xl bg-card/70 px-4 py-3 text-xs text-ink/55">
              {photos[0].file.name}
            </p>
            {photos[0].error ? (
              <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm leading-5 text-red-900 dark:bg-red-950/40 dark:text-red-200">
                {photos[0].error}
              </p>
            ) : null}
            {actions}
          </div>
        </div>
      ) : (
        <div className="p-5 sm:p-7">
          {intro}
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4">
            {photos.map((photo) => (
              <li key={photo.id}>
                <PendingPhotoTile
                  photo={photo}
                  removable={!isUploading}
                  onRemove={onRemove}
                />
                <p className="mt-2 truncate text-xs text-ink/55">
                  {photo.file.name}
                </p>
                {photo.error ? (
                  <p className="mt-1 line-clamp-3 text-xs leading-4 text-red-800 dark:text-red-300">
                    {photo.error}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          {actions}
        </div>
      )}
    </DialogShell>
  );
}

function PendingPhotoTile({
  photo,
  large = false,
  removable,
  onRemove,
}: {
  photo: PendingPhoto;
  large?: boolean;
  removable: boolean;
  onRemove: (id: number) => void;
}) {
  return (
    <div
      className={`relative aspect-[4/5] overflow-hidden bg-ink/5 ${
        large ? "rounded-3xl" : "rounded-2xl"
      } ${photo.status === "failed" ? "ring-2 ring-red-600/70" : ""}`}
    >
      <Image
        src={photo.previewUrl}
        alt={`Preview of ${photo.file.name}`}
        fill
        unoptimized
        className="object-cover"
      />
      {photo.status === "uploading" ? (
        <div className="absolute inset-0 grid place-items-center bg-emerald-950/65 px-4 text-center text-white backdrop-blur-sm">
          <div>
            <div
              className={`mx-auto animate-spin rounded-full border-2 border-white/30 border-t-white ${
                large ? "h-9 w-9" : "h-7 w-7"
              }`}
            />
            <p className={`font-semibold ${large ? "mt-4" : "mt-2 text-xs"}`}>
              Analyzing garment…
            </p>
            {large ? (
              <p className="mt-1 text-xs text-white/70">
                Reading color, pattern, fit, and season.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
      {photo.status === "failed" && !large ? (
        <span className="absolute bottom-2 left-2 rounded-full bg-red-700 px-2 py-0.5 text-[0.65rem] font-semibold text-white">
          Failed
        </span>
      ) : null}
      {removable ? (
        <button
          type="button"
          aria-label={`Remove ${photo.file.name}`}
          onClick={() => onRemove(photo.id)}
          className="absolute top-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-lg leading-none text-white backdrop-blur transition hover:bg-black/75"
        >
          ×
        </button>
      ) : null}
    </div>
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
      notifications.success({
        id: `wardrobe-edit-${item.id}`,
        title: "Garment details saved.",
      });
    } catch (saveError) {
      const message = safeNotificationMessage(
        saveError instanceof Error ? saveError.message : null,
        "The item could not be saved. Please try again.",
      );
      setError(message);
      notifications.error({
        id: `wardrobe-edit-${item.id}`,
        title: "The garment could not be saved.",
        description: message,
      });
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
      notifications.success({
        id: `wardrobe-delete-${item.id}`,
        title: "Garment deleted.",
      });
    } catch (deleteError) {
      const message = safeNotificationMessage(
        deleteError instanceof Error ? deleteError.message : null,
        "The item could not be deleted. Please try again.",
      );
      setError(message);
      notifications.error({
        id: `wardrobe-delete-${item.id}`,
        title: "The garment could not be deleted.",
        description: message,
      });
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
            <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-ink/5">
              <Image
                src={item.imageUrl}
                unoptimized
                alt={item.name}
                fill
                sizes="(max-width: 640px) 100vw, 40vw"
                className="object-cover"
              />
            </div>
            <label className="mt-4 flex cursor-pointer items-center justify-between rounded-2xl border border-ink/10 bg-card/65 px-4 py-3.5">
              <span>
                <span className="block text-sm font-semibold text-ink">
                  Available to wear
                </span>
                <span className="mt-0.5 block text-xs text-ink/45">
                  Turn off for laundry or storage.
                </span>
              </span>
              <input
                type="checkbox"
                checked={draft.available}
                onChange={(event) =>
                  setField("available", event.target.checked)
                }
                className="h-5 w-5 accent-emerald-800 dark:accent-emerald-400"
              />
            </label>
          </div>

          <div className="grid content-start gap-5">
            <label className="text-sm font-semibold text-ink/75">
              Name
              <input
                className={fieldClass}
                value={draft.name}
                maxLength={160}
                onChange={(event) => setField("name", event.target.value)}
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-semibold text-ink/75">
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
              <label className="text-sm font-semibold text-ink/75">
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

            <label className="text-sm font-semibold text-ink/75">
              Colors
              <input
                className={fieldClass}
                value={draft.colors}
                placeholder="navy, white"
                onChange={(event) => setField("colors", event.target.value)}
              />
              <span className="mt-1.5 block text-xs font-normal text-ink/40">
                Separate colors with commas.
              </span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-semibold text-ink/75">
                Pattern
                <input
                  className={fieldClass}
                  value={draft.pattern}
                  maxLength={80}
                  onChange={(event) => setField("pattern", event.target.value)}
                />
              </label>
              <label className="text-sm font-semibold text-ink/75">
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

            <label className="text-sm font-semibold text-ink/75">
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
              <legend className="text-sm font-semibold text-ink/75">
                Seasons
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {seasons.map((season) => {
                  const active = draft.season.includes(season);
                  return (
                    <button
                      type="button"
                      key={season}
                      aria-pressed={active}
                      onClick={() => toggleSeason(season)}
                      className={`rounded-full px-3.5 py-2 text-xs font-semibold capitalize transition ${
                        active
                          ? "bg-emerald-900 text-white"
                          : "border border-ink/10 bg-card text-ink/55"
                      }`}
                    >
                      {season}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <label className="text-sm font-semibold text-ink/75">
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
          <p className="mx-5 mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-900 sm:mx-7 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-ink/10 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-900 dark:text-red-200">
                Delete permanently?
              </span>
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
                className="px-2 py-2 text-xs font-semibold text-ink/55"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setConfirmDelete(true)}
              className="self-start px-1 py-2 text-sm font-semibold text-red-800 disabled:opacity-40 dark:text-red-300"
            >
              Delete item
            </button>
          )}

          <div className="flex gap-3 sm:ml-auto">
            <button
              type="button"
              disabled={disabled}
              onClick={onClose}
              className="flex-1 rounded-full border border-ink/15 bg-card px-5 py-3 text-sm font-semibold text-ink disabled:opacity-40 sm:flex-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={disabled}
              className="flex-1 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:flex-none"
            >
              {isSaving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </form>
    </DialogShell>
  );
}
