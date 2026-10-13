#!/usr/bin/env python3
"""Release the reviewed NHHR historical transport events and schematic connections.

python3 scripts/prepare-nhhr-travel-network.py --input /private/nhhr-travel-review
python3 scripts/prepare-nhhr-travel-network.py --input /private/nhhr-travel-review --check
python3 scripts/prepare-nhhr-travel-network.py --input /private/refresh --refresh --check

Inputs are original bc_patient_travel.db and nh_connections_schedule.csv. The
manifest identifies datasets, while actual original files supply event records.
Reviewed coordinates/aliases are pinned in nhhr-travel-stop-review.json. Refresh
checks original hashes and does not silently replace reviewed geography. Optional
--headers-file holds private authorized request headers and is never published.
"""
from __future__ import annotations
import argparse,collections,csv,hashlib,json,math,pathlib,re,sqlite3,unicodedata,urllib.request

ROOT=pathlib.Path(__file__).resolve().parents[1]
REVIEW_PATH=ROOT/'scripts/nhhr-travel-stop-review.json'
REVIEW=json.loads(REVIEW_PATH.read_text())
HOST='https://zoer.k8s.overtheedgepaper.ca'
MANIFEST=HOST+'/api/projects/acdd692f-a188-4f85-bb5a-83c48d5c7e82/database/data-spaces/de1fe530-a762-52fa-ba11-d01cc5b344df/manifest'
FIELDS=['id','route_slug','direction','seq','stop_event','stop_time','source_url','scraped_at']


def normalize(value):
    return re.sub(r'\s+',' ',unicodedata.normalize('NFKC',value).strip()).casefold()


def event_label(value):
    m=re.match(r'^(Arrive/Depart|Arrive|Depart):\s*(.*)$',value.replace('\u00a0',' '))
    return (m.group(1),m.group(2).strip()) if m else ('Unclassified event',value.strip())


def read_source(input_dir):
    for source in REVIEW['sources']:
        path=input_dir/source['filename']
        if hashlib.sha256(path.read_bytes()).hexdigest()!=source['sha256']:
            raise ValueError('Original source hash changed: '+source['filename'])
    with (input_dir/'nh_connections_schedule.csv').open(encoding='utf-8-sig',newline='') as handle:
        reader=csv.DictReader(handle)
        if reader.fieldnames!=FIELDS:
            raise ValueError('Schedule source schema changed')
        rows=list(reader)
    db=sqlite3.connect('file:'+str((input_dir/'bc_patient_travel.db').resolve())+'?mode=ro',uri=True)
    db.row_factory=sqlite3.Row
    database_rows=[{k:str(r[k]) for k in FIELDS} for r in db.execute('select * from nh_connections_schedule order by id')]
    db.close()
    if rows!=database_rows or len(rows)!=286:
        raise ValueError('CSV and SQLite must match all 286 original events exactly')
    if len({r['id'] for r in rows})!=286:
        raise ValueError('Event source IDs must be unique')
    return rows


def validate_review(rows):
    aliases=REVIEW['aliases'];locations={x['code']:x for x in REVIEW['locations']}
    source_aliases={normalize(event_label(r['stop_event'])[1]) for r in rows}
    if source_aliases!=set(aliases):
        raise ValueError('Every source stop label requires one explicit reviewed alias; unexpected aliases forbidden')
    used={a['locationCode'] for a in aliases.values() if a['locationCode'] is not None}
    if used!=set(locations):
        raise ValueError('Reviewed locations must be precisely the mapped alias locations')
    for code,location in locations.items():
        coordinate=location['coordinates'];proof=REVIEW['coordinateEvidence'][code]
        if len(coordinate)!=2 or not all(isinstance(v,(int,float)) and math.isfinite(v) for v in coordinate):
            raise ValueError('Invalid point coordinate')
        if not(-132<coordinate[0]<-114 and 48<coordinate[1]<61):
            raise ValueError('Point must lie in the reviewed BC source extent')
        if coordinate!=proof['returnedCoordinates']:
            raise ValueError('Coordinate differs from independently returned reviewed source point/feature centre')
        if location['coordinateSourceUrl']!=proof['coordinateSourceUrl']:
            raise ValueError('Coordinate citation differs from reviewed evidence')
        if location['locationPrecision'] not in {'town','facility'}:
            raise ValueError('Unsupported location precision')
        if location['locationPrecision']=='town' and proof.get('matchPrecision')!='LOCALITY':
            raise ValueError('Town representative must be a returned locality point')
    return locations


def column(key,label,numeric=False,unit=None):
    item=dict(key=key,label=label,type='number' if numeric else 'text')
    if unit:item['unit']=unit
    return item


