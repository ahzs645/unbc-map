import { expect, test, type APIRequestContext, type Locator } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { AtlasDataset } from "../src/atlas/types";
import { mockBasemaps } from "./basemap-fixtures";

const explorer = "dev/projects?view=explore";
type RenderedPoint = { code: string; value: number | null; radius: number };
const cityCounts: Record<string, number> = {
  "city-vancouver": 5588,
  "city-calgary": 4478,
  "city-halifax": 2824,
  "city-saskatoon": 1357,
  "city-sudbury": 566,
  "city-thunder-bay": 205,
  "city-prince-george": 10,
};
const incomePeriods = ["2020-2021", "2021-2022", "2022-2023", "2023-2024"];
const incomeComparators = [
  "Calgary / Calgary", "Dalhousie / Halifax", "Lakehead / Thunder Bay",
  "NOSM / Thunder Bay", "UBC / Vancouver", "UNBC / Prince George", "USask / Saskatoon",
];

test.beforeEach(async ({ page }) => {
  await mockBasemaps(page);
});

async function dataset(request: APIRequestContext, filename: string, id: string): Promise<AtlasDataset> {
  const response = await request.get(`data/nhhr/${filename}`);
  expect(response.ok()).toBe(true);
  const release = await response.json() as { datasets: AtlasDataset[] };
  const found = release.datasets.find(item => item.id === id);
  expect(found).toBeDefined();
  return found!;
}

async function renderedPoints(state: Locator): Promise<RenderedPoint[]> {
  return JSON.parse(await state.getAttribute("data-rendered-points") ?? "[]");
}

test("clinical city maps use seven verified place points and proportional historical study counts", async ({ page, request }) => {
  const locations = await (await request.get("data/nhhr/locations-clinical-cities.geojson")).json();
  expect(locations.features).toHaveLength(7);
  expect(new Set(locations.features.map((feature: { properties: { query_city: string } }) => feature.properties.query_city)).size).toBe(7);
  expect(locations.features.every((feature: { geometry: { type: string; coordinates: number[] }; properties: Record<string, string> }) =>
    feature.geometry.type === "Point" && feature.geometry.coordinates.length === 2
    && feature.geometry.coordinates.every(Number.isFinite)
    && feature.properties.source_url.startsWith("https://")
    && feature.properties.coordinate_source_url.startsWith("https://www.openstreetmap.org/"))).toBe(true);

  await page.goto(`${explorer}&dataset=clinical-city`);
  await expect(page.getByRole("tab", { name: "Map", exact: true })).toHaveAttribute("aria-selected", "true");
  const state = page.getByTestId("atlas-map-state");
  await expect(state).toHaveAttribute("data-ready", "true");
  await expect(state).toHaveAttribute("data-geometry", "points");
  await expect(state).toHaveAttribute("data-feature-count", "7");
  await expect(state).toHaveAttribute("data-matched-count", "7");
  await expect(state).toHaveAttribute("data-rendered-features", "7");
  await expect(state).toHaveAttribute("data-bubble-scale-max", "5588");
  const points = await renderedPoints(state);
  expect(Object.fromEntries(points.map(point => [point.code, point.value]))).toEqual(cityCounts);
  const pg = points.find(point => point.code === "city-prince-george")!;
  const vancouver = points.find(point => point.code === "city-vancouver")!;
  expect(pg.radius ** 2 / vancouver.radius ** 2).toBeCloseTo(10 / 5588, 7);
  await expect(page.locator(".atlas-institution-scope")).toContainText("queried city labels, not trial facilities or service catchments");
  await expect(page.locator(".atlas-institution-scope")).toContainText("not enrollment or current trial availability");
  await expect(page.locator(".atlas-dataset-context")).toContainText("April 2026");

  await page.getByRole("combobox", { name: "Select map city", exact: true }).selectOption("Prince George");
  await expect(page.locator(".atlas-map-detail")).toContainText("Studies with an exact-city site: 10");
  await page.getByTestId("metric-select").selectOption("recruiting_now");
  await expect(state).toHaveAttribute("data-metric", "recruiting_now");
  await page.getByRole("combobox", { name: "Select map city", exact: true }).selectOption("Prince George");
  await expect(page.locator(".atlas-map-detail")).toContainText("Recruiting in source snapshot: 6");
});

