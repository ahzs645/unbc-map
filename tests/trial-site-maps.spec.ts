import { expect, test, type APIRequestContext, type Locator } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { AtlasDataset, AtlasRow } from "../src/atlas/types";
import { mockBasemaps } from "./basemap-fixtures";

const explorer = "dev/projects?view=explore";
const cancerName = "BC Cancer – Prince George (Centre for the North)";
const regionalDescription = "13 individual First Nations in north-Central BC near Prince George, BC";
const snapshotDate = "2026-04-29";
const expectedStudies = [
  "NCT02756793", "NCT02963233", "NCT03862911", "NCT04105088", "NCT04797299",
  "NCT05050929", "NCT05470010", "NCT05640999", "NCT06440395", "NCT07152821",
];
const expectedValues = {
  "bc-cancer-prince-george": 7,
  "prince-george-family-ymca": 1,
  "prince-george-surgery-centre": 1,
};
const expectedLocations = {
  "bc-cancer-prince-george": {
    coordinates: [-122.7643857, 53.9129846],
    source: "https://www.bccancer.bc.ca/centre-for-the-north-site",
    osm: "https://www.openstreetmap.org/way/445255632",
    address: "1215 Lethbridge Street",
  },
  "prince-george-family-ymca": {
    coordinates: [-122.77237, 53.9043694],
    source: "https://www.ymcabc.ca/locations/prince-george-family-ymca",
    osm: "https://www.openstreetmap.org/node/7033781790",
    address: "2020 Massey Drive",
  },
  "prince-george-surgery-centre": {
    coordinates: [-122.750288, 53.9160995],
    source: "https://www.healthlinkbc.ca/find-care/find-health-services/program/surgical-services-1?location_nid=27051",
    osm: "https://www.openstreetmap.org/node/4268588591",
    address: "500 Victoria Street",
  },
};
type RenderedPoint = { code: string; value: number | null; radius: number };
type SiteFeature = {
  id: string;
  geometry: { type: string; coordinates: number[] };
  properties: Record<string, string>;
};

test.beforeEach(async ({ page }) => { await mockBasemaps(page); });

async function releaseDataset(request: APIRequestContext, filename: string, id: string): Promise<AtlasDataset> {
  const response = await request.get(`data/nhhr/${filename}`);
  expect(response.ok()).toBe(true);
  const release = await response.json() as { datasets: AtlasDataset[] };
  const dataset = release.datasets.find(item => item.id === id);
  expect(dataset).toBeDefined();
  return dataset!;
}

async function renderedPoints(state: Locator): Promise<RenderedPoint[]> {
  return JSON.parse(await state.getAttribute("data-rendered-points") ?? "[]");
}

function csvRecords(content: string): string[][] {
  // Parse quoted RFC 4180 fields so commas in the retained regional description
  // and location caveats are tested as data, rather than mistaken for columns.
  const records: string[][] = [];
  let record: string[] = [], field = "", quoted = false;
  const text = content.replace(/^\uFEFF/, "");
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { field += '"'; index++; }
      else quoted = !quoted;
    } else if (!quoted && char === ",") { record.push(field); field = ""; }
    else if (!quoted && (char === "\r" || char === "\n")) {
      if (char === "\r" && text[index + 1] === "\n") index++;
      record.push(field); records.push(record); record = []; field = "";
    } else field += char;
  }
  expect(quoted).toBe(false);
  if (record.length || field) { record.push(field); records.push(record); }
  return records;
}

function assertCsvRow(record: string[], dataset: AtlasDataset, expected: AtlasRow) {
  expect(record).toEqual(dataset.columns.map(column => expected[column.key] == null ? "" : String(expected[column.key])));
}

