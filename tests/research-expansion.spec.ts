import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { mockBasemaps } from './basemap-fixtures';
import type { AtlasDataset } from '../src/atlas/types';

const explorer = 'dev/projects?view=explore';
const unbc = 'UNBC / Prince George';
async function source(request: any) { return (await (await request.get('data/nhhr/research-expansion.json')).json()).datasets as AtlasDataset[]; }
function find(rows: AtlasDataset[], id: string) { return rows.find(d => d.id === id)!; }
async function points(state: any) { return JSON.parse(await state.getAttribute('data-rendered-points') || '[]') as { code: string; value: number; radius: number }[]; }
async function ready(page: any, count: number) {
  const state = page.getByTestId('atlas-map-state');
  await expect(state).toHaveAttribute('data-ready', 'true');
  await expect(state).toHaveAttribute('data-matched-count', String(count));
  await expect(state).toHaveAttribute('data-rendered-features', String(count));
  await expect(state).toHaveAttribute('data-basemap-format', 'vector');
  await expect(state).toHaveAttribute('data-raster-sources', '0');
  await expect(state).toHaveAttribute('data-basemap-status', 'ready');
  return state;
}
test.beforeEach(async ({ page }) => { await mockBasemaps(page); });

test('CFI source totals reconcile independent upstream summaries and every decision-year partition', async ({ request }) => {
  const datasets = await source(request), annual = find(datasets, 'cfi-projects-by-year'), total = find(datasets, 'cfi-projects-total');
  const oracle: Record<string, [number, number]> = { 'UBC / Vancouver': [1180,736797362], 'USask / Saskatoon': [336,653061349], 'McMaster / Hamilton': [458,331247623], 'Calgary / Calgary': [456,291230082], 'Dalhousie / Halifax': [373,212357380], 'Lakehead / Thunder Bay': [75,11094878], [unbc]: [45,7542484] };
  expect(annual.rows).toHaveLength(185); expect(total.rows).toHaveLength(7);
  expect(new Set(annual.rows.map(r => `${r.comparator}|${r.decision_year}`)).size).toBe(185);
  for (const [name, [records, cad]] of Object.entries(oracle)) {
    const row = total.rows.find(r => r.comparator === name)!;
    expect(row).toMatchObject({ project_records: records, cfi_contribution_cad: cad, latest_decision_year: '2025' });
    const years = annual.rows.filter(r => r.comparator === name);
    for (const metric of ['project_records','cfi_contribution_cad','medical_health_life_project_records','medical_health_life_contribution_cad']) expect(years.reduce((sum,r)=>sum+Number(r[metric]),0)).toBe(row[metric]);
    expect(Number(row.medical_health_life_contribution_cad)).toBeLessThanOrEqual(cad);
  }
  expect(total.rows.some(r => String(r.comparator).startsWith('NOSM'))).toBe(false);
  expect(annual.rows.some(r => r.comparator === unbc && r.decision_year === '1998')).toBe(false);
});

test('SSHRC preserves the institution-payment grain, source fiscal code and split allocations', async ({ request }) => {
  const dataset = find(await source(request), 'sshrc-payments');
  const oracle: Record<string,[number,number]> = { 'Dalhousie / Halifax':[170,26436981.47], 'Lakehead / Thunder Bay':[50,4947544.65], 'UBC / Vancouver':[790,94014214], 'Calgary / Calgary':[342,42012086.12], [unbc]:[20,3525824.33], 'USask / Saskatoon':[140,18301624.98] };
  expect(dataset.rows).toHaveLength(6);
  for (const [name,[count,cad]] of Object.entries(oracle)) expect(dataset.rows.find(r => r.comparator===name)).toMatchObject({ payment_records:count,distinct_funding_files:count,paid_amount_cad:cad,source_fiscal_year:'2024' });
  const provenance = await (await request.get('data/nhhr/research-expansion-provenance.json')).json();
  expect(provenance.sourceBindings.sshrc.offPeriodSourceRowsExcluded).toBe(15);
  expect(provenance.sourceBindings.sshrc.selectedSourceFields).toEqual(['Institution','Fiscal_Year-Exercice_financier','File_Number','Amount-Montant']);
  expect(provenance.sourceBindings.sshrc.sourceRowBindings.reduce((sum:number,b:{rows:number[]})=>sum+b.rows.length,0)).toBe(1512);
  expect(dataset.notes.join(' ')).toMatch(/Seven source funding files split payments between institutions/);
  expect(dataset.notes.join(' ')).toMatch(/not award commitments/);
});

