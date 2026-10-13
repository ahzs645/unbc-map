import { expect, test, type APIRequestContext } from "@playwright/test";
import type { AtlasDataset } from "../src/atlas/types";
import { mockBasemaps } from "./basemap-fixtures";

const explorer = "dev/projects?view=explore";
const fiscalPeriods = ["2020–2021", "2021–2022", "2022–2023", "2023–2024", "2024–2025"];
const northernCosts = [9059, 8519, 9255, 10801, 13055];

test.beforeEach(async ({ page }) => {
  await mockBasemaps(page);
});

async function additionalDatasets(request: APIRequestContext): Promise<AtlasDataset[]> {
  const response = await request.get("data/nhhr/additional-evidence.json");
  expect(response.ok()).toBe(true);
  const release = await response.json() as { datasets: AtlasDataset[] };
  expect(release.datasets.map(dataset => dataset.id).sort()).toEqual([
    "hospital-stay-costs",
    "surgical-waits-northern",
  ]);
  return release.datasets;
}

test("additional surgical records retain suppression, missing waits and one procedure-age observation", async ({ request }) => {
  const dataset = (await additionalDatasets(request)).find(item => item.id === "surgical-waits-northern")!;
  expect(dataset.rows).toHaveLength(99);
  const keys = dataset.rows.map(row => `${row.procedure_key}|${row.age_group}|${row.report_as_of}`);
  expect(new Set(keys).size).toBe(99);
  expect(new Set(dataset.rows.map(row => row.procedure)).size).toBe(99);

  const suppressed = dataset.rows.filter(row => row.cases_waiting_raw === "Less than 5");
  expect(suppressed).toHaveLength(40);
  expect(suppressed.every(row => row.cases_waiting === null && row.waiting_count_status === "Suppressed: less than 5")).toBe(true);
  expect(dataset.rows.filter(row => row.p90_weeks === null)).toHaveLength(39);
  expect(dataset.rows.every(row => row.report_as_of === "2026-04-30"
    && row.completed_period_start === "2026-02-01"
    && row.completed_period_end === "2026-04-30")).toBe(true);
  for (const row of dataset.rows) {
    for (const field of ["p50_weeks", "p90_weeks"]) {
      if (row[field] !== null) {
        expect(typeof row[field]).toBe("number");
        expect(Number.isFinite(row[field])).toBe(true);
        expect(row[field] as number).toBeGreaterThanOrEqual(0);
      }
    }
    if (row.p50_weeks !== null && row.p90_weeks !== null) {
      expect(row.p50_weeks as number).toBeLessThanOrEqual(row.p90_weeks as number);
    }
  }
  expect(dataset.datasetId).toBe("a2987ed6-8b5d-4548-aab0-10f962545539");
  expect(dataset.tableName).toBe("nhhr_data_c072_8ecfe860a47c_zip_data_c072_health");
  expect(dataset.columns.find(column => column.key === "p90_weeks")?.unit).toBe("weeks");
  expect(dataset.geography).toBe("none");
});

test("additional hospital costs retain exact fiscal periods, reporting grain and Northern values", async ({ request }) => {
  const dataset = (await additionalDatasets(request)).find(item => item.id === "hospital-stay-costs")!;
  expect(dataset.rows).toHaveLength(34);
  const keys = dataset.rows.map(row => `${row.reporting_level}|${row.place_or_organization}|${row.fiscal_year}`);
  expect(new Set(keys).size).toBe(34);
  expect([...new Set(dataset.rows.map(row => row.fiscal_year))].sort()).toEqual(fiscalPeriods);
  expect(dataset.rows.every(row => row.reporting_level === "Province/territory" || row.reporting_level === "Health region")).toBe(true);

  const northern = dataset.rows.filter(row => row.place_or_organization === "Northern Health (B.C.)")
    .sort((left, right) => String(left.fiscal_year).localeCompare(String(right.fiscal_year)));
  expect(northern.map(row => row.fiscal_year)).toEqual(fiscalPeriods);
  expect(northern.map(row => row.cost_per_weighted_case)).toEqual(northernCosts);
  expect(dataset.rows.some(row => row.place_or_organization === "Provincial Health Services Authority (B.C.)"
    && row.fiscal_year === "2020–2021")).toBe(false);
  expect(dataset.columns.find(column => column.key === "cost_per_weighted_case")?.unit).toBe("CAD");
  expect(dataset.datasetId).toBe("8502dc29-352e-4bb5-80a4-1d7b14cd843d");
  expect(dataset.tableName).toBe("nhhr_recovered_data_c073_20261007_zip_cihi_2");
  expect(dataset.geography).toBe("ha");
});

