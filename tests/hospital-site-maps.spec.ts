import { test, expect, type APIRequestContext, type Locator } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { AtlasDataset } from '../src/atlas/types';
import { mockBasemaps } from './basemap-fixtures';

const explorer = 'dev/projects?view=explore';
const hospital = 'University Hospital of Northern British Columbia';
const unknownNames = ['Greater Victoria Hospitals', 'Surgery Centre', 'B.C. Cancer Agency'];
type Point = { code: string; value: number | null; radius: number };
type Location = { geometry: { type: string; coordinates: number[] }; properties: { code: string; name: string; source_aliases: string[]; source_url: string; coordinate_source_url: string; location_note: string } };

test.beforeEach(async ({ page }) => { await mockBasemaps(page); });

async function source(request: APIRequestContext) {
  const response = await request.get('data/nhhr/hospital-facilities.json');
  expect(response.ok()).toBe(true);
  const release = await response.json() as { datasets: AtlasDataset[] };
  return { directory: release.datasets.find(d => d.id === 'hospital-facilities')!, costs: release.datasets.find(d => d.id === 'hospital-facility-costs')! };
}

async function rendered(state: Locator): Promise<Point[]> {
  return JSON.parse(await state.getAttribute('data-rendered-points') ?? '[]');
}

test('hospital release keeps all original directory IDs, exact physical aliases and original cost cells', async ({ request }) => {
  const { directory, costs } = await source(request);
  expect(directory.mapLocationsAsset).toBe('locations-hospitals.geojson');
  expect(costs.mapLocationsAsset).toBe('locations-hospitals.geojson');
  expect(directory.rows).toHaveLength(57);
  const ids = directory.rows.flatMap(row => String(row.source_facility_ids).split(';').map(value => value.trim()));
  expect(ids).toHaveLength(61);
  expect(new Set(ids).size).toBe(61);
  expect(directory.rows.filter(row => row.location_code)).toHaveLength(54);
  expect(directory.rows.filter(row => !row.location_code).map(row => row.facility_name).sort()).toEqual([...unknownNames].sort());
  expect(directory.rows.filter(row => !row.location_code).every(row => row.site_count === null && typeof row.location_note === 'string' && row.location_note.length > 10)).toBe(true);
  const royal = directory.rows.find(row => row.source_facility_names === 'Royal Columbian Hospital')!;
  expect(String(royal.source_facility_ids).split(';').map(value => value.trim()).sort()).toEqual(['7849', '8289']);
  expect(royal.site_count).toBe(1);

  expect(costs.rows).toHaveLength(363);
  expect(new Set(costs.rows.map(row => `${row.source_facility_name}|${row.fiscal_year}`)).size).toBe(363);
  expect(costs.rows.filter(row => row.cost_per_weighted_case === null)).toHaveLength(32);
  expect(costs.rows.filter(row => row.cost_per_weighted_case === null).every(row => row.source_cost_raw === 'Suppressed' && row.cost_status === 'Suppressed in source')).toBe(true);
  // Independent oracle computed from the original hash-locked workbook via openpyxl,
  // not from the application's snapshot or its preparation parser. It covers all
  // 363 original facility/year/numeric/raw-value tuples, including suppression.
  const tuples = costs.rows.map(row => [row.source_facility_name, row.fiscal_year, row.cost_per_weighted_case, row.source_cost_raw]);
  expect(createHash('sha256').update(JSON.stringify(tuples)).digest('hex')).toBe('046a15d43bf101cf774adb165bbd2fb35d93000ec103d304b49c6394ec839627');
  const latest = costs.rows.filter(row => row.fiscal_year === '2024–2025');
  expect(latest).toHaveLength(72);
  expect(new Set(latest.map(row => row.location_code)).size).toBe(72);
  expect(latest.find(row => row.facility_name === hospital)?.cost_per_weighted_case).toBe(11093);
  expect(costs.rows.every(row => row.source_refresh_date === '2026-05-19')).toBe(true);

  const geo = await (await request.get('data/nhhr/locations-hospitals.geojson')).json() as { features: Location[] };
  expect(geo.features).toHaveLength(84);
  expect(new Set(geo.features.map(feature => feature.properties.code)).size).toBe(84);
  expect(new Set(geo.features.map(feature => feature.properties.coordinate_source_url)).size).toBe(84);
  expect(geo.features.every(feature => feature.geometry.type === 'Point' && feature.geometry.coordinates.length === 2 && feature.geometry.coordinates.every(Number.isFinite) && feature.properties.source_url.startsWith('https://') && feature.properties.coordinate_source_url.startsWith('https://www.openstreetmap.org/'))).toBe(true);
  expect(costs.rows.every(row => geo.features.some(feature => feature.properties.code === row.location_code && feature.properties.source_aliases.includes(String(row.source_facility_name))))).toBe(true);
  expect(directory.rows.filter(row => row.location_code).every(row => geo.features.some(feature => feature.properties.code === row.location_code && String(row.source_facility_names).split(';').every(alias => feature.properties.source_aliases.includes(alias.trim()))))).toBe(true);
  const nats = geo.features.find(feature => feature.properties.name === 'Nats’oojeh Hospital and Health Centre')!;
  expect(nats.geometry.coordinates).toEqual([-124.2420489, 54.4396377]);
  expect(nats.properties.location_note).toContain('14 January 2025');
  expect(nats.properties.location_note).toContain('continuing hospital reporting unit');
  expect(nats.properties.location_note).toContain('not historical geolocations');
});

