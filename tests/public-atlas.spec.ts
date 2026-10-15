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
  expect(new URL(await back.evaluate(link => (link as HTMLAnchorElement).href)).pathname).toBe(new URL(page.url()).pathname.replace(/northern-communities$/, ""));
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

test("estimates and the projection read as one panel per area", async ({ page }) => {
  await page.goto("./northern-communities#estimates-and-projections");
  const trends = page.getByTestId("estimate-trends");
  await expect(trends).toBeVisible();
  await expect(trends.locator(".atlas-trend-panel")).toHaveCount(5);
  const total = trends.locator(".atlas-trend-panel.is-total");
  await expect(total).toContainText("All Northern LHAs");
  await expect(total).toContainText("293,489 → 302,955");
  await expect(total).toContainText("298,207");
  await expect(trends.locator(".atlas-trend-panel", { hasText: "Prince George" })).toContainText("+4.2%");
  await expect(trends.locator(".atlas-trend-projection")).toHaveCount(5);
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
