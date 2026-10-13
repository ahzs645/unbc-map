import { test, expect, type APIRequestContext } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { AtlasDataset, AtlasRow } from '../src/atlas/types';
import { mockBasemaps } from './basemap-fixtures';

const explorer = 'dev/projects?view=explore&dataset=';
const pgCensus = 'Prince George, City (CY)';
const healthIndustry = 'Health care and social assistance [62]';
const nursingOccupation = 'Nursing and allied health professionals [313]';
const combined = 'North Coast and Nechako, British Columbia';
const sha = (text: string | Buffer) => createHash('sha256').update(text).digest('hex');
const digest = (value: unknown) => sha(JSON.stringify(value));

test.beforeEach(async ({ page }) => { await mockBasemaps(page); });
async function release(request: APIRequestContext) {
  const response = await request.get('data/nhhr/regional-expansion.json');
  expect(response.ok()).toBe(true);
  const data = await response.json() as { datasets: AtlasDataset[] };
  return Object.fromEntries(data.datasets.map(dataset => [dataset.id, dataset]));
}
function numeric(dataset: AtlasDataset, key: string) { return dataset.columns.find(column => column.key === key); }

// This small reader preserves source commas, quoted labels, blanks and null CSV cells.
function csvRecords(text: string): Record<string, string>[] {
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

test('all 20 reviews, source identities, independent Census cells and distinct dollar bases reconcile', async ({ request }) => {
  const datasets = await release(request);
  expect(Object.keys(datasets)).toHaveLength(18);
  expect(Object.values(datasets).reduce((sum, dataset) => sum + dataset.rows.length, 0)).toBe(755);
  expect(await readFile('src/atlas/snapshots/regional-expansion.json', 'utf8')).toBe(await readFile('public/data/nhhr/regional-expansion.json', 'utf8'));
  const provenance = await (await request.get('data/nhhr/regional-expansion-provenance.json')).json();
  expect(provenance.sources).toHaveLength(42);
  expect(new Set(provenance.sources.map((source: { datasetId: string }) => source.datasetId)).size).toBe(20);
  expect(provenance.multipartParts).toHaveLength(27);
  const censusSource = provenance.sources.find((source: { collectionId: string }) => source.collectionId === 'DATA-C058-04');
  expect(censusSource.sha256).toBe('d7f2543186935ca7d9f5a8a21ecf2084d75ccce9d15ef3cd09ce1d237c383e03');
  expect(provenance.inspections['DATA-C058-04/98-401-X2021005_English_CSV_data.csv']).toMatchObject({ originalDataRows: 14386308, nativeCdCount: 29, nativeCsdCount: 7 });
  expect(provenance.views['bc-housing-starts'].worksheet).toEqual(['Table 1', 'Table 2']);
  expect(provenance.views['bc-housing-benchmarks'].worksheet).toEqual(['BRITISH_COLUMBIA', 'INTERIOR_BC']);
  const report = JSON.parse(await readFile('docs/nhhr-regional-catalogue-review.json', 'utf8'));
  expect(report.reviews).toHaveLength(20);
  expect(report.reviews.filter((review: { status: string }) => review.status === 'connected')).toHaveLength(17);
  expect(report.reviews.find((review: { collectionId: string }) => review.collectionId === 'DATA-C031')).toMatchObject({ status: 'blocked', views: [] });
  expect(report.reviews.find((review: { collectionId: string }) => review.collectionId === 'DATA-C075')).toMatchObject({ status: 'supporting', views: [] });
  for (const review of report.reviews) {
    expect(review.evidence[0]).toMatchObject({ kind: 'dataset-api', httpStatus: 200, datasetId: review.datasetId });
    expect(review.evidence.some((evidence: { kind: string; sha256: string }) => evidence.kind === 'original-source' && /^[a-f0-9]{64}$/.test(evidence.sha256))).toBe(true);
  }
  // Fixed oracle independently read from the original Windows-1252 Census CSV,
  // across all 36 areas and 11 published characteristics; not from release code.
  const cells: unknown[][] = [];
  for (const dataset of [datasets['census-housing-cd'], datasets['census-housing-csd']]) {
    for (const row of dataset.rows) for (const key of Object.keys(row).filter(key => key.endsWith('_source_characteristic'))) {
      const metric = key.replace('_source_characteristic', '');
      cells.push([row.source_dguid, row[key], row[metric]]);
    }
  }
  cells.sort((a, b) => String(a[0]) < String(b[0]) ? -1 : String(a[0]) > String(b[0]) ? 1 : String(a[1]) < String(b[1]) ? -1 : String(a[1]) > String(b[1]) ? 1 : 0);
  expect(cells).toHaveLength(396);
  expect(digest(cells)).toBe('e16a396b02d732a4b000360969c6bd5fb56e275b92f9a504329c23dcdab85fa9');
  const pg = datasets['census-housing-csd'].rows.find(row => row.csd_code === '5953023')!;
  expect(pg).toMatchObject({ tenant_core_need_pct: 17, owner_core_need_pct: 2.5, median_household_income_2020: 88000, income_reference_year: '2020', source_total_nonresponse_long_pct: 5.1, source_data_quality_flag: '00000' });
  expect(numeric(datasets['regional-employment-annual'], 'employment_thousands')?.unit).toBe('thousand people');
  expect(numeric(datasets['bc-hourly-wages'], 'hourly_wage')?.unit).toBe('CAD/hour nominal');
  expect(numeric(datasets['bc-graduate-income'], 'median_employment_income')?.unit).toBe('CAD 2022 constant');
  expect(numeric(datasets['vancouver-construction-index'], 'price_index')?.unit).toBe('index 2017=100');
  expect(datasets['bc-interprovincial-migration'].rows.at(-1)).toMatchObject({ period: '2024/2025', in_migrants: 48027, out_migrants: 50419, net_migration: -2392 });
  expect(datasets['municipal-business-locations'].rows).toHaveLength(19); // absent combinations remain absent
  expect(new Set(datasets['municipal-business-locations'].rows.map(row => row.period))).toEqual(new Set(['2025-07']));
  expect(new Set(datasets['bc-business-locations'].rows.map(row => row.period))).toEqual(new Set(['2025-01']));
});

test('native boundary receipts retain source IDs, valid polygons and every released exact-code join', async ({ request }) => {
  const datasets = await release(request);
  const provenance = await (await request.get('data/nhhr/regional-boundaries-provenance.json')).json();
  const index = JSON.parse(await readFile('src/atlas/regionalBoundaryIndex.json', 'utf8'));
  expect(index.cd).toHaveLength(29); expect(index.csd).toHaveLength(7); expect(index.er).toHaveLength(8);
  const locks = { cd: '4006a04102b3be2c74264334dcbfd1ea2bc39f81bc986f2e7ee37d189591b86b', csd: 'aa0e85e0e1f452bdfd518183793c3161919e703da481e1567092793c7dbb50a6', er: 'feb193fbc3d06e421a331f80eccde1dc0a2ed5e67e4184c6b947ab88bd4b709f' };
  for (const level of ['cd', 'csd', 'er'] as const) {
    const response = await request.get(`data/nhhr/boundaries-${level}.geojson`);
    const text = await response.text(); const geojson = JSON.parse(text);
    const receipt = provenance.boundaries.find((boundary: { level: string }) => boundary.level === level);
    expect(receipt).toMatchObject({ sourceSha256: locks[level], censusYear: 2021, licence: 'Statistics Canada Open Licence' });
    expect(sha(text)).toBe(receipt.sha256);
    expect(geojson.features.map((feature: { properties: { code: string } }) => feature.properties.code).sort()).toEqual(index[level]);
    for (const feature of geojson.features) {
      expect(['Polygon', 'MultiPolygon']).toContain(feature.geometry.type);
      expect(feature.properties.DGUID).toBe(`${level === 'er' ? '2021S0500' : level === 'cd' ? '2021A0003' : '2021A0005'}${feature.properties.code}`);
    }
    for (const dataset of Object.values(datasets).filter(dataset => dataset.geography === level)) {
      const sourceCodes = dataset.rows.map(row => row[`${level}_code`]).filter(code => code !== null);
      expect(sourceCodes.every(code => index[level].includes(code))).toBe(true);
    }
  }
  for (const dataset of [datasets['regional-employment-annual'], datasets['regional-labour-monthly']]) {
    const rows = dataset.rows.filter(row => row.region_name === combined);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(row => row.er_code === null && row.source_dguid === '')).toBe(true);
  }
  expect(datasets['regional-labour-archived'].geography).toBe('none');
  expect(datasets['regional-labour-archived'].rows).toHaveLength(15);
});

