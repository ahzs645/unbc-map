import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { AtlasDataset } from '../src/atlas/types';
import { mockBasemaps } from './basemap-fixtures';

const explorer = 'dev/projects?view=explore';
const rn = 'Registered nurses and registered psychiatric nurses';
const diabetesIncidence = 'Diabetes Mellitus age-standardized incidence rate per 1000 population (1+ yrs)';
const diabetesPrevalence = 'Diabetes Mellitus age-standardized lifetime prevalence rate per 1000 population (1+ yrs)';
const collectionIds = {
  supply: '91de0066-9343-4d0f-9138-03766520ddc0',
  indicators: 'b4d850b9-494b-4de6-96c3-2951defae583',
  enrolment: '43482dd7-5cee-417b-b339-a203a343d5ee',
};

test.beforeEach(async ({ page }) => { await mockBasemaps(page); });

async function release(request: APIRequestContext): Promise<AtlasDataset[]> {
  const response = await request.get('data/nhhr/community-followup.json');
  expect(response.ok()).toBe(true);
  return (await response.json()).datasets;
}

async function sourceCsv(page: Page): Promise<string> {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV', exact: true }).click();
  return readFile((await (await pending).path())!, 'utf8');
}

test('BC supply sources retain original model cells, rounding, zeros and ragged age/NOC coverage', async ({ request }) => {
  const datasets = await release(request);
  expect(Object.fromEntries(datasets.map(d => [d.id, d.rows.length]))).toEqual({
    'bc-graduate-projections': 468, 'bc-health-occupation-projections': 996,
    'community-disease-incidence': 240, 'community-disease-prevalence': 240, 'institution-enrolment': 7,
  });
  const graduates = datasets.find(d => d.id === 'bc-graduate-projections')!;
  const occupations = datasets.find(d => d.id === 'bc-health-occupation-projections')!;
  for (const d of [graduates, occupations]) {
    expect(d.datasetId).toBe(collectionIds.supply);
    expect(d.status).toBe('projection');
    expect(d.geography).toBe('none');
    expect(d.rows.every(r => r.population_type === 'Projection' && r.model_prepared_date === '2024-12-20')).toBe(true);
    expect(new Set(d.rows.map(r => `${r.age_group}|${r[d.entityField]}|${r.period}`)).size).toBe(d.rows.length);
    expect(new Set(d.rows.map(r => r.period)).size).toBe(12);
    expect(d.rows.every(r => r.geographic_scope === 'British Columbia')).toBe(true);
  }
  expect(graduates.rows.every(r => Number(r.projected_graduates) % 5 === 0)).toBe(true);
  expect(graduates.rows.filter(r => r.projected_graduates === 0 && r.source_raw === '0')).toHaveLength(12);
  const bachelor = graduates.rows.filter(r => r.age_group === '17 to 29' && r.credential_type === 'Baccalaureate degree');
  expect(bachelor[0]).toMatchObject({ original_period: '2023/2024', projected_graduates: 21965 });
  expect(bachelor.at(-1)).toMatchObject({ original_period: '2034/2035', projected_graduates: 23590 });
  expect(occupations.rows.filter(r => r.projected_occupation_entries === 0 && r.source_raw === '0')).toHaveLength(66);
  const nursing = occupations.rows.filter(r => r.age_group === '17 to 29' && r.noc_code === '31301');
  expect(nursing[0]).toMatchObject({ occupation: rn, original_period: '2023/24', projected_occupation_entries: 1441 });
  expect(nursing.at(-1)).toMatchObject({ original_period: '2034/35', projected_occupation_entries: 1554 });
  expect(occupations.rows.some(r => r.noc_code === '31202' && r.age_group === '45 to 64')).toBe(false);
  expect(occupations.rows.some(r => r.noc_code === '31103' && r.occupation === 'Veterinarians')).toBe(true);
  const provenance = await (await request.get('data/nhhr/community-followup-provenance.json')).json();
  expect(provenance.sources.pssm.originalFileId).toBe('9c3033e2-6284-4748-9b23-e9f5221cc8f2');
  expect(provenance.sources.pssm.sha256).toBe('c8f5f4c9a31dbfb311b8dd48c9d9c25b96dc662879a22099f5b0cb6d815018a9');
  expect(provenance.sourceGuideEvidence).toMatchObject({ preparedDate: '2024-12-20', surveyYears: '2019–2023', graduateRounding: 5, occupationRounding: 1 });
  expect(provenance.quality.omittedAgeNOCCellsFilled).toBe(0);
});

