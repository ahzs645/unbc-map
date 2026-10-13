import { test, expect, type APIRequestContext, type Locator } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { AtlasDataset } from '../src/atlas/types';
import { mockBasemaps } from './basemap-fixtures';

const explorer = 'dev/projects?view=explore&dataset=trial-facility-conditions';
const oncology = 'Cancer / oncology';
const vancouverCancer = 'BC Cancer — Vancouver main site';
type Site = { type: string; geometry: { type: string; coordinates: number[] }; properties: { code: string; name: string; city: string; source_url: string; coordinate_source_url: string; location_note: string } };
type Relationship = Record<string, string>;
type Point = { code: string; value: number | null; radius: number };

test.beforeEach(async ({ page }) => { await mockBasemaps(page); });

async function release(request: APIRequestContext) {
  const response = await request.get('data/nhhr/trial-facility-conditions.json');
  expect(response.ok()).toBe(true);
  const data = await response.json() as { datasets: AtlasDataset[]; snapshot: Record<string, unknown> };
  return { ...data, facilities: data.datasets.find(d => d.id === 'trial-facility-conditions')!, coverage: data.datasets.find(d => d.id === 'trial-facility-coverage')! };
}

// A small independent CSV reader preserves quoted commas/newlines and literals.
function csvRecords(text: string): Relationship[] {
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { row.push(cell); cell = ''; }
    else if (c === '\n' && !quoted) { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  const header = rows.shift()!.map(value => value.replace(/^\uFEFF/, ''));
  return rows.filter(values => values.some(Boolean)).map(values => Object.fromEntries(header.map((key, i) => [key, values[i]])));
}
function digest(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
async function points(state: Locator): Promise<Point[]> { return JSON.parse(await state.getAttribute('data-rendered-points') ?? '[]'); }

test('locked source, all city/condition totals and safe study-site deduplication reconcile', async ({ request }) => {
  const { facilities, coverage, snapshot } = await release(request);
  expect(facilities.rows).toHaveLength(171); expect(coverage.rows).toHaveLength(7);
  expect(snapshot.sourceCityStudyRows).toBe(15028);
  expect(facilities.defaultFilters).toEqual({ condition_domain: oncology });
  expect(facilities.mapLocationsAsset).toBe('locations-comparator-trial-sites.geojson');
  expect(facilities.columns.find(c => c.key === 'facility_studies')?.type).toBe('text');
  const provenance = await (await request.get('data/nhhr/trial-facility-conditions-provenance.json')).json();
  expect(provenance.originalSource).toMatchObject({ originalFileId: 'faddef0a-6f47-42bb-8968-197e10322dd1', sha256: '7e809511a4b5f330087f9ea31388448be0a4e2add150444b00eebf922bb5b4be', sourceRowCount: 15028, tableName: 'nhhr_data_c037_69b3f9e8dcdc_zip_data_c037__17' });
  const reviewed = await readFile('scripts/nhhr-comparator-trial-locations.json');
  expect(createHash('sha256').update(reviewed).digest('hex')).toBe(provenance.locationReview.sha256);
  expect(await readFile('public/data/nhhr/trial-facility-conditions.json', 'utf8')).toBe(await readFile('src/atlas/snapshots/trial-facility-conditions.json', 'utf8'));

  const conditionRelease = await (await request.get('data/nhhr/clinical-condition-mix.json')).json();
  const conditions = conditionRelease.datasets[0].rows;
  expect(conditions).toHaveLength(77);
  // Independent oracle from the original 15,028-row CSV (city/domain counts and
  // literal RECRUITING statuses), not from the production aggregation parser.
  const conditionTuples = conditions.map((r: Record<string, unknown>) => [r.query_city, r.condition_domain, r.studies, r.recruiting_snapshot_studies]);
  // Use lexicographic source keys rather than locale-dependent punctuation order.
  conditionTuples.sort((a: string[], b: string[]) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0);
  expect(digest(conditionTuples)).toBe('f2abb0ba2a29d4954a80caf5775fc22d9e350a33c192f6b341a99ca20a3d6dcb');
  const originalCityTotals = { Calgary: 4478, Halifax: 2824, 'Prince George': 10, Saskatoon: 1357, Sudbury: 566, 'Thunder Bay': 205, Vancouver: 5588 };
  expect(Object.fromEntries(coverage.rows.map(r => [r.query_city, r.city_studies]))).toEqual(originalCityTotals);
  expect(coverage.rows.reduce((n, r) => n + Number(r.city_studies), 0)).toBe(15028);

  const safe = csvRecords(await (await request.get('data/nhhr/trial-facility-study-sites.csv')).text());
  expect(safe).toHaveLength(4401);
  expect(Object.keys(safe[0])).toEqual(['query_city', 'nct_id', 'facility_name', 'location_code', 'condition_domain', 'overall_status', 'source_facility_aliases', 'source_csv_row', 'source_matched_site_count', 'parsed_unique_alias_count', 'unresolved_alias_count', 'source_site_count_mismatch', 'registry_url', 'snapshot_date']);
  expect(new Set(safe.map(r => `${r.query_city}|${r.nct_id}|${r.location_code}`)).size).toBe(4401);
  const tuples = safe.map(r => [r.query_city, r.nct_id, r.location_code, r.condition_domain, r.overall_status]);
  tuples.sort((a, b) => { for (let i = 0; i < a.length; i++) { if (a[i] < b[i]) return -1; if (a[i] > b[i]) return 1; } return 0; });
  // Second oracle independently selects reviewed exact aliases from the locked
  // original and deduplicates city/NCT/physical-site relationships.
  expect(digest(tuples)).toBe('7459926578ebcf9d131e4adc22ca93402044a4c4523950273399a939e872400c');
  for (const r of safe) { expect(r.registry_url).toBe(`https://clinicaltrials.gov/study/${r.nct_id}`); expect(r.snapshot_date).toBe('2026-04-29'); }
  for (const r of coverage.rows) {
    const cityRelations = safe.filter(s => s.query_city === r.query_city);
    expect(new Set(cityRelations.map(s => s.nct_id)).size).toBe(r.studies_with_verified_facility);
    expect(Number(r.studies_with_verified_facility) + Number(r.no_verified_facility_studies)).toBe(r.city_studies);
    expect(r.verified_facility_share_pct).toBeCloseTo(100 * Number(r.studies_with_verified_facility) / Number(r.city_studies), 6);
    expect(new Set(cityRelations.filter(s => Number(s.unresolved_alias_count) > 0).map(s => s.nct_id)).size).toBe(r.partly_located_studies);
  }
  for (const r of facilities.rows) {
    const atSite = safe.filter(s => s.location_code === r.location_code);
    const atDomain = atSite.filter(s => s.condition_domain === r.condition_domain);
    expect(new Set(atSite.map(s => s.nct_id)).size).toBe(r.facility_studies);
    expect(new Set(atDomain.map(s => s.nct_id)).size).toBe(r.distinct_studies);
    expect(new Set(atDomain.filter(s => s.overall_status === 'RECRUITING').map(s => s.nct_id)).size).toBe(r.recruiting_snapshot_studies);
    expect(r.condition_share_pct).toBeCloseTo(100 * Number(r.distinct_studies) / Number(r.facility_studies), 6);
  }
});

test('physical registry preserves verified identities, distinct buildings and historical location caveats', async ({ request }) => {
  const geo = await (await request.get('data/nhhr/locations-comparator-trial-sites.geojson')).json() as { features: Site[] };
  expect(geo.features).toHaveLength(25);
  expect(new Set(geo.features.map(f => f.properties.code)).size).toBe(25);
  expect(new Set(geo.features.map(f => f.properties.coordinate_source_url)).size).toBe(25);
  expect(geo.features.filter(f => f.properties.city !== 'Prince George')).toHaveLength(22);
  expect(geo.features.every(f => f.geometry.type === 'Point' && f.geometry.coordinates.every(Number.isFinite) && f.properties.source_url.startsWith('https://') && f.properties.coordinate_source_url.startsWith('https://www.openstreetmap.org/'))).toBe(true);
  const find = (code: string) => geo.features.find(f => f.properties.code === code)!;
  expect(find('vancouver-ubc').geometry.coordinates).toEqual([-123.245747, 49.2641866]);
  expect(find('vancouver-general').geometry.coordinates).toEqual([-123.1226691, 49.2618427]);
  expect(find('vancouver-childrens').geometry.coordinates).not.toEqual(find('vancouver-womens').geometry.coordinates);
  expect(find('calgary-tom-baker').geometry.coordinates).toEqual([-114.1334768, 51.0628884]);
  expect(find('calgary-arthur-child').geometry.coordinates).toEqual([-114.131221, 51.0672552]);
  expect(find('sudbury-cancer').properties.location_note.toLowerCase()).toContain('campus');
  const existing = await (await request.get('data/nhhr/locations-trial-sites.geojson')).json() as { features: Site[] };
  for (const pg of existing.features) expect(find(pg.properties.code).geometry.coordinates).toEqual(pg.geometry.coordinates);
});

test('default oncology map uses real reviewed point values on vector geometry', async ({ page, request }) => {
  const { facilities } = await release(request);
  const expectedRows = facilities.rows.filter(r => r.condition_domain === oncology);
  expect(expectedRows).toHaveLength(20);
  await page.goto(explorer);
  await expect(page.getByRole('combobox', { name: 'NHHR-coded condition domain', exact: true })).toHaveValue(oncology);
  const state = page.getByTestId('atlas-map-state');
  await expect(state).toHaveAttribute('data-ready', 'true');
  await expect(state).toHaveAttribute('data-geometry', 'points');
  await expect(state).toHaveAttribute('data-feature-count', '25');
  await expect(state).toHaveAttribute('data-matched-count', '20');
  await expect(state).toHaveAttribute('data-rendered-features', '20');
  await expect(state).toHaveAttribute('data-basemap-status', 'ready');
  await expect(state).toHaveAttribute('data-raster-sources', '0');
  await expect(state).toHaveAttribute('data-map-aggregation', 'none');
  await expect(page.locator('.atlas-point-legend')).toContainText('full selected condition cohort');
  expect(Object.fromEntries((await points(state)).map(p => [p.code, p.value]))).toEqual(Object.fromEntries(expectedRows.map(r => [r.location_code, r.distinct_studies])));
  await page.getByRole('combobox', { name: 'Select map site', exact: true }).selectOption(vancouverCancer);
  await expect(page.locator('.atlas-map-detail')).toContainText('242');
  await expect(page.locator('.atlas-map-detail').getByRole('link', { name: 'Mapped point', exact: true })).toHaveAttribute('href', 'https://www.openstreetmap.org/way/88316971');
  await page.locator('.atlas-source-notes summary').click();
  await expect(page.locator('.atlas-source-notes')).toContainText('historical overall study status');
  await expect(page.locator('.atlas-source-notes')).toContainText('not verified local-site recruitment');
});

test('city and condition filters share exact map, chart, table, CSV and persistent denominator', async ({ page }) => {
  await page.goto(explorer);
  await page.getByRole('combobox', { name: 'Comparator city', exact: true }).selectOption('Vancouver');
  await page.getByTestId('metric-select').selectOption('condition_share_pct');
  const state = page.getByTestId('atlas-map-state');
  await expect(state).toHaveAttribute('data-matched-count', '4');
  await expect.poll(async () => (await points(state)).find(p => p.code === 'vancouver-cancer')?.value).toBe(97.975709);
  await page.getByTestId('entity-select').selectOption(vancouverCancer);
  await expect(state).toHaveAttribute('data-matched-count', '1');
  await expect.poll(async () => (await points(state))[0]?.value).toBe(97.975709);
  await page.getByRole('tab', { name: 'Chart', exact: true }).click();
  await expect(page.locator('.atlas-bar-row')).toHaveCount(1);
  await expect(page.locator('.atlas-bar-row')).toContainText('98%');
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.atlas-data-table tbody')).toContainText('247');
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'CSV', exact: true }).click();
  const csv = csvRecords(await readFile((await (await pending).path())!, 'utf8'));
  expect(csv).toHaveLength(1);
  expect(csv[0]).toMatchObject({ query_city: 'Vancouver', condition_domain: oncology, distinct_studies: '242', recruiting_snapshot_studies: '24', condition_share_pct: '97.975709', facility_studies: '247' });
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Comparator city', exact: true })).toHaveValue('Vancouver');
  await expect(page.getByTestId('entity-select')).toHaveValue(vancouverCancer);
  await expect(page.getByTestId('metric-select')).toHaveValue('condition_share_pct');
  await page.getByRole('combobox', { name: 'NHHR-coded condition domain', exact: true }).selectOption('');
  await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(2);
  for (const row of await page.locator('.atlas-data-table tbody tr').all()) await expect(row).toContainText('247');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'NHHR-coded condition domain', exact: true })).toHaveValue('');
  await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(2);
});

