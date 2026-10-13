import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { AtlasDataset } from '../src/atlas/types';
import { mockBasemaps } from './basemap-fixtures';

const explorer = 'dev/projects?view=explore&dataset=';
const uhn = 'University Hospital of Northern British Columbia';
type Point = { geometry: { type: string; coordinates: number[] }; properties: { code: string; coordinate_source_url: string; location_note: string; province?: string } };
test.beforeEach(async ({ page }) => { await mockBasemaps(page); });
async function source(request: APIRequestContext) {
  const response = await request.get('data/nhhr/facility-followup.json');
  expect(response.ok()).toBe(true);
  const release = await response.json() as { datasets: AtlasDataset[] };
  return Object.fromEntries(release.datasets.map(d => [d.id, d]));
}
async function csv(page: Page) {
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV', exact: true }).click();
  const path = await (await downloading).path();
  expect(path).toBeTruthy();
  return readFile(path!, 'utf8');
}

test('facility source receipts reconcile directory identity, all original capital cells and source missingness', async ({ request }) => {
  const ds = await source(request);
  expect(Object.keys(ds).sort()).toEqual(['healthlink-hospital-additions', 'northern-capital-projects', 'northern-capital-site-context']);
  expect(await readFile('src/atlas/snapshots/facility-followup.json', 'utf8')).toBe(await readFile('public/data/nhhr/facility-followup.json', 'utf8'));
  const p = await (await request.get('data/nhhr/facility-followup-provenance.json')).json();
  expect(p.sources.map((s: { originalFileId: string; sha256: string }) => [s.originalFileId, s.sha256])).toEqual([
    ['89e04ea4-d6e2-4c89-854d-c1b651141db1', '47cd7ddd4a622effe834243970934c2647203387edf248c1d8c31650d7bbab12'],
    ['36c19768-b125-4743-b8eb-4c2884fa731a', '5b25041cdbea7d2c3c5ad60a374e6f81f040e0330020dd1408bcac726ff785c1'],
    ['2e3464d4-32c3-426c-aa68-861070b0ea98', 'e43e7fb97e6b8643d53bbaae7c02b967ba6996236a88136ddb8b365adecdc4a3'],
  ]);
  expect(p.primaryReports.map((r: { sha256: string }) => r.sha256)).toEqual(['f8335686a4455462779f95aa1b26a14eba2decdaf995a671e89fe8d7d2448bf0', 'edb1ad637b8bdfcab3ba48309b43fb5bdf792ea1ea60e0a456e035e3050f99cc']);
  expect(p.coverage).toMatchObject({ sourceDirectoryRows: 91, sourceDirectoryServiceIds: 81, existingSourceRows: 82, existingPhysicalSites: 79, additionRows: 9, verifiedAdditions: 8, unlocatedAdditions: 1, capitalRows: 64, capitalReportCounts: { '2020-2022': 30, '2022-2024': 34 }, locatedCapitalRows: 60, unlocatedCapitalRows: 4 });
  expect(p.coverage.existingMatches).toHaveLength(82);
  const directory = ds['healthlink-hospital-additions'];
  expect(directory.datasetId).toBe('91de0066-9343-4d0f-9138-03766520ddc0');
  expect(directory.rows).toHaveLength(9);
  expect(new Set(directory.rows.map(r => r.source_location_id)).size).toBe(9);
  expect(directory.rows.every(r => r.site_count === 1)).toBe(true);
  expect(directory.rows.find(r => r.facility_name === 'Dr. Al Hogg Pavilion')).toMatchObject({ location_code: null, site_count: 1, location_status: 'Building coordinate unresolved' });
  expect(directory.rows.find(r => r.location_code === 'facility-followup-whitehorse-general')).toMatchObject({ province: 'YT', city: 'Whitehorse' });
  expect(directory.rows.every(r => Object.keys(r).every(key => !/phone|email|contact/i.test(key)))).toBe(true);
  const projects = ds['northern-capital-projects'];
  expect(projects.datasetId).toBe('7a0b8ced-71ed-4e8a-aea2-37030adec6a2');
  expect(projects.geography).toBe('none');
  expect(projects.rows).toHaveLength(64);
  expect(new Set(projects.rows.map(r => r.project_id)).size).toBe(64);
  expect(projects.columns.find(c => c.key === 'project_value')?.unit).toBe('CAD nominal');
  expect(projects.columns.find(c => c.key === 'district_funding')?.unit).toBe('CAD nominal');
  // Independent oracle from all 64 reviewed original PDF cells, not a replay of
  // the generic CSV extractor. Covers both dollar columns, periods, printed
  // table positions, source dashes and publisher funder codes.
  const tuples = projects.rows.map(r => [r.report_period, r.source_page, r.source_pdf_table, r.source_table_row, r.project_value, r.district_funding, r.funder_code]);
  expect(createHash('sha256').update(JSON.stringify(tuples)).digest('hex')).toBe('f223b4d1352fef282557db78dcb3435e0201de9612ea911eb485e0954594d033');
  const missing = projects.rows.filter(r => r.district_funding === null);
  expect(missing).toHaveLength(7);
  expect(missing.every(r => ['-', '$-', '$ -'].includes(String(r.district_funding_raw)) && r.funding_status === 'Source dash; amount not reported')).toBe(true);
  expect(projects.rows.filter(r => r.facility_name === 'Fort St. John Hospital' && r.report_period === '2022-2024').map(r => r.funder_code)).toEqual(Array(5).fill('SNRHD'));
  const anesthesia = projects.rows.filter(r => /Anesthesia units x3/i.test(String(r.project_name)));
  expect(anesthesia).toHaveLength(1);
  expect(anesthesia[0]).toMatchObject({ project_value: 407479, district_funding: 143600 });
  const groups = ds['northern-capital-site-context'];
  expect(groups.rows).toHaveLength(27);
  expect(groups.rows.reduce((sum, r) => sum + Number(r.reported_projects), 0)).toBe(64);
  expect(groups.mapAggregation).toBeUndefined();
  expect(groups.rows.find(r => r.facility_name === uhn && r.report_period === '2022-2024')?.reported_projects).toBe(11);
  expect(groups.rows.find(r => r.facility_name === uhn && r.report_period === '2020-2022')?.reported_projects).toBe(5);
  expect(groups.columns.filter(c => c.type === 'number').some(c => /CAD/.test(c.unit ?? ''))).toBe(false);
});

