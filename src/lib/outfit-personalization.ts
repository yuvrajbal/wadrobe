import type { Item, Outfit } from "@/lib/db/schema";

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

/**
 * Turns recent outfit decisions into a small, deterministic set of preference
 * signals. More recent decisions receive more weight, and saved/rejected
 * signals cancel each other when the same attribute appears in both.
 */
export function buildPersonalizationSummary(
  wardrobeItems: Item[],
  feedback: Outfit[],
): PersonalizationSummary {
  const itemMap = new Map(wardrobeItems.map((item) => [item.id, item]));
  const itemUsage = new Map<string, number>();
  const itemScores = new Map<string, number>();
  const colorScores = new Map<string, number>();
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
    const recencyWeight = orderedFeedback.length - index;
    const preferenceWeight =
      outfit.status === "saved" ? recencyWeight : -recencyWeight;
    const normalizedStyle = outfit.context.style?.trim().toLowerCase();

    if (normalizedStyle) {
      addScore(styleScores, normalizedStyle, preferenceWeight);
    }

    for (const itemId of outfit.itemIds) {
      const item = itemMap.get(itemId);
      if (!item) continue;

      if (item.available) {
        addScore(itemUsage, itemId, recencyWeight);
        addScore(itemScores, itemId, preferenceWeight);
      }
      addScore(formalityScores, String(item.formality), preferenceWeight);
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
    preferredFormalityLevels: rankScores(formalityScores, "positive").map(
      Number,
    ),
    avoidedFormalityLevels: rankScores(formalityScores, "negative").map(Number),
    preferredStyles: rankScores(styleScores, "positive"),
    avoidedStyles: rankScores(styleScores, "negative"),
  };
}
