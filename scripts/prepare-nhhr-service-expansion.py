#!/usr/bin/env python3
"""Prepare bounded public NHHR service/workforce views from reviewed source files.

Use --input DIR with the original DATA-C044/C053/C059 subdirectories. --refresh
follows the authorized manifest, dataset APIs and original-file/table catalogue;
--check verifies byte-identical generated outputs without editing them. Changed
source identities/hashes stop preparation and require a new scientific review.
No people, contact, interview, remuneration or participant records are released.
"""
from __future__ import annotations
import argparse,csv,hashlib,io,json,math,posixpath,re,zipfile
import xml.etree.ElementTree as ET
from decimal import Decimal
from pathlib import Path
from urllib.request import Request,urlopen

ROOT=Path(__file__).resolve().parents[1]
BASE='https://zoer.k8s.overtheedgepaper.ca'
MANIFEST_URL=BASE+'/api/projects/acdd692f-a188-4f85-bb5a-83c48d5c7e82/database/data-spaces/de1fe530-a762-52fa-ba11-d01cc5b344df/manifest'
REVIEWED_AT='2026-10-12'
SOURCE_VERSION='NHHR manifest revision 93; original public-source files reviewed 12 October 2026'
CIHI_URL='https://www.cihi.ca/en/the-state-of-the-health-workforce-in-canada-2024/go-in-depth-2024-health-workforce-data'
JOBBANK_URL='https://www.jobbank.gc.ca/trend-analysis/search-wages/wage-methodology'
STATCAN_URL='https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1410006401'
SOURCES=json.loads(r'''{
  "ot": {
    "collectionId": "DATA-C053",
    "filename": "occupational-therapists-in-canada-2024-data-tables-en.xlsx",
    "originalFileId": "d0f45a99-dba3-4392-88a2-c9c209a3c43f",
    "sha256": "943af7ea72f15295b6bd5475f18b5858acc54e530c5a7ec4413364543f9c57f2",
    "sourceRelativePath": "outputs/theo_cba_full_data_package_20260831/originals/02_Health_Costs_and_Utilization/DATA-C053_CIHI_Source_Pull/occupational-therapists-in-canada-2024-data-tables-en.xlsx",
    "datasetId": "0c0cb2db-d9ab-43bf-8e1b-e023141f493f",
    "tables": [
      {
        "table_name": "nhhr_data_c053_c7f8384ce39d_zip_data_c053__31",
        "worksheet": "Table 11",
        "row_count": "111",
        "parquet_sha256": "77547fa1f666e591e19fd2d2ca28824e9c2fceef3b16491e1e02739416ca6f11"
      },
      {
        "table_name": "nhhr_data_c053_c7f8384ce39d_zip_data_c053__32",
        "worksheet": "Table 12",
        "row_count": "110",
        "parquet_sha256": "f206f073c512c3780f91b45567c1296bdb6a3be46c0dcffeb7e03c6cee3e362b"
      }
    ]
  },
  "pharmacy": {
    "collectionId": "DATA-C053",
    "filename": "pharmacists-in-canada-2015-2024-data-tables-en.xlsx",
    "originalFileId": "50bbbf44-89f1-4e9d-84d5-d3a33876560b",
    "sha256": "a61208d52794d2892458394d64b5ec48f7941f8a5b4d03302c5abeb84bba684f",
    "sourceRelativePath": "outputs/theo_cba_full_data_package_20260831/originals/02_Health_Costs_and_Utilization/DATA-C053_CIHI_Source_Pull/pharmacists-in-canada-2015-2024-data-tables-en.xlsx",
    "datasetId": "0c0cb2db-d9ab-43bf-8e1b-e023141f493f",
    "tables": [
      {
        "table_name": "nhhr_data_c053_c7f8384ce39d_zip_data_c053__52",
        "worksheet": "Table 11",
        "row_count": "112",
        "parquet_sha256": "de0093fe3724938f92609013f11826f0e38c0091d8c3cade6ce5709f56785932"
      },
      {
        "table_name": "nhhr_data_c053_c7f8384ce39d_zip_data_c053__53",
        "worksheet": "Table 12",
        "row_count": "111",
        "parquet_sha256": "fb2a473c314cfaebd1275e1c746cb46957acf0a5baacd8fafa0511742aa43f09"
      }
    ]
  },
  "pt": {
    "collectionId": "DATA-C053",
    "filename": "physiotherapists-in-canada-2015-2024-data-tables-en.xlsx",
    "originalFileId": "c43d3742-cf32-4d2b-b1de-537d0862a8b8",
    "sha256": "eadbe44f977ec6c5422745d017b387d97248742aded5f0c4c524fc0f821378a1",
    "sourceRelativePath": "outputs/theo_cba_full_data_package_20260831/originals/02_Health_Costs_and_Utilization/DATA-C053_CIHI_Source_Pull/physiotherapists-in-canada-2015-2024-data-tables-en.xlsx",
    "datasetId": "0c0cb2db-d9ab-43bf-8e1b-e023141f493f",
    "tables": [
      {
        "table_name": "nhhr_data_c053_a67f59c1bbfe_zip_data_c053__13",
        "worksheet": "Table 11",
        "row_count": "109",
        "parquet_sha256": "08c1214525603d64ce954c2abed453489594d463c57d3fb1762225aa26e92181"
      },
      {
        "table_name": "nhhr_data_c053_a67f59c1bbfe_zip_data_c053__14",
        "worksheet": "Table 12",
        "row_count": "108",
        "parquet_sha256": "e5432e24c6c61ebe80bf3cc1c74951a170ff83077e8d36e0695206ec72036c86"
      }
    ]
  },
  "quickstats": {
    "collectionId": "DATA-C053",
    "filename": "health-workforce-quickstats-2024-data-tables-en.xlsx",
    "originalFileId": "2c1d2bdc-c767-4b4a-96e4-6426c0f278a8",
    "sha256": "0bc1c14caa3a8a4b5d9519ff8144f1652c9e04a740ad81d8d7e0eb46f05e2443",
    "sourceRelativePath": "outputs/theo_cba_full_data_package_20260831/originals/02_Health_Costs_and_Utilization/DATA-C053_CIHI_Source_Pull/health-workforce-quickstats-2024-data-tables-en.xlsx",
    "datasetId": "0c0cb2db-d9ab-43bf-8e1b-e023141f493f",
    "tables": [
      {
        "table_name": "nhhr_data_c053_1a1ed09f34ea_zip_data_c053__30",
        "worksheet": "Table 7",
        "row_count": "78",
        "parquet_sha256": "b93deb1e595ddb4df86d6a3dc68f27bf3efbfab05144b333d9312711a8932035"
      },
      {
        "table_name": "nhhr_data_c053_1a1ed09f34ea_zip_data_c053__31",
        "worksheet": "Table 8",
        "row_count": "84",
        "parquet_sha256": "05fd7ba5494195f7996bd760efbb48407f9e2f9284dd8255d9c13858410726c2"
      },
      {
        "table_name": "nhhr_data_c053_1a1ed09f34ea_zip_data_c053__34",
        "worksheet": "Notes on Hospital Staffing ind",
        "row_count": "43",
        "parquet_sha256": "4a35151ec0ef3db481374c0229c98a46c89ba156c4b31cb5e364a8bcec07e10e"
      },
      {
        "table_name": "nhhr_data_c053_1a1ed09f34ea_zip_data_c053__35",
        "worksheet": "Notes on Vacancy metrics",
        "row_count": "37",
        "parquet_sha256": "f88a69db7ebfaee7b9362a24e573d9b3d58eab4f00162b6207b75a7a28705ac0"
      },
      {
        "table_name": "nhhr_data_c053_1a1ed09f34ea_zip_data_c053__44",
        "worksheet": "StaffingData",
        "row_count": "417",
        "parquet_sha256": "df082c5da2fca8d7a3f514f6eb27e5c18341e3356edd6db0bd63251246e4df37"
      },
      {
        "table_name": "nhhr_data_c053_1a1ed09f34ea_zip_data_c053__47",
        "worksheet": "VacancyData",
        "row_count": "1505",
        "parquet_sha256": "89ff975ff54136a1edd774040e489f5797371198941dff14d7b7ba1270fc5a77"
      }
    ]
  },
  "jobbank": {
    "collectionId": "DATA-C044",
    "filename": "jobbank_wages_2025_open_data_all_2025-11-19.csv",
    "originalFileId": "b5e765bd-147e-4302-bbb5-967909b940f9",
    "sha256": "7bd29fb41b2a84eb61a4dbf49bfb63651a8a694c62ce42ac69cb785679d66328",
    "sourceRelativePath": "outputs/theo_cba_full_data_package_20260831/originals/05_Labour_Education_and_Population/DATA-C044_Job_Bank_Wage_Data/jobbank_wages_2025_open_data_all_2025-11-19.csv",
    "datasetId": "79b129e1-414b-4b85-9d63-66ab334081fc",
    "tables": [
      {
        "table_name": "nhhr_data_c044_aea184fa6a6c_zip_data_c044_jobban",
        "worksheet": "",
        "row_count": "41889",
        "parquet_sha256": "ba25541a1265dbf7152d61384d0dbbe14bc70cee72e836315d5054aa67452dd5"
      },
      {
        "table_name": "nhhr_data_c044_aea184fa6a6c_zip_data_c044__2",
        "worksheet": "",
        "row_count": "2487",
        "parquet_sha256": "e748924a9fa8ce620d4e140ec0e170d4b3d3d8bcbb022876930c1262d920144c"
      }
    ]
  },
  "jobbankMetadata": {
    "collectionId": "DATA-C044",
    "filename": "open_canada_jobbank_wages_package_show.json",
    "originalFileId": "e20b0550-991d-422c-8c59-4dcf9914f8f4",
    "sha256": "3941929b6eb1c52e1f7c94b1a585244d06dc4fc74b7f51cdca9e6cbe3501dc67",
    "sourceRelativePath": "outputs/theo_cba_full_data_package_20260831/originals/05_Labour_Education_and_Population/DATA-C044_Job_Bank_Wage_Data/open_canada_jobbank_wages_package_show.json",
    "datasetId": "79b129e1-414b-4b85-9d63-66ab334081fc",
    "tables": [
      {
        "table_name": "nhhr_data_c044_aea184fa6a6c_zip_data_c044_open_c",
        "worksheet": "",
        "row_count": "1",
        "parquet_sha256": "2eec964e5c6aa7b5eba2931c49a028b90644889382089ff753feb3f7668fd667"
      }
    ]
  },
  "sectorWages": {
    "collectionId": "DATA-C059",
    "filename": "statcan_14100064_bc_wages.csv",
    "originalFileId": "cd364c83-9f49-4137-b796-e82669f0953f",
    "sha256": "9aca2808149588d0fd63a58b07244e553092de9446b2bf3c72d5628fdd483897",
    "sourceRelativePath": "Data Research/output/reports/cba_public_pulls/statcan_14100064_bc_wages.csv",
    "datasetId": "bc5f8ecd-98b3-4185-ada5-ceb71adcbf00",
    "tables": [
      {
        "table_name": "nhhr_data_c059_f19e4b04bb77_zip_data_c059__5",
        "worksheet": "",
        "row_count": "1102",
        "parquet_sha256": "991569a41ebb5714d253c29f10b9cd5b89d15cdb4027d38f185c5ed3ef4e1548"
      }
    ]
  }
}''')
NS={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
REL_NS='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
REGIONS={'Northwest HSDA':'51','Northern Interior HSDA':'52','Northeast HSDA':'53'}
PROFESSIONS={'ot':'Occupational therapists','pharmacy':'Pharmacists','pt':'Physiotherapists'}
NOCS={'NOC_31120':'Pharmacists','NOC_31202':'Physiotherapists','NOC_31203':'Occupational therapists','NOC_31301':'Registered nurses and registered psychiatric nurses','NOC_31302':'Nurse practitioners','NOC_32120':'Medical laboratory technologists'}
WAGE_REGIONS={'ER59':'British Columbia','ER5950':'Cariboo','ER5960':'North Coast','ER5970':'Nechako','ER5980':'Northeast'}
MISSING={'':'Not reported','—':'Data unavailable (source marker)','X':'Suppressed for confidentiality','F':'Unreliable data (source marker)','†':'Not reported (source marker)'}


def require(ok,message):
    if not ok:raise ValueError(message)

def get_bytes(url,headers):
    with urlopen(Request(url,headers=headers),timeout=60) as response:return response.read()

def refresh(input_root,headers):
    manifest=json.loads(get_bytes(MANIFEST_URL,headers))
    require(manifest.get('revision')==93,'Manifest version changed; review before refreshing')
    available={r['id'] for r in manifest['resources'] if r.get('kind')=='dataset' and r.get('available')}
    ids={s['datasetId'] for s in SOURCES.values()}
    require(ids<=available,'Reviewed dataset missing from authorized manifest')
    for ident in sorted(ids):
        api=json.loads(get_bytes(BASE+'/api/datasets/'+ident,headers))['dataset']
        require(api['id']==ident and api['status']=='ready','Dataset identity/status changed')
    catalogue=next(x for x in manifest['manifestSources'] if x.get('role')=='manifest')
    data={}
    for name in ['NHHR_files.csv','NHHR_tables.csv']:
        link=next(f for f in catalogue['files'] if f['name']==name)
        data[name]=list(csv.DictReader(io.StringIO(get_bytes(BASE+link['url'],headers).decode('utf-8-sig'))))
    for source in SOURCES.values():
        matches=[f for f in data['NHHR_files.csv'] if f['dataset_id']==source['datasetId'] and source['originalFileId'] in f['original_file_ids'].split(';')]
        require(any(f['sha256']==source['sha256'] for f in matches),'Original file identity/hash changed')
        for t in source['tables']:
            matches=[f for f in data['NHHR_tables.csv'] if f['dataset_id']==source['datasetId'] and f['table_name']==t['table_name']]
            require(len(matches)==1 and matches[0]['source_sha256']==source['sha256'] and all(matches[0][k]==t[k] for k in ['worksheet','row_count','parquet_sha256']),'Scientific table lineage/version changed')
        raw=get_bytes(BASE+'/api/files/'+source['originalFileId']+'/download',headers)
        require(hashlib.sha256(raw).hexdigest()==source['sha256'],'Downloaded source hash mismatch')
        target=input_root/source['collectionId']/source['filename'];target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(raw)

def locked(input_root,key):
    s=SOURCES[key];raw=(input_root/s['collectionId']/s['filename']).read_bytes()
    require(hashlib.sha256(raw).hexdigest()==s['sha256'],'Source changed: '+s['filename'])
    return raw

def workbook(raw,names):
    """Read only requested original cached OOXML sheets; no formula recalculation."""
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        strings=[''.join(t.text or '' for t in e.findall('.//m:t',NS)) for e in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si',NS)] if 'xl/sharedStrings.xml' in z.namelist() else []
        rel={e.attrib['Id']:e.attrib['Target'] for e in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
        result={}
        for sheet in ET.fromstring(z.read('xl/workbook.xml')).findall('m:sheets/m:sheet',NS):
            name=sheet.attrib['name']
            if name not in names:continue
            target=rel[sheet.attrib['{'+REL_NS+'}id']]
            part=target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/'+target)
            require(part.startswith('xl/'),'Unexpected worksheet path')
            rows={}
            for row in ET.fromstring(z.read(part)).findall('m:sheetData/m:row',NS):
                vals={};formulas=[]
                for cell in row.findall('m:c',NS):
                    col=re.match(r'[A-Z]+',cell.attrib['r']).group();v=cell.find('m:v',NS)
                    if cell.get('t')=='s' and v is not None:literal=strings[int(v.text)]
                    elif cell.get('t')=='inlineStr':literal=''.join(t.text or '' for t in cell.findall('.//m:t',NS))
                    else:literal=v.text if v is not None else None
                    if literal is not None:vals[col]=literal
                    if cell.find('m:f',NS) is not None:formulas.append(col)
                if vals:rows[int(row.attrib['r'])]={'values':vals,'formulas':formulas}
            result[name]={'part':part,'rows':rows}
        require(set(result)==set(names),'Required scientific/method sheet absent')
        return result

def number(raw,count=False,allow_negative=False):
    raw='' if raw is None else raw
    if raw in MISSING:return None,MISSING[raw]
    require(re.fullmatch(r'-?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?',raw) is not None,'Unreviewed numeric or suppression token')
    x=Decimal(raw);require(x.is_finite() and (allow_negative or x>=0),'Invalid source value')
    if count:require(x==x.to_integral_value(),'Nonintegral published count')
    value=int(x) if x==x.to_integral_value() else float(x)
    require(math.isfinite(value),'Nonfinite value')
    return value,'Reported'

def percent(raw):
    n,status=number(raw)
    return (None if n is None else float(Decimal(raw)*100)),status

def column(key,label,numeric=False,unit=None):
    c={'key':key,'label':label,'type':'number' if numeric else 'text'}
    if unit:c['unit']=unit
    return c

def dataset(id,title,description,source,table,rows,columns,metric,entity,geography='none',time=None,notes=None,filters=None):
    d={'id':id,'title':title,'description':description,'topic':'Workforce and services','geography':geography,'status':'observed','timeLabel':'','sourceName':'CIHI Health Workforce Database / Canadian MIS Database' if source['collectionId']=='DATA-C053' else 'Government of Canada Job Bank / Statistics Canada' if source['collectionId']=='DATA-C044' else 'Statistics Canada','sourceUrl':CIHI_URL if source['collectionId']=='DATA-C053' else JOBBANK_URL if source['collectionId']=='DATA-C044' else STATCAN_URL,'datasetId':source['datasetId'],'tableName':table,'notes':notes or [],'columns':columns,'rows':rows,'defaultMetric':metric,'entityField':entity}
    if time:d['timeField']=time
    if filters:d['defaultFilters']=filters
    return d

def prepare(input_root):
    views=[];bindings=[]
    boundary=json.loads((ROOT/'public/data/nhhr/boundaries-hsda.geojson').read_text())
    labels={f['properties']['code']:f['properties']['name'] for f in boundary['features']}
    require(all(labels[code]==region.removesuffix(' HSDA') for region,code in REGIONS.items()),'HSDA identity crosswalk changed')
    allied=[]
    for key,profession in PROFESSIONS.items():
        b=workbook(locked(input_root,key),['Table 11','Table 12']);indexes={}
        for name,sheet in b.items():
            rows=sheet['rows'];header=rows[2]['values']
            require([header.get(c) for c in 'ABCDEFGHIJKL']==['Jurisdiction','Health region',*[str(y) for y in range(2015,2025)]],'Allied-health header/year changed')
            title=rows[1]['values']['A'];require('employed in direct care' in title,'Wrong workforce measure')
            require(name!='Table 12' or 'per 10,000 population' in title,'Rate denominator changed')
            ix={}
            for nr,item in rows.items():
                row=item['values']
                if row.get('A')!='British Columbia' or row.get('B') not in REGIONS:continue
                require(not any(c in item['formulas'] for c in 'ABCDEFGHIJKL'),'Unexpected formula in selected workforce row')
                for c,year in zip('CDEFGHIJKL',range(2015,2025)):
                    obs=(row['B'],str(year));require(obs not in ix,'Duplicate allied-health observation')
                    ix[obs]=(row.get(c,''),c+str(nr))
            require(len(ix)==30,'Allied-health Northern coverage changed');indexes[name]=ix
        require(indexes['Table 11'].keys()==indexes['Table 12'].keys(),'Workforce count/rate keys differ')
        for (region,year),(raw,cell) in indexes['Table 11'].items():
            rate_raw,rate_cell=indexes['Table 12'][(region,year)];count,cstatus=number(raw,count=True);rate,rstatus=number(rate_raw)
            allied.append({'region_name':region,'hsda_code':REGIONS[region],'profession':profession,'year':year,'direct_care_count':count,'direct_care_per_10k':rate,'count_raw':raw,'rate_raw':rate_raw,'count_status':cstatus,'rate_status':rstatus})
            bindings.append({'view':'allied-health-northern','profession':profession,'region':region,'year':year,'sourceKey':key,'countCell':'Table 11!'+cell,'rateCell':'Table 12!'+rate_cell})
    require(len(allied)==90 and len({(r['profession'],r['hsda_code'],r['year']) for r in allied})==90,'Allied-health grain changed')
    a=dataset('allied-health-northern','Northern allied-health workforce','Direct-care occupational therapists, pharmacists and physiotherapists across the three Northern HSDAs, with separately published counts and population rates.',SOURCES['ot'],'; '.join(t['table_name'] for key in PROFESSIONS for t in SOURCES[key]['tables']),allied,[column('region_name','Source HSDA'),column('hsda_code','Reviewed HSDA code'),column('profession','Profession'),column('year','Year'),column('direct_care_count','Professionals in direct care',True,'people'),column('direct_care_per_10k','Direct-care professionals per 10,000',True,'per 10,000'),column('count_raw','Original count literal'),column('rate_raw','Original rate literal'),column('count_status','Count reporting status'),column('rate_status','Rate reporting status')],'direct_care_per_10k','region_name','hsda','year',[
        'One source profession, health region and year per row. Select one profession and year before mapping; neither counts nor rates should be added across professions.',
        'Direct care is the publisher’s employment definition, rather than total registrations, FTEs, vacancies, trial staff or available research capacity. People may belong to multiple profession datasets.',
        'Rates retain CIHI’s own denominator and rounding per 10,000 population. They are not recomputed using the Atlas population projection, and the physician rate uses a different per-100,000 scale.',
        'Exact Northern HSDA names join reviewed 51/52/53 polygons as geographic context; boundary vintage and the source’s Postal Code Conversion File allocation limit historical harmonization.',
        'Other jurisdictions, provincial totals and previously released nursing/physician rows are excluded from this bounded selection. Missing source markers remain null with original literals.',
    ],{'profession':'Occupational therapists'});a['timeLabel']='2015–2024 · direct-care employment';a['boundaryKeyField']='hsda_code';a['mapScaleFields']=['profession'];a['sourceName']='CIHI Health Workforce Database';views.append(a)

    wages=list(csv.DictReader(io.StringIO(locked(input_root,'jobbank').decode('utf-8-sig'))));require(len(wages)==44376,'Job Bank original row count changed')
    metadata=json.loads(locked(input_root,'jobbankMetadata'));metadata=metadata.get('result',metadata)
    require(metadata.get('license_id') in {'ca-ogl-lgo','ca-ogl-lgo-fra'},'Job Bank metadata licence changed')
    w=[]
    for source_row,row in enumerate(wages,start=2):
        if row['prov']!='BC' or row['NOC_CNP'] not in NOCS or row['ER_Code_Code_RE'] not in WAGE_REGIONS:continue
        require(row['NOC_Title_eng']==NOCS[row['NOC_CNP']] and row['ER_Name']==WAGE_REGIONS[row['ER_Code_Code_RE']],'Wage occupation/region identity changed')
        require(row['Annual_Wage_Flag_Salaire_annuel']=='0' and row['Revision_Date_Date_revision']=='2025-11-19','Selected wage unit/release changed')
        lo,ls=number(row['Low_Wage_Salaire_Minium']);med,ms=number(row['Median_Wage_Salaire_Median']);hi,hs=number(row['High_Wage_Salaire_Maximal'])
        require(lo is None or med is None or lo<=med,'Low wage exceeds median');require(med is None or hi is None or med<=hi,'Median exceeds high wage')
        basis=row['Source2025_NHQ'];scope='Not reported' if basis=='N/A' else 'Provincial source' if ' PR ' in basis else 'Economic-region source' if ' ER ' in basis else 'Other source scope'
        require(row['Reference_Period'] in {'2023-2024','2024','NA'},'Wage reference period changed')
        w.append({'region_name':row['ER_Name'],'er_code':row['ER_Code_Code_RE'].removeprefix('ER'),'source_er_code':row['ER_Code_Code_RE'],'reporting_level':'Province' if row['ER_Code_Code_RE']=='ER59' else 'Economic region','occupation':row['NOC_Title_eng'],'noc_code':row['NOC_CNP'],'low_hourly_wage':lo,'median_hourly_wage':med,'high_hourly_wage':hi,'low_raw':row['Low_Wage_Salaire_Minium'],'median_raw':row['Median_Wage_Salaire_Median'],'high_raw':row['High_Wage_Salaire_Maximal'],'wage_status':ms,'reference_period':row['Reference_Period'],'revision_date':row['Revision_Date_Date_revision'],'source_method':row['Data_Source_E'],'source_basis':basis,'source_scope':scope,'source_comment':row['Wage_Comment_E']})
        bindings.append({'view':'health-occupation-wages','occupation':row['NOC_Title_eng'],'sourceER':row['ER_Code_Code_RE'],'sourceKey':'jobbank','sourceCSVRow':source_row})
    require(len(w)==30 and len({(r['noc_code'],r['source_er_code']) for r in w})==30,'Wage occupation/region grain changed');require(sum(r['median_hourly_wage'] is None for r in w)==13,'Wage missing coverage changed')
    d=dataset('health-occupation-wages','Healthcare occupation wage estimates','Six selected health occupations in four Northern economic regions and the provincial reference. Original missing estimates and differing source methods remain visible.',SOURCES['jobbank'],'; '.join(t['table_name'] for t in SOURCES['jobbank']['tables']),w,[column('region_name','Source region'),column('reporting_level','Reporting level'),column('er_code','Native ER code'),column('source_er_code','Original ER identifier'),column('occupation','Occupation'),column('noc_code','Original NOC identifier'),column('low_hourly_wage','Low hourly wage',True,'CAD/hour'),column('median_hourly_wage','Median hourly wage',True,'CAD/hour'),column('high_hourly_wage','High hourly wage',True,'CAD/hour'),*[column(k,l) for k,l in [('low_raw','Original low wage'),('median_raw','Original median wage'),('high_raw','Original high wage'),('wage_status','Reporting status'),('reference_period','Original reference period'),('revision_date','Publisher revision date'),('source_method','Source method'),('source_basis','Original source basis'),('source_scope','Underlying estimate scope'),('source_comment','Original wage comment')]]],'median_hourly_wage','region_name','er',notes=[
        'These are published wage estimates in nominal CAD per hour, not individual payroll records, job offers, project budgets or current wage promises. Low and high estimates are not confidence intervals.',
        'Select one occupation before mapping. Four native economic-region codes identify Cariboo, North Coast, Nechako and Northeast; these regions differ from LHAs/HSDAs. BC’s aggregate remains in the records without an ER polygon.',
        'The source CSV does not pin an economic-region boundary vintage. The mapped 2021 PGMaps ER boundaries provide geographic context; no historical boundary harmonization is claimed.',
        'The 19 November 2025 release includes original reference periods 2023–2024 and 2024, alongside NA for missing estimates. It is a single release, not a 2025 wage-observation series.',
        'Some economic-region labels use a provincial estimate. Cariboo’s registered-nurse/RPN row retains LFS 2023-24 PR NOC5; matching the BC figure does not establish identical regional wages.',
        'Other values use Labour Force Survey regional estimates or Small Area Estimation. The latter integrates LFS estimates and the 2021 Census. Keep method, scope and original comments with every comparison.',
        'Thirteen selected medians are unreported because of source limitations. They remain null; no province substitution or zero is created by the Atlas. The source comments identify possible provincial reference values.',
    ],filters={'occupation':NOCS['NOC_31301']});d['timeLabel']='19 November 2025 release · source periods 2023–2024/2024';d['boundaryKeyField']='er_code';d['mapScaleFields']=['occupation'];views.append(d)

    q=workbook(locked(input_root,'quickstats'),['StaffingData','VacancyData','Table 7','Table 8','Notes on Hospital Staffing ind','Notes on Vacancy metrics'])
    staffing=[]
    require(q['StaffingData']['rows'][2]['values']['X']=='OT_percentage_out_Table','Staffing source measure changed')
    notes=' '.join(v for item in q['Notes on Hospital Staffing ind']['rows'].values() for v in item['values'].values())
    require('excludes purchased hours' in notes and 'April 24, 2025' in notes,'Staffing denominator/vintage note changed')
    for nr,item in q['StaffingData']['rows'].items():
        row=item['values']
        if row.get('B')!='British Columbia':continue
        ot,ots=number(row.get('V',''));regular,rs=number(row.get('W',''));pct,ps=percent(row.get('X',''));purchased,pcs=number(row.get('Z',''));sick,ss=number(row.get('AA',''))
        if pct is not None and ot is not None and regular is not None:require(abs(pct-100*ot/(ot+regular))<0.000001,'Staffing overtime denominator validation failed')
        staffing.append({'province':'British Columbia','service_area':row['D'],'fiscal_year':row['C'],'overtime_share_pct':pct,'overtime_hours':ot,'regular_worked_hours':regular,'purchased_hours':purchased,'paid_sick_hours':sick,'overtime_share_raw':row.get('X',''),'overtime_hours_raw':row.get('V',''),'regular_hours_raw':row.get('W',''),'purchased_hours_raw':row.get('Z',''),'paid_sick_hours_raw':row.get('AA',''),'overtime_share_status':ps,'purchased_hours_status':pcs})
        bindings.append({'view':'bc-hospital-staffing','serviceArea':row['D'],'fiscalYear':row['C'],'sourceKey':'quickstats','sourceSheet':'StaffingData','sourceRow':nr,'sourceCells':{'overtimeShare':'X'+str(nr),'overtimeHours':'V'+str(nr),'regularHours':'W'+str(nr),'purchasedHours':'Z'+str(nr),'paidSickHours':'AA'+str(nr)}})
    require(len(staffing)==35 and len({(r['service_area'],r['fiscal_year']) for r in staffing})==35,'Staffing BC coverage/grain changed')
    st=dataset('bc-hospital-staffing','BC hospital staffing hours','Provincial hospital service-area staffing measures from the original CIHI Quick Stats backing table, keeping worked overtime, purchased hours and paid sick leave distinct.',SOURCES['quickstats'],next(t['table_name'] for t in SOURCES['quickstats']['tables'] if t['worksheet']=='StaffingData'),staffing,[column('province','Province'),column('service_area','Hospital service area'),column('fiscal_year','Original fiscal year'),column('overtime_share_pct','Overtime share of worked hours',True,'%'),column('overtime_hours','Worked overtime hours',True,'hours'),column('regular_worked_hours','Regular worked hours',True,'hours'),column('purchased_hours','Purchased third-party hours',True,'hours'),column('paid_sick_hours','Paid sick-leave hours',True,'hours'),*[column(k,k.replace('_',' ').capitalize()) for k in ['overtime_share_raw','overtime_hours_raw','regular_hours_raw','purchased_hours_raw','paid_sick_hours_raw','overtime_share_status','purchased_hours_status']]],'overtime_share_pct','service_area',time='fiscal_year',notes=[
        'Province-level hospital records, FY2019–2020 through FY2023–2024. The CMDB extract was current as of 24 April 2025. Provincial measures cannot be assigned to Northern HSDAs or individual hospitals.',
        'Overtime share = worked overtime ÷ (worked overtime + regular worked hours) × 100. Purchased hours and benefit hours are excluded from this denominator; sick leave remains a separate paid-hours measure.',
        'The release converts original source percentage fractions to percent and verifies the stated denominator. Original cached backing-table numerical literals are retained; display rounding does not add measurement precision.',
        'Medical personnel hours are excluded to improve jurisdiction comparability. Hospital community-health hours do not cover all community services delivered outside hospitals. Neither staffing hours nor overtime establishes service quality, available trial staff or a causal NHHR effect.',
        'Total overlaps the six service-area rows. Do not add Total to the areas, average overtime percentages into a new rate, or convert hours into unique workers. Missing or suppressed source markers remain null.',
    ],filters={'service_area':'Nursing inpatient services'});st['timeLabel']='FY2019–2020 through FY2023–2024 · source current 24 April 2025';st['sourceName']='CIHI Canadian MIS Database';views.append(st)

    vac=[];source=q['VacancyData']['rows'];require(source[2]['values'].get('G')=='vacancies' and source[2]['values'].get('H')=='vacancy_proportion','Vacancy source headers changed')
    notes=' '.join(v for item in q['Table 8']['rows'].values() for v in item['values'].values())
    require('2016Q2, 2016Q3, 2016Q4 and 2017Q1' in notes and 'nearest 5' in notes and 'X: Suppressed' in notes and 'F: Unreliable' in notes,'Vacancy period/missing/rounding definitions changed')
    for nr,item in source.items():
        row=item['values']
        if row.get('C')!='British Columbia':continue
        value,status=number(row['G'],count=True);share,share_status=percent(row['H']);year=row['B'];require(year in {str(y) for y in range(2015,2025)},'Vacancy source year changed')
        if value is not None:require(value%5==0,'Vacancy reporting precision changed')
        fiscal=year+'–'+str(int(year)+1)
        vac.append({'province':'British Columbia','occupation':row['D'],'source_year':year,'fiscal_year':fiscal,'average_vacancies':value,'share_of_health_vacancies_pct':share,'vacancy_raw':row['G'],'share_raw':row['H'],'vacancy_status':status,'share_status':share_status,'quarters_in_estimate':'2020Q4; 2021Q1' if year=='2020' else '; '.join([year+'Q2',year+'Q3',year+'Q4',str(int(year)+1)+'Q1'])})
        bindings.append({'view':'bc-health-occupation-vacancies','occupation':row['D'],'sourceYear':year,'fiscalYear':fiscal,'sourceKey':'quickstats','sourceSheet':'VacancyData','vacanciesCell':'G'+str(nr),'shareCell':'H'+str(nr)})
    require(len(vac)==120 and len({(r['occupation'],r['source_year']) for r in vac})==120,'Vacancy occupation/year grain changed')
    require(sum(r['vacancy_raw']=='X' for r in vac)==20 and sum(r['vacancy_raw']=='F' for r in vac)==12,'Vacancy suppressed/unreliable coverage changed')
    for year in {r['source_year'] for r in vac}:
        total=next(r['average_vacancies'] for r in vac if r['source_year']==year and r['occupation']=='Health care, social work, personal support and mental health')
        for r in [r for r in vac if r['source_year']==year and r['share_of_health_vacancies_pct'] is not None and r['average_vacancies'] is not None]:
            # Counts are rounded to five before dissemination, while shares
            # use the publisher's underlying estimates and round to 0.1%.
            # Verify overlapping precision intervals, not exact arithmetic
            # from already rounded counts, and never replace the source share.
            require(total is not None and total>2.5,'Vacancy denominator missing')
            lower=100*max(0,r['average_vacancies']-2.5)/(total+2.5)
            upper=100*(r['average_vacancies']+2.5)/(total-2.5)
            require(lower<=r['share_of_health_vacancies_pct']+0.050001 and upper>=r['share_of_health_vacancies_pct']-0.050001,'Vacancy composition is inconsistent with source rounding')
    v=dataset('bc-health-occupation-vacancies','BC health-occupation vacancy estimates','Average vacant jobs by original occupation group, retaining fiscal-quarter methodology, overlapping groups and source confidentiality/reliability markers.',SOURCES['quickstats'],next(t['table_name'] for t in SOURCES['quickstats']['tables'] if t['worksheet']=='VacancyData'),vac,[column('province','Province'),column('occupation','Original occupation group'),column('source_year','Original source year label'),column('fiscal_year','Fiscal period from source method'),column('average_vacancies','Average number of vacancies',True,'average vacant jobs'),column('share_of_health_vacancies_pct','Share of health/social/support/mental-health vacancies',True,'%'),column('vacancy_raw','Original vacancy literal'),column('share_raw','Original share literal'),column('vacancy_status','Vacancy reporting status'),column('share_status','Share reporting status'),column('quarters_in_estimate','Quarter coverage from source method')],'average_vacancies','occupation',time='fiscal_year',notes=[
        'Original workbook labels 2015–2024 are retained as source_year. Its Table 8 note explicitly defines source year 2016 as the average of 2016Q2, Q3, Q4 and 2017Q1; the derived fiscal labels follow this stated method, FY2015–2016 through FY2024–2025.',
        'For FY2020–2021, collection was suspended in 2020Q2/Q3, so the source estimate uses only 2020Q4 and 2021Q1. The other periods use four quarters. These average vacancies are rounded to the nearest five; they are not unique positions observed over the entire year.',
        'Vacancies as a share of total health/social-work/personal-support/mental-health vacancies describe composition. They are not vacancies divided by all filled and vacant jobs, a standard job vacancy rate, or a direct-care workforce percentage.',
        'Published composition shares retain the publisher’s own rounded values. They are checked against the intervals implied by nearest-five counts and nearest-0.1 percentage rounding, rather than recomputed from the rounded counts.',
        'X remains null and denotes confidentiality suppression; F remains null and denotes unreliable data. Em-dash denotes unavailable data. Source markers and original occupation labels are retained.',
        'Occupation groups overlap: the combined nursing group includes nurses and coordinators, while the broad health/social/support/mental-health group includes narrower occupations. Do not add these groups into a new total or unique-worker count.',
        'Province-level employer estimates do not establish Northern vacancies, individual hospital vacancies, current job openings, trial-coordinator capacity, staffing requirements or an NHHR effect.',
    ],filters={'occupation':'Registered nurses and registered psychiatric nurses*'});v['timeLabel']='Source labels 2015–2024 · FY2015–2016 through FY2024–2025';v['sourceName']='Statistics Canada Job Vacancy and Wage Survey, published in CIHI Quick Stats';views.append(v)

    records=list(csv.DictReader(io.StringIO(locked(input_root,'sectorWages').decode('utf-8-sig'))));require(len(records)==1102,'Sector wage source row count changed')
    sectors={'Health care and social assistance [62]','Total employees, all industries'};ix={}
    for nr,r in enumerate(records,start=2):
        if r['NAICS'] not in sectors:continue
        require(r['GEO']=='British Columbia' and r['UOM']=='Current dollars','Sector wage geography/unit changed')
        require(r['Wages'] in {'Average hourly wage rate','Average weekly wage rate'},'Unreviewed sector wage measure')
        key=(r['NAICS'],r['REF_DATE']);measure='average_hourly_wage' if r['Wages']=='Average hourly wage rate' else 'average_weekly_wage'
        values=ix.setdefault(key,{});require(measure not in values,'Duplicate sector/year/measure');values[measure]=r['VALUE']
        bindings.append({'view':'bc-sector-wages','sector':r['NAICS'],'year':r['REF_DATE'],'measure':measure,'sourceKey':'sectorWages','sourceCSVRow':nr})
    require(len(ix)==58 and all(set(v)=={'average_hourly_wage','average_weekly_wage'} for v in ix.values()),'Sector wage series coverage changed')
    sw=[]
    for (sector,year),measures in sorted(ix.items()):
        hourly,hs=number(measures['average_hourly_wage']);weekly,ws=number(measures['average_weekly_wage'])
        sw.append({'province':'British Columbia','sector':sector,'year':year,'average_hourly_wage':hourly,'average_weekly_wage':weekly,'hourly_raw':measures['average_hourly_wage'],'weekly_raw':measures['average_weekly_wage'],'price_basis':'Current dollars','hourly_status':hs,'weekly_status':ws})
    s=dataset('bc-sector-wages','BC health-sector wage context','Statistics Canada average employee wages for health care/social assistance and all industries, keeping hourly and weekly units and original annual periods distinct.',SOURCES['sectorWages'],SOURCES['sectorWages']['tables'][0]['table_name'],sw,[column('province','Province'),column('sector','Original industry/sector'),column('year','Calendar year'),column('average_hourly_wage','Average hourly wage',True,'CAD/hour'),column('average_weekly_wage','Average weekly wage',True,'CAD/week'),column('hourly_raw','Original hourly literal'),column('weekly_raw','Original weekly literal'),column('price_basis','Price basis'),column('hourly_status','Hourly reporting status'),column('weekly_status','Weekly reporting status')],'average_hourly_wage','sector',time='year',notes=[
        'One BC sector/year record joins two original annual wage measures from Statistics Canada Table 14-10-0064, 1997–2025. Both retain nominal current dollars; no inflation adjustment or constant-worker composition is assumed.',
        'The health care and social assistance industry is an employer industry classification, rather than all healthcare occupations or a health-only/NHHR payroll measure. The all-industries total includes health care and overlaps it.',
        'Average hourly and weekly wages use different units. Do not add them, convert weekly pay to hourly using an assumed workweek, or compare them directly with an occupational median without explaining the different populations and statistics.',
        'Province-level averages cannot be assigned to Northern communities or individual facilities and do not establish a wage offer, recruitment availability or causal hub savings.',
    ],filters={'sector':'Health care and social assistance [62]'});s['timeLabel']='1997–2025 · calendar-year nominal wages';views.append(s)
    require(sum(len(d['rows']) for d in views)==333,'Bounded service release row count changed')
    release={'snapshot':{'reviewedAt':REVIEWED_AT,'sourceVersion':SOURCE_VERSION,'manifestUrl':MANIFEST_URL,'scope':'Five bounded public-source views; 333 rows at overlapping workforce, wage and service grains, not unique people or jobs.'},'datasets':views}
    provenance={'reviewedAt':REVIEWED_AT,'manifestUrl':MANIFEST_URL,'sourceVersion':SOURCE_VERSION,'sources':SOURCES,'sourceBindings':bindings,'releaseCounts':{d['id']:len(d['rows']) for d in views},'missingCounts':{'wageMedians':13,'vacancyConfidential':20,'vacancyUnreliable':12},'methods':{'workforce':'Exact profession/HSDA/year join between original count and rate cells; no rates recomputed','wage':'Six exact NOC codes × five exact BC reporting labels; original fallback scope, methods and missing values retained','staffing':'Original overtime fraction×100; denominator independently verified against worked overtime+regular hours','vacancies':'Original count/share cells; fraction × 100; fiscal periods derived from Table 8 quarterly method, retaining the 2020 exception','sectorWage':'Original BC sector/calendar-year/hourly-weekly rows pivoted without averaging'},'rights':['CIHI public-source attribution and original publisher terms apply. No contact, personal-compensation, participant or interview records enter this release.','Job Bank metadata declares the Open Government Licence—Canada. Wage estimates retain original reference periods, comments and methodology.','Statistics Canada source attribution and original dissemination terms apply.'],'mappingLimits':['HSDA 51/52/53 exact names reviewed against existing polygons.','Wage ER 5950/5960/5970/5980 use 2021 PGMaps context geometry; source geometry vintage is not independently pinned. BC aggregate 59 has no ER polygon.','BC staffing, vacancies and sector wages remain provincial charts/tables and are never allocated to HSDAs, LHAs or facilities.']}
    return release,provenance

def save(path,value,check):
    content=(json.dumps(value,ensure_ascii=False,indent=2)+'\n').encode()
    if check:require(path.exists() and path.read_bytes()==content,'Generated output differs: '+str(path.relative_to(ROOT)))
    else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(content)

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--input',required=True,type=Path);p.add_argument('--refresh',action='store_true');p.add_argument('--headers-file',type=Path);p.add_argument('--check',action='store_true');a=p.parse_args()
    if a.refresh:
        headers=json.loads(a.headers_file.read_text()) if a.headers_file else {};require(isinstance(headers,dict) and all(isinstance(k,str) and isinstance(v,str) for k,v in headers.items()),'Headers must be a private string map');refresh(a.input,headers)
    release,provenance=prepare(a.input)
    save(ROOT/'src/atlas/snapshots/service-expansion.json',release,a.check);save(ROOT/'public/data/nhhr/service-expansion.json',release,a.check);save(ROOT/'public/data/nhhr/service-expansion-provenance.json',provenance,a.check)
    print(('Verified' if a.check else 'Prepared')+' 5 service/workforce datasets / 333 source rows; hashes, grains, source periods, units and missing markers checked.')

if __name__=='__main__':main()
