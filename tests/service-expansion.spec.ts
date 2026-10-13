import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { AtlasDataset } from '../src/atlas/types';
import { mockBasemaps } from './basemap-fixtures';

const explorer = 'dev/projects?view=explore';
const rnWages = 'Registered nurses and registered psychiatric nurses';
const rnVacancies = 'Registered nurses and registered psychiatric nurses*';
const sourceIds = {
  workforce: '0c0cb2db-d9ab-43bf-8e1b-e023141f493f',
  wages: '79b129e1-414b-4b85-9d63-66ab334081fc',
  sector: 'bc5f8ecd-98b3-4185-ada5-ceb71adcbf00',
};

test.beforeEach(async ({ page }) => { await mockBasemaps(page); });

async function release(request: APIRequestContext): Promise<AtlasDataset[]> {
  const response = await request.get('data/nhhr/service-expansion.json');
  expect(response.ok()).toBe(true);
  return (await response.json()).datasets;
}

async function downloadCsv(page: Page): Promise<string> {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV', exact: true }).click();
  return readFile((await (await pending).path())!, 'utf8');
}

test('service sources retain five bounded grains, exact identifiers and independent workforce values', async ({ request }) => {
  const datasets = await release(request);
  expect(Object.fromEntries(datasets.map(d => [d.id, d.rows.length]))).toEqual({
    'allied-health-northern': 90, 'health-occupation-wages': 30,
    'bc-hospital-staffing': 35, 'bc-health-occupation-vacancies': 120, 'bc-sector-wages': 58,
  });
  const allied = datasets.find(d => d.id === 'allied-health-northern')!;
  expect(allied.datasetId).toBe(sourceIds.workforce);
  expect(allied.geography).toBe('hsda');
  expect(new Set(allied.rows.map(r => `${r.profession}|${r.hsda_code}|${r.year}`)).size).toBe(90);
  const expected: Record<string, number[]> = {
    'Occupational therapists': [26, 45, 11], 'Pharmacists': [60, 139, 45], 'Physiotherapists': [57, 83, 20],
  };
  for (const [profession, counts] of Object.entries(expected)) {
    const latest = allied.rows.filter(r => r.profession === profession && r.year === '2024')
      .sort((a, b) => String(a.hsda_code).localeCompare(String(b.hsda_code)));
    expect(latest.map(r => r.hsda_code)).toEqual(['51', '52', '53']);
    expect(latest.map(r => r.direct_care_count)).toEqual(counts);
  }
  expect(allied.columns.find(c => c.key === 'direct_care_per_10k')?.unit).toBe('per 10,000');
  expect(allied.rows.some(r => String(r.profession).includes('nurse'))).toBe(false);
  const provenance = await (await request.get('data/nhhr/service-expansion-provenance.json')).json();
  expect(provenance.sources.ot.originalFileId).toBe('d0f45a99-dba3-4392-88a2-c9c209a3c43f');
  expect(provenance.sources.quickstats.originalFileId).toBe('2c1d2bdc-c767-4b4a-96e4-6426c0f278a8');
  expect(provenance.sources.jobbank.sha256).toBe('7bd29fb41b2a84eb61a4dbf49bfb63651a8a694c62ce42ac69cb785679d66328');
  expect(provenance.sourceBindings).toHaveLength(391);
});

test('allied-health maps use native HSDAs and one profession with the published count and rate', async ({ page, request }) => {
  const boundaries = await (await request.get('data/nhhr/boundaries-hsda.geojson')).json();
  for (const code of ['51', '52', '53']) expect(boundaries.features.some((f: { properties: { code: string } }) => f.properties.code === code)).toBe(true);
  await page.goto(`${explorer}&dataset=allied-health-northern`);
  await expect(page.getByTestId('year-select')).toHaveValue('2024');
  await expect(page.getByRole('combobox', { name: 'Profession', exact: true })).toHaveValue('Occupational therapists');
  const state = page.getByTestId('atlas-map-state');
  await expect(state).toHaveAttribute('data-ready', 'true');
  await expect(state).toHaveAttribute('data-geometry', 'polygons');
  await expect(state).toHaveAttribute('data-matched-count', '3');
  await expect(state).toHaveAttribute('data-basemap-format', 'vector');
  await expect(state).toHaveAttribute('data-raster-sources', '0');
  await page.getByRole('combobox', { name: 'Profession', exact: true }).selectOption('Physiotherapists');
  await page.getByRole('combobox', { name: 'Select map region', exact: true }).selectOption('Northwest HSDA');
  await expect(page.locator('.atlas-map-detail')).toContainText('Direct-care professionals per 10,000: 7.3');
  await page.getByTestId('metric-select').selectOption('direct_care_count');
  await page.getByRole('combobox', { name: 'Select map region', exact: true }).selectOption('Northwest HSDA');
  await expect(page.locator('.atlas-map-detail')).toContainText('Professionals in direct care: 57');
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(3);
  await expect(page.locator('.atlas-data-table tbody')).toContainText('Physiotherapists');
  await expect(page.locator('.atlas-data-table tbody')).not.toContainText('Occupational therapists');
});

