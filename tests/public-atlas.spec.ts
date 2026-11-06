import { test, expect } from "@playwright/test";
import { mockBasemaps } from "./basemap-fixtures";

test.beforeEach(async ({ page }) => { await mockBasemaps(page); });

test("the site root is the public Atlas, without Zoer workspace details", async ({ page }) => {
  await page.goto("./?view=sources");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sources and methods");
  await expect(page).toHaveURL(/\?view=sources$/);
  await expect(page).not.toHaveURL(/dev\/projects/);
  await expect(page.locator("#atlas-zoer")).toHaveCount(0);
  await expect(page.locator("#atlas-register")).toBeVisible();
  await page.evaluate(() => document.querySelectorAll("details").forEach(item => { item.open = true; }));
  expect(await page.evaluate(() => document.body.innerText)).not.toContain("Zoer");
  await expect(page.locator('a[href*="//zoer."]')).toHaveCount(0);

  await page.goto("./?view=explore&dataset=nserc-awards-2001-2018&display=table");
  await page.evaluate(() => document.querySelectorAll("details").forEach(item => { item.open = true; }));
  await expect(page.locator(".atlas-source-notes")).toContainText("Geographic scope");
  expect(await page.evaluate(() => document.body.innerText)).not.toContain("Zoer");
});

test("/dev/projects keeps the Zoer catalogue and dataset IDs", async ({ page }) => {
  await page.goto("dev/projects?view=sources");
  await expect(page.locator("#atlas-zoer")).toBeVisible();
  await page.goto("dev/projects?view=explore&dataset=population-lha&display=table");
  await page.locator(".atlas-source-notes > summary").click();
  await expect(page.locator(".atlas-source-notes")).toContainText("Zoer dataset ID");
});

test("public story maps stay on public addresses, and the campus map has its own", async ({ page }) => {
  await page.goto("./northern-communities");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("One North, many communities");
  const back = page.locator(".atlas-story-toolbar .atlas-story-back");
  expect(new URL(await back.evaluate(link => (link as HTMLAnchorElement).href)).pathname).toBe(new URL(page.url()).pathname.replace(/northern-communities$/, "stories"));
  await back.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Research stories");
  await expect(page).not.toHaveURL(/dev\/projects/);
  const campus = page.locator('.unbc-chrome a', { hasText: /^Campus map$/ }).first();
  expect(new URL(await campus.evaluate(link => (link as HTMLAnchorElement).href)).pathname).toMatch(/\/campus$/);
});

test("story maps keep the visual first and the details in Expand media", async ({ page }, testInfo) => {
  await page.goto("./northern-communities#prince-george-in-context");
  const evidence = page.getByTestId("story-evidence");
  await expect(evidence).toHaveAttribute("data-chapter", "prince-george-in-context");
  await expect(evidence.locator(".atlas-chapter-evidence-heading")).toBeHidden();
  await expect(evidence.locator(".atlas-chapter-source")).toBeHidden();
  if (testInfo.project.name !== "mobile") {
    const action = evidence.locator('[data-testid="atlas-map-state"] .atlas-expand-media');
    await expect(action).toBeVisible();
    const legend = await evidence.locator(".atlas-map-legend").boundingBox();
    const button = await action.boundingBox();
    // On the legend's row, at its right end.
    expect(button!.x).toBeGreaterThan(legend!.x + legend!.width - 1);
    expect(Math.abs((button!.y + button!.height / 2) - (legend!.y + legend!.height / 2))).toBeLessThan(30);
  }
  await page.getByRole("button", { name: "Expand media ↗", exact: true }).click();
  const expanded = page.getByRole("dialog", { name: "Expanded story media", exact: true });
  await expect(expanded.locator(".atlas-chapter-evidence-heading")).toContainText("2025 · Projection");
  await expect(expanded.locator(".atlas-chapter-source")).toContainText("17 source records");
  await page.keyboard.press("Escape");
  await expect(expanded).toHaveCount(0);
});

