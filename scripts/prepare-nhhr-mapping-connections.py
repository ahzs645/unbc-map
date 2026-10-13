#!/usr/bin/env python3
"""Rebuild the three reviewed mapping connections from locked public originals."""
import argparse
import copy
import hashlib
import json
import re
import tempfile
from pathlib import Path
from urllib.request import Request, urlopen
from zipfile import ZipFile
import shapefile
from pyproj import CRS, Transformer
from shapely.geometry import Point, Polygon, mapping, shape
from shapely.ops import transform, unary_union
from nhhr_mapping_connections import COMBINED_CODE, ER_CODES, LFS_ASSET

ROOT = Path(__file__).resolve().parents[1]
PUBLISHER = 'https://www150.statcan.gc.ca/n1/pub/82-402-x/2015002/hrbf-flrs-eng.htm'
ZIP_URL = PUBLISHER.rsplit('/', 1)[0] + '/data-donnees/boundary-limites/arcinfo/HR_059b11a_e.zip'
GUIDE = 'https://www150.statcan.gc.ca/n1/pub/71-543-g/2025001/app_ann_a-eng.htm'
MCMASTER = 'https://nuclear.mcmaster.ca/nuclear-resonance/getting-to-campus/'
FILES = {
    'HR_059b11a_e.zip': (ZIP_URL, '96a9633d00b467399190a38c95e0b6c601fdf4c90734d5f0648580655f93fc43'),
    'mcmaster-osm-way.json': ('https://api.openstreetmap.org/api/0.6/way/23122301/full.json', '813986a230d82b98511309b5921fc4eee60d192931315f5dff4db0cd86391aaf'),
    'mcmaster-nominatim.json': ('https://nominatim.openstreetmap.org/search?q=McMaster+University+Hamilton&format=jsonv2&limit=3&polygon_geojson=1', '003e9c742941ab54bc5a70d5a9282bace0be19851fe0c59daac5962d08f9a496'),
    'health-regions-2015-download-page.html': (PUBLISHER, None),
    'lfs-geography-2025.html': (GUIDE, None),
    'mcmaster-official-campus.html': (MCMASTER, None),
}

def digest(data): return hashlib.sha256(data).hexdigest()
def require(condition, message):
    if not condition: raise ValueError(message)