test('reviewed geometry preserves eight new buildings and eleven unchanged current facility references', async ({ request }) => {
  const geometry = await (await request.get('data/nhhr/locations-facility-followup.geojson')).json() as { features: Point[] };
  const baseline = await (await request.get('data/nhhr/locations-hospitals.geojson')).json() as { features: Point[] };
  expect(geometry.features).toHaveLength(25);
  expect(new Set(geometry.features.map(f => f.properties.code)).size).toBe(25);
  expect(geometry.features.every(f => f.geometry.type === 'Point')).toBe(true);
  const reused = geometry.features.filter(f => f.properties.code.startsWith('hospital-'));
  expect(reused).toHaveLength(11);
  for (const feature of reused) expect(feature.geometry.coordinates).toEqual(baseline.features.find(f => f.properties.code === feature.properties.code)!.geometry.coordinates);
  const exactPoints: Record<string, [number, number]> = {
    'facility-followup-vgh-blackmore': [-123.1229419, 49.2611648], 'facility-followup-vgh-banfield': [-123.1184615, 49.2611517],
    'facility-followup-vgh-diamond': [-123.1260002, 49.2611461], 'facility-followup-vgh-willow': [-123.1223110, 49.2610005],
    'facility-followup-ubc-detwiller': [-123.2441555, 49.2635731], 'facility-followup-ubc-purdy': [-123.2458694, 49.2632866],
    'facility-followup-whitehorse-general': [-135.0437694, 60.7181137], 'facility-followup-holy-family': [-123.0730841, 49.2128237],
  };
  expect(geometry.features.filter(f => f.properties.code.startsWith('facility-followup-'))).toHaveLength(8);
  for (const [code, coordinates] of Object.entries(exactPoints)) {
    const feature = geometry.features.find(f => f.properties.code === code)!;
    expect(feature.geometry.coordinates).toEqual(coordinates);
    expect(feature.properties.coordinate_source_url).toMatch(/^https:\/\/www.openstreetmap.org\/(way|node)\/\d+$/);
    expect(baseline.features.some(f => f.properties.code === code)).toBe(false);
  }
  expect(geometry.features.some(f => /hogg/i.test(f.properties.code))).toBe(false);
  expect(geometry.features.find(f => f.properties.code === 'facility-followup-vgh-blackmore')!.properties.location_note).toContain('conflicts with the operator');
});


