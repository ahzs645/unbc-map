import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { AtlasDataset } from '../src/atlas/types';
import { mockBasemaps } from './basemap-fixtures';

test.beforeEach(async ({ page }) => { await mockBasemaps(page); });
const allSites = 'All invasive primary cancer sites (including in situ bladder)';

test('archived cancer release preserves original grain, definitions and confidence intervals', async ({ request }) => {
  const release = await (await request.get('data/nhhr/public-expansion.json')).json();
  const cancer: AtlasDataset = release.datasets.find((d: AtlasDataset) => d.id === 'historical-cancer-incidence');
  expect(cancer.rows).toHaveLength(572);
  expect(new Set(cancer.rows.map(r => [r.health_region, r.period, r.sex, r.cancer_site].join('|'))).size).toBe(572);
  expect(cancer.geography).toBe('hr2015');
  expect(cancer.columns.filter(c => c.type === 'number').map(c => c.key)).toEqual(['new_cases', 'crude_rate', 'age_standardized_rate']);
  const latest = cancer.rows.filter(r => r.period === '2013/2015' && r.sex === 'Both sexes' && r.cancer_site === allSites);
  expect(Object.fromEntries(latest.map(r => [r.health_region, [r.new_cases, r.crude_rate, r.age_standardized_rate]]))).toEqual({
    'British Columbia': [71890, 516.2, 467], 'Northwest HSDA': [950, 436.3, 441.1],
    'Northern Interior HSDA': [2175, 512.6, 517.6], 'Northeast HSDA': [750, 349.5, 478.9],
  });
  for (const r of cancer.rows) {
    for (const [metric, low, high] of [['crude_rate', 'crude_ci_low', 'crude_ci_high'], ['age_standardized_rate', 'standardized_ci_low', 'standardized_ci_high']]) {
      if (r[metric] !== null) { expect(Number(r[low])).toBeLessThanOrEqual(Number(r[metric])); expect(Number(r[high])).toBeGreaterThanOrEqual(Number(r[metric])); }
    }
    if (r.new_cases !== null) expect(Number(r.new_cases) % 5).toBe(0);
  }
  const proof = await (await request.get('data/nhhr/public-expansion-provenance.json')).json();
  expect(proof.checks).toMatchObject({ cancerOriginalRowsParsed: 293722, derivedCancerCellsReconciled: 1144, chairOriginalListingRows: 1926 });
  expect(proof.sources[0].sha256).toBe('8ec5c6af703916d69a354be3ba4aba728ddbd0d683cfb0b0db17a3f99b8f190b');
  expect(await readFile('src/atlas/snapshots/public-expansion.json', 'utf8')).toBe(await readFile('public/data/nhhr/public-expansion.json', 'utf8'));
});

test('historical cancer filters, chart and downloaded rows describe the same source subset', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('dev/projects?view=explore&dataset=historical-cancer-incidence');
  await expect(page.getByRole('tab', { name: 'Map', exact: true })).toBeEnabled();
  await page.getByRole('tab', { name: 'Chart', exact: true }).click();
  await page.getByTestId('year-select').selectOption('');
  await expect(page.getByRole('combobox', { name: 'Sex', exact: true })).toHaveValue('Both sexes');
  await expect(page.getByRole('combobox', { name: 'Cancer site', exact: true })).toHaveValue(allSites);
  await expect(page.locator('.atlas-trend-chart')).toBeVisible();
  await expect(page.locator('.atlas-trend-chart')).toHaveAttribute('aria-label', /2001\/2003 to 2013\/2015/);
  await page.getByTestId('year-select').selectOption('2013/2015');
  await page.getByTestId('entity-select').selectOption('Northeast HSDA');
  await expect(page.locator('.atlas-bar-row')).toHaveCount(1);
  await expect(page.locator('.atlas-bar-value')).toContainText('478.9');
  await page.getByTestId('metric-select').selectOption('crude_rate');
  await expect(page.locator('.atlas-bar-value')).toContainText('349.5');
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.atlas-data-table tbody')).toContainText('444.8');
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'CSV', exact: true }).click();
  const csv = await readFile((await (await pending).path())!, 'utf8');
  expect(csv.split(/\r?\n/)).toHaveLength(2);
  expect(csv).toContain('2015A00075953'); expect(csv).toContain('478.9'); expect(csv).toContain('"p"');
  await page.reload(); await expect(page.getByTestId('year-select')).toHaveValue('2013/2015');
  await page.locator('.atlas-source-notes summary').click();
  await expect(page.locator('.atlas-source-notes')).toContainText('December 2015');
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('chair counts retain listing zeros and reviewed campus locations without allocating campus totals', async ({ page, request }) => {
  const data = await (await request.get('data/nhhr/public-expansion.json')).json();
  const chairs: AtlasDataset = data.datasets.find((d: AtlasDataset) => d.id === 'research-chairs');
  expect(chairs.rows).toHaveLength(8);
  for (const r of chairs.rows) {
    expect(Number(r.tier_1_count) + Number(r.tier_2_count)).toBe(r.crc_count);
    expect(Number(r.cihr_count) + Number(r.nserc_count) + Number(r.sshrc_count)).toBe(r.crc_count);
    expect(r).not.toHaveProperty('researcher');
  }
  await page.goto('dev/projects?view=explore&dataset=research-chairs');
  const state = page.getByTestId('atlas-map-state');
  await expect(state).toHaveAttribute('data-ready', 'true');
  await expect(state).toHaveAttribute('data-matched-count', '8');
  await expect(state).toHaveAttribute('data-raster-sources', '0');
  await page.getByTestId('entity-select').selectOption('UNBC / Prince George');
  await expect(state).toHaveAttribute('data-matched-count', '1');
  await expect.poll(async () => JSON.parse((await state.getAttribute('data-rendered-points')) ?? '[]')[0]?.value).toBe(4);
  await page.getByTestId('entity-select').selectOption('NOSM / Thunder Bay');
  await expect.poll(async () => JSON.parse((await state.getAttribute('data-rendered-points')) ?? '[]')[0]?.value).toBe(0);
  await page.getByTestId('entity-select').selectOption('McMaster / Hamilton');
  await expect(state).toHaveAttribute('data-matched-count', '1');
  await expect.poll(async () => JSON.parse((await state.getAttribute('data-rendered-points')) ?? '[]')[0]?.value).toBe(69);
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  await expect(page.locator('.atlas-data-table tbody')).toContainText('69');
  await page.locator('.atlas-source-notes summary').click();
  await expect(page.locator('.atlas-source-notes')).toContainText('not proof of no research chairs');
});

test('new public-source stories open the reviewed measures inside existing UNBC chrome', async ({ page }) => {
  for (const [story, dataset, metric] of [['cancer-rates-and-age', 'historical-cancer-incidence', 'age_standardized_rate'], ['listed-research-chairs', 'research-chairs', 'crc_count']]) {
    await page.goto(`dev/projects?story=${story}`);
    await expect(page.locator('.unbc-logo--header')).toBeVisible();
    await expect(page.locator('.atlas-header')).toHaveCount(0);
    await page.getByRole('button', { name: 'Explore this dataset', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`dataset=${dataset}`));
    await expect(page.getByTestId('metric-select')).toHaveValue(metric);
  }
});
