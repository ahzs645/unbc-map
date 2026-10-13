import { expect, test, type APIRequestContext, type Locator } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { AtlasDataset, AtlasRow } from '../src/atlas/types';
import { mockBasemaps } from './basemap-fixtures';

const conditionUrl = 'dev/projects?view=explore&dataset=clinical-condition-mix';
const ageUrl = 'dev/projects?view=explore&dataset=population-lha-ages&display=paired&year=2025';
const cancer = 'Cancer / oncology';
async function release(request: APIRequestContext, asset: string): Promise<AtlasDataset> {
  const response = await request.get(`data/nhhr/${asset}.json`);
  expect(response.ok()).toBe(true);
  return (await response.json()).datasets[0];
}
async function readyMaps(scope: Locator, count = 2) {
  const states = scope.getByTestId('atlas-map-state');
  await expect(states).toHaveCount(count);
  for (const state of await states.all()) {
    await expect(state).toHaveAttribute('data-ready', 'true');
    await expect(state).toHaveAttribute('data-basemap-format', 'vector');
    await expect(state).toHaveAttribute('data-raster-sources', '0');
    await expect(state).toHaveAttribute('data-basemap-status', 'ready');
  }
  return states;
}
async function expectSyncedCameras(left: Locator, right: Locator) {
  // MapLibre can return subpixel floating-point differences after an animated
  // zoom. Compare the real coordinates/zoom rather than serialized JSON bytes.
  await expect.poll(async () => {
    const a = await left.getAttribute('data-camera'), b = await right.getAttribute('data-camera');
    if (!a || !b) return Infinity;
    const first = JSON.parse(a), second = JSON.parse(b);
    const av = [...first.center, first.zoom, first.bearing, first.pitch];
    const bv = [...second.center, second.zoom, second.bearing, second.pitch];
    return av.every(Number.isFinite) && bv.every(Number.isFinite)
      ? Math.max(...av.map((value: number, index: number) => Math.abs(value - bv[index]))) : Infinity;
  }).toBeLessThan(0.000001);
}
function csvRecords(content: string): string[][] {
  const records: string[][] = []; let row: string[] = [], field = '', quoted = false;
  const text = content.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && c === ',') { row.push(field); field = ''; }
    else if (!quoted && (c === '\r' || c === '\n')) { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); records.push(row); row = []; field = ''; }
    else field += c;
  }
  expect(quoted).toBe(false);
  if (row.length || field) { row.push(field); records.push(row); }
  return records;
}
function expectedCsv(dataset: AtlasDataset, rows: AtlasRow[]) { return [dataset.columns.map(c => c.key), ...rows.map(row => dataset.columns.map(c => row[c.key] == null ? '' : String(row[c.key])))]; }

test.beforeEach(async ({ page }) => { await mockBasemaps(page); });

test('condition release preserves the ragged original, real zeros and fixed denominators', async ({ request }) => {
  const dataset = await release(request, 'clinical-condition-mix');
  expect(dataset.rows).toHaveLength(77);
  expect(new Set(dataset.rows.map(r => r.query_city)).size).toBe(7);
  expect(new Set(dataset.rows.map(r => r.condition_domain)).size).toBe(13);
  expect(new Set(dataset.rows.map(r => `${r.query_city}|${r.condition_domain}`)).size).toBe(77);
  expect(dataset.rows.filter(r => r.recruiting_snapshot_studies === 0)).toHaveLength(16);
  expect(dataset.rows.every(r => r.snapshot_date === '2026-04-29')).toBe(true);
  expect(dataset.columns.filter(c => c.type === 'number').map(c => c.key)).toEqual(['studies', 'recruiting_snapshot_studies', 'condition_share_pct', 'recruiting_condition_share_pct']);
  expect(dataset.columns.find(c => c.key === 'city_studies')?.type).toBe('text');
  expect(dataset.mapScaleFields).toEqual(['condition_domain']);
  const totals: Record<string, number[]> = { Calgary: [4478, 522], Halifax: [2824, 301], 'Prince George': [10, 6], Saskatoon: [1357, 129], Sudbury: [566, 35], 'Thunder Bay': [205, 18], Vancouver: [5588, 616] };
  for (const [city, [studies, recruiting]] of Object.entries(totals)) {
    const rows = dataset.rows.filter(r => r.query_city === city);
    expect(rows.reduce((sum, r) => sum + Number(r.studies), 0)).toBe(studies);
    expect(rows.reduce((sum, r) => sum + Number(r.recruiting_snapshot_studies), 0)).toBe(recruiting);
    for (const r of rows) {
      expect(r.city_studies).toBe(studies); expect(r.city_recruiting_snapshot_studies).toBe(recruiting);
      expect(Number(r.condition_share_pct)).toBeCloseTo(100 * Number(r.studies) / studies, 5);
      expect(Number(r.recruiting_condition_share_pct)).toBeCloseTo(100 * Number(r.recruiting_snapshot_studies) / recruiting, 5);
    }
  }
  expect(dataset.rows.find(r => r.query_city === 'Prince George' && r.condition_domain === cancer)).toMatchObject({ studies: 7, recruiting_snapshot_studies: 5, condition_share_pct: 70, recruiting_condition_share_pct: 83.333333 });
});

