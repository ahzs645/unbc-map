import { test, expect } from '@playwright/test';
import { mockBasemaps } from './basemap-fixtures';

test.beforeEach(async ({ page }) => { await mockBasemaps(page); });

test('story basemaps load and switching preserves the camera, canvas and data', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('dev/projects/northern-communities');
  const state = page.getByTestId('atlas-map-state');
  await expect(state).toHaveAttribute('data-basemap-status', 'ready');
  await expect(state).toHaveAttribute('data-matched-count', '17');
  await expect(state).toHaveAttribute('data-basemap-format', 'vector');
  await expect(state).toHaveAttribute('data-raster-sources', '0');
  await expect(state).toHaveAttribute('data-rendered-features', /^[1-9]\d*$/);
  await expect(page.getByRole('combobox', { name: 'Basemap', exact: true })).toHaveValue('streets');
  const camera = await state.getAttribute('data-camera');
  const canvas = await page.locator('.atlas-chapter-view:not(.is-dormant) .atlas-map-canvas canvas').elementHandle(); // hidden views are warmed in advance
  await page.getByRole('combobox', { name: 'Basemap', exact: true }).selectOption('dark');
  await expect(state).toHaveAttribute('data-basemap-status', 'ready');
  await expect(state).toHaveAttribute('data-basemap-features', /^[1-9]\d*$/);
  await expect(state).toHaveAttribute('data-camera', camera!);
  await expect(state).toHaveAttribute('data-matched-count', '17');
  await expect(state).toHaveAttribute('data-basemap-format', 'vector');
  await expect(state).toHaveAttribute('data-raster-sources', '0');
  expect(await canvas!.evaluate(element => element.isConnected)).toBe(true);
  const attribution = page.locator('.atlas-chapter-view:not(.is-dormant) .maplibregl-ctrl-attrib');
  await expect(attribution).toContainText('Test reference vector basemap');
  await expect(attribution).toContainText('Province of British Columbia');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('comparison basemaps switch together and retain synchronized source views', async ({ page }) => {
  await page.goto('dev/projects/physician-supply#counts-over-time');
  const states = page.getByTestId('atlas-map-state');
  await expect(states).toHaveCount(2);
  await expect(states.nth(0)).toHaveAttribute('data-basemap-status', 'ready');
  await expect(states.nth(1)).toHaveAttribute('data-basemap-status', 'ready');
  await page.getByRole('combobox', { name: 'Basemap', exact: true }).selectOption('dark');
  for (let index = 0; index < 2; index++) {
    await expect(states.nth(index)).toHaveAttribute('data-basemap', 'dark');
    await expect(states.nth(index)).toHaveAttribute('data-basemap-status', 'ready');
    await expect(states.nth(index)).toHaveAttribute('data-matched-count', '3');
    await expect(states.nth(index)).toHaveAttribute('data-rendered-features', /^[1-9]\d*$/);
    await expect(states.nth(index)).toHaveAttribute('data-scale-domain', '[0,147]');
  }
  await expect.poll(async () => (await states.nth(0).getAttribute('data-camera')) === (await states.nth(1).getAttribute('data-camera'))).toBe(true);
  await expect(states.nth(0)).toHaveAttribute('data-metric', 'specialists_2020');
  await expect(states.nth(1)).toHaveAttribute('data-metric', 'specialists_2024');
});

test('a basemap outage leaves the geographic data and accessible records available', async ({ page }) => {
  await page.route('https://basemaps.cartocdn.com/gl/**/style.json', route => route.fulfill({ status: 503, body: 'Unavailable', headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.goto('dev/projects/northern-communities');
  await expect(page.getByTestId('basemap-notice')).toContainText('Basemap unavailable');
  const state = page.getByTestId('atlas-map-state');
  await expect(state).toHaveAttribute('data-ready', 'true');
  await expect(state).toHaveAttribute('data-matched-count', '17');
  await expect(state).toHaveAttribute('data-basemap-format', 'vector');
  await expect(state).toHaveAttribute('data-raster-sources', '0');
  await expect(state).toHaveAttribute('data-rendered-features', /^[1-9]\d*$/);
  await page.getByText('Read the regional values', { exact: true }).first().click();
  await expect(page.locator('.atlas-chapter-values').first()).toContainText('105,544');
});

test('a provider raster style is rejected while source point data remain usable', async ({ page }) => {
  await page.route('https://basemaps.cartocdn.com/gl/**/style.json', route => route.fulfill({ json: {
    version: 8, sources: { raster: { type: 'raster', tiles: ['https://example.invalid/{z}/{x}/{y}.png'], tileSize: 256 } },
    layers: [{ id: 'raster', source: 'raster', type: 'raster' }],
  }, headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.goto('dev/projects?view=explore&dataset=trial-sites');
  const state = page.getByTestId('atlas-map-state');
  await expect(state).toHaveAttribute('data-basemap-status', 'unavailable');
  await expect(state).toHaveAttribute('data-raster-sources', '0');
  await expect(state).toHaveAttribute('data-basemap-error', /required vector geometry/);
  await expect(state).toHaveAttribute('data-rendered-features', '3');
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  await expect(page.locator('.atlas-data-table tbody')).toContainText('NCT02756793');
});
