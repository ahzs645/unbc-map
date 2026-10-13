import { test, expect } from '@playwright/test';
import { mockBasemaps } from './basemap-fixtures';

test.beforeEach(async ({ page }) => { await mockBasemaps(page); });

test('verified study-site chapter opens the same historical portfolio and selected-site registry records', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('dev/projects/research-pathways#verified-study-sites');
  const state = page.getByTestId('atlas-map-state');
  await expect(state).toHaveAttribute('data-rendered-features', '3');
  await expect(page.getByTestId('story-evidence')).toHaveAttribute('data-dataset', 'trial-sites');
  await expect(page.locator('.editorial-slide[data-active="true"] .atlas-chapter-takeaway')).toContainText('3');
  await expect(page.locator('.atlas-chapter-source')).toContainText('current facility display points');
  await page.locator('.editorial-slide[data-active="true"]').getByRole('button', { name: 'Explore the source data' }).click();
  await expect(page.getByTestId('year-select')).toHaveValue('2026-04-29');
  await page.getByRole('combobox', { name: 'Select map site' }).selectOption('BC Cancer – Prince George (Centre for the North)');
  await page.getByRole('button', { name: 'Study-site records', exact: true }).click();
  await expect(page).toHaveURL(/dataset=trial-site-evidence/);
  await expect(page.getByRole('tab', { name: 'Table', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(7);
  await expect(page.locator('.atlas-data-table tbody').getByRole('link', { name: 'https://clinicaltrials.gov/study/NCT02756793', exact: true })).toHaveAttribute('href', 'https://clinicaltrials.gov/study/NCT02756793');
  await expect(page.locator('.atlas-data-table tbody')).not.toContainText('Prince George Surgery Centre');
  expect(errors).toEqual([]);
});

test('hospital chapter retains Northern fiscal-year reporting scope in the explorer', async ({ page }) => {
  await page.goto('dev/projects/research-pathways#hospital-reporting-sites');
  await expect(page.getByTestId('story-evidence')).toHaveAttribute('data-period', '2024–2025');
  await expect(page.locator('.editorial-slide[data-active="true"] .atlas-chapter-takeaway')).toContainText('$11,093');
  await expect(page.getByTestId('atlas-map-state')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByTestId('atlas-map-state')).toHaveAttribute('data-rendered-features', '18');
  expect((await page.locator('.atlas-map-canvas').boundingBox())!.height).toBeGreaterThanOrEqual(110);
  await page.locator('.editorial-slide[data-active="true"]').getByRole('button', { name: 'Explore the source data' }).click();
  await expect(page.getByTestId('year-select')).toHaveValue('2024–2025');
  await expect(page.getByRole('combobox', { name: 'Source reporting health region' })).toHaveValue('Northern Health (B.C.)');
  await page.getByRole('combobox', { name: 'Select map site' }).selectOption('University Hospital of Northern British Columbia');
  await expect(page.locator('.atlas-map-detail')).toContainText('$11,093');
  await page.getByRole('button', { name: 'Hospital directory', exact: true }).click();
  await expect(page.getByTestId('entity-select')).toHaveValue('University Hospital of Northern British Columbia');
  await expect(page.getByTestId('atlas-map-state')).toHaveAttribute('data-matched-count', '1');
});

test('travel chapters retain route/day filters, schematic links and reviewed precision context', async ({ page }) => {
  await page.goto('dev/projects/travel-and-time#recorded-stop-connections');
  const state = page.getByTestId('atlas-map-state');
  await expect(state).toHaveAttribute('data-ready', 'true');
  await expect(state).toHaveAttribute('data-map-aggregation', 'sum');
  expect((await page.locator('.atlas-map-canvas').boundingBox())!.height).toBeGreaterThanOrEqual(110);
  await expect(state).toHaveAttribute('data-connections', /^[1-9]\d*$/);
  await expect(page.locator('.atlas-chapter-source')).toContainText('schematic schedule connections');
  await page.locator('.editorial-slide[data-active="true"]').getByRole('button', { name: 'Explore the source data' }).click();
  await expect(page.getByRole('combobox', { name: 'Route source key' })).toHaveValue('burns-lake-prince-george-burns-lake');
  await expect(page.getByRole('combobox', { name: 'Recorded service day / direction' })).toHaveValue('Tuesday');
  await expect(page.locator('.atlas-route-legend')).toContainText('schematic');
  await page.goto('dev/projects/travel-and-time#travel-location-precision');
  await expect(page.getByTestId('story-evidence')).toHaveAttribute('data-dataset', 'travel-stop-locations');
  await expect(page.locator('.editorial-slide[data-active="true"] .atlas-chapter-takeaway')).toContainText('280 / 286');
  await expect(page.getByTestId('atlas-map-state')).toHaveAttribute('data-matched-count', '56');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a multi-region story subset stays visible through explorer share, reload and clear', async ({ page, context }) => {
  await page.goto('dev/projects/physician-supply#counts-over-time');
  await expect(page.locator('.atlas-chapter-source')).toContainText('3 source records');
  await page.locator('.editorial-slide[data-active="true"]').getByRole('button', { name: 'Explore the source data' }).click();
  await expect(page.locator('.atlas-results-line')).toContainText('3 of 16 source records');
  await expect(page.locator('.atlas-results-line')).toContainText('3 selected entities');
  const url = new URL(page.url());
  expect(url.searchParams.getAll('entities').sort()).toEqual(['Northeast HSDA', 'Northern Interior HSDA', 'Northwest HSDA']);
  await expect(page.getByTestId('atlas-map-state')).toHaveAttribute('data-matched-count', '3');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Share view', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
  await page.reload();
  await expect(page.locator('.atlas-results-line')).toContainText('3 of 16 source records');
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(3);
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page.locator('.atlas-results-line')).toContainText('16 of 16 source records');
  expect(new URL(page.url()).searchParams.getAll('entities')).toEqual([]);
});
