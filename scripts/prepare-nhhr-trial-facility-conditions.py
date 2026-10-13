#!/usr/bin/env python3
"""Release public historical trial/facility aggregates and a separate safe study-site CSV.

--input accepts the locked original CSV or its parent directory. --refresh follows
the authorized manifest, original file catalogue and table lineage. Changed source
or location-review hashes require independent review, never automatic promotion.
"""
from __future__ import annotations
import argparse,collections,csv,hashlib,io,json,pathlib,re,urllib.request

ROOT=pathlib.Path(__file__).resolve().parents[1]
HOST='https://zoer.k8s.overtheedgepaper.ca'
MANIFEST=HOST+'/api/projects/acdd692f-a188-4f85-bb5a-83c48d5c7e82/database/data-spaces/de1fe530-a762-52fa-ba11-d01cc5b344df/manifest'
CATALOGUE='3f55330b-895e-4153-afc8-467ec545a1e7'
SOURCE=dict(collectionId='DATA-C037',datasetId='a308df09-ac89-4591-980f-624a4908a9b6',filename='comparator_clinical_trials_coded_exact_city.csv',originalFileId='faddef0a-6f47-42bb-8968-197e10322dd1',sha256='7e809511a4b5f330087f9ea31388448be0a4e2add150444b00eebf922bb5b4be',tableName='nhhr_data_c037_69b3f9e8dcdc_zip_data_c037__17',tableParquetSha256='73f2d9ea7bc717e97e23b59a59b2a5612e2905bb298744f8c4f210732da8fe3f',sourceRowCount=15028,sourceRelativePath='Data Research/Data/processed/strategic_work_package/comparator_clinical_trials_coded_exact_city.csv')
REVIEW_PATH=ROOT/'scripts/nhhr-comparator-trial-locations.json'
REVIEW_SHA='48519369c263020bbe3145ffeec5421b8886fa82e7e30a6ecac90dd62318f38b'
DATE='2026-04-29'
FIELDS=['query_city','nct_id','overall_status','condition_domain','exact_city_facilities','matched_query_city_site_count','is_recruiting_now']
STATUS={'COMPLETED','RECRUITING','TERMINATED','ACTIVE_NOT_RECRUITING','UNKNOWN','WITHDRAWN','NOT_YET_RECRUITING','ENROLLING_BY_INVITATION','SUSPENDED','NO_LONGER_AVAILABLE','APPROVED_FOR_MARKETING','AVAILABLE'}

def require(condition,message):
    if not condition:raise ValueError(message)

def input_path(path):
    if path.suffix.lower()=='.csv':return path
    if (path/SOURCE['filename']).exists():return path/SOURCE['filename']
    return path/SOURCE['collectionId']/SOURCE['filename']

def read_source(path):
    raw=path.read_bytes();require(hashlib.sha256(raw).hexdigest()==SOURCE['sha256'],'Original trial source hash changed')
    reader=csv.DictReader(io.StringIO(raw.decode('utf-8-sig')))
    require(all(f in reader.fieldnames for f in FIELDS),'Required public source fields missing')
    # Only allowlisted fields enter preparation; no title, contact, participant or sponsor records.
    rows=[{f:r[f] for f in FIELDS} for r in reader]
    require(len(rows)==15028 and len({(r['query_city'],r['nct_id']) for r in rows})==15028,'Expected15028 unique city/NCT observations')
    for r in rows:
        require(re.fullmatch(r'NCT\d{8}',r['nct_id']) is not None,'Invalid original registry ID')
        require(r['overall_status'] in STATUS,'Unreviewed historical status')
        require(r['is_recruiting_now']==str(r['overall_status']=='RECRUITING'),'Recruiting flag differs from source status')
        require(re.fullmatch(r'\d+',r['matched_query_city_site_count']) is not None,'Missing source matched-site count')
        r['matched_query_city_site_count']=int(r['matched_query_city_site_count'])
    return rows

