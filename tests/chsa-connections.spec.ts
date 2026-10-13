import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { AtlasDataset } from '../src/atlas/types';
import { mockBasemaps } from './basemap-fixtures';

const explorer = 'dev/projects?view=explore';
const diabetesIncidence = 'Diabetes Mellitus age-standardized incidence rate per 1000 population (1+ yrs)';
const diabetesPrevalence = 'Diabetes Mellitus age-standardized lifetime prevalence rate per 1000 population (1+ yrs)';
const asthmaIncidence = 'Asthma age-standardized incidence rate per 1000 population (1+ yrs)';
const asthmaPrevalence = 'Asthma age-standardized lifetime prevalence rate per 1000 population (1+ yrs)';

test.beforeEach(async ({ page }) => { await mockBasemaps(page); });

async function release(request: APIRequestContext): Promise<AtlasDataset[]> {
  const response = await request.get('data/nhhr/chsa-connections.json');
  expect(response.ok()).toBe(true);
  return (await response.json()).datasets;
}

async function csv(page: Page): Promise<string> {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV', exact: true }).click();
  return readFile((await (await pending).path())!, 'utf8');
}

test('supplemental PHSA records retain their native grain, stable source key and independently checked rates', async ({ request }) => {
  const datasets = await release(request);
  expect(Object.fromEntries(datasets.map(d => [d.id, d.rows.length]))).toEqual({
    'northern-chsa-incidence': 2156, 'northern-chsa-prevalence': 2303,
  });
  for (const d of datasets) {
    expect(d.datasetId).toBe('CDR2022');
    expect(d.sourceOrigin).toBe('supplemental');
    expect(d.relatedZoerDatasetIds).toEqual(['b4d850b9-494b-4de6-96c3-2951defae583']);
    expect(d.geography).toBe('chsa');
    expect(d.boundaryKeyField).toBe('chsa_code');
    expect(d.mapLocationsAsset).toBe('boundaries-chsa-2018.geojson');
    expect(new Set(d.rows.map(r => `${r.chsa_code}|${r.indicator}|${r.original_period}|${r.sex}`)).size).toBe(d.rows.length);
    expect(new Set(d.rows.map(r => r.chsa_code)).size).toBe(29);
    expect(new Set(d.rows.map(r => r.period)).size).toBe(20);
    expect(new Set(d.rows.map(r => r.indicator)).size).toBe(4);
    expect(d.rows.every(r => r.sex === 'Total' && r.boundary_vintage === '2018' && r.standard_population === '2011 Canadian Census population')).toBe(true);
    expect(d.rows.every(r => r.source_unit === 'Per 1000 population' && r.source_data_source === 'BC Ministry of Health' && r.ha_code === '5')).toBe(true);
    expect(d.rows.every(r => !('indicator_definition' in r) && !('source_notes' in r) && !('source_comments' in r))).toBe(true);
    expect(Object.keys(d.indicatorMetadata!)).toHaveLength(4);
    expect(Object.values(d.indicatorMetadata!).every(m => m.notes.includes('2011 Canadian Census population') && m.furtherInformation.includes('bccdc.ca'))).toBe(true);
  }
  const incidence = datasets.find(d => d.id === 'northern-chsa-incidence')!;
  const prevalence = datasets.find(d => d.id === 'northern-chsa-prevalence')!;
  const latest = (d: AtlasDataset, code: string) => d.rows.find(r => r.chsa_code === code && r.indicator === d.defaultFilters!.indicator && r.period === '2020–2021')!;
  expect(['5241', '5242', '5243'].map(code => latest(incidence, code).rate_per_1000)).toEqual([7.5, 8.6, 7.9]);
  expect(['5241', '5242', '5243'].map(code => latest(prevalence, code).rate_per_1000)).toEqual([90.4, 103.3, 89.6]);
  expect(latest(incidence, '5242')).toMatchObject({ chsa_name: 'Prince George City - Central', original_period: 'FY 2020.2021', age_universe: '1+ yrs', rate_definition: 'Age-standardized incidence', source_raw: '8.6' });
  expect(incidence.rows.filter(r => r.rate_per_1000 === null)).toHaveLength(6);
  expect(prevalence.rows.filter(r => r.rate_per_1000 === null)).toHaveLength(0);
  expect(datasets.some(d => d.rows.some(r => r.rate_per_1000 === 0))).toBe(false);
  // This requested historical source cell was absent, rather than an observed zero.
  expect(incidence.rows.some(r => r.chsa_code === '5222' && r.indicator === diabetesIncidence && r.period === '2001–2002')).toBe(false);
});