test('recovered parcels preserve source-period addresses and keep replacement targets distinct', async ({ request }) => {
  const ds = await source(request);
  const release = await (await request.get('data/nhhr/facility-location-gap-review.json')).json();
  expect(release.verifiedCapitalLocations).toHaveLength(6);
  expect(release.remaining).toHaveLength(11);
  const geometry = await (await request.get('data/nhhr/locations-facility-followup.geojson')).json() as { features: Point[] };
  const exact: Record<string, [number, number]> = {
    'capital-context-gateway': [-122.7534096, 53.905646],
    'capital-context-houston': [-126.6524369, 54.3961409],
    'capital-context-rotary': [-120.2357358, 55.77296],
    'capital-context-tumbler': [-121.0001636, 55.1244002],
    'capital-context-stikine-historical': [-129.9920508, 58.4417797],
    'capital-context-mills-historical': [-128.5961926, 54.5113996],
  };
  const parcels = geometry.features.filter(f => f.properties.code.startsWith('capital-context-'));
  expect(parcels).toHaveLength(6);
  for (const site of release.verifiedCapitalLocations) {
    expect(site.matchPrecision).toBe('CIVIC_NUMBER');
    expect(site.score).toBeGreaterThanOrEqual(99);
    expect(site.siteId).toMatch(/^[0-9a-f-]{36}$/);
    expect(site.locationPrecision).toContain('not a building centroid');
    expect(site.coordinateBaseDataDate).toBe('2026-07-07T20:10:43Z');
    expect(site.coordinateSourceUrl).toMatch(/^https:\/\/geocoder.api.gov.bc.ca\/addresses.geojson\?/);
    expect(geometry.features.find(f => f.properties.code === site.code)!.geometry.coordinates).toEqual(exact[site.code]);
  }
  const projects = ds['northern-capital-projects'].rows;
  const historic = projects.filter(r => r.location_code === 'capital-context-mills-historical');
  expect(historic).toHaveLength(2);
  expect(historic.every(r => r.report_period === '2020-2022' && r.source_address === '4720 Haugland Avenue' && r.location_status === 'Historical address parcel')).toBe(true);
  expect(historic.every(r => String(r.facility_name).includes('historical address parcel') && r.original_facility_name === 'Mills Memorial Hospital')).toBe(true);
  expect(historic.map(r => r.project_value)).toEqual([256000, 256000]);
  const replacement = projects.filter(r => r.project_name === 'Hospital Replacement');
  expect(replacement).toHaveLength(3);
  expect(replacement.every(r => r.location_code === null && r.location_precision === null)).toBe(true);
  expect(projects.filter(r => !r.location_code).map(r => r.project_id)).toEqual([
    'nh-capital-2020-2022-p50-t1-r1', 'nh-capital-2020-2022-p50-t1-r7',
    'nh-capital-2020-2022-p50-t1-r11', 'nh-capital-2020-2022-p50-t1-r15',
  ]);
  const stikine = projects.find(r => r.location_code === 'capital-context-stikine-historical')!;
  expect(stikine).toMatchObject({ report_period: '2020-2022', source_address: '7171 Highway 37', project_name: 'X-Ray Machine Replacement' });
  expect(stikine.location_note).toContain('BLOCK-only result is rejected');
  const groups = ds['northern-capital-site-context'].rows;
  expect(groups.filter(r => r.report_period === '2022-2024')).toHaveLength(10);
  expect(groups.filter(r => r.report_period === '2022-2024').every(r => r.location_code)).toBe(true);
  expect(groups.filter(r => r.report_period === '2020-2022' && r.location_code)).toHaveLength(13);
});

