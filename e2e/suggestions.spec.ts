import { expect, test } from "@playwright/test";

import { wardrobeItems } from "./fixtures";

test("recovers wardrobe loading and carries a suggestion into the builder", async ({
  page,
}) => {
  let itemRequests = 0;
  await page.route("**/api/items**", async (route) => {
    itemRequests += 1;
    if (itemRequests === 1) {
      await route.fulfill({ status: 503, json: { error: "Unavailable" } });
      return;
    }
    await route.fulfill({ json: { items: wardrobeItems } });
  });
  await page.route("**/api/suggestions", async (route) => {
    await route.fulfill({
      json: {
        suggestions: [
          {
            itemIds: ["top-1", "bottom-1", "shoes-1"],
            rationale: "A comfortable, polished museum look.",
          },
        ],
      },
    });
  });
  let feedbackStatus = "";
  await page.route("**/api/outfits/feedback", async (route) => {
    feedbackStatus = route.request().postDataJSON().status;
    await route.fulfill({ status: 201, json: { outfit: { id: "ai-1" } } });
  });

  await page.goto("/suggestions");
  await expect(
    page.getByText("Your wardrobe could not be loaded."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Suggest outfits" }),
  ).toBeDisabled();

  await page.getByLabel("Occasion").fill("museum afternoon");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Your wardrobe is ready to work.")).toBeVisible();
  await page.getByRole("button", { name: "high" }).click();
  await expect(page.getByRole("button", { name: "high" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByRole("button", { name: "Suggest outfits" }).click();
  await expect(
    page.getByRole("alert").filter({
      hasText: "Add an occasion, temperature, and style direction.",
    }),
  ).toBeVisible();
  await page.getByLabel("Temperature").fill("68");
  await page.getByRole("button", { name: "Suggest outfits" }).click();

  await expect(page.getByText("1 considered looks")).toBeVisible();
  await expect(
    page.getByText("A comfortable, polished museum look."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Saved ✓" })).toBeVisible();
  expect(feedbackStatus).toBe("saved");

  await page.getByRole("link", { name: "Tweak" }).click();
  await expect(page).toHaveURL(/\/builder\?items=top-1%2Cbottom-1%2Cshoes-1/);
  await expect(page.getByText("3 of 5 slots filled")).toBeVisible();
});