def write(path, obj, check):
    content = obj if isinstance(obj, str) else json.dumps(obj, ensure_ascii=False, indent=2, allow_nan=False) + '\n'
    if check: require(path.exists() and path.read_text() == content, 'Reviewed output differs: ' + str(path))
    else: path.parent.mkdir(parents=True, exist_ok=True); path.write_text(content)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', type=Path, default=Path('/tmp/nhhr-mapping-gaps-review'))
    parser.add_argument('--refresh', action='store_true')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args(); args.input.mkdir(parents=True, exist_ok=True)
    receipts = []
    for name, (url, locked_hash) in FILES.items():
        if args.refresh:
            with urlopen(Request(url, headers={'User-Agent': 'NHHR-Atlas-geography-review/1.0'}), timeout=60) as response: data = response.read()
            if name == 'mcmaster-nominatim.json': data = json.dumps(json.loads(data)).encode()
            require(not locked_hash or digest(data) == locked_hash, 'Public original changed; review before replacing: ' + name)
            (args.input / name).write_bytes(data)
        data = (args.input / name).read_bytes()
        require(not locked_hash or digest(data) == locked_hash, 'Original hash differs: ' + name)
        receipts.append({'name': name, 'sourceUrl': url, 'sha256': digest(data), 'bytes': len(data)})
    pages = {name: re.sub(r'\s+', ' ', re.sub('<[^>]+>', ' ', (args.input / name).read_text())) for name in FILES if name.endswith('.html')}
    require('December 2015' in pages['health-regions-2015-download-page.html'], 'Historical vintage definition absent.')
    guide = pages['lfs-geography-2025.html']
    require('2021' in guide and 'North Coast and Nechako' in guide and 'combined for data quality' in guide, 'LFS geography definition changed.')
    campus = pages['mcmaster-official-campus.html']
    require('1280 Main Street West' in campus and 'Hamilton' in campus, 'Official campus identity changed.')

    historical = []
    with tempfile.TemporaryDirectory() as temp:
        with ZipFile(args.input / 'HR_059b11a_e.zip') as archive: archive.extractall(temp)
        shp = next(Path(temp).glob('*.shp'))
        projection = CRS.from_wkt(shp.with_suffix('.prj').read_text())
        require(projection.to_epsg() == 3347, 'Historical projection changed.')
        project = Transformer.from_crs(projection, 'EPSG:4326', always_xy=True)
        reader = shapefile.Reader(str(shp))
        require(len(reader) == 16, 'Historical BC region inventory changed.')
        for record in reader.iterShapeRecords():
            properties = record.record.as_dict(); uid = properties['HR_UID']
            if uid not in ['5951', '5952', '5953']: continue
            original = shape(record.shape.__geo_interface__)
            require(original.is_valid, 'Invalid original historical geometry.')
            geometry = transform(project.transform, original)
            require(geometry.is_valid, 'Historical reprojection produced invalid geometry.')
            historical.append({'type': 'Feature', 'geometry': mapping(geometry), 'properties': {'code': '2015A0007' + uid, 'name': properties['ENG_LABEL'], 'HR_UID': uid, 'boundary_vintage': 'December 2015', 'sourceUrl': PUBLISHER}})
    require({x['properties']['code'] for x in historical} == {'2015A00075951', '2015A00075952', '2015A00075953'}, 'Historical identity changed.')
    historical_asset = {'type': 'FeatureCollection', 'name': 'Northern health regions · December 2015', 'features': historical}

    native_path = ROOT / 'public/data/nhhr/boundaries-er.geojson'; native_bytes = native_path.read_bytes()
    require(digest(native_bytes) == 'cd09f16109a8d9f25b26da5e93d05f747107fd60746af4cf088eadb0d51eb094', 'PGMaps native ER snapshot changed.')
    native = json.loads(native_bytes); by_code = {f['properties']['code']: f for f in native['features']}
    components = [shape(by_code[c]['geometry']) for c in ['5960', '5970']]
    require(all(g.is_valid for g in components) and components[0].touches(components[1]), 'Union inputs invalid or no longer adjacent.')
    require(components[0].intersection(components[1]).area == 0, 'Economic regions overlap.')
    union = unary_union(components)
    require(union.is_valid and abs(union.area - sum(g.area for g in components)) < 1e-10, 'Union lost or duplicated area.')
    combined = {'type': 'Feature', 'geometry': mapping(union), 'properties': {'code': COMBINED_CODE, 'name': 'North Coast and Nechako', 'source_boundary_codes': ['5960', '5970'], 'source_dguids': ['2021S05005960', '2021S05005970'], 'census_year': 2021, 'display_key_is_derived': True, 'sourceUrl': GUIDE}}
    labour = {'type': 'FeatureCollection', 'name': 'BC LFS reporting areas · 2021 geometry', 'features': [copy.deepcopy(by_code[c]) for c in sorted(ER_CODES)] + [combined]}
    geometries = [shape(f['geometry']) for f in labour['features']]
    require(all(geometries[i].intersection(geometries[j]).area < 1e-10 for i in range(7) for j in range(i)), 'Reporting polygons overlap.')

    osm = json.loads((args.input / 'mcmaster-osm-way.json').read_text())
    way = next(e for e in osm['elements'] if e['type'] == 'way' and e['id'] == 23122301)
    tags = way['tags']; require(tags['name'] == 'McMaster University' and tags['addr:housenumber'] == '1280' and tags['addr:street'] == 'Main Street West' and tags['addr:city'] == 'Hamilton', 'Independent campus identity changed.')
    nodes = {e['id']: (e['lon'], e['lat']) for e in osm['elements'] if e['type'] == 'node'}
    nominatim = json.loads((args.input / 'mcmaster-nominatim.json').read_text())
    require(len(nominatim) == 1 and nominatim[0]['osm_type'] == 'way' and nominatim[0]['osm_id'] == 23122301, 'Mapped campus identity changed.')
    coordinates = [round(float(nominatim[0]['lon']), 5), round(float(nominatim[0]['lat']), 5)]
    polygon = Polygon([nodes[node] for node in way['nodes']])
    require(polygon.is_valid and polygon.contains(Point(coordinates)), 'McMaster representative point is outside the verified campus.')
    registry = json.loads((ROOT / 'src/atlas/institutionLocations.json').read_text())
    registry = [r for r in registry if r['code'] != 'mcmaster']
    registry.append({'code': 'mcmaster', 'comparator': 'McMaster / Hamilton', 'name': 'McMaster University', 'city': 'Hamilton', 'site': 'Main campus · 1280 Main Street West', 'coordinates': coordinates, 'sourceUrl': MCMASTER, 'coordinateSourceUrl': 'https://www.openstreetmap.org/way/23122301', 'locationNote': 'Representative point inside the verified Hamilton main-campus feature. McMaster operates additional campuses and affiliated research sites. Institution-wide source totals are not allocated to this campus, its buildings, residents or individual projects.'})
    require(len(registry) == 9 and len({r['comparator'] for r in registry}) == 9, 'Institution registry identity changed.')
    locations = {'type': 'FeatureCollection', 'name': 'NHHR representative institution display locations', 'attribution': 'Coordinate data © OpenStreetMap contributors, ODbL 1.0', 'license_url': 'https://www.openstreetmap.org/copyright', 'verified_at': '2026-10-12', 'features': [{'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': r['coordinates']}, 'properties': {'code': r['code'], 'name': r['name'], 'city': r['city'], 'site': r['site'], 'source_url': r['sourceUrl'], 'coordinate_source_url': r['coordinateSourceUrl'], 'location_note': r['locationNote']}} for r in registry]}
    proof = {'reviewedAt': '2026-10-12', 'sources': receipts, 'historicalCancer': {'boundaryVintage': 'December 2015', 'archiveMember': shp.name, 'originalCRS': 'EPSG:3347', 'outputCRS': 'EPSG:4326', 'transformation': 'Reprojected official polygons; no independent simplification or current-geometry substitution.', 'sourceDguidToHrUid': {f['properties']['code']: f['properties']['HR_UID'] for f in historical}, 'provinceAggregateMapped': False, 'licenceUrl': 'https://www.statcan.gc.ca/en/reference/licence'}, 'combinedLabourRegion': {'publisherDefinitionUrl': GUIDE, 'pgMapsSourcePath': 'vendor/bcdatamapper/datascrapers/bc/boundaries/output/StatCan/bc_economic_regions_2021.geojson.gz', 'pgMapsSourceSha256': 'feb193fbc3d06e421a331f80eccde1dc0a2ed5e67e4184c6b947ab88bd4b709f', 'nativeAssetSha256': digest(native_bytes), 'nativeCodes': ['5960', '5970'], 'displayKey': COMBINED_CODE, 'sourceDguidRemainsBlank': True, 'method': 'Exact topological union of adjacent PGMaps 2021 polygons. One source value, no disaggregation or independent simplification.', 'reportingFeatureCount': 7, 'componentIntersectionArea': 0, 'unionAreaDegreesSquared': union.area, 'componentAreaSumDegreesSquared': sum(g.area for g in components), 'limitations': 'Territorial reporting context; LFS target-population exclusions remain. Separate economic-region measures keep the eight native polygons.'}, 'mcmaster': {'comparator': 'McMaster / Hamilton', 'officialLocationUrl': MCMASTER, 'osmObjectUrl': 'https://www.openstreetmap.org/way/23122301', 'osmVersion': way['version'], 'coordinates': coordinates, 'pointWithinCampusPolygon': True, 'role': 'Representative institutional point; not a project, participant or funding allocation.'}}
    index = {'boundaries-hr2015.geojson': sorted(f['properties']['code'] for f in historical), LFS_ASSET: sorted(f['properties']['code'] for f in labour['features'])}
    write(ROOT / 'src/atlas/mappingBoundaryIndex.json', index, args.check)
    write(ROOT / 'src/atlas/institutionLocations.json', registry, args.check)
    write(ROOT / 'public/data/nhhr/boundaries-hr2015.geojson', historical_asset, args.check)
    write(ROOT / 'public/data/nhhr' / LFS_ASSET, labour, args.check)
    write(ROOT / 'public/data/nhhr/locations-institutions.geojson', locations, args.check)
    write(ROOT / 'public/data/nhhr/mapping-connections-provenance.json', proof, args.check)
    print('Checked' if args.check else 'Wrote', 'three archived health polygons, seven LFS reporting areas and nine institutional points; all geometry/identity checks passed.')

if __name__ == '__main__': main()
