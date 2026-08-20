import { expect, test } from "@playwright/test";

import { mockWardrobe } from "./fixtures";

test("builds, critiques, and saves a complete outfit", async ({ page }) => {
  await mockWardrobe(page);
  let savedItemIds: string[] = [];
  await page.route("**/api/outfits", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    savedItemIds = route.request().postDataJSON().itemIds;
    await route.fulfill({ status: 201, json: { outfit: { id: "outfit-1" } } });
  });
  await page.route("**/api/outfits/critique", async (route) => {
    await route.fulfill({
      json: {
        critique: {
          verdict: "works",
          summary: "The colors and proportions feel cohesive.",
          strengths: ["Balanced palette"],
          suggestion: null,
        },
      },
    });
  });

  await page.goto("/builder");
  await page.getByRole("button", { name: "Save outfit" }).click();
  await expect(
    page.getByText("Choose a top, bottom, and shoes before saving."),
  ).toBeVisible();

  for (const [slot, item] of [
    ["Top", "Navy tee"],
    ["Bottom", "Stone trousers"],
    ["Shoes", "White sneakers"],
  ] as const) {
    await page.getByText(slot, { exact: true }).click();
    const picker = page.getByRole("dialog", {
      name: new RegExp(`Choose ${slot.toLowerCase()}`),
    });
    await expect(
      picker.getByRole("button", { name: "Close picker" }),
    ).toBeFocused();
    await picker.getByRole("button", { name: new RegExp(item) }).click();
  }

  await expect(page.getByText("3 of 5 slots filled")).toBeVisible();
  await page.getByRole("button", { name: "Critique this outfit" }).click();
  await expect(page.getByText("It works")).toBeVisible();
  await expect(
    page.getByText("Balanced palette", { exact: false }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Save outfit" }).click();
  await expect(
    page.getByText("Outfit saved to your collection."),
  ).toBeVisible();
  expect(savedItemIds).toEqual(["top-1", "bottom-1", "shoes-1"]);
});
