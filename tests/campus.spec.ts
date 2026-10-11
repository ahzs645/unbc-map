import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Keep behaviour checks independent of third-party tile availability. The
  // browser still initializes real WebGL maps and the real local campus layers.
  await page.route("https://basemaps.cartocdn.com/**/style.json", (route) =>
    route.fulfill({
      json: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#f1efe9" },
          },
        ],
      },
    }),
  );
});

test("production assets and campus geography load from the Pages subpath", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  await expect(page.getByTestId("map-state")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect(page.getByTestId("map-state")).toHaveAttribute(
    "data-campus-layers",
    "2",
  );
  await expect(page.getByTestId("map-state")).toHaveAttribute(
    "data-rendered-campus-features",
    /^[1-9]\d*$/,
  );
  await expect(
    page.getByRole("button", {
      name: "Show Geoffrey R. Weller Library",
      exact: true,
    }),
  ).toBeAttached();
  const snapshot = await request.get("data/campus.geojson");
  expect(snapshot.ok()).toBe(true);
  const data = await snapshot.json();
  expect(
    data.features.some(
      (feature: { properties: { id: string } }) =>
        feature.properties.id === "41298822",
    ),
  ).toBe(true);
  await expect
    .poll(() => page.evaluate(() => document.fonts.check('12px "BC Sans"')))
    .toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("filters synchronize search results and map markers, with an empty state", async ({
  page,
}, testInfo) => {
  await page.goto("./");
  if (testInfo.project.name === "mobile")
    await page.getByRole("button", { name: "Show panel" }).click();
  await page.getByRole("button", { name: "Getting here", exact: true }).click();
  await expect(page.getByText("4 places to discover")).toBeVisible();
  await expect(page.locator(".campus-marker")).toHaveCount(4);
  await page.getByRole("button", { name: "All places", exact: true }).click();
  await page
    .getByRole("searchbox", { name: "Search campus places" })
    .fill("weller");
  await expect(page.locator(".place-row")).toHaveCount(1);
  await expect(page.locator(".campus-marker")).toHaveCount(1);
  await page
    .getByRole("searchbox", { name: "Search campus places" })
    .fill("not-a-campus-place");
  await expect(page.getByText("No places found")).toBeVisible();
  await expect(page.locator(".campus-marker")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(page.locator(".place-row")).toHaveCount(17);
});

test("selected places survive reloads, styles switch, and home clears selection", async ({
  page,
}, testInfo) => {
  await page.goto("./#place=library");
  await expect(
    page.getByRole("article", { name: "About Geoffrey R. Weller Library" }),
  ).toBeVisible();
  await expect(page.getByTestId("map-state")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.reload();
  await expect(
    page.getByRole("article", { name: "About Geoffrey R. Weller Library" }),
  ).toBeVisible();
  if (testInfo.project.name === "mobile")
    await page.getByRole("button", { name: "Close feature card" }).click();
  else await page.getByRole("button", { name: "Close place details" }).click();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Dark", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("map-state")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.getByRole("button", { name: "Campus", exact: true }).click();
  await page
    .getByRole("button", { name: "Campus detail", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Campus detail", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("map-state")).toHaveAttribute(
    "data-campus-detail",
    "false",
  );
  await page.getByRole("button", { name: "Show whole campus" }).click();
  await expect(page).not.toHaveURL(/#place=/);
  await expect(page.locator(".campus-marker.is-selected")).toHaveCount(0);
});

test("source notes open accessibly and close with Escape", async ({
  page,
}, testInfo) => {
  await page.goto("./");
  if (testInfo.project.name === "mobile")
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "About this map" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Map sources", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "About this map" }),
  ).toBeFocused();
});

test("NALS branding loads and header search opens a place", async ({
  page,
}, testInfo) => {
  await page.goto("./");
  await expect(
    page.getByRole("img", {
      name: "UNBC — Northern Analytical Laboratory Services",
      exact: true,
    }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Search campus", exact: true })
    .click();
  await expect
    .poll(() =>
      page
        .locator(".site-header__logo img")
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect
    .poll(() =>
      page.evaluate(() => document.fonts.check('400 28px "helvetica-black"')),
    )
    .toBe(true);
  await page
    .getByRole("searchbox", { name: "Search campus from header" })
    .fill("weller");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Geoffrey R. Weller Library" })
    .click();
  await expect(page.locator("#header-search")).toHaveCount(0);
  await expect(
    page.getByRole("article", { name: "About Geoffrey R. Weller Library" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/#place=library$/);
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Close feature card" }).click();
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  await page.getByRole("button", { name: "Campus map", exact: true }).click();
  await expect(page).not.toHaveURL(/#place=/);
  if (testInfo.project.name === "mobile")
    await expect(
      page.getByRole("button", { name: "Open navigation" }),
    ).toHaveAttribute("aria-expanded", "false");
});