def reviewed_locations():
    raw=REVIEW_PATH.read_bytes();require(hashlib.sha256(raw).hexdigest()==REVIEW_SHA,'Location review changed; independent review required')
    review=json.loads(raw);locations={l['code']:l for l in review['locations']}
    require(len(locations)==25 and len(review['locationEvidence'])==25,'Expected25 individually reviewed locations')
    aliases={}
    for e in review['locationEvidence']:
        l=locations[e['code']]
        require(e['city']==l['city'] and e['coordinates']==l['coordinates'] and e['coordinateSourceUrl']==l['coordinateSourceUrl'],'Location/evidence identity mismatch')
        require(len(l['coordinates'])==2 and all(isinstance(x,(int,float)) for x in l['coordinates']),'Missing reviewed point coordinate')
        require(l['coordinateSourceUrl'].startswith('https://www.openstreetmap.org/'),'Missing independently returned OSM coordinate source')
        for alias in e['sourceSiteAliases']:
            key=(e['city'],alias)
            require(key not in aliases or aliases[key]==e['code'],'Alias assigned to multiple physical facilities')
            aliases[key]=e['code']
    return review,locations,aliases

def col(key,label,number=False,unit=None):
    d=dict(key=key,label=label,type='number' if number else 'text')
    if unit:d['unit']=unit
    return d

