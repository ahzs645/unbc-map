#!/usr/bin/env python3
"""Prepare reviewed graduate projections, Northern HA rates and institutional enrolment.

--input DIR contains the original DATA-C049, DATA-C016 and DATA-X08 files.
--refresh follows authorized Zoer manifest/dataset/file/table IDs. --check compares
all generated outputs. Scientific source hashes, table lineage and original
periods are locked; source changes require review. No CHSA values or campus/city
ratios are invented. External enrolment verification is a dated primary-page
review receipt, not a live source refresh or a claim of campus allocation.
"""
from __future__ import annotations
import argparse,csv,hashlib,io,json,math,posixpath,re,zipfile
from decimal import Decimal
from pathlib import Path
from urllib.request import Request,urlopen
from xml.etree import ElementTree as ET
ROOT=Path(__file__).resolve().parents[1]
BASE='https://zoer.k8s.overtheedgepaper.ca'
MANIFEST=BASE+'/api/projects/acdd692f-a188-4f85-bb5a-83c48d5c7e82/database/data-spaces/de1fe530-a762-52fa-ba11-d01cc5b344df/manifest'
REVIEWED='2026-10-12'
PSSM_URL='https://www2.gov.bc.ca/gov/content/data/statistics/economy/labour-market-statistics'
METHOD_URL='https://www2.gov.bc.ca/assets/gov/data/statistics/employment-labour-market/bc_post-secondary_supply_model_methodology_highlights.pdf'
HEALTH_URL='https://communityhealth.phsa.ca/'
SOURCES=json.loads(r'''{
  "pssm": {
    "collectionId": "DATA-C049",
    "datasetId": "91de0066-9343-4d0f-9138-03766520ddc0",
    "filename": "bc_post-secondary_supply_model_2023-24_to_2034-35.xlsx",
    "originalFileId": "9c3033e2-6284-4748-9b23-e9f5221cc8f2",
    "sha256": "c8f5f4c9a31dbfb311b8dd48c9d9c25b96dc662879a22099f5b0cb6d815018a9",
    "sourceRelativePath": "Data Research/Data/raw/public_pull_2026-04-29/bc_post-secondary_supply_model_2023-24_to_2034-35.xlsx",
    "tables": [
      {
        "table_name": "nhhr_data_c049_6e78ae316dce_zip_data_c049_bc_pos",
        "worksheet": "User Guide",
        "row_count": "7",
        "parquet_sha256": "1aeaaeaf8d44723eb8bbef82db193f1f7785acdc51c1c08e3ef7a587d246ef51"
      },
      {
        "table_name": "nhhr_data_c049_6e78ae316dce_zip_data_c049__2",
        "worksheet": "Graduate Projections",
        "row_count": "40",
        "parquet_sha256": "47978e1c65761b56c0e0487493ef8cb5cd0071c3d155fb29974e1b5fc38914ab"
      },
      {
        "table_name": "nhhr_data_c049_6e78ae316dce_zip_data_c049__3",
        "worksheet": "Occupation Projections",
        "row_count": "849",
        "parquet_sha256": "72b8f11a6b8d96f93c860eb77aa051571bbb15bee1b2e9d601b8ac2b030ab06a"
      }
    ]
  },
  "indicators": {
    "collectionId": "DATA-C016",
    "datasetId": "b4d850b9-494b-4de6-96c3-2951defae583",
    "filename": "bc_community_health_selected_indicators.csv",
    "originalFileId": "24577601-3509-4120-bf81-f2984294a632",
    "sha256": "5d94d79209f28905f5052d1e326a87dd7dd884dca5404e2954e22870cf87d0d3",
    "sourceRelativePath": "Data Research/Data/processed/public_pull_2026-04-29/bc_community_health_selected_indicators.csv",
    "tables": [
      {
        "table_name": "nhhr_data_c016_be21dde25cba_zip_data_c016__3",
        "worksheet": "",
        "row_count": "653",
        "parquet_sha256": "0471c37cb9ba50f38f456e628c719d8e5129bf9c9ca7dc76be48ef0f15eb184e"
      }
    ]
  },
  "locations": {
    "collectionId": "DATA-C016",
    "datasetId": "b4d850b9-494b-4de6-96c3-2951defae583",
    "filename": "bc_community_health_locations.csv",
    "originalFileId": "f27627a4-745c-4a3f-aee1-c968ee5d0dd4",
    "sha256": "0ee79bd6dfdf5b7b1f283dbfe4b98f186a43a75a9bd4f9879cff2744ce2b3d5b",
    "sourceRelativePath": "Data Research/Data/processed/public_pull_2026-04-29/bc_community_health_locations.csv",
    "tables": [
      {
        "table_name": "nhhr_data_c016_be21dde25cba_zip_data_c016__2",
        "worksheet": "",
        "row_count": "309",
        "parquet_sha256": "fd190d66c7a4742e2c2ab0e2298b21cb0a6f6e25c3cb84c56993183ce4c98aa9"
      }
    ]
  },
  "indicatorInventory": {
    "collectionId": "DATA-C016",
    "datasetId": "b4d850b9-494b-4de6-96c3-2951defae583",
    "filename": "bc_community_health_indicator_inventory.csv",
    "originalFileId": "cb9e041c-0ece-4ef8-8242-cb4173e1be9f",
    "sha256": "32f503c262046e73506930d52d9f9d414ea4097321428168b4d6f2560ec9ca49",
    "sourceRelativePath": "Data Research/Data/processed/public_pull_2026-04-29/bc_community_health_indicator_inventory.csv",
    "tables": [
      {
        "table_name": "nhhr_data_c016_be21dde25cba_zip_data_c016_bc_com",
        "worksheet": "",
        "row_count": "832",
        "parquet_sha256": "f85cc42d4b887f49a6f8ef23401ed27409878e8335d45a5f821b51b931414ba5"
      }
    ]
  },
  "topics": {
    "collectionId": "DATA-C016",
    "datasetId": "b4d850b9-494b-4de6-96c3-2951defae583",
    "filename": "bc_community_health_topics.csv",
    "originalFileId": "22bec4ef-7ea0-4057-9146-299624b4ceb9",
    "sha256": "860b528a13a7e1dedcbe2658a8c6026a95f41935d345adef6aa8308db7e16726",
    "sourceRelativePath": "Data Research/Data/processed/public_pull_2026-04-29/bc_community_health_topics.csv",
    "tables": [
      {
        "table_name": "nhhr_data_c016_be21dde25cba_zip_data_c016__4",
        "worksheet": "",
        "row_count": "48",
        "parquet_sha256": "644a00d3dce8c008401862c633553b00129ae0b75a6ac68ec2a189ffc57357f0"
      }
    ]
  },
  "enrolment": {
    "collectionId": "DATA-X08",
    "datasetId": "43482dd7-5cee-417b-b339-a203a343d5ee",
    "filename": "nhhr_university_city_ratios (1).xlsx",
    "originalFileId": "16f272af-7c4d-4450-b4d0-f3a1348ac90e",
    "sha256": "48112d838bfa75c70dd965ca3c70086ed33b682ff616235510e06c3660ec0f9e",
    "sourceRelativePath": "Resources/nhhr_university_city_ratios (1).xlsx",
    "tables": [
      {
        "table_name": "nhhr_data_x08_e4993b5b0dfe_zip_data_x08_nhhr_uni",
        "worksheet": "University-City Ratios",
        "row_count": "31",
        "parquet_sha256": "627948938b87178a44d19ed83810e070d6d4e378b372b20cf0482c7bc5e31e97"
      },
      {
        "table_name": "nhhr_data_x08_e4993b5b0dfe_zip_data_x08_nh_2",
        "worksheet": "Source Links",
        "row_count": "14",
        "parquet_sha256": "36fb561f6352a8ac994b74b2625bd6cf091afce7550973925be6db662bfeb71c"
      }
    ]
  }
}''')
ENROLMENT_VERIFICATION=json.loads(r'''{
  "sourceUrl": "https://univcan.ca/about-universities-canada/facts-and-stats/enrolment-by-university/",
  "sourceTitle": "Fall 2025 full-time and part-time fall enrolment at Canadian universities",
  "reviewedAt": "2026-10-12",
  "retrievalMethod": "Primary page read through web tool; direct command-line request returned HTTP403 and was not bypassed.",
  "recordColumns": [
    "Full-time Undergrad",
    "Full-time Graduate",
    "Part-time Undergrad",
    "Part-time Graduate"
  ],
  "records": [
    {
      "comparator": "Calgary / Calgary",
      "source_institution": "University of Calgary",
      "components": [
        29640,
        6236,
        1198,
        1039
      ]
    },
    {
      "comparator": "Dalhousie / Halifax",
      "source_institution": "Dalhousie University",
      "components": [
        14934,
        3964,
        1642,
        709
      ]
    },
    {
      "comparator": "Lakehead / Thunder Bay",
      "source_institution": "Lakehead University",
      "components": [
        6039,
        1527,
        905,
        28
      ]
    },
    {
      "comparator": "UBC / Vancouver",
      "source_institution": "The University of British Columbia",
      "components": [
        46700,
        11181,
        14359,
        1396
      ]
    },
    {
      "comparator": "UNBC / Prince George",
      "source_institution": "University of Northern British Columbia",
      "components": [
        2303,
        567,
        329,
        64
      ]
    },
    {
      "comparator": "USask / Saskatoon",
      "source_institution": "University of Saskatchewan",
      "components": [
        18087,
        3123,
        1576,
        474
      ]
    },
    {
      "comparator": "McMaster / Hamilton",
      "source_institution": "McMaster University",
      "components": [
        30796,
        4763,
        1140,
        880
      ]
    }
  ],
  "selectedRecordsSha256": "5a4a3d01bb51ffc3a5cb7be673857def3c19f302e29fb04b8f82f046db0f39fc"
}''')
NS={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
REL_NS='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
AGES=['17 to 29','30 to 44','45 to 64']
INCIDENCE='Diabetes Mellitus age-standardized incidence rate per 1000 population (1+ yrs)'
PREVALENCE='Diabetes Mellitus age-standardized lifetime prevalence rate per 1000 population (1+ yrs)'


def require(ok,message):
    if not ok:raise ValueError(message)

def get(url,headers):
    with urlopen(Request(url,headers=headers),timeout=60) as r:return r.read()

def refresh(input_root,headers):
    m=json.loads(get(MANIFEST,headers));require(m.get('revision')==93,'Manifest version changed; review before refresh')
    available={x['id'] for x in m['resources'] if x.get('kind')=='dataset' and x.get('available')}
    ids={s['datasetId'] for s in SOURCES.values()};require(ids<=available,'Reviewed source missing from authorized manifest')
    for ident in sorted(ids):
        d=json.loads(get(BASE+'/api/datasets/'+ident,headers))['dataset'];require(d['id']==ident and d['status']=='ready','Dataset identity/status changed')
    cat=next(x for x in m['manifestSources'] if x.get('role')=='manifest');catalog={}
    for name in ['NHHR_files.csv','NHHR_tables.csv']:
        f=next(x for x in cat['files'] if x['name']==name);catalog[name]=list(csv.DictReader(io.StringIO(get(BASE+f['url'],headers).decode('utf-8-sig'))))
    for s in SOURCES.values():
        matches=[x for x in catalog['NHHR_files.csv'] if x['dataset_id']==s['datasetId'] and s['originalFileId'] in x['original_file_ids'].split(';')]
        require(any(x['sha256']==s['sha256'] for x in matches),'Original file identity/hash changed')
        for t in s['tables']:
            matches=[x for x in catalog['NHHR_tables.csv'] if x['dataset_id']==s['datasetId'] and x['table_name']==t['table_name']]
            require(len(matches)==1 and matches[0]['source_sha256']==s['sha256'] and all(matches[0][k]==t[k] for k in ['worksheet','row_count','parquet_sha256']),'Scientific table lineage changed')
        raw=get(BASE+'/api/files/'+s['originalFileId']+'/download',headers);require(hashlib.sha256(raw).hexdigest()==s['sha256'],'Downloaded original hash mismatch')
        p=input_root/s['collectionId']/s['filename'];p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(raw)

def read(input_root,key):
    s=SOURCES[key];raw=(input_root/s['collectionId']/s['filename']).read_bytes();require(hashlib.sha256(raw).hexdigest()==s['sha256'],'Original source changed: '+s['filename']);return raw

def book(raw,names):
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        ss=[''.join(t.text or '' for t in x.findall('.//m:t',NS)) for x in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si',NS)] if 'xl/sharedStrings.xml' in z.namelist() else []
        rel={x.attrib['Id']:x.attrib['Target'] for x in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))};result={}
        for s in ET.fromstring(z.read('xl/workbook.xml')).findall('m:sheets/m:sheet',NS):
            name=s.attrib['name']
            if name not in names:continue
            target=rel[s.attrib['{'+REL_NS+'}id']];part=target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/'+target);require(part.startswith('xl/'),'Unexpected worksheet path')
            rows={}
            for r in ET.fromstring(z.read(part)).findall('m:sheetData/m:row',NS):
                vals={};formulas=[]
                for c in r.findall('m:c',NS):
                    col=re.match(r'[A-Z]+',c.attrib['r']).group();v=c.find('m:v',NS)
                    if c.get('t')=='s' and v is not None:literal=ss[int(v.text)]
                    elif c.get('t')=='inlineStr':literal=''.join(t.text or '' for t in c.findall('.//m:t',NS))
                    else:literal=v.text if v is not None else ''
                    if literal:vals[col]=literal
                    if c.find('m:f',NS) is not None:formulas.append(col)
                if vals:rows[int(r.attrib['r'])]={'values':vals,'formulas':formulas}
            result[name]={'part':part,'rows':rows}
        require(set(result)==set(names),'Required original worksheet missing');return result