test('recruiting zeros remain real zero values and all-condition groups remain ambiguous', async ({ page }) => {
  await page.goto(`${explorer}&filter.query_city=Calgary&filter.condition_domain=Neurology%20%2F%20brain%20health&metric=recruiting_snapshot_studies&entity=${encodeURIComponent('Alberta Children’s Hospital')}`);
  const state = page.getByTestId('atlas-map-state');
  await expect(state).toHaveAttribute('data-ready', 'true');
  await expect.poll(async () => (await points(state))[0]?.value).toBe(0);
  expect((await points(state))[0].radius).toBe(0);
  await page.getByRole('combobox', { name: 'Select map site', exact: true }).selectOption('Alberta Children’s Hospital');
  await expect(page.locator('.atlas-map-detail')).toContainText('RECRUITING in aligned snapshot: 0');
  await page.goto(`${explorer}&filter.condition_domain=`);
  await expect(state).toHaveAttribute('data-ready', 'true');
  await expect(state).toHaveAttribute('data-map-aggregation', 'none');
  await expect(state).toHaveAttribute('data-matched-count', '4');
  await expect(state).toHaveAttribute('data-rendered-features', '25');
  await expect(page.locator('.atlas-map-join-note')).toContainText('167 ambiguous rows withheld');
  const actual = await points(state);
  expect(actual.filter(p => p.value === null)).toHaveLength(21);
  expect(actual.find(p => p.code === 'vancouver-cancer')?.value).toBeNull();
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  await expect(page.locator('.atlas-results-line')).toContainText('171 of 171');
});

