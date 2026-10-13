import { expect, test, type APIRequestContext } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { AtlasDataset } from '../src/atlas/types';
import { mockBasemaps } from './basemap-fixtures';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import type { AtlasStoryMap } from '../src/atlas/storyMaps';

type Review = { collectionId:string;datasetId:string;status:string;summary:string;mapConnection:string;needs:string[];cannot:string[];inspectionScope:string;views:string[];relatedViews:string[];evidence?:{kind:string;asset?:string;note?:string}[] };
async function load(request:APIRequestContext) {
  const review=await (await request.get('data/nhhr/catalogue-review.json')).json();
  const inventory=await (await request.get('data/nhhr/source-inventory.json')).json();
  const datasets:AtlasDataset[]=[];
  for(const asset of review.releaseAssets) { const response=await request.get(`data/nhhr/${asset}.json`);expect(response.ok(),asset).toBe(true);datasets.push(...(await response.json()).datasets); }
  return {review,inventory,datasets};
}
test.beforeEach(async ({page})=>{await mockBasemaps(page);});

test('all 85 catalogue UUIDs reconcile with every current released view and primary source',async({request})=>{
  const {review,inventory,datasets}=await load(request);
  expect(review.reviews).toHaveLength(85);expect(inventory.collections).toHaveLength(85);
  const ids=review.reviews.map((r:Review)=>r.datasetId);
  expect(new Set(ids).size).toBe(85);expect(ids.every((id:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id))).toBe(true);
  expect(new Set(ids)).toEqual(new Set(inventory.collections.map((r:Review)=>r.datasetId)));
  expect(new Set(datasets.map(d=>d.id)).size).toBe(datasets.length);
  expect(review.explorerViews).toBe(datasets.length);expect(review.loadedRows).toBe(datasets.reduce((sum,d)=>sum+d.rows.length,0));
  const primaryDatasets=datasets.filter(d=>d.sourceOrigin!=='supplemental');const primary=new Set(primaryDatasets.map(d=>d.datasetId));expect(review.connectedSourceCollections).toBe(primary.size);
  expect(review.reviews.reduce((sum:number,r:Review)=>sum+r.views.length,0)).toBe(primaryDatasets.length);
  for(const r of review.reviews as Review[])expect(new Set(r.views)).toEqual(new Set(primaryDatasets.filter(d=>d.datasetId===r.datasetId).map(d=>d.id)));
  expect(review.primaryExplorerViews).toBe(primaryDatasets.length);
  expect(review.supplementalViews.map((d:any)=>d.id).sort()).toEqual(datasets.filter(d=>d.sourceOrigin==='supplemental').map(d=>d.id).sort());
  expect(review.reviews.filter((r:Review)=>r.collectionId==='DATA-C058')).toHaveLength(7);
  const counts:Record<string,number>={};for(const r of review.reviews as Review[])counts[r.status]=(counts[r.status]??0)+1;
  expect(review.statusCounts).toEqual(counts);expect(Object.values(counts).reduce((a,b)=>a+b,0)).toBe(85);
  expect(counts.restricted).toBe(3);
});

test('downloadable reviews match the source mirror and protected evidence exposes no raw files',async({request})=>{
  expect(await (await request.get('data/nhhr/catalogue-review.json')).text()).toBe(await readFile('src/atlas/snapshots/catalogue-review.json','utf8'));
  const evidence=await (await request.get('data/nhhr/catalogue-review-evidence.json')).json();
  expect(evidence.reviews).toHaveLength(85);
  const review=await (await request.get('data/nhhr/catalogue-review.json')).json();
  for(const r of review.reviews as Review[]) {
    expect(r.summary.length).toBeGreaterThan(30);expect(r.mapConnection.length).toBeGreaterThan(15);expect(r.inspectionScope.length).toBeGreaterThan(30);
    expect(r.needs.length).toBeGreaterThan(0);expect(r.cannot.length).toBeGreaterThan(0);
  }
  for(const id of ['DATA-C037','DATA-C077','DATA-X02']) {
    const r=evidence.reviews.find((r:Review)=>r.collectionId===id);
    expect(r.status).toBe('restricted');expect(r.evidence.length).toBeGreaterThan(0);
    expect(r.evidence.every((e:any)=>['reviewed-aggregate-release','restricted-source-metadata-only'].includes(e.kind))).toBe(true);
    expect(JSON.stringify(r.evidence)).not.toMatch(/originalFileId|sourceRelativePath|\/api\/files\/|remuneration\.csv|case.*\.xlsx|participant.*\.csv/i);
  }
});

