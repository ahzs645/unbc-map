import {expect,test,type APIRequestContext} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import type {AtlasDataset} from '../src/atlas/types';
import {mockBasemaps} from './basemap-fixtures';
const base='dev/projects?view=explore';const unbc='UNBC / Prince George';
async function release(request:APIRequestContext){return (await(await request.get('data/nhhr/research-followup.json')).json()).datasets as AtlasDataset[];}
function find(d:AtlasDataset[],id:string){return d.find(v=>v.id===id)!;}
async function points(state:any){return JSON.parse(await state.getAttribute('data-rendered-points')||'[]') as {code:string;value:number;radius:number}[];}
test.beforeEach(async({page})=>{await mockBasemaps(page);});

test('historical NSERC retains all observed groups, missing early UNBC years and original fiscal/installment scope',async({request})=>{
 const d=find(await release(request),'nserc-awards-history');expect(d.rows).toHaveLength(67);expect(new Set(d.rows.map(r=>r.comparator)).size).toBe(7);expect(new Set(d.rows.map(r=>`${r.comparator}|${r.fiscal_year}`)).size).toBe(67);
 expect(d.rows.every(r=>Number(r.fiscal_year)>=1991&&Number(r.fiscal_year)<=2000)).toBe(true);
 expect(d.rows.reduce((sum,r)=>sum+Number(r.award_records),0)).toBe(31086);
 const oracle:Record<string,[number,number]>= {'1994':[7,171547],'1995':[18,333271],'1996':[30,511589],'1997':[34,610456],'1998':[35,661033],'1999':[40,727595],'2000':[50,793451]};
 for(const[y,[count,amount]]of Object.entries(oracle))expect(d.rows.find(r=>r.comparator===unbc&&r.fiscal_year===y)).toMatchObject({award_records:count,distinct_applications:count,award_amount_cad:amount,organization_id:'3'});
 expect(d.rows.some(r=>r.comparator===unbc&&Number(r.fiscal_year)<1994)).toBe(false);
 for(const r of d.rows)expect(Number(r.numbered_installment_records)+Number(r.installment_unspecified_records)).toBe(r.award_records);
 expect(d.rows.find(r=>r.comparator==='UBC / Vancouver'&&r.fiscal_year==='1991')).toMatchObject({award_amount_cad:45081708,award_records:1388,competition_year_min:'1983',competition_year_max:'1992'});
 expect(d.notes.join(' ')).toMatch(/not.*cash.payment series/);expect(d.notes.join(' ')).toMatch(/not.*calendar years/);
});

test('source provenance proves full 1999 selection, split institution keys and all original locks',async({request})=>{
 const p=await(await request.get('data/nhhr/research-followup-provenance.json')).json();expect(p.originalSources).toHaveLength(39);
 expect(p.nserc.duplicate1999).toMatchObject({fullExportRows:16692,excerptRows:1794,completeExcerptRowsMatchingFull:1793,truncatedExcerptRows:[{sourceCsvRow:1795,missingFields:['Partie','Nb_Partie']}]});
 expect(p.nserc.sourceFiles.reduce((sum:number,r:{sourceRows:number})=>sum+r.sourceRows,0)).toBe(165665);
 expect(p.nserc.sourceFiles.some((r:any)=>r.filename==='f3_027_1999_Awards.csv')).toBe(false);
 expect(p.nserc.splitApplicationGroupsByFiscalYear).toMatchObject({'1997':7,'1998':45,'1999':52,'2000':46});
 expect(p.nserc.allowedFields).toEqual(['ApplicationID','OrganizationID','AwardAmount','Partie','Nb_Partie','fiscal_year','competition_year','Institution-Établissement']);
 expect(p.nserc.rowBindings.reduce((sum:number,b:{sourceCsvRows:number[]})=>sum+b.sourceCsvRows.length,0)).toBe(31086);
 expect(p.originalSources.find((s:any)=>s.filename==='nserc_027_1999_Awards.csv')).toMatchObject({originalFileIds:['f700ddca-5429-4252-9435-722f6a2d8123'],sha256:'04602264c4665c73dbc1d82fc337964d0cafa641ebf397d62282ee3fc9b3f429'});
 expect(p.originalSources.every((s:any)=>s.tables.length&&s.tables.every((t:any)=>t.tableName&&t.parquetSha256))).toBe(true);
 expect(await(await request.get('data/nhhr/research-followup.json')).text()).toBe(await readFile('src/atlas/snapshots/research-followup.json','utf8'));
});

