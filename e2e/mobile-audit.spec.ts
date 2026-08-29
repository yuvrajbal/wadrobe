import { expect, test, type Page } from "@playwright/test";

import { mockWardrobe, wardrobeItems } from "./fixtures";

async function mockPrimaryJourneys(page: Page) {
  await mockWardrobe(page);
  await page.route("**/api/outfits?status=saved", async (route) => {
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
}

async function expectNoPageOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    )
    .toBeLessThanOrEqual(1);
}

async function expectAccessibleTouchTargets(page: Page, surface: string) {
  const undersized = await page
    .locator(
      "header button, header a[href], #main-content button, #main-content a[href], #main-content input:not([type='hidden']), #main-content select, #main-content textarea, nav[aria-label='Primary'] a[href], a[href='#main-content']",
    )
    .evaluateAll((elements) => {
      const minimumSize = 44;

      return elements.flatMap((element) => {
        const elementStyle = getComputedStyle(element);
        if (
          elementStyle.display === "none" ||
          elementStyle.visibility === "hidden"
        ) {
          return [];
        }

        // Inline text links are exempt from the touch-target guideline.
        if (
          element instanceof HTMLAnchorElement &&
          elementStyle.display === "inline"
        ) {
          return [];
        }

        let target: Element = element;
        if (
          element instanceof HTMLInputElement &&
          ["checkbox", "radio", "file"].includes(element.type)
        ) {
          const explicitLabel = element.id
            ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)
            : null;
          target = element.closest("label") ?? explicitLabel ?? element;
        }

        const { height, width } = target.getBoundingClientRect();
        if (height === 0 || width === 0) return [];
        if (height >= minimumSize && width >= minimumSize) return [];

        const name =
          element.getAttribute("aria-label") ??
          element.getAttribute("placeholder") ??
          element.textContent?.trim().replace(/\s+/g, " ") ??
          element.tagName.toLowerCase();

        return [
          `${name || element.tagName.toLowerCase()} (${Math.round(width)}x${Math.round(height)})`,
        ];
      });
    });

  expect(undersized, `${surface} has undersized touch targets`).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await mockPrimaryJourneys(page);
});

test("keeps navigation and browser back usable in phone portrait", async ({
  page,
}) => {
  await page.goto("/");

  const navigation = page.locator('nav[aria-label="Primary"]:visible');
  await expect(navigation).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: /Wardrobe/ }),
  ).toHaveAttribute("aria-current", "page");

  for (const journey of [
    { label: /Build/, path: "/builder" },
    { label: /Suggest/, path: "/suggestions" },
    { label: /Saved/, path: "/saved" },
  ]) {
    await navigation.getByRole("link", { name: journey.label }).click();
    await expect(page).toHaveURL(new RegExp(`${journey.path}$`));
    await expect(
      page
        .locator('nav[aria-label="Primary"]:visible')
        .getByRole("link", { name: journey.label }),
    ).toHaveAttribute("aria-current", "page");
    await expectNoPageOverflow(page);
  }

  await page.goBack();
  await expect(page).toHaveURL(/\/suggestions$/);
  await expect(
    page
      .locator('nav[aria-label="Primary"]:visible')
      .getByRole("link", { name: /Suggest/ }),
  ).toHaveAttribute("aria-current", "page");

  const navigationTargets = await navigation
    .getByRole("link")
    .evaluateAll((links) =>
      links.map((link) => {
        const { height, width } = link.getBoundingClientRect();
        return { height, width };
      }),
    );
  for (const target of navigationTargets) {
    expect(target.height).toBeGreaterThanOrEqual(44);
    expect(target.width).toBeGreaterThanOrEqual(44);
  }
});

test("keeps primary routes within a phone landscape viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 915, height: 412 });

  for (const path of ["/", "/builder", "/suggestions", "/saved"]) {
    await page.goto(path);
    await expect(
      page.locator('nav[aria-label="Primary"]:visible'),
    ).toBeVisible();
    await expectNoPageOverflow(page);
  }
});

test("keeps garment and item-picker dialogs inside the phone viewport", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: new RegExp(wardrobeItems[0].name) })
    .click();

  const garmentDialog = page.getByRole("dialog", { name: "Garment details" });
  await expect(garmentDialog).toBeVisible();
  await expectDialogWithinViewport(page, garmentDialog);
  await page.getByRole("button", { name: "Close dialog" }).click();

  await page.goto("/builder");
  await page.getByText("Top", { exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Choose top" });
  await expect(picker).toBeVisible();
  await expectDialogWithinViewport(page, picker);
});

test("keeps visible controls at least 44 by 44 CSS pixels", async ({
  page,
}) => {
  await page.route("**/api/suggestions", async (route) => {
    await route.fulfill({
      json: {
        suggestions: [
          {
            itemIds: ["top-1", "bottom-1", "shoes-1"],
            rationale: "A comfortable, polished mobile look.",
          },
        ],
      },
    });
  });

  await page.goto("/");
  await expect(page.getByText("Your collection")).toBeVisible();
  await expectAccessibleTouchTargets(page, "wardrobe");
  await page
    .getByRole("button", { name: new RegExp(wardrobeItems[0].name) })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Garment details" }),
  ).toBeVisible();
  await expectAccessibleTouchTargets(page, "garment dialog");
  await page.getByRole("button", { name: "Close dialog" }).click();

  await page.goto("/builder?items=top-1%2Cbottom-1%2Cshoes-1");
  await expect(page.getByText("3 of 5 slots filled")).toBeVisible();
  await expectAccessibleTouchTargets(page, "outfit builder");
  await page.getByRole("button", { name: "Replace" }).first().click();
  await expect(page.getByRole("dialog", { name: "Choose top" })).toBeVisible();
  await expectAccessibleTouchTargets(page, "item picker");

  await page.goto("/suggestions");
  await page.getByLabel("Temperature").fill("68");
  await page.getByRole("button", { name: "Suggest outfits" }).click();
  await expect(
    page.getByRole("button", { name: "Save", exact: true }),
  ).toBeVisible();
  await expectAccessibleTouchTargets(page, "suggestions");

  await page.goto("/saved");
  await expect(page.getByRole("link", { name: "Edit look" })).toBeVisible();
  await expectAccessibleTouchTargets(page, "saved outfits");
});

async function expectDialogWithinViewport(
  page: Page,
  dialog: ReturnType<Page["getByRole"]>,
) {
  const bounds = await dialog.boundingBox();
  const viewport = page.viewportSize();
  expect(bounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport!.width + 1);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport!.height + 1);
}
