#!/usr/bin/env python3
"""Create the bounded NHHR Atlas release from manifest-linked, hash-locked originals.

Offline: python3 scripts/prepare-nhhr-data.py --input /tmp/nhhr-review/csv
Refresh: python3 scripts/prepare-nhhr-data.py --refresh --input /tmp/nhhr-atlas-refresh
Optional authorized request headers: --headers-file /private/path/headers.json
Credentials and original downloads are never copied into the public release.
New source hashes require a deliberate review and update of nhhr-source-lock.json.
"""
from __future__ import annotations
import argparse, csv, hashlib, json, math, pathlib, urllib.request
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parents[1]
MANIFEST = 'https://zoer.k8s.overtheedgepaper.ca/api/projects/acdd692f-a188-4f85-bb5a-83c48d5c7e82/database/data-spaces/de1fe530-a762-52fa-ba11-d01cc5b344df/manifest'
HOST = 'https://zoer.k8s.overtheedgepaper.ca'
LOCK = json.loads((ROOT / 'scripts/nhhr-source-lock.json').read_text())
SNAPSHOT_DATE = '2026-10-11'


def number(value):
    if value is None or value.strip() == '':
        return None
    v = float(value)
    if not math.isfinite(v):
        raise ValueError('Non-finite source value')
    return int(v) if v.is_integer() else v


def column(key, label, numeric=False, unit=None):
    c = {'key': key, 'label': label, 'type': 'number' if numeric else 'text'}
    if unit:
        c['unit'] = unit
    return c