test('latest facility costs render 72 real points on a vector basemap with the source values', async ({ page, request }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const { costs } = await source(request);
  const latest = costs.rows.filter(row => row.fiscal_year === '2024–2025');
  await page.goto(`${explorer}&dataset=hospital-facility-costs`);
  await expect(page.getByRole('tab', { name: 'Map', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('year-select')).toHaveValue('2024–2025');
  const state = page.getByTestId('atlas-map-state');
  await expect(state).toHaveAttribute('data-ready', 'true');
  await expect(state).toHaveAttribute('data-geometry', 'points');
  await expect(state).toHaveAttribute('data-feature-count', '84');
  await expect(state).toHaveAttribute('data-matched-count', '72');
  await expect(state).toHaveAttribute('data-rendered-features', '72');
  await expect(state).toHaveAttribute('data-basemap-format', 'vector');
  await expect(state).toHaveAttribute('data-raster-sources', '0');
  await expect(state).toHaveAttribute('data-basemap-status', 'ready');
  await expect(state).toHaveAttribute('data-map-aggregation', 'none');
  const points = await rendered(state);
  expect(points).toHaveLength(72);
  expect(Object.fromEntries(points.map(point => [point.code, point.value]))).toEqual(Object.fromEntries(latest.map(row => [row.location_code, row.cost_per_weighted_case])));
  expect(points.filter(point => point.value === null).every(point => point.radius === 0)).toBe(true);
  await page.getByRole('combobox', { name: 'Select map site', exact: true }).selectOption(hospital);
  await expect(page.locator('.atlas-map-detail')).toContainText('Cost per weighted case: $11,093');
  await expect(page.locator('.atlas-map-detail').getByRole('link', { name: 'Site location', exact: true })).toHaveAttribute('href', 'https://www.northernhealth.ca/find-a-facility/hospitals/university-hospital-northern-british-columbia-uhnbc');
  await expect(page.locator('.atlas-map-detail').getByRole('link', { name: 'Mapped point', exact: true })).toHaveAttribute('href', 'https://www.openstreetmap.org/way/445255625');
  await expect(page.locator('.atlas-institution-scope')).toContainText('not establish a catchment');
  expect(errors).toEqual([]);
});

test('hospital filters preserve the identical source subset in map, chart, table and CSV', async ({ page }) => {
  await page.goto(`${explorer}&dataset=hospital-facility-costs`);
  await page.getByTestId('entity-select').selectOption(hospital);
  const state = page.getByTestId('atlas-map-state');
  await expect(state).toHaveAttribute('data-matched-count', '1');
  await expect.poll(async () => (await rendered(state))[0]?.value).toBe(11093);
  await page.getByRole('tab', { name: 'Chart', exact: true }).click();
  // A single selected period already renders record bars, so no time-series
  // mode switch is shown for this one-row subset.
  await expect(page.locator('.atlas-bar-row')).toHaveCount(1);
  await expect(page.locator('.atlas-bar-row')).toContainText('$11,093');
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.atlas-data-table tbody')).toContainText('11,093');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV', exact: true }).click();
  const csv = await readFile((await (await downloading).path())!, 'utf8');
  expect(csv.split(/\r?\n/)).toHaveLength(2);
  expect(csv).toContain('"2024–2025"');
  expect(csv).toContain('"11093","11,093","Reported"');
  await page.reload();
  await expect(page.getByTestId('entity-select')).toHaveValue(hospital);
  await expect(page.getByTestId('year-select')).toHaveValue('2024–2025');
});

