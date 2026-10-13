#!/usr/bin/env python3
"""Release the reviewed NHHR city-by-condition aggregate without filling absent rows.

python3 scripts/prepare-nhhr-condition-mix.py --input /private/nhhr-review
python3 scripts/prepare-nhhr-condition-mix.py --input /private/nhhr-review --check
python3 scripts/prepare-nhhr-condition-mix.py --input /private/refresh --refresh --check

Input: DATA-C037/comparator_clinical_condition_domain_summary.csv (or the CSV path).
Refresh follows the authorized manifest and its source catalogue, verifies the
actual original-file ID/hash/table identity, then downloads that original only.
--headers-file accepts private authorized request headers; credentials are never
copied into the bounded release. Source/coding drift requires explicit review.
"""
from __future__ import annotations
import argparse,collections,csv,hashlib,io,json,math,pathlib,re,urllib.request

ROOT=pathlib.Path(__file__).resolve().parents[1]
HOST='https://zoer.k8s.overtheedgepaper.ca'
MANIFEST=HOST+'/api/projects/acdd692f-a188-4f85-bb5a-83c48d5c7e82/database/data-spaces/de1fe530-a762-52fa-ba11-d01cc5b344df/manifest'
CATALOGUE_ID='3f55330b-895e-4153-afc8-467ec545a1e7'
SOURCE=dict(collectionId='DATA-C037',datasetId='a308df09-ac89-4591-980f-624a4908a9b6',filename='comparator_clinical_condition_domain_summary.csv',originalFileId='ac6c958e-45ff-4dc1-828a-3ac2bd3cc04a',sha256='c53a2738c462388d5b76453f9951bac3825adfd2df180f266f1b1d3b555d9674',tableName='nhhr_data_c037_69b3f9e8dcdc_zip_data_c037_compar',sourceRowCount=77,sourceRelativePath='Data Research/Data/processed/strategic_work_package/comparator_clinical_condition_domain_summary.csv')
FIELDS=['query_city','condition_domain','studies','recruiting_now']
DOMAINS={'Cancer / oncology','Cardiovascular / stroke','Diabetes / metabolic','Infectious disease / vaccines','Mental health / substance use','Neurology / brain health','Other / mixed','Pediatrics / youth','Renal / kidney','Respiratory','Rural / Indigenous / community health','Surgery / trauma','Women / maternal health'}
PG_DOMAIN_LINKS={'Cancer / oncology':'Cancer / oncology','Diabetes / prevention':'Diabetes / metabolic','Respiratory / COPD':'Respiratory','Trauma / orthopedics':'Surgery / trauma'}
SNAPSHOT_DATE='2026-04-29'


def input_path(input_dir):
    return input_dir if input_dir.suffix.lower()=='.csv' else input_dir/SOURCE['collectionId']/SOURCE['filename']


def read_original(path):
    raw=path.read_bytes()
    if hashlib.sha256(raw).hexdigest()!=SOURCE['sha256']:
        raise ValueError('Original condition source SHA256 changed; review before releasing new values')
    with path.open(encoding='utf-8-sig',newline='') as handle:
        reader=csv.DictReader(handle)
        if reader.fieldnames!=FIELDS:raise ValueError('Original aggregate schema changed')
        rows=list(reader)
    if len(rows)!=77 or len({(r['query_city'],r['condition_domain']) for r in rows})!=77:
        raise ValueError('Expected 77 unique source city/domain rows')
    if {r['condition_domain'] for r in rows}!=DOMAINS or len({r['query_city'] for r in rows})!=7:
        raise ValueError('Reviewed 7-city/13-domain coverage changed')
    for row in rows:
        if not row['query_city'].strip() or not row['condition_domain'].strip():raise ValueError('Missing source identity')
        for field in ['studies','recruiting_now']:
            if not re.fullmatch(r'\d+',row[field]):raise ValueError('Source count must be an explicit nonnegative integer; missing is not zero')
            row[field]=int(row[field])
        if row['recruiting_now']>row['studies']:raise ValueError('Historical recruiting count exceeds study count')
    return rows


def core_references():
    path=ROOT/'src/atlas/snapshots/atlas-snapshot.json'
    snapshot=json.loads(path.read_text())
    cities=next(d for d in snapshot['datasets'] if d['id']=='clinical-city')
    pg=next(d for d in snapshot['datasets'] if d['id']=='clinical-pg')
    if len(cities['rows'])!=7 or len(pg['rows'])!=10:raise ValueError('Reviewed comparator reference shape changed')
    if len({r['query_city'] for r in cities['rows']})!=7 or len({r['nct_id'] for r in pg['rows']})!=10:raise ValueError('Reference identities are not unique')
    return cities,pg


