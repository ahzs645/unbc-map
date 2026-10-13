import type { Page } from '@playwright/test';

// Local vector reference geometry keeps behaviour checks independent of the
// provider's uptime. Production vector tiles are checked separately in-browser.
export async function mockBasemaps(page: Page) {
  await page.route('https://basemaps.cartocdn.com/gl/**/style.json', route => route.fulfill({ json: {
    version: 8,
    sources: { reference: { type: 'geojson', attribution: 'Test reference vector basemap', data: { type: 'FeatureCollection', features: [
      { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-169,20],[-40,20],[-40,75],[-169,75],[-169,20]]] } },
      { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-132,54],[-120,59]] } },
    ] } } },
    layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#f1efe9' } }, { id: 'reference-land', type: 'fill', source: 'reference', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#e1ebe1' } }, { id: 'reference-road', type: 'line', source: 'reference', filter: ['==', '$type', 'LineString'], paint: { 'line-color': '#666', 'line-width': 2 } }],
  } }));
}
