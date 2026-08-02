CREATE TYPE "public"."item_category" AS ENUM('top', 'bottom', 'shoes', 'outerwear', 'accessory');--> statement-breakpoint
CREATE TYPE "public"."outfit_source" AS ENUM('manual', 'ai');--> statement-breakpoint
CREATE TYPE "public"."outfit_status" AS ENUM('saved', 'rejected', 'suggested');--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"image_url" text NOT NULL,
	"name" varchar(160) NOT NULL,
	"category" "item_category" NOT NULL,
	"colors" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"pattern" varchar(80) NOT NULL,
	"formality" integer NOT NULL,
	"season" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"material" varchar(120),
	"fit" varchar(80),
	"notes" text DEFAULT '' NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "items_formality_between_1_and_5" CHECK ("items"."formality" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "outfits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"item_ids" uuid[] NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "outfit_status" NOT NULL,
	"source" "outfit_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outfits_has_items" CHECK (cardinality("outfits"."item_ids") > 0)
);
--> statement-breakpoint
CREATE INDEX "items_user_id_idx" ON "items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "items_user_category_idx" ON "items" USING btree ("user_id","category");--> statement-breakpoint
CREATE INDEX "items_user_available_idx" ON "items" USING btree ("user_id","available");--> statement-breakpoint
CREATE INDEX "outfits_user_id_idx" ON "outfits" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "outfits_user_status_idx" ON "outfits" USING btree ("user_id","status");