#!/usr/bin/env python3
"""Prepare bounded NHHR Northern LHA age structure from a hash-locked original.

python3 scripts/prepare-nhhr-population-ages.py --input /private/source-csvs
python3 scripts/prepare-nhhr-population-ages.py --input /private/source-csvs --check
python3 scripts/prepare-nhhr-population-ages.py --input /private/refresh --refresh

Inputs: DATA-C051/local-health-area-population.csv. The optional --headers-file
is private authorized request-header JSON; it is never copied into the release.
Outputs: source/public population-ages.json mirrors and public provenance only.
"""
from __future__ import annotations
import argparse,csv,hashlib,json,pathlib,re,urllib.request

ROOT=pathlib.Path(__file__).resolve().parents[1]
HOST='https://zoer.k8s.overtheedgepaper.ca'
MANIFEST=HOST+'/api/projects/acdd692f-a188-4f85-bb5a-83c48d5c7e82/database/data-spaces/de1fe530-a762-52fa-ba11-d01cc5b344df/manifest'
SOURCE=json.loads((ROOT/'scripts/nhhr-source-lock.json').read_text())['sources']['lha_raw']
AGE_FIELDS=[str(i) for i in range(90)]+['90+']


def public_total_rows():
    release=json.loads((ROOT/'src/atlas/snapshots/atlas-snapshot.json').read_text())
    ds=next(d for d in release['datasets'] if d['id']=='population-lha')
    rows={(r['lha_code'],str(r['year'])):r for r in ds['rows']}
    if len(rows)!=102 or len({key[0] for key in rows})!=17:
        raise ValueError('Vetted population-lha reference must have17 Northern LHAs × 6 years')
    if {key[1] for key in rows}!={str(y) for y in range(2020,2026)}:
        raise ValueError('Vetted reference year coverage changed; review before release')
    return rows


def read_ages(path):
    raw=path.read_bytes()
    if hashlib.sha256(raw).hexdigest()!=SOURCE['sha256']:
        raise ValueError('Original source SHA256 changed; re-review rather than silently release')
    reference=public_total_rows()
    with path.open(encoding='utf-8-sig',newline='') as handle:
        reader=csv.DictReader(handle)
        fields=reader.fieldnames or []
        age_columns={f for f in fields if re.fullmatch(r'\d+\+?',f)}
        if age_columns!=set(AGE_FIELDS):
            raise ValueError('Age schema must be exactly single years 0–89 and terminal 90+; missing/overflow ages require review')
        required={'Region','Region.Name','Region.Type','Year','Type','Gender','Total'}|set(AGE_FIELDS)
        if not required.issubset(fields):
            raise ValueError('Source lacks required total/age fields')
        all_rows=list(reader)
    if len(all_rows)!=SOURCE['sourceRowCount']:
        raise ValueError('Original row count differs from vetted source lock')
    released=[]
    seen=set()
    for r in all_rows:
        key=(r['Region'],r['Year'])
        if r['Gender']!='T' or key not in reference:
            continue
        if key in seen:
            raise ValueError('Duplicate total row for LHA/year')
        seen.add(key)
        if r['Region.Type']!='Local Health Area' or r['Type'] not in {'Estimate','Projection'}:
            raise ValueError('Unexpected geography/population_type')
        values={}
        for field in ['Total']+AGE_FIELDS:
            text=r[field].strip()
            if not re.fullmatch(r'\d+',text):
                raise ValueError('Age/population value is missing, nonintegral or negative')
            values[field]=int(text)
        groups=[sum(values[str(i)] for i in range(20)),sum(values[str(i)] for i in range(20,65)),sum(values[str(i)] for i in range(65,90))+values['90+']]
        if sum(groups)!=values['Total'] or sum(values[a] for a in AGE_FIELDS)!=values['Total']:
            raise ValueError('Age partitions do not sum exactly to raw Total')
        vetted=reference[key]
        if values['Total']!=vetted['population'] or r['Region.Name']!=vetted['region_name'] or r['Type']!=vetted['population_type']:
            raise ValueError('Age source differs from existing vetted LHA population identity/total/type')
        if values['Total']<=0:
            raise ValueError('Population must be positive for a share calculation')
        released.append(dict(lha_code=r['Region'],region_name=r['Region.Name'],year=r['Year'],population_type=r['Type'],total_population=values['Total'],population_0_19=groups[0],population_20_64=groups[1],population_65_plus=groups[2],share_65_plus=round(100*groups[2]/values['Total'],6)))
    if seen!=set(reference):
        raise ValueError('Not all 102 vetted area/year totals are covered')
    return sorted(released,key=lambda r:(r['year'],r['lha_code']))


def column(key,label,numeric=False,unit=None):
    c=dict(key=key,label=label,type='number' if numeric else 'text')
    if unit:c['unit']=unit
    return c