test('graduate charts disclose projections, keep exact fiscal CSV labels and preserve visible filter changes', async ({ page }) => {
  await page.goto(`${explorer}&dataset=bc-graduate-projections`);
  await expect(page.getByTestId('entity-select')).toHaveValue('Baccalaureate degree');
  await expect(page.getByRole('combobox', { name: 'Age group', exact: true })).toHaveValue('17 to 29');
  await expect(page.locator('.atlas-dataset-header .atlas-badge')).toHaveText('Projection');
  await expect(page.locator('.atlas-data-caution-projection')).toContainText('Published source projections');
  await expect(page.getByRole('tab', { name: 'Map', exact: true })).toBeDisabled();
  const chart = page.locator('.atlas-trend-chart');
  await expect(chart.getByRole('button', { name: 'Baccalaureate degree, 2023–2024 (Projection): 21,965 projected graduates', exact: true })).toBeAttached();
  await expect(chart.getByRole('button', { name: 'Baccalaureate degree, 2034–2035 (Projection): 23,590 projected graduates', exact: true })).toBeAttached();
  await expect(chart.locator('circle[fill="#fff"]')).toHaveCount(12);
  await expect(chart.locator('path[stroke-dasharray="5 4"]')).toHaveAttribute('d', /L/);
  await expect(page.locator('.atlas-chart-footnote').filter({ hasText: 'source projection' })).toContainText('Hollow points and dashed lines');
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(12);
  const csv = await sourceCsv(page);
  expect(csv.split(/\r?\n/)).toHaveLength(13);
  expect(csv).toContain('"2023–2024","2023/2024","Projection"');
  expect(csv).toContain('21965');
  await page.getByRole('combobox', { name: 'Age group', exact: true }).selectOption('45 to 64');
  await page.getByTestId('entity-select').selectOption('Apprenticeship certificate');
  await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(12);
  await expect(page.locator('.atlas-data-table tbody td.is-number')).toHaveText(Array(12).fill('0'));
  await expect(page.locator('.atlas-data-table tbody')).not.toContainText('Not reported');
  await page.getByTestId('entity-select').selectOption('');
  await expect(page.locator('.atlas-results-line')).toContainText('156 of 468 source records');
  await page.reload();
  await expect(page.getByTestId('entity-select')).toHaveValue('');
  await expect(page.getByRole('combobox', { name: 'Age group', exact: true })).toHaveValue('45 to 64');
  await expect(page.locator('.atlas-results-line')).toContainText('156 of 468 source records');
  await page.locator('.atlas-source-notes summary').click();
  await expect(page.locator('.atlas-source-notes')).toContainText('rounded to five');
  await expect(page.locator('.atlas-source-notes')).toContainText('cannot be allocated to campuses');
});

