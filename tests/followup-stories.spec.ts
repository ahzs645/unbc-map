import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import type { AtlasDataset, AtlasStory } from '../src/atlas/types';
import type { AtlasStoryMap } from '../src/atlas/storyMaps';
import { mockBasemaps } from './basemap-fixtures';

const definitions: { followupStoryMaps?: AtlasStoryMap[] } = {};
new Function('exports', ts.transpileModule(readFileSync('src/atlas/followupStoryMaps.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(definitions);
const narratives: { followupStories?: AtlasStory[] } = {};
new Function('exports', ts.transpileModule(readFileSync('src/atlas/followupStories.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(narratives);

test.beforeEach(async ({ page }) => { await mockBasemaps(page); });

for (const story of definitions.followupStoryMaps!) for (const chapter of story.chapters) {
  test(`follow-up guide ${story.id}/${chapter.id} preserves its source subset and handoff`, async ({ page, request }, testInfo) => {
    const doc = await (await request.get('data/nhhr/catalogue-review.json')).json();
    const datasets: AtlasDataset[] = [];
    for (const asset of doc.releaseAssets) datasets.push(...(await (await request.get(`data/nhhr/${asset}.json`)).json()).datasets);
    const d = datasets.find(item => item.id === chapter.evidence.datasetId)!;
    const { evidence } = chapter;
    const rows = d.rows.filter(row => (!evidence.year || String(row[d.timeField!]) === evidence.year) && (!evidence.entities?.length || evidence.entities.includes(String(row[d.entityField]))) && Object.entries(evidence.filters ?? {}).every(([key, value]) => String(row[key]) === value));
    expect(rows.length).toBeGreaterThan(0);
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`dev/projects/${story.id}#${chapter.id}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(story.title);
    const source = page.getByTestId('story-evidence');
    await expect(source).toHaveAttribute('data-dataset', d.id);
    await expect(source).toHaveAttribute('data-chapter', chapter.id);
    await expect(source.locator('.atlas-chapter-source')).toContainText(`${rows.length} source records`);
    if (evidence.kind === 'map') {
      const state = source.getByTestId('atlas-map-state');
      await expect(state).toHaveAttribute('data-ready', 'true');
      await expect(state).toHaveAttribute('data-basemap-format', 'vector');
      await expect(state).toHaveAttribute('data-raster-sources', '0');
      await expect.poll(async () => Number(await state.getAttribute('data-matched-count'))).toBeGreaterThan(0);
      if (testInfo.project.name === 'mobile' && d.geography === 'chsa') {
        const canvas = source.locator('.atlas-map-canvas');
        await expect(canvas).toBeVisible();
        expect((await canvas.boundingBox())!.height).toBeGreaterThan(120);
      }
    } else await expect(source.getByTestId('atlas-map-state')).toHaveCount(0);
    if (testInfo.project.name === 'mobile' && evidence.kind === 'chart') {
      const viz = source.locator('.atlas-chapter-viz');
      const chart = source.locator('.atlas-trend-chart');
      const plot = await chart.count() ? chart : source.locator('.atlas-bar-row').first();
      await expect(plot).toBeVisible();
      const frame = (await viz.boundingBox())!, graphic = (await plot.boundingBox())!;
      expect(graphic.y).toBeGreaterThanOrEqual(frame.y);
      expect(graphic.y + graphic.height).toBeLessThanOrEqual(frame.y + frame.height + 1);
    }
    if (d.status === 'projection') {
      await expect(source.locator('.atlas-trend-chart')).toBeVisible();
      await expect(source.locator('.atlas-trend-chart')).toContainText('Projection');
    }
    await page.locator('.editorial-slide[data-active="true"]').getByRole('button', { name: 'Explore the source data', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`dataset=${d.id}`));
    await expect(page.getByTestId('metric-select')).toHaveValue(evidence.metric);
    await expect(page.getByTestId('year-select')).toHaveValue(evidence.year ?? '');
    for (const [key, value] of Object.entries(evidence.filters ?? {})) {
      const control = key === d.entityField ? page.getByTestId('entity-select') : page.getByRole('combobox', { name: d.columns.find(col => col.key === key)!.label, exact: true });
      await expect(control).toHaveValue(value);
    }
    await expect(page.locator('.atlas-results-line')).toContainText(`${rows.length.toLocaleString()} of ${d.rows.length.toLocaleString()} source records`);
    await page.reload();
    await expect(page.getByTestId('metric-select')).toHaveValue(evidence.metric);
    await expect(page.getByTestId('year-select')).toHaveValue(evidence.year ?? '');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });
}

for (const story of narratives.followupStories!) {
  test(`short source story ${story.id} opens its dataset within the UNBC design`, async ({ page }) => {
    await page.goto(`dev/projects?story=${story.id}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(story.title);
    await expect(page.locator('.unbc-logo--header text')).toHaveText(['Northern Hub for', 'Health Research']);
    await expect(page.locator('.atlas-source-notes')).toBeAttached();
    await page.getByRole('button', { name: 'Explore this dataset', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`dataset=${story.datasetId}`));
    await expect(page.getByTestId('metric-select')).toHaveValue(story.metric);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
}

test('negative published changes remain signed in charts and tables instead of proportional dots', async ({ page }) => {
  await page.goto('dev/projects?view=explore&dataset=university-research-intensity');
  await expect(page.getByTestId('atlas-map-state')).toHaveAttribute('data-matched-count', '7');
  await page.getByTestId('metric-select').selectOption('reported_income_change_pct');
  await expect(page.getByRole('tab', { name: 'Chart', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Map', exact: true })).toBeDisabled();
  await expect(page.locator('.atlas-geography-note')).toContainText('signed values');
  await page.getByRole('tab', { name: 'Table', exact: true }).click();
  await expect(page.locator('.atlas-data-table tbody tr').filter({ hasText: 'McMaster / Hamilton' })).toContainText('-9.2');
  await page.reload();
  await expect(page.getByTestId('metric-select')).toHaveValue('reported_income_change_pct');
  await expect(page.getByRole('tab', { name: 'Map', exact: true })).toBeDisabled();
});

test('paired rate views preserve the chosen condition, sex and period, including after reload', async ({ page }) => {
  const incidence = 'Asthma age-standardized incidence rate per 1000 population (1+ yrs)';
  const prevalence = 'Asthma age-standardized lifetime prevalence rate per 1000 population (1+ yrs)';
  await page.goto('dev/projects?view=explore&dataset=community-disease-incidence&display=table');
  await page.getByTestId('entity-select').selectOption(incidence);
  await page.getByRole('combobox', { name: 'Source sex category', exact: true }).selectOption('Female');
  await page.getByTestId('year-select').selectOption('2010–2011');
  await page.getByRole('button', { name: 'Lifetime prevalence rates', exact: true }).click();
  await expect(page.getByTestId('entity-select')).toHaveValue(prevalence);
  await expect(page.getByRole('combobox', { name: 'Source sex category', exact: true })).toHaveValue('Female');
  await expect(page.getByTestId('year-select')).toHaveValue('2010–2011');
  await page.reload();
  await expect(page.getByTestId('entity-select')).toHaveValue(prevalence);
  await page.getByRole('button', { name: 'Incidence rates', exact: true }).click();
  await expect(page.getByTestId('entity-select')).toHaveValue(incidence);
  await expect(page.getByRole('combobox', { name: 'Source sex category', exact: true })).toHaveValue('Female');
});

test('supply links preserve the selected age group across the two model stages', async ({ page }) => {
  await page.goto('dev/projects?view=explore&dataset=bc-graduate-projections');
  await page.getByRole('combobox', { name: 'Age group', exact: true }).selectOption('30 to 44');
  await page.getByRole('button', { name: 'Projected occupation entrants', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Age group', exact: true })).toHaveValue('30 to 44');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Age group', exact: true })).toHaveValue('30 to 44');
  await page.getByRole('button', { name: 'Projected graduates', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Age group', exact: true })).toHaveValue('30 to 44');
});

test('recovered 2011 funding retains its publisher origin and contiguous source series', async ({ page, request }) => {
  const pack = await (await request.get('data/nhhr/research-followup.json')).json();
  const d: AtlasDataset = pack.datasets.find((item: AtlasDataset) => item.id === 'nserc-awards-2001-2018');
  expect(d.withheldPeriods).toBeUndefined();
  expect(d.sourceOrigin).toBe('mixed');
  expect(d.rows.filter(row => row.fiscal_year === '2011')).toHaveLength(7);
  await page.goto('dev/projects?view=explore&dataset=nserc-awards-2001-2018&display=chart&entity=UNBC%20%2F%20Prince%20George');
  const chart = page.locator('.atlas-trend-chart');
  const recovered = chart.getByRole('button', { name: /^UNBC \/ Prince George, 2011:/ });
  await expect(recovered).toBeAttached();
  await expect(recovered).toHaveAttribute('aria-label', /1,615,488/);
  await expect(chart).not.toContainText('Withheld source periods: 2011');
  await page.locator('.atlas-source-notes > summary').click();
  await expect(page.locator('.atlas-source-notes').getByRole('link', {name:'Official NSERC 2011 Awards', exact:true})).toHaveAttribute('href', 'https://www.nserc-crsng.gc.ca/opendata/nserc_grt_fyr2011_award.csv');
});