def build(rows,locations):
    events=[]
    for r in rows:
        action,label=event_label(r['stop_event']);alias=REVIEW['aliases'][normalize(label)]
        events.append(dict(event_id='nhc-event-'+str(int(r['id'])).zfill(4),stop_name=alias['stopName'],route_slug=r['route_slug'],route_label=r['route_slug'].replace('-',' ').title(),service_day=r['direction'],sequence=r['seq'],event_type=action,stop_event=r['stop_event'],stop_time=r['stop_time'],location_code=alias['locationCode'],city=alias['city'],location_precision=alias['locationPrecision'],unmatched_reason=alias['unmatchedReason'],alias_note=alias['aliasNote'] or None,event_count=1,source_url=r['source_url'],captured_at=r['scraped_at']))
    if len({r['event_id'] for r in events})!=286:
        raise ValueError('Released event IDs are not unique')
    groups=collections.defaultdict(list)
    previous={};leg_indices=collections.defaultdict(lambda:1)
    for event in events:
        key=(event['route_slug'],event['service_day']);seq=int(event['sequence'])
        if key in previous and seq<=previous[key]:
            if seq!=1:raise ValueError('Unexpected source sequence restart')
            leg_indices[key]+=1
        elif key in previous and seq!=previous[key]+1:
            raise ValueError('Source sequence gap inside a schedule leg')
        elif key not in previous and seq!=1:
            raise ValueError('Source schedule leg must begin at sequence1')
        previous[key]=seq;event['source_leg']=str(leg_indices[key]);groups[key].append(event)
    features=[];pattern_coverage=[]
    for index,((route,day),pattern) in enumerate(sorted(groups.items()),start=1):
        # Global source-ID order preserves table order. Sequence restarts mark separate source legs.
        ordered=pattern
        segments=[];current=[]
        for event in ordered:
            if current and event['source_leg']!=current[-1]['source_leg']:
                segments.append(current);current=[]
            if event['location_code'] is None:
                if current:segments.append(current)
                current=[]
            else:current.append(event)
        if current:segments.append(current)
        drawable=0
        for segment_no,segment in enumerate(segments,start=1):
            coords=[]
            for event in segment:
                coord=locations[event['location_code']]['coordinates']
                if not coords or coord!=coords[-1]:coords.append(coord)
            if len(coords)<2:continue  # No invented/zero-length connection at repeated arrival/departure points.
            segment_id=f'nhc-pattern-{index:02d}-segment-{segment_no:02d}'
            features.append(dict(type='Feature',id=segment_id,geometry=dict(type='LineString',coordinates=coords),properties=dict(segment_id=segment_id,route_slug=route,service_day=day,source_leg=segment[0]['source_leg'],event_ids=[r['event_id'] for r in segment],location_codes=[r['location_code'] for r in segment],schematic=True,connection_kind='schematic connections, not road routes',source_url=segment[0]['source_url'],source_event_count=len(segment),has_unmatched_events_in_pattern=any(r['location_code'] is None for r in ordered))))
            drawable+=1
        pattern_coverage.append(dict(route_slug=route,service_day=day,source_events=len(ordered),source_legs=len({r['source_leg'] for r in ordered}),located_events=sum(r['location_code'] is not None for r in ordered),unmatched_events=sum(r['location_code'] is None for r in ordered),drawn_segments=drawable))
    # Groups identify reference points, not unique passenger stops/vehicles. Unknowns remain one row per source label.
    summary_groups=collections.defaultdict(list)
    for event in events:summary_groups[event['location_code'] or ('unmatched:'+normalize(event['stop_name']))].append(event)
    summary=[]
    for key,group in sorted(summary_groups.items()):
        first=group[0];location=locations.get(first['location_code'])
        summary.append(dict(stop_name=location['name'] if location else first['stop_name'],location_code=first['location_code'],city=first['city'],location_precision=first['location_precision'],recorded_stop_events=len(group),source_stop_labels='; '.join(sorted({r['stop_name'] for r in group})),route_patterns='; '.join(sorted({r['route_label'] for r in group})),unmatched_reason=first['unmatched_reason'],location_note=location['locationNote'] if location else first['unmatched_reason']))
    if sum(r['recorded_stop_events'] for r in summary)!=286:
        raise ValueError('Stop summary must preserve every source event, including unmatched labels')
    source=next(x for x in REVIEW['sources'] if x['filename'].endswith('.csv'))
    shared=dict(topic='Access and travel',status='observed',timeLabel='Historical schedule capture · 16 June 2026',sourceName='Northern Health Connections · reviewed NHHR schedule snapshot',sourceUrl='https://nhconnections.ca/schedules-and-fares/',datasetId=source['datasetId'],tableName=source['tableName'],mapLocationsAsset='locations-travel-stops.geojson')
    event_dataset=dict(**shared,id='travel-stop-events',title='Historical patient-travel stop events',description='All 286 recorded schedule events, with reviewed reference locations and explicitly schematic connections.',geography='route',entityField='stop_name',defaultMetric='event_count',mapConnectionsAsset='travel-route-connections.geojson',mapAggregation=dict(method='sum',metric='event_count'),mapScaleFields=['route_slug','service_day'],defaultFilters=dict(route_slug='burns-lake-prince-george-burns-lake'),notes=[
        'One source row is an arrival, departure or combined stop event. Event_count is exactly 1; circles may sum recorded events at the same reviewed reference point, not passengers, bus departures or service frequency.',
        'The source direction field contains service-day strings, including asterisks. It is preserved as service_day and is not interpreted as outbound/inbound direction or a count of operating days.',
        'Sequence and stop times are source text. Sequence restarts identify separate source schedule legs; source_leg is an ordinal, not a derived travel direction. Arrival and departure rows at the same location remain separate records. No distances, speeds, journey durations or patient volumes are calculated.',
        'Town representatives are coarse official locality points, not boarding addresses. Facility references represent returned public site/address points; exact boarding doors/bays and historical pickup positions are not established.',
        'Source UHNBC/KL and Terrace hospital/medical-centre labels bundle facilities: their map points show town context only. Mackenzie Junction and Small River rest area remain unmatched with reasons.',
        'Lines are schematic connections, not road routes. Each pattern is drawn independently, split at unmatched events, and adjacent repeated coordinates are collapsed. A filtered line must be shown only when all its event_ids remain visible.',
        'June 2026 records are historical. Follow the route source links for current eligibility, booking, timetables and fares. No travel benefit attributable to NHHR is implied.'
    ],columns=[column('stop_name','Source stop/place label'),column('route_label','Route'),column('route_slug','Route source key'),column('service_day','Recorded service day / direction'),column('sequence','Source sequence'),column('source_leg','Source schedule leg'),column('event_type','Event type'),column('stop_time','Recorded time'),column('location_precision','Location precision'),column('location_code','Reviewed location code'),column('city','Community'),column('event_count','Recorded stop events',True,'recorded events'),column('stop_event','Original source event'),column('event_id','Unique source event ID'),column('unmatched_reason','Exact-location gap / unmatched reason'),column('alias_note','Alias review note'),column('source_url','Route source link'),column('captured_at','Source capture timestamp')],rows=events)
    summary_dataset=dict(**shared,id='travel-stop-locations',title='Recorded events by travel reference location',description='Historical schedule-event totals at reviewed facility or town references; unresolved stop labels remain visible.',geography='stop',entityField='stop_name',defaultMetric='recorded_stop_events',notes=[
        'One row groups source events by reviewed reference location; unknown locations remain separate source-label rows with null location_code. All rows together preserve the original 286 records.',
        'recorded_stop_events counts source schedule events, not passengers, unique bus trips, unique physical pickup stops or weekly departures. Arrival/departure records and multiple service-day patterns can contribute separately.',
        'Several named stops can share a coarse town representative. Read source_stop_labels and location_precision before interpreting a circle as a facility.',
        'Location notes preserve town/facility precision and unresolved-address limits. No road-route geometry or journey distance is supplied.'
    ],columns=[column('stop_name','Reviewed reference / unresolved label'),column('location_code','Reviewed location code'),column('city','Community'),column('location_precision','Location precision'),column('recorded_stop_events','Recorded source events',True,'recorded events'),column('source_stop_labels','Contributing source labels'),column('route_patterns','Contributing route labels'),column('unmatched_reason','Exact-location gap / unmatched reason'),column('location_note','Location interpretation')],rows=summary)
    precision=collections.Counter(r['location_precision'] for r in events)
    coverage=dict(sourceEvents=286,sourceRoutes=len({r['route_slug'] for r in events}),sourcePatterns=len(groups),sourceLegs=sum(r['source_legs'] for r in pattern_coverage),mappedEvents=sum(r['location_code'] is not None for r in events),unmappedEvents=sum(r['location_code'] is None for r in events),eventPrecision=dict(precision),reviewedReferencePoints=len(locations),drawnSchematicSegments=len(features),unmatchedStopLabels=sorted({r['stop_name'] for r in events if r['location_code'] is None}),patterns=pattern_coverage)
    release=dict(datasets=[event_dataset,summary_dataset],snapshot=dict(reviewedAt=REVIEW['reviewedAt'],coverage=coverage,locationRegistry='travelStopLocations.json',connectionInterpretation='Schematic connections, not road routes'))
    point_features=[dict(type='Feature',id=l['code'],geometry=dict(type='Point',coordinates=l['coordinates']),properties=dict(code=l['code'],location_code=l['code'],name=l['name'],site=l['site'],city=l['city'],location_precision=l['locationPrecision'],locationPrecision=l['locationPrecision'],source_url=l['sourceUrl'],sourceUrl=l['sourceUrl'],coordinate_source_url=l['coordinateSourceUrl'],coordinateSourceUrl=l['coordinateSourceUrl'],location_note=l['locationNote'],locationNote=l['locationNote'])) for l in REVIEW['locations']]
    point_geo=dict(type='FeatureCollection',metadata=dict(reviewedAt=REVIEW['reviewedAt'],precision='Facility/address references and coarse town representatives; no boarding-bay precision',attribution='BC Address Geocoder / BC Geographic Warehouse; OpenStreetMap contributors where cited'),features=point_features)
    line_geo=dict(type='FeatureCollection',metadata=dict(reviewedAt=REVIEW['reviewedAt'],interpretation='Schematic connections, not road routes',splitAtUnmatchedEvents=True,adjacentRepeatedCoordinatesCollapsed=True,filterRule='Show a feature only if every event_id in properties.event_ids is present in the currently filtered source rows'),features=features)
    provenance=dict(reviewedAt=REVIEW['reviewedAt'],manifestUrl=MANIFEST,reviewFile='scripts/nhhr-travel-stop-review.json',reviewSha256=hashlib.sha256(REVIEW_PATH.read_bytes()).hexdigest(),originalSources=REVIEW['sources'],originalComparison='All 286 CSV rows exactly match the original read-only SQLite nh_connections_schedule table, including event IDs, service-day strings, sequence, text and capture timestamps.',pgmapsRegistrySource=REVIEW['pgmapsRegistrySource'],pgmapsRegistrySha256=REVIEW['pgmapsRegistrySha256'],coordinateMethods=REVIEW['coordinateMethods'],coordinateEvidence=REVIEW['coordinateEvidence'],sourceLabelAliases=REVIEW['aliases'],coverage=coverage,attribution='Contains BC Address Geocoder public location references and OpenStreetMap contributor hospital features; retain original citations and OpenStreetMap attribution.',privacy='Only public transport schedules and public place references. No participant, contact, consent, remuneration or patient records.')
    return release,point_geo,line_geo,provenance


