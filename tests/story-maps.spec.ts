import { test, expect } from "@playwright/test";
import { mockBasemaps } from './basemap-fixtures';

test.beforeEach(async ({ page }) => { await mockBasemaps(page); });

test("guided stories preserve NHHR branding and open canonical routes", async ({ page }) => {
  await page.goto("dev/projects");
  await expect(page.locator(".unbc-logo--header")).toHaveAttribute("aria-label", "University of Northern British Columbia Northern Hub for Health Research");
  await expect(page.locator(".unbc-logo--header text")).toHaveText(["Northern Hub for", "Health Research"]);
  await expect(page.locator(".atlas-storymap-card")).toHaveCount(9);
  await expect(page.locator(".atlas-story-card")).toHaveCount(42);
  await page.getByRole("link", { name: /One North, many communities/ }).click();
  await expect(page).toHaveURL(/dev\/projects\/northern-communities/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("One North, many communities");
  await expect(page.getByTestId("story-evidence")).toHaveAttribute("data-period", "2025");
  await expect(page.locator(".atlas-chapter-evidence-heading")).toContainText("Projection");
});

test("reading changes the focused map without replacing its canvas, and shares the chapter", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("dev/projects/northern-communities");
  const state = page.getByTestId("atlas-map-state");
  await expect(state).toHaveAttribute("data-ready", "true");
  await expect(state).toHaveAttribute("data-matched-count", "17");
  await expect(state).toHaveAttribute("data-rendered-features", /^[1-9]\d*$/);
  const canvas = await page.locator(".atlas-map-canvas canvas").elementHandle();
  await page.getByRole("button", { name: "Begin reading", exact: true }).click();
  await expect.poll(() => page.getByTestId("story-reader").evaluate(element => Math.abs(element.getBoundingClientRect().top))).toBeLessThan(3);
  const readerBox = await page.getByTestId("story-reader").boundingBox();
  // Scroll by chapter 2's measured offset so its heading lands well inside the
  // reading line on both layouts, whatever chapter 1's rendered text height.
  const secondChapterTop = await page.getByTestId("story-reader").evaluate(root => root.querySelector("#prince-george-in-context")!.getBoundingClientRect().top - root.getBoundingClientRect().top);
  await page.mouse.move(readerBox!.x + 40, readerBox!.y + Math.min(600, readerBox!.height - 70));
  await page.mouse.wheel(0, secondChapterTop - 250);
  await expect(page.getByTestId("story-reader")).toHaveAttribute("data-active-chapter", "prince-george-in-context");
  await expect(page.getByTestId("story-evidence")).toHaveAttribute("data-chapter", "prince-george-in-context");
  await expect(state).toHaveAttribute("data-focus-regions", '["Prince George"]');
  expect(await canvas!.evaluate(element => element.isConnected)).toBe(true);
  await expect(page).toHaveURL(/#prince-george-in-context$/);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy story link", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
  await page.reload();
  await expect(page.getByTestId("story-reader")).toHaveAttribute("data-active-chapter", "prince-george-in-context");
  await expect(page.getByTestId("story-evidence")).toHaveAttribute("data-chapter", "prince-george-in-context");
  await expect(state).toHaveAttribute("data-focus-count", "1");
  expect(errors).toEqual([]);
});

test("physician comparison renders two maps with one scale and synchronized camera", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("dev/projects/physician-supply#counts-over-time");
  await expect(page.getByTestId("story-reader")).toHaveAttribute("data-active-chapter", "counts-over-time");
  const earlier = page.locator(".atlas-comparison-map-earlier").getByTestId("atlas-map-state");
  const later = page.locator(".atlas-comparison-map-later").getByTestId("atlas-map-state");
  await expect(earlier).toHaveAttribute("data-ready", "true");
  await expect(later).toHaveAttribute("data-ready", "true");
  await expect(earlier).toHaveAttribute("data-metric", "specialists_2020");
  await expect(later).toHaveAttribute("data-metric", "specialists_2024");
  await expect(earlier).toHaveAttribute("data-scale-domain", "[0,147]");
  await expect(later).toHaveAttribute("data-scale-domain", "[0,147]");
  await expect(earlier).toHaveAttribute("data-rendered-features", /^[1-9]\d*$/);
  await expect(later).toHaveAttribute("data-rendered-features", /^[1-9]\d*$/);
  await expect.poll(async () => (await earlier.getAttribute("data-camera")) === (await later.getAttribute("data-camera"))).toBe(true);
  const before = await earlier.getAttribute("data-camera");
  await page.locator(".atlas-comparison-map-earlier .maplibregl-ctrl-zoom-in").click();
  await expect(page.getByTestId("story-reader")).toHaveAttribute("data-active-chapter", "counts-over-time");
  await expect.poll(() => earlier.getAttribute("data-camera")).not.toBe(before);
  await expect.poll(async () => (await earlier.getAttribute("data-camera")) === (await later.getAttribute("data-camera"))).toBe(true);
  const reveal = page.getByRole("slider", { name: "Reveal later-year map" });
  await reveal.focus(); await reveal.press("End");
  await expect(page.getByTestId("atlas-map-comparison")).toHaveAttribute("data-reveal", "100");
  await page.getByText("Compare every region’s values", { exact: true }).click();
  await expect(page.locator(".atlas-comparison-values tbody")).toContainText("Northeast HSDA");
  await expect(page.locator(".atlas-comparison-values tbody")).toContainText("19");
  expect(errors).toEqual([]);
});

