import { expect, test, type APIRequestContext, type Locator } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { AtlasDataset, AtlasRow } from '../src/atlas/types';
import { mockBasemaps } from './basemap-fixtures';

const explorer = 'dev/projects?view=explore';
const route = 'burns-lake-prince-george-burns-lake';
const missing = ['Mackenzie Junction', 'Small River (Rest Area)'];
type Point = { code: string; value: number | null; radius: number };
type Feature = { geometry: { type: string; coordinates: number[] }; properties: Record<string, string> };
type Segment = { geometry: { type: string; coordinates: number[][] }; properties: { segment_id: string; route_slug: string; service_day: string; source_leg: string; event_ids: string[]; location_codes: string[]; schematic: boolean } };

async function datasets(request: APIRequestContext) {
  const response = await request.get('data/nhhr/travel-network.json');
  expect(response.ok()).toBe(true);
  const release = await response.json() as { datasets: AtlasDataset[]; snapshot: { coverage: Record<string, unknown> } };
  return { events: release.datasets.find(d => d.id === 'travel-stop-events')!, stops: release.datasets.find(d => d.id === 'travel-stop-locations')!, coverage: release.snapshot.coverage };
}
async function points(state: Locator): Promise<Point[]> { return JSON.parse(await state.getAttribute('data-rendered-points') ?? '[]'); }
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

// Provider-independent vector fixture; production basemap access has separate coverage.
test.beforeEach(async ({ page }) => { await mockBasemaps(page); });

test('travel release preserves all source events, explicit precision and unresolved stop labels', async ({ request }) => {
  const { events, stops, coverage } = await datasets(request);
  expect(events.rows).toHaveLength(286);
  expect(events.rows.map(row => row.event_id)).toEqual(Array.from({ length: 286 }, (_, i) => `nhc-event-${String(i + 1).padStart(4, '0')}`));
  expect(events.entityField).toBe('stop_name');
  expect(events.geography).toBe('route');
  expect(events.columns.filter(c => c.type === 'number').map(c => c.key)).toEqual(['event_count']);
  expect(events.rows.every(row => row.event_count === 1 && typeof row.sequence === 'string')).toBe(true);
  expect(events.mapAggregation).toEqual({ method: 'sum', metric: 'event_count' });
  expect(events.mapScaleFields).toEqual(['route_slug', 'service_day']);
  expect(events.defaultFilters).toEqual({ route_slug: route });
  expect(events.mapLocationsAsset).toBe('locations-travel-stops.geojson');
  expect(events.mapConnectionsAsset).toBe('travel-route-connections.geojson');
  expect(events.rows.filter(row => row.location_code)).toHaveLength(280);
  expect(events.rows.filter(row => row.location_precision === 'town')).toHaveLength(184);
  expect(events.rows.filter(row => row.location_precision === 'facility')).toHaveLength(96);
  expect(events.rows.filter(row => !row.location_code)).toHaveLength(6);
  expect([...new Set(events.rows.filter(row => !row.location_code).map(row => row.stop_name))].sort()).toEqual(missing);
  expect(events.rows.filter(row => !row.location_code).every(row => typeof row.unmatched_reason === 'string' && row.unmatched_reason.length > 20)).toBe(true);
  expect(events.rows.filter(row => row.location_precision === 'town').every(row => row.unmatched_reason != null)).toBe(true);
  expect(events.rows.every(row => typeof row.stop_event === 'string' && row.captured_at === '2026-06-16T00:05:20.464524+00:00')).toBe(true);
  expect(events.rows.some(row => String(row.service_day).includes('*'))).toBe(true);
  expect(new Set(events.rows.map(row => row.route_slug)).size).toBe(12);
  expect(new Set(events.rows.map(row => JSON.stringify([row.route_slug, row.service_day]))).size).toBe(18);
  expect(stops.rows).toHaveLength(58);
  expect(stops.rows.filter(row => row.location_code)).toHaveLength(56);
  expect(new Set(stops.rows.filter(row => row.location_code).map(row => row.location_code)).size).toBe(56);
  expect(stops.rows.reduce((total, row) => total + Number(row.recorded_stop_events), 0)).toBe(286);
  expect(stops.rows.filter(row => !row.location_code).map(row => [row.stop_name, row.recorded_stop_events])).toEqual([['Mackenzie Junction', 4], ['Small River (Rest Area)', 2]]);
  expect(coverage).toMatchObject({ sourceEvents: 286, sourceRoutes: 12, sourcePatterns: 18, sourceLegs: 26, mappedEvents: 280, unmappedEvents: 6, reviewedReferencePoints: 56, drawnSchematicSegments: 28, eventPrecision: { town: 184, facility: 96, unmatched: 6 } });
  const forbidden = /^(?:email|phone|contact|participant|patient_id|consent|remuneration)/i;
  expect(events.columns.some(c => forbidden.test(c.key))).toBe(false);
});

test('schematic segments preserve source order and split at missing events and sequence restarts', async ({ request }) => {
  const { events } = await datasets(request);
  const lookup = new Map(events.rows.map(row => [String(row.event_id), row]));
  const pointsResponse = await request.get('data/nhhr/locations-travel-stops.geojson');
  const pointData = await pointsResponse.json() as { features: Feature[] };
  const coordinates = new Map(pointData.features.map(f => [f.properties.code, f.geometry.coordinates]));
  const data = await (await request.get('data/nhhr/travel-route-connections.geojson')).json() as { features: Segment[]; metadata: Record<string, unknown> };
  expect(data.features).toHaveLength(28);
  expect(data.metadata.interpretation).toBe('Schematic connections, not road routes');
  expect(data.metadata.splitAtUnmatchedEvents).toBe(true);
  expect(new Set(events.rows.map(row => JSON.stringify([row.route_slug, row.service_day, row.source_leg]))).size).toBe(26);
  expect(lookup.get('nhc-event-0007')).toMatchObject({ sequence: '7', source_leg: '1' });
  expect(lookup.get('nhc-event-0008')).toMatchObject({ sequence: '1', source_leg: '2' });
  for (const feature of data.features) {
    const p = feature.properties;
    expect(p.schematic).toBe(true);
    expect(feature.geometry.type).toBe('LineString');
    expect(p.event_ids).toEqual([...p.event_ids].sort());
    const rows = p.event_ids.map(id => lookup.get(id)!);
    expect(rows.every(row => row != null && row.location_code != null && row.route_slug === p.route_slug && row.service_day === p.service_day && row.source_leg === p.source_leg)).toBe(true);
    const seq = rows.map(row => Number(row.sequence));
    expect(seq).toEqual(Array.from({ length: seq.at(-1)! - seq[0] + 1 }, (_, i) => seq[0] + i));
    expect(p.location_codes).toEqual(rows.map(row => row.location_code));
    const expected: number[][] = [];
    for (const row of rows) { const coordinate = coordinates.get(String(row.location_code))!; expect(coordinate).toBeDefined(); if (!expected.length || JSON.stringify(expected.at(-1)) !== JSON.stringify(coordinate)) expected.push(coordinate); }
    expect(feature.geometry.coordinates).toEqual(expected);
    expect(expected.length).toBeGreaterThanOrEqual(2);
    expect(expected.every((coordinate, index) => !index || JSON.stringify(coordinate) !== JSON.stringify(expected[index - 1]))).toBe(true);
  }
  const mackenzie = data.features.filter(f => f.properties.route_slug === 'mackenzie-prince-george-mackenzie');
  expect(mackenzie.map(f => f.properties.event_ids)).toEqual([['nhc-event-0071', 'nhc-event-0072'], ['nhc-event-0073', 'nhc-event-0074']]);
  expect(data.features.every(f => !(f.properties.event_ids.includes('nhc-event-0007') && f.properties.event_ids.includes('nhc-event-0008')))).toBe(true);
});