test("clinical map, chart, shared filters and CSV preserve the same Prince George record", async ({ page, context }) => {
  await page.goto(`${explorer}&dataset=clinical-city`);
  await page.getByTestId("entity-select").selectOption("Prince George");
  await page.getByTestId("metric-select").selectOption("recruiting_now");
  const state = page.getByTestId("atlas-map-state");
  await expect(state).toHaveAttribute("data-ready", "true");
  await expect(state).toHaveAttribute("data-matched-count", "1");
  await expect.poll(async () => (await renderedPoints(state)).map(point => point.value)).toEqual([6]);
  await expect(state).toHaveAttribute("data-bubble-scale-max", "616");
  await page.getByRole("tab", { name: "Chart", exact: true }).click();
  await expect(page.locator(".atlas-bar-row")).toHaveCount(1);
  await expect(page.locator(".atlas-bar-row")).toContainText("6 studies");
  await page.getByRole("tab", { name: "Table", exact: true }).click();
  await expect(page.locator(".atlas-data-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".atlas-data-table tbody")).toContainText("Prince George");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Share view", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
  await page.reload();
  await expect(page.getByTestId("entity-select")).toHaveValue("Prince George");
  await expect(page.getByTestId("metric-select")).toHaveValue("recruiting_now");
  await expect(page.getByRole("tab", { name: "Table", exact: true })).toHaveAttribute("aria-selected", "true");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV", exact: true }).click();
  const csv = await readFile((await (await downloadEvent).path())!, "utf8");
  expect(csv.split(/\r?\n/)).toHaveLength(2);
  expect(csv).toContain('"Prince George","10","6","8","7","4","0","Cancer / oncology"');
});

test("hospital cost maps join five reporting authorities and retain the two unmatched reporting units", async ({ page, request }) => {
  const crosswalk = await (await request.get("data/nhhr/crosswalk-health-authority.json")).json();
  const geometry = await (await request.get("data/nhhr/boundaries-ha.geojson")).json();
  expect(crosswalk).toHaveLength(5);
  expect(geometry.features).toHaveLength(5);
  expect(crosswalk.map((row: { bc_ha_code: string }) => row.bc_ha_code).sort()).toEqual(["1", "2", "3", "4", "5"]);
  expect(crosswalk.every((row: { bc_ha_code: string }) => geometry.features.some((feature: { properties: { code: string } }) => feature.properties.code === row.bc_ha_code))).toBe(true);
  expect(crosswalk.some((row: { source_region: string }) => row.source_region.includes("Provincial") || row.source_region === "-")).toBe(false);

  await page.goto(`${explorer}&dataset=hospital-stay-costs`);
  await expect(page.getByRole("tab", { name: "Map", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("year-select")).toHaveValue("2024–2025");
  const state = page.getByTestId("atlas-map-state");
  await expect(state).toHaveAttribute("data-ready", "true");
  await expect(state).toHaveAttribute("data-geometry", "polygons");
  await expect(state).toHaveAttribute("data-feature-count", "5");
  await expect(state).toHaveAttribute("data-matched-count", "5");
  await expect(state).toHaveAttribute("data-rendered-features", "5");
  await expect(page.locator(".atlas-map-join-note")).toContainText("5 exact boundary joins · 2 unmatched rows");
  const regions = page.getByRole("combobox", { name: "Select map region", exact: true });
  await expect(regions.locator("option")).toHaveCount(6);
  await expect(regions.locator('option[value="British Columbia"]')).toHaveCount(0);
  await expect(regions.locator('option[value="Provincial Health Services Authority (B.C.)"]')).toHaveCount(0);
  await regions.selectOption("Northern Health (B.C.)");
  await expect(page.locator(".atlas-map-detail")).toContainText("$13,055");
  await expect(page.getByText("Province and PHSA reporting units have no territorial polygon", { exact: false })).toBeVisible();
  await page.getByRole("tab", { name: "Table", exact: true }).click();
  const rows = page.locator(".atlas-data-table tbody tr");
  await expect(rows).toHaveCount(7);
  const names = await rows.locator("td:first-child").allTextContents();
  expect(names).toContain("British Columbia");
  expect(names).toContain("Provincial Health Services Authority (B.C.)");
});

test("province and PHSA cost filters remain in records without receiving territorial map values", async ({ page }) => {
  await page.goto(`${explorer}&dataset=hospital-stay-costs`);
  for (const selection of [
    { entity: "British Columbia", amount: "11,751" },
    { entity: "Provincial Health Services Authority (B.C.)", amount: "15,915" },
  ]) {
    await page.getByTestId("entity-select").selectOption(selection.entity);
    await page.getByRole("tab", { name: "Map", exact: true }).click();
    await expect(page.getByTestId("atlas-map-state")).toHaveAttribute("data-ready", "true");
    await expect(page.getByTestId("atlas-map-state")).toHaveAttribute("data-matched-count", "0");
    await expect(page.locator(".atlas-map-join-note")).toContainText("0 exact boundary joins · 1 unmatched rows");
    await expect(page.locator(".atlas-map-legend")).toContainText("No value");
    await expect(page.getByRole("combobox", { name: "Select map region", exact: true }).locator("option")).toHaveCount(1);
    await page.getByRole("tab", { name: "Table", exact: true }).click();
    await expect(page.locator(".atlas-data-table tbody tr")).toHaveCount(1);
    await expect(page.locator(".atlas-data-table tbody td:first-child")).toHaveText(selection.entity);
    await expect(page.locator(".atlas-data-table tbody")).toContainText(selection.amount);
  }
});

test("all northern age partitions match verified population totals and retain estimate or projection status", async ({ request }) => {
  const ages = await dataset(request, "population-ages.json", "population-lha-ages");
  const population = await dataset(request, "atlas-snapshot.json", "population-lha");
  expect(ages.rows).toHaveLength(102);
  expect(new Set(ages.rows.map(row => `${row.lha_code}|${row.year}`)).size).toBe(102);
  expect(new Set(ages.rows.map(row => row.lha_code)).size).toBe(17);
  for (const row of ages.rows) {
    const total = population.rows.find(reference => reference.lha_code === row.lha_code && reference.year === row.year)!;
    expect(total).toBeDefined();
    expect(row.region_name).toBe(total.region_name);
    expect(row.total_population).toBe(total.population);
    expect(row.population_type).toBe(total.population_type);
    expect(row.population_type).toBe(row.year === "2025" ? "Projection" : "Estimate");
    const counts = [row.population_0_19, row.population_20_64, row.population_65_plus] as number[];
    expect(counts.every(value => Number.isInteger(value) && value >= 0)).toBe(true);
    expect(counts.reduce((sum, value) => sum + value, 0)).toBe(row.total_population);
    expect(row.share_65_plus as number).toBeCloseTo(100 * Number(row.population_65_plus) / Number(row.total_population), 5);
  }
  const princeGeorge = ages.rows.find(row => row.lha_code === "524" && row.year === "2025")!;
  expect(princeGeorge.total_population).toBe(105544);
  expect(princeGeorge.population_65_plus).toBe(18654);
  expect(princeGeorge.share_65_plus).toBe(17.674145);
  expect(ages.columns.find(column => column.key === "share_65_plus")?.unit).toBe("%");
});

test("age maps default to the 2025 projection and the trend preserves the projected Prince George share", async ({ page }) => {
  await page.goto(`${explorer}&dataset=population-lha-ages`);
  await expect(page.getByRole("tab", { name: "Map", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("year-select")).toHaveValue("2025");
  await expect(page.getByTestId("metric-select")).toHaveValue("share_65_plus");
  const state = page.getByTestId("atlas-map-state");
  await expect(state).toHaveAttribute("data-ready", "true");
  await expect(state).toHaveAttribute("data-feature-count", "89");
  await expect(state).toHaveAttribute("data-matched-count", "17");
  await expect(state).toHaveAttribute("data-rendered-features", /^[1-9]\d*$/);
  await page.getByRole("combobox", { name: "Select map region", exact: true }).selectOption("Prince George");
  await expect(page.locator(".atlas-map-detail")).toContainText("17.7%");
  await page.getByTestId("entity-select").selectOption("Prince George");
  await page.getByRole("tab", { name: "Table", exact: true }).click();
  await expect(page.locator(".atlas-data-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".atlas-data-table tbody")).toContainText("Projection");
  await page.getByTestId("year-select").selectOption("");
  await page.getByRole("tab", { name: "Chart", exact: true }).click();
  const projection = page.getByRole("button", { name: "Prince George, 2025 (Projection): 17.67%", exact: true });
  await expect(projection).toBeAttached();
  await projection.click();
  await expect(page.locator(".atlas-chart-selection")).toContainText("Projection");
  await expect(page.locator(".atlas-chart-selection")).toContainText("17.67%");
  await expect(page.locator(".atlas-chart-footnote").filter({ hasText: "source projection" })).toContainText("2025");
});

test("CAUBO income retains seven exact comparators, four source fiscal labels and the verified thousand-dollar scale", async ({ request }) => {
  const income = await dataset(request, "research-income.json", "research-income");
  expect(income.rows).toHaveLength(28);
  expect(new Set(income.rows.map(row => `${row.caubo_institution_code}|${row.fiscal_year}`)).size).toBe(28);
  expect([...new Set(income.rows.map(row => row.comparator))].sort()).toEqual([...incomeComparators].sort());
  expect([...new Set(income.rows.map(row => row.fiscal_year))].sort()).toEqual(incomePeriods);
  expect(income.rows.every(row => row.sponsored_research_income_cad === Number(row.source_subtotal_thousands_cad) * 1000)).toBe(true);
  expect(income.rows.some(row => row.comparator === "BC Cancer / Vancouver")).toBe(false);
  const unbc = income.rows.filter(row => row.comparator === "UNBC / Prince George");
  expect(unbc.map(row => row.sponsored_research_income_cad)).toEqual([15153000, 17718000, 17710000, 19612000]);
  expect(income.columns.find(column => column.key === "sponsored_research_income_cad")?.unit).toBe("CAD");
  expect(income.geography).toBe("institution");
  const provenance = await (await request.get("data/nhhr/research-income-provenance.json")).json();
  expect(provenance.unitEvidence).toHaveLength(4);
  expect(provenance.unitEvidence.every((entry: { cell: string; statement: string }) => entry.cell === "E17" && entry.statement.includes("thousands of dollars"))).toBe(true);
  expect(provenance.rowBindings).toHaveLength(28);
  expect(provenance.rowBindings.every((entry: { sourceLineId: string; sourceFundCode: string }) => entry.sourceLineId === "L25" && entry.sourceFundCode === "C05")).toBe(true);
});

test("CAUBO maps, records, CSV and fiscal trends preserve the selected UNBC income series", async ({ page }) => {
  await page.goto(`${explorer}&dataset=research-income`);
  await expect(page.getByRole("tab", { name: "Map", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("year-select")).toHaveValue("2023-2024");
  const state = page.getByTestId("atlas-map-state");
  await expect(state).toHaveAttribute("data-ready", "true");
  await expect(state).toHaveAttribute("data-geometry", "points");
  await expect(state).toHaveAttribute("data-matched-count", "7");
  await expect(state).toHaveAttribute("data-rendered-features", "7");
  await expect(state).toHaveAttribute("data-bubble-scale-max", "739668000");
  const initialUnbc = (await renderedPoints(state)).find(point => point.code === "unbc")!;
  expect(initialUnbc.value).toBe(19612000);
  await expect(page.getByRole("combobox", { name: "Select map institution", exact: true }).locator('option[value="BC Cancer / Vancouver"]')).toHaveCount(0);
  await page.getByRole("combobox", { name: "Select map institution", exact: true }).selectOption("UNBC / Prince George");
  await expect(page.locator(".atlas-map-detail")).toContainText("$19,612,000");
  await page.getByTestId("entity-select").selectOption("UNBC / Prince George");
  await expect(state).toHaveAttribute("data-matched-count", "1");
  await expect.poll(async () => (await renderedPoints(state)).length).toBe(1);
  expect((await renderedPoints(state))[0].radius).toBeCloseTo(initialUnbc.radius, 6);
  await page.getByRole("tab", { name: "Chart", exact: true }).click();
  await expect(page.locator(".atlas-bar-row")).toHaveCount(1);
  await expect(page.locator(".atlas-bar-row")).toContainText("$19,612,000");
  await page.getByRole("tab", { name: "Table", exact: true }).click();
  await expect(page.locator(".atlas-data-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".atlas-data-table tbody")).toContainText("2023-2024");
  await expect(page.locator(".atlas-data-table tbody")).toContainText("19,612,000");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV", exact: true }).click();
  const csv = await readFile((await (await downloadEvent).path())!, "utf8");
  expect(csv.split(/\r?\n/)).toHaveLength(2);
  expect(csv).toContain('"UNBC / Prince George","996","University of Northern British Columbia","2023-2024","19612000","19612"');
  await page.getByTestId("year-select").selectOption("");
  await page.getByRole("tab", { name: "Chart", exact: true }).click();
  await expect(page.getByRole("button", { name: "Trends over time", exact: true })).toHaveAttribute("aria-pressed", "true");
  const chart = page.locator(".atlas-trend-chart");
  await expect(chart.locator("circle[role='button']")).toHaveCount(4);
  const labels = await chart.locator("text").allTextContents();
  for (const period of incomePeriods) expect(labels).toContain(period);
  await expect(chart.getByRole("button", { name: "UNBC / Prince George, 2020-2021: $15,153,000", exact: true })).toBeAttached();
  await expect(chart.getByRole("button", { name: "UNBC / Prince George, 2023-2024: $19,612,000", exact: true })).toBeAttached();
  await page.locator(".atlas-source-notes summary").click();
  await expect(page.locator(".atlas-source-notes")).toContainText("thousand-dollar reporting precision");
  await expect(page.locator(".atlas-source-notes")).toContainText("not health-research-only income, NHHR revenue");
});