test('university facts preserve published headcount ratios, precision and revised source differences',async({request})=>{
 const d=find(await release(request),'university-research-intensity');expect(d.rows).toHaveLength(7);expect(d.defaultMetric).toBe('income_per_faculty_cad');
 const oracle:Record<string,number>={[unbc]:94700,'UBC / Vancouver':288300,'Calgary / Calgary':395800,'Dalhousie / Halifax':167300,'USask / Saskatoon':319600,'Lakehead / Thunder Bay':86000,'McMaster / Hamilton':430100};
 for(const[name,value]of Object.entries(oracle))expect(d.rows.find(r=>r.comparator===name)?.income_per_faculty_cad).toBe(value);
 expect(d.rows.find(r=>r.comparator===unbc)).toMatchObject({income_per_grad_student_cad:28800,sponsored_research_income_cad:19612000,prior_income_cad:17710000,rank_2024:'39',rank_2023:'41',source_fiscal_year:'2024'});
 expect(d.rows.find(r=>r.comparator==='Dalhousie / Halifax')?.sponsored_research_income_cad).toBe(213193000);
 expect(d.columns.find(c=>c.key==='rank_2024')?.type).toBe('text');expect(d.columns.find(c=>c.key==='prior_income_cad')?.type).toBe('text');
 expect(d.notes.join(' ')).toMatch(/headcount is not an FTE/);expect(d.notes.join(' ')).toMatch(/internships\/residencies/);expect(d.notes.join(' ')).toMatch(/full ranking table.*not reproduced/);
});

test('health organizations stay nonspatial, separate from buildings, and preserve missing published shares',async({request})=>{
 const d=find(await release(request),'hospital-research-organizations');expect(d.rows).toHaveLength(5);expect(d.geography).toBe('none');expect(d.mapLocationsAsset).toBeUndefined();
 expect(d.rows.find(r=>r.organization_name==='Provincial Health Services Authority')).toMatchObject({research_spending_cad:224238000,spending_per_researcher_cad:213600,research_spending_share_pct:3.8});
 expect(d.rows.find(r=>r.organization_name==='Vancouver Coastal Health Authority')).toMatchObject({research_spending_cad:181433000,research_spending_share_pct:2.9});
 expect(d.rows.filter(r=>r.research_spending_share_pct===null)).toHaveLength(2);expect(d.rows.filter(r=>r.research_spending_share_raw==='na')).toHaveLength(2);
 expect(d.rows.find(r=>r.organization_name==='Nova Scotia Health Authority')?.reported_spending_change_pct).toBe(-11.1);
 expect(d.notes.join(' ')).toMatch(/cannot be allocated to a single hospital/);
});