test('city mapping coverage keeps unlocated and partly mapped studies visible', async ({ page }) => {
  await page.goto('dev/projects?view=explore&dataset=trial-facility-coverage&entity=Prince%20George');
  await page.getByRole('tab', { name: 'Chart', exact: true }).click();
  await expect(page.locator('.atlas-bar-label')).toHaveText('Prince George · 2026-04-29');
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  const table = page.locator('.atlas-data-table tbody');
  await expect(table.locator('tr')).toHaveCount(1);
  await expect(table).toContainText('90');
  const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'CSV', exact: true }).click();
  const records = csvRecords(await readFile((await (await downloading).path())!, 'utf8'));
  expect(records[0]).toMatchObject({ city_studies: '10', studies_with_verified_facility: '9', no_verified_facility_studies: '1', verified_facility_share_pct: '90', partly_located_studies: '0' });
  await page.getByRole('button', { name: 'Verified facility conditions', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Comparator city', exact: true })).toHaveValue('Prince George');
});

test('failed physical-location asset leaves original records and export usable', async ({ page }) => {
  await page.route('**/data/nhhr/locations-comparator-trial-sites.geojson', route => route.fulfill({ status: 503, body: 'Temporarily unavailable' }));
  await page.goto(`${explorer}&filter.query_city=Vancouver`);
  await expect(page.locator('.atlas-map-error')).toContainText('Boundary snapshot unavailable (503)');
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(4);
  await expect(page.locator('.atlas-data-table tbody')).toContainText('242');
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'CSV', exact: true }).click();
  expect(csvRecords(await readFile((await (await pending).path())!, 'utf8'))).toHaveLength(4);
});