test("estimates and the projection share one chart with their figures beneath", async ({ page }) => {
  await page.goto("./northern-communities#estimates-and-projections");
  const trends = page.getByTestId("estimate-trends");
  await expect(trends).toBeVisible();
  await expect(trends.locator(".atlas-trend-series")).toHaveCount(5);
  await expect(trends.locator(".atlas-trend-end")).toHaveCount(5);
  // Each projection is its own ring; a line never reaches it.
  await expect(trends.locator(".atlas-trend-projection")).toHaveCount(5);
  await expect(trends.locator(".atlas-trend-series polyline").first()).toHaveAttribute("points", /^(\S+ ){4}\S+$/);
  const total = trends.locator(".atlas-trend-table tr.is-total");
  await expect(total).toContainText("All Northern LHAs");
  await expect(total).toContainText("Sum of 17 areas");
  await expect(total).toContainText("293,489");
  await expect(total).toContainText("302,955");
  await expect(total).toContainText("+3.2%");
  await expect(total).toContainText("298,207");
  await expect(trends.locator(".atlas-trend-table tr", { hasText: "Prince George" })).toContainText("+4.2%");
  const svg = trends.locator(".atlas-trend-plot svg");
  await svg.hover({ position: { x: 100, y: 100 } });
  await expect(trends.getByTestId("trend-tip")).toContainText("Source estimate");
  await page.mouse.move(0, 0);
  await expect(trends.getByTestId("trend-tip")).toHaveCount(0);
  await page.getByRole("button", { name: "Expand media ↗", exact: true }).click();
  const expanded = page.getByRole("dialog", { name: "Expanded story media", exact: true });
  // The whole table can be reached: the last row is not cut off.
  const lastRow = expanded.locator(".atlas-trend-table tbody tr").last();
  await lastRow.scrollIntoViewIfNeeded();
  await expect(lastRow).toBeInViewport({ ratio: 1 });
  await page.keyboard.press("Escape");
  await expect(expanded).toHaveCount(0);
});

test("a phone's story panel keeps the chart and leaves the table to Expand", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./northern-communities#estimates-and-projections");
  const trends = page.getByTestId("estimate-trends");
  await expect(trends.locator(".atlas-trend-series")).toHaveCount(5);
  await expect(trends.locator(".atlas-trend-table")).toBeHidden();
  const panel = (await trends.boundingBox())!;
  for (const label of await trends.locator(".atlas-trend-end").all()) {
    const box = (await label.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(panel.x + panel.width);
  }
  await trends.locator(".atlas-trend-plot svg").hover({ position: { x: 190, y: 120 } });
  const tip = (await trends.getByTestId("trend-tip").boundingBox())!;
  expect(tip.x).toBeGreaterThanOrEqual(panel.x);
  expect(tip.x + tip.width).toBeLessThanOrEqual(panel.x + panel.width);
  await page.locator(".editorial-expand").first().click();
  await expect(trends.locator(".atlas-trend-table")).toBeVisible();
  const total = trends.locator(".atlas-trend-table tr.is-total");
  await expect(total).toContainText("293,489");
  const lastRow = trends.locator(".atlas-trend-table tbody tr").last();
  await lastRow.scrollIntoViewIfNeeded();
  await expect(lastRow).toBeInViewport({ ratio: 1 });
  // Names may wrap once but are not squeezed to a word per line.
  expect((await total.locator("th").boundingBox())!.width).toBeGreaterThanOrEqual(90);
});

test("the focus layout stays available for a chapter that asks for it", async ({ page }) => {
  await page.goto("dev/projects/northern-communities?trends=focus#estimates-and-projections");
  const trends = page.getByTestId("estimate-trends");
  await expect(trends.locator(".atlas-trend-focus h4")).toContainText("All Northern LHAs");
  await expect(trends.locator(".atlas-trend-focus nav button")).toHaveCount(5);
  await expect(trends.locator(".atlas-trend-value")).toHaveText(["293,489", "302,955", "298,207"]);
  await trends.getByRole("button", { name: /Prince Rupert/ }).click();
  await expect(trends.locator(".atlas-trend-focus h4")).toContainText("Prince Rupert");
  await expect(trends.locator(".atlas-trend-value")).toHaveText(["14,167", "14,240", "13,825"]);
});

test("chapters sharing a boundary file keep one map", async ({ page }) => {
  await page.goto("dev/projects/northern-communities#peace-and-far-north");
  const state = page.getByTestId("story-evidence").getByTestId("atlas-map-state");
  await expect(state).toHaveAttribute("data-ready", "true");
  await page.evaluate(() => { (window as unknown as { firstCanvas: Element | null }).firstCanvas = document.querySelector(".atlas-chapter-viz .maplibregl-canvas"); });
  await page.getByRole("button", { name: "Next chapter" }).click();
  await expect(page.getByTestId("story-evidence")).toHaveAttribute("data-dataset", "population-lha-ages");
  await expect(state).toHaveAttribute("data-metric", "share_65_plus");
  await expect(state).toHaveAttribute("data-ready", "true");
  expect(await page.evaluate(() => (window as unknown as { firstCanvas: Element | null }).firstCanvas === document.querySelector(".atlas-chapter-viz .maplibregl-canvas"))).toBe(true);
});