def prepare(rows):
    review,locations,aliases=reviewed_locations()
    baseline=json.loads((ROOT/'src/atlas/snapshots/clinical-condition-mix.json').read_text())['datasets'][0]
    expected={(r['query_city'],r['condition_domain']):(r['studies'],r['recruiting_snapshot_studies']) for r in baseline['rows']}
    observed=collections.Counter((r['query_city'],r['condition_domain']) for r in rows)
    recruiting=collections.Counter((r['query_city'],r['condition_domain']) for r in rows if r['overall_status']=='RECRUITING')
    require(set(expected)==set(observed),'Source city/domain identities differ from reviewed77-row condition release')
    for key,(n,recruit) in expected.items():require((observed[key],recruiting[key])==(n,recruit),'Source count/status reconciliation failed: '+str(key))
    core=json.loads((ROOT/'src/atlas/snapshots/atlas-snapshot.json').read_text())['datasets']
    cities=next(d for d in core if d['id']=='clinical-city')['rows']
    city_lookup={r['query_city']:r for r in cities}
    require(set(city_lookup)=={r['query_city'] for r in rows},'Source cities differ from reviewed core')
    stats={city:collections.Counter() for city in city_lookup}
    all_aliases={city:set() for city in city_lookup};known_aliases={city:set() for city in city_lookup}
    facility_ncts=collections.defaultdict(set);facility_domains=collections.defaultdict(set)
    facility_recruiting=collections.defaultdict(set);safe=[]
    mismatch_histogram=collections.Counter()
    for source_row,r in enumerate(rows,start=2):
        city=r['query_city'];s=stats[city];s['city_studies']+=1
        # Exact literal delimiter only. No comma/bare-semicolon/fuzzy splitting.
        parsed=[x.strip() for x in r['exact_city_facilities'].split('; ') if x.strip()]
        labels=list(dict.fromkeys(parsed));all_aliases[city].update(labels)
        matched=collections.defaultdict(list)
        for label in labels:
            code=aliases.get((city,label))
            if code:matched[code].append(label);known_aliases[city].add(label)
        unresolved=sum((city,label) not in aliases for label in labels)
        mismatch=r['matched_query_city_site_count']!=len(labels)
        if mismatch:s['source_site_count_mismatch_studies']+=1;mismatch_histogram[(r['matched_query_city_site_count'],len(labels))]+=1
        if not labels:s['missing_facility_label_studies']+=1
        if matched:
            s['studies_with_verified_facility']+=1
            if unresolved:s['partly_located_studies']+=1
            if unresolved:s['studies_with_unresolved_recorded_alias']+=1
            if mismatch:s['located_studies_with_source_count_mismatch']+=1
        else:s['no_verified_facility_studies']+=1
        for code,verified_aliases in sorted(matched.items()):
            key=(code,r['condition_domain']);facility_ncts[code].add(r['nct_id']);facility_domains[key].add(r['nct_id'])
            if r['overall_status']=='RECRUITING':facility_recruiting[key].add(r['nct_id'])
            safe.append(dict(query_city=city,nct_id=r['nct_id'],facility_name=locations[code]['name'],location_code=code,condition_domain=r['condition_domain'],overall_status=r['overall_status'],source_facility_aliases='; '.join(verified_aliases),source_csv_row=source_row,source_matched_site_count=r['matched_query_city_site_count'],parsed_unique_alias_count=len(labels),unresolved_alias_count=unresolved,source_site_count_mismatch=str(mismatch).lower(),registry_url='https://clinicaltrials.gov/study/'+r['nct_id'],snapshot_date=DATE))
    require(len({(r['query_city'],r['nct_id'],r['location_code']) for r in safe})==len(safe),'Duplicate city/study/physical-site CSV row')
    require(set(facility_ncts)==set(locations),'Reviewed location has no source study match')
    output=[]
    for (code,domain),ids in sorted(facility_domains.items(),key=lambda x:(locations[x[0][0]]['city'],locations[x[0][0]]['name'],x[0][1])):
        l=locations[code];denominator=len(facility_ncts[code])
        output.append(dict(facility_name=l['name'],query_city=l['city'],condition_domain=domain,location_code=code,distinct_studies=len(ids),recruiting_snapshot_studies=len(facility_recruiting[(code,domain)]),condition_share_pct=round(100*len(ids)/denominator,6),facility_studies=denominator,snapshot_date=DATE))
    for code,total in facility_ncts.items():
        require(sum(r['distinct_studies'] for r in output if r['location_code']==code)==len(total),'Facility condition partition does not match fixed denominator')
    coverage=[]
    for city in sorted(stats):
        s=stats[city];require(s['city_studies']==city_lookup[city]['exact_city_site_studies'],'City core total does not reconcile')
        require(s['studies_with_verified_facility']+s['no_verified_facility_studies']==s['city_studies'],'Coverage does not partition city studies')
        coverage.append(dict(query_city=city,city_studies=s['city_studies'],studies_with_verified_facility=s['studies_with_verified_facility'],no_verified_facility_studies=s['no_verified_facility_studies'],partly_located_studies=s['partly_located_studies'],verified_facility_share_pct=round(100*s['studies_with_verified_facility']/s['city_studies'],6),source_site_count_mismatch_studies=s['source_site_count_mismatch_studies'],located_studies_with_source_count_mismatch=s['located_studies_with_source_count_mismatch'],studies_with_unresolved_recorded_alias=s['studies_with_unresolved_recorded_alias'],missing_facility_label_studies=s['missing_facility_label_studies'],source_distinct_facility_aliases=len(all_aliases[city]),reviewed_matched_facility_aliases=len(known_aliases[city]),unreviewed_facility_aliases=len(all_aliases[city]-known_aliases[city]),verified_physical_facilities=sum(l['city']==city for l in locations.values()),snapshot_date=DATE))
    notes=[
      'One observation is a reviewed physical facility × NHHR-coded condition domain. Only observed source combinations are released; absent domain rows are not invented as zeros.',
      'Distinct studies are deduplicated by source query city, NCT ID and reviewed physical location code. Alias variants at one facility collapse; one study at several facilities remains a relationship at each. Counts across cities or facilities are not a unique-study total.',
      'Condition share =100 × distinct domain studies / all distinct source studies at that reviewed facility. The full-facility denominator is fixed; filtering conditions does not renormalize percentages.',
      'RECRUITING is historical overall study status in the aligned 29 April 2026 comparator baseline, not verified local-site recruitment, current availability, eligibility, enrollment or capacity.',
      'Condition domains are NHHR analysis coding, not registry-controlled diagnosis codes, disease burden or participant/interview findings.',
      'Coordinates represent independently checked named public facilities. Current official/OSM evidence does not establish where every historical study visit occurred. Campus-level Sudbury cancer precision and address exceptions remain explicit in location notes.',
      'Exact recorded aliases and query city are used, with the literal delimiter "; " only. Generic sites, umbrella institutions, unreviewed aliases and broad regional descriptions remain unresolved; no city-centroid, fuzzy-match or hospital substitution.',
      'Recorded matched-site counts and deduplicated alias-list lengths disagree in 1,304 source studies. These disagreements are quality flags, not evidence of additional distinct physical sites. Partly located counts include at least one nonempty unreviewed recorded alias. Count/list mismatch is separate: repeated source site rows can share one deduplicated name, so disagreement does not prove an additional physical facility.',
      'The finite 25-facility review is incomplete geographic coverage. No participant, contact, consent or remuneration fields enter this release; underlying safe study/site relationships are downloaded separately as CSV.'
    ]
    common=dict(topic='Clinical research',status='observed',timeLabel='Aligned comparator snapshot · 29 April 2026',sourceName='ClinicalTrials.gov · NHHR exact-city facility/condition coding',sourceUrl='https://clinicaltrials.gov/',datasetId=SOURCE['datasetId'],tableName=SOURCE['tableName'],timeField='snapshot_date')
    facility=dict(**common,id='trial-facility-conditions',title='Trial conditions at reviewed physical facilities',description='Historical verified facility/domain relationships with distinct study counts and fixed facility shares.',geography='facility',notes=notes,columns=[col('facility_name','Reviewed physical facility'),col('query_city','Comparator city'),col('condition_domain','NHHR-coded condition domain'),col('distinct_studies','Distinct source studies at facility',True,'studies'),col('recruiting_snapshot_studies','RECRUITING in aligned snapshot',True,'studies'),col('condition_share_pct','Share of facility study portfolio',True,'%'),col('facility_studies','Full-facility study denominator · metadata'),col('location_code','Reviewed location code'),col('snapshot_date','Aligned comparator snapshot')],rows=output,defaultMetric='distinct_studies',entityField='facility_name',boundaryKeyField='location_code',mapLocationsAsset='locations-comparator-trial-sites.geojson',defaultFilters={'condition_domain':'Cancer / oncology'},mapScaleFields=['condition_domain'])
    coverage_notes=notes+[ 'City coverage counts distinct source city/NCT records with at least one reviewed physical facility. No verified facility does not imply no study or no facility: it means no accepted exact geographic join in this review.', 'Partly located is a subset of studies_with_verified_facility, not a third disjoint category. It includes at least one nonempty unreviewed recorded alias. Count/list disagreements are reported separately and do not prove additional physical facilities. All original city study counts remain in the denominator.' ]
    columns=[col('query_city','Comparator city')]+[col(k,l,k!='city_studies','%' if k.endswith('_pct') else 'studies' if k.endswith('_studies') or k in ['city_studies','studies_with_verified_facility'] else 'records') for k,l in [
        ('city_studies','Original coded city studies'),('studies_with_verified_facility','Studies with at least one reviewed facility'),('no_verified_facility_studies','Studies without a verified facility join'),('partly_located_studies','Located studies with unresolved coverage'),('verified_facility_share_pct','Share with a reviewed physical facility'),('source_site_count_mismatch_studies','Source site-count/list disagreements'),('located_studies_with_source_count_mismatch','Located records with count disagreement'),('studies_with_unresolved_recorded_alias','Located records with unreviewed aliases'),('missing_facility_label_studies','Records without named facility aliases'),('source_distinct_facility_aliases','Distinct recorded city/facility aliases'),('reviewed_matched_facility_aliases','Recorded aliases with accepted exact matches'),('unreviewed_facility_aliases','Recorded aliases without accepted matches'),('verified_physical_facilities','Reviewed physical facilities')]]+[col('snapshot_date','Aligned comparator snapshot')]
    cov=dict(**common,id='trial-facility-coverage',title='How much trial evidence has a reviewed facility location?',description='All seven city portfolios retained, with mapped and unresolved study coverage shown separately.',geography='city',notes=coverage_notes,columns=columns,rows=coverage,defaultMetric='studies_with_verified_facility',entityField='query_city')
    overview=dict(sourceCityStudyRows=len(rows),reviewedPhysicalFacilities=len(locations),observedFacilityDomainRows=len(output),safeStudySiteRelationships=len(safe),sourceSiteCountMismatchStudies=sum(s['source_site_count_mismatch_studies'] for s in stats.values()),distinctSourceCityAliases=sum(len(x) for x in all_aliases.values()),reviewedMatchedAliases=sum(len(x) for x in known_aliases.values()),alignedComparatorSnapshot=DATE)
    overview.update(studiesWithVerifiedFacility=sum(r['studies_with_verified_facility'] for r in coverage),noVerifiedFacilityStudies=sum(r['no_verified_facility_studies'] for r in coverage),partlyLocatedStudies=sum(r['partly_located_studies'] for r in coverage),coverageCountGrain='Distinct query-city/NCT observations; not cross-city unique studies')
    provenance=dict(reviewedAt=review['reviewedAt'],manifestUrl=MANIFEST,originalSource=SOURCE,originalDownloadUrl=HOST+'/api/files/'+SOURCE['originalFileId']+'/download',locationReview=dict(path=str(REVIEW_PATH.relative_to(ROOT)),sha256=REVIEW_SHA),catalogueDatasetId=CATALOGUE,releaseGrain='Reviewed physical facility × NHHR-coded condition domain; coverage is original query-city/NCT observations',sourceStatusField='overall_status; is_recruiting_now validated against RECRUITING',sourceFieldsSelected=FIELDS,coverage=overview,cityCoverage=coverage,conditionReconciliation=[dict(query_city=k[0],condition_domain=k[1],studies=observed[k],recruiting_snapshot_studies=recruiting[k]) for k in sorted(expected)],splitMethod='Literal "; " only, outer whitespace trimmed; repeated identical labels collapse; exact query-city/alias matching only',siteCountMismatchDistribution=[dict(recordedMatchedSiteCount=k[0],parsedUniqueAliasCount=k[1],studies=n) for k,n in sorted(mismatch_histogram.items())],locationEvidence=review['locationEvidence'],pgMapsSource=review['pgMapsSource'],aggregation=dict(uniqueStudySiteKey=['query_city','nct_id','location_code'],facilityDenominator='All distinct source NCT IDs matched to the reviewed facility, including every observed condition domain',share='100 × distinct domain studies / facility_studies;6decimal percentage points',coverage='One city/NCT counts once as mapped if any physical code is verified; partial includes at least one nonempty unresolved recorded alias; count/list mismatch is separate'),unresolved=dict(policy='No unreviewed raw names, contact-like strings or inferred locations are copied; city counts and reason categories only',categories=['missing facility label','unreviewed source alias','recorded site-count/list disagreement']),safeCSV=dict(filename='trial-facility-study-sites.csv',rows=len(safe),columns=list(safe[0])),snapshotDate=DATE,snapshotDateMeaning='Aligned existing comparator baseline; source rows have no collection timestamp. Exact city and77domain counts reconcile to the reviewed baseline, not a new collection-date claim.',limitations=notes)
    geo=dict(type='FeatureCollection',metadata=dict(source='NHHR reviewed exact-city facility aliases, independent official/OSM evidence',attribution='© OpenStreetMap contributors, ODbL; official operator references retained',locationReviewSha256=REVIEW_SHA,features=len(locations)),features=[dict(type='Feature',id=l['code'],geometry=dict(type='Point',coordinates=l['coordinates']),properties=dict(code=l['code'],name=l['name'],site=l['site'],city=l['city'],source_url=l['sourceUrl'],coordinate_source_url=l['coordinateSourceUrl'],location_note=l['locationNote'],location_precision=l.get('locationPrecision','facility'))) for l in review['locations']])
    return dict(datasets=[facility,cov],snapshot=overview),provenance,geo,safe