def num(raw,count=False):
    raw=raw or ''
    markers={'':'Not reported','—':'Not reported (source marker)','N/A':'Not applicable/unavailable','NA':'Not applicable/unavailable','X':'Suppressed','F':'Unreliable'}
    if raw in markers:return None,markers[raw]
    require(re.fullmatch(r'\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?',raw) is not None,'Unreviewed numeric or suppression token')
    n=Decimal(raw);require(n.is_finite() and n>=0,'Invalid source value')
    if count:require(n==n.to_integral_value(),'Nonintegral projected count')
    return (int(n) if n==n.to_integral_value() else float(n)),'Reported'

def period(raw):
    m=re.fullmatch(r'(\d{4})/(\d{2}|\d{4})',raw) or re.fullmatch(r'FY (\d{4})\.(\d{4})',raw)
    require(m is not None,'Unreviewed original period label');start=int(m[1]);end=int(m[2]);end=start//100*100+end if end<100 else end
    require(end==start+1,'Original period is not one year');return f'{start}–{end}'

def col(key,label,numeric=False,unit=None):
    d={'key':key,'label':label,'type':'number' if numeric else 'text'}
    if unit:d['unit']=unit
    return d

def ds(id,title,description,s,rows,columns,metric,entity,time,status='observed',filters=None):
    return {'id':id,'title':title,'description':description,'topic':'Education and community context','geography':'none','status':status,'timeLabel':'','sourceName':'','sourceUrl':'','datasetId':s['datasetId'],'tableName':'; '.join(t['table_name'] for t in s['tables']),'notes':[],'columns':columns,'rows':rows,'defaultMetric':metric,'entityField':entity,'timeField':time,**({'defaultFilters':filters} if filters else {})}