def write_or_check(path,output,check):
    content=(json.dumps(output,ensure_ascii=False,indent=2,allow_nan=False)+'\n').encode('utf-8')
    if check:
        if not path.exists() or path.read_bytes()!=content:
            raise ValueError(str(path.relative_to(ROOT))+': generated output differs from reviewed source')
    else:
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_bytes(content)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',type=pathlib.Path,required=True)
    parser.add_argument('--refresh',action='store_true')
    parser.add_argument('--headers-file',type=pathlib.Path)
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    source_path=args.input/SOURCE['collectionId']/SOURCE['filename']
    if args.refresh:
        headers=json.loads(args.headers_file.read_text()) if args.headers_file else {}
        def fetch(url):
            with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=45) as response:return response.read()
        manifest=json.loads(fetch(MANIFEST))
        if not any(r.get('kind')=='dataset' and r.get('id')==SOURCE['datasetId'] for r in manifest.get('resources',[])):
            raise ValueError('Reviewed population dataset no longer listed by authorized NHHR manifest')
        raw=fetch(HOST+'/api/files/'+SOURCE['originalFileId']+'/download')
        if hashlib.sha256(raw).hexdigest()!=SOURCE['sha256']:
            raise ValueError('Downloaded population source hash differs from vetted original')
        source_path.parent.mkdir(parents=True,exist_ok=True)
        source_path.write_bytes(raw)
    rows=read_ages(source_path)
    dataset=dict(id='population-lha-ages',title='Northern LHA population age structure',description='Source age counts and age 65+ shares for seventeen Northern local health areas, with estimates and projections labelled.',topic='Population',geography='lha',status='observed',timeLabel='2020–2025 · collected April 2026',sourceName='BC Stats · verified total-sex age rows',sourceUrl='https://www2.gov.bc.ca/gov/content/data/statistics/people-population-community/population/population-estimates',datasetId=SOURCE['datasetId'],tableName=SOURCE['tableName'],notes=[
        'One Gender=T row per area/year already totals the population. Female, Male and Total rows are never added together.',
        'Age groups exactly partition the source Total: 0–19, 20–64, and 65+, with terminal 90+ included once. All 102 totals, area names and source types match the existing vetted LHA population dataset.',
        'Age 65+ share is calculated as 100 × population_65_plus / Total, stored as percentage points (0–100) and rounded to 6 decimal places. Counts are exact source integers.',
        'SourceType is retained: 2025 is a Projection in this collected source, not an observed census count. Boundary capture and population reference periods are distinct.',
        'Age structure is demographic context; it does not measure health-service use, disease prevalence, research participants, dependency or NHHR effects.'
    ],columns=[column('region_name','Local health area'),column('lha_code','LHA code'),column('year','Year'),column('population_type','Source estimate / projection'),column('total_population','Total population',True,'people'),column('population_0_19','Population aged 0–19',True,'people'),column('population_20_64','Population aged 20–64',True,'people'),column('population_65_plus','Population aged 65+',True,'people'),column('share_65_plus','Population aged 65+ share',True,'%')],rows=rows,defaultMetric='share_65_plus',entityField='region_name',timeField='year',boundaryKeyField='lha_code')
    release=dict(datasets=[dataset],snapshot=dict(reviewedAt='2026-10-12',rowCount=len(rows),sourceAgeFields=AGE_FIELDS,calculation='Integer sums of source ages; age 65+ share = 100 × 65+ count / Total, rounded to 6 decimals',percentageConvention='Percentage points (0–100)',referenceDataset='population-lha',validation='Each of 102 age partitions equals raw Total and vetted LHA population; exact Gender=T only; full age 0–89 plus 90+ schema verified'))
    provenance=dict(reviewedAt='2026-10-12',manifestUrl=MANIFEST,source=SOURCE,originalDownloadUrl=HOST+'/api/files/'+SOURCE['originalFileId']+'/download',releaseScope='17 Northern LHAs × 2020–2025; no individual, contact, participant or consent records',sourceAgeFields=AGE_FIELDS,terminalAgeGroup='90+ includes all ages 90 and older; no higher age columns accepted',counts='Integer source ages 0–19, 20–64, 65–89 plus 90+; partitions verified against Total',share='100 × population_65_plus / Total; percentage points rounded to 6 decimals',sourcePopulationJoin='Existing population-lha identity (lha_code, year), name, total and population_type verified for all 102 rows')
    write_or_check(ROOT/'public/data/nhhr/population-ages.json',release,args.check)
    write_or_check(ROOT/'src/atlas/snapshots/population-ages.json',release,args.check)
    write_or_check(ROOT/'public/data/nhhr/population-ages-provenance.json',provenance,args.check)
    print('Validated 102 Northern LHA/year age partitions and byte-identical public/source mirrors')

if __name__=='__main__':main()