test('downloadable condition evidence is byte-identical and traces the original file and reconciliation', async ({ request }) => {
  expect(await (await request.get('data/nhhr/clinical-condition-mix.json')).text()).toBe(await readFile('src/atlas/snapshots/clinical-condition-mix.json', 'utf8'));
  const provenance = await (await request.get('data/nhhr/clinical-condition-mix-provenance.json')).json();
  expect(provenance.originalSource).toMatchObject({ datasetId: 'a308df09-ac89-4591-980f-624a4908a9b6', originalFileId: 'ac6c958e-45ff-4dc1-828a-3ac2bd3cc04a', sha256: 'c53a2738c462388d5b76453f9951bac3825adfd2df180f266f1b1d3b555d9674', sourceRowCount: 77 });
  expect(provenance.rowBindings).toHaveLength(77);
  expect(provenance.absentCityDomainPairs).toHaveLength(14);
  expect(provenance.explicitZeroRecruitingRows).toBe(16);
  expect(provenance.cityReconciliation).toHaveLength(7);
  expect(provenance.princeGeorgeStudyBindings).toHaveLength(10);
  expect(provenance.snapshotDateMeaning).toMatch(/no.*timestamp/i);
  const readme = await (await request.get('data/nhhr/clinical-condition-mix.README.md')).text();
  expect(readme).toContain('77'); expect(readme).toMatch(/fixed|full.city/i); expect(readme).toMatch(/historical|snapshot/i);
});

test('default composition chart keeps all 77 records and all 13 coded categories', async ({ page }) => {
  await page.goto(conditionUrl);
  await expect(page.getByRole('tab', { name: 'Chart', exact: true })).toHaveAttribute('aria-selected', 'true');
  const chart = page.getByTestId('condition-mix-chart');
  await expect(chart).toHaveAttribute('data-source-count', '77');
  await expect(chart).toHaveAttribute('data-domain-count', '13');
  await expect(chart).toHaveAttribute('data-scale-max', '100');
  await expect(chart.locator('.condition-mix-city')).toHaveCount(7);
  await expect(page.getByLabel('NHHR-coded condition domain')).toHaveValue('');
  await expect(page.getByTestId('metric-select').locator('option')).toHaveCount(4);
  await expect(chart).toContainText('unshown shares are not redistributed');
  await chart.getByText('Inspect source values · 77 records, including zeros', { exact: true }).click();
  await expect(chart.locator('.condition-mix-values tbody tr')).toHaveCount(77);
});

test('domain filters retain 70 percent and keyboard tooltip exposes both source denominators', async ({ page }) => {
  await page.goto(conditionUrl);
  await page.getByLabel('NHHR-coded condition domain').selectOption(cancer);
  const chart = page.getByTestId('condition-mix-chart');
  await expect(chart).toHaveAttribute('data-source-count', '7');
  const segment = chart.locator('.condition-mix-segment[data-city="Prince George"]');
  await expect(segment).toHaveAttribute('data-value', '70');
  await expect(segment).toHaveAttribute('data-denominator', '10');
  await segment.focus();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toContainText('7 source studies');
  await expect(tooltip).toContainText('70%');
  await expect(tooltip).toContainText('10 full-city source studies');
  await expect(tooltip).toContainText('5 historical recruiting studies');
  await expect(tooltip).toContainText('6 full-city historical recruiting studies');
  await segment.press('Escape'); await expect(tooltip).toHaveCount(0);
  await page.getByTestId('metric-select').selectOption('recruiting_condition_share_pct');
  await expect(segment).toHaveAttribute('data-value', '83.333333');
  await expect(segment).toHaveAttribute('data-denominator', '6');
  await page.getByTestId('metric-select').selectOption('studies');
  await expect(chart).toHaveAttribute('data-scale-max', '5588');
  await expect(segment).toHaveAttribute('data-value', '7');
});