test('Census percentages use real CSD polygons and identical selected table/CSV source values', async ({ page }) => {
  await page.goto(`${explorer}census-housing-csd`);
  const state = page.getByTestId('atlas-map-state');
  await expect(state).toHaveAttribute('data-ready', 'true');
  await expect(state).toHaveAttribute('data-feature-count', '7');
  await expect(state).toHaveAttribute('data-matched-count', '7');
  await expect(state).toHaveAttribute('data-rendered-features', /^[1-9]\d*$/);
  await expect(state).toHaveAttribute('data-raster-sources', '0');
  await expect(state).toHaveAttribute('data-basemap-status', 'ready');
  await expect(page.getByRole('link', { name: 'Boundary provenance', exact: true })).toHaveAttribute('href', /regional-boundaries-provenance\.json$/);
  await page.getByRole('combobox', { name: 'Select map region', exact: true }).selectOption(pgCensus);
  await expect(page.locator('.atlas-map-detail')).toContainText('17%');
  await page.getByTestId('metric-select').selectOption('owner_core_need_pct');
  await expect(page.locator('.atlas-map-detail')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Select map region', exact: true }).selectOption(pgCensus);
  await expect(page.locator('.atlas-map-detail')).toContainText('2.5%');
  await page.getByTestId('entity-select').selectOption(pgCensus);
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(1);
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'CSV', exact: true }).click();
  const records = csvRecords(await readFile((await (await pending).path())!, 'utf8'));
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({ csd_code: '5953023', year: '2021', income_reference_year: '2020', tenant_core_need_pct: '17', owner_core_need_pct: '2.5', median_household_income_2020: '88000', source_data_quality_flag: '00000' });
  await page.reload();
  await expect(page.getByTestId('entity-select')).toHaveValue(pgCensus);
  await page.locator('.atlas-source-notes summary').click();
  await expect(page.locator('.atlas-source-notes')).toContainText('separate denominators');
  await expect(page.locator('.atlas-source-notes')).toContainText('Income refers to 2020');
});

