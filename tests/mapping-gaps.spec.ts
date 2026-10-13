import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { mockBasemaps } from './basemap-fixtures';

const combined = 'North Coast and Nechako, British Columbia';
const combinedCode = 'lfs-north-coast-nechako-2021';
test.beforeEach(async ({ page }) => { await mockBasemaps(page); });

function polygonArea(coordinates: number[][][]): number {
  const areas = coordinates.map(ring => Math.abs(ring.reduce((sum, point, i) => {
    const next = ring[(i + 1) % ring.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0) / 2));
  return areas[0] - areas.slice(1).reduce((sum, area) => sum + area, 0);
}
function area(geometry: { type: string; coordinates: any }): number {
  return geometry.type === 'Polygon' ? polygonArea(geometry.coordinates) : geometry.coordinates.reduce((sum: number, polygon: number[][][]) => sum + polygonArea(polygon), 0);
}

test('archived regions, the combined survey polygon and McMaster retain independently verified geometry receipts', async ({ request }) => {
  const get = async (asset: string) => { const response = await request.get(`data/nhhr/${asset}`); expect(response.ok()).toBe(true); return response.json(); };
  const proof = await get('mapping-connections-provenance.json');
  expect(proof.sources.find((s: any) => s.name === 'HR_059b11a_e.zip').sha256).toBe('96a9633d00b467399190a38c95e0b6c601fdf4c90734d5f0648580655f93fc43');
  expect(proof.historicalCancer).toMatchObject({ boundaryVintage: 'December 2015', originalCRS: 'EPSG:3347', outputCRS: 'EPSG:4326', provinceAggregateMapped: false });
  const health = await get('boundaries-hr2015.geojson');
  expect(health.features.map((f: any) => f.properties.code).sort()).toEqual(['2015A00075951', '2015A00075952', '2015A00075953']);
  const native = await get('boundaries-er.geojson'), labour = await get('boundaries-lfs-er-2021.geojson');
  expect(native.features).toHaveLength(8); expect(labour.features).toHaveLength(7);
  const union = labour.features.find((f: any) => f.properties.code === combinedCode);
  expect(union.properties.source_boundary_codes).toEqual(['5960', '5970']);
  expect(labour.features.some((f: any) => ['5960', '5970'].includes(f.properties.code))).toBe(false);
  const components = native.features.filter((f: any) => ['5960', '5970'].includes(f.properties.code));
  expect(area(union.geometry)).toBeCloseTo(components.reduce((sum: number, f: any) => sum + area(f.geometry), 0), 8);
  expect(proof.combinedLabourRegion.sourceDguidRemainsBlank).toBe(true);
  const locations = await get('locations-institutions.geojson');
  expect(locations.features).toHaveLength(9);
  const mcmaster = locations.features.find((f: any) => f.properties.code === 'mcmaster');
  expect(mcmaster.geometry.coordinates).toEqual([-79.91783, 43.26394]);
  expect(mcmaster.properties.site).toContain('1280 Main Street West');
  expect(mcmaster.properties.coordinate_source_url).toBe('https://www.openstreetmap.org/way/23122301');
  expect(proof.mcmaster.pointWithinCampusPolygon).toBe(true);
});

test('historical cancer map keeps the BC benchmark unallocated and shows only one window per polygon', async ({ page }, testInfo) => {
  await page.goto('dev/projects?view=explore&dataset=historical-cancer-incidence&display=map');
  const state = page.getByTestId('atlas-map-state');
  await expect(state).toHaveAttribute('data-ready', 'true');
  await expect(state).toHaveAttribute('data-feature-count', '3');
  await expect(state).toHaveAttribute('data-matched-count', '3');
  await expect(state).toHaveAttribute('data-raster-sources', '0');
  await expect(page.locator('.atlas-map-join-note')).toContainText('1 unmatched rows');
  await expect(page.getByTestId('year-select')).toHaveValue('2013/2015');
  await expect(page.getByRole('link', { name: 'Boundary provenance', exact: true })).toHaveAttribute('href', /mapping-connections-provenance\.json$/);
  await page.getByRole('combobox', { name: 'Select map region', exact: true }).selectOption('Northeast HSDA');
  await expect(page.locator('.atlas-map-detail')).toContainText('478.9');
  await page.getByTestId('metric-select').selectOption('crude_rate');
  await page.getByRole('combobox', { name: 'Select map region', exact: true }).selectOption('Northeast HSDA');
  await expect(page.locator('.atlas-map-detail')).toContainText('349.5');
  await page.screenshot({ path: testInfo.outputPath('historical-cancer-map.png') });
  await page.getByTestId('entity-select').selectOption('Northeast HSDA');
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'CSV', exact: true }).click();
  const csv = await readFile((await (await pending).path())!, 'utf8');
  expect(csv.split(/\r?\n/)).toHaveLength(2); expect(csv).toContain('2015A00075953'); expect(csv).toContain('478.9'); expect(csv).toContain('444.8');
  await page.getByTestId('entity-select').selectOption('');
  await page.getByTestId('year-select').selectOption('');
  await expect(state).toHaveAttribute('data-matched-count', '0');
  await expect(page.locator('.atlas-map-join-note')).toContainText('39 ambiguous rows withheld');
  await page.getByTestId('year-select').selectOption('2013/2015');
  await expect(state).toHaveAttribute('data-matched-count', '3');
  await expect(page.locator('.unbc-logo--header')).toBeVisible();
});