test('Sources renders all reviewed details and computes explorer connection counts from release assets',async({page,request})=>{
  const {review,datasets}=await load(request);await page.goto('dev/projects?view=sources');
  const catalogue=page.getByRole('region',{name:'NHHR Zoer datasets',exact:true}),rows=catalogue.locator('tbody tr');
  await expect(rows).toHaveCount(85);await expect(catalogue).toContainText(`${review.connectedSourceCollections} collections supply the ${review.primaryExplorerViews} reviewed explorer views`);
  for(const row of await rows.all()) { await expect(row.locator('details')).toHaveCount(1);await expect(row.locator('details')).toContainText('Geographic connection:');await expect(row.locator('details')).toContainText('Needed next');await expect(row.locator('details')).toContainText('Interpretation limits'); }
  await catalogue.getByRole('combobox',{name:'Explorer connection',exact:true}).selectOption('connected');
  await expect(rows).toHaveCount(review.connectedSourceCollections);await expect(rows.locator('button')).toHaveCount(review.primaryExplorerViews);
  await catalogue.getByRole('combobox',{name:'Explorer connection',exact:true}).selectOption('catalogue');
  await expect(rows).toHaveCount(85-review.connectedSourceCollections);await expect(rows.locator('button')).toHaveCount(0);
  await catalogue.getByRole('button',{name:'Clear filters',exact:true}).click();await expect(rows).toHaveCount(85);
});

test('review-result filter retains honest status counts including restricted connected extracts',async({page,request})=>{
  const {review}=await load(request);await page.goto('dev/projects?view=sources');const catalogue=page.getByRole('region',{name:'NHHR Zoer datasets',exact:true});
  for(const [status,count] of Object.entries(review.statusCounts)) { await catalogue.getByRole('combobox',{name:'Connection review',exact:true}).selectOption(status);await expect(catalogue.locator('tbody tr')).toHaveCount(Number(count)); }
  await catalogue.getByRole('combobox',{name:'Connection review',exact:true}).selectOption('restricted');
  const c037=catalogue.locator('tr').filter({hasText:'DATA-C037'});await expect(c037).toHaveCount(1);await expect(c037.locator('button')).toHaveCount(4);
  await expect(c037.getByRole('link',{name:'Zoer dataset details',exact:true})).toHaveCount(0);
  await expect(catalogue).not.toContainText('DATA-P01');
});

test('family search retains all seven distinct C058 UUIDs and native source grain',async({page,request})=>{
  const {review}=await load(request);await page.goto('dev/projects?view=sources');const catalogue=page.getByRole('region',{name:'NHHR Zoer datasets',exact:true});
  await catalogue.getByRole('searchbox',{name:'Search NHHR datasets',exact:true}).fill('DATA-C058');
  await expect(catalogue.locator('tbody tr')).toHaveCount(7);
  const actual=await catalogue.locator('tbody tr').evaluateAll(rows=>rows.map(r=>r.getAttribute('data-zoer-dataset')));
  expect(new Set(actual)).toEqual(new Set(review.reviews.filter((r:Review)=>r.collectionId==='DATA-C058').map((r:Review)=>r.datasetId)));
  await expect(catalogue).toContainText('verified union');await expect(catalogue).toContainText('2021');await expect(catalogue).toContainText('National model-input chart');
});

test('Norway identity and blank CIHR Q3 values remain searchable limitations rather than new funding observations',async({page})=>{
  await page.goto('dev/projects?view=sources');const catalogue=page.getByRole('region',{name:'NHHR Zoer datasets',exact:true}),search=catalogue.getByRole('searchbox',{name:'Search NHHR datasets',exact:true});
  await search.fill('Northern Norway');await expect(catalogue.locator('tbody tr')).toHaveCount(1);await expect(catalogue.locator('tbody tr')).toContainText('DATA-C056');
  await catalogue.locator('tbody summary').click();await expect(catalogue).toContainText('123 indexed works');await expect(catalogue).toContainText('not describe Northern Health BC');
  await search.fill('DATA-C054');await expect(catalogue.locator('tbody tr')).toHaveCount(1);await catalogue.locator('tbody summary').click();
  await expect(catalogue).toContainText('7,309 expected-amount cells are blank');await expect(catalogue).toContainText('1,695 funding records');await expect(catalogue).toContainText('TotalAmountPaid');await expect(catalogue).toContainText('TotalAmountAwarded');
  await expect(catalogue.locator('tbody button')).toHaveCount(0);
  await expect(catalogue.getByRole('link',{name:'CIHR annual payments',exact:true})).toHaveAttribute('href',/dataset=cihr-payments/);
});