test("trial release reconciles ten original NCT/site pairs, collapsed aliases and historical statuses", async ({ request }) => {
  const sites = await releaseDataset(request, "trial-sites.json", "trial-sites");
  const evidence = await releaseDataset(request, "trial-sites.json", "trial-site-evidence");
  const coded = await releaseDataset(request, "atlas-snapshot.json", "clinical-pg");
  expect(sites.rows).toHaveLength(4);
  expect(sites.geography).toBe("facility");
  expect(sites.mapLocationsAsset).toBe("locations-trial-sites.geojson");
  expect(sites.boundaryKeyField).toBe("location_code");
  expect(sites.defaultMetric).toBe("distinct_studies");
  expect(sites.timeField).toBe("snapshot_date");
  expect(sites.datasetId).toBe("d85b189f-9d24-421c-883c-6b759f081900");
  expect(sites.tableName).toBe("nhhr_data_c010_9e6f293c5f27_zip_data_c010__4");
  expect(evidence.geography).toBe("none");
  expect(evidence.rows).toHaveLength(10);
  expect(evidence.rows.map(row => row.nct_id).sort()).toEqual(expectedStudies);
  expect(new Set(evidence.rows.map(row => `${row.nct_id}|${row.location_code ?? row.source_facility_name}`)).size).toBe(10);
  expect(evidence.rows.every(row => row.study_site_record === 1 && row.snapshot_date === snapshotDate)).toBe(true);
  expect(evidence.rows.filter(row => row.location_code != null)).toHaveLength(9);
  expect(sites.rows.every(row => row.snapshot_date === snapshotDate)).toBe(true);
  expect(sites.rows.reduce((sum, row) => sum + Number(row.distinct_studies), 0)).toBe(10);
  expect(evidence.rows.filter(row => row.overall_status === "RECRUITING")).toHaveLength(6);
  expect(evidence.rows.filter(row => row.overall_status === "ACTIVE_NOT_RECRUITING")).toHaveLength(2);
  expect(evidence.rows.filter(row => row.overall_status === "UNKNOWN").map(row => row.nct_id).sort()).toEqual(["NCT02963233", "NCT04105088"]);
  const cancer = sites.rows.find(row => row.location_code === "bc-cancer-prince-george")!;
  expect(cancer.facility_name).toBe(cancerName);
  expect(cancer.distinct_studies).toBe(7);
  expect(cancer.recruiting_snapshot_studies).toBe(5);
  expect(cancer.active_not_recruiting_snapshot_studies).toBe(2);
  expect(cancer.unknown_status_studies).toBe(0);
  const cancerEvidence = evidence.rows.filter(row => row.location_code === "bc-cancer-prince-george");
  expect(cancerEvidence).toHaveLength(7);
  expect([...new Set(cancerEvidence.map(row => row.source_facility_name))].sort()).toEqual([
    "BC Cancer - Centre for the North (Prince George)", "BC Cancer - Prince George", "BCCA - Prince George",
  ]);
  expect(cancerEvidence.every(row => row.facility_name === cancerName)).toBe(true);
  for (const row of evidence.rows) {
    const original = coded.rows.find(item => item.nct_id === row.nct_id)!;
    expect(original).toBeDefined();
    expect(row.brief_title).toBe(original.brief_title);
    expect(row.overall_status).toBe(original.overall_status);
    expect(row.source_facility_name).toBe(original.facilities);
    expect(row.condition_domain).toBe(original.condition_domain);
    expect(row.registry_url).toBe(`https://clinicaltrials.gov/study/${row.nct_id}`);
    expect(Object.keys(row).some(key => /^(?:contact|email|phone|investigator)/i.test(key))).toBe(false);
  }
  const provenance = await (await request.get("data/nhhr/trial-sites-provenance.json")).json();
  expect(provenance.sourceSnapshotDate).toBe(snapshotDate);
  expect(provenance.originalSources.map((item: { originalFileId: string }) => item.originalFileId)).toEqual([
    "b1cbb418-b55d-4745-b56d-f9905f36c2d3", "72546d16-6f7b-4e1f-a3c8-9f966bd5fa04",
    "0681a2cb-fb75-4a25-b75f-65302f729518", "2abf3657-bc8c-45af-ace4-9fbd5fc0e59d",
  ]);
  expect(provenance.originalSources.every((item: { sha256: string }) => /^[a-f0-9]{64}$/.test(item.sha256))).toBe(true);
  expect(provenance.rowBindings).toHaveLength(10);
  expect(provenance.rawSampleCoordinateReview.sourceSampleStudyRows).toBe(25);
  expect(provenance.rawSampleCoordinateReview.whitelistIntersectionRows).toBe(3);
});