test('archived geometry preserves 40 v2018 context areas and the unsplit McBride/Valemount identity', async ({ request }) => {
  const geo = await (await request.get('data/nhhr/boundaries-chsa-2018.geojson')).json();
  const index = await (await request.get('data/nhhr/chsa-boundary-index.json')).json();
  expect(geo.features).toHaveLength(40);
  expect(geo.metadata).toMatchObject({ boundaryVintage: '2018', retrievalProvider: 'Community Map of Canada ArcGIS mirror', displayOnly: true, contextPolygons: 40, publicMeasuredCHSAs: 29 });
  const codes = geo.features.map((f: { properties: { code: string } }) => f.properties.code).sort();
  expect(new Set(codes).size).toBe(40);
  expect(index['boundaries-chsa-2018.geojson']).toEqual(codes);
  expect(codes).not.toContain('5248');
  const combined = geo.features.find((f: { properties: { code: string } }) => f.properties.code === '5246');
  expect(combined.properties).toMatchObject({ name: 'McBride/Valemount', lha_code: '524', hsda_code: '52', ha_code: '5', boundary_vintage: '2018' });
  expect(geo.features.filter((f: { properties: { has_public_profile: boolean } }) => f.properties.has_public_profile)).toHaveLength(29);
  const d = (await release(request)).find(d => d.id === 'northern-chsa-incidence')!;
  for (const row of d.rows) expect(codes).toContain(row.chsa_code);
  const provenance = await (await request.get('data/nhhr/chsa-connections-provenance.json')).json();
  expect(provenance.sourceDatasetId).toBe('CDR2022');
  expect(provenance.primaryDownloads).toHaveLength(29);
  expect(provenance.geometry.legacyOfficialZipStatus).toContain('HTTP 404');
  expect(provenance.geometry.licenseScope).toContain('No downstream spatial analysis');
  expect(provenance.geometry.validation).toMatchObject({ geometryCount: 40, rawInvalidCount: 0, displayInvalidCount: 0, overlapPairsAbovePoint01Sqm: [], sharedBoundaryPairs: 75 });
  expect(provenance.geometry.validation.maxAreaChangePct).toBeLessThan(0.5);
  expect(provenance.quality).toMatchObject({ apiScientificRows: 4453, explicitProfileNullRows: 6, historicalOmissionsRetainedAsAbsent: 181, missingPotentialCells: 187, latestNumericRates: 226, requestedRestrictedCHSAs: 0 });
  expect(provenance.profileReconciliations).toHaveLength(226);
});

test('CHSA incidence maps the native 2018 areas with one source-missing latest value and clear external provenance', async ({ page }) => {
  await page.goto(`${explorer}&dataset=northern-chsa-incidence`);
  await expect(page.getByTestId('year-select')).toHaveValue('2020–2021');
  await expect(page.getByRole('combobox', { name: 'Original indicator', exact: true })).toHaveValue(diabetesIncidence);
  const state = page.getByTestId('atlas-map-state');
  await expect(state).toHaveAttribute('data-ready', 'true');
  await expect(state).toHaveAttribute('data-geometry', 'polygons');
  await expect(state).toHaveAttribute('data-feature-count', '40');
  await expect(state).toHaveAttribute('data-matched-count', '29');
  await expect(state).toHaveAttribute('data-rendered-features', /^[1-9]\d*$/);
  await expect(state).toHaveAttribute('data-map-aggregation', 'none');
  await expect(state).toHaveAttribute('data-basemap-format', 'vector');
  await expect(state).toHaveAttribute('data-raster-sources', '0');
  await expect(page.locator('.atlas-map-join-note')).toContainText('29 exact boundary joins · 0 unmatched rows · 1 missing values');
  await page.getByRole('combobox', { name: 'Select map region', exact: true }).selectOption('Prince George City - Central');
  await expect(page.locator('.atlas-map-detail')).toContainText('8.6 per 1,000');
  await expect(page.locator('.atlas-map-panel')).toContainText('Community Map of Canada ArcGIS mirror');
  await expect(page.locator('.atlas-map-panel')).toContainText('Forty Northern context polygons');
  await page.locator('.atlas-source-notes > summary').click();
  const notes = page.locator('.atlas-source-notes');
  await expect(notes).toContainText('Supplementary measurements retrieved from the named publisher');
  await expect(notes.getByText('Source dataset reference', { exact: true })).toBeVisible();
  await expect(notes.getByText('Zoer dataset ID', { exact: true })).toHaveCount(0);
  await expect(notes).toContainText('CDR2022');
  await expect(notes).toContainText('not present as CHSA scientific rows');
  await notes.locator('details > summary').click();
  await expect(notes).toContainText('2011 Canadian Census population');
  await expect(notes.getByRole('link', { name: 'Publisher case definitions', exact: true })).toHaveAttribute('href', /bccdc\.ca/);
});

