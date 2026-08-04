import { z } from "zod";

export const itemCategories = [
  "top",
  "bottom",
  "shoes",
  "outerwear",
  "accessory",
] as const;

export const itemSeasons = ["spring", "summer", "fall", "winter"] as const;

const nameSchema = z.string().trim().min(1).max(160);
const categorySchema = z.enum(itemCategories);
const colorsSchema = z.array(z.string().trim().min(1).max(40)).min(1).max(5);
const patternSchema = z.string().trim().min(1).max(80);
const formalitySchema = z.number().int().min(1).max(5);
const seasonSchema = z
  .array(z.enum(itemSeasons))
  .min(1)
  .max(itemSeasons.length);
const materialSchema = z.string().trim().min(1).max(120).nullable();
const fitSchema = z.string().trim().min(1).max(80).nullable();

export const wardrobeItemAttributesSchema = z.object({
  name: nameSchema,
  category: categorySchema,
  colors: colorsSchema,
  pattern: patternSchema,
  formality: formalitySchema,
  season: seasonSchema,
  material: materialSchema,
  fit: fitSchema,
});

export const itemListFiltersSchema = z
  .object({
    category: categorySchema.optional(),
    available: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
  })
  .strict();

export const itemUpdateSchema = z
  .object({
    name: nameSchema,
    category: categorySchema,
    colors: colorsSchema,
    pattern: patternSchema,
    formality: formalitySchema,
    season: seasonSchema,
    material: materialSchema,
    fit: fitSchema,
    notes: z.string().trim().max(2_000),
    available: z.boolean(),
  })
  .strict()
  .partial()
  .refine((attributes) => Object.keys(attributes).length > 0, {
    message: "Provide at least one item field to update.",
  });

export const itemIdSchema = z.uuid();

export type WardrobeItemAttributes = z.infer<
  typeof wardrobeItemAttributesSchema
>;
export type ItemListFilters = z.infer<typeof itemListFiltersSchema>;
export type ItemUpdate = z.infer<typeof itemUpdateSchema>;
