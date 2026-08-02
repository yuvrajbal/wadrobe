import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const itemCategory = pgEnum("item_category", [
  "top",
  "bottom",
  "shoes",
  "outerwear",
  "accessory",
]);

export const outfitStatus = pgEnum("outfit_status", [
  "saved",
  "rejected",
  "suggested",
]);

export const outfitSource = pgEnum("outfit_source", ["manual", "ai"]);

export type OutfitContext = {
  occasion?: string;
  temperature?: number;
  walkingLevel?: string;
  style?: string;
};

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    imageUrl: text("image_url").notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    category: itemCategory("category").notNull(),
    colors: text("colors")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    pattern: varchar("pattern", { length: 80 }).notNull(),
    formality: integer("formality").notNull(),
    season: text("season")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    material: varchar("material", { length: 120 }),
    fit: varchar("fit", { length: 80 }),
    notes: text("notes").notNull().default(""),
    available: boolean("available").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "items_formality_between_1_and_5",
      sql`${table.formality} between 1 and 5`,
    ),
    index("items_user_id_idx").on(table.userId),
    index("items_user_category_idx").on(table.userId, table.category),
    index("items_user_available_idx").on(table.userId, table.available),
  ],
);

export const outfits = pgTable(
  "outfits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    itemIds: uuid("item_ids").array().notNull(),
    context: jsonb("context")
      .$type<OutfitContext>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    status: outfitStatus("status").notNull(),
    source: outfitSource("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("outfits_has_items", sql`cardinality(${table.itemIds}) > 0`),
    index("outfits_user_id_idx").on(table.userId),
    index("outfits_user_status_idx").on(table.userId, table.status),
  ],
);

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type Outfit = typeof outfits.$inferSelect;
export type NewOutfit = typeof outfits.$inferInsert;