test('occupation projections use the original nursing series and show absent age combinations honestly', async ({ page }) => {
  await page.goto(`${explorer}&dataset=bc-health-occupation-projections`);
  await expect(page.getByTestId('entity-select')).toHaveValue(rn);
  await expect(page.getByRole('combobox', { name: 'Age group', exact: true })).toHaveValue('17 to 29');
  await expect(page.getByRole('tab', { name: 'Map', exact: true })).toBeDisabled();
  await expect(page.locator('.atlas-trend-chart').getByRole('button', { name: `${rn}, 2023–2024 (Projection): 1,441 projected entrants`, exact: true })).toBeAttached();
  await expect(page.locator('.atlas-trend-chart').getByRole('button', { name: `${rn}, 2034–2035 (Projection): 1,554 projected entrants`, exact: true })).toBeAttached();
  await page.getByTestId('entity-select').selectOption('Physiotherapists');
  await page.getByRole('combobox', { name: 'Age group', exact: true }).selectOption('45 to 64');
  await expect(page.locator('.atlas-results-line')).toContainText('0 of 996 source records');
  await expect(page.getByText('No reported numeric values in this view.', { exact: true })).toBeVisible();
  await expect(page.locator('.atlas-trend-chart')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Age group', exact: true }).selectOption('30 to 44');
  await expect(page.locator('.atlas-trend-chart').getByRole('button', { name: 'Physiotherapists, 2023–2024 (Projection): 54 projected entrants', exact: true })).toBeAttached();
  await expect(page.locator('.atlas-trend-chart').getByRole('button', { name: 'Physiotherapists, 2034–2035 (Projection): 68 projected entrants', exact: true })).toBeAttached();
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  const csv = await sourceCsv(page);
  expect(csv).toContain('"31202"');
  expect(csv).toContain('"2023–2024","2023/24","Projection"');
  expect(csv).not.toContain('"45 to 64"');
  await page.reload();
  await expect(page.getByTestId('entity-select')).toHaveValue('Physiotherapists');
  await expect(page.getByRole('combobox', { name: 'Age group', exact: true })).toHaveValue('30 to 44');
  await page.locator('.atlas-source-notes summary').click();
  await expect(page.locator('.atlas-source-notes')).toContainText('veterinary/animal-health occupations');
  await expect(page.locator('.atlas-source-notes')).toContainText('omitted age/NOC combinations remain absent');
});

test('community indicator originals supply Northern HA rates with separate definitions and no CHSA observations', async ({ request }) => {
  const datasets = await release(request);
  for (const id of ['community-disease-incidence', 'community-disease-prevalence']) {
    const d = datasets.find(item => item.id === id)!;
    expect(d.datasetId).toBe(collectionIds.indicators);
    expect(d.geography).toBe('ha');
    expect(d.boundaryKeyField).toBe('source_location_id');
    expect(d.mapLabelField).toBe('jurisdiction_name');
    expect(d.mapScaleFields).toEqual(['indicator', 'sex']);
    expect(d.rows).toHaveLength(240);
    expect(new Set(d.rows.map(r => `${r.indicator}|${r.sex}|${r.period}`)).size).toBe(240);
    expect(new Set(d.rows.map(r => r.period)).size).toBe(20);
    expect(d.rows.every(r => r.source_location_type === 'HA' && r.source_location_id === '5' && r.jurisdiction_name === 'Northern HA')).toBe(true);
    expect(d.rows.every(r => r.source_unit === 'Per 1000 population' && r.data_source === 'BC Chronic Disease Registry')).toBe(true);
    expect(d.rows.every(r => typeof r.rate_per_1000 === 'number' && Number(r.source_raw) === r.rate_per_1000)).toBe(true);
    expect(d.notes.join(' ')).toContain('contains no CHSA measurements');
    expect(d.rows.some(r => r.source_location_type === 'CHSA')).toBe(false);
  }
  const incidence = datasets.find(d => d.id === 'community-disease-incidence')!;
  const prevalence = datasets.find(d => d.id === 'community-disease-prevalence')!;
  expect(incidence.rows.some(r => r.source_raw === '6.0' && r.rate_per_1000 === 6)).toBe(true);
  expect(incidence.rows.find(r => r.indicator === diabetesIncidence && r.sex === 'Total' && r.period === '2020–2021')).toMatchObject({ rate_per_1000: 7.5, original_period: 'FY 2020.2021', measure_kind: 'Age-standardized incidence' });
  expect(prevalence.rows.find(r => r.indicator === diabetesPrevalence && r.sex === 'Total' && r.period === '2020–2021')).toMatchObject({ rate_per_1000: 90.9, original_period: 'FY 2020.2021', measure_kind: 'Age-standardized lifetime prevalence' });
  const provenance = await (await request.get('data/nhhr/community-followup-provenance.json')).json();
  expect(provenance.quality.communitySelectedRawRows).toBe(653);
  expect(provenance.quality.communityFiscalRowsReleased).toBe(480);
  expect(provenance.quality.communityCHSAScientificRows).toBe(0);
  const geometry = await (await request.get('data/nhhr/boundaries-ha.geojson')).json();
  expect(geometry.features.filter((f: { properties: { code: string } }) => f.properties.code === '5')).toHaveLength(1);
});

test('incidence defaults to history and maps one exact Northern HA record while withholding ambiguous rows', async ({ page }) => {
  await page.goto(`${explorer}&dataset=community-disease-incidence`);
  await expect(page.getByRole('tab', { name: 'Chart', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('entity-select')).toHaveValue(diabetesIncidence);
  await expect(page.getByRole('combobox', { name: 'Source sex category', exact: true })).toHaveValue('Total');
  await expect(page.locator('.atlas-trend-chart').getByRole('button', { name: `${diabetesIncidence}, 2020–2021: 7.5 per 1,000`, exact: true })).toBeAttached();
  await page.getByRole('tab', { name: 'Map', exact: true }).click();
  await expect(page.getByTestId('year-select')).toHaveValue('2020–2021');
  const state = page.getByTestId('atlas-map-state');
  await expect(state).toHaveAttribute('data-ready', 'true');
  await expect(state).toHaveAttribute('data-geometry', 'polygons');
  await expect(state).toHaveAttribute('data-matched-count', '1');
  await expect(state).toHaveAttribute('data-basemap-format', 'vector');
  await expect(state).toHaveAttribute('data-raster-sources', '0');
  await expect(state).toHaveAttribute('data-rendered-features', /^[1-9]\d*$/);
  const mapRegion = page.getByRole('combobox', { name: 'Select map region', exact: true });
  await expect(mapRegion.locator('option')).toHaveText(['All regions', 'Northern HA']);
  await mapRegion.selectOption({ label: 'Northern HA' });
  await expect(mapRegion).toHaveValue(diabetesIncidence);
  await expect(page.locator('.atlas-map-detail strong')).toHaveText('Northern HA');
  await expect(page.locator('.atlas-map-detail')).toContainText('7.5 per 1,000');
  await expect(page.locator('.atlas-map-detail')).toContainText('Total · 2020–2021');
  await page.getByTestId('entity-select').selectOption('');
  await expect(state).toHaveAttribute('data-matched-count', '0');
  await expect(page.locator('.atlas-map-join-note')).toContainText('4 ambiguous rows withheld');
  await expect(page.locator('.atlas-map-legend')).toContainText('No value');
  await page.getByTestId('entity-select').selectOption(diabetesIncidence);
  await page.getByRole('combobox', { name: 'Source sex category', exact: true }).selectOption('');
  await expect(state).toHaveAttribute('data-matched-count', '0');
  await expect(page.locator('.atlas-map-join-note')).toContainText('3 ambiguous rows withheld');
  await mapRegion.selectOption({ label: 'Northern HA' });
  await expect(page.locator('.atlas-map-detail')).toContainText('Multiple observations');
  await page.locator('.atlas-source-notes summary').click();
  await expect(page.locator('.atlas-source-notes')).toContainText('historical boundary vintage is unverified');
  await expect(page.locator('.atlas-source-notes')).toContainText('No HA aggregate is spread across CHSAs');
  await expect(page.locator('.atlas-source-notes')).toContainText(collectionIds.indicators);
  await expect(page.locator('.atlas-source-notes').getByRole('link', { name: 'Open source reference' })).toHaveAttribute('href', 'https://communityhealth.phsa.ca/');
});

test('lifetime prevalence keeps historical fiscal labels and its source rate in map, table and CSV', async ({ page }) => {
  await page.goto(`${explorer}&dataset=community-disease-prevalence`);
  await expect(page.getByRole('tab', { name: 'Chart', exact: true })).toHaveAttribute('aria-selected', 'true');
  const chart = page.locator('.atlas-trend-chart');
  await expect(chart.getByRole('button', { name: `${diabetesPrevalence}, 2001–2002: 58.5 per 1,000`, exact: true })).toBeAttached();
  await expect(chart.getByRole('button', { name: `${diabetesPrevalence}, 2020–2021: 90.9 per 1,000`, exact: true })).toBeAttached();
  await expect(chart.locator('text').filter({ hasText: '2001–2002' })).toBeAttached();
  await expect(chart.locator('text').filter({ hasText: '2020–2021' })).toBeAttached();
  await expect(chart.locator('circle[fill="#fff"]')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Map', exact: true }).click();
  await expect(page.getByTestId('atlas-map-state')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByTestId('atlas-map-state')).toHaveAttribute('data-matched-count', '1');
  await page.getByRole('combobox', { name: 'Select map region', exact: true }).selectOption({ label: 'Northern HA' });
  await expect(page.locator('.atlas-map-detail')).toContainText('90.9 per 1,000');
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.atlas-data-table tbody')).toContainText('FY 2020.2021');
  await expect(page.locator('.atlas-data-table tbody')).toContainText('Age-standardized lifetime prevalence');
  const csv = await sourceCsv(page);
  expect(csv.split(/\r?\n/)).toHaveLength(2);
  expect(csv).toContain('"HA","5","Total","2020–2021","FY 2020.2021"');
  expect(csv).toContain('90.9');
  await page.reload();
  await expect(page.getByTestId('entity-select')).toHaveValue(diabetesPrevalence);
  await expect(page.getByTestId('year-select')).toHaveValue('2020–2021');
});

test('Fall 2025 enrolment preserves seven institution category totals without composite or city-ratio inventions', async ({ request }) => {
  const d = (await release(request)).find(item => item.id === 'institution-enrolment')!;
  expect(d.datasetId).toBe(collectionIds.enrolment);
  expect(d.geography).toBe('institution');
  expect(d.rows).toHaveLength(7);
  const totals: Record<string, number> = {
    'Calgary / Calgary': 38113, 'Dalhousie / Halifax': 21249, 'Lakehead / Thunder Bay': 8499,
    'UBC / Vancouver': 73636, 'UNBC / Prince George': 3263, 'USask / Saskatoon': 23260, 'McMaster / Hamilton': 37579,
  };
  expect(Object.fromEntries(d.rows.map(r => [r.comparator, r.total_enrolment]))).toEqual(totals);
  expect(new Set(d.rows.map(r => `${r.comparator}|${r.academic_year}`)).size).toBe(7);
  for (const row of d.rows) {
    expect(row.source_period).toBe('Fall 2025');
    expect(row.academic_year).toBe('2025');
    expect(row.enrolment_scope).toBe('Published institution total; campus allocation unestablished');
    expect(['full_time_undergraduate', 'full_time_graduate', 'part_time_undergraduate', 'part_time_graduate'].reduce((sum, key) => sum + Number(row[key]), 0)).toBe(row.total_enrolment);
    expect(Object.keys(row).some(key => /ratio|population|per_1000/i.test(key))).toBe(false);
  }
  expect(d.rows.some(r => /NOSM|BC Cancer/.test(String(r.comparator)))).toBe(false);
  expect(d.rows.some(r => r.total_enrolment === 9035)).toBe(false);
  const provenance = await (await request.get('data/nhhr/community-followup-provenance.json')).json();
  expect(provenance.sources.enrolment.originalFileId).toBe('16f272af-7c4d-4450-b4d0-f3a1348ac90e');
  expect(provenance.sources.enrolment.sha256).toBe('48112d838bfa75c70dd965ca3c70086ed33b682ff616235510e06c3660ec0f9e');
  expect(provenance.enrolmentVerification.records).toHaveLength(7);
  expect(provenance.enrolmentVerification.sourceUrl).toBe('https://univcan.ca/about-universities-canada/facts-and-stats/enrolment-by-university/');
  expect(provenance.quality.cityRatiosEmitted).toBe(0);
  expect(provenance.quality.NOSMEnrolmentInferred).toBe(false);
});

test('institution enrolment maps preserve institutional scope and share the filtered UNBC source record with chart and export', async ({ page }) => {
  await page.goto(`${explorer}&dataset=institution-enrolment`);
  await expect(page.getByTestId('year-select')).toHaveValue('2025');
  const state = page.getByTestId('atlas-map-state');
  await expect(state).toHaveAttribute('data-ready', 'true');
  await expect(state).toHaveAttribute('data-geometry', 'points');
  await expect(state).toHaveAttribute('data-matched-count', '7');
  await expect(state).toHaveAttribute('data-rendered-features', '7');
  await expect(state).toHaveAttribute('data-basemap-format', 'vector');
  await expect(state).toHaveAttribute('data-raster-sources', '0');
  await expect.poll(async () => JSON.parse(await state.getAttribute('data-rendered-points') || '[]').length).toBe(7);
  const points = JSON.parse(await state.getAttribute('data-rendered-points') || '[]') as { code: string; value: number }[];
  expect(points.find(p => p.code === 'unbc')?.value).toBe(3263);
  expect(points.find(p => p.code === 'lakehead')?.value).toBe(8499);
  const institution = page.getByRole('combobox', { name: 'Select map institution', exact: true });
  await expect(institution.locator('option[value="NOSM / Thunder Bay"]')).toHaveCount(0);
  await expect(page.locator('.atlas-institution-scope')).toContainText('institution as a whole');
  await institution.selectOption('UNBC / Prince George');
  await expect(page.locator('.atlas-map-detail')).toContainText('3,263 enrolments');
  await page.getByTestId('entity-select').selectOption('UNBC / Prince George');
  await expect(state).toHaveAttribute('data-matched-count', '1');
  await page.getByRole('tab', { name: 'Chart', exact: true }).click();
  await expect(page.locator('.atlas-bar-row')).toHaveCount(1);
  await expect(page.locator('.atlas-bar-row')).toContainText('3,263 enrolments');
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.atlas-data-table tbody')).toContainText('Fall 2025');
  await expect(page.locator('.atlas-data-table tbody')).toContainText('campus allocation unestablished');
  const csv = await sourceCsv(page);
  expect(csv.split(/\r?\n/)).toHaveLength(2);
  expect(csv).toContain('"UNBC / Prince George"');
  expect(csv).toContain('"2303","567","329","64","3263"');
  expect(csv).not.toContain('2021');
  await page.locator('.atlas-source-notes summary').click();
  await expect(page.locator('.atlas-source-notes')).toContainText('workbook city ratios are held');
  await expect(page.locator('.atlas-source-notes')).toContainText('NOSM is absent rather than zero');
  await expect(page.locator('.atlas-source-notes').getByRole('link', { name: 'Open source reference' })).toHaveAttribute('href', 'https://univcan.ca/about-universities-canada/facts-and-stats/enrolment-by-university/');
});