test('aggregate and unidentified directory labels stay in records without guessed points', async ({ page }) => {
  await page.goto(`${explorer}&dataset=hospital-facilities`);
  const state = page.getByTestId('atlas-map-state');
  await expect(state).toHaveAttribute('data-ready', 'true');
  await expect(state).toHaveAttribute('data-matched-count', '54');
  await expect(state).toHaveAttribute('data-rendered-features', '54');
  await expect(page.locator('.atlas-map-join-note')).toContainText('3 unmatched rows');
  const selector = page.getByRole('combobox', { name: 'Select map site', exact: true });
  for (const name of unknownNames) {
    await expect(selector.locator('option').filter({ hasText: name })).toHaveCount(0);
    await page.getByTestId('entity-select').selectOption(name);
    await expect(state).toHaveAttribute('data-matched-count', '0');
    await expect(state).toHaveAttribute('data-rendered-features', '0');
    await page.getByRole('tab', { name: 'Table', exact: true }).click();
    await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(1);
    await expect(page.locator('.atlas-data-table tbody')).toContainText(name);
    await expect(page.locator('.atlas-data-table tbody')).toContainText('Not reported');
    await expect(page.locator('.atlas-data-table tbody')).toContainText('Unmapped source entry');
    await page.getByRole('tab', { name: 'Map', exact: true }).click();
  }
});

test('suppressed cost values and pre-opening Nats reporting years remain honest across views', async ({ page, request }) => {
  const { costs } = await source(request);
  const nats = costs.rows.find(row => row.facility_name === 'Nats’oojeh Hospital and Health Centre' && row.fiscal_year === '2024–2025')!;
  expect(nats.cost_per_weighted_case).toBeNull();
  await page.goto(`${explorer}&dataset=hospital-facility-costs&entity=${encodeURIComponent(String(nats.facility_name))}`);
  const state = page.getByTestId('atlas-map-state');
  await expect(state).toHaveAttribute('data-matched-count', '1');
  await expect.poll(async () => (await rendered(state))[0]?.value).toBeNull();
  await page.getByRole('combobox', { name: 'Select map site', exact: true }).selectOption(String(nats.facility_name));
  await expect(page.locator('.atlas-map-detail')).toContainText('No value');
  await expect(page.locator('.atlas-map-detail')).toContainText('14 January 2025');
  await expect(page.locator('.atlas-map-detail')).toContainText('not historical geolocations');
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  await expect(page.locator('.atlas-data-table tbody')).toContainText('Suppressed');
  await expect(page.locator('.atlas-data-table tbody')).toContainText('Not reported');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV', exact: true }).click();
  const csv = await readFile((await (await downloading).path())!, 'utf8');
  expect(csv).toContain(',"","Suppressed","Suppressed in source",');
  await page.getByTestId('year-select').selectOption('2020–2021');
  await expect(page.locator('.atlas-data-table tbody')).toContainText('Nats’oojeh Hospital and Health Centre (B.C.)');
  await expect(page.locator('.atlas-data-table tbody')).toContainText('not historical geolocations');
  await page.getByRole('tab', { name: 'Map', exact: true }).click();
  await expect(state).toHaveAttribute('data-matched-count', '1');
  const original = costs.rows.find(row => row.facility_name === nats.facility_name && row.fiscal_year === '2020–2021')!;
  await expect.poll(async () => (await rendered(state))[0]?.value).toBe(original.cost_per_weighted_case);
  await page.getByTestId('year-select').selectOption('');
  await expect(state).toHaveAttribute('data-matched-count', '0');
  await expect(page.locator('.atlas-map-join-note')).toContainText('5 ambiguous rows withheld');
  await expect(state).toHaveAttribute('data-map-aggregation', 'none');
});