test('point and README assets retain coordinate citations and coarse-location limits', async ({ request }) => {
  const data = await (await request.get('data/nhhr/locations-travel-stops.geojson')).json() as { features: Feature[]; metadata: Record<string, string> };
  expect(data.features).toHaveLength(56);
  expect(new Set(data.features.map(f => f.properties.code)).size).toBe(56);
  expect(data.metadata.attribution).toContain('OpenStreetMap');
  const provenance = await (await request.get('data/nhhr/travel-network-provenance.json')).json();
  expect(provenance.originalSources.map((source: { originalFileId: string }) => source.originalFileId)).toEqual(['935d03b3-f4e1-47da-bcb3-eaefaa288be7', '67188a5a-5c39-43bf-8ad9-ac8a21ca1201']);
  expect(provenance.originalSources.every((source: { sha256: string }) => /^[a-f0-9]{64}$/.test(source.sha256))).toBe(true);
  for (const feature of data.features) {
    expect(feature.geometry.type).toBe('Point');
    expect(feature.geometry.coordinates).toEqual(provenance.coordinateEvidence[feature.properties.code].returnedCoordinates);
    expect(feature.properties.coordinate_source_url).toMatch(/^https:\/\/(?:geocoder\.api\.gov\.bc\.ca|www\.openstreetmap\.org)\//);
    expect(feature.properties.location_note).toMatch(/boarding|pickup/i);
    if (feature.properties.location_precision === 'town') {
      expect(feature.properties.site).toBe('Town representative point');
      expect(provenance.coordinateEvidence[feature.properties.code].matchPrecision).toBe('LOCALITY');
    }
  }
  const canonical = await request.get('data/nhhr/TRAVEL_NETWORK_README.md');
  const alias = await request.get('data/nhhr/locations-travel-stops.README.md');
  expect(canonical.ok()).toBe(true); expect(alias.ok()).toBe(true);
  expect(await alias.text()).toBe(await canonical.text());
  expect(await alias.text()).toContain('schematic connections, not road routes');
  expect(await alias.text()).toContain('not passengers');
});

test('default route renders additive source-event dots on a vector basemap with stable route/day scaling', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${explorer}&dataset=travel-stop-events`);
  const state = page.getByTestId('atlas-map-state');
  await expect(page.getByRole('tab', { name: 'Map', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(state).toHaveAttribute('data-ready', 'true');
  await expect(state).toHaveAttribute('data-feature-count', '56');
  await expect(state).toHaveAttribute('data-matched-count', '32');
  await expect(state).toHaveAttribute('data-map-aggregation', 'sum');
  await expect(state).toHaveAttribute('data-bubble-scale-max', '8');
  await expect(state).toHaveAttribute('data-connections', '4');
  await expect(state).toHaveAttribute('data-rendered-connections', '4');
  await expect(state).toHaveAttribute('data-basemap-status', 'ready');
  await expect(state).toHaveAttribute('data-basemap-format', 'vector');
  await expect(state).toHaveAttribute('data-raster-sources', '0');
  await expect(state).toHaveAttribute('data-basemap-features', /^[1-9]\d*$/);
  await expect.poll(async () => Object.fromEntries((await points(state)).map(p => [p.code, p.value]))).toEqual({
    'nhc-town-burns-lake': 4, 'nhc-town-fraser-lake': 8, 'nhc-town-fort-fraser': 4,
    'nhc-facility-vanderhoof-hospital': 8, 'nhc-town-prince-george': 4, 'nhc-facility-fort-st-james-hospital': 4,
  });
  await expect(page.locator('.atlas-results-line')).toContainText('32 of 286 source records');
  await page.getByRole('combobox', { name: 'Recorded service day / direction', exact: true }).selectOption('Tuesday');
  await expect(state).toHaveAttribute('data-matched-count', '14');
  await expect(state).toHaveAttribute('data-bubble-scale-max', '4');
  await expect(state).toHaveAttribute('data-connections', '2');
  await expect(state).toHaveAttribute('data-rendered-connections', '2');
  await expect.poll(async () => (await points(state)).length).toBe(5);
  const baseline = (await points(state)).find(p => p.code === 'nhc-town-fort-fraser')!;
  const larger = (await points(state)).find(p => p.code === 'nhc-town-fraser-lake')!;
  expect(baseline.value).toBe(2); expect(larger.value).toBe(4);
  expect(baseline.radius ** 2 / larger.radius ** 2).toBeCloseTo(0.5, 7);
  await page.getByTestId('entity-select').selectOption('Fort Fraser (Petrocan)');
  await expect(state).toHaveAttribute('data-matched-count', '2');
  await expect(state).toHaveAttribute('data-bubble-scale-max', '4');
  await expect(state).toHaveAttribute('data-connections', '0');
  await expect(state).toHaveAttribute('data-rendered-connections', '0');
  await expect.poll(async () => (await points(state)).map(p => p.value)).toEqual([2]);
  expect((await points(state))[0].radius).toBeCloseTo(baseline.radius, 6);
  await expect(page.locator('.atlas-institution-scope')).toContainText('representative towns');
  await expect(page.locator('.atlas-institution-scope')).toContainText('schematic, not road routes');
  await expect(page.locator('.atlas-institution-scope').getByRole('link', { name: 'Location sources & caveats', exact: true })).toHaveAttribute('href', /locations-travel-stops\.README\.md$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('source-leg, sequence and search filters hide connections through any missing event IDs', async ({ page }) => {
  await page.goto(`${explorer}&dataset=travel-stop-events&filter.service_day=Tuesday`);
  const state = page.getByTestId('atlas-map-state');
  await expect(state).toHaveAttribute('data-rendered-connections', '2');
  await page.getByRole('combobox', { name: 'Source schedule leg', exact: true }).selectOption('1');
  await expect(state).toHaveAttribute('data-matched-count', '7');
  await expect(state).toHaveAttribute('data-connections', '1');
  await expect(state).toHaveAttribute('data-rendered-connections', '1');
  await expect(state).toHaveAttribute('data-bubble-scale-max', '4');
  // Sequence is retained source metadata, rather than a required technical UI control.
  // Its shared URL filter must still hide lines through missing event IDs.
  const sequenceView = new URL(page.url());
  sequenceView.searchParams.set('filter.sequence', '4');
  await page.goto(sequenceView.href);
  await expect(state).toHaveAttribute('data-matched-count', '1');
  await expect(state).toHaveAttribute('data-connections', '0');
  await expect(state).toHaveAttribute('data-rendered-connections', '0');
  const unsequencedView = new URL(page.url());
  unsequencedView.searchParams.delete('filter.sequence');
  await page.goto(unsequencedView.href);
  await page.getByRole('combobox', { name: 'Source schedule leg', exact: true }).selectOption('');
  await expect(state).toHaveAttribute('data-rendered-connections', '2');
  await page.getByRole('textbox', { name: 'Search within source records', exact: true }).fill('nhc-event-0001');
  await expect(state).toHaveAttribute('data-matched-count', '1');
  await expect(state).toHaveAttribute('data-connections', '0');
  await expect(state).toHaveAttribute('data-rendered-connections', '0');
  await expect(page.locator('.atlas-results-line')).toContainText('1 of 286 source records');
});

test('historical route filters persist through views, share link, reload and exact CSV export', async ({ page, request, context }) => {
  const { events } = await datasets(request);
  await page.goto(`${explorer}&dataset=travel-stop-events&filter.service_day=Tuesday`);
  await page.getByRole('combobox', { name: 'Source schedule leg', exact: true }).selectOption('1');
  await expect(page.getByTestId('atlas-map-state')).toHaveAttribute('data-connections', '1');
  await page.getByRole('tab', { name: 'Chart', exact: true }).click();
  await expect(page.locator('.atlas-bar-row')).toHaveCount(7);
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(7);
  await expect(page.locator('.atlas-data-table tbody')).toContainText('nhc-event-0007');
  await expect(page.locator('.atlas-data-table tbody')).not.toContainText('nhc-event-0008');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Share view', exact: true }).click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toBe(page.url());
  expect(new URL(link).searchParams.get('filter.route_slug')).toBe(route);
  expect(new URL(link).searchParams.get('filter.service_day')).toBe('Tuesday');
  expect(new URL(link).searchParams.get('filter.source_leg')).toBe('1');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Recorded service day / direction', exact: true })).toHaveValue('Tuesday');
  await expect(page.getByRole('combobox', { name: 'Source schedule leg', exact: true })).toHaveValue('1');
  await expect(page.getByRole('tab', { name: 'Table', exact: true })).toHaveAttribute('aria-selected', 'true');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV', exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('nhhr-travel-stop-events-filtered.csv');
  const exported = csvRecords(await readFile((await download.path())!, 'utf8'));
  const originals = events.rows.filter(r => r.route_slug === route && r.service_day === 'Tuesday' && r.source_leg === '1');
  expect(exported).toEqual(expectedCsv(events, originals));
});

test('unresolved stops stay visible in records and CSV without dots or connecting lines', async ({ page, request }) => {
  const { events } = await datasets(request);
  await page.goto(`${explorer}&dataset=travel-stop-events&filter.route_slug=mackenzie-prince-george-mackenzie`);
  const state = page.getByTestId('atlas-map-state');
  await expect(state).toHaveAttribute('data-matched-count', '6');
  await expect(state).toHaveAttribute('data-connections', '2');
  await expect(page.locator('.atlas-map-join-note')).toContainText('2 unmatched rows');
  await page.getByTestId('entity-select').selectOption('Mackenzie Junction');
  await expect(state).toHaveAttribute('data-matched-count', '0');
  await expect(state).toHaveAttribute('data-connections', '0');
  await expect(state).toHaveAttribute('data-rendered-features', '0');
  await expect(state).toHaveAttribute('data-rendered-connections', '0');
  await expect.poll(async () => points(state)).toEqual([]);
  await expect(page.getByRole('combobox', { name: 'Select map stop', exact: true }).locator('option')).toHaveCount(1);
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(2);
  await expect(page.locator('.atlas-data-table tbody')).toContainText('Road-junction stop, not the town of Mackenzie');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV', exact: true }).click();
  const exported = csvRecords(await readFile((await (await downloadEvent).path())!, 'utf8'));
  const originals = events.rows.filter(r => r.route_slug === 'mackenzie-prince-george-mackenzie' && r.stop_name === 'Mackenzie Junction');
  expect(exported).toEqual(expectedCsv(events, originals));
  expect(exported.slice(1).every(row => row[events.columns.findIndex(c => c.key === 'location_code')] === '')).toBe(true);
});

test('stop summary maps unique references and preserves all 286 counted events with two unknown rows', async ({ page, request }) => {
  const { stops } = await datasets(request);
  await page.goto(`${explorer}&dataset=travel-stop-locations`);
  const state = page.getByTestId('atlas-map-state');
  await expect(state).toHaveAttribute('data-ready', 'true');
  await expect(state).toHaveAttribute('data-feature-count', '56');
  await expect(state).toHaveAttribute('data-matched-count', '56');
  await expect(state).toHaveAttribute('data-map-aggregation', 'none');
  await expect.poll(async () => (await points(state)).length).toBe(56);
  expect((await points(state)).reduce((sum, p) => sum + Number(p.value), 0)).toBe(280);
  await expect(page.locator('.atlas-results-line')).toContainText('58 of 58 source records');
  await expect(page.locator('.atlas-map-join-note')).toContainText('2 unmatched rows');
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV', exact: true }).click();
  const exported = csvRecords(await readFile((await (await downloadEvent).path())!, 'utf8'));
  expect(exported).toEqual(expectedCsv(stops, stops.rows));
  await page.getByTestId('entity-select').selectOption('Small River (Rest Area)');
  await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.atlas-data-table tbody')).toContainText('unrelated River Jordan');
});