test('guided and short stories open the exact facility and coverage source scope', async ({ page }) => {
  await page.goto('dev/projects/research-pathways#trial-conditions-at-facilities');
  await expect(page.getByTestId('story-evidence')).toHaveAttribute('data-dataset', 'trial-facility-conditions');
  await expect(page.getByTestId('atlas-map-state')).toHaveAttribute('data-matched-count', '4');
  await page.locator('.editorial-slide[data-active="true"]').getByRole('button', { name: 'Explore the source data' }).click();
  await expect(page.getByRole('combobox', { name: 'Comparator city', exact: true })).toHaveValue('Vancouver');
  await expect(page.getByRole('combobox', { name: 'NHHR-coded condition domain', exact: true })).toHaveValue(oncology);
  await page.goto('dev/projects/research-pathways#trial-facility-mapping-gaps');
  await expect(page.getByTestId('story-evidence')).toHaveAttribute('data-dataset', 'trial-facility-coverage');
  await page.locator('.editorial-slide[data-active="true"]').getByRole('button', { name: 'Explore the source data' }).click();
  await expect(page).toHaveURL(/dataset=trial-facility-coverage/);
  await page.goto('dev/projects/trial-conditions-at-facilities');
  await page.getByRole('button', { name: 'Explore this dataset', exact: true }).click();
  await expect(page).toHaveURL(/dataset=trial-facility-conditions/);
  await expect(page.getByRole('combobox', { name: 'NHHR-coded condition domain', exact: true })).toHaveValue(oncology);
});