test('explicit source dashes stay null in CHSA map, table and spreadsheet-safe CSV', async ({ page }) => {
  await page.goto(`${explorer}&dataset=northern-chsa-incidence`);
  await page.getByTestId('entity-select').selectOption('Snow Country');
  await expect(page.getByTestId('atlas-map-state')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByTestId('atlas-map-state')).toHaveAttribute('data-matched-count', '1');
  await expect(page.locator('.atlas-map-join-note')).toContainText('1 missing values');
  await page.getByRole('combobox', { name: 'Select map region', exact: true }).selectOption('Snow Country');
  await expect(page.locator('.atlas-map-detail')).toContainText('No value');
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.atlas-data-table tbody td.is-number')).toHaveText('Not reported');
  await expect(page.locator('.atlas-data-table tbody')).toContainText('Not released (source dash; reason not specified)');
  await expect(page.locator('.atlas-data-table tbody')).toContainText('Profile CSV explicit dash');
  const output = await csv(page);
  const lines = output.replace(/^\uFEFF/, '').split(/\r?\n/);
  expect(lines).toHaveLength(2);
  expect(lines[1]).toContain('"Snow Country","5110",""');
  expect(lines[1]).toContain('"FY 2020.2021"');
  // The export guards a leading hyphen as spreadsheet text; the original literal stays visible.
  expect(lines[1]).toContain('"\'-"');
  expect(output).toContain('"2011 Canadian Census population"');
  expect(output).toContain('Copyright © 2026 Provincial Health Services Authority');
  await page.reload();
  await expect(page.getByTestId('entity-select')).toHaveValue('Snow Country');
  await expect(page.getByTestId('year-select')).toHaveValue('2020–2021');
});

test('multiple CHSA indicators are retained in records and withheld from geographic values', async ({ page }) => {
  await page.goto(`${explorer}&dataset=northern-chsa-incidence`);
  await page.getByTestId('entity-select').selectOption('Prince George City - Central');
  await page.getByRole('combobox', { name: 'Original indicator', exact: true }).selectOption('');
  const state = page.getByTestId('atlas-map-state');
  await expect(state).toHaveAttribute('data-ready', 'true');
  await expect(state).toHaveAttribute('data-matched-count', '0');
  await expect(page.locator('.atlas-map-join-note')).toContainText('4 ambiguous rows withheld');
  await expect(page.locator('.atlas-map-legend')).toContainText('No value');
  await page.getByRole('combobox', { name: 'Select map region', exact: true }).selectOption('Prince George City - Central');
  await expect(page.locator('.atlas-map-detail')).toContainText('Multiple observations');
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(4);
  await expect(page.locator('.atlas-data-table tbody td.is-number')).toHaveText(['3.1', '13.2', '8.6', '17.5']);
  const output = await csv(page);
  expect(output.split(/\r?\n/)).toHaveLength(5);
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Original indicator', exact: true })).toHaveValue('');
  await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(4);
});

test('CHSA trends retain all fiscal periods and linked definitions preserve selected place and condition', async ({ page }) => {
  await page.goto(`${explorer}&dataset=northern-chsa-incidence&display=chart&entity=Prince%20George%20City%20-%20Central`);
  await expect(page.getByTestId('year-select')).toHaveValue('');
  const chart = page.locator('.atlas-trend-chart');
  await expect(chart.getByRole('button', { name: 'Prince George City - Central, 2001–2002: 8.1 per 1,000', exact: true })).toBeAttached();
  await expect(chart.getByRole('button', { name: 'Prince George City - Central, 2020–2021: 8.6 per 1,000', exact: true })).toBeAttached();
  await expect(chart.locator('circle[role="button"]')).toHaveCount(20);
  await expect(chart.locator('circle[fill="#fff"]')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Original indicator', exact: true }).selectOption(asthmaIncidence);
  await page.getByRole('button', { name: 'CHSA lifetime prevalence', exact: true }).click();
  await expect(page).toHaveURL(/dataset=northern-chsa-prevalence/);
  await expect(page.getByTestId('entity-select')).toHaveValue('Prince George City - Central');
  await expect(page.getByRole('combobox', { name: 'Original indicator', exact: true })).toHaveValue(asthmaPrevalence);
  await page.getByRole('combobox', { name: 'Original indicator', exact: true }).selectOption(diabetesPrevalence);
  await page.getByTestId('year-select').selectOption('');
  await page.getByRole('tab', { name: 'Chart', exact: true }).click();
  await expect(page.locator('.atlas-trend-chart').getByRole('button', { name: 'Prince George City - Central, 2001–2002: 66.3 per 1,000', exact: true })).toBeAttached();
  await expect(page.locator('.atlas-trend-chart').getByRole('button', { name: 'Prince George City - Central, 2020–2021: 103.3 per 1,000', exact: true })).toBeAttached();
  await page.getByTestId('year-select').selectOption('2020–2021');
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  const output = await csv(page);
  expect(output.split(/\r?\n/)).toHaveLength(2);
  expect(output).toContain('"2020–2021","FY 2020.2021"');
  expect(output).toContain('"103.3"');
});
