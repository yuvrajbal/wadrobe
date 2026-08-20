import { expect, test } from "@playwright/test";

import { wardrobeItems } from "./fixtures";

test("retries the saved-outfit gallery without a full refresh", async ({
  page,
}) => {
  let outfitRequests = 0;
  await page.route("**/api/outfits?status=saved", async (route) => {
    outfitRequests += 1;
    if (outfitRequests === 1) {
      await route.fulfill({ status: 503, json: { error: "Unavailable" } });
      return;
    }
    await route.fulfill({
      json: {
        outfits: [
          {
            id: "saved-1",
            itemIds: ["top-1", "bottom-1", "shoes-1"],
            createdAt: "2026-08-18T12:00:00.000Z",
          },
        ],
      },
    });
  });
  await page.route("**/api/items", async (route) => {
    await route.fulfill({ json: { items: wardrobeItems } });
  });

  await page.goto("/saved");
  await expect(
    page.getByText("Saved outfits could not be loaded."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("3 piece outfit")).toBeVisible();
  expect(outfitRequests).toBe(2);
});

test("keeps the primary journey usable on a phone viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/items**", async (route) => {
    await route.fulfill({ json: { items: wardrobeItems } });
  });

  await page.goto("/");
  const mobileNavigation = page.locator('nav[aria-label="Primary"]:visible');
  await expect(mobileNavigation).toBeVisible();
  await expect(
    mobileNavigation.getByRole("link", { name: /Wardrobe/ }),
  ).toHaveAttribute("aria-current", "page");

  await mobileNavigation.getByRole("link", { name: /Suggestions/ }).click();
  await expect(page).toHaveURL(/\/suggestions$/);
  await expect(
    page.locator('nav[aria-label="Primary"]:visible').getByRole("link", {
      name: /Suggestions/,
    }),
  ).toHaveAttribute("aria-current", "page");
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