test('boundary proposals open existing source views while missing geography stays explicit',async({page,request})=>{
  const {review}=await load(request);await page.goto('dev/projects?view=sources');const catalogue=page.getByRole('region',{name:'NHHR Zoer datasets',exact:true});
  expect(review.boundaryProposals).toHaveLength(4);
  for(const proposal of review.boundaryProposals) {
    const disclosure=catalogue.locator('details').filter({has:page.locator('summary',{hasText:proposal.title})});await expect(disclosure).toHaveCount(1);await disclosure.locator('summary').click();
    await expect(disclosure).toContainText(proposal.recommended);await expect(disclosure).toContainText(proposal.reason);
    if(proposal.datasetId) {const link=disclosure.getByRole('link',{name:'Explore the reviewed source view',exact:true});await expect(link).toHaveAttribute('href',new RegExp(`dataset=${proposal.datasetId}`));expect((await request.get((await link.getAttribute('href'))!)).ok()).toBe(true);}
    else await expect(disclosure.locator('a')).toHaveCount(0);
  }
  await expect(catalogue).toContainText('December 2015');await expect(catalogue).toContainText('mapped once');await expect(catalogue).toContainText('McMaster');
});

test('catalogue downloads, source-to-explorer handoff and responsive layout preserve UNBC presentation',async({page,request},testInfo)=>{
  const {datasets}=await load(request),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('dev/projects?view=sources');const catalogue=page.getByRole('region',{name:'NHHR Zoer datasets',exact:true});
  await expect(page.getByRole('banner').getByRole('link',{name:/University of Northern British Columbia/})).toBeVisible();
  await expect(page.getByRole('region',{name:'PGMaps data audit',exact:true})).toHaveCount(0);await expect(page.getByRole('heading',{name:'PGMaps data and mapping gaps.',exact:true})).toHaveCount(0);
  for(const title of ['Download NHHR catalogue metadata','Read the full NHHR connection review','Verification receipts']) {const link=catalogue.getByRole('link',{name:title,exact:true});expect((await request.get((await link.getAttribute('href'))!)).ok()).toBe(true);}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(1);
  await catalogue.getByRole('heading',{name:'NHHR datasets in Zoer.',exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:testInfo.outputPath('nhhr-catalogue.png')});
  await catalogue.getByRole('searchbox',{name:'Search NHHR datasets',exact:true}).fill('DATA-C039');await catalogue.locator('tbody summary').focus();await page.keyboard.press('Enter');await expect(catalogue.locator('tbody details')).toHaveAttribute('open','');
  await catalogue.getByRole('button',{name:datasets.find(d=>d.id==='cfi-projects-total')!.title,exact:true}).click();await expect(page).toHaveURL(/dataset=cfi-projects-total/);
  await expect(page.getByTestId('atlas-map-state')).toHaveAttribute('data-matched-count','7');await expect(page.getByTestId('atlas-map-state')).toHaveAttribute('data-basemap-format','vector');await expect(page.getByTestId('atlas-map-state')).toHaveAttribute('data-raster-sources','0');
  expect(errors).toEqual([]);
});

// Each new chapter gets its own bounded case, so both phone and desktop verify
// the exact released rows without one long test masking a failed handoff.