test('explicit recruiting zeros remain inspectable while absent source categories are never fabricated', async ({ page }) => {
  await page.goto(conditionUrl);
  await page.getByTestId('entity-select').selectOption('Prince George');
  await page.getByTestId('metric-select').selectOption('recruiting_snapshot_studies');
  const chart = page.getByTestId('condition-mix-chart');
  await expect(chart).toHaveAttribute('data-source-count', '4');
  await chart.getByText('Inspect source values · 4 records, including zeros', { exact: true }).click();
  await expect(chart.locator('.condition-mix-values tbody tr')).toHaveCount(4);
  const zero = chart.getByRole('button', { name: 'Inspect Prince George, Respiratory', exact: true });
  await zero.focus();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toContainText('1 source studies');
  await expect(tooltip).toContainText('0 historical recruiting studies');
  await expect(tooltip).toContainText('0%');
  await expect(tooltip).toContainText('6 full-city historical recruiting studies');
  await zero.press('Escape');
  expect(await chart.locator('.condition-mix-segment[data-domain="Respiratory"]').count()).toBe(0);
});

test('one shared condition filter drives chart map table CSV copied URL and reload', async ({ page, request, context }) => {
  const dataset = await release(request, 'clinical-condition-mix');
  await page.goto(conditionUrl);
  await page.getByRole('tab', { name: 'Map', exact: true }).click();
  const map = page.getByTestId('atlas-map-state');
  await readyMaps(page.locator('#atlas-data-panel'), 1);
  await expect(map).toHaveAttribute('data-matched-count', '0');
  await expect(page.locator('.atlas-geography-note').first()).toContainText('Select one coded condition');
  await page.getByLabel('NHHR-coded condition domain').selectOption(cancer);
  await expect(map).toHaveAttribute('data-matched-count', '7');
  await expect(map).toHaveAttribute('data-bubble-scale-max', '74.634146');
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(7);
  const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: 'CSV', exact: true }).click();
  const file = await downloaded;
  expect(csvRecords(await readFile((await file.path())!, 'utf8'))).toEqual(expectedCsv(dataset, dataset.rows.filter(r => r.condition_domain === cancer)));
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Share view', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
  expect(new URL(page.url()).searchParams.get('filter.condition_domain')).toBe(cancer);
  await page.reload(); await expect(page.getByLabel('NHHR-coded condition domain')).toHaveValue(cancer);
  await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(7);
  await page.getByRole('tab', { name: 'Chart', exact: true }).click();
  await expect(page.getByTestId('condition-mix-chart')).toHaveAttribute('data-source-count', '7');
});

test('trial stories show the full composition and transfer the guided three-city source subset', async ({ page }) => {
  await page.goto('dev/projects/trial-portfolios');
  await expect(page.getByTestId('condition-mix-chart')).toHaveAttribute('data-source-count', '77');
  const state = page.getByTestId('atlas-map-state');
  await expect(state).toHaveAttribute('data-ready', 'true');
  await expect(state).toHaveAttribute('data-matched-count', '7');
  await expect(page.locator('.atlas-story-map .atlas-evidence-source')).toContainText(cancer);
  await page.goto('dev/projects/research-pathways#trial-condition-mix');
  await expect(page.getByTestId('story-evidence')).toHaveAttribute('data-chapter', 'trial-condition-mix');
  await expect(page.getByTestId('condition-mix-chart')).toHaveAttribute('data-source-count', '27');
  await expect(page.getByTestId('story-evidence')).toHaveAttribute('data-period', '2026-04-29');
  await page.locator('.editorial-slide[data-active="true"]').getByRole('button', { name: 'Explore the source data' }).click();
  await expect(page.getByTestId('condition-mix-chart')).toHaveAttribute('data-source-count', '27');
  await expect(page.getByTestId('year-select')).toHaveValue('2026-04-29');
  expect(new URL(page.url()).searchParams.getAll('entities')).toEqual(['Prince George', 'Thunder Bay', 'Vancouver']);
  await page.reload(); await expect(page.getByTestId('condition-mix-chart')).toHaveAttribute('data-source-count', '27');
});