def emit(path,data,check):
    content=(json.dumps(data,ensure_ascii=False,indent=2,allow_nan=False)+'\n').encode('utf-8')
    if check:
        if not path.exists() or path.read_bytes()!=content:raise ValueError(str(path.relative_to(ROOT))+': differs from reviewed generated output')
    else:
        path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(content)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',type=pathlib.Path,required=True)
    parser.add_argument('--refresh',action='store_true')
    parser.add_argument('--headers-file',type=pathlib.Path)
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    if args.refresh:
        headers=json.loads(args.headers_file.read_text()) if args.headers_file else {}
        def fetch(url):
            with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=45) as response:return response.read()
        manifest=json.loads(fetch(MANIFEST));ids={r.get('id') for r in manifest.get('resources',[]) if r.get('kind')=='dataset'}
        for source in REVIEW['sources']:
            if source['datasetId'] not in ids:raise ValueError('Reviewed travel dataset no longer appears in authorized manifest')
            raw=fetch(HOST+'/api/files/'+source['originalFileId']+'/download')
            if hashlib.sha256(raw).hexdigest()!=source['sha256']:raise ValueError('Downloaded travel source differs from reviewed original')
            args.input.mkdir(parents=True,exist_ok=True);(args.input/source['filename']).write_bytes(raw)
    rows=read_source(args.input);locations=validate_review(rows);release,points,connections,provenance=build(rows,locations)
    emit(ROOT/'src/atlas/snapshots/travel-network.json',release,args.check)
    emit(ROOT/'public/data/nhhr/travel-network.json',release,args.check)
    emit(ROOT/'public/data/nhhr/travel-network-provenance.json',provenance,args.check)
    emit(ROOT/'src/atlas/travelStopLocations.json',REVIEW['locations'],args.check)
    emit(ROOT/'public/data/nhhr/locations-travel-stops.geojson',points,args.check)
    emit(ROOT/'public/data/nhhr/travel-route-connections.geojson',connections,args.check)
    readme=ROOT/'public/data/nhhr/TRAVEL_NETWORK_README.md'
    readme_alias=ROOT/'public/data/nhhr/locations-travel-stops.README.md'
    readme_content=readme.read_bytes()
    if args.check:
        if not readme_alias.exists() or readme_alias.read_bytes()!=readme_content:
            raise ValueError('Standard travel location README differs from canonical network README')
    else:
        readme_alias.write_bytes(readme_content)
    coverage=release['snapshot']['coverage']
    print(f"Validated {coverage['sourceEvents']} source events, {coverage['mappedEvents']} mapped references, {coverage['unmappedEvents']} unmatched events and {coverage['drawnSchematicSegments']} schematic segments")

if __name__=='__main__':main()