test("surgical table and chart distinguish suppressed counts and unreported waits from zero", async ({ page }) => {
  await page.goto(`${explorer}&dataset=surgical-waits-northern`);
  await expect(page.getByTestId("metric-select")).toHaveValue("p90_weeks");
  await page.getByTestId("entity-select").selectOption("All Other Procedures · Child");
  await page.getByRole("tab", { name: "Table", exact: true }).click();
  const row = page.locator(".atlas-data-table tbody tr");
  await expect(row).toHaveCount(1);
  await expect(row.getByRole("cell", { name: "Less than 5", exact: true })).toBeVisible();
  await expect(row.locator("td.is-number")).toHaveText(["Not reported", "Not reported", "Not reported"]);
  await expect(row).toContainText("2026-04-30");

  await page.getByRole("tab", { name: "Chart", exact: true }).click();
  await expect(page.getByText("No reported numeric values in this view.", { exact: true })).toBeVisible();
  await expect(page.locator(".atlas-bar-row")).toHaveCount(0);
  await page.getByTestId("entity-select").selectOption("Cataract Surgery · Adult");
  await expect(page.locator(".atlas-bar-row")).toHaveCount(1);
  await expect(page.locator(".atlas-bar-row")).toContainText("19.3 weeks");
  await page.getByTestId("entity-select").selectOption("");
  await expect(page.locator(".atlas-chart-footnote")).toContainText("60 records with reported values · 39 missing values omitted from chart");
});