test('CRA original code errors and unresolved UNBC scale stay evidence rather than monetary views',async({request})=>{
 const p=await(await request.get('data/nhhr/research-followup-provenance.json')).json();expect(p.craReview.status).toBe('blocked');expect(p.craReview.originalSourceCodeDefinitions).toEqual({'4200':'Total assets','4350':'Total liabilities','4700':'Total revenue','4950':'Total expenditures'});
 expect(p.craReview.institutionEvidence).toHaveLength(8);expect(p.craReview.institutionEvidence.every((r:any)=>r.financialAmountsReleased===false)).toBe(true);
 const r=p.craReview.institutionEvidence.find((r:any)=>r.legalName==='UNIVERSITY OF NORTHERN BRITISH COLUMBIA');expect(r).toMatchObject({bn:'121627350RR0001',fiscalPeriodEnd:'2023-03-31',originalReportedFields:{'4200':'393273','4350':'233650','4700':'137631','4950':'132365'}});
 expect((await release(request)).some(d=>d.datasetId==='b839ab83-e3a5-4f73-8b4c-84ac1de47829')).toBe(false);
 const audit=JSON.parse(await readFile('docs/nhhr-research-followup-review.json','utf8'));expect(audit.reviews).toHaveLength(5);expect(new Set(audit.reviews.map((r:any)=>r.datasetId)).size).toBe(5);expect(audit.reviews.every((r:any)=>r.inspectionScope&&r.needs.length&&r.cannot.length)).toBe(true);
 for(const d of await release(request))for(const row of d.rows)expect(Object.keys(row).join('|')).not.toMatch(/applicant|director|name.nom|contact|phone|email|participant/i);
});

test('historical maps use seven campuses and a stable area scale for the selected fiscal code',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`${base}&dataset=nserc-awards-history&year=2000&display=map`);
 const state=page.getByTestId('atlas-map-state');await expect(state).toHaveAttribute('data-ready','true');await expect(state).toHaveAttribute('data-matched-count','7');await expect(state).toHaveAttribute('data-rendered-features','7');await expect(state).toHaveAttribute('data-basemap-format','vector');await expect(state).toHaveAttribute('data-raster-sources','0');
 const dots=await points(state),u=dots.find(r=>r.code==='unbc')!,ubc=dots.find(r=>r.code==='ubc')!;expect(u.value).toBe(793451);expect(ubc.value).toBe(37219178);expect(u.radius**2/ubc.radius**2).toBeCloseTo(793451/37219178,5);
 await page.getByTestId('entity-select').selectOption(unbc);await expect(state).toHaveAttribute('data-matched-count','1');await expect.poll(async()=>(await points(state))[0]?.radius).toBeCloseTo(u.radius,5);
 await page.getByTestId('metric-select').selectOption('award_records');await expect.poll(async()=>(await points(state))[0]?.value).toBe(50);
 await page.getByTestId('year-select').selectOption('1999');await expect.poll(async()=>(await points(state))[0]?.value).toBe(40);
 await page.getByTestId('year-select').selectOption('1991');await expect(state).toHaveAttribute('data-matched-count','0');await expect(page.locator('.atlas-results-line')).toContainText('0 of 67');expect(errors).toEqual([]);
});

test('university intensity maps reviewed McMaster and keeps its exact metric subset through CSV and reload',async({page})=>{
 await page.goto(`${base}&dataset=university-research-intensity&display=map`);const state=page.getByTestId('atlas-map-state');await expect(state).toHaveAttribute('data-matched-count','7');await expect(state).toHaveAttribute('data-rendered-features','7');await expect(state).toHaveAttribute('data-basemap-format','vector');await expect(state).toHaveAttribute('data-raster-sources','0');
 await page.getByTestId('entity-select').selectOption('McMaster / Hamilton');await expect.poll(async()=>(await points(state))[0]?.value).toBe(430100);
 await page.getByRole('tab',{name:'Chart',exact:true}).click();await expect(page.locator('.atlas-bar-row')).toHaveCount(1);await expect(page.locator('.atlas-bar-row')).toContainText('430,100');
 await page.getByRole('tab',{name:'Table',exact:true}).click();await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(1);
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'CSV',exact:true}).click();const csv=await readFile((await(await pending).path())!,'utf8');expect(csv.split(/\r?\n/)).toHaveLength(2);expect(csv).toContain('"430100"');expect(csv).toContain('"McMaster / Hamilton"');
 await page.reload();await expect(page.getByTestId('entity-select')).toHaveValue('McMaster / Hamilton');await expect(page.getByTestId('metric-select')).toHaveValue('income_per_faculty_cad');await expect(page.getByRole('tab',{name:'Table',exact:true})).toHaveAttribute('aria-selected','true');
});