test('PubMed query totals remain distinct from 20-ID samples and unspecified capture periods', async ({ request }) => {
  const dataset = find(await source(request),'pubmed-affiliation-counts');
  const oracle: Record<string,number> = { [unbc]:1466,'UBC / Vancouver':114912,'Calgary / Calgary':68876,'Dalhousie / Halifax':35855,'USask / Saskatoon':27914,'Lakehead / Thunder Bay':2529,'NOSM / Thunder Bay':2605 };
  expect(dataset.rows).toHaveLength(7); expect(dataset.timeField).toBeUndefined();
  expect(dataset.columns.filter(c=>c.type==='number').map(c=>c.key)).toEqual(['pubmed_query_matches']);
  for (const [name,count] of Object.entries(oracle)) {
    const row=dataset.rows.find(r=>r.comparator===name)!;
    expect(row.pubmed_query_matches).toBe(count); expect(row.returned_id_sample_size).toBe(20);
    expect(String(row.recorded_query)).toContain('[Affiliation]'); expect(String(row.query_url)).toMatch(/^https:\/\/pubmed.ncbi.nlm.nih.gov\//);
  }
  expect(dataset.notes.join(' ')).toMatch(/no.*capture timestamp|capture timestamp.*absent/i);
});

test('finance units and verified publication history reconcile without duplicating independent observations', async ({ request }) => {
  const datasets=await source(request), finance=find(datasets,'research-expenditures'), history=find(datasets,'publications-history');
  expect(finance.rows).toHaveLength(14);
  const oracle: Record<string,number[]> = { [unbc]:[15430,17941],'UBC / Vancouver':[665366,684450],'Calgary / Calgary':[499175,576899],'Dalhousie / Halifax':[195239,198909],'USask / Saskatoon':[199760,192139],'Lakehead / Thunder Bay':[26709,29677],'NOSM / Thunder Bay':[1319,1873] };
  for(const [name,values] of Object.entries(oracle)) for(const [index,period] of ['2022-2023','2023-2024'].entries()) expect(finance.rows.find(r=>r.comparator===name&&r.fiscal_year===period)?.sponsored_research_expenditures_cad).toBe(values[index]*1000);
  const current=(await (await request.get('data/nhhr/atlas-snapshot.json')).json()).datasets.find((d:AtlasDataset)=>d.id==='publications');
  expect(history.rows).toHaveLength(70); expect(new Set(history.rows.map(r=>r.openalex_id)).size).toBe(7);
  let matched=0;
  for(const row of history.rows) { expect(String(row.publication_year)).toMatch(/^20(1[6-9]|2[0-5])$/); if(Number(row.publication_year)>=2021) { const original=current.rows.find((r:any)=>r.comparator===row.comparator&&String(r.publication_year)===String(row.publication_year)); expect(original?.works).toBe(row.works);matched++; } }
  expect(matched).toBe(35); expect(history.rows.some(r=>r.openalex_id==='I63903255')).toBe(false);
});

test('released mirrors trace exact original IDs and hashes and do not leak person fields', async ({ request }) => {
  expect(await (await request.get('data/nhhr/research-expansion.json')).text()).toBe(await readFile('src/atlas/snapshots/research-expansion.json','utf8'));
  const p=await (await request.get('data/nhhr/research-expansion-provenance.json')).json();
  expect(p.originalSources).toHaveLength(27);
  expect(p.originalSources.find((s:any)=>s.collectionId==='DATA-C039')).toMatchObject({ originalFileIds:['f3e73aeb-a56c-4f23-b81d-7f9edd2a93de'],sha256:'6adec12ea70a0ac58f4c7c222e5f6149469d51f102be3eab501f03802477d022' });
  expect(p.originalSources.find((s:any)=>s.filename==='sshrc_fy2024_expenditures.csv')).toMatchObject({ originalFileIds:['ea6e6cb5-e5f0-4810-9f22-132bb262458f'],sha256:'df31624ac19862da43695bfb641e7b7a0795c64ac31a450b2c4c04f3c4f5f82c' });
  for(const dataset of await source(request)) for(const row of dataset.rows) expect(Object.keys(row).join('|')).not.toMatch(/applicant|familyname|firstname|director|email|phone|participant/i);
  const audit=JSON.parse(await readFile('docs/nhhr-research-catalogue-review.json','utf8'));
  expect(audit.reviews).toHaveLength(16); expect(audit.reviews.every((r:any)=>r.datasetReceipt.descriptorStatus==='ready'&&r.evidence.length)).toBe(true);
  expect(audit.reviews.find((r:any)=>r.collectionId==='DATA-C056').cannot.join(' ')).toContain('Northern Health BC');
});

test('CFI maps seven reviewed campuses including McMaster and uses stable source-based dot areas', async ({ page }) => {
  const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${explorer}&dataset=cfi-projects-total&display=map`);
  const state=await ready(page,7); const original=await points(state),ubc=original.find(p=>p.code==='ubc')!,u=original.find(p=>p.code==='unbc')!;
  expect(ubc.value).toBe(736797362);expect(u.value).toBe(7542484);
  expect(u.radius**2/ubc.radius**2).toBeCloseTo(7542484/736797362,5);
  await page.getByTestId('entity-select').selectOption(unbc);await expect(state).toHaveAttribute('data-matched-count','1');
  await expect.poll(async()=> (await points(state))[0]?.radius).toBeCloseTo(u.radius,5);
  await page.getByTestId('entity-select').selectOption('McMaster / Hamilton');await expect(state).toHaveAttribute('data-matched-count','1');
  await expect.poll(async()=> (await points(state))[0]?.value).toBe(331247623);
  await page.getByRole('tab',{name:'Table',exact:true}).click();await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(1);await expect(page.locator('.atlas-data-table')).toContainText('331,247,623');
  expect(errors).toEqual([]);
});

test('CFI linked views preserve institution and valid periods without keeping incompatible time fields', async ({ page }) => {
  await page.goto(`${explorer}&dataset=cfi-projects-by-year&year=2025&entity=${encodeURIComponent(unbc)}`);
  await expect(page.getByTestId('year-select')).toHaveValue('2025');
  await page.getByRole('button',{name:'Collected CFI period totals',exact:true}).click();
  await expect(page.getByTestId('entity-select')).toHaveValue(unbc);await expect(page.getByTestId('year-select')).toHaveCount(0);
  await page.getByRole('button',{name:'CFI decision-year records',exact:true}).click();
  await expect(page.getByTestId('entity-select')).toHaveValue(unbc);await expect(page.getByTestId('year-select')).toHaveValue('2025');
});

test('publication linked views preserve overlapping year and reset only an unavailable period', async ({ page }) => {
  await page.goto(`${explorer}&dataset=publications&year=2023&entity=${encodeURIComponent(unbc)}`);
  await page.getByRole('button',{name:'Longer collected publication series',exact:true}).click();
  await expect(page.getByTestId('year-select')).toHaveValue('2023');await expect(page.getByTestId('entity-select')).toHaveValue(unbc);
  await page.getByTestId('year-select').selectOption('2018');
  await page.getByRole('button',{name:'Existing recent publication selection',exact:true}).click();
  await expect(page.getByTestId('year-select')).toHaveValue('2025');await expect(page.getByTestId('entity-select')).toHaveValue(unbc);
});

test('SSHRC chart, table, map, CSV and reload preserve the same administered-payment subset', async ({ page }) => {
  await page.goto(`${explorer}&dataset=sshrc-payments&entity=${encodeURIComponent(unbc)}&year=2024&display=map`);
  const state=await ready(page,1);await expect.poll(async()=> (await points(state))[0]?.value).toBe(3525824.33);
  await page.getByRole('tab',{name:'Chart',exact:true}).click();await expect(page.locator('.atlas-bar-row')).toHaveCount(1);await expect(page.locator('.atlas-bar-row')).toContainText('3,525,824');
  await page.getByRole('tab',{name:'Table',exact:true}).click();await expect(page.locator('.atlas-data-table tbody tr')).toHaveCount(1);
  const downloadEvent=page.waitForEvent('download'); await page.getByRole('button',{name:'CSV',exact:true}).click();const csv=await readFile((await (await downloadEvent).path())!,'utf8');
  expect(csv.split(/\r?\n/)).toHaveLength(2);expect(csv).toContain('"3525824.33"');expect(csv).toContain('"UNBC / Prince George"');
  await page.reload();await expect(page.getByTestId('entity-select')).toHaveValue(unbc);await expect(page.getByTestId('year-select')).toHaveValue('2024');await expect(page.getByRole('tab',{name:'Table',exact:true})).toHaveAttribute('aria-selected','true');
});

test('four research stories render their source map and hand off to the exact explorer dataset', async ({ page }) => {
  const cases=[['research-infrastructure','cfi-projects-total',7],['social-science-funding','sshrc-payments',6],['biomedical-query-context','pubmed-affiliation-counts',7],['research-spending-and-income','research-expenditures',7]] as const;
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  for(const [story,id,count] of cases) {
    await page.goto(`dev/projects?view=stories&story=${story}`); await ready(page,count);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(1);
    await page.getByRole('button',{name:/Explore this data/i}).click();
    await expect(page).toHaveURL(new RegExp(`dataset=${id}`));
    await ready(page,count);
  }
  expect(errors).toEqual([]);
});


test('CIHR Q3 expectation field remains unavailable and parser rejects changed semantics', async ({ request }) => {
  const p=await (await request.get('data/nhhr/research-expansion-provenance.json')).json();
  const proof=p.sourceBindings.cihrExpectationReview;
  expect(proof).toMatchObject({ status:'blocked', sourceFiscalYear:'202526',snapshotQuarter:'Q3',sourceRows:7309,uniquePaidInstitutionFiscalReferenceKeys:7309,expectedAmountPresentRows:0,expectedAmountBlankRows:7309 });
  expect(proof.definitions.AmountPaidFY_MontantPayeAF.sourceExcelRow).toBe(28);
  expect(proof.definitions.AmountPaidFY_MontantPayeAF.notes).toContain('In the Q1-Q3 updates, this field will only report the expected amount to be paid in the current fiscal year.');
  expect(proof.otherAmountFields).toEqual([{column:'AB',sourceField:'TotalAmountPaid_MontantTotalPaye',presentRows:4232,notSubstituted:true},{column:'AC',sourceField:'TotalAmountAwarded_MontantTotalAccorde',presentRows:7309,notSubstituted:true}]);
  expect(proof.definitions.TotalAmountPaid_MontantTotalPaye.notes).toContain('not including the current fiscal year');
  expect(proof.institutionCoverage.find((r:any)=>r.comparator===unbc)).toMatchObject({sourceInstitutionCode:'ADQW',fundingRecords:4});
  expect((await source(request)).some(d=>d.id==='cihr-expected-payments')).toBe(false);
  // The guard consumes scientific headers and dictionary semantics before any
  // values; fabricated Q3 fixtures here exercise failures, never produce data.
  const code=`import runpy
m=runpy.run_path('scripts/prepare-nhhr-research-expansion.py')
f=m['cihr_expectation_review']
notes='In the Q1-Q3 updates, this field will only report the expected amount to be paid in the current fiscal year.'
d=[(3,{'B3':'FiscalYear_AnneeFinanciere','F3':'YYYYYY April 1st to March 31st'}),(28,{'B28':'AmountPaidFY_MontantPayeAF','F28':notes})]
headers={'B1':'FiscalYear_AnneeFinanciere','C1':'FundingReferenceNumber_NumeroReferenceFinancement','G1':'InstitutionPaidNameEN_NomEtablissementPayeAN','I1':'InstitutionPaidCode_CodeEtablissementPaye','AA1':'TotalAmountAwarded_MontantTotalAccorde'}
g=[(1,headers)]+[(n,{}) for n in range(2,7311)]
f.__globals__['workbook']=lambda raw,sheet:d if sheet=='EN-Metadata' else g
try: f(b'',b'');raise AssertionError('changed amount header accepted')
except ValueError as e: assert 'scientific header changed' in str(e)
d[1][1]['F28']='Actual payments through Q3'
try: f(b'',b'');raise AssertionError('changed expectation definition accepted')
except ValueError as e: assert 'expectation definition changed' in str(e)
d[1][1]['F28']=notes
headers['AA1']='AmountPaidFY_MontantPayeAF'
g[1]=(2,{'B2':'202526','C2':'NEGATIVE-FIXTURE','I2':'CAAA','G2':'University of British Columbia','AA2':'1'})
try: f(b'',b'');raise AssertionError('new amount value accepted without source review')
except ValueError as e: assert 'expected-amount availability changed' in str(e)
print('all CIHR semantic and availability guards passed')`;
  const result=spawnSync('python3',['-c',code],{encoding:'utf8'});
  expect(result.status,result.stderr).toBe(0);expect(result.stdout).toContain('all CIHR semantic and availability guards passed');
});