def column(key,label,numeric=False,unit=None):
    item=dict(key=key,label=label,type='number' if numeric else 'text')
    if unit:item['unit']=unit
    return item


def prepare(rows):
    cities,pg=core_references();city_lookup={r['query_city']:r for r in cities['rows']}
    if set(city_lookup)!={r['query_city'] for r in rows}:raise ValueError('Original city keys do not match the reviewed comparator dataset')
    reconciliation=[]
    for city,reference in city_lookup.items():
        matching=[r for r in rows if r['query_city']==city]
        total=sum(r['studies'] for r in matching);recruiting=sum(r['recruiting_now'] for r in matching)
        if total!=reference['exact_city_site_studies'] or recruiting!=reference['recruiting_now']:raise ValueError('Domain counts differ from reviewed city totals: '+city)
        if total<=0:raise ValueError('City study denominator must be positive')
        reconciliation.append(dict(query_city=city,sourceDomainRows=len(matching),sourceStudies=total,referenceStudies=reference['exact_city_site_studies'],sourceRecruitingSnapshot=recruiting,referenceRecruitingSnapshot=reference['recruiting_now']))
    pg_counts=collections.Counter();pg_recruiting=collections.Counter();pg_bindings=[]
    for row in pg['rows']:
        if row['condition_domain'] not in PG_DOMAIN_LINKS:raise ValueError('Unreviewed Prince George condition-code alias')
        if row['overall_status'] not in {'RECRUITING','ACTIVE_NOT_RECRUITING','UNKNOWN'}:raise ValueError('Prince George status coverage changed')
        domain=PG_DOMAIN_LINKS[row['condition_domain']];pg_counts[domain]+=1
        if row['overall_status']=='RECRUITING':pg_recruiting[domain]+=1
        pg_bindings.append(dict(nct_id=row['nct_id'],sourceFineConditionDomain=row['condition_domain'],aggregateConditionDomain=domain,sourceOverallStatus=row['overall_status']))
    pg_source={r['condition_domain']:r for r in rows if r['query_city']=='Prince George'}
    if set(pg_source)!=set(pg_counts):raise ValueError('Prince George aggregate condition coverage does not match the coded study records')
    for domain,row in pg_source.items():
        if row['studies']!=pg_counts[domain] or row['recruiting_now']!=pg_recruiting[domain]:raise ValueError('Prince George domain/status counts differ from the reviewed study records')
    release_rows=[];row_bindings=[]
    for source_row,row in enumerate(rows,start=2):
        reference=city_lookup[row['query_city']];city_total=reference['exact_city_site_studies'];city_recruiting=reference['recruiting_now']
        share=round(100*row['studies']/city_total,6)
        recruiting_share=round(100*row['recruiting_now']/city_recruiting,6) if city_recruiting else None
        release_rows.append(dict(query_city=row['query_city'],condition_domain=row['condition_domain'],studies=row['studies'],recruiting_snapshot_studies=row['recruiting_now'],condition_share_pct=share,recruiting_condition_share_pct=recruiting_share,city_studies=city_total,city_recruiting_snapshot_studies=city_recruiting,snapshot_date=SNAPSHOT_DATE))
        row_bindings.append(dict(sourceCsvRow=source_row,query_city=row['query_city'],condition_domain=row['condition_domain'],originalStudies=row['studies'],originalRecruitingNow=row['recruiting_now']))
    for city in city_lookup:
        matching=[r for r in release_rows if r['query_city']==city]
        if abs(sum(r['condition_share_pct'] for r in matching)-100)>0.00001:raise ValueError('Full-city composition shares do not sum to 100 within rounding tolerance')
        if city_lookup[city]['recruiting_now'] and abs(sum(r['recruiting_condition_share_pct'] for r in matching)-100)>0.00001:raise ValueError('Historical recruiting composition shares do not sum to 100 within rounding tolerance')
    missing=[dict(query_city=city,condition_domain=domain,reason='No row in the original coded aggregate; no synthetic zero observation created') for city in sorted(city_lookup) for domain in sorted(DOMAINS) if not any(r['query_city']==city and r['condition_domain']==domain for r in rows)]
    zero_count=sum(r['recruiting_now']==0 for r in rows)
    notes=[
        'One row is city × NHHR-coded condition domain. The 77 source rows span 7 comparator cities and 13 exact category labels; the source is a ragged aggregate, not a complete city/category grid.',
        'The aligned comparator snapshot date is 29 April 2026. This aggregate CSV has no own timestamp field; the date labels the existing validated comparator baseline, not an assertion that every registry record was collected on that day.',
        'Condition share = 100 × domain studies / all source studies in the same city. Recruiting composition share = 100 × domain RECRUITING records / all source RECRUITING records in the same city. These percentages describe different portfolios, not the recruiting rate within a condition.',
        'Shares use the fixed full-city denominators. Selecting fewer conditions must not renormalize percentages. City totals are repeated metadata and must not be added across condition rows; they are excluded from the measure selector.',
        'RECRUITING is the historical overall study status from the source snapshot. It does not establish current recruitment, local-site activation, participant eligibility or enrollment. Explicit source zero recruiting counts remain zero.',
        'Condition domains are NHHR analysis coding, not original registry diagnosis codes, measured disease burden or findings from interviews. The Prince George reconciliation explicitly maps its finer coded labels to these broader aggregate labels.',
        'A study can have sites in several cities. Cross-city study/site counts are not unique studies and must not be added into a national portfolio total. Missing city/domain rows are not invented as zero observations.',
        'City map points represent the query city label, not physical study sites or health-authority catchments. Compare one domain at a time; no sum or average is authorized across multiple condition rows at a city.',
        'Only public city/domain aggregate fields are released from the strategic work package. No contact, candidate, participant, consent or remuneration records are included.'
    ]
    dataset=dict(id='clinical-condition-mix',title='Clinical trial condition mix across comparator cities',description='Historical city/domain study counts and fixed-denominator composition shares from NHHR-coded registry evidence.',topic='Clinical research',geography='city',status='observed',timeLabel='Aligned comparator snapshot · 29 April 2026',sourceName='ClinicalTrials.gov · NHHR condition-domain coding',sourceUrl='https://clinicaltrials.gov/',datasetId=SOURCE['datasetId'],tableName=SOURCE['tableName'],notes=notes,columns=[column('query_city','Comparator city'),column('condition_domain','NHHR-coded condition domain'),column('studies','Source city-site study matches',True,'studies'),column('recruiting_snapshot_studies','RECRUITING in aligned snapshot',True,'studies'),column('condition_share_pct','Share of city study portfolio',True,'%'),column('recruiting_condition_share_pct','Share of city RECRUITING portfolio',True,'%'),column('city_studies','Full-city study denominator · metadata'),column('city_recruiting_snapshot_studies','Full-city RECRUITING denominator · metadata'),column('snapshot_date','Aligned comparator snapshot')],rows=release_rows,defaultMetric='condition_share_pct',entityField='query_city',timeField='snapshot_date',mapScaleFields=['condition_domain'])
    snapshot=dict(reviewedAt='2026-10-12',sourceRowCount=77,cityCount=7,distinctConditionDomains=13,absentCityDomainPairs=len(missing),explicitZeroRecruitingRows=zero_count,alignedComparatorSnapshot=SNAPSHOT_DATE,sourceHasOwnTimestamp=False,shareConvention='Percentage points (0–100), rounded to 6 decimals; fixed full-city denominator, never filtered-subset renormalization')
    provenance=dict(reviewedAt='2026-10-12',manifestUrl=MANIFEST,catalogueDatasetId=CATALOGUE_ID,catalogueFiles=['NHHR_files.csv','NHHR_tables.csv'],originalSource=SOURCE,originalDownloadUrl=HOST+'/api/files/'+SOURCE['originalFileId']+'/download',releaseGrain='City × NHHR-coded condition domain; original 77 ragged rows preserved',snapshotDate=SNAPSHOT_DATE,snapshotDateMeaning='Aligned existing validated comparator baseline. The aggregate CSV has no own timestamp; exact city totals and Prince George study/status reconciliation support alignment, not a new collection-date claim.',sourceStatusField='recruiting_now; source historical overall study status, not local recruitment or current availability',sourceCoding='NHHR-derived condition domain, not a registry-controlled diagnosis category',referenceDatasets=[dict(id=cities['id'],datasetId=cities['datasetId'],tableName=cities['tableName']),dict(id=pg['id'],datasetId=pg['datasetId'],tableName=pg['tableName'])],cityReconciliation=reconciliation,princeGeorgeDomainAliases=PG_DOMAIN_LINKS,princeGeorgeStudyBindings=pg_bindings,rowBindings=row_bindings,absentCityDomainPairs=missing,explicitZeroRecruitingRows=zero_count,calculations=dict(condition_share_pct='100 × studies / city_studies',recruiting_condition_share_pct='100 × recruiting_snapshot_studies / city_recruiting_snapshot_studies; null if the full-city recruiting denominator is zero',rounding='6 decimal percentage points; fixed original city denominators'),denominatorColumns='Values remain numeric row metadata, while column type=text excludes repeated full-city totals from selectable numeric measures',limitations=notes)
    return dict(datasets=[dataset],snapshot=snapshot),provenance