test('linked condition views preserve both exact comparator cities without widening the cohort', async ({ page, request }) => {
  const { facilities } = await release(request);
  const cities = ['Vancouver', 'Thunder Bay'];
  const expected = facilities.rows.filter(row => cities.includes(String(row.query_city)) && row.condition_domain === oncology);
  expect(expected).toHaveLength(5);
  await page.goto('dev/projects?view=explore&dataset=clinical-condition-mix&entities=Vancouver&entities=Thunder%20Bay&filter.condition_domain=Cancer%20%2F%20oncology');
  await expect(page.locator('.atlas-results-line')).toContainText('2 of 77');
  await page.getByRole('button', { name: 'Verified facility conditions', exact: true }).click();
  await expect(page).toHaveURL(/dataset=trial-facility-conditions/);
  await expect(page.getByRole('combobox', { name: 'NHHR-coded condition domain', exact: true })).toHaveValue(oncology);
  await expect(page.getByTestId('atlas-map-state')).toHaveAttribute('data-matched-count', '5');
  const selected = new URL(page.url()).searchParams.getAll('entities');
  const selectedCities = [...new Set(facilities.rows.filter(row => selected.includes(String(row.facility_name))).map(row => row.query_city))].sort();
  expect(selectedCities).toEqual([...cities].sort());
  await expect.poll(async () => (await points(page.getByTestId('atlas-map-state'))).map(point => point.code).sort()).toEqual(expected.map(row => String(row.location_code)).sort());
  await page.getByRole('button', { name: 'Full city condition mix', exact: true }).click();
  await expect(page).toHaveURL(/dataset=clinical-condition-mix/);
  expect(new URL(page.url()).searchParams.getAll('entities').sort()).toEqual([...cities].sort());
  await expect(page.locator('.atlas-results-line')).toContainText('2 of 77');
});

