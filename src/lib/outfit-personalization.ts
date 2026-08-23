import type { Item, Outfit } from "@/lib/db/schema";
import type { RecommendationContext } from "@/lib/outfit-schema";

const MAX_RANKED_SIGNALS = 3;

export type PersonalizationSummary = {
  feedbackCount: number;
  savedCount: number;
  rejectedCount: number;
  mostUsedItemIds: string[];
  preferredItemIds: string[];
  avoidedItemIds: string[];
  preferredColors: string[];
  avoidedColors: string[];
  preferredPatterns: string[];
  avoidedPatterns: string[];
  preferredFormalityLevels: number[];
  avoidedFormalityLevels: number[];
  preferredStyles: string[];
  avoidedStyles: string[];
};

function addScore(scores: Map<string, number>, value: string, score: number) {
  scores.set(value, (scores.get(value) ?? 0) + score);
}

function rankScores(
  scores: Map<string, number>,
  direction: "positive" | "negative",
) {
  return [...scores.entries()]
    .filter(([, score]) => (direction === "positive" ? score > 0 : score < 0))
    .sort(([leftValue, leftScore], [rightValue, rightScore]) => {
      const scoreDifference =
        direction === "positive"
          ? rightScore - leftScore
          : leftScore - rightScore;
      return scoreDifference || leftValue.localeCompare(rightValue);
    })
    .slice(0, MAX_RANKED_SIGNALS)
    .map(([value]) => value);
}

function rankUsage(scores: Map<string, number>) {
  return [...scores.entries()]
    .sort(
      ([leftValue, leftScore], [rightValue, rightScore]) =>
        rightScore - leftScore || leftValue.localeCompare(rightValue),
    )
    .slice(0, MAX_RANKED_SIGNALS)
    .map(([value]) => value);
}

function contextSimilarity(
  previous: Outfit["context"],
  current: RecommendationContext,
) {
  let matchingSignals = 0;
  let comparedSignals = 0;

  for (const field of ["occasion", "style"] as const) {
    const previousWords = new Set(
      previous[field]?.toLowerCase().match(/[a-z0-9]+/g) ?? [],
    );
    const currentWords = new Set(
      current[field].toLowerCase().match(/[a-z0-9]+/g) ?? [],
    );
    if (previousWords.size > 0) {
      comparedSignals += 1;
      if ([...previousWords].some((word) => currentWords.has(word))) {
        matchingSignals += 1;
      }
    }
  }

  if (previous.walkingLevel) {
    comparedSignals += 1;
    if (previous.walkingLevel === current.walkingLevel) matchingSignals += 1;
  }

  if (previous.temperature !== undefined) {
    comparedSignals += 1;
    const previousFahrenheit =
      previous.temperatureUnit === "celsius"
        ? (previous.temperature * 9) / 5 + 32
        : previous.temperature;
    const currentFahrenheit =
      current.temperatureUnit === "celsius"
        ? (current.temperature * 9) / 5 + 32
        : current.temperature;
    if (Math.abs(previousFahrenheit - currentFahrenheit) <= 15) {
      matchingSignals += 1;
    }
  }

  return comparedSignals === 0 ? 0 : matchingSignals / comparedSignals;
}

/**
 * Turns recent outfit decisions into a small, deterministic set of preference
 * signals. More recent decisions receive more weight, and saved/rejected
 * signals cancel each other when the same attribute appears in both.
 */
export function buildPersonalizationSummary(
  wardrobeItems: Item[],
  feedback: Outfit[],
  currentContext?: RecommendationContext,
): PersonalizationSummary {
  const itemMap = new Map(wardrobeItems.map((item) => [item.id, item]));
  const itemUsage = new Map<string, number>();
  const itemScores = new Map<string, number>();
  const colorScores = new Map<string, number>();
  const patternScores = new Map<string, number>();
  const formalityScores = new Map<string, number>();
  const styleScores = new Map<string, number>();
  const orderedFeedback = feedback
    .filter(
      (outfit) => outfit.status === "saved" || outfit.status === "rejected",
    )
    .sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    );

  orderedFeedback.forEach((outfit, index) => {
    const recencyWeight = 1 / (1 + index * 0.2);
    const relevanceWeight = currentContext
      ? 1 + contextSimilarity(outfit.context, currentContext)
      : 1;
    const preferenceWeight =
      (outfit.status === "saved" ? 1 : -1) * recencyWeight * relevanceWeight;
    const normalizedStyle = outfit.context.style?.trim().toLowerCase();

    if (normalizedStyle) {
      addScore(styleScores, normalizedStyle, preferenceWeight);
    }

    for (const itemId of outfit.itemIds) {
      const item = itemMap.get(itemId);
      if (!item) continue;

      if (item.available) {
        addScore(itemUsage, itemId, recencyWeight * relevanceWeight);
        addScore(itemScores, itemId, preferenceWeight);
      }
      addScore(formalityScores, String(item.formality), preferenceWeight);
      addScore(
        patternScores,
        item.pattern.trim().toLowerCase(),
        preferenceWeight,
      );
      const normalizedColors = new Set(
        item.colors.map((color) => color.trim().toLowerCase()),
      );
      for (const color of normalizedColors) {
        addScore(colorScores, color, preferenceWeight);
      }
    }
  });

  return {
    feedbackCount: orderedFeedback.length,
    savedCount: orderedFeedback.filter((outfit) => outfit.status === "saved")
      .length,
    rejectedCount: orderedFeedback.filter(
      (outfit) => outfit.status === "rejected",
    ).length,
    mostUsedItemIds: rankUsage(itemUsage),
    preferredItemIds: rankScores(itemScores, "positive"),
    avoidedItemIds: rankScores(itemScores, "negative"),
    preferredColors: rankScores(colorScores, "positive"),
    avoidedColors: rankScores(colorScores, "negative"),
    preferredPatterns: rankScores(patternScores, "positive"),
    avoidedPatterns: rankScores(patternScores, "negative"),
    preferredFormalityLevels: rankScores(formalityScores, "positive").map(
      Number,
    ),
    avoidedFormalityLevels: rankScores(formalityScores, "negative").map(Number),
    preferredStyles: rankScores(styleScores, "positive"),
    avoidedStyles: rankScores(styleScores, "negative"),
  };
}