test('annual ER industry, suppressed occupations and combined area never become additive map values', async ({ page }) => {
  await page.goto(`${explorer}regional-employment-annual`);
  const state = page.getByTestId('atlas-map-state');
  const group = page.getByRole('combobox', { name: 'Source industry / occupation', exact: true });
  await expect(group).toHaveValue(healthIndustry);
  await expect(page.getByTestId('year-select')).toHaveValue('2025');
  await expect(state).toHaveAttribute('data-ready', 'true');
  await expect(state).toHaveAttribute('data-feature-count', '7');
  await expect(state).toHaveAttribute('data-matched-count', '7');
  await expect(page.locator('.atlas-map-join-note')).toContainText('0 unmatched rows');
  await page.getByRole('combobox', { name: 'Select map region', exact: true }).selectOption('Cariboo, British Columbia');
  await expect(page.locator('.atlas-map-detail')).toContainText('13.6 thousand people');
  await group.selectOption(nursingOccupation);
  await expect(page.locator('.atlas-map-join-note')).toContainText('2 missing values');
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(7);
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'CSV', exact: true }).click();
  const csv = csvRecords(await readFile((await (await pending).path())!, 'utf8'));
  expect(csv.find(row => row.region_name === combined)).toMatchObject({ employment_thousands: '', er_code: '', source_status: 'x' });
  expect(csv.find(row => row.region_name === 'Northeast, British Columbia')).toMatchObject({ employment_thousands: '', er_code: '5980', source_status: 'x' });
  expect(csv.find(row => row.region_name === 'Cariboo, British Columbia')?.employment_thousands).toBe('1.8');
  await group.selectOption('');
  await page.getByRole('tab', { name: 'Map', exact: true }).click();
  await expect(state).toHaveAttribute('data-matched-count', '0');
  await expect(page.locator('.atlas-map-join-note')).toContainText('21 ambiguous rows withheld');
  await expect(page.locator('.atlas-map-join-note')).toContainText('0 unmatched rows');
  await expect(state).toHaveAttribute('data-map-aggregation', 'none');
});