test("story explorer links retain the shown population period and institution", async ({ page }) => {
  await page.goto("dev/projects/northern-communities#prince-george-in-context");
  await expect(page.getByTestId("story-evidence")).toHaveAttribute("data-chapter", "prince-george-in-context");
  await page.locator('.editorial-slide[data-active="true"]').getByRole("button", { name: "Explore the source data" }).click();
  await expect(page).toHaveURL(/dev\/projects\?view=explore/);
  await expect(page.getByTestId("year-select")).toHaveValue("2025");
  await expect(page.getByRole("tab", { name: "Map", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.goBack();
  await expect(page.getByTestId("story-reader")).toHaveAttribute("data-active-chapter", "prince-george-in-context");
  await page.goto("dev/projects/research-pathways#institutional-research-activity");
  await expect(page.getByTestId("story-evidence")).toHaveAttribute("data-dataset", "publications");
  await expect(page.getByRole("button", { name: "UNBC / Prince George, 2025: 523 works", exact: true })).toBeAttached();
  await page.locator('.editorial-slide[data-active="true"]').getByRole("button", { name: "Explore the source data" }).click();
  await expect(page.getByTestId("entity-select")).toHaveValue("UNBC / Prince George");
});

test("travel assumptions reproduce source cases, recalculate, reject invalid inputs and survive reload", async ({ page }) => {
  await page.goto("dev/projects/travel-and-time#change-the-assumptions");
  const result = page.getByTestId("scenario-result");
  await expect(result).toContainText("$405,000");
  await expect(result).toContainText("$63,000");
  await page.getByRole("button", { name: "high", exact: true }).click();
  await expect(result).toContainText("$2,250,000");
  await expect(result).toContainText("$337,500");
  await page.getByLabel("Assumed patients reached", { exact: true }).fill("100");
  await expect(result).toContainText("$300,000");
  await expect(result).toContainText("$45,000");
  await page.reload();
  await expect(page.getByLabel("Assumed patients reached", { exact: true })).toHaveValue("100");
  await expect(result).toContainText("$300,000");
  await page.getByLabel("Assumed cost per trip (CAD)", { exact: true }).fill("-1");
  await expect(result).toContainText("Enter valid assumptions");
  await expect(page.getByLabel("Assumed cost per trip (CAD)", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator(".atlas-scenario-caveat")).toContainText("not a forecast");
});

for (const id of ["northern-communities", "physician-supply", "research-pathways", "travel-and-time", "community-context", "research-resources", "workforce-context"]) {
  test(`every ${id} chapter is reachable, expands accessibly and stays within the viewport`, async ({ page }) => {
    await page.goto(`dev/projects/${id}`);
    const nav = page.getByTestId("editorial-nav");
    const count = await nav.getByRole("button").count();
    for (let index = 0; index < count; index++) {
      const chapter = nav.getByRole("button").nth(index);
      const chapterId = await page.locator(".editorial-slide").nth(index).getAttribute("id");
      await chapter.click();
      await expect(page.getByTestId("story-reader")).toHaveAttribute("data-active-chapter", chapterId!);
      await expect(page.getByTestId("story-evidence")).toHaveAttribute("data-chapter", chapterId!);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    await page.getByRole("button", { name: "Expand media ↗", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Expanded story media" })).toBeVisible();
    await page.getByRole("button", { name: "Close media ×", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Expanded story media" })).toHaveCount(0);
    await page.getByRole("button", { name: "Expand media ↗", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Expanded story media" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Expand media ↗", exact: true })).toBeFocused();
  });
}

test("failed story boundaries keep the narrative and source records available", async ({ page }) => {
  await page.route("**/data/nhhr/boundaries-lha.geojson", route => route.fulfill({ status: 503, body: "Unavailable" }));
  await page.goto("dev/projects/northern-communities");
  await expect(page.getByRole("alert")).toContainText("Boundary snapshot unavailable");
  await page.getByText("Read the regional values", { exact: true }).first().click();
  await expect(page.locator(".atlas-chapter-values").first().locator("tbody")).toContainText("105,544");
});