test("three physical-site geometries retain official address and OSM evidence while rejecting the repeated city centroid", async ({ request }) => {
  const response = await request.get("data/nhhr/locations-trial-sites.geojson");
  expect(response.ok()).toBe(true);
  const geojson = await response.json() as { features: SiteFeature[]; attribution: string };
  expect(geojson.features).toHaveLength(3);
  expect(geojson.features.map(feature => feature.properties.code).sort()).toEqual(Object.keys(expectedLocations).sort());
  expect(new Set(geojson.features.map(feature => feature.geometry.coordinates.join(","))).size).toBe(3);
  expect(geojson.attribution).toContain("OpenStreetMap");
  for (const feature of geojson.features) {
    const expected = expectedLocations[feature.properties.code as keyof typeof expectedLocations];
    expect(feature.geometry.type).toBe("Point");
    expect(feature.geometry.coordinates).toEqual(expected.coordinates);
    expect(feature.geometry.coordinates).not.toEqual([-122.75301, 53.9166]);
    expect(feature.properties.site).toContain(expected.address);
    expect(feature.properties.source_url ?? feature.properties.sourceUrl).toBe(expected.source);
    expect(feature.properties.coordinate_source_url ?? feature.properties.coordinateSourceUrl).toBe(expected.osm);
    expect(feature.properties.location_note ?? feature.properties.locationNote).toMatch(/verified|HealthLink BC explicitly/i);
    expect(feature.properties.name).not.toBe(regionalDescription);
  }
  for (const code of ["bc-cancer-prince-george", "prince-george-surgery-centre"]) {
    const properties = geojson.features.find(feature => feature.properties.code === code)!.properties;
    expect(properties.location_note ?? properties.locationNote).toContain("official postal code");
    expect(properties.location_note ?? properties.locationNote).toContain("postcode differs");
  }
  const surgery = geojson.features.find(feature => feature.properties.code === "prince-george-surgery-centre")!.properties;
  expect(surgery.location_note ?? surgery.locationNote).toContain("building, not a department or exact study room");
  const provenance = await (await request.get("data/nhhr/trial-sites-provenance.json")).json();
  expect(provenance.rawSampleCoordinateReview.sourcePointRejected).toEqual([-122.75301, 53.9166]);
  expect(provenance.rawSampleCoordinateReview.records).toHaveLength(3);
  expect(provenance.rawSampleCoordinateReview.records.every((row: { geoPoint: { lat: number; lon: number } }) => row.geoPoint.lat === 53.9166 && row.geoPoint.lon === -122.75301)).toBe(true);
  expect(provenance.unmatched).toHaveLength(1);
  expect(provenance.unmatched[0]).toMatchObject({
    nctId: "NCT04105088", sourceDescription: regionalDescription, coordinates: null,
    locationCode: null, registryUrl: "https://clinicaltrials.gov/study/NCT04105088",
  });
});