test('municipality population uses its own denominator and withholds all-year ambiguity', async ({ page }) => {
  await page.goto(`${explorer}municipal-population`);
  await expect(page.getByTestId('year-select')).toHaveValue('2025');
  const state = page.getByTestId('atlas-map-state');
  await expect(state).toHaveAttribute('data-matched-count', '7');
  await page.getByRole('combobox', { name: 'Select map region', exact: true }).selectOption('Prince George');
  await expect(page.locator('.atlas-map-detail')).toContainText('85,944');
  await page.locator('.atlas-source-notes summary').click();
  await expect(page.locator('.atlas-source-notes')).toContainText('historical boundaries have not been harmonized');
  await expect(page.locator('.atlas-source-notes')).toContainText('105,544');
  await page.getByTestId('year-select').selectOption('');
  await expect(state).toHaveAttribute('data-matched-count', '0');
  await expect(page.locator('.atlas-map-join-note')).toContainText('105 ambiguous rows withheld');
  await expect(page.locator('.atlas-map-detail')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Select map region', exact: true }).selectOption('Prince George');
  await expect(page.locator('.atlas-map-detail')).toContainText('Multiple observations');
});

test('provincial cohort and hourly-wage charts retain their units and have no invented spatial join', async ({ page }) => {
  await page.goto(`${explorer}bc-graduate-income`);
  const outcome = page.getByRole('combobox', { name: 'Years after graduation', exact: true });
  await expect(outcome).toHaveValue('Median employment income five years after graduation');
  await expect(page.getByRole('tab', { name: 'Map', exact: true })).toBeDisabled();
  await expect(page.locator('.atlas-chart')).toContainText('CAD 2022 constant');
  await page.getByTestId('entity-select').selectOption('Undergraduate degree');
  await page.getByTestId('year-select').selectOption('2017');
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.atlas-data-table tbody')).toContainText('65,600');
  await page.locator('.atlas-source-notes summary').click();
  await expect(page.locator('.atlas-source-notes')).toContainText('follows graduates to 2022');
  await expect(page.locator('.atlas-source-notes')).toContainText('no health-training subset');
  await page.goto(`${explorer}bc-hourly-wages&year=2025&filter.industry=${encodeURIComponent(healthIndustry)}`);
  await expect(page.getByRole('combobox', { name: 'Statistic', exact: true })).toHaveValue('Median hourly wage rate');
  await expect(page.locator('.atlas-chart')).toContainText('CAD/hour nominal');
  await expect(page.locator('.atlas-bar-row')).toHaveCount(1);
  await expect(page.locator('.atlas-bar-row')).toContainText('32');
});

test('native boundary failure preserves original records and the UNBC shell', async ({ page }) => {
  await page.route('**/data/nhhr/boundaries-csd.geojson', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.goto(`${explorer}census-housing-csd`);
  await expect(page.getByRole('alert')).toContainText('Boundary snapshot unavailable');
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(7);
  await expect(page.locator('.atlas-data-table tbody')).toContainText('Prince George');
  await expect(page.locator('.unbc-atlas-shell')).toBeVisible();
  await expect(page.getByRole('banner').getByRole('link', { name: /University of Northern British Columbia/ })).toBeVisible();
});
