import { test, expect } from '@playwright/test';
import { mockBasemaps } from './basemap-fixtures';

const explorer = 'dev/projects?view=explore&dataset=nursing-workforce-northern';
test.beforeEach(async ({ page }) => { await mockBasemaps(page); });

test('nursing source grain preserves missing markers, published rates and a genuine zero', async ({ request }) => {
  const release = await (await request.get('data/nhhr/nursing-workforce.json')).json();
  const dataset = release.datasets[0];
  expect(dataset.rows).toHaveLength(120);
  expect(new Set(dataset.rows.map((row: Record<string, unknown>) => `${row.hsda_code}|${row.nursing_type}|${row.year}`)).size).toBe(120);
  expect(dataset.defaultFilters).toEqual({ nursing_type: 'Registered nurses' });
  const missing = dataset.rows.filter((row: Record<string, unknown>) => row.year === '2019' && row.nursing_type === 'Registered psychiatric nurses');
  expect(missing).toHaveLength(3);
  expect(missing.every((row: Record<string, unknown>) => row.direct_care_nurses === null && row.direct_care_per_10k === null && row.source_direct_care_nurses_raw === '—' && row.source_direct_care_per_10k_raw === '—')).toBe(true);
  const zero = dataset.rows.find((row: Record<string, unknown>) => row.hsda_code === '53' && row.year === '2018' && row.nursing_type === 'Nurse practitioners');
  expect(zero.direct_care_nurses).toBe(0);
  expect(zero.direct_care_per_10k).toBe(0);
  expect(zero.direct_care_status).toBe('Reported');
  const practitioners = dataset.rows.filter((row: Record<string, unknown>) => row.year === '2024' && row.nursing_type === 'Nurse practitioners');
  expect(practitioners.map((row: Record<string, unknown>) => [row.hsda_code, row.direct_care_nurses, row.direct_care_per_10k])).toEqual([['51', 14, 1.8], ['52', 28, 1.8], ['53', 7, 1]]);
  expect(dataset.columns.find((column: { key: string }) => column.key === 'direct_care_per_10k').unit).toBe('per 10,000');
});

test('nursing opens on one type and period, preserving deliberate all-type ambiguity on reload', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(explorer);
  await expect(page.getByTestId('year-select')).toHaveValue('2024');
  const type = page.getByRole('combobox', { name: 'Nursing type', exact: true });
  await expect(type).toHaveValue('Registered nurses');
  const state = page.getByTestId('atlas-map-state');
  await expect(state).toHaveAttribute('data-matched-count', '3');
  await expect(state).toHaveAttribute('data-rendered-features', /^[1-9]\d*$/);
  await page.getByRole('combobox', { name: 'Select map region' }).selectOption('Northwest HSDA');
  await expect(page.locator('.atlas-map-detail')).toContainText('66.1');
  await type.selectOption('Nurse practitioners');
  await expect(state).toHaveAttribute('data-matched-count', '3');
  await page.getByRole('combobox', { name: 'Select map region' }).selectOption('Northeast HSDA');
  await expect(page.locator('.atlas-map-detail')).toContainText('1');
  await type.selectOption('');
  await expect(state).toHaveAttribute('data-matched-count', '0');
  await expect(page.locator('.atlas-map-join-note')).toContainText('12 ambiguous rows withheld');
  await page.reload();
  await expect(type).toHaveValue('');
  await expect(page.locator('.atlas-map-join-note')).toContainText('12 ambiguous rows withheld');
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(12);
  expect(errors).toEqual([]);
});

test('nursing trends keep gaps and explain the published denominator', async ({ page }) => {
  await page.goto(`${explorer}&display=chart&filter.nursing_type=Registered%20psychiatric%20nurses`);
  await expect(page.locator('.atlas-trend-chart circle[role="button"]')).toHaveCount(27);
  const labels = await page.locator('.atlas-trend-chart circle[role="button"]').evaluateAll(elements => elements.map(element => element.getAttribute('aria-label')));
  expect(labels.some(label => label?.includes(', 2019:'))).toBe(false);
  await page.locator('.atlas-source-notes summary').click();
  await expect(page.locator('.atlas-source-notes')).toContainText('not recalculated using Atlas population');
  await expect(page.locator('.atlas-source-notes')).toContainText('not full-time equivalents');
  await page.getByTestId('year-select').selectOption('2019');
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(3);
  await expect(page.locator('.atlas-data-table tbody')).toContainText('Not reported');
  await expect(page.locator('.atlas-data-table tbody')).toContainText('—');
});

test('new nursing and age story chapters retain their source period and type in the explorer', async ({ page }) => {
  await page.goto('dev/projects/physician-supply#nursing-alongside-physicians');
  await expect(page.getByTestId('story-reader')).toHaveAttribute('data-active-chapter', 'nursing-alongside-physicians');
  await expect(page.getByTestId('atlas-map-state')).toHaveAttribute('data-matched-count', '3');
  await expect(page.locator('.atlas-chapter-evidence-heading')).toContainText('Nurse practitioners');
  await page.locator('.editorial-slide[data-active="true"]').getByRole('button', { name: 'Explore the source data', exact: true }).click();
  await expect(page.getByTestId('year-select')).toHaveValue('2024');
  await expect(page.getByRole('combobox', { name: 'Nursing type', exact: true })).toHaveValue('Nurse practitioners');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Nursing type', exact: true })).toHaveValue('Nurse practitioners');
  await page.goto('dev/projects/northern-communities#population-age-structure');
  await expect(page.getByTestId('story-reader')).toHaveAttribute('data-active-chapter', 'population-age-structure');
  await expect(page.getByTestId('story-evidence')).toHaveAttribute('data-period', '2025');
  await expect(page.locator('.atlas-chapter-evidence-heading')).toContainText('Projection');
});

test('the connection register documents verified views and remaining location gaps', async ({ page, request }) => {
  const review = await (await request.get('data/nhhr/connections-review.json')).json();
  expect(review.manifestRevision).toBe(93);
  expect(review.implemented).toHaveLength(57);
  expect(new Set(review.implemented.map((item: { datasetId: string }) => item.datasetId)).size).toBe(57);
  expect(review.implemented.map((item: { datasetId: string }) => item.datasetId)).toEqual(expect.arrayContaining(['hospital-facilities', 'hospital-facility-costs', 'trial-sites', 'trial-site-evidence', 'travel-stop-events', 'travel-stop-locations']));
  expect(JSON.stringify(review)).not.toContain('/Users/');
  await page.goto('dev/projects?view=sources');
  const register = page.getByRole('region', { name: 'Dataset connections', exact: true });
  await expect(register.locator('tbody tr')).toHaveCount(18);
  await expect(register).toContainText('city-centre coordinates are excluded');
  await expect(register).toContainText('do not contain road-route geometry');
  await register.getByRole('button', { name: 'BC standard hospital stay costs', exact: true }).click();
  await expect(page.getByTestId('atlas-map-state')).toHaveAttribute('data-matched-count', '5');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