test('age source partitions and independent native map scales preserve projected count and share', async ({ page, request }) => {
  const dataset = await release(request, 'population-ages');
  expect(dataset.rows).toHaveLength(102);
  expect(await (await request.get('data/nhhr/population-ages.json')).text()).toBe(await readFile('src/atlas/snapshots/population-ages.json', 'utf8'));
  for (const row of dataset.rows) {
    expect(Number(row.population_0_19) + Number(row.population_20_64) + Number(row.population_65_plus)).toBe(row.total_population);
    expect(Number(row.share_65_plus)).toBeCloseTo(100 * Number(row.population_65_plus) / Number(row.total_population), 5);
  }
  expect(dataset.rows.find(r => r.region_name === 'Telegraph Creek' && String(r.year) === '2025')).toMatchObject({ total_population: 794, population_65_plus: 245, population_type: 'Projection' });
  expect(dataset.rows.find(r => r.region_name === 'Prince George' && String(r.year) === '2025')).toMatchObject({ total_population: 105544, population_65_plus: 18654, population_type: 'Projection' });
  await page.goto(ageUrl);
  await expect(page.getByRole('tab', { name: 'Paired age maps', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('metric-select')).toBeDisabled();
  const pair = page.getByTestId('age-map-pair'); const maps = await readyMaps(pair);
  for (const map of await maps.all()) await expect(map).toHaveAttribute('data-matched-count', '17');
  await expect(pair.locator('.atlas-age-map-share').getByTestId('atlas-map-state')).toHaveAttribute('data-scale-domain', '[11.363579,30.856423]');
  await expect(pair.locator('.atlas-age-map-count').getByTestId('atlas-map-state')).toHaveAttribute('data-scale-domain', '[195,18654]');
  await expect(pair.locator('.atlas-age-map-caption').first()).toContainText('2025 · Projection');
  await expect(pair.locator('.atlas-age-map-caption').first()).toContainText('share and count use different units');
  await page.getByRole('tab', { name: 'Map', exact: true }).click();
  await expect(page.getByTestId('age-map-pair')).toHaveCount(0);
  await readyMaps(page.locator('#atlas-data-panel'), 1);
  await expect(page.getByTestId('atlas-map-state')).toHaveAttribute('data-matched-count', '17');
  await expect(page.getByTestId('atlas-map-state')).toHaveAttribute('data-metric', 'share_65_plus');
  await expect(page.getByTestId('metric-select')).toBeEnabled();
});

test('paired maps share selection two-way navigation and vector basemap choices', async ({ page }) => {
  await page.goto(ageUrl);
  const pair = page.getByTestId('age-map-pair'); await readyMaps(pair);
  const share = pair.locator('.atlas-age-map-share'); const count = pair.locator('.atlas-age-map-count');
  await pair.getByLabel('Select paired age map region').selectOption('Prince George');
  await expect(share.locator('.atlas-map-detail')).toContainText('Prince George');
  await expect(count.locator('.atlas-map-detail')).toContainText('18,654');
  await expect(share.locator('.atlas-map-detail')).toContainText('17.7%');
  const a = share.getByTestId('atlas-map-state'), b = count.getByTestId('atlas-map-state');
  await expectSyncedCameras(a, b);
  for (const side of [share, count]) {
    const before = JSON.parse((await a.getAttribute('data-camera'))!).zoom;
    await side.locator('.maplibregl-ctrl-zoom-in').click();
    await expect.poll(async () => JSON.parse((await a.getAttribute('data-camera'))!).zoom - before).toBeGreaterThan(0.9);
    await expectSyncedCameras(a, b);
  }
  await count.getByLabel('Basemap', { exact: true }).selectOption('dark');
  for (const state of [a, b]) await expect(state).toHaveAttribute('data-basemap', 'dark');
  await readyMaps(pair);
  await pair.getByLabel('Select paired age map region').selectOption('Telegraph Creek');
  await expect(count.locator('.atlas-map-detail')).toContainText('245');
  await expect(share.locator('.atlas-map-detail')).toContainText('30.9%');
  await pair.getByLabel('Select paired age map region').selectOption('');
  await expect(pair.locator('.atlas-map-detail')).toHaveCount(0);
});

test('changing age years refreshes exact values while all periods retain 102 ambiguous records', async ({ page, request }) => {
  const dataset = await release(request, 'population-ages');
  await page.goto(ageUrl); const pair = page.getByTestId('age-map-pair'); await readyMaps(pair);
  await page.getByTestId('year-select').selectOption('2024');
  await expect(pair).toHaveAttribute('data-period', '2024');
  await expect(pair.locator('.atlas-age-map-count').getByTestId('atlas-map-state')).toHaveAttribute('data-scale-domain', '[195,18002]');
  await pair.getByText('Read both values for every local health area', { exact: true }).click();
  await expect(pair.locator('.atlas-age-map-values tbody tr')).toHaveCount(17);
  const pg = pair.locator('.atlas-age-map-values tbody tr').filter({ hasText: 'Prince George' });
  await expect(pg).toContainText('18,002'); await expect(pg).toContainText('16.872235%');
  expect(dataset.rows.find(r => r.region_name === 'Prince George' && String(r.year) === '2024')?.population_65_plus).toBe(18002);
  await page.getByTestId('year-select').selectOption('');
  await expect(pair).toHaveAttribute('data-period', 'all');
  await expect(pair.locator('.atlas-age-map-values tbody tr')).toHaveCount(102);
  for (const state of await pair.getByTestId('atlas-map-state').all()) await expect(state).toHaveAttribute('data-matched-count', '0');
  await expect(pair.locator('.atlas-age-map-caption').first()).toContainText('Multiple observations per LHA are withheld');
  await expect(pair.locator('.atlas-age-map-caption').first()).toContainText('table retains every year');
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  await expect(page.locator('.atlas-pagination')).toContainText('of 102 records');
});

test('age stories preserve 2025 projections and compact readers offer accessible expanded maps', async ({ page }, testInfo) => {
  await page.goto('dev/projects/older-populations-share-and-size');
  await expect(page.getByTestId('age-map-pair')).toHaveAttribute('data-period', '2025');
  await readyMaps(page.getByTestId('age-map-pair'));
  await page.goto('dev/projects/northern-communities#older-population-share-and-count');
  const evidence = page.getByTestId('story-evidence');
  await expect(evidence).toHaveAttribute('data-chapter', 'older-population-share-and-count');
  await expect(evidence).toHaveAttribute('data-period', '2025');
  const pair = evidence.getByTestId('age-map-pair');
  if (testInfo.project.name === 'mobile') {
    await expect(pair.getByRole('tablist', { name: 'Age map measure' })).toBeVisible();
    await expect(pair).toHaveAttribute('data-active-view', 'share'); await readyMaps(pair, 1);
    await pair.getByRole('tab', { name: 'Count (people)', exact: true }).click();
    await expect(pair).toHaveAttribute('data-active-view', 'count'); await readyMaps(pair, 1);
    await expect(pair.getByTestId('atlas-map-state')).toHaveAttribute('data-metric', 'population_65_plus');
  } else await readyMaps(pair);
  await pair.getByRole('button', { name: 'Expand maps', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Expanded paired age maps', exact: true });
  await expect(dialog).toBeVisible(); await readyMaps(dialog);
  await dialog.getByLabel('Select expanded paired age map region').selectOption('Telegraph Creek');
  await expect(dialog.locator('.atlas-age-map-count .atlas-map-detail')).toContainText('245');
  await expect(dialog.locator('.atlas-age-map-share .atlas-map-detail')).toContainText('30.9%');
  await dialog.getByRole('button', { name: 'Close expanded maps', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(pair.getByLabel('Select paired age map region')).toHaveValue('Telegraph Creek');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('guided paired age handoff preserves display period and complete geography after reload', async ({ page }) => {
  await page.goto('dev/projects/northern-communities#older-population-share-and-count');
  await expect(page.getByTestId('story-evidence')).toHaveAttribute('data-period', '2025');
  await page.locator('.editorial-slide[data-active="true"]').getByRole('button', { name: 'Explore the source data' }).click();
  await expect(page.getByRole('tab', { name: 'Paired age maps', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('year-select')).toHaveValue('2025');
  const pair = page.getByTestId('age-map-pair'); await readyMaps(pair);
  for (const state of await pair.getByTestId('atlas-map-state').all()) await expect(state).toHaveAttribute('data-matched-count', '17');
  await page.reload(); await expect(page.getByTestId('age-map-pair')).toHaveAttribute('data-period', '2025');
  await expect(page.getByRole('tab', { name: 'Paired age maps', exact: true })).toHaveAttribute('aria-selected', 'true');
});