def prepare(input_root):
    datasets=[];bindings=[];quality=[]
    p=book(read(input_root,'pssm'),['User Guide','Graduate Projections','Occupation Projections'])
    guide={n:r['values'].get('A','') for n,r in p['User Guide']['rows'].items()}
    require(guide[2]=='Prepared by BC Stats, December 20, 2024','Projection source vintage changed')
    require('rounded to the nearest 5' in guide[7] and 'rounded to the nearest whole number' in guide[7],'Projection rounding definitions changed')
    require('International students' in guide[3] and '2019 to 2023 survey years' in guide[4],'Projection universe/method changed')
    g=[];occ=[]
    for sheet,columns,output in [('Graduate Projections','CDEFGHIJKLMN',g),('Occupation Projections','DEFGHIJKLMNO',occ)]:
        grid=p[sheet]['rows'];head=grid[1]['values'];require(head.get('A')=='Age Group','Age header changed')
        periods=[head[c] for c in columns];require([period(x) for x in periods]==[f'{y}–{y+1}' for y in range(2023,2035)],'Projection source periods changed')
        require(head.get('B')==('Credential Type' if sheet=='Graduate Projections' else 'NOC 2021'),'Projection dimension changed')
        for nr,item in grid.items():
            if nr==1:continue
            row=item['values']
            if sheet=='Occupation Projections' and not re.fullmatch(r'3\d{4}',row.get('B','')):continue
            require(row.get('A') in AGES,'Unknown source age group')
            for c,original in zip(columns,periods):
                require(c not in item['formulas'],'Unexpected formula in original projected measure')
                raw=row.get(c,'');n,status=num(raw,count=True)
                if sheet=='Graduate Projections':
                    require(n is None or n%5==0,'Graduate nearest-five precision changed')
                    output.append({'age_group':row['A'],'credential_type':row['B'],'period':period(original),'original_period':original,'population_type':'Projection','projected_graduates':n,'source_raw':raw,'reporting_status':status,'model_prepared_date':'2024-12-20','geographic_scope':'British Columbia'})
                else:output.append({'age_group':row['A'],'noc_code':row['B'],'occupation':row['C'],'period':period(original),'original_period':original,'population_type':'Projection','projected_occupation_entries':n,'source_raw':raw,'reporting_status':status,'model_prepared_date':'2024-12-20','geographic_scope':'British Columbia'})
                bindings.append({'view':'bc-graduate-projections' if sheet=='Graduate Projections' else 'bc-health-occupation-projections','sourceKey':'pssm','sourceSheet':sheet,'cell':c+str(nr),'originalPeriod':original,'ageGroup':row['A'],'credentialOrNOC':row['B']})
    require(len(g)==468 and len({(r['age_group'],r['credential_type'],r['period']) for r in g})==468,'Graduate source grain changed')
    require(len(occ)==996 and len({(r['age_group'],r['noc_code'],r['period']) for r in occ})==996,'Occupation ragged source grain changed')
    require(sum(r['projected_graduates']==0 for r in g)==12 and sum(r['projected_occupation_entries']==0 for r in occ)==66,'Reported zero coverage changed')
    for age in AGES:
        for fy in sorted({r['period'] for r in g}):
            rows=[r for r in g if r['age_group']==age and r['period']==fy];total=next(r['projected_graduates'] for r in rows if r['credential_type']=='Total');parts=[r['projected_graduates'] for r in rows if r['credential_type']!='Total']
            require(all(x is not None for x in parts) and total is not None,'Graduate total components missing')
            require(abs(total-sum(parts))<=2.5*(len(parts)+1),'Graduate total inconsistent with stated rounding')
    common=[col('age_group','Age group'),col('period','Fiscal period'),col('original_period','Original fiscal label'),col('population_type','Source measure type'),col('source_raw','Original measure literal'),col('reporting_status','Reporting status'),col('model_prepared_date','Model prepared'),col('geographic_scope','Geographic scope')]
    graduate=ds('bc-graduate-projections','BC graduate supply projections','Published provincial projections by age and credential, preserving the original model vintage and rounded counts.',SOURCES['pssm'],g,[col('credential_type','Credential type'),col('projected_graduates','Projected graduates',True,'projected graduates'),*common],'projected_graduates','credential_type','period','projection',{'age_group':'17 to 29','credential_type':'Baccalaureate degree'})
    graduate['timeLabel']='FY 2023–2024 through FY 2034–2035 · model prepared 20 December 2024';graduate['sourceName']='BC Stats Post-Secondary Supply Model';graduate['sourceUrl']=PSSM_URL
    graduate['notes']=[
        'All values retain the source Projection label, including fiscal periods that have elapsed. The model was prepared on 20 December 2024; these are not observed graduating classes or current administrative counts.',
        'Graduate projections are rounded to five. Original fiscal labels such as 2023/2024 remain in the records; the display period uses 2023–2024 without changing its duration.',
        'The model covers ages 17–29, 30–44 and 45–64 and credentials taking at least three months. International students, non-credit and skills-upgrading programs are excluded. Selected certificate/diploma credentials at public research universities and Royal Roads are excluded; apprenticeship projections also include private institutions.',
        'Select one age group and credential before comparing periods. Total overlaps its credential components, and published rounding can prevent exact sums. No unreported combinations are created as zeros.',
        'Provincial projections are not UNBC graduates, Northern staffing, current vacancies, available trial staff or an NHHR effect. They cannot be allocated to campuses, municipalities or health areas.',
    ];datasets.append(graduate)
    occupational=ds('bc-health-occupation-projections','BC health-occupation supply projections','Published projected labour-market entry by age and original NOC 2021 occupation, using the health-major-group records actually present in the source.',SOURCES['pssm'],occ,[col('occupation','Original occupation'),col('noc_code','NOC 2021 code'),col('projected_occupation_entries','Projected occupation entrants',True,'projected entrants'),*common],'projected_occupation_entries','occupation','period','projection',{'age_group':'17 to 29','occupation':'Registered nurses and registered psychiatric nurses'})
    occupational['timeLabel']=graduate['timeLabel'];occupational['sourceName']=graduate['sourceName'];occupational['sourceUrl']=PSSM_URL
    occupational['notes']=[
        'Projected entrants are distinct from projected graduates and from registered or employed professionals. The source uses weighted 2019–2023 Student Outcomes surveys to estimate subsequent labour-market entry and occupations.',
        'The selected NOC 2021 major group 3 includes health managers, human-health occupations and veterinary/animal-health occupations. The original categories remain separate; default views focus on registered nurses/RPNs.',
        'Original occupation fiscal labels such as 2023/24 are preserved alongside normalized 2023–2024 display periods. Counts are rounded to whole numbers. Reported zeros remain zero; omitted age/NOC combinations remain absent.',
        'The model covers graduates residing in BC and includes specified near completers; substantially complete means at least 24 credits. International students and non-credit/skills-upgrading programs are excluded, and apprenticeship projections include private institutions.',
        'Select one occupation and age group. These province-level projections do not establish future Northern jobs, workforce shortages, recruitment eligibility or available NHHR staff, and cannot be spread across health areas.',
    ];datasets.append(occupational)

    source=list(csv.DictReader(io.StringIO(read(input_root,'indicators').decode('utf-8-sig'))));require(len(source)==653,'Community source row count changed')
    locations=list(csv.DictReader(io.StringIO(read(input_root,'locations').decode('utf-8-sig'))));inventory=list(csv.DictReader(io.StringIO(read(input_root,'indicatorInventory').decode('utf-8-sig'))));topics=list(csv.DictReader(io.StringIO(read(input_root,'topics').decode('utf-8-sig'))))
    require(len(locations)==309 and len(inventory)==832 and len(topics)==48,'Community catalogue metadata changed')
    require(not any(r['requested_location_type']=='CHSA' and r['Value'] for r in source),'New CHSA scientific values require separate geography/method review')
    inc=[];prev=[]
    for nr,r in enumerate(source,start=2):
        if r['requested_topic']!='General Health' or not r['Year(s)'].startswith('FY '):continue
        require(r['requested_location_type']=='HA' and r['requested_location_id']=='5' and r['requested_location_name']=='Northern HA' and r['Jurisdiction Name']=='Northern HA','Scientific jurisdiction differs from reviewed Northern HA grain')
        require(r['Data Source']=='BC Chronic Disease Registry' and r['Unit']=='Per 1000 population','Clinical source or unit changed')
        indicator=r['Indicator'];kind='incidence' if ' incidence rate ' in indicator else 'prevalence' if ' lifetime prevalence rate ' in indicator else None;require(kind is not None and 'age-standardized' in indicator,'Unreviewed disease definition')
        require(r['Sex'] in {'Total','Female','Male'},'Unreviewed source sex label');value,status=num(r['Value'])
        row={'indicator':indicator,'jurisdiction_name':r['Jurisdiction Name'],'source_location_type':r['requested_location_type'],'source_location_id':r['requested_location_id'],'sex':r['Sex'],'period':period(r['Year(s)']),'original_period':r['Year(s)'],'measure_kind':'Age-standardized incidence' if kind=='incidence' else 'Age-standardized lifetime prevalence','rate_per_1000':value,'source_raw':r['Value'],'source_unit':r['Unit'],'data_source':r['Data Source'],'reporting_status':status}
        (inc if kind=='incidence' else prev).append(row);bindings.append({'view':'community-disease-'+kind,'sourceKey':'indicators','sourceCSVRow':nr,'indicator':indicator,'sex':r['Sex'],'originalPeriod':r['Year(s)'],'originalJurisdiction':r['Jurisdiction Name']})
    for kind,rows,default in [('incidence',inc,INCIDENCE),('prevalence',prev,PREVALENCE)]:
        require(len(rows)==240 and len({(r['indicator'],r['sex'],r['original_period'],r['jurisdiction_name']) for r in rows})==240,'Community disease grain changed')
        require(len({r['indicator'] for r in rows})==4 and len({r['period'] for r in rows})==20,'Disease dimension/period coverage changed')
        title='Northern HA disease incidence' if kind=='incidence' else 'Northern HA lifetime disease prevalence'
        d=ds('community-disease-'+kind,title,'Historical published age-standardized rates for Northern Health Authority. Incidence and lifetime prevalence retain their separate definitions and original age ranges.',SOURCES['indicators'],rows,[col('indicator','Original indicator'),col('jurisdiction_name','Source jurisdiction'),col('source_location_type','Original geography type'),col('source_location_id','Original geography ID'),col('sex','Source sex category'),col('period','Fiscal period'),col('original_period','Original period label'),col('measure_kind','Rate definition'),col('rate_per_1000','Age-standardized rate per 1,000',True,'per 1,000'),col('source_raw','Original rate literal'),col('source_unit','Original unit'),col('data_source','Original data source'),col('reporting_status','Reporting status')],'rate_per_1000','indicator','period',filters={'indicator':default,'sex':'Total'})
        d['geography']='ha';d['boundaryKeyField']='source_location_id';d['mapLabelField']='jurisdiction_name';d['mapScaleFields']=['indicator','sex'];d['timeLabel']='Northern HA · FY 2001–2002 through FY 2020–2021 · collected 29 April 2026';d['sourceName']='BC Chronic Disease Registry via BC Community Health Data';d['sourceUrl']=HEALTH_URL
        d['notes']=[
            'Every released scientific row identifies Northern HA, geography type HA and ID 5. The collected location catalogue includes CHSAs, but the selected-indicator original contains no CHSA measurements. No HA aggregate is spread across CHSAs, LHAs or facilities.',
            'The optional map joins exact source HA ID 5 to the contemporary PGMaps Northern HA context polygon. Its historical boundary vintage is unverified; no harmonized FY2001–2021 geometry is claimed. Select one indicator, sex and fiscal period; ambiguous values are withheld rather than summed.',
            'The source fiscal labels FY 2001.2002 through FY 2020.2021 are retained. A separately normalized 2001–2002 display field identifies the same fiscal period. The April 2026 collection date does not make the values current.',
            'Rates are published age-standardized administrative-registry measures per 1,000, rather than raw case counts, crude resident percentages or self-reported survey prevalence. No case count is inferred by multiplying a rate by the Atlas population projection.',
            'Asthma/diabetes use ages 1+, COPD ages 35+, and hypertension ages 20+. Different age universes and indicator definitions limit cross-condition rankings. The source sex labels Total, Female and Male remain unchanged.',
            'Incidence and lifetime prevalence are separate measures. Do not combine them, add condition rates, or interpret Total plus female/male rates as an additive cohort. The source standardization population, confidence intervals and detailed ascertainment notes are not present in this collected CSV.',
            'Older calendar-year/age-definition series and heterogeneous demographic headings are excluded from this fiscal extract rather than joined by name. These rates do not establish current unmet need, trial eligibility, causal changes or an NHHR effect.',
        ];datasets.append(d)

    x=book(read(input_root,'enrolment'),['University-City Ratios','Source Links']);grid=x['University-City Ratios']['rows'];require('Fall 2025' in grid[2]['values']['A'],'Enrolment source vintage changed')
    require('all-campus' in grid[32]['values']['A'] and 'NOSM University' in grid[31]['values']['A'],'Campus/group caveat changed')
    pairs={'Calgary / Calgary':22,'Dalhousie / Halifax':9,'Lakehead / Thunder Bay':17,'UBC / Vancouver':5,'UNBC / Prince George':23,'USask / Saskatoon':8,'McMaster / Hamilton':10}
    campus_labels={r['comparator'] for r in json.loads((ROOT/'src/atlas/institutionLocations.json').read_text())};require(set(pairs)<=campus_labels,'Reviewed institution display crosswalk changed')
    records=ENROLMENT_VERIFICATION['records'];require(hashlib.sha256(json.dumps(records,sort_keys=True,ensure_ascii=False).encode()).hexdigest()==ENROLMENT_VERIFICATION['selectedRecordsSha256'],'External verification receipt changed')
    enrolment=[]
    for record in records:
        comparator=record['comparator'];nr=pairs[comparator];original=grid[nr]['values'];components=record['components'];require(len(components)==4 and all(isinstance(v,int) and v>=0 for v in components),'Primary enrolment components missing')
        total=sum(components);workbook_total,status=num(original['D'],count=True)
        if comparator=='Lakehead / Thunder Bay':require(workbook_total==9035 and total==8499 and 'NOSM' in original['B'],'Original composite differs unexpectedly')
        else:require(total==workbook_total,'Original institution enrolment differs from primary verification')
        enrolment.append({'comparator':comparator,'source_institution':record['source_institution'],'academic_year':'2025','source_period':'Fall 2025','full_time_undergraduate':components[0],'full_time_graduate':components[1],'part_time_undergraduate':components[2],'part_time_graduate':components[3],'total_enrolment':total,'enrolment_scope':'Published institution total; campus allocation unestablished','verification_note':'Lakehead-only primary record; original workbook combines Lakehead + NOSM' if comparator=='Lakehead / Thunder Bay' else 'Original institutional total reconciles with the primary Fall 2025 table'})
        bindings.append({'view':'institution-enrolment','sourceKey':'enrolment','sourceWorkbookRow':nr,'originalAnchor':original['B'],'originalEnrolmentLiteral':original['D'],'primaryInstitution':record['source_institution'],'primaryComponents':components,'primaryVerifiedTotal':total,'ratiosEmitted':False})
    require(len(enrolment)==7,'Verified institution coverage changed')
    e=ds('institution-enrolment','Institutional enrolment context','Seven published Fall 2025 institution totals independently reconciled to the collected workbook, keeping institutional scope separate from city population.',SOURCES['enrolment'],enrolment,[col('comparator','Reviewed comparator'),col('source_institution','Original published institution'),col('academic_year','Year'),col('source_period','Published period'),col('full_time_undergraduate','Full-time undergraduate enrolment',True,'enrolments'),col('full_time_graduate','Full-time graduate enrolment',True,'enrolments'),col('part_time_undergraduate','Part-time undergraduate enrolment',True,'enrolments'),col('part_time_graduate','Part-time graduate enrolment',True,'enrolments'),col('total_enrolment','Published category total',True,'enrolments'),col('enrolment_scope','Institution/campus scope'),col('verification_note','Verification note')],'total_enrolment','comparator','academic_year');e['geography']='institution';e['sourceName']='Universities Canada Fall 2025 institutional table';e['sourceUrl']=ENROLMENT_VERIFICATION['sourceUrl'];e['timeLabel']='Fall 2025 · primary source checked 12 October 2026'
    e['notes']=[
        'Totals sum four published full-/part-time undergraduate/graduate categories. They are institutional counts, not FTEs, graduates, local residents or available health researchers.',
        'The original Thunder Bay row combines Lakehead with an approximate NOSM contribution. This release uses the independently published Lakehead-only record. NOSM is absent rather than zero.',
        'UBC remains institution-wide, including its source scope; no all-campus count is relabelled Vancouver-campus enrolment. Representative campus points locate comparator institutions and do not allocate counts to a city, health area or building.',
        'The workbook city ratios are held: campus allocation and compatible populations are not established. Fall 2025 enrolment is not divided by 2021 municipal population to imply a resident student percentage.',
        'Primary verification was a dated browser read. Direct command-line access returned HTTP403; the preparation script retains the reviewed receipt and does not claim to refresh that external page.',
    ];datasets.append(e)
    require(sum(len(d['rows']) for d in datasets)==1951,'Bounded follow-up row count changed')
    release={'snapshot':{'reviewedAt':REVIEWED,'manifestUrl':MANIFEST,'sourceVersion':'NHHR manifest revision 93; follow-up scientific review 12 October 2026','scope':'Five source views / 1,951 rows at overlapping projection, administrative-rate and institutional grains; not unique people.'},'datasets':datasets}
    provenance={'reviewedAt':REVIEWED,'manifestUrl':MANIFEST,'sources':SOURCES,'sourceBindings':bindings,'enrolmentVerification':ENROLMENT_VERIFICATION,'sourceGuideEvidence':{'worksheet':'User Guide','preparedDateCell':'A2','preparedDate':'2024-12-20','scopeCells':['A3','A5','A6'],'surveyPeriodCell':'A4','surveyYears':'2019–2023','roundingCell':'A7','graduateRounding':5,'occupationRounding':1},'releaseCounts':{d['id']:len(d['rows']) for d in datasets},'quality':{'graduateZeros':12,'occupationZeros':66,'omittedAgeNOCCellsFilled':0,'communitySelectedRawRows':653,'communityFiscalRowsReleased':480,'communityCHSAScientificRows':0,'cityRatiosEmitted':0,'NOSMEnrolmentInferred':False},'methods':{'periods':'Original fiscal strings retained; normalized display periods do not change duration.','projections':'Original age/credential or age/NOC cell literals, preserving nearest-five/whole-number rounding.','disease':'Direct original Northern HA fiscal rows, with exact sex/indicator/source/unit checks; no rate recomputation.','enrolment':'Original institution totals reconciled to seven primary Fall 2025 category sums; Lakehead composite separated using independently published institution-only record.'},'limits':['Provincial projections cannot be allocated to UNBC, northern communities or health areas.','Northern HA rates cannot be allocated to CHSAs; the locations inventory is metadata only.','Institutional totals cannot establish compatible campus/city populations; ratios stay held.','Existing unrelated C016/C049 funding, cancer, event and directory releases are not replaced.']}
    return release,provenance

def save(path,value,check):
    content=(json.dumps(value,ensure_ascii=False,indent=2)+'\n').encode()
    if check:require(path.exists() and path.read_bytes()==content,'Generated output differs: '+str(path.relative_to(ROOT)))
    else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(content)

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--input',required=True,type=Path);p.add_argument('--refresh',action='store_true');p.add_argument('--headers-file',type=Path);p.add_argument('--check',action='store_true');a=p.parse_args()
    if a.refresh:
        headers=json.loads(a.headers_file.read_text()) if a.headers_file else {};require(isinstance(headers,dict) and all(isinstance(k,str) and isinstance(v,str) for k,v in headers.items()),'Headers must be private string map');refresh(a.input,headers)
    release,provenance=prepare(a.input);save(ROOT/'src/atlas/snapshots/community-followup.json',release,a.check);save(ROOT/'public/data/nhhr/community-followup.json',release,a.check);save(ROOT/'public/data/nhhr/community-followup-provenance.json',provenance,a.check)
    print(('Verified' if a.check else 'Prepared')+' 5 community/education views / 1,951 rows; source hashes, periods, rounding and original geographic scope checked.')
if __name__=='__main__':main()
