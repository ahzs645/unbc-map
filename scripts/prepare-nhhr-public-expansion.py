#!/usr/bin/env python3
"""Release reviewed CRC aggregates and archived cancer measures from Zoer originals."""
import argparse
import csv
import hashlib
import io
import json
import math
from pathlib import Path
from urllib.request import urlopen
from zipfile import ZipFile
from nhhr_mapping_connections import connect_reviewed_geography

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://zoer.k8s.overtheedgepaper.ca'
MANIFEST = BASE + '/api/projects/acdd692f-a188-4f85-bb5a-83c48d5c7e82/database/data-spaces/de1fe530-a762-52fa-ba11-d01cc5b344df/manifest'
SOURCES = [
    {'collectionId': 'DATA-C049', 'datasetId': '91de0066-9343-4d0f-9138-03766520ddc0', 'filename': 'statcan_13100109_cancer_incidence.zip', 'originalFileId': '9eec692f-2634-4b31-a4f1-60a2556c5f8a', 'sha256': '8ec5c6af703916d69a354be3ba4aba728ddbd0d683cfb0b0db17a3f99b8f190b'},
    {'collectionId': 'DATA-C016', 'datasetId': 'b4d850b9-494b-4de6-96c3-2951defae583', 'filename': 'canada_research_chairs_chairholders.csv', 'originalFileId': '54e36843-af11-44cf-ad56-6e0e7f44cd45', 'sha256': '4a02d03d85ff9c4d1470b5824a58c063866b1f5e37418585b70d0c8c4a97d469'},
    {'collectionId': 'DATA-C016', 'datasetId': 'b4d850b9-494b-4de6-96c3-2951defae583', 'filename': 'canada_research_chairs_comparator_summary.csv', 'originalFileId': '2c0cbb91-6b5a-4d21-87fc-1d3e2573c1d2', 'sha256': '5b5b329e929678c0baf271f2470262893486a1996cf766b9c71914ab119b7d36'},
    {'collectionId': 'DATA-C016', 'datasetId': 'b4d850b9-494b-4de6-96c3-2951defae583', 'filename': 'statcan_bc_cancer_incidence_selected_health_regions.csv', 'originalFileId': '95f2fbb6-d6c1-4c98-b7bc-a79cfaf49554', 'sha256': 'de8b291d3e643a65f3bb24a35f4c4d11697c613a0abd2951df1d16aab3589f1e'},
]
REGIONS = {'British Columbia': 'British Columbia', 'Northwest Health Service Delivery Area, British Columbia': 'Northwest HSDA', 'Northern Interior Health Service Delivery Area, British Columbia': 'Northern Interior HSDA', 'Northeast Health Service Delivery Area, British Columbia': 'Northeast HSDA'}
COMPARATORS = {'Calgary': 'Calgary / Calgary', 'Dalhousie': 'Dalhousie / Halifax', 'Lakehead / Thunder Bay': 'Lakehead / Thunder Bay', 'McMaster / Hamilton': 'McMaster / Hamilton', 'NOSM / Thunder Bay': 'NOSM / Thunder Bay', 'UBC / Vancouver': 'UBC / Vancouver', 'UNBC / Prince George': 'UNBC / Prince George', 'USask / Saskatoon': 'USask / Saskatoon'}
METRICS = {'Number of new cancer cases': 'new_cases', 'Cancer incidence (rate per 100,000 population)': 'crude_rate', 'Cancer incidence (age-standardized rate per 100,000 population)': 'age_standardized_rate', 'Low 95% confidence interval, cancer incidence (rate per 100,000 population)': 'crude_ci_low', 'High 95% confidence interval, cancer incidence (rate per 100,000 population)': 'crude_ci_high', 'Low 95% confidence interval, cancer incidence (age-standardized rate per 100,000 population)': 'standardized_ci_low', 'High 95% confidence interval, cancer incidence (age-standardized rate per 100,000 population)': 'standardized_ci_high'}

def require(ok, message):
    if not ok: raise ValueError(message)

def get(url):
    with urlopen(url, timeout=60) as response: return response.read()

def read(path, source):
    data = (path / source['collectionId'] / source['filename']).read_bytes()
    require(hashlib.sha256(data).hexdigest() == source['sha256'], 'Original hash changed: ' + source['filename'])
    return data