test('organization shares chart missing values honestly and never offers a hospital-point allocation',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`${base}&dataset=hospital-research-organizations`);
 await expect(page.getByRole('tab',{name:'Map',exact:true})).toBeDisabled();await expect(page.getByTestId('atlas-map-state')).toHaveCount(0);await expect(page.locator('.atlas-bar-row')).toHaveCount(5);
 await page.getByTestId('metric-select').selectOption('research_spending_share_pct');await expect(page.locator('.atlas-bar-row')).toHaveCount(3);await expect(page.locator('.atlas-chart-footnote')).toContainText('2 missing values omitted');
 await page.getByRole('tab',{name:'Table',exact:true}).click();await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(5);await expect(page.locator('.atlas-data-table')).toContainText('na');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(1);expect(errors).toEqual([]);
});


test('middle-window NSERC reconstructs multipart originals and separately identifies the verified 2011 publisher recovery',async({request})=>{
 const datasets=await release(request),d=find(datasets,'nserc-awards-2001-2018');expect(d.rows).toHaveLength(126);expect(new Set(d.rows.map(r=>r.fiscal_year)).size).toBe(18);expect(d.rows.filter(r=>r.fiscal_year==='2011')).toHaveLength(7);expect(d.withheldPeriods).toBeUndefined();expect(d.sourceOrigin).toBe('mixed');expect(d.datasetId).toBe('1704b537-adf5-45c0-9aad-7b693dab88ce');
 expect(d.rows.reduce((sum,r)=>sum+Number(r.award_records),0)).toBe(77765);expect(d.rows.every(r=>Number(r.fiscal_year)>=2001&&Number(r.fiscal_year)<=2018)).toBe(true);
 const oracle:Record<string,[number,number]>={'2001':[48,841106],'2010':[85,1878901],'2012':[61,1579339],'2018':[68,1357505]};for(const[y,[count,amount]]of Object.entries(oracle))expect(d.rows.find(r=>r.comparator===unbc&&r.fiscal_year===y)).toMatchObject({award_records:count,award_amount_cad:amount,anonymous_source_records:0});
 for(const r of d.rows){expect(Number(r.numbered_installment_records)+Number(r.installment_unspecified_records)).toBe(r.award_records);expect(Number(r.distinct_applications)).toBeLessThanOrEqual(Number(r.award_records));}
 const p=await(await request.get('data/nhhr/research-followup-provenance.json')).json();expect(p.nserc2001To2018.sourceFiles).toHaveLength(18);expect(p.nserc2001To2018.sourceFiles.reduce((sum:number,r:any)=>sum+r.sourceRows,0)).toBe(416834);expect(p.originalSources.filter((r:any)=>r.collectionId==='DATA-C055'&&r.originalFileIds.length>1)).toHaveLength(10);
 expect(p.nserc2001To2018.collectedSourceGaps).toMatchObject([{sourceFiscalYear:'2011',filename:'063_2011_Awards.csv',originalSha256:'7727ed429892003ffdd6186988b7331cf5b7e19e5176fec0c48d5f85e0d709ce',sourceRows:14576,lastSourceCsvRow:14577,missingScientificFields:['Partie','Nb_Partie'],fileEndsWithNewline:false}]);
 expect(p.nserc2001To2018.selectedFinancialKey).toContain('program_id');expect(p.nserc2001To2018.selectedFinancialKey).toContain('AwardAmount');expect(p.nserc2001To2018.selectedAnonymousSourceRecords).toBe(0);expect(d.notes.join(' ')).toMatch(/combined instalment tokens/);expect(d.notes.join(' ')).toMatch(/not.*funding|not.*cash.payment/);
});