test("hospital trends display fiscal ranges and expose the exact Northern source series", async ({ page }) => {
  await page.goto(`${explorer}&dataset=hospital-stay-costs&display=chart`);
  await page.getByTestId("entity-select").selectOption("Northern Health (B.C.)");
  await expect(page.getByRole("button", { name: "Trends over time", exact: true })).toHaveAttribute("aria-pressed", "true");
  const chart = page.locator(".atlas-trend-chart");
  await expect(chart.locator("circle[role='button']")).toHaveCount(5);
  const visibleAxisLabels = await chart.locator("text").allTextContents();
  for (let index = 0; index < fiscalPeriods.length; index++) {
    expect(visibleAxisLabels).toContain(fiscalPeriods[index]);
    const amount = new Intl.NumberFormat("en-CA").format(northernCosts[index]);
    await expect(chart.getByRole("button", {
      name: `Northern Health (B.C.), ${fiscalPeriods[index]}: $${amount}`,
      exact: true,
    })).toBeAttached();
  }
  await chart.getByRole("button", { name: "Northern Health (B.C.), 2024–2025: $13,055", exact: true }).click();
  await expect(page.locator(".atlas-chart-selection")).toContainText("2024–2025");
  await expect(page.locator(".atlas-chart-selection")).toContainText("$13,055");

  await page.getByTestId("year-select").selectOption("2024–2025");
  await page.getByRole("tab", { name: "Table", exact: true }).click();
  await expect(page.locator(".atlas-data-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".atlas-data-table tbody")).toContainText("2024–2025");
  await expect(page.locator(".atlas-data-table tbody")).toContainText("13,055");
  await page.reload();
  await expect(page.getByTestId("year-select")).toHaveValue("2024–2025");
  await expect(page.getByTestId("entity-select")).toHaveValue("Northern Health (B.C.)");
});

test("additional evidence uses reviewed geography and exposes its source methods", async ({ page }) => {
  const sources = [
    {
      id: "surgical-waits-northern",
      heading: "Northern Health scheduled surgery waits",
      datasetId: "a2987ed6-8b5d-4548-aab0-10f962545539",
      sourceUrl: "https://swt.hlth.gov.bc.ca/swt/WaitTimeDefinitions.xhtml",
      caveats: ["1 February–30 April 2026", "Less than 5", "Thirty-nine", "excluded"],
    },
    {
      id: "hospital-stay-costs",
      heading: "BC standard hospital stay costs",
      datasetId: "8502dc29-352e-4bb5-80a4-1d7b14cd843d",
      sourceUrl: "https://www.cihi.ca/en/indicators/cost-of-a-standard-hospital-stay-cshs",
      caveats: ["weighted inpatient cases", "overlap geographically", "PHSA", "marginal costs"],
    },
  ];
  for (const source of sources) {
    await page.goto(`${explorer}&dataset=${source.id}&display=map`);
    await expect(page.getByRole("heading", { level: 2, name: source.heading, exact: true })).toBeVisible();
    if (source.id === "surgical-waits-northern") {
      await expect(page.getByRole("tab", { name: "Map", exact: true })).toBeDisabled();
      await expect(page.getByRole("tab", { name: "Chart", exact: true })).toHaveAttribute("aria-selected", "true");
      await expect(page.getByTestId("atlas-map-state")).toHaveCount(0);
      await expect(page.locator(".atlas-geography-note")).toContainText("Nonspatial data");
    } else {
      await expect(page.getByRole("tab", { name: "Map", exact: true })).toBeEnabled();
      await expect(page.getByTestId("atlas-map-state")).toHaveAttribute("data-matched-count", "5");
      await expect(page.locator(".atlas-map-join-note")).toContainText("2 unmatched rows");
    }
    await page.locator(".atlas-source-notes summary").click();
    const notes = page.locator(".atlas-source-notes");
    await expect(notes).toContainText(source.datasetId);
    for (const caveat of source.caveats) await expect(notes).toContainText(caveat);
    await expect(notes.getByRole("link", { name: "Open source reference" })).toHaveAttribute("href", source.sourceUrl);
  }
});

test("new short stories open their reviewed surgical and hospital datasets", async ({ page }) => {
  const stories = [
    { id: "surgical-wait-context", title: "A waiting list and a completed-surgery wait", dataset: "surgical-waits-northern", metric: "p90_weeks", excerpt: "1,038 cases waiting" },
    { id: "hospital-cost-context", title: "What a standard hospital-stay cost measures", dataset: "hospital-stay-costs", metric: "cost_per_weighted_case", excerpt: "FY2024–2025" },
  ];
  for (const story of stories) {
    await page.goto("dev/projects");
    await page.getByRole("textbox", { name: "Search stories" }).fill(story.title);
    await expect(page.locator(".atlas-story-card")).toHaveCount(1);
    await page.locator(".atlas-story-card").click();
    await expect(page).toHaveURL(new RegExp(`story=${story.id}`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(story.title);
    await expect(page.locator(".atlas-story-narrative")).toContainText(story.excerpt);
    await expect(page.getByTestId("atlas-map-state")).toHaveCount(story.dataset === "hospital-stay-costs" ? 1 : 0);
    await page.getByRole("button", { name: "Explore this dataset", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`dataset=${story.dataset}`));
    await expect(page.getByTestId("metric-select")).toHaveValue(story.metric);
    if (story.dataset === "hospital-stay-costs") await expect(page.getByRole("tab", { name: "Map", exact: true })).toBeEnabled();
    else await expect(page.getByRole("tab", { name: "Map", exact: true })).toBeDisabled();
  }
});