test("native trial-site maps show three source-valued dots, one unmatched row and historical source notes", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${explorer}&dataset=trial-sites`);
  await expect(page.getByRole("tab", { name: "Map", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("year-select")).toHaveValue(snapshotDate);
  const state = page.getByTestId("atlas-map-state");
  await expect(state).toHaveAttribute("data-ready", "true");
  await expect(state).toHaveAttribute("data-geometry", "points");
  await expect(state).toHaveAttribute("data-feature-count", "3");
  await expect(state).toHaveAttribute("data-matched-count", "3");
  await expect(state).toHaveAttribute("data-rendered-features", "3");
  await expect(state).toHaveAttribute("data-map-aggregation", "none");
  await expect(state).toHaveAttribute("data-basemap-status", "ready");
  await expect(state).toHaveAttribute("data-basemap-format", "vector");
  await expect(state).toHaveAttribute("data-raster-sources", "0");
  await expect(state).toHaveAttribute("data-basemap-features", /^[1-9]\d*$/);
  await expect(state).toHaveAttribute("data-bubble-scale-max", "7");
  const points = await renderedPoints(state);
  expect(Object.fromEntries(points.map(point => [point.code, point.value]))).toEqual(expectedValues);
  const cancer = points.find(point => point.code === "bc-cancer-prince-george")!;
  const ymca = points.find(point => point.code === "prince-george-family-ymca")!;
  expect(ymca.radius ** 2 / cancer.radius ** 2).toBeCloseTo(1 / 7, 7);
  await expect(page.locator(".atlas-map-canvas canvas")).toBeVisible();
  await expect(page.locator(".atlas-map-join-note")).toContainText("3 exact site location matches · 1 unmatched rows");
  await expect(page.locator(".atlas-results-line")).toContainText("4 of 4 source records");
  await expect(page.locator(".atlas-dataset-context")).toContainText("Historical registry snapshot · April 29, 2026");
  const selector = page.getByRole("combobox", { name: "Select map site", exact: true });
  await expect(selector.locator("option")).toHaveCount(4);
  await expect(selector.locator("option").filter({ hasText: regionalDescription })).toHaveCount(0);
  const scope = page.locator(".atlas-institution-scope");
  await expect(scope).toContainText("Grouped or uncertain locations remain unassigned");
  await expect(scope.getByRole("link", { name: "Location sources & caveats", exact: true })).toHaveAttribute("href", /data\/nhhr\/locations-trial-sites\.README\.md$/);
  await expect(scope.getByRole("link", { name: "Location GeoJSON", exact: true })).toHaveAttribute("href", /data\/nhhr\/locations-trial-sites\.geojson$/);
  await page.locator(".atlas-source-notes summary").click();
  const notes = page.locator(".atlas-source-notes");
  await expect(notes).toContainText("d85b189f-9d24-421c-883c-6b759f081900");
  await expect(notes).toContainText("nhhr_data_c010_9e6f293c5f27_zip_data_c010__4");
  await expect(notes).toContainText("not verified local-site status or current availability");
  await expect(notes).toContainText("UNKNOWN is retained");
  await expect(notes).toContainText("must not be added together");
  await expect(notes.getByRole("link", { name: "Open source reference", exact: false })).toHaveAttribute("href", "https://clinicaltrials.gov/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("selected physical-site detail preserves seven studies, five historical recruiting records and coordinate caveats", async ({ page }) => {
  await page.goto(`${explorer}&dataset=trial-sites`);
  const selector = page.getByRole("combobox", { name: "Select map site", exact: true });
  const state = page.getByTestId("atlas-map-state");
  await expect(state).toHaveAttribute("data-rendered-features", "3");
  await selector.selectOption(cancerName);
  const detail = page.locator(".atlas-map-detail");
  await expect(detail).toContainText("Distinct source studies: 7");
  await expect(detail).toContainText("1215 Lethbridge Street");
  await expect(detail.getByRole("link", { name: "Site location", exact: true })).toHaveAttribute("href", expectedLocations["bc-cancer-prince-george"].source);
  await expect(detail.getByRole("link", { name: "Mapped point", exact: true })).toHaveAttribute("href", expectedLocations["bc-cancer-prince-george"].osm);
  await expect(detail).toContainText("official postal code V2M 7E9 is retained");
  await expect(detail).toContainText("postcode differs");
  await page.getByTestId("metric-select").selectOption("recruiting_snapshot_studies");
  await expect(state).toHaveAttribute("data-metric", "recruiting_snapshot_studies");
  await selector.selectOption(cancerName);
  await expect(detail).toContainText("RECRUITING in source snapshot: 5");
  await expect.poll(async () => (await renderedPoints(state)).find(point => point.code === "bc-cancer-prince-george")?.value).toBe(5);
  await selector.selectOption("Prince George Surgery Centre");
  await expect(detail).toContainText("RECRUITING in source snapshot: 0");
  await expect(detail).toContainText("UNKNOWN source study status is retained");
  await expect(detail).toContainText("building, not a department or exact study room");
  await expect(detail.getByRole("link", { name: "Site location", exact: true })).toHaveAttribute("href", expectedLocations["prince-george-surgery-centre"].source);
  await expect(detail.getByRole("link", { name: "Mapped point", exact: true })).toHaveAttribute("href", expectedLocations["prince-george-surgery-centre"].osm);
  await page.getByTestId("metric-select").selectOption("unknown_status_studies");
  await selector.selectOption("Prince George Surgery Centre");
  await expect(detail).toContainText("UNKNOWN in source snapshot: 1");
});

test("trial-site shared filters preserve the same cancer summary in map, chart, table, reload and CSV", async ({ page, request }) => {
  const sites = await releaseDataset(request, "trial-sites.json", "trial-sites");
  const cancer = sites.rows.find(row => row.location_code === "bc-cancer-prince-george")!;
  await page.goto(`${explorer}&dataset=trial-sites`);
  const state = page.getByTestId("atlas-map-state");
  await expect(state).toHaveAttribute("data-rendered-features", "3");
  const originalRadius = (await renderedPoints(state)).find(point => point.code === "bc-cancer-prince-george")!.radius;
  await page.getByTestId("entity-select").selectOption(cancerName);
  await expect(state).toHaveAttribute("data-matched-count", "1");
  await expect(state).toHaveAttribute("data-rendered-features", "1");
  await expect(state).toHaveAttribute("data-bubble-scale-max", "7");
  await expect.poll(async () => (await renderedPoints(state)).map(point => point.value)).toEqual([7]);
  expect((await renderedPoints(state))[0].radius).toBeCloseTo(originalRadius, 6);
  await page.getByTestId("metric-select").selectOption("recruiting_snapshot_studies");
  await expect.poll(async () => (await renderedPoints(state)).map(point => point.value)).toEqual([5]);
  await page.getByRole("tab", { name: "Chart", exact: true }).click();
  await expect(page.locator(".atlas-bar-row")).toHaveCount(1);
  await expect(page.locator(".atlas-bar-row")).toContainText(cancerName);
  await expect(page.locator(".atlas-bar-row")).toContainText("5 studies");
  await page.getByRole("tab", { name: "Table", exact: true }).click();
  await expect(page.locator(".atlas-data-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".atlas-data-table tbody")).toContainText(cancerName);
  await expect(page.locator(".atlas-data-table tbody")).toContainText(snapshotDate);
  await expect(page.locator(".atlas-data-table tbody")).toContainText("NCT07152821");
  await page.reload();
  await expect(page.getByTestId("entity-select")).toHaveValue(cancerName);
  await expect(page.getByTestId("metric-select")).toHaveValue("recruiting_snapshot_studies");
  await expect(page.getByTestId("year-select")).toHaveValue(snapshotDate);
  await expect(page.getByRole("tab", { name: "Table", exact: true })).toHaveAttribute("aria-selected", "true");
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV", exact: true }).click();
  const download = await event;
  expect(download.suggestedFilename()).toBe("nhhr-trial-sites-filtered.csv");
  const records = csvRecords(await readFile((await download.path())!, "utf8"));
  expect(records).toHaveLength(2);
  expect(records[0]).toEqual(sites.columns.map(column => column.key));
  assertCsvRow(records[1], sites, cancer);
});

test("the regional First Nations description remains an unlocated source row in charts, tables and CSV", async ({ page, request }) => {
  const sites = await releaseDataset(request, "trial-sites.json", "trial-sites");
  const regional = sites.rows.find(row => row.facility_name === regionalDescription)!;
  expect(regional.location_code).toBeNull();
  expect(regional.distinct_studies).toBe(1);
  expect(regional.unknown_status_studies).toBe(1);
  await page.goto(`${explorer}&dataset=trial-sites`);
  await page.getByTestId("entity-select").selectOption(regionalDescription);
  const state = page.getByTestId("atlas-map-state");
  await expect(state).toHaveAttribute("data-ready", "true");
  await expect(state).toHaveAttribute("data-matched-count", "0");
  await expect(state).toHaveAttribute("data-rendered-features", "0");
  await expect.poll(async () => renderedPoints(state)).toEqual([]);
  await expect(page.locator(".atlas-map-join-note")).toContainText("0 exact site location matches · 1 unmatched rows");
  await expect(page.getByRole("combobox", { name: "Select map site", exact: true }).locator("option")).toHaveCount(1);
  await page.getByRole("tab", { name: "Chart", exact: true }).click();
  await expect(page.locator(".atlas-bar-row")).toHaveCount(1);
  await expect(page.locator(".atlas-bar-row")).toContainText("1 studies");
  await page.getByRole("tab", { name: "Table", exact: true }).click();
  await expect(page.locator(".atlas-data-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".atlas-data-table tbody")).toContainText(regionalDescription);
  await expect(page.locator(".atlas-data-table tbody")).toContainText("Unlocated regional description");
  await expect(page.locator(".atlas-data-table tbody")).toContainText("rather than one named physical facility");
  await expect(page.locator(".atlas-data-table tbody")).toContainText("https://clinicaltrials.gov/study/NCT04105088");
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV", exact: true }).click();
  const records = csvRecords(await readFile((await (await event).path())!, "utf8"));
  expect(records).toHaveLength(2);
  assertCsvRow(records[1], sites, regional);
  expect(records[1][sites.columns.findIndex(column => column.key === "location_code")]).toBe("");
});

test("study-site evidence keeps the ten-study grain and exports the two original UNKNOWN records", async ({ page, request }) => {
  const evidence = await releaseDataset(request, "trial-sites.json", "trial-site-evidence");
  await page.goto(`${explorer}&dataset=trial-site-evidence&display=table`);
  await expect(page.getByRole("tab", { name: "Map", exact: true })).toBeDisabled();
  await expect(page.locator(".atlas-results-line")).toContainText("10 of 10 source records");
  await expect(page.locator(".atlas-data-table tbody tr")).toHaveCount(10);
  expect((await page.locator(".atlas-data-table tbody td:first-child").allTextContents()).sort()).toEqual(expectedStudies);
  await page.getByRole("combobox", { name: "Status in source snapshot", exact: true }).selectOption("UNKNOWN");
  await expect(page.locator(".atlas-results-line")).toContainText("2 of 10 source records");
  await expect(page.locator(".atlas-data-table tbody tr")).toHaveCount(2);
  await expect(page.locator(".atlas-data-table tbody")).toContainText("Prince George Surgery Centre");
  await expect(page.locator(".atlas-data-table tbody")).toContainText(regionalDescription);
  await expect(page.locator(".atlas-data-table tbody")).toContainText("REVIEW_TIER_STRUCTURED_CITY_PG_BUT_REGIONAL_COMMUNITY_SITE");
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV", exact: true }).click();
  const records = csvRecords(await readFile((await (await event).path())!, "utf8"));
  expect(records).toHaveLength(3);
  expect(records[0]).toEqual(evidence.columns.map(column => column.key));
  const originalUnknown = evidence.rows.filter(row => row.overall_status === "UNKNOWN");
  originalUnknown.forEach((row, index) => assertCsvRow(records[index + 1], evidence, row));
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Status in source snapshot", exact: true })).toHaveValue("UNKNOWN");
  await expect(page.locator(".atlas-data-table tbody tr")).toHaveCount(2);
});