test('directory additions map real points while retaining the unresolved entry in the same table and export', async ({ page }) => {
  await page.goto(explorer + 'healthlink-hospital-additions');
  const state = page.getByTestId('atlas-map-state');
  await expect(state).toHaveAttribute('data-ready', 'true');
  await expect(state).toHaveAttribute('data-feature-count', '25');
  await expect(state).toHaveAttribute('data-matched-count', '8');
  await expect(state).toHaveAttribute('data-rendered-features', '8');
  await expect(state).toHaveAttribute('data-geometry', 'points');
  await expect(state).toHaveAttribute('data-basemap-format', 'vector');
  await expect(state).toHaveAttribute('data-raster-sources', '0');
  await expect(page.locator('.atlas-map-join-note')).toContainText('1 unmatched rows');
  await page.getByTestId('entity-select').selectOption('Dr. Al Hogg Pavilion');
  await expect(state).toHaveAttribute('data-matched-count', '0');
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.atlas-data-table tbody')).toContainText('Building coordinate unresolved');
  const text = await csv(page);
  expect(text).toContain('Dr. Al Hogg Pavilion');
  expect(text).toContain('17644873');
  expect(text).not.toContain('facility-followup-vgh-blackmore');
  await page.locator('.atlas-source-notes summary').click();
  await expect(page.locator('.atlas-source-notes')).toContainText('newly released entries, not newly opened hospitals');
  await expect(page.locator('.atlas-source-notes')).toContainText('not beds');
});