const mappedCounts:Record<string,number> = { 'municipal-population':7,'tenant-housing-context':7,'owner-housing-context':7,'employer-locations':7,'regional-employment':7,'listed-chairs':8,'infrastructure-contributions':7,'administered-payments':6,'allied-health':3,'wage-estimates':4,'historical-health-context':3,'published-intensity':7 };
// Evaluate the pure story definitions against released fixtures. Node requires
// JSON import attributes, while the app's JSON modules are compiled by Vite.
const document=JSON.parse(readFileSync('public/data/nhhr/catalogue-review.json','utf8'));
const released=document.releaseAssets.flatMap((asset:string)=>JSON.parse(readFileSync(`public/data/nhhr/${asset}.json`,'utf8')).datasets) as AtlasDataset[];
const definitions=ts.transpileModule(readFileSync('src/atlas/expansionStoryMaps.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const storyExports:{expansionStoryMaps?:AtlasStoryMap[]}={};
const followupExports:Record<string,unknown>={};
new Function('exports',ts.transpileModule(readFileSync('src/atlas/followupStoryMaps.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(followupExports);
new Function('exports','require',definitions)(storyExports,(name:string)=>{if(name==='./data')return {atlasDatasets:released};if(name==='./followupStoryMaps')return followupExports;throw new Error(`Unexpected story dependency ${name}`);});
const expansionStoryMaps=storyExports.expansionStoryMaps!;
expect(expansionStoryMaps.map(s=>s.id).sort()).toEqual(['community-context','research-resources','workforce-context']);
expect(expansionStoryMaps.reduce((count,story)=>count+story.chapters.length,0)).toBe(20);
for(const story of expansionStoryMaps) for(const chapter of story.chapters) {
  test(`guided ${story.id}/${chapter.id} retains its exact source subset in the explorer`,async({page,request},testInfo)=>{
    const {datasets}=await load(request),dataset=datasets.find(d=>d.id===chapter.evidence.datasetId)!;
    expect(dataset).toBeDefined();const evidence=chapter.evidence;
    const rows=dataset.rows.filter(row=>(!evidence.year||String(row[dataset.timeField??''])===evidence.year)&&(!evidence.entities?.length||evidence.entities.includes(String(row[dataset.entityField])))&&Object.entries(evidence.filters??{}).every(([key,value])=>!value||String(row[key])===value));
    expect(rows.length).toBeGreaterThan(0);
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`dev/projects/${story.id}#${chapter.id}`);
    const source=page.getByTestId('story-evidence');await expect(source).toHaveAttribute('data-dataset',dataset.id);await expect(source).toHaveAttribute('data-chapter',chapter.id);await expect(source).toHaveAttribute('data-metric',evidence.metric);await expect(source).toHaveAttribute('data-period',evidence.year??'all');
    await expect(source.locator('.atlas-chapter-source')).toContainText(`${rows.length} source records`);
    if(evidence.kind==='map'&&['cd','csd','er'].includes(dataset.geography)) {
      await expect(source.locator('.atlas-chapter-source')).toContainText(/Statistics Canada.*2021|2021.*Statistics Canada/);
      await expect(source.locator('.atlas-chapter-source')).not.toContainText('BC Ministry of Health');
    }
    if(evidence.kind==='map') {
      const state=source.getByTestId('atlas-map-state');await expect(state).toHaveAttribute('data-ready','true');await expect(state).toHaveAttribute('data-matched-count',String(mappedCounts[chapter.id]));// Context polygons without values remain rendered. Small municipal polygons
      // also differ by the fixed desktop/phone viewport; join counts stay exact.
      const rendered = dataset.geography==='institution' ? mappedCounts[chapter.id] : dataset.geography==='hsda' ? testInfo.project.name==='mobile' ? 9 : 10 : dataset.geography==='er' ? dataset.mapLocationsAsset==='boundaries-lfs-er-2021.geojson' ? 7 : 8 : dataset.geography==='hr2015' ? 3 : testInfo.project.name==='mobile' ? 6 : 7;
      await expect(state).toHaveAttribute('data-rendered-features',String(rendered));await expect(state).toHaveAttribute('data-basemap-format','vector');await expect(state).toHaveAttribute('data-raster-sources','0');
      if(evidence.scaleDomain) await expect(state).toHaveAttribute('data-scale-domain',JSON.stringify(evidence.scaleDomain));
    } else await expect(source.getByTestId('atlas-map-state')).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(1);
    if(chapter.id===story.chapters[0].id) await page.screenshot({path:testInfo.outputPath(`${story.id}.png`)});
    await page.locator('.editorial-slide[data-active="true"]').getByRole('button',{name:'Explore the source data',exact:true}).click();
    await expect(page).toHaveURL(new RegExp(`dataset=${dataset.id}`));await expect(page.getByTestId('metric-select')).toHaveValue(evidence.metric);
    if(dataset.timeField)await expect(page.getByTestId('year-select')).toHaveValue(evidence.year??'');
    const expectedEntity=evidence.entities?.length===1?evidence.entities[0]:(evidence.filters?.[dataset.entityField]??'');await expect(page.getByTestId('entity-select')).toHaveValue(expectedEntity);
    for(const [key,value] of Object.entries(evidence.filters??{})) if(key!==dataset.entityField)await expect(page.getByRole('combobox',{name:dataset.columns.find(c=>c.key===key)!.label,exact:true})).toHaveValue(value);
    await expect(page.locator('.atlas-results-line')).toContainText(`${rows.length.toLocaleString()} of ${dataset.rows.length.toLocaleString()} source records`);
    if(evidence.kind==='map') {await expect(page.getByTestId('atlas-map-state')).toHaveAttribute('data-matched-count',String(mappedCounts[chapter.id]));}
    if(chapter.id==='historical-health-context') {await expect(page.getByRole('tab',{name:'Map',exact:true})).toBeEnabled();await expect(page.getByRole('tab',{name:'Map',exact:true})).toHaveAttribute('aria-selected','true');}
    // Reload is a second check of serialized entity filters (including the
    // source's nursing-inpatient and starred vacancy occupation labels).
    await page.reload();await expect(page.getByTestId('metric-select')).toHaveValue(evidence.metric);await expect(page.getByTestId('entity-select')).toHaveValue(expectedEntity);await expect(page.locator('.atlas-results-line')).toContainText(`${rows.length.toLocaleString()} of ${dataset.rows.length.toLocaleString()} source records`);
    expect(errors).toEqual([]);
  });
}