test('Sources separates the NHHR Zoer catalogue from attributed publisher supplements', async ({ page, request }) => {
  const inventory = await (await request.get('data/nhhr/source-inventory.json')).json();
  const datasets: AtlasDataset[] = [];
  const review = await (await request.get('data/nhhr/catalogue-review.json')).json();
  for (const asset of review.releaseAssets) {
    datasets.push(...(await (await request.get(`data/nhhr/${asset}.json`)).json()).datasets);
  }
  const primaryDatasets = datasets.filter(dataset => dataset.sourceOrigin !== 'supplemental');
  const sourceIds = new Set(primaryDatasets.map(dataset => dataset.datasetId));
  const connected = inventory.collections.filter((collection: { datasetId: string }) => sourceIds.has(collection.datasetId));
  await page.goto('dev/projects?view=sources');
  const catalogue = page.getByRole('region', { name: 'NHHR Zoer datasets', exact: true });
  await expect(catalogue.getByRole('status')).toContainText(`Showing ${inventory.collections.length} of ${inventory.collections.length} NHHR collections`);
  expect(await catalogue.locator('tbody tr').evaluateAll(rows => rows.map(row => row.getAttribute('data-zoer-dataset')))).toEqual(inventory.collections.map((collection: { datasetId: string }) => collection.datasetId));
  await expect(page.getByRole('region', { name: 'PGMaps data audit', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'PGMaps data and mapping gaps.', exact: true })).toHaveCount(0);
  await expect(catalogue).not.toContainText('DATA-P01');
  const supplements = page.getByRole('region', { name: 'Verified source supplements', exact: true });
  await expect(supplements.locator('tbody tr')).toHaveCount(datasets.length - primaryDatasets.length);
  await expect(supplements).toContainText('separate from the 85 NHHR Zoer catalogue entries');
  await catalogue.getByRole('combobox', { name: 'Explorer connection', exact: true }).selectOption('connected');
  await expect(catalogue.locator('tbody tr')).toHaveCount(connected.length);
  await expect(catalogue.locator('tbody button')).toHaveCount(primaryDatasets.length);
  await catalogue.getByRole('combobox', { name: 'Explorer connection', exact: true }).selectOption('catalogue');
  await expect(catalogue.locator('tbody tr')).toHaveCount(inventory.collections.length - connected.length);
  await expect(catalogue.locator('tbody button')).toHaveCount(0);
  await catalogue.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(catalogue.locator('tbody tr')).toHaveCount(inventory.collections.length);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('NHHR catalogue search retains restricted boundaries and opens the reviewed source data', async ({ page, request }) => {
  const review = await (await request.get('data/nhhr/catalogue-review.json')).json();
  expect(review.releaseAssets).toContain('trial-facility-conditions');
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('dev/projects?view=sources');
  const catalogue = page.getByRole('region', { name: 'NHHR Zoer datasets', exact: true });
  await expect(page.getByRole('heading', { name: 'Sources and methods', exact: true })).toBeVisible();
  await expect(page.getByRole('banner')).toContainText(/Northern Hub for\s*Health Research/);
  await expect(page.getByRole('banner').getByRole('link', { name: /University of Northern British Columbia/ })).toBeVisible();
  const search = catalogue.getByRole('searchbox', { name: 'Search NHHR datasets', exact: true });
  await search.fill('DATA-C010');
  await expect(catalogue.locator('tbody tr')).toHaveCount(1);
  await expect(catalogue.getByRole('link', { name: 'Zoer dataset details', exact: true })).toHaveAttribute('href', 'https://zoer.k8s.overtheedgepaper.ca/api/datasets/d85b189f-9d24-421c-883c-6b759f081900');
  await search.fill('DATA-C037');
  await expect(catalogue.locator('tbody tr')).toHaveCount(1);
  await expect(catalogue.locator('tbody tr')).toContainText('Restricted source package');
  await expect(catalogue.locator('tbody tr').getByRole('link', { name: 'Zoer dataset details', exact: true })).toHaveCount(0);
  await expect(catalogue).toContainText('separately reviewed extracts');
  await search.fill('no-such-nhhr-dataset');
  await expect(catalogue.getByText('No NHHR datasets match these filters.', { exact: true })).toBeVisible();
  await catalogue.getByRole('button', { name: 'Clear filters', exact: true }).click();
  const download = catalogue.getByRole('link', { name: 'Download NHHR catalogue metadata', exact: true });
  await expect(download).toHaveAttribute('download', '');
  const metadata = await request.get((await download.getAttribute('href'))!);
  expect(metadata.ok()).toBe(true);
  expect((await metadata.json()).collections.length).toBe(review.collectionCount);
  const facility = (await release(request)).facilities;
  await search.fill('DATA-C037');
  await catalogue.getByRole('button', { name: facility.title, exact: true }).click();
  await expect(page).toHaveURL(/dataset=trial-facility-conditions/);
  await expect(page.getByTestId('atlas-map-state')).toHaveAttribute('data-matched-count', '20');
  expect(errors).toEqual([]);
});
