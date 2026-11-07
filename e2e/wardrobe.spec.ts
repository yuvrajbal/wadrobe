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

test("downscales large photos before uploading them", async ({ page }) => {
  await mockWardrobe(page, []);
  await page.goto("/");

  // A noisy 4032x3024 JPEG, the size of a typical phone photo.
  const photo = Buffer.from(
    await page.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 4032;
      canvas.height = 3024;
      const context = canvas.getContext("2d")!;
      const pixels = context.createImageData(canvas.width, canvas.height);
      for (let index = 0; index < pixels.data.length; index += 1) {
        pixels.data[index] = index % 4 === 3 ? 255 : Math.random() * 255;
      }
      context.putImageData(pixels, 0, 0);
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((result) => resolve(result!), "image/jpeg", 1),
      );
      return [...new Uint8Array(await blob.arrayBuffer())];
    }),
  );
  expect(photo.length).toBeGreaterThan(4.5 * 1024 * 1024);

  let uploaded: Buffer | null = null;
  await page.route("**/api/items", async (route) => {
    if (route.request().method() === "POST") {
      uploaded = route.request().postDataBuffer();
      await route.fulfill({
        status: 201,
        json: { item: { ...wardrobeItems[0], id: "resized-top" } },
      });
      return;
    }
    await route.fallback();
  });

  await page.getByLabel("Add garment").setInputFiles({
    name: "IMG_0001.jpeg",
    mimeType: "image/jpeg",
    buffer: photo,
  });
  const dialog = page.getByRole("dialog", { name: "Add a garment" });
  await dialog.getByRole("button", { name: "Analyze item" }).click();
  await expect(dialog).toBeHidden();

  expect(uploaded).not.toBeNull();
  const body = uploaded! as Buffer;
  expect(body.length).toBeLessThan(4.5 * 1024 * 1024);
  expect(body.toString("latin1")).toContain(
    'filename="IMG_0001.jpg"\r\nContent-Type: image/jpeg',
  );
});