test('regional healthcare wage maps preserve ER codes, provincial fallback and the unmatched BC aggregate', async ({ page, request }) => {
  const datasets = await release(request);
  const wages = datasets.find(d => d.id === 'health-occupation-wages')!;
  expect(wages.datasetId).toBe(sourceIds.wages);
  expect(new Set(wages.rows.map(r => `${r.noc_code}|${r.source_er_code}`)).size).toBe(30);
  expect(wages.rows.filter(r => r.median_hourly_wage === null)).toHaveLength(13);
  const geometry = await (await request.get('data/nhhr/boundaries-er.geojson')).json();
  expect(geometry.features).toHaveLength(8);
  const codes = geometry.features.map((f: { properties: { code: string } }) => f.properties.code);
  for (const code of ['5950', '5960', '5970', '5980']) expect(codes).toContain(code);
  expect(codes).not.toContain('59');
  await page.goto(`${explorer}&dataset=health-occupation-wages`);
  await expect(page.getByRole('combobox', { name: 'Occupation', exact: true })).toHaveValue(rnWages);
  const state = page.getByTestId('atlas-map-state');
  await expect(state).toHaveAttribute('data-ready', 'true');
  await expect(state).toHaveAttribute('data-feature-count', '8');
  await expect(state).toHaveAttribute('data-matched-count', '4');
  await expect(page.locator('.atlas-map-join-note')).toContainText('1 unmatched rows');
  await page.getByRole('combobox', { name: 'Select map region', exact: true }).selectOption('Cariboo');
  await expect(page.locator('.atlas-map-detail')).toContainText('47.58 CAD/hour');
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(5);
  const cariboo = page.locator('.atlas-data-table tbody tr').filter({ has: page.getByRole('cell', { name: 'Cariboo', exact: true }) });
  await expect(cariboo).toContainText('LFS 2023-24 PR NOC5');
  await expect(cariboo).toContainText('Provincial source');
  await page.locator('.atlas-source-notes summary').click();
  await expect(page.locator('.atlas-source-notes')).toContainText('no historical boundary harmonization is claimed');
  await expect(page.locator('.atlas-source-notes')).toContainText('does not establish identical regional wages');
});

