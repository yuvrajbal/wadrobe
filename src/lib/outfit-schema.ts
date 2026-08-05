import { z } from "zod";

export const outfitContextSchema = z
  .object({
    occasion: z.string().trim().min(1).max(120).optional(),
    temperature: z.number().min(-100).max(150).optional(),
    walkingLevel: z.string().trim().min(1).max(80).optional(),
    style: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

const itemIdsSchema = z
  .array(z.uuid())
  .min(3, "Choose a top, bottom, and shoes.")
  .max(5)
  .refine((itemIds) => new Set(itemIds).size === itemIds.length, {
    message: "An item can only appear once in an outfit.",
  });

export const outfitCreateSchema = z
  .object({
    itemIds: itemIdsSchema,
    context: outfitContextSchema.optional().default({}),
  })
  .strict();

export const outfitUpdateSchema = z
  .object({
    itemIds: itemIdsSchema.optional(),
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
  .object({ itemIds: itemIdsSchema })
  .strict();

export const outfitCritiqueSchema = z
  .object({
    verdict: z.enum(["works", "almost", "rethink"]),
    summary: z.string().trim().min(1).max(240),
    strengths: z.array(z.string().trim().min(1).max(120)).max(2),
    suggestion: z.string().trim().min(1).max(160).nullable(),
  })
  .strict();

export type OutfitCreate = z.infer<typeof outfitCreateSchema>;
export type OutfitUpdate = z.infer<typeof outfitUpdateSchema>;
export type OutfitListFilters = z.infer<typeof outfitListFiltersSchema>;
export type OutfitCritique = z.infer<typeof outfitCritiqueSchema>;
