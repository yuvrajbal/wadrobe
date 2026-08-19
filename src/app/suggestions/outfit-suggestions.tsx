"use client";

import Image from "next/image";
import Link from "next/link";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type Category = "top" | "bottom" | "shoes" | "outerwear" | "accessory";
type WardrobeItem = {
  id: string;
  imageUrl: string;
  name: string;
  category: Category;
  colors: string[];
  pattern: string;
  available: boolean;
};
type RecommendationContext = {
  occasion: string;
  temperature: number;
  temperatureUnit: "fahrenheit";
  walkingLevel: "low" | "moderate" | "high";
  style: string;
};
type Suggestion = { itemIds: string[]; rationale: string };
type DecisionState = "loading" | "saved" | "rejected" | "error";

const fieldClass =
  "mt-2 w-full rounded-2xl border border-emerald-950/15 bg-white px-4 py-3 text-sm text-emerald-950 outline-none transition placeholder:text-emerald-950/35 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10";

async function responseError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return body?.error ?? fallback;
}

export function OutfitSuggestions() {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [itemsState, setItemsState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [occasion, setOccasion] = useState("casual day");
  const [temperature, setTemperature] = useState("");
  const [walkingLevel, setWalkingLevel] =
    useState<RecommendationContext["walkingLevel"]>("moderate");
  const [style, setStyle] = useState("relaxed and polished");
  const [weatherState, setWeatherState] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [weatherMessage, setWeatherMessage] = useState("");
  const [requestState, setRequestState] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [requestError, setRequestError] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [submittedContext, setSubmittedContext] =
    useState<RecommendationContext | null>(null);
  const [decisions, setDecisions] = useState<Record<string, DecisionState>>({});
  const [decisionErrors, setDecisionErrors] = useState<Record<string, string>>(
    {},
  );

  const loadItems = useCallback(async () => {
    setItemsState("loading");
    try {
      const response = await fetch("/api/items?available=true", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error();
      const body = (await response.json()) as { items: WardrobeItem[] };
      setItems(body.items);
      setItemsState("ready");
    } catch {
      setItemsState("error");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadItems();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadItems]);

  const itemMap = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  );

  function useLocalWeather() {
    setWeatherState("loading");
    setWeatherMessage("");

    if (!("geolocation" in navigator)) {
      setWeatherState("error");
      setWeatherMessage(
        "Location is not supported. Enter a temperature manually.",
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const query = new URLSearchParams({
            latitude: String(coords.latitude),
            longitude: String(coords.longitude),
          });
          const response = await fetch(`/api/weather?${query}`);
          if (!response.ok) {
            throw new Error(
              await responseError(
                response,
                "Local weather could not be loaded.",
              ),
            );
          }
          const body = (await response.json()) as { temperature: number };
          setTemperature(String(body.temperature));
          setWeatherState("success");
          setWeatherMessage(`Local weather added: ${body.temperature}°F.`);
        } catch (error) {
          setWeatherState("error");
          setWeatherMessage(
            error instanceof Error
              ? error.message
              : "Local weather could not be loaded.",
          );
        }
      },
      () => {
        setWeatherState("error");
        setWeatherMessage(
          "Location permission was unavailable. Enter it manually.",
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 15 * 60_000 },
    );
  }

  async function requestSuggestions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericTemperature = Number(temperature);
    if (
      !occasion.trim() ||
      !style.trim() ||
      temperature.trim() === "" ||
      !Number.isFinite(numericTemperature)
    ) {
      setRequestState("error");
      setRequestError("Add an occasion, temperature, and style direction.");
      return;
    }

    const context: RecommendationContext = {
      occasion: occasion.trim(),
      temperature: numericTemperature,
      temperatureUnit: "fahrenheit",
      walkingLevel,
      style: style.trim(),
    };
    setRequestState("loading");
    setRequestError("");
    setSuggestions([]);
    setDecisions({});
    setDecisionErrors({});

    try {
      const response = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ context }),
      });
      if (!response.ok) {
        throw new Error(
          await responseError(response, "Suggestions could not be created."),
        );
      }
      const body = (await response.json()) as { suggestions: Suggestion[] };
      setSuggestions(body.suggestions);
      setSubmittedContext(context);
      setRequestState("success");
    } catch (error) {
      setRequestState("error");
      setRequestError(
        error instanceof Error
          ? error.message
          : "Suggestions could not be created.",
      );
    }
  }

  async function recordDecision(
    suggestion: Suggestion,
    status: "saved" | "rejected",
  ) {
    if (!submittedContext) return;
    const key = suggestion.itemIds.join(":");
    setDecisions((current) => ({ ...current, [key]: "loading" }));
    setDecisionErrors((current) => ({ ...current, [key]: "" }));

    try {
      const response = await fetch("/api/outfits/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          itemIds: suggestion.itemIds,
          context: submittedContext,
          status,
        }),
      });
      if (!response.ok) {
        throw new Error(
          await responseError(response, "Your choice could not be saved."),
        );
      }
      setDecisions((current) => ({ ...current, [key]: status }));
    } catch (error) {
      setDecisions((current) => ({ ...current, [key]: "error" }));
      setDecisionErrors((current) => ({
        ...current,
        [key]:
          error instanceof Error
            ? error.message
            : "Your choice could not be saved.",
      }));
    }
  }

  const hasCoreWardrobe = ["top", "bottom", "shoes"].every((category) =>
    items.some((item) => item.category === category),
  );

  return (
    <main className="min-h-screen pb-32 md:pb-16">
      <div className="mx-auto w-full max-w-7xl px-5 py-9 sm:px-8 sm:py-14">
        <section className="max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.18em] text-emerald-700 uppercase">
            Context-aware suggestions
          </p>
          <h1 className="mt-3 text-4xl leading-none font-semibold tracking-[-0.045em] text-emerald-950 sm:text-6xl">
            Dress for the actual day.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-emerald-950/60 sm:text-base">
            Tell Wadrobe where you’re going and how you want to feel. It will
            combine only pieces currently available to wear.
          </p>
        </section>

        <div className="mt-9 grid gap-7 lg:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)] lg:items-start">
          <form
            onSubmit={requestSuggestions}
            className="rounded-[2rem] border border-emerald-950/10 bg-white/60 p-5 sm:p-7 lg:sticky lg:top-24"
          >
            <h2 className="text-xl font-semibold tracking-[-0.025em] text-emerald-950">
              What’s the plan?
            </h2>
            <div className="mt-6 grid gap-5">
              <label className="text-sm font-semibold text-emerald-950/75">
                Occasion
                <input
                  className={fieldClass}
                  value={occasion}
                  maxLength={120}
                  placeholder="Dinner, work, travel…"
                  onChange={(event) => setOccasion(event.target.value)}
                />
              </label>

              <label className="text-sm font-semibold text-emerald-950/75">
                Temperature
                <div className="relative">
                  <input
                    className={`${fieldClass} pr-12`}
                    value={temperature}
                    type="number"
                    min={-100}
                    max={150}
                    inputMode="decimal"
                    placeholder="72"
                    onChange={(event) => setTemperature(event.target.value)}
                  />
                  <span className="absolute top-[1.15rem] right-4 text-sm font-semibold text-emerald-950/45">
                    °F
                  </span>
                </div>
              </label>
              <button
                type="button"
                disabled={weatherState === "loading"}
                onClick={useLocalWeather}
                className="-mt-2 self-start rounded-full border border-emerald-950/15 bg-[#f7f5ef] px-4 py-2.5 text-xs font-semibold text-emerald-900 disabled:opacity-60"
              >
                {weatherState === "loading"
                  ? "Finding weather…"
                  : "Use local weather"}
              </button>
              {weatherMessage ? (
                <p
                  className={`-mt-3 text-xs leading-5 ${
                    weatherState === "error"
                      ? "text-red-800"
                      : "text-emerald-700"
                  }`}
                >
                  {weatherMessage}
                </p>
              ) : null}
              <a
                href="https://open-meteo.com/"
                target="_blank"
                rel="noreferrer"
                className="-mt-4 text-[0.68rem] text-emerald-950/35 underline decoration-emerald-950/20 underline-offset-2"
              >
                Weather by Open-Meteo
              </a>

              <fieldset>
                <legend className="text-sm font-semibold text-emerald-950/75">
                  Walking level
                </legend>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(["low", "moderate", "high"] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      aria-pressed={walkingLevel === level}
                      onClick={() => setWalkingLevel(level)}
                      className={`rounded-2xl px-2 py-3 text-xs font-semibold capitalize transition ${
                        walkingLevel === level
                          ? "bg-emerald-950 text-white"
                          : "border border-emerald-950/10 bg-white text-emerald-950/55"
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="text-sm font-semibold text-emerald-950/75">
                Style direction
                <input
                  className={fieldClass}
                  value={style}
                  maxLength={120}
                  placeholder="Minimal, bold, relaxed…"
                  onChange={(event) => setStyle(event.target.value)}
                />
              </label>
            </div>

            {requestError ? (
              <p
                role="alert"
                className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm leading-5 text-red-900"
              >
                {requestError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={
                requestState === "loading" ||
                itemsState !== "ready" ||
                !hasCoreWardrobe
              }
              className="mt-6 min-h-12 w-full rounded-full bg-emerald-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
            >
              {requestState === "loading"
                ? "Building looks…"
                : "Suggest outfits"}
            </button>
          </form>

          <section aria-live="polite">
            {itemsState === "loading" ? <SuggestionSkeleton /> : null}

            {itemsState === "error" ? (
              <div className="rounded-[2rem] bg-red-50 p-7 text-red-950">
                <h2 className="font-semibold">
                  Your wardrobe could not be loaded.
                </h2>
                <p className="mt-2 text-sm text-red-950/60">
                  Try again without losing the context you entered.
                </p>
                <button
                  type="button"
                  onClick={() => void loadItems()}
                  className="mt-5 rounded-full bg-red-950 px-5 py-2.5 text-sm font-semibold text-white"
                >
                  Try again
                </button>
              </div>
            ) : null}

            {itemsState === "ready" && !hasCoreWardrobe ? (
              <div className="rounded-[2rem] border border-dashed border-emerald-950/20 bg-white/40 p-8 text-center sm:p-12">
                <h2 className="text-2xl font-semibold tracking-[-0.03em] text-emerald-950">
                  Complete your core wardrobe
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-emerald-950/55">
                  Suggestions need at least one available top, bottom, and pair
                  of shoes.
                </p>
                <Link
                  href="/"
                  className="mt-5 inline-flex rounded-full bg-emerald-950 px-5 py-3 text-sm font-semibold text-white"
                >
                  Open wardrobe
                </Link>
              </div>
            ) : null}

            {itemsState === "ready" &&
            hasCoreWardrobe &&
            requestState === "idle" ? (
              <div className="rounded-[2rem] border border-emerald-950/10 bg-emerald-950 p-8 text-white sm:p-12">
                <span className="text-3xl text-emerald-200">✦</span>
                <h2 className="mt-5 text-3xl font-semibold tracking-[-0.035em]">
                  Your wardrobe is ready to work.
                </h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-white/60">
                  Add today’s context to receive up to three distinct outfits.
                  No images are sent to the model.
                </p>
              </div>
            ) : null}

            {requestState === "loading" ? <SuggestionSkeleton /> : null}

            {requestState === "success" ? (
              <div className="grid gap-5">
                <div className="flex items-end justify-between px-1">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.14em] text-emerald-700 uppercase">
                      Your options
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-emerald-950">
                      {suggestions.length} considered looks
                    </h2>
                  </div>
                </div>
                {suggestions.map((suggestion, index) => (
                  <SuggestionCard
                    key={suggestion.itemIds.join(":")}
                    index={index}
                    suggestion={suggestion}
                    items={suggestion.itemIds
                      .map((id) => itemMap.get(id))
                      .filter((item): item is WardrobeItem => Boolean(item))}
                    decision={decisions[suggestion.itemIds.join(":")]}
                    decisionError={decisionErrors[suggestion.itemIds.join(":")]}
                    onSave={() => void recordDecision(suggestion, "saved")}
                    onReject={() => void recordDecision(suggestion, "rejected")}
                  />
                ))}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}

function SuggestionCard({
  index,
  suggestion,
  items,
  decision,
  decisionError,
  onSave,
  onReject,
}: {
  index: number;
  suggestion: Suggestion;
  items: WardrobeItem[];
  decision?: DecisionState;
  decisionError?: string;
  onSave: () => void;
  onReject: () => void;
}) {
  const builderQuery = new URLSearchParams({
    items: suggestion.itemIds.join(","),
  });

  return (
    <article
      className={`overflow-hidden rounded-[2rem] border border-emerald-950/10 bg-white/65 p-4 transition sm:p-5 ${
        decision === "rejected" ? "opacity-60" : ""
      }`}
    >
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {items.map((item) => (
          <div
            key={item.id}
            className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-emerald-950/5"
          >
            <Image
              src={item.imageUrl}
              alt={item.name}
              fill
              sizes="(max-width: 640px) 33vw, 15vw"
              className="object-cover"
            />
            <span className="absolute right-1.5 bottom-1.5 rounded-full bg-emerald-950/75 px-2 py-1 text-[0.58rem] font-semibold text-white capitalize backdrop-blur">
              {item.category}
            </span>
          </div>
        ))}
      </div>
      <div className="px-1 pt-5">
        <p className="text-xs font-semibold tracking-[0.14em] text-emerald-700 uppercase">
          Look {index + 1}
        </p>
        <p className="mt-2 text-sm leading-6 text-emerald-950/65">
          {suggestion.rationale}
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <button
            type="button"
            disabled={Boolean(decision && decision !== "error")}
            onClick={onSave}
            className="rounded-full bg-emerald-950 px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            {decision === "loading"
              ? "Saving…"
              : decision === "saved"
                ? "Saved ✓"
                : "Save"}
          </button>
          <button
            type="button"
            disabled={Boolean(decision && decision !== "error")}
            onClick={onReject}
            className="rounded-full border border-emerald-950/15 bg-white px-3 py-2.5 text-xs font-semibold text-emerald-950 disabled:opacity-60"
          >
            {decision === "rejected" ? "Noted ✓" : "Not for me"}
          </button>
          <Link
            href={`/builder?${builderQuery}`}
            className="grid place-items-center rounded-full border border-emerald-950/15 px-3 py-2.5 text-center text-xs font-semibold text-emerald-950"
          >
            Tweak
          </Link>
        </div>
        {decisionError ? (
          <p className="mt-3 text-xs text-red-800">{decisionError}</p>
        ) : null}
      </div>
    </article>
  );
}

function SuggestionSkeleton() {
  return (
    <div className="grid gap-5">
      {Array.from({ length: 2 }, (_, index) => (
        <div
          key={index}
          className="h-72 animate-pulse rounded-[2rem] bg-emerald-950/8"
        />
      ))}
    </div>
  );
}