def emit_bytes(path,data,check):
    if check:require(path.exists() and path.read_bytes()==data,str(path.relative_to(ROOT))+': generated output drift')
    else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)

def json_bytes(value):return (json.dumps(value,indent=2,ensure_ascii=False,allow_nan=False)+'\n').encode()

def refresh(input_dir,headers):
    def fetch(url):
        require(url.startswith(HOST+'/api/'),'Refresh endpoint is outside the reviewed Zoer API')
        with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=45) as response:return response.read()
    manifest=json.loads(fetch(MANIFEST))
    resource=next((r for r in manifest.get('resources',[]) if r.get('kind')=='dataset' and r.get('id')==SOURCE['datasetId']),None)
    require(resource is not None and resource.get('available'),'Reviewed source dataset unavailable in manifest')
    require(resource['datasetUrl']==('/api/datasets/'+SOURCE['datasetId']),'Dataset endpoint changed')
    descriptor=json.loads(fetch(HOST+resource['datasetUrl']))['dataset']
    require(descriptor['id']==SOURCE['datasetId'] and descriptor['status']=='ready' and descriptor['artifactVersion']==1,'Dataset identity/version changed')
    table=next((t for t in resource.get('tables',[]) if t['name']==SOURCE['tableName']),None)
    require(table is not None and int(table['rows'])==SOURCE['sourceRowCount'],'Manifest table identity/count changed')
    catalogue=next((r for r in manifest.get('manifestSources',[]) if r.get('id')==CATALOGUE),None)
    require(catalogue is not None,'Reviewed authoritative catalogue absent')
    linked={f['name']:f for f in catalogue.get('files',[])};catalogues={}
    for name in ['NHHR_files.csv','NHHR_tables.csv']:
        require(name in linked and linked[name]['url'].startswith('/api/datasets/'+CATALOGUE+'/files/'),'Catalogue binding changed')
        catalogues[name]=list(csv.DictReader(io.StringIO(fetch(HOST+linked[name]['url']).decode('utf-8-sig'))))
    files=[r for r in catalogues['NHHR_files.csv'] if r['host_collection_id']==SOURCE['collectionId'] and r['dataset_id']==SOURCE['datasetId'] and r['canonical_relative_path']==SOURCE['sourceRelativePath']]
    require(any(r['sha256']==SOURCE['sha256'] and SOURCE['originalFileId'] in r['original_file_ids'].split(';') for r in files),'Original catalogue ID/hash binding changed')
    tables=[r for r in catalogues['NHHR_tables.csv'] if r['dataset_id']==SOURCE['datasetId'] and r['table_name']==SOURCE['tableName']]
    require(len(tables)==1 and tables[0]['source_sha256']==SOURCE['sha256'] and tables[0]['parquet_sha256']==SOURCE['tableParquetSha256'] and int(tables[0]['row_count'])==SOURCE['sourceRowCount'] and tables[0]['source_relative_path']==SOURCE['sourceRelativePath'],'Queryable table lineage changed')
    raw=fetch(HOST+'/api/files/'+SOURCE['originalFileId']+'/download')
    require(hashlib.sha256(raw).hexdigest()==SOURCE['sha256'],'Downloaded original source hash changed')
    path=input_path(input_dir);path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(raw)