def refresh(path):
    manifest = json.loads(get(MANIFEST))
    require(manifest['revision'] == 93, 'Review a changed manifest before refresh.')
    catalogue = next(x for x in manifest['manifestSources'] if x['role'] == 'manifest')
    for filename in ['NHHR_files.csv', 'NHHR_tables.csv']:
        link = next(x for x in catalogue['files'] if x['name'] == filename)
        (path / filename).write_bytes(get(BASE + link['url']))
    files = list(csv.DictReader((path / 'NHHR_files.csv').open(encoding='utf-8-sig')))
    for source in SOURCES:
        resource = next(x for x in manifest['resources'] if x.get('id') == source['datasetId'])
        require(resource['available'], 'Source dataset unavailable.')
        dataset = json.loads(get(BASE + resource['datasetUrl']))['dataset']
        require(dataset['status'] == 'ready', 'Source dataset not ready.')
        require(any(x['dataset_id'] == source['datasetId'] and x['sha256'] == source['sha256'] and source['originalFileId'] in x['original_file_ids'].split(';') for x in files), 'Source binding changed.')
        data = get(BASE + '/api/files/' + source['originalFileId'] + '/download')
        require(hashlib.sha256(data).hexdigest() == source['sha256'], 'Downloaded original hash mismatch.')
        target = path / source['collectionId'] / source['filename']; target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(data)

def value(raw):
    if not raw: return None
    number = float(raw); require(math.isfinite(number), 'Non-finite measurement.')
    return int(number) if number.is_integer() else number

def col(key, label, kind='text', unit=None):
    return {'key': key, 'label': label, 'type': kind, **({'unit': unit} if unit else {})}

