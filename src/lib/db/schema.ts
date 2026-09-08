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
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .$onUpdate(() => new Date()),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("sessions_token_idx").on(table.token),
    index("sessions_user_id_idx").on(table.userId),
  ],
);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    issuer: text("issuer").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("accounts_issuer_account_id_idx").on(
      table.issuer,
      table.accountId,
    ),
    index("accounts_user_id_idx").on(table.userId),
  ],
);

export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
);

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
  temperatureUnit?: "fahrenheit" | "celsius";
  walkingLevel?: string;
  style?: string;
};

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
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
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
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

export const imageObjects = pgTable(
  "image_objects",
  {
    key: varchar("key", { length: 64 }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("image_objects_user_id_idx").on(table.userId)],
);

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type Outfit = typeof outfits.$inferSelect;
export type NewOutfit = typeof outfits.$inferInsert;