test('official 2011 recovery proves completeness, exact source continuation, source definitions and all seven institutional totals',async({request})=>{
 const d=find(await release(request),'nserc-awards-2001-2018');
 const expected:Record<string,[number,number,number]>={'Dalhousie / Halifax':[579,25286344,579],'Lakehead / Thunder Bay':[105,2767591,105],'McMaster / Hamilton':[695,34475686,694],'UBC / Vancouver':[1618,78769758,1612],'Calgary / Calgary':[769,36583904,768],'UNBC / Prince George':[63,1615488,63],'USask / Saskatoon':[478,39178448,478]};
 for(const [comparator,[count,amount,applications]] of Object.entries(expected))expect(d.rows.find(r=>r.comparator===comparator&&r.fiscal_year==='2011')).toMatchObject({award_records:count,award_amount_cad:amount,distinct_applications:applications,source_origin:'Official NSERC publisher recovery'});
 expect(d.rows.filter(r=>r.source_origin==='NHHR Zoer collected original')).toHaveLength(119);
 expect(d.rows.filter(r=>r.fiscal_year==='2011').reduce((sum,r)=>sum+Number(r.award_records),0)).toBe(4307);
 expect(d.sourceName).toContain('official 2011 recovery');expect(d.tableName).toContain('outside Zoer tables');expect(d.supplementalSources).toMatchObject([{name:'Official NSERC 2011 Awards',url:'https://www.nserc-crsng.gc.ca/opendata/nserc_grt_fyr2011_award.csv'}]);
 const p=await(await request.get('data/nhhr/research-followup-provenance.json')).json(),r=p.nserc2001To2018.official2011Recovery;
 expect(r).toMatchObject({resourceId:'22fcf163-1846-4f37-b5ef-0dab0acc5fed',sha256:'bcce99ac5e8640acfd7c0b422c0f5b37fd2f6c85e719529e12caf86d0a5f2e16',bytes:36390655,csvRows:23312,completeScientificRows:23265,whollyEmptyDelimiterRows:47,fileEndsWithNewline:true,scientificColumnCount:35,bytePrefixMatch:true,matchingCompleteCollectedRows:14575,truncatedFinalRowCompleted:true,dictionaryHashMatchesCollected:true,licence:'Open Government Licence - Canada'});
 expect(r.excludedBlankSourceCsvRows).toHaveLength(47);expect(p.nserc2001To2018.withheldPeriods).toEqual([]);expect(p.externalSources).toHaveLength(3);expect(p.externalSources.every((s:any)=>!s.originalFileIds&&!s.datasetId)).toBe(true);
 expect(p.nserc2001To2018.rowBindings.filter((b:any)=>b.sourceFiscalYear==='2011').every((b:any)=>b.sourceOrigin==='Official NSERC publisher recovery'&&b.filename==='nserc_grt_fyr2011_award.csv')).toBe(true);
});

test('publisher recovery adapters reject unreviewed origins, altered original hashes and nonnumeric funding fields',async()=>{
 const code=`import importlib.util,pathlib,tempfile,json
spec=importlib.util.spec_from_file_location('followup','scripts/prepare-nhhr-research-followup.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
rejected=[]
def reject(label,operation):
 try:operation()
 except ValueError:rejected.append(label);return
 raise AssertionError(label+' was accepted')
with tempfile.TemporaryDirectory() as folder:
 root=pathlib.Path(folder);source={**module.EXTERNAL_SOURCES[0],'collectionId':'EXTERNAL-NSERC-2011'};target=root/source['collectionId']/source['filename'];target.parent.mkdir();target.write_bytes(b'altered original')
 reject('publisher hash drift',lambda:module.read_locked(root,source))
reject('unreviewed publisher URL',lambda:module.fetch_external({'url':'https://example.com/invented.csv'}))
for value in ['','NaN','Infinity','=SUM(1,2)','not reported']:
 reject('invalid amount '+repr(value),lambda value=value:module.number(value))
print(json.dumps({'rejected':rejected}))`;
 const {stdout}=await promisify(execFile)('python3',['-B','-c',code]);expect(JSON.parse(stdout).rejected).toHaveLength(7);
});

