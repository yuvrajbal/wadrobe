import { expect, test } from "@playwright/test";

import { mockWardrobe, wardrobeItems } from "./fixtures";

test("filters the wardrobe and edits a garment with accessible dialog behavior", async ({
  page,
}) => {
  let items = structuredClone(wardrobeItems);
  await page.route("**/api/items**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "PATCH") {
      const update = request.postDataJSON();
      const id = url.pathname.split("/").at(-1);
      const current = items.find((candidate) => candidate.id === id)!;
      const updated = { ...current, ...update };
      items = items.map((candidate) =>
        candidate.id === id ? updated : candidate,
      );
      await route.fulfill({ json: { item: updated } });
      return;
    }

    const category = url.searchParams.get("category");
    await route.fulfill({
      json: {
        items: category
          ? items.filter((candidate) => candidate.category === category)
          : items,
      },
    });
  });

  await page.goto("/");
  await expect(page.getByText("4 pieces · 4 ready to wear")).toBeVisible();

  const shoesFilter = page.getByRole("button", {
    name: "Shoes",
    exact: true,
  });
  await shoesFilter.click();
  await expect(shoesFilter).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: /White sneakers/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Navy tee/ })).toHaveCount(0);

  await page.getByRole("button", { name: "All", exact: true }).click();
  const garment = page.getByRole("button", { name: /Navy tee/ });
  await garment.click();

  const dialog = page.getByRole("dialog", { name: "Garment details" });
  await expect(dialog).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Close dialog" }),
  ).toBeFocused();
  await dialog.getByLabel("Name").fill("Midnight tee");
  const winter = dialog.getByRole("button", { name: "winter" });
  await winter.click();
  await expect(winter).toHaveAttribute("aria-pressed", "true");
  await dialog.getByRole("button", { name: "Save changes" }).click();

  await expect(dialog).toBeHidden();
  const updatedGarment = page.getByRole("button", { name: /Midnight tee/ });
  await expect(updatedGarment).toBeVisible();
  await expect(updatedGarment).toBeFocused();
});

test("lets the user replace an upload before analysis", async ({ page }) => {
  const created = {
    ...wardrobeItems[0],
    id: "top-2",
    name: "Blue overshirt",
    createdAt: "2026-08-18T13:00:00.000Z",
  };
  await mockWardrobe(page, []);
  await page.route("**/api/items", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 201, json: { item: created } });
      return;
    }
    await route.fallback();
  });

  await page.goto("/");
  await page.getByLabel("Add garment").setInputFiles({
    name: "first.png",
    mimeType: "image/png",
    buffer: Buffer.from("first"),
  });
  const dialog = page.getByRole("dialog", { name: "Add a garment" });
  await expect(dialog.getByText("first.png")).toBeVisible();

  await dialog.getByLabel("Choose another").setInputFiles({
    name: "better-photo.png",
    mimeType: "image/png",
    buffer: Buffer.from("second"),
  });
  await expect(dialog.getByText("better-photo.png")).toBeVisible();
  await expect(dialog.getByText("first.png")).toHaveCount(0);

  await dialog.getByRole("button", { name: "Analyze item" }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: /Blue overshirt/ }),
  ).toBeVisible();
});