test('missing regional wage estimates stay null in map, table and source CSV', async ({ page }) => {
  await page.goto(`${explorer}&dataset=health-occupation-wages`);
  await page.getByRole('combobox', { name: 'Occupation', exact: true }).selectOption('Nurse practitioners');
  await page.getByTestId('entity-select').selectOption('Cariboo');
  await expect(page.getByTestId('atlas-map-state')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.atlas-map-legend')).toContainText('No value');
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  const row = page.locator('.atlas-data-table tbody tr');
  await expect(row).toHaveCount(1);
  await expect(row.locator('td.is-number')).toHaveText(['Not reported', 'Not reported', 'Not reported']);
  await expect(row).toContainText('Due to data limitations');
  const csv = await downloadCsv(page);
  expect(csv.split(/\r?\n/)).toHaveLength(2);
  expect(csv).toContain('"Cariboo","Economic region","5950","ER5950","Nurse practitioners","NOC_31302","","","","","","","Not reported","NA"');
  await page.reload();
  await expect(page.getByTestId('entity-select')).toHaveValue('Cariboo');
  await expect(page.getByRole('combobox', { name: 'Occupation', exact: true })).toHaveValue('Nurse practitioners');
});

test('provincial service defaults remain visible, changeable and cleared after reload', async ({ page }) => {
  const cases = [
    { id: 'bc-hospital-staffing', initial: 'Nursing inpatient services', next: 'Ambulatory care services', count: '5', all: '35' },
    { id: 'bc-health-occupation-vacancies', initial: rnVacancies, next: 'Pharmacists', count: '10', all: '120' },
    { id: 'bc-sector-wages', initial: 'Health care and social assistance [62]', next: 'Total employees, all industries', count: '29', all: '58' },
  ];
  for (const item of cases) {
    await page.goto(`${explorer}&dataset=${item.id}&display=table`);
    await expect(page.getByTestId('entity-select')).toHaveValue(item.initial);
    await expect(page.locator('.atlas-results-line')).toContainText(`${item.count} of ${item.all} source records`);
    await page.getByTestId('entity-select').selectOption(item.next);
    await expect(page.locator('.atlas-results-line')).toContainText(`${item.count} of ${item.all} source records`);
    await expect(page.locator('.atlas-data-table tbody')).toContainText(item.next);
    await page.reload();
    await expect(page.getByTestId('entity-select')).toHaveValue(item.next);
    await page.getByTestId('entity-select').selectOption('');
    await expect(page.locator('.atlas-results-line')).toContainText(`${item.all} of ${item.all} source records`);
    await page.reload();
    await expect(page.getByTestId('entity-select')).toHaveValue('');
    await expect(page.locator('.atlas-results-line')).toContainText(`${item.all} of ${item.all} source records`);
    await expect(page.getByRole('tab', { name: 'Map', exact: true })).toBeDisabled();
    await expect(page.getByTestId('atlas-map-state')).toHaveCount(0);
  }
});

test('hospital staffing preserves source hours, overtime denominator and fiscal trend labels', async ({ page, request }) => {
  const d = (await release(request)).find(d => d.id === 'bc-hospital-staffing')!;
  expect(d.datasetId).toBe(sourceIds.workforce);
  expect(d.geography).toBe('none');
  expect(new Set(d.rows.map(r => `${r.service_area}|${r.fiscal_year}`)).size).toBe(35);
  const latest = d.rows.find(r => r.service_area === 'Nursing inpatient services' && r.fiscal_year === '2023–2024')!;
  expect(latest.overtime_hours).toBe(5279940);
  expect(latest.regular_worked_hours).toBe(39538903);
  expect(latest.purchased_hours).toBe(1645845);
  expect(latest.paid_sick_hours).toBe(2639068);
  expect(latest.overtime_share_pct as number).toBeCloseTo(11.78062539, 8);
  await page.goto(`${explorer}&dataset=bc-hospital-staffing&display=chart`);
  const chart = page.locator('.atlas-trend-chart');
  await expect(chart.getByRole('button', { name: 'Nursing inpatient services, 2023–2024: 11.78%', exact: true })).toBeAttached();
  const labels = await chart.locator('text').allTextContents();
  expect(labels).toContain('2019–2020');
  expect(labels).toContain('2023–2024');
  for (const period of ['2019–2020', '2020–2021', '2021–2022', '2022–2023', '2023–2024']) {
    await expect(chart.getByRole('button', { name: new RegExp(`^Nursing inpatient services, ${period}:`) })).toBeAttached();
  }
  await page.locator('.atlas-source-notes summary').click();
  await expect(page.locator('.atlas-source-notes')).toContainText('Purchased hours and benefit hours are excluded');
  await expect(page.locator('.atlas-source-notes')).toContainText('24 April 2025');
});

test('vacancy fiscal estimates preserve X and F, original year labels and source composition units', async ({ page, request }) => {
  const d = (await release(request)).find(d => d.id === 'bc-health-occupation-vacancies')!;
  expect(d.geography).toBe('none');
  expect(new Set(d.rows.map(r => `${r.occupation}|${r.source_year}`)).size).toBe(120);
  expect(d.rows.filter(r => r.vacancy_raw === 'X')).toHaveLength(20);
  expect(d.rows.filter(r => r.vacancy_raw === 'F')).toHaveLength(12);
  expect(d.rows.filter(r => ['X', 'F'].includes(String(r.vacancy_raw))).every(r => r.average_vacancies === null)).toBe(true);
  const latest = d.rows.find(r => r.occupation === rnVacancies && r.source_year === '2024')!;
  expect(latest.fiscal_year).toBe('2024–2025');
  expect(latest.average_vacancies).toBe(3780);
  expect(latest.share_of_health_vacancies_pct).toBeCloseTo(26.7, 8);
  expect(d.rows.filter(r => r.source_year === '2020').every(r => r.quarters_in_estimate === '2020Q4; 2021Q1')).toBe(true);
  await page.goto(`${explorer}&dataset=bc-health-occupation-vacancies&display=table`);
  await page.getByTestId('entity-select').selectOption('Nurse practitioners');
  await page.getByTestId('year-select').selectOption('2016–2017');
  const row = page.locator('.atlas-data-table tbody tr');
  await expect(row).toHaveCount(1);
  await expect(row.locator('td.is-number')).toHaveText(['Not reported', 'Not reported']);
  await expect(row.getByRole('cell', { name: 'X', exact: true })).toHaveCount(2);
  await expect(row).toContainText('Suppressed for confidentiality');
  const csv = await downloadCsv(page);
  expect(csv).toContain('"Nurse practitioners","2016","2016–2017","","","X","X","Suppressed for confidentiality"');
  await page.getByTestId('year-select').selectOption('2015–2016');
  await expect(row.getByRole('cell', { name: 'F', exact: true })).toHaveCount(2);
  await expect(row).toContainText('Unreliable data');
  await page.locator('.atlas-source-notes summary').click();
  await expect(page.locator('.atlas-source-notes')).toContainText('They are not vacancies divided by all filled and vacant jobs');
});

test('sector wage charts retain nominal hourly and weekly units without a provincial map', async ({ page, request }) => {
  const d = (await release(request)).find(d => d.id === 'bc-sector-wages')!;
  expect(d.datasetId).toBe(sourceIds.sector);
  expect(new Set(d.rows.map(r => `${r.sector}|${r.year}`)).size).toBe(58);
  const latest = d.rows.find(r => r.sector === 'Health care and social assistance [62]' && r.year === '2025')!;
  expect([latest.average_hourly_wage, latest.average_weekly_wage]).toEqual([38.24, 1309.11]);
  await page.goto(`${explorer}&dataset=bc-sector-wages&display=chart`);
  await expect(page.locator('.atlas-trend-chart').getByRole('button', { name: 'Health care and social assistance [62], 2025: 38.24 CAD/hour', exact: true })).toBeAttached();
  await expect(page.locator('.atlas-results-line')).toContainText('CAD/hour');
  await page.getByTestId('metric-select').selectOption('average_weekly_wage');
  await expect(page.locator('.atlas-trend-chart').getByRole('button', { name: 'Health care and social assistance [62], 2025: 1,309.11 CAD/week', exact: true })).toBeAttached();
  await expect(page.locator('.atlas-results-line')).toContainText('CAD/week');
  await expect(page.getByRole('tab', { name: 'Map', exact: true })).toBeDisabled();
  await page.locator('.atlas-source-notes summary').click();
  await expect(page.locator('.atlas-source-notes')).toContainText('no inflation adjustment');
});

test('service stories connect to their reviewed datasets and keep the existing UNBC surface', async ({ page }) => {
  const stories = [
    ['allied-health-context', 'allied-health-northern', 'direct_care_per_10k'],
    ['regional-health-wages', 'health-occupation-wages', 'median_hourly_wage'],
    ['hospital-worked-hours', 'bc-hospital-staffing', 'overtime_share_pct'],
    ['vacancies-and-reporting', 'bc-health-occupation-vacancies', 'average_vacancies'],
  ];
  for (const [story, dataset, metric] of stories) {
    await page.goto(`dev/projects?view=stories&story=${story}`);
    await expect(page.locator('.atlas-story-narrative')).toBeVisible();
    await expect(page.locator('.unbc-header')).toBeVisible();
    await page.getByRole('button', { name: 'Explore this dataset', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`dataset=${dataset}`));
    await expect(page.getByTestId('metric-select')).toHaveValue(metric);
  }
});