test('middle-window maps and linked windows preserve exact institution and recovered 2011 totals',async({page})=>{
 await page.goto(`${base}&dataset=nserc-awards-2001-2018&year=2018&display=map&entity=${encodeURIComponent(unbc)}`);
 const state=page.getByTestId('atlas-map-state');await expect(state).toHaveAttribute('data-matched-count','1');await expect(state).toHaveAttribute('data-rendered-features','1');await expect.poll(async()=>(await points(state))[0]?.value).toBe(1357505);await expect(state).toHaveAttribute('data-basemap-format','vector');await expect(state).toHaveAttribute('data-raster-sources','0');
 await page.getByTestId('year-select').selectOption('2011');await expect.poll(async()=>(await points(state))[0]?.value).toBe(1615488);
 await page.getByRole('button',{name:'Historical NSERC fiscal records',exact:true}).click();await expect(page.getByTestId('entity-select')).toHaveValue(unbc);await expect(page.getByTestId('year-select')).toHaveValue('2000');
 await page.getByRole('button',{name:'NSERC fiscal records · 2001–2018',exact:true}).click();await expect(page.getByTestId('entity-select')).toHaveValue(unbc);await expect(page.getByTestId('year-select')).toHaveValue('2018');
 await page.getByRole('button',{name:'Recent NSERC award window',exact:true}).click();await expect(page.getByTestId('entity-select')).toHaveValue(unbc);await expect(page.getByTestId('year-select')).toHaveValue('2024');
});

test('middle-window source trend includes the verified 2011 record with declared publisher attribution',async({page})=>{
 await page.goto(`${base}&dataset=nserc-awards-2001-2018&display=chart&year=`);
 await expect(page.getByTestId('year-select')).toHaveValue('');await expect(page.locator('.atlas-results-line')).toContainText('126 of 126');
 const chart=page.locator('.atlas-trend-chart');await expect(chart).toHaveCount(1);
 const series=await chart.locator('g').evaluateAll(groups=>groups.filter(group=>group.querySelector('circle[role="button"]')).map(group=>{
  const points=Array.from(group.querySelectorAll('circle[role="button"]')).map(point=>({year:Number(point.getAttribute('aria-label')?.match(/, (\d{4}):/)?.[1]),x:Number(point.getAttribute('cx'))}));
  const segments=Array.from(group.querySelectorAll('path')).flatMap(path=>Array.from((path.getAttribute('d')||'').matchAll(/M([-\d.e]+) ([-\d.e]+) L([-\d.e]+) ([-\d.e]+)/g)).map(match=>({from:Number(match[1]),to:Number(match[3])})));
  return {points,segments};
 }));
 expect(series.length).toBeGreaterThan(0);
 for(const {points,segments} of series){expect(points).toHaveLength(18);expect(points.some(point=>point.year===2011)).toBe(true);expect(segments).toHaveLength(17);const before=points.find(point=>point.year===2010)!,recovered=points.find(point=>point.year===2011)!,after=points.find(point=>point.year===2012)!;expect(segments.some(segment=>segment.from===before.x&&segment.to===recovered.x)).toBe(true);expect(segments.some(segment=>segment.from===recovered.x&&segment.to===after.x)).toBe(true);expect(segments.some(segment=>segment.from===before.x&&segment.to===after.x)).toBe(false);}
 await expect(page.locator('.atlas-chart-footnote').filter({hasText:'Withheld source periods:'})).toHaveCount(0);
 await page.locator('.atlas-source-notes summary').click();await expect(page.locator('.atlas-source-notes')).toContainText('collected 2011 original remains truncated');
 await page.getByRole('tab',{name:'Table',exact:true}).click();await expect(page.locator('.atlas-data-table')).toContainText('of 126 records');
});
