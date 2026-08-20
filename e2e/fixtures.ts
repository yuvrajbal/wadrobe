import type { Page } from "@playwright/test";

export type TestItem = {
  id: string;
  userId: string;
  imageUrl: string;
  name: string;
  category: "top" | "bottom" | "shoes" | "outerwear" | "accessory";
  colors: string[];
  pattern: string;
  formality: number;
  season: string[];
  material: string | null;
  fit: string | null;
  notes: string;
  available: boolean;
  createdAt: string;
};

const image =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='100'%3E%3Crect width='80' height='100' fill='%23dcebe0'/%3E%3C/svg%3E";

function item(
  id: string,
  name: string,
  category: TestItem["category"],
  colors: string[],
): TestItem {
  return {
    id,
    userId: "test-user",
    imageUrl: image,
    name,
    category,
    colors,
    pattern: "solid",
    formality: 2,
    season: ["spring", "summer"],
    material: "cotton",
    fit: "regular",
    notes: "",
    available: true,
    createdAt: "2026-08-18T12:00:00.000Z",
  };
}

export const wardrobeItems = [
  item("top-1", "Navy tee", "top", ["navy"]),
  item("bottom-1", "Stone trousers", "bottom", ["stone"]),
  item("shoes-1", "White sneakers", "shoes", ["white"]),
  item("outerwear-1", "Olive jacket", "outerwear", ["olive"]),
] satisfies TestItem[];

export async function mockWardrobe(page: Page, items = wardrobeItems) {
  await page.route("**/api/items**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== "GET") {
      await route.fallback();
      return;
    }
    const category = url.searchParams.get("category");
    const available = url.searchParams.get("available");
    const filtered = items.filter(
      (candidate) =>
        (!category || candidate.category === category) &&
        (available !== "true" || candidate.available),
    );
    await route.fulfill({ json: { items: filtered } });
  });
}
