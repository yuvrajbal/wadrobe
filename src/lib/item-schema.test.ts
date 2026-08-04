import { describe, expect, it } from "vitest";

import { itemListFiltersSchema, itemUpdateSchema } from "@/lib/item-schema";

describe("itemListFiltersSchema", () => {
  it("parses category and boolean query values", () => {
    expect(
      itemListFiltersSchema.parse({ category: "shoes", available: "true" }),
    ).toEqual({ category: "shoes", available: true });
  });

  it("rejects unknown query parameters", () => {
    expect(() =>
      itemListFiltersSchema.parse({ userId: "another-user" }),
    ).toThrow();
  });
});

describe("itemUpdateSchema", () => {
  it("accepts a partial editable update", () => {
    expect(itemUpdateSchema.parse({ notes: "wear with denim" })).toEqual({
      notes: "wear with denim",
    });
  });

  it("rejects empty updates, protected fields, and invalid attributes", () => {
    expect(() => itemUpdateSchema.parse({})).toThrow();
    expect(() => itemUpdateSchema.parse({ userId: "another-user" })).toThrow();
    expect(() => itemUpdateSchema.parse({ formality: 6 })).toThrow();
  });
});