test('combined monthly labour retains original blank identifiers and the same source values in map, records and CSV', async ({ page, request }, testInfo) => {
  const release = await (await request.get('data/nhhr/regional-expansion.json')).json();
  const dataset = release.datasets.find((d: any) => d.id === 'regional-labour-monthly');
  const rows = dataset.rows.filter((r: any) => r.region_name === combined);
  expect(rows).toHaveLength(27);
  expect(rows.every((r: any) => r.er_code === null && r.source_dguid === '' && r.map_region_code === combinedCode)).toBe(true);
  const latest = rows.find((r: any) => r.period === '2026-03');
  await page.goto(`dev/projects?view=explore&dataset=regional-labour-monthly&display=map&entity=${encodeURIComponent(combined)}`);
  const state = page.getByTestId('atlas-map-state');
  await expect(state).toHaveAttribute('data-ready', 'true');
  await expect(state).toHaveAttribute('data-feature-count', '7');
  await expect(state).toHaveAttribute('data-matched-count', '1');
  await expect(page.getByTestId('year-select')).toHaveValue('2026-03');
  await page.getByRole('combobox', { name: 'Select map region', exact: true }).selectOption(combined);
  await expect(page.locator('.atlas-map-detail')).toContainText(String(latest.unemployment_rate));
  await page.getByTestId('metric-select').selectOption('employment_thousands');
  await page.getByRole('combobox', { name: 'Select map region', exact: true }).selectOption(combined);
  await expect(page.locator('.atlas-map-detail')).toContainText(`${latest.employment_thousands} thousand people`);
  await page.screenshot({ path: testInfo.outputPath('combined-labour-map.png') });
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(1);
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'CSV', exact: true }).click();
  const csv = await readFile((await (await pending).path())!, 'utf8');
  expect(csv).toContain(combinedCode); expect(csv).toContain(String(latest.employment_thousands)); expect(csv).not.toContain('2021S05005960');
  await page.reload(); await expect(page.getByTestId('entity-select')).toHaveValue(combined);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Sources distinguishes completed mappings and separately attributed CHSA measurements', async ({ page, request }, testInfo) => {
  const review = await (await request.get('data/nhhr/catalogue-review.json')).json();
  expect(review.boundaryProposals.filter((r: any) => r.status === 'connected')).toHaveLength(4);
  expect(review.boundaryProposals.filter((r: any) => r.status === 'pending')).toHaveLength(0);
  expect(review.supplementalViews).toHaveLength(2);
  await page.goto('dev/projects?view=sources');
  const catalogue = page.getByRole('region', { name: 'NHHR Zoer datasets', exact: true });
  await expect(catalogue).toContainText('Historical cancer regions');
  await expect(page.getByRole('region', {name:'Verified source supplements', exact:true})).toContainText('separate from the 85 NHHR Zoer catalogue entries');
  const receipt = catalogue.getByRole('link', { name: 'Mapping verification receipts', exact: true });
  expect((await request.get((await receipt.getAttribute('href'))!)).ok()).toBe(true);
  await expect(page.locator('.unbc-logo--header')).toBeVisible();
  for (const title of ['Archived cancer incidence', 'Combined North Coast and Nechako labour estimates', 'McMaster institutional comparator', 'Finer community health maps']) {
    await catalogue.locator('details').filter({ has: page.locator('summary', { hasText: title }) }).locator('summary').click();
  }
  await page.getByRole('heading', { name: 'Mapping connections and remaining gaps', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('mapping-connections.png') });
});