def fetch_original(input_dir,headers):
    def fetch(url):
        with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=45) as response:return response.read()
    manifest=json.loads(fetch(MANIFEST))
    if not any(r.get('kind')=='dataset' and r.get('id')==SOURCE['datasetId'] for r in manifest.get('resources',[])):raise ValueError('Selected condition dataset is no longer listed in the authorized manifest')
    catalogue=next((r for r in manifest.get('manifestSources',[]) if r.get('id')==CATALOGUE_ID),None)
    if not catalogue:raise ValueError('Reviewed authoritative source catalogue is absent from manifest')
    linked={f['name']:f for f in catalogue.get('files',[])}
    data={}
    for name in ['NHHR_files.csv','NHHR_tables.csv']:
        if name not in linked:raise ValueError('Source catalogue file missing: '+name)
        url=linked[name]['url']
        if not url.startswith('/api/datasets/'+CATALOGUE_ID+'/files/'):raise ValueError('Catalogue URL outside reviewed dataset endpoint')
        data[name]=list(csv.DictReader(io.StringIO(fetch(HOST+url).decode('utf-8-sig'))))
    files=[r for r in data['NHHR_files.csv'] if r['host_collection_id']==SOURCE['collectionId'] and r['dataset_id']==SOURCE['datasetId'] and pathlib.PurePosixPath(r['canonical_relative_path']).name==SOURCE['filename']]
    if not any(r['sha256']==SOURCE['sha256'] and SOURCE['originalFileId'] in r['original_file_ids'].split(';') for r in files):raise ValueError('Fresh catalogue original-file ID/hash differs from reviewed condition source')
    if not any(r['host_collection_id']==SOURCE['collectionId'] and r['dataset_id']==SOURCE['datasetId'] and r['source_sha256']==SOURCE['sha256'] and r['table_name']==SOURCE['tableName'] and int(r['row_count'])==77 for r in data['NHHR_tables.csv']):raise ValueError('Fresh catalogue table lineage differs from reviewed condition source')
    raw=fetch(HOST+'/api/files/'+SOURCE['originalFileId']+'/download')
    if hashlib.sha256(raw).hexdigest()!=SOURCE['sha256']:raise ValueError('Downloaded original condition CSV hash changed; release stopped')
    path=input_path(input_dir);path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(raw)


