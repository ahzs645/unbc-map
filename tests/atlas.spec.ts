import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { mockBasemaps } from './basemap-fixtures';

test.beforeEach(async ({ page }) => { await mockBasemaps(page); });

const explorer = "dev/projects?view=explore";

test("the site opens on research stories, and clicking a field shows no focus ring", async ({ page }) => {
  await page.goto("./");
  await expect(page).toHaveURL(/\/dev\/projects$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Research stories");
  const search = page.getByRole("textbox", { name: "Search stories" });
  await search.click();
  await expect(search).toBeFocused();
  await expect(search).toHaveCSS("outline-style", "none");
});

test("stories link to evidence and filters have an honest empty state", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("dev/projects");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Research stories");
  await expect(page.locator(".unbc-logo--header")).toBeVisible();
  await expect(page.locator(".unbc-logo--footer")).toBeAttached();
  await expect(page.locator(".atlas-header")).toHaveCount(0);
  await expect(page.locator(".atlas-hero")).toHaveCount(0);
  await expect(page.locator(".atlas-story-card")).toHaveCount(42);
  await page.getByRole("textbox", { name: "Search stories" }).fill("no-such-nhhr-story");
  await expect(page.getByText("No stories found.")).toBeVisible();
  await page.getByRole("button", { name: "Reset story filters" }).click();
  await page.getByRole("button", { name: /Where specialist supply is thinnest/ }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Where specialist supply is thinnest");
  await page.getByRole("button", { name: "Explore this dataset" }).click();
  await expect(page).toHaveURL(/dataset=physicians-hsda/);
  await expect(page.getByRole("heading", { name: "Physician supply across BC health regions" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Measure" })).toHaveValue("specialists_per_100k_2024");
  await page.getByRole("button", { name: "Search NHHR data", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search NHHR data", exact: true }).fill("CIHR");
  await page.locator(".campus-search-results").getByRole("button", { name: "CIHR annual payments", exact: true }).click();
  await expect(page).toHaveURL(/dataset=cihr-payments/);
  await expect(page.getByRole("button", { name: "Search NHHR data", exact: true })).toHaveAttribute("aria-expanded", "false");
  expect(errors).toEqual([]);
});

test("institution filters survive reload and the CSV contains exactly the viewed records", async ({ page, context }) => {
  await page.goto(`${explorer}&dataset=publications`);
  await expect(page.getByRole("tab", { name: "Map", exact: true })).toBeEnabled();
  await page.getByRole("combobox", { name: "Institution / city", exact: true }).selectOption("UNBC / Prince George");
  await page.getByRole("combobox", { name: "Publication year", exact: true }).selectOption("2025");
  await page.getByRole("tab", { name: "Table", exact: true }).click();
  await expect(page.locator(".atlas-data-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".atlas-data-table tbody")).toContainText("523");
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Publication year", exact: true })).toHaveValue("2025");
  await expect(page.getByRole("combobox", { name: "Institution / city", exact: true })).toHaveValue("UNBC / Prince George");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Share view", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV", exact: true }).click();
  const download = await downloadEvent;
  const csv = await readFile((await download.path())!, "utf8");
  expect(csv.split(/\r?\n/)).toHaveLength(2);
  expect(csv).toContain('"UNBC / Prince George","2025","523"');
  expect(csv).not.toContain("source_file");
  await page.getByRole("textbox", { name: "Search within source records" }).fill("not-an-institution");
  await expect(page.getByText("No records match these filters.")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(page.locator(".atlas-results-line")).toContainText("40 of 40");
});

test("HSDA maps render real polygons and match all 16 codes", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${explorer}&dataset=physicians-hsda&display=map`);
  const state = page.getByTestId("atlas-map-state");
  await expect(state).toHaveAttribute("data-ready", "true");
  await expect(state).toHaveAttribute("data-feature-count", "16");
  await expect(state).toHaveAttribute("data-matched-count", "16");
  await expect(state).toHaveAttribute("data-rendered-features", /^[1-9]\d*$/);
  await page.getByRole("combobox", { name: "Select map region" }).selectOption("Northwest HSDA");
  await expect(page.locator(".atlas-map-detail")).toContainText("Northwest HSDA");
  await page.getByRole("combobox", { name: "Measure" }).selectOption("total_physicians_2024");
  await expect(page.getByRole("combobox", { name: "Measure" })).toHaveValue("total_physicians_2024");
  await expect(state).toHaveAttribute("data-ready", "true");
  expect(errors).toEqual([]);
});

test("corrected LHA projections map once per region and preserve temporal scope", async ({ page }) => {
  await page.goto(`${explorer}&dataset=population-lha`);
  await page.getByRole("tab", { name: "Map", exact: true }).click();
  const state = page.getByTestId("atlas-map-state");
  await expect(state).toHaveAttribute("data-ready", "true");
  await expect(state).toHaveAttribute("data-feature-count", "89");
  await expect(state).toHaveAttribute("data-matched-count", "17");
  await expect(state).toHaveAttribute("data-rendered-features", /^[1-9]\d*$/);
  await page.getByRole("combobox", { name: "Select map region" }).selectOption("Prince George");
  await expect(page.locator(".atlas-map-detail")).toContainText("105,544");
  await page.getByRole("tab", { name: "Table", exact: true }).click();
  await expect(page.locator(".atlas-data-table tbody")).toContainText("Projection");
  await page.getByTestId("year-select").selectOption("");
  await page.getByRole("combobox", { name: "Source estimate / projection", exact: true }).selectOption("Estimate");
  await page.getByRole("tab", { name: "Map", exact: true }).click();
  await expect(page.getByTestId("year-select")).toHaveValue("2024");
  await expect(page.getByRole("combobox", { name: "Source estimate / projection", exact: true })).toHaveValue("Estimate");
  await expect(page.getByTestId("atlas-map-state")).toHaveAttribute("data-matched-count", "17");
});

test("boundary failures leave a usable records view", async ({ page }) => {
  await page.route("**/data/nhhr/boundaries-hsda.geojson", route => route.fulfill({ status: 503, body: "Unavailable" }));
  await page.goto(`${explorer}&dataset=physicians-hsda&display=map`);
  await expect(page.getByRole("alert")).toContainText("Boundary snapshot unavailable");
  await page.getByRole("tab", { name: "Table", exact: true }).click();
  await expect(page.locator(".atlas-data-table tbody tr")).toHaveCount(16);
});

test("scenarios and source limitations remain distinct from measured benefits", async ({ page }) => {
  await page.goto(`${explorer}&dataset=travel-scenarios`);
  await expect(page.locator(".atlas-data-caution")).toContainText("Scenario inputs and assumptions");
  await expect(page.getByRole("tab", { name: "Map", exact: true })).toBeDisabled();
  await page.locator(".atlas-source-notes summary").click();
  await expect(page.locator(".atlas-source-notes")).toContainText(/hypothetical|scenario/i);
  await page.goto(`${explorer}&dataset=cihr-payments`);
  await expect(page.getByRole("combobox", { name: "Fiscal year", exact: true }).locator("option[value='2025']")).toHaveCount(0);
  await page.locator(".atlas-source-notes summary").click();
  await expect(page.locator(".atlas-source-notes")).toContainText("Payment coverage is incomplete");
});

test("time-series comparisons include UNBC and expose exact values", async ({ page }) => {
  await page.goto(`${explorer}&dataset=publications&display=chart`);
  await expect(page.getByRole("button", { name: "Trends over time", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("checkbox", { name: "UNBC / Prince George", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "UNBC / Prince George, 2025: 523 works", exact: true }).click();
  await expect(page.locator(".atlas-chart-selection")).toContainText("523 works");
  await page.getByRole("button", { name: "Source record bars", exact: true }).click();
  await expect(page.locator(".atlas-bar-row")).toHaveCount(24);
});

test("benchmarks with different units cannot share a numeric comparison axis", async ({ page }) => {
  await page.goto(`${explorer}&dataset=travel-benchmarks&display=chart`);
  await expect(page.getByText("These records use different units.")).toBeVisible();
  await expect(page.locator(".atlas-bar-row")).toHaveCount(0);
  await page.getByRole("combobox", { name: "Source unit", exact: true }).selectOption("cents/km");
  await expect(page.getByText("These records use different units.")).toHaveCount(0);
  await expect(page.locator(".atlas-bar-row")).toHaveCount(3);
});

test("released data preserves population corrections and boundary crosswalk integrity", async ({ request }) => {
  const snapshot = await (await request.get("data/nhhr/atlas-snapshot.json")).json();
  const population = snapshot.datasets.find((d: { id: string }) => d.id === "population-lha");
  const princeGeorge = population.rows.find((r: Record<string, string | number>) => r.lha_code === "524" && String(r.year) === "2025");
  expect(princeGeorge.population).toBe(105544);
  const keys = population.rows.map((r: Record<string, string | number>) => `${r.lha_code}-${r.year}`);
  expect(new Set(keys).size).toBe(population.rows.length);
  const audit = snapshot.datasets.find((d: { id: string }) => d.id === "population-review");
  expect(audit.rows.some((r: Record<string, number>) => r.verified_total_population === 298207)).toBe(true);
  const crosswalk = await (await request.get("data/nhhr/crosswalk-hsda.json")).json();
  const geometry = await (await request.get("data/nhhr/boundaries-hsda.geojson")).json();
  expect(new Set(crosswalk.map((r: { bc_hsda_code: string }) => r.bc_hsda_code)).size).toBe(16);
  expect(crosswalk.every((r: { bc_hsda_code: string }) => geometry.features.some((f: { properties: { code: string } }) => f.properties.code === r.bc_hsda_code))).toBe(true);
  const forbidden = ["email", "phone", "source_file", "participant_id", "contact_name", "remuneration"];
  expect(snapshot.datasets.every((d: { columns: { key: string }[] }) => d.columns.every(c => !forbidden.includes(c.key.toLowerCase())))).toBe(true);
});

test("Atlas controls and record tables stay inside narrow viewports", async ({ page }) => {
  await page.goto("dev/projects");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // Wide screens reach the explorer from the UNBC menu; phones keep the section tabs.
  const tab = page.getByRole("button", { name: "Data explorer", exact: true });
  if (await tab.isVisible()) await tab.click();
  else await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Data explorer", exact: true }).click();
  await page.getByRole("tab", { name: "Table", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole("button", { name: "CSV", exact: true })).toBeVisible();
});
