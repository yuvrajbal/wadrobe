import { z } from "zod";

export const outfitContextSchema = z
  .object({
    occasion: z.string().trim().min(1).max(120).optional(),
    temperature: z.number().min(-100).max(150).optional(),
    temperatureUnit: z.enum(["fahrenheit", "celsius"]).optional(),
    walkingLevel: z.string().trim().min(1).max(80).optional(),
    style: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export const outfitItemIdsSchema = z
  .array(z.uuid())
  .min(3, "Choose a top, bottom, and shoes.")
  .max(5)
  .refine((itemIds) => new Set(itemIds).size === itemIds.length, {
    message: "An item can only appear once in an outfit.",
  });

export const outfitCreateSchema = z
  .object({
    itemIds: outfitItemIdsSchema,
    context: outfitContextSchema.optional().default({}),
  })
  .strict();

export const outfitUpdateSchema = z
  .object({
    itemIds: outfitItemIdsSchema.optional(),
    context: outfitContextSchema.optional(),
    status: z.enum(["saved", "rejected", "suggested"]).optional(),
  })
  .strict()
  .refine((update) => Object.keys(update).length > 0, {
    message: "Provide at least one outfit field to update.",
  });

export const outfitListFiltersSchema = z
  .object({
    status: z.enum(["saved", "rejected", "suggested"]).optional(),
    source: z.enum(["manual", "ai"]).optional(),
  })
  .strict();

export const outfitIdSchema = z.uuid();

export const outfitCritiqueRequestSchema = z
  .object({ itemIds: outfitItemIdsSchema })
  .strict();

export const outfitCritiqueSchema = z
  .object({
    verdict: z.enum(["works", "almost", "rethink"]),
    summary: z.string().trim().min(1).max(240),
    strengths: z.array(z.string().trim().min(1).max(120)).max(2),
    suggestion: z.string().trim().min(1).max(160).nullable(),
  })
  .strict();

export const recommendationContextSchema = z
  .object({
    occasion: z.string().trim().min(2).max(120),
    temperature: z.number().min(-100).max(150),
    temperatureUnit: z.enum(["fahrenheit", "celsius"]).default("fahrenheit"),
    walkingLevel: z.enum(["low", "moderate", "high"]),
    style: z.string().trim().min(2).max(120),
  })
  .strict();

export const outfitFeedbackSchema = z
  .object({
    itemIds: outfitItemIdsSchema,
    context: recommendationContextSchema,
    status: z.enum(["saved", "rejected"]),
  })
  .strict();

export const recommendationRequestSchema = z
  .object({ context: recommendationContextSchema })
  .strict();

export const outfitSuggestionSchema = z
  .object({
    itemIds: outfitItemIdsSchema,
    rationale: z.string().trim().min(1).max(240),
  })
  .strict();

export const outfitSuggestionsSchema = z
  .object({ suggestions: z.array(outfitSuggestionSchema).min(1).max(3) })
  .strict();

export type OutfitCreate = z.infer<typeof outfitCreateSchema>;
export type OutfitUpdate = z.infer<typeof outfitUpdateSchema>;
export type OutfitListFilters = z.infer<typeof outfitListFiltersSchema>;
export type OutfitCritique = z.infer<typeof outfitCritiqueSchema>;
export type OutfitFeedback = z.infer<typeof outfitFeedbackSchema>;
export type RecommendationContext = z.infer<typeof recommendationContextSchema>;
export type OutfitSuggestion = z.infer<typeof outfitSuggestionSchema>;
export type OutfitSuggestions = z.infer<typeof outfitSuggestionsSchema>;