def emit(path,output,check):
    content=(json.dumps(output,ensure_ascii=False,indent=2,allow_nan=False)+'\n').encode('utf-8')
    if check:
        if not path.exists() or path.read_bytes()!=content:raise ValueError(str(path.relative_to(ROOT))+': differs from reviewed generated output')
    else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(content)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',type=pathlib.Path,required=True)
    parser.add_argument('--refresh',action='store_true')
    parser.add_argument('--headers-file',type=pathlib.Path)
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    if args.refresh:fetch_original(args.input,json.loads(args.headers_file.read_text()) if args.headers_file else {})
    rows=read_original(input_path(args.input));release,provenance=prepare(rows)
    emit(ROOT/'src/atlas/snapshots/clinical-condition-mix.json',release,args.check)
    emit(ROOT/'public/data/nhhr/clinical-condition-mix.json',release,args.check)
    emit(ROOT/'public/data/nhhr/clinical-condition-mix-provenance.json',provenance,args.check)
    s=release['snapshot'];print(f"Validated {s['sourceRowCount']} city/domain rows, {s['cityCount']} cities, {s['distinctConditionDomains']} labels, {s['absentCityDomainPairs']} absent pairs and {s['explicitZeroRecruitingRows']} explicit recruiting zero rows")

if __name__=='__main__':main()