def spreadsheet_cell(value):
    if isinstance(value,str) and value.lstrip().startswith(('=','+','-','@')):return "'"+value
    return value

def readme(release):
    s=release['snapshot']
    return f"""# Reviewed comparator trial facilities and condition portfolios

The original DATA-C037 exact-city CSV contains {s['sourceCityStudyRows']:,} unique city/NCT observations. All seven city totals and all 77 city/domain counts and historical RECRUITING counts reconcile to the existing comparator baseline.

The finite review accepts {s['reviewedPhysicalFacilities']} named physical facilities and {s['reviewedMatchedAliases']} exact city/alias bindings. It produces {s['observedFacilityDomainRows']} observed facility/domain rows and {s['safeStudySiteRelationships']:,} downloadable city/NCT/physical-site relationships. Absent combinations are not synthesized as zero records.

## Meaning and units

Distinct study counts deduplicate alias variants at one physical facility. A study at several facilities retains a relationship at each; sums across facilities or cities are not unique studies. Condition shares are percentage points using the fixed full-facility denominator. Filtering conditions never renormalizes shares. Repeated facility/city denominators remain numeric row metadata with text column types, excluding them from selectable measures.

Historical RECRUITING is overall study status in the aligned 29 April 2026 baseline. It does not establish local-site activation, current recruitment, appointments, enrollment, eligibility or clinical capacity. NHHR condition domains are analysis coding, not controlled diagnosis categories or measured disease burden.

## Coverage

City coverage retains all original coded studies. Studies with a reviewed facility and studies without a verified facility join form a two-part city partition. Partly located is a subset of the first group with at least one nonempty unreviewed recorded alias. Missing labels and source count/list disagreements remain separate.

The recorded matched-site count differs from the literal-delimiter deduplicated alias-list length in {s['sourceSiteCountMismatchStudies']:,} observations. Repeated source site rows may have the same alias. Disagreement does not prove additional physical facilities and does not increase partly located counts by itself.

The exact delimiter is semicolon followed by space. Bare semicolons, commas, fuzzy names, generic Research Site labels, umbrella institutions and broad regional descriptions are not reinterpreted as verified facilities. Unreviewed raw labels are not republished; city counts and reason categories are released.

## Geographic evidence

Point metadata retains official operator references, returned OSM evidence, coordinate precision and exceptions. Current building references do not establish the location of every historical study visit. Old Tom Baker Cancer Centre is separate from Arthur J.E. Child Comprehensive Cancer Centre. Generic Sudbury and Thunder Bay regional hospital aliases remain unresolved. The Sudbury cancer point uses an explicitly noted hospital-campus position.

PGMaps registry entries are candidate identity/address references, never a substitute for independent coordinate verification. No city-centroid substitution, invented coordinates or allocation to surrounding populations is used.

Coordinate data © OpenStreetMap contributors under ODbL. Official operator and ClinicalTrials.gov source terms and attribution apply; no endorsement is implied.

## Files and reproducibility

- trial-facility-conditions.json: two bounded aggregate datasets, byte-identical to the source import mirror.
- locations-comparator-trial-sites.geojson: 25 reviewed points with provenance notes.
- trial-facility-study-sites.csv: separate safe study/site evidence with registry URLs, excluded from JavaScript snapshots.
- trial-facility-conditions-provenance.json: original ID/hash/table lock, reconciliation and location review.
- scripts/prepare-nhhr-trial-facility-conditions.py: reproducible preparation, authorized refresh and checks.

Run with --input /path/to/source, optionally --refresh to follow the authorized manifest, dataset, catalogue and original file. Use --check to compare every released file byte for byte. Private headers may be supplied with --headers-file; they never enter releases. Source or location hash drift stops preparation for independent review.

Only public scientific fields enter the allowlist. No contact, participant, consent, candidate or remuneration records are released. Formula-like public CSV strings are escaped for spreadsheet safety.
"""

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--input',type=pathlib.Path,required=True);parser.add_argument('--check',action='store_true');parser.add_argument('--refresh',action='store_true');parser.add_argument('--headers-file',type=pathlib.Path)
    args=parser.parse_args()
    if args.refresh:refresh(args.input,json.loads(args.headers_file.read_text()) if args.headers_file else {})
    release,provenance,geo,safe=prepare(read_source(input_path(args.input)))
    buf=io.StringIO(newline='');writer=csv.DictWriter(buf,fieldnames=list(safe[0]),lineterminator='\n');writer.writeheader();writer.writerows([{k:spreadsheet_cell(v) for k,v in r.items()} for r in safe]);csvdata=buf.getvalue().encode()
    provenance['safeCSV']['sha256']=hashlib.sha256(csvdata).hexdigest()
    provenance['safeCSV']['formulaProtection']='Formula-like strings beginning with =,+,-,@ after whitespace are prefixed with a spreadsheet literal apostrophe.'
    for p in ['src/atlas/snapshots/trial-facility-conditions.json','public/data/nhhr/trial-facility-conditions.json']:emit_bytes(ROOT/p,json_bytes(release),args.check)
    emit_bytes(ROOT/'public/data/nhhr/trial-facility-conditions-provenance.json',json_bytes(provenance),args.check)
    emit_bytes(ROOT/'public/data/nhhr/locations-comparator-trial-sites.geojson',json_bytes(geo),args.check)
    emit_bytes(ROOT/'public/data/nhhr/trial-facility-study-sites.csv',csvdata,args.check)
    for p in ['public/data/nhhr/trial-facility-conditions.README.md','public/data/nhhr/locations-comparator-trial-sites.README.md']:emit_bytes(ROOT/p,readme(release).encode(),args.check)
    print(json.dumps(release['snapshot']))
if __name__=='__main__':main()
