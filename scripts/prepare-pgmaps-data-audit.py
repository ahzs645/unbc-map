#!/usr/bin/env python3
"""Publish the bounded PGMaps classification, not the scientific source datasets.

Agent review fragments retain exact inspected-file hashes and review scope.
This merger preserves direct-copy/candidate/source-equivalent use distinctions.
Remote/catalogue-only references are never promoted to verified map-ready data.
"""
from pathlib import Path
import argparse,collections,hashlib,json
ROOT=Path(__file__).resolve().parents[1]
SOURCES=[('health','docs/pgmaps-health-audit.json','Health and access'),('geography','docs/pgmaps-geography-audit.json','Geography and population'),('environment','docs/pgmaps-environment-audit.json','Environment and other context')]

def texts(value,prefix=''):
    if value is None:return []
    if isinstance(value,bool):return [prefix+('yes' if value else 'no')]
    if isinstance(value,str):return [prefix+value] if value else []
    if isinstance(value,list):return [s for item in value for s in texts(item,prefix)]
    if isinstance(value,dict):return [s for key,item in value.items() for s in texts(item,prefix+key.replace('_',' ') + ': ')]
    return [prefix+str(value)]

def publish(check):
    entries=[];receipts=[];full=[];inventory=None
    for key,path,category in SOURCES:
        raw=(ROOT/path).read_bytes();x=json.loads(raw);receipts.append({'review':path,'sha256':hashlib.sha256(raw).hexdigest(),'scope':x.get('scope')})
        records=x.get('families',x.get('records',x.get('entries',[])))
        for f in records:
            title=f.get('label',f.get('title',f['id']))
            title=title.replace('Water facilities,advisories andlaboratorysample containers','Water facilities, advisories and laboratory sample containers')
            scope=f.get('verificationScope') or ' '.join(texts(f.get('availability'))) or 'Family metadata, file evidence and selected schemas inspected; individual rows and coordinates are not all independently verified.'
            usage=f.get('nhhrUsage',f.get('atlasUsageEvidence'))
            use=' '.join(texts(f.get('reuseMode'))) or ('No current NHHR use established.' if usage is False else ' '.join(texts(usage)))
            map_value=f.get('canMapNow',f.get('mapNow'))
            map_support=(["Compatible source geometry exists; the adapter and interpretation requirements are listed below."] if map_value else ["No direct compatible map was verified in this review."]) if isinstance(map_value,bool) else texts(map_value)
            entry={'id':key+'-'+f['id'],'title':title,'category':category,'status':f.get('usageStatus',f.get('status','unused')),'grain':f.get('grain','See inspected source metadata'),'geometry':f.get('geometry','Not established'),'vintage':f.get('dateAndVintage',f.get('vintage','Not established')),'rights':f.get('licenseAndRights',f.get('licensing',f.get('rights','Source terms require review'))),'mapNow':map_support,'missing':texts(f.get('missing')),'cannot':texts(f.get('cannotInfer',f.get('cannot'))),'next':f.get('recommendedAdapterOrJoin',f.get('nextConcreteAdapter',f.get('next','Review the named source before mapping'))),'sourcePaths':f.get('sourcePaths',[]),'verificationScope':scope,'reuseEvidence':use,'priority':f.get('priority','Review'),'datasets':f.get('datasets',[])}
            assert entry['status'] in {'used','partial','unused','source-only','unavailable'},entry['id']
            assert entry['sourcePaths'] and entry['mapNow'] and entry['cannot'],entry['id']
            entries.append(entry)
        full.append({'area':category,'reviewScope':x.get('scope'),'records':records,'fileEvidence':x.get('fileEvidence',x.get('inspectedFileEvidence',[]))})
        if key=='environment':inventory=x.get('inventory')
    assert len(entries)==77 and len({e['id'] for e in entries})==77
    obj={'schema':'nhhr-pgmaps-data-audit-v1','reviewedAt':'2026-10-12','scope':'77 family/dataset entries reviewed against the current NHHR implementation. Inventory covers 46 public data directories, nine top-level data files and 96 sync mappings. Detailed checks and catalogue-only limits are stated per entry; this is not a claim that every remote dataset, coordinate or scientific row has been validated.','statusMeaning':{'used':'Selected data family is already represented. Read reuse evidence to distinguish direct assets from source-equivalent Zoer data.','partial':'Selected assets or candidate identities are used; the rest of the family is not imported.','unused':'Available or referenced data has no NHHR release yet; mapping, source and rights requirements remain.','source-only':'Source/code/catalogue exists but no compatible reviewed deployable NHHR release is ready.','unavailable':'Required local source/output/method is absent or unverified in this checkout.'},'counts':dict(collections.Counter(e['status'] for e in entries)),'entries':entries,'inventory':inventory,'reviewReceipts':receipts,'detailedReviews':full}
    md=['# PGMaps data use and mapping gaps','',obj['scope'],'','The source checkout was read only. Scraper-owned snapshots remain in `vendor/bcdatamapper`; generated `public/data` copies were not altered. Existing UNBC design is retained.','', 'Usage describes the selected data family and must be read alongside its reuse evidence. A family represented through Zoer is not proof that its entire PGMaps artifact was imported. Points are not automatically verified facilities; a compatible geometry does not establish a valid analytical join or permission to redistribute data.','', '## Classification','', '| Status | Entries |','| --- | ---: |']
    md += [f'| {k} | {v} |' for k,v in sorted(obj['counts'].items())]
    md += ['', 'These are review entries, including families and individual datasets; overlapping products and duplicate source copies are not independent measurements.', '', '## Practical next additions','', '- Reviewed immunization-service points and facility-specific procedure waits have usable source geography; retain their own dates, definitions and suppressed values.', '- Census DA/CT/CSD variables and the health-area bridge offer geographic joins, with native codes, source vintage, missing parents and valid weighting checked first.', '- PG transit/walkability products can supply dated modeled access context; they do not establish patient travel, current schedules or clinical access.', '- Environmental components can provide context after source/reconstruction flags and native polygon/grid handling are reviewed. They do not establish individual exposure or cause health outcomes.', '', '## Missing mapping methods','', 'The Atlas currently registers health polygons and reviewed institution/city/facility/stop points. Generic arbitrary geometry, other native administrative keys, PMTiles/H3/native grids and valid area/population-weighted aggregation need explicit adapters; the presence of those files does not add those methods automatically.', '', '## Reviewed entries','']
    for e in entries:
        md += [f"### {e['title']}",'',f"**{e['category']} · {e['status']}**",'',f"Grain: {e['grain']}",f"Geometry: {e['geometry']}",f"Vintage: {e['vintage']}",f"Source terms: {e['rights']}",'', 'Map support:', ''] + ['- '+s for s in e['mapNow']]
        md += ['', 'Missing or required:', '']+(['- '+s for s in e['missing']] or ['- No additional requirement identified for the existing use.'])
        md += ['', 'Cannot infer:', '']+['- '+s for s in e['cannot']]
        md += ['', 'Next connection: '+e['next'],'','Reuse evidence: '+(e['reuseEvidence'] or 'No current NHHR use established.'),'','Verification scope: '+e['verificationScope'],'', 'PGMaps source paths:', '']+['- `'+p+'`' for p in e['sourcePaths']]+['']
    outputs={'public/data/nhhr/pgmaps-data-audit.json':json.dumps(obj,ensure_ascii=False,indent=2)+'\n','public/data/nhhr/pgmaps-data-audit.md':'\n'.join(md).rstrip()+'\n','docs/pgmaps-data-audit.md':'\n'.join(md).rstrip()+'\n'}
    for path,content in outputs.items():
        p=ROOT/path
        if check:assert p.read_text()==content,'Audit output drift: '+path
        else:p.write_text(content)
    print(f"PGMaps audit: {len(entries)} entries; "+str(obj['counts']))
if __name__=='__main__':
    args=argparse.ArgumentParser();args.add_argument('--check',action='store_true');publish(args.parse_args().check)