def prepare(path):
    tables = list(csv.DictReader((path / 'NHHR_tables.csv').open(encoding='utf-8-sig')))
    proof_sources = []
    for source in SOURCES:
        matched = [x for x in tables if x['dataset_id'] == source['datasetId'] and x['source_sha256'] == source['sha256']]
        require(matched, 'Original table lineage absent.')
        proof_sources.append({**source, 'tables': [{'tableName': t['table_name'], 'rowCount': int(t['row_count']), 'archiveMember': t['archive_member'], 'parquetSha256': t['parquet_sha256']} for t in matched]})

    with ZipFile(io.BytesIO(read(path, SOURCES[0]))) as archive:
        metadata = archive.read('13100109_MetaData.csv').decode('utf-8-sig')
        require('December 2015' in metadata and '2011 Canadian Census population structure' in metadata and 'multiple of 5' in metadata, 'Cancer definition or geography changed.')
        groups = {}; raw_lookup = {}; total = 0
        for index, record in enumerate(csv.DictReader(io.TextIOWrapper(archive.open('13100109.csv'), encoding='utf-8-sig')), 2):
            total += 1
            if record['GEO'] not in REGIONS or record['Characteristics'] not in METRICS: continue
            key = (record['REF_DATE'], record['GEO'], record['Sex'], record['Selected sites of cancer (ICD-O-3)'])
            field = METRICS[record['Characteristics']]
            raw_lookup[(*key, record['Characteristics'])] = record
            out = groups.setdefault(key, {'period': key[0], 'health_region': REGIONS[key[1]], 'source_geography': key[1], 'source_dguid': record['DGUID'], 'sex': key[2], 'cancer_site': key[3]})
            require(field not in out, 'Duplicate cancer cell key.')
            require(record['SCALAR_FACTOR'] == 'units', 'Unknown cancer scalar.')
            out[field] = value(record['VALUE'])
            out[field + '_status'] = record['STATUS'] or record['SYMBOL'] or ''
            if field in {'new_cases', 'crude_rate', 'age_standardized_rate'}: out[field + '_source_row'] = str(index)
    require(total == 293722 and len(groups) == 572, 'Cancer source coverage changed.')
    derived = list(csv.DictReader(io.StringIO(read(path, SOURCES[3]).decode('utf-8-sig'))))
    checked = 0
    for row in derived:
        if row['geo'] not in REGIONS: continue
        raw = raw_lookup[(row['period'], row['geo'], row['sex'], row['cancer_site'], row['measure'])]
        require(value(row['value']) == value(raw['VALUE']) and row['STATUS'] == raw['STATUS'] and row['UOM'] == raw['UOM'], 'NHHR derivative differs from original cancer source.')
        checked += 1
    require(checked == 1144, 'Cancer derivative comparison coverage changed.')
    rows = sorted(groups.values(), key=lambda r: (r['period'], r['health_region'], r['sex'], r['cancer_site']))
    require(all(set(METRICS.values()).issubset(r) for r in rows), 'Incomplete cancer metric grid.')
    cancer = {'id': 'historical-cancer-incidence', 'title': 'Historical cancer incidence in Northern health regions', 'description': 'Original cancer case counts, crude rates and age-standardized rates for three Northern HSDAs and BC, with 95% confidence intervals and source symbols retained.', 'topic': 'Population health', 'geography': 'none', 'status': 'observed', 'timeLabel': '2001–2003 through 2013–2015 · archived 2015 geography', 'sourceName': 'Statistics Canada · Canadian Cancer Registry · Table 13-10-0109-01', 'sourceUrl': 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1310010901', 'datasetId': SOURCES[0]['datasetId'], 'tableName': ' ; '.join(t['tableName'] for t in proof_sources[0]['tables'] if t['archiveMember'] == '13100109.csv'), 'entityField': 'health_region', 'timeField': 'period', 'defaultMetric': 'age_standardized_rate', 'defaultFilters': {'sex': 'Both sexes', 'cancer_site': 'All invasive primary cancer sites (including in situ bladder)'}, 'columns': [col('health_region', 'Source health region'), col('period', 'Three-year window'), col('sex', 'Sex'), col('cancer_site', 'Cancer site'), col('new_cases', 'New cancer cases in source window', 'number', 'cases'), col('crude_rate', 'Crude incidence rate', 'number', 'per 100,000'), col('age_standardized_rate', 'Age-standardized incidence rate', 'number', 'per 100,000'), col('crude_ci_low', 'Crude rate · lower 95% CI'), col('crude_ci_high', 'Crude rate · upper 95% CI'), col('standardized_ci_low', 'Standardized rate · lower 95% CI'), col('standardized_ci_high', 'Standardized rate · upper 95% CI'), col('new_cases_status', 'Case count source symbol'), col('crude_rate_status', 'Crude rate source symbol'), col('age_standardized_rate_status', 'Standardized rate source symbol'), col('source_dguid', 'Original DGUID'), col('source_geography', 'Original geography label'), col('new_cases_source_row', 'Original count CSV row'), col('crude_rate_source_row', 'Original crude rate CSV row'), col('age_standardized_rate_source_row', 'Original standardized rate CSV row')], 'rows': rows, 'notes': [
        'Archived observations from the November 2017 registry file, released February 2018. The latest source window is 2013/2015; these are not current incidence or trial availability.',
        'The source uses December 2015 health-region boundaries. Maps are withheld until matching historical geometry is verified; current PGMaps health polygons are not substituted for this vintage.',
        'Three-year windows overlap. Do not add windows, combine sexes with Both sexes, or add all-sites totals to cancer-site components. Counts and rates retain the original published measurement.',
        'Age-standardized rates use the 2011 Canadian Census population structure. Crude rates reflect the observed age composition; comparisons do not establish causes or statistically significant differences.',
        'Counts use controlled rounding to multiples of five. Missing and suppressed cells remain null; original status/symbols are retained (p means provisional). Confidence intervals are table fields, not separate outcome measures.',
        'The full archived original CSV was parsed and all 1,144 selected count/crude cells reconcile to the NHHR processed table. The 572 released rows retain one region/window/sex/cancer-site key. Cases are assigned by residence at diagnosis, not treatment facility.',
    ]}
    raw_chairs = list(csv.DictReader(io.StringIO(read(path, SOURCES[1]).decode('utf-8-sig'))))
    summary = list(csv.DictReader(io.StringIO(read(path, SOURCES[2]).decode('utf-8-sig'))))
    require(len(raw_chairs) == 1926 and len(summary) == 8, 'Chair snapshot coverage changed.')
    chair_rows = []
    for record in summary:
        institutions = record['institution_names'].split('; ')
        selected = [r for r in raw_chairs if r['institution'] in institutions]
        counts = {'crc_count': len(selected), 'tier_1_count': sum(r['tier'] == '1' for r in selected), 'tier_2_count': sum(r['tier'] == '2' for r in selected), 'cihr_count': sum(r['agency'] == 'Canadian Institutes of Health Research' for r in selected), 'nserc_count': sum(r['agency'] == 'Natural Sciences and Engineering Research Council' for r in selected), 'sshrc_count': sum(r['agency'] == 'Social Sciences and Humanities Research Council' for r in selected)}
        require(all(counts[k] == int(record[k]) for k in counts), 'Original chair listing does not reconcile to summary.')
        require(counts['crc_count'] == counts['tier_1_count'] + counts['tier_2_count'] == counts['cihr_count'] + counts['nserc_count'] + counts['sshrc_count'], 'Chair totals do not reconcile.')
        chair_rows.append({'comparator': COMPARATORS[record['comparator']], 'institution_names': record['institution_names'], **counts})
    chairs = {'id': 'research-chairs', 'title': 'Canada Research Chairs in the collected institutional listing', 'description': 'Counts of listed chairholders by tier and funding agency at eight NHHR comparators, independently reconciled to the collected public listing.', 'topic': 'Research capacity', 'geography': 'institution', 'status': 'observed', 'timeLabel': 'Collected April 2026 · historical listing snapshot', 'sourceName': 'Canada Research Chairs · NHHR collected public listing', 'sourceUrl': 'https://www.chairs-chaires.gc.ca/chairholders-titulaires/index-eng.aspx', 'datasetId': SOURCES[1]['datasetId'], 'tableName': proof_sources[1]['tables'][0]['tableName'] + ' ; ' + proof_sources[2]['tables'][0]['tableName'], 'entityField': 'comparator', 'defaultMetric': 'crc_count', 'columns': [col('comparator', 'Institution comparator'), col('institution_names', 'Exact listing institution names'), col('crc_count', 'Listed chairholders', 'number', 'chairholders'), col('tier_1_count', 'Tier 1 listed chairholders', 'number', 'chairholders'), col('tier_2_count', 'Tier 2 listed chairholders', 'number', 'chairholders'), col('cihr_count', 'CIHR listed chairholders', 'number', 'chairholders'), col('nserc_count', 'NSERC listed chairholders', 'number', 'chairholders'), col('sshrc_count', 'SSHRC listed chairholders', 'number', 'chairholders')], 'rows': chair_rows, 'notes': [
        'This is the NHHR collected April 2026 public listing, not a live census of current chairholders, filled allocations, vacancies, eligible researchers or available NHHR staff.',
        'Counts reconcile independently to the 1,926-row original listing through exact source institution names. Only aggregated counts are released; names and individual researcher profiles are not loaded.',
        'Each tier pair and funding-agency trio reconcile to the institutional listed total. Funding agencies and tiers describe different classifications of the same listed records and must not be added together.',
        'Seven comparators use existing reviewed representative campus points. McMaster remains in charts and tables pending a reviewed location. Institution-wide counts are not allocated to one campus or surrounding residents.',
        'The published NOSM comparator has zero matching records in this collected listing. That is a listing result, not proof of no research chairs, research activity or capacity. The NHHR health-discipline keyword count is excluded because its classification rule is not documented here.',
    ]}
    proof = {'reviewedAt': '2026-10-12', 'manifestRevision': 93, 'sources': proof_sources, 'checks': {'cancerOriginalRowsParsed': total, 'cancerReleasedKeys': len(rows), 'derivedCancerCellsReconciled': checked, 'chairOriginalListingRows': len(raw_chairs), 'chairComparatorRows': len(chair_rows), 'chairTiersAndAgenciesReconcile': True}, 'boundaryRecommendation': {'dataset': cancer['id'], 'recommended': 'December 2015 Statistics Canada health-region boundaries matched through the original 2015 DGUIDs', 'availablePgMaps': 'Current health-area geometry; incompatible vintage not silently substituted', 'chartAvailable': True}}
    for dataset in [cancer, chairs]: connect_reviewed_geography(dataset)
    proof['mappingConnections'] = 'mapping-connections-provenance.json'
    proof['boundaryRecommendation'] = {'dataset': cancer['id'], 'connected': 'Official December 2015 Statistics Canada health-region release; exact original DGUID/HR_UID pairs.', 'mappedRegions': 3, 'provinceAggregateMapped': False, 'chartAvailable': True}
    return {'datasets': [cancer, chairs], 'snapshot': proof['checks']}, proof

def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--input', type=Path, default=Path('/tmp/nhhr-public-expansion')); parser.add_argument('--refresh', action='store_true'); parser.add_argument('--check', action='store_true'); args = parser.parse_args(); args.input.mkdir(parents=True, exist_ok=True)
    if args.refresh: refresh(args.input)
    release, proof = prepare(args.input)
    for filename, data, locations in [('public-expansion.json', release, [ROOT / 'src/atlas/snapshots', ROOT / 'public/data/nhhr']), ('public-expansion-provenance.json', proof, [ROOT / 'public/data/nhhr'])]:
        content = json.dumps(data, indent=2, ensure_ascii=False, allow_nan=False) + '\n'
        for location in locations:
            target = location / filename
            if args.check: require(target.exists() and target.read_text() == content, 'Released output differs: ' + filename)
            else: target.write_text(content)
    print(json.dumps(proof['checks']))

if __name__ == '__main__': main()