test('capital project tables and CSV retain complete labels, original units and one exact published row', async ({ page }) => {
  const ds = JSON.parse(await readFile('src/atlas/snapshots/facility-followup.json', 'utf8')).datasets as AtlasDataset[];
  const projects = ds.find(d => d.id === 'northern-capital-projects')!;
  const chemistry = projects.rows.find(r => r.project_name === 'Chemistry automation')!;
  expect(chemistry).toBeTruthy();
  await page.goto(explorer + 'northern-capital-projects');
  await expect(page.getByRole('tab', { name: 'Table', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Map', exact: true })).toBeDisabled();
  await page.getByTestId('year-select').selectOption('2022-2024');
  await page.getByTestId('entity-select').selectOption(String(chemistry.project_label));
  await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.atlas-data-table tbody')).toContainText('Chemistry automation');
  const text = await csv(page);
  expect(text.split(/\r?\n/)).toHaveLength(2);
  expect(text).toContain('"9608000"');
  expect(text).toContain('"3843200"');
  expect(text).toContain('"52"');
  expect(text).toContain('"2022-2024"');
  await page.getByRole('tab', { name: 'Chart', exact: true }).click();
  await expect(page.locator('.atlas-results-line')).toContainText('CAD nominal');
  await page.locator('.atlas-source-notes summary').click();
  await expect(page.locator('.atlas-source-notes')).toContainText('not annual spending');
  await expect(page.locator('.atlas-source-notes')).toContainText('omits 18 printed projects');
  await page.reload();
  await expect(page.getByTestId('year-select')).toHaveValue('2022-2024');
  await expect(page.getByTestId('entity-select')).toHaveValue(String(chemistry.project_label));
});

test('capital map counts printed rows within one interval and withholds repeated-site periods', async ({ page }) => {
  await page.goto(explorer + 'northern-capital-site-context');
  const state = page.getByTestId('atlas-map-state');
  await expect(state).toHaveAttribute('data-ready', 'true');
  await expect(page.getByTestId('year-select')).toHaveValue('2022-2024');
  await expect(state).toHaveAttribute('data-matched-count', '10');
  await expect(page.locator('.atlas-map-join-note')).toContainText('0 unmatched rows');
  const selection = page.getByRole('combobox', { name: 'Select map site', exact: true });
  await selection.selectOption(uhn);
  await expect(page.locator('.atlas-map-detail')).toContainText('11 reported projects');
  await expect(page.locator('.atlas-map-detail')).toContainText('historical capital reporting context, not historical asset positioning');
  await page.getByTestId('year-select').selectOption('2020-2022');
  await selection.selectOption(uhn);
  await expect(page.locator('.atlas-map-detail')).toContainText('5 reported projects');
  await page.getByTestId('year-select').selectOption('');
  await expect(state).toHaveAttribute('data-matched-count', '11');
  await expect(page.locator('.atlas-map-join-note')).toContainText('12 ambiguous rows withheld');
  await expect(page.locator('.atlas-map-join-note')).toContainText('4 unmatched rows');
  await selection.selectOption(uhn);
  await expect(page.locator('.atlas-map-detail')).toContainText('Multiple observations');
  await expect(page.locator('.atlas-map-detail')).not.toContainText('16 reported projects');
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(25);
  await expect(page.locator('.atlas-pagination')).toContainText('1–25 of 27 records');
  await expect(page.locator('.atlas-data-table tbody')).toContainText('Unlocated historical/project record');
  await page.getByRole('button', { name: 'Next table page', exact: true }).click();
  await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(2);
});

test('historical Mills map detail identifies a parcel reference and preserves two original equipment rows', async ({ page }) => {
  await page.goto(explorer + 'northern-capital-site-context&year=2020-2022');
  const state = page.getByTestId('atlas-map-state');
  await expect(state).toHaveAttribute('data-ready', 'true');
  await expect(state).toHaveAttribute('data-matched-count', '13');
  const historic = 'Mills Memorial Hospital — historical address parcel';
  await page.getByRole('combobox', { name: 'Select map site', exact: true }).selectOption(historic);
  const detail = page.locator('.atlas-map-detail');
  await expect(detail).toContainText('2 reported projects');
  await expect(detail).toContainText('4720 Haugland Avenue');
  await expect(detail).toContainText('not a building centroid');
  await expect(detail).toContainText('not historical parcel geometry');
  await expect(detail.getByRole('link', { name: 'Mapped point', exact: true })).toHaveAttribute('href', /^https:\/\/geocoder.api.gov.bc.ca\/addresses.geojson\?/);
  const values = JSON.parse(await state.getAttribute('data-rendered-points') || '[]') as { code: string; value: number }[];
  expect(values.find(p => p.code === 'capital-context-mills-historical')?.value).toBe(2);
  expect(values.some(p => p.code === 'hospital-ksyen-regional-hospital')).toBe(false);
  await page.getByTestId('entity-select').selectOption(historic);
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.atlas-data-table tbody')).toContainText('Historical address parcel');
  const text = await csv(page);
  expect(text).toContain('nh-capital-2020-2022-p49-t1-r1;nh-capital-2020-2022-p49-t1-r2');
  expect(text).not.toContain('nh-capital-2020-2022-p50-t1-r7');
});

test('facility map failure retains the source records, export and UNBC shell', async ({ page }) => {
  await page.route('**/locations-facility-followup.geojson', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(explorer + 'northern-capital-site-context');
  await expect(page.getByTestId('atlas-map-state')).toHaveAttribute('data-ready', 'false');
  await expect(page.locator('.atlas-map-error')).toBeVisible();
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(10);
  const text = await csv(page);
  expect(text.split(/\r?\n/)).toHaveLength(11);
  expect(text).toContain('Houston Health Centre');
  await expect(page.locator('.unbc-logo--header text')).toHaveText(['Northern Hub for', 'Health Research']);
  expect(errors).toEqual([]);
});