def build(input_dir):
    source_rows = {}
    for key, source in LOCK['sources'].items():
        p = input_dir / source['collectionId'] / source['filename']
        raw = p.read_bytes()
        if hashlib.sha256(raw).hexdigest() != source['sha256']:
            raise ValueError(f'{key}: original SHA256 differs from reviewed catalogue; review before release')
        with p.open(encoding='utf-8-sig', newline='') as handle:
            source_rows[key] = list(csv.DictReader(handle))
    datasets = []

    def add(id, key, title, description, topic, geography, status, time, publisher, url,
            columns, metric, entity, notes, rows=None, time_field=None, boundary=None):
        source = LOCK['sources'][key]
        rows = source_rows[key] if rows is None else rows
        converted = []
        for row in rows:
            item = {}
            for c in columns:
                if c['key'] not in row:
                    raise ValueError(f"{id}: missing required source field {c['key']}")
                v = row.get(c['key'])
                item[c['key']] = number(str(v)) if c['type'] == 'number' and v is not None else (v or None)
            converted.append(item)
        if any(item[entity] is None for item in converted):
            raise ValueError(f'{id}: missing entity identifier')
        if not any(item[metric] is not None for item in converted):
            raise ValueError(f'{id}: metric contains no values')
        if not converted or len(converted) > 1000:
            raise ValueError(f'{id}: release is empty or exceeds bounded 1000-row limit')
        d = dict(id=id, title=title, description=description, topic=topic, geography=geography,
                 status=status, timeLabel=time, sourceName=publisher, sourceUrl=url,
                 datasetId=source['datasetId'], tableName=source['tableName'],
                 notes=notes, columns=columns, rows=converted, defaultMetric=metric, entityField=entity)
        if time_field:
            d['timeField'] = time_field
        if boundary:
            d['boundaryKeyField'] = boundary
        datasets.append(d)

    add('publications', 'publications', 'Research publications by institution',
        'Annual OpenAlex work counts for eight selected institutional comparators.',
        'Research capacity', 'institution', 'observed', '2021–2025 · collected April 2026', 'OpenAlex · NHHR derived summary', 'https://openalex.org/',
        [column('comparator','Institution / city'),column('publication_year','Publication year'),column('works','Works',True,'works'),column('display_name','OpenAlex institution'),column('openalex_id','OpenAlex ID')],
        'works','comparator',[
        'Institution-affiliated works cover all research fields, not health research alone. They are not NHHR-attributable outputs.',
        'Institution counts overlap when a work has multiple affiliations; do not sum them into a regional total.',
        'Coverage reflects the collected OpenAlex snapshot; 2025 may have indexing lag. Absolute workstation source paths are excluded.'],time_field='publication_year')
    add('cihr-payments', 'cihr', 'CIHR annual payments',
        'Fiscal-year payments recorded for selected institutions, with incomplete 2025 payment coverage removed.',
        'Research capacity','institution','observed','FY 2019–2024 · collected April 2026','CIHR · NHHR derived summary','https://cihr-irsc.gc.ca/',
        [column('comparator','Institution / city'),column('fiscal_year','Fiscal year'),column('amount_paid_fy','Amount paid in fiscal year',True,'CAD'),column('projects','Distinct projects',True,'projects'),column('rows','Source award rows',True,'rows')],
        'amount_paid_fy','comparator',[
        'Fiscal-year payments are not lifetime award commitments. This release omits total_awarded to prevent adding commitments repeatedly across fiscal years.',
        'FY 2025 has project records but amount_paid_fy is zero for every comparator in the source. Payment coverage is incomplete; these rows are excluded, not interpreted as zero funding.',
        'Comparator totals reflect NHHR institution matching and collected coverage; no per-capita or NHHR-attributable value is inferred.'],rows=[r for r in source_rows['cihr'] if 2019 <= int(r['fiscal_year']) <= 2024],time_field='fiscal_year')
    add('nserc-awards','nserc','NSERC awards by institution',
        'Award amounts and award counts for selected institutional comparators by fiscal year.',
        'Research capacity','institution','observed','FY 2019–2024 · collected April 2026','NSERC · NHHR derived summary','https://www.nserc-crsng.gc.ca/',
        [column('comparator','Institution / city'),column('fiscal_year','Fiscal year'),column('total_award_amount','Award amount',True,'CAD'),column('awards','Distinct awards',True,'awards'),column('rows','Source award rows',True,'rows'),column('median_award_amount','Median award amount',True,'CAD')],
        'total_award_amount','comparator',[
        'NSERC supports natural sciences and engineering; these figures are a broad research-capacity comparator, not health funding alone.',
        'Award amounts are the source measure and are not directly interchangeable with CIHR annual payments.',
        'Distinct awards and source rows differ for some institutions; preserve this distinction when comparing counts.'],time_field='fiscal_year')
    add('clinical-city','clinical_city','Clinical trials with an exact-city site',
        'ClinicalTrials.gov site matches in seven comparator cities, retained as city counts.',
        'Clinical research','city','observed','Registry snapshot · April 2026','ClinicalTrials.gov · NHHR coded summary','https://clinicaltrials.gov/',
        [column('query_city','City'),column('exact_city_site_studies','Studies with an exact-city site',True,'studies'),column('recruiting_now','Recruiting in source snapshot',True,'studies'),column('recruiting_or_active','Recruiting or active',True,'studies'),column('oncology_studies','Oncology studies',True,'studies'),column('radiotherapy_studies','Radiotherapy studies',True,'studies'),column('industry_sponsored_studies','Industry-sponsored studies',True,'studies'),column('top_condition_domain','Largest coded condition domain')],
        'exact_city_site_studies','query_city',[
        'Exact city-string matches identify registered study sites, not local enrollments, accessible trials, or a health-authority catchment.',
        'Counts include historical statuses. Recruiting fields describe the collected snapshot and are not live recruitment advice.',
        'A multi-site study can appear in more than one city. City boundaries and HSDA/LHA boundaries are different geographies; no polygon join or rate is inferred.'])
    pg = source_rows['clinical_pg']
    for r in pg:
        r['study_count'] = '1'
        r['registry_url'] = 'https://clinicaltrials.gov/study/' + r['nct_id']
    add('clinical-pg','clinical_pg','Prince George registered study portfolio',
        'Ten exact-site registry studies with coded condition and intervention domains.',
        'Clinical research','city','observed','Registry snapshot · April 2026','ClinicalTrials.gov · NHHR coded study table','https://clinicaltrials.gov/',
        [column('nct_id','Registry ID'),column('brief_title','Study title'),column('overall_status','Status in source snapshot'),column('condition_domain','Condition domain'),column('intervention_domain','Intervention domain'),column('sponsor_category','Sponsor category'),column('facilities','Recorded facility'),column('start_date','Study start date'),column('completion_date','Recorded completion date'),column('location_count','Registered locations',True,'locations'),column('study_count','Study records',True,'studies'),column('registry_url','Public registry link')],
        'study_count','nct_id',[
        'Public registry identifiers and facilities are retained; personal contact names, emails, phones, and interview targets are excluded.',
        'A study listing does not establish local enrollment, screening capacity, participant eligibility, or current recruitment. Follow the registry link for current details.',
        'NHHR domain coding is an analytical interpretation. Registry completion dates may be planned dates.'],rows=pg)
    add('physicians-hsda','physicians','Physician supply across BC health regions',
        'Public physician counts and rates for sixteen BC health service delivery areas.',
        'Workforce','hsda','observed','2020 and 2024 · collected April 2026','CIHI public physician statistics · NHHR regional summary','https://www.cihi.ca/en/physicians',
        [column('health_region','Health service delivery area'),column('health_region_code','Source health-region code'),column('health_authority_proxy','Health authority'),column('family_physicians_2020','Family physicians · 2020',True,'physicians'),column('family_physicians_2024','Family physicians · 2024',True,'physicians'),column('family_physicians_per_100k_2024','Family physicians per 100,000 · 2024',True,'per 100,000'),column('specialists_2020','Specialists · 2020',True,'physicians'),column('specialists_2024','Specialists · 2024',True,'physicians'),column('specialists_per_100k_2024','Specialists per 100,000 · 2024',True,'per 100,000'),column('total_physicians_2024','Total physicians · 2024',True,'physicians'),column('total_physicians_per_100k_2024','Total physicians per 100,000 · 2024',True,'per 100,000')],
        'specialists_per_100k_2024','health_region',[
        'Counts are the collected public regional physician measure, not vacancies, full-time equivalents, local appointment access, or NHHR research staff.',
        'Rates are preserved from the reviewed source; no rates are recomputed using the suspect population summaries.',
        'Source 59xx health-region codes join to the corresponding two-digit BC HSDA codes using an explicit crosswalk. Boundaries show regions, not physician locations.'],boundary='health_region_code')
    # Raw BC Stats Gender=T is already the total. F + M + T duplicates the population.
    lhas = [r for r in source_rows['lha_raw'] if r['Gender']=='T' and r['Region'].startswith('5') and 2020 <= int(r['Year']) <= 2025]
    lha_rows = [dict(region_name=r['Region.Name'],lha_code=r['Region'],year=r['Year'],population=r['Total'],population_type=r['Type'],working_age_population=str(sum(int(r[str(age)]) for age in range(15,65)))) for r in lhas]
    if len({(r['lha_code'],r['year']) for r in lha_rows}) != len(lha_rows):
        raise ValueError('Duplicate LHA/year totals')
    add('population-lha','lha_raw','Northern local health area populations',
        'BC Stats total population rows for seventeen Northern local health areas, with projections labelled.',
        'Population','lha','observed','2020–2025 · collected April 2026','BC Stats · verified source totals','https://www2.gov.bc.ca/gov/content/data/statistics/people-population-community/population/population-estimates',
        [column('region_name','Local health area'),column('lha_code','LHA code'),column('year','Year'),column('population','Population',True,'people'),column('working_age_population','Population aged 15–64',True,'people'),column('population_type','Source estimate / projection')],
        'population','region_name',[
        'Use exactly one Gender=T row per area/year. Source Type is retained: 2025 values are projections, not an observed census count.',
        'The earlier DATA-C031 summary sums F + M + T and is twice the total. This release derives totals directly from hash-verified DATA-C051 raw rows.',
        'LHA population is a regional denominator, not a city population or a count of patients served. Boundary codes refer to the source LHA geography.'],rows=lha_rows,time_field='year',boundary='lha_code')
    groups = defaultdict(list)
    for r in source_rows['schedule']:
        groups[(r['route_slug'],r['direction'])].append(r)
    routes=[]
    for (slug, direction), events in sorted(groups.items()):
        ordered = sorted(events,key=lambda r: int(r['seq']))
        routes.append(dict(route=slug.replace('-',' ').title(),route_slug=slug,service_day=direction,recorded_stop_events=str(len(events)),first_stop=ordered[0]['stop_event'],first_time=ordered[0]['stop_time'],last_stop=ordered[-1]['stop_event'],last_time=ordered[-1]['stop_time'],source_url=ordered[0]['source_url']))
    add('travel-schedule','schedule','Northern Health Connections route patterns',
        'Recorded route and service-day patterns from the collected public transport schedules.',
        'Access and travel','none','observed','Schedule capture · 16 June 2026','Northern Health Connections','https://nhconnections.ca/schedules-and-fares/',
        [column('route','Route'),column('service_day','Recorded service day / direction'),column('recorded_stop_events','Recorded stop events',True,'stop events'),column('first_stop','First recorded stop'),column('first_time','First recorded time'),column('last_stop','Last recorded stop'),column('last_time','Last recorded time'),column('source_url','Route source link')],
        'recorded_stop_events','route',[
        'One row is a route and recorded service-day pattern; stop-event counts are not departures per week, passenger volumes, distances, or journey durations.',
        'Schedule times are preserved as collected text. Arrivals, departures, breaks, and overnight events may be separate records.',
        'The June 2026 capture is historical. Use the route source link for current schedules, eligibility, fares, and booking.'],rows=routes)
    add('travel-benchmarks','benchmarks','Travel cost assumptions and benchmarks',
        'Five collected mileage, fare, and economic-cost benchmarks with distinct units and evidence limits.',
        'Access and travel','none','review','2025 rates / 2026 fare · captured June 2026','CRA / NH Connections · NHHR collected benchmarks','https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/benefits-allowances/automobile/automobile-motor-vehicle-allowances/automobile-allowance-rates.html',
        [column('metric','Benchmark'),column('value','Source value',True,'varies — see unit'),column('unit','Source unit'),column('period','Applicable period'),column('source','Publisher / derivation'),column('source_url','Source link'),column('note','Evidence note')],
        'value','metric',[
        'Values have different units; never add or rank them as a common cost. Select one benchmark and read its unit and evidence note.',
        'The $20 fare record is described as news-sourced in the collected table and lacks its original news citation. It requires verification before use.',
        'Economic driving cost is a derived mileage scenario, not an observed patient expense. CRA allowances are tax benchmarks, not measured medical-travel costs.'])
    add('travel-scenarios','scenarios','Hypothetical avoided-travel scenarios',
        'Three planning cases showing the effect of assumed reach, avoided trips, trip cost, and patient time.',
        'Access and travel','none','scenario','Planning assumptions · April 2026','NHHR scenario calculations',MANIFEST,
        [column('scenario','Scenario'),column('patients_reached','Assumed patients reached',True,'patients'),column('avoided_trips','Assumed avoided trips',True,'trips'),column('cost_per_trip','Assumed cost per trip',True,'CAD'),column('avoided_travel_value','Modelled travel value',True,'CAD'),column('hours_saved_per_patient','Assumed hours per patient',True,'hours'),column('value_per_hour','Assumed value per hour',True,'CAD/hour'),column('patient_time_value','Modelled patient time value',True,'CAD')],
        'avoided_travel_value','scenario',[
        'These are hypothetical inputs and calculations, not measured NHHR benefits, forecasts, avoided trips, or causal effects.',
        'Travel value = avoided trips × cost per trip. Patient time value = patients reached × hours saved per patient × value per hour.',
        'The original scenario table carries the doubled Northern population denominator (596414). That field is omitted; no population-based uptake or rate is shown.'])
    gaps=[]
    for r in source_rows['gaps']:
        gaps.append(dict(request_id=r['request_id'],owner=r['owner'],priority=r['priority'],use=r['use'],caveat=r['caveat'],request_count='1',evidence_status='Requested; not supplied in reviewed snapshot'))
    add('evidence-gaps','gaps','Validation questions still open',
        'Thirteen institution-level requests that describe evidence still needed for feasibility decisions.',
        'Evidence and governance','none','review','Validation tracker · April 2026','NHHR validation-phase evidence tracker',MANIFEST,
        [column('request_id','Request ID'),column('owner','Institution / function'),column('priority','Priority'),column('use','Decision supported'),column('caveat','Interpretation limit'),column('evidence_status','Evidence status'),column('request_count','Evidence requests',True,'requests')],
        'request_count','request_id',[
        'This is a request tracker, not supplied enrollment, staffing, financial, governance, or interview evidence. One row represents one evidence request.',
        'No completed interview findings are included in this snapshot. Interview guides, recruitment materials, or blank coding workbooks must not be presented as interview results.',
        'Personal contacts, interview candidates, consent records, participant-level data, and internal remuneration are excluded. Community governance acceptability cannot be inferred from public sources.'],rows=gaps)
    ha = {r['Region.Name']:r for r in source_rows['ha_raw'] if r['Year']=='2025' and r['Gender']=='T' and r['Region']!='0'}
    audit=[]
    for r in source_rows['population_summary']:
        correct = int(ha[r['Region.Name']]['Total'])
        original = int(r['total_population'])
        if original != 2 * correct:
            raise ValueError('Population duplication finding changed; re-review')
        audit.append(dict(region_name=r['Region.Name'],year='2025',original_population=str(original),verified_total_population=str(correct),duplication_factor='2',finding='Original sums F + M + T; use Gender=T once',population_type=ha[r['Region.Name']]['Type']))
    add('population-review','population_summary','Population denominator audit',
        'A recorded quality issue: five collected health-authority summaries duplicate sex totals.',
        'Evidence and governance','none','review','2025 source projections','BC Stats / NHHR denominator review','https://www2.gov.bc.ca/gov/content/data/statistics/people-population-community/population',
        [column('region_name','Health authority'),column('year','Year'),column('original_population','Original summary · duplicated',True,'people'),column('verified_total_population','Verified Gender=T total',True,'people'),column('duplication_factor','Duplication factor',True,'times'),column('finding','Review finding'),column('population_type','Source estimate / projection')],
        'verified_total_population','region_name',[
        'Original DATA-C024 totals sum Female + Male + Total, exactly doubling the population. Verified values use the matching 2025 Gender=T row from DATA-C051.',
        'Northern changes from 596,414 to 298,207. DATA-C031 has the same issue: Prince George LHA changes from 211,088 to 105,544.',
        'Original numbers remain visible for audit only and are not mapped or used to calculate rates. Verified totals are source projections, not measured NHHR reach.'],rows=audit)

    by_id={d['id']:d for d in datasets}
    def selected(id, field, value):
        return [r for r in by_id[id]['rows'] if str(r[field])==str(value)]
    pg_city=selected('clinical-city','query_city','Prince George')[0]
    northern=[r for r in by_id['physicians-hsda']['rows'] if str(r['health_region_code']).startswith('595')]
    unbc=next(r for r in selected('publications','publication_year','2025') if r['openalex_id']=='I151934421')
    stories=[
        dict(id='northern-workforce',title='Where specialist supply is thinnest',kicker='Workforce · regional evidence',summary='Compare Northern health regions with the rest of BC, using the source’s 2024 physician rates.',body=[
            'The Northern profile spans Northwest, Northern Interior, and Northeast health service delivery areas. The map joins public regional counts and rates to their corresponding HSDA boundaries.',
            'In the collected 2024 source, Northern specialist rates range from '+f"{min(r['specialists_per_100k_2024'] for r in northern):.1f} to {max(r['specialists_per_100k_2024'] for r in northern):.1f}"+' per 100,000 people. Explore each region rather than treating Northern BC as one uniform workforce.',
            'Physician supply helps frame feasibility questions. It does not measure vacancies, appointment waits, research coordinator capacity, or the impact of NHHR. Those require validation evidence.'],datasetId='physicians-hsda',metric='specialists_per_100k_2024',featured=True),
        dict(id='clinical-access',title='A small registered portfolio, a concrete starting point',kicker='Clinical research · exact-city sites',summary=f"The collected registry snapshot contains {pg_city['exact_city_site_studies']} studies with a Prince George site. What could expand local trial access?",body=[
            f"Prince George has {pg_city['exact_city_site_studies']} exact-city study matches in the collected summary, including {pg_city['oncology_studies']} coded oncology studies. Open the study portfolio to inspect titles, facilities, domains, and public registry links.",
            'City-site counts establish a recorded footprint. They do not show local enrollment, protocol eligibility, screening failures, operating capacity, or whether a listed trial is available now.',
            'Use the evidence tracker to identify the next questions for institutions: enrollment and referral pathways, staffing, governance requirements, and community priorities. Interview findings are not included in this public snapshot.'],datasetId='clinical-city',metric='exact_city_site_studies',featured=True),
        dict(id='research-scale',title='Research capacity in context',kicker='Research capacity · institutions',summary='Read publications, CIHR payments, and NSERC awards as complementary evidence of institutional scale.',body=[
            f"The collected OpenAlex table records {unbc['works']} UNBC-affiliated works in 2025. Compare the five-year series with selected institutions, keeping institutional scope and overlapping affiliations in view.",
            'CIHR payments describe recorded fiscal-year cash flow, while NSERC amounts describe the source award measure. Different measures and broad institutional mandates make a single combined league table misleading.',
            'CIHR 2025 project records all carry zero payments in this collected summary. The explorer excludes that year from the paid series because payment coverage is incomplete. Public funding and publications do not establish NHHR-attributable returns.'],datasetId='publications',metric='works',featured=True),
        dict(id='regional-denominators',title='Count people once before calculating a rate',kicker='Population · data quality',summary='A verified source-row check corrects a doubled Northern population denominator and enables LHA mapping.',body=[
            'The collected health-authority summary reports Northern at 596,414 in 2025. Tracing it to the original BC Stats rows shows Female + Male + Total were added together. The Gender=T source total is 298,207.',
            'The same duplication appears in the selected LHA summary. Prince George LHA is 105,544 in the raw total row, compared with 211,088 in the earlier summary. The atlas uses one total row per LHA and year.',
            'Explore the Northern LHA map with the source estimate/projection type visible. These are health-area populations, not municipal populations or NHHR participants, and 2025 is a projection.'],datasetId='population-lha',metric='population'),
        dict(id='travel-assumptions',title='What would reducing travel be worth?',kicker='Access and travel · hypothetical cases',summary='Explore three planning cases and the assumptions that drive modelled travel and patient time values.',body=[
            'The base case assumes 300 patients reached, 450 avoided trips, and $900 per trip, producing $405,000 in modelled travel value. Its patient-time calculation assumes six hours per person at $35 per hour, producing $63,000.',
            'These calculations illustrate how assumptions affect potential value. They are not observed benefits, forecasts, or evidence that NHHR has avoided any trips. The doubled population field in the original scenario source is omitted.',
            'Read the collected route patterns and benchmark evidence notes alongside the scenarios. Historical schedules, subsidized fares, economic mileage costs, and patient out-of-pocket expenses represent different questions.'],datasetId='travel-scenarios',metric='avoided_travel_value'),
        dict(id='validation-path',title='From public evidence to a validated operating model',kicker='Evidence and governance · next questions',summary='The evidence tracker makes missing information visible instead of filling gaps with assumed results.',body=[
            'Thirteen institution-level requests describe the information still needed to test feasibility: trial enrollment, staffing, space, funding pathways, travel burden, and governance expectations.',
            'Public registry, publication, funding, and workforce datasets can help choose questions. They cannot establish community permission, operational readiness, causal effects, or partner commitments.',
            'No completed interview findings appear in this released snapshot. Recruitment scripts, consent templates, or blank analysis workbooks are preparation materials and should not be treated as findings.'],datasetId='evidence-gaps',metric='request_count')]
    snapshot=dict(reviewedAt=SNAPSHOT_DATE,manifestUrl=MANIFEST,dataSpaceId='de1fe530-a762-52fa-ba11-d01cc5b344df',datasetCount=len(datasets),rowCount=sum(len(d['rows']) for d in datasets),releaseScope='Bounded public-secondary aggregates and public registry records; explicit planning scenarios and review findings.',limitations=['Collected source snapshots are historical, not live data.','Interview, consent, contact, remuneration, and participant records are excluded.','Source privacy classification is not blanket release permission; only explicitly allowlisted columns are included.'],sourceLock='nhhr-source-lock.json')
    return dict(datasets=datasets,stories=stories,snapshot=snapshot)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',type=pathlib.Path,required=True)
    parser.add_argument('--refresh',action='store_true')
    parser.add_argument('--manifest',type=pathlib.Path,help='Saved authorized manifest for metadata inventory')
    parser.add_argument('--catalogue',type=pathlib.Path,help='Optional NHHR_collections.csv for source classification metadata')
    parser.add_argument('--headers-file',type=pathlib.Path)
    parser.add_argument('--check',action='store_true',help='Validate source hashes and require byte-identical generated output')
    args=parser.parse_args()
    manifest=json.loads(args.manifest.read_text()) if args.manifest else None
    if args.refresh:
        headers=json.loads(args.headers_file.read_text()) if args.headers_file else {}
        def fetch(url):
            request=urllib.request.Request(url,headers=headers)
            with urllib.request.urlopen(request,timeout=45) as response:
                return response.read()
        manifest=json.loads(fetch(MANIFEST))
        manifest_text=json.dumps(manifest)
        for source in LOCK['sources'].values():
            if source['datasetId'] not in manifest_text:
                raise ValueError('Reviewed source dataset no longer listed by the authorized data-space manifest')
            data=fetch(HOST+'/api/files/'+source['originalFileId']+'/download')
            if hashlib.sha256(data).hexdigest()!=source['sha256']:
                raise ValueError('Downloaded original differs from reviewed catalogue; release stopped')
            dest=args.input/source['collectionId']/source['filename']
            dest.parent.mkdir(parents=True,exist_ok=True)
            dest.write_bytes(data)
    release=build(args.input)
    # Explicit columns also ensure private workstation paths and incidental contact fields cannot pass through.
    output=json.dumps(release,ensure_ascii=False,indent=2,allow_nan=False)+'\n'
    if '/Users/' in output or 'mailto:' in output:
        raise ValueError('Private path or contact leakage detected')
    dest=ROOT/'public/data/nhhr/atlas-snapshot.json'
    if args.check:
        if dest.read_text()!=output:
            raise ValueError('Committed release differs from current reviewed inputs')
    else:
        dest.parent.mkdir(parents=True,exist_ok=True)
        dest.write_text(output)
    provenance={**LOCK,'manifestUrl':MANIFEST,'method':'Download manifest-listed dataset originals through catalogue originalFileId; verify original SHA256 before explicit-column release. Imported ZIP/parquet bundle identifiers are not original-file identifiers.'}
    provenance_output=json.dumps(provenance,ensure_ascii=False,indent=2,allow_nan=False)+'\n'
    provenance_dest=ROOT/'public/data/nhhr/source-provenance.json'
    if args.check:
        if provenance_dest.read_text()!=provenance_output:
            raise ValueError('Committed provenance differs from reviewed source lock')
    else:
        provenance_dest.write_text(provenance_output)
    if manifest is not None:
        classifications={}
        existing_inventory=ROOT/'public/data/nhhr/source-inventory.json'
        if existing_inventory.exists():
            for entry in json.loads(existing_inventory.read_text()).get('collections',[]):
                classifications[entry['collectionId']]={'source_publisher':entry['sourceName'],'source_url':entry['sourceUrl'],'sharing_classification':entry['sharingClassification']}
        if args.catalogue:
            with args.catalogue.open(encoding='utf-8-sig',newline='') as handle:
                classifications={r['collection_id']:r for r in csv.DictReader(handle)}
        resources=[r for r in manifest.get('resources',[]) if r.get('kind')=='dataset']
        loaded={d['datasetId'] for d in release['datasets']}
        entries=[]
        import re
        for resource in resources:
            match=re.search(r'DATA-[A-Z]\d+',resource.get('name',''))
            if not match:
                continue
            collection=match.group(0)
            if collection=='DATA-P01':
                continue  # No participant/consent collection details in the public catalogue.
            restricted=collection=='DATA-C037'
            classification=classifications.get(collection,{})
            entries.append(dict(collectionId=collection,datasetId=resource['id'],name='Restricted strategic collection' if restricted else resource.get('name','').replace('NHHR '+collection+' ',''),status='restricted' if restricted else resource.get('status','unknown'),available=bool(resource.get('available')),catalogueRows=None if restricted else resource.get('rows',0),tableCount=None if restricted else len(resource.get('tables',[])),sourceName='' if restricted else classification.get('source_publisher',''),sourceUrl='' if restricted else classification.get('source_url',''),sharingClassification='Restricted; only separately reviewed aggregate extracts are released' if restricted else classification.get('sharing_classification','Catalogue metadata; source release requires review'),loadedInAtlas=resource['id'] in loaded,datasetUrl=None if restricted else HOST+'/api/datasets/'+resource['id']))
        inventory=dict(manifestRevision=manifest.get('revision'),manifestUpdatedAt=manifest.get('updatedAt'),manifestUrl=MANIFEST,inventoryDatasetCount=len(resources),inventoryTableCount=sum(len(r.get('tables',[])) for r in resources),inventoryRowCount=sum(int(r.get('rows',0)) for r in resources),countsNote='Inventory includes overlapping raw and derived tables and cached workbook grids. Counts are not unique observations or released explorer rows. Restricted participant/consent details are omitted.',collections=entries)
        inventory_output=json.dumps(inventory,ensure_ascii=False,indent=2,allow_nan=False)+'\n'
        inventory_dest=ROOT/'public/data/nhhr/source-inventory.json'
        if args.check:
            if inventory_dest.read_text()!=inventory_output:
                raise ValueError('Committed metadata inventory differs from authorized manifest')
        else:
            inventory_dest.write_text(inventory_output)
    # Vite's dev server serves public/ assets directly and cannot import them as modules.
    # Keep module imports under src/ and retain byte-identical public evidence downloads.
    for filename in ('atlas-snapshot.json', 'source-inventory.json'):
        public_path=ROOT/'public/data/nhhr'/filename
        source_path=ROOT/'src/atlas/snapshots'/filename
        if not public_path.exists():
            raise ValueError(f'{filename}: generate the public snapshot first using --manifest')
        public_bytes=public_path.read_bytes()
        if args.check:
            if not source_path.exists() or source_path.read_bytes()!=public_bytes:
                raise ValueError(f'{filename}: imported source mirror differs from public evidence snapshot')
        else:
            source_path.parent.mkdir(parents=True,exist_ok=True)
            source_path.write_bytes(public_bytes)
    print(f"Validated {len(release['datasets'])} datasets / {release['snapshot']['rowCount']} released rows / {len(release['stories'])} stories")

if __name__=='__main__':
    main()
