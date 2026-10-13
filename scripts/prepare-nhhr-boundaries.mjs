import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// PGMaps remains a read-only input. Geometry is copied without changing coordinates.
const pgRoot = resolve(process.env.PGMAPS_ROOT || '../PGMaps');
const vendor = join(pgRoot, 'vendor/bcdatamapper');
const boundaryRoot = join(vendor, 'datascrapers/bc/boundaries/output/BCMoH');
const output = resolve('public/data/nhhr');
mkdirSync(output, { recursive: true });
const crosswalk = JSON.parse(readFileSync('src/atlas/hsdaCrosswalk.json', 'utf8'));
const haCrosswalk = JSON.parse(readFileSync('src/atlas/healthAuthorityCrosswalk.json', 'utf8'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const layers = [
  ['hsda', 'health_service_delivery_areas.json', 'HLTH_SERVICE_DLVR_AREA_CODE', 'HLTH_SERVICE_DLVR_AREA_NAME', 16],
  ['lha', 'local_health_areas.json', 'LOCAL_HLTH_AREA_CODE', 'LOCAL_HLTH_AREA_NAME', 89],
  ['ha', 'health_authorities.json', 'HLTH_AUTHORITY_CODE', 'HLTH_AUTHORITY_NAME', 5],
];
const sources = [];
const boundaryIndex = {};
for (const [level, file, codeKey, nameKey, expected] of layers) {
  const bytes = readFileSync(join(boundaryRoot, 'simplified', file));
  const source = JSON.parse(bytes);
  const rawSource = JSON.parse(readFileSync(join(boundaryRoot, file), 'utf8'));
  const sourceLayer = String(rawSource.features[0]?.id || '').split('.').slice(0, 2).join('.');
  const ids = source.features.map(f => String(f.properties[codeKey]));
  boundaryIndex[level] = ids.sort();
  if (ids.length !== expected || new Set(ids).size !== expected) throw new Error(`${level}: unexpected count/IDs`);
  const collection = { type: 'FeatureCollection', metadata: {
    ...source.metadata,
    sourceService: 'https://openmaps.gov.bc.ca/geo/pub/ows', sourceLayer,
    sourceSnapshotCapturedAt: rawSource.timeStamp || null,
    boundaryVintage: null,
    boundaryVintageNote: 'Source snapshot does not establish boundary vintage. Contextual display, not historical boundary harmonization.',
    sourceSha256: sha256(bytes),
    attribution: 'Province of British Columbia, Ministry of Health; geometry supplied through PGMaps / BCDataMapper',
    licence: 'Open Government Licence – British Columbia',
    licenceUrl: 'https://www2.gov.bc.ca/gov/content/data/open-data/open-government-licence-bc',
  }, features: source.features.map(feature => ({ type: 'Feature', id: String(feature.properties[codeKey]), geometry: feature.geometry, properties: {
    code: String(feature.properties[codeKey]), name: feature.properties[nameKey],
    hsda_code: feature.properties.HLTH_SERVICE_DLVR_AREA_CODE || null,
    health_authority_code: feature.properties.HLTH_AUTHORITY_CODE,
    health_authority_name: feature.properties.HLTH_AUTHORITY_NAME,
  } })) };
  if (level === 'hsda') for (const link of crosswalk) if (!ids.includes(link.bc_hsda_code)) throw new Error(`Missing polygon ${link.bc_hsda_code}`);
  const serialized = `${JSON.stringify(collection)}\n`;
  writeFileSync(join(output, `boundaries-${level}.geojson`), serialized);
  sources.push({ level, sourcePath: `vendor/bcdatamapper/datascrapers/bc/boundaries/output/BCMoH/simplified/${file}`, sourceService: 'https://openmaps.gov.bc.ca/geo/pub/ows', sourceLayer, sourceSnapshotCapturedAt: rawSource.timeStamp || null, sourceSha256: sha256(bytes), featureCount: expected, outputBytes: Buffer.byteLength(serialized), simplification: source.metadata });
}
writeFileSync(resolve('src/atlas/boundaryIndex.json'), `${JSON.stringify(boundaryIndex, null, 2)}\n`);
const quote = v => `"${String(v ?? '').replaceAll('"', '""')}"`;
const csv = (rows, fields) => `${fields.join(',')}\n${rows.map(r => fields.map(f => quote(r[f])).join(',')).join('\n')}\n`;
writeFileSync(join(output, 'crosswalk-hsda.json'), `${JSON.stringify(crosswalk, null, 2)}\n`);
writeFileSync(join(output, 'crosswalk-hsda.csv'), csv(crosswalk, ['health_region_code', 'bc_hsda_code', 'statcan_2024_name']));
if (haCrosswalk.length !== 5 || !haCrosswalk.every(link => boundaryIndex.ha.includes(link.bc_ha_code))) throw new Error('Invalid territorial HA crosswalk');
writeFileSync(join(output, 'crosswalk-health-authority.json'), `${JSON.stringify(haCrosswalk, null, 2)}\n`);
writeFileSync(join(output, 'crosswalk-health-authority.csv'), csv(haCrosswalk, ['source_region', 'bc_ha_code', 'bc_ha_name']));
const chsa = JSON.parse(readFileSync(join(boundaryRoot, 'community_health_service_areas.json'), 'utf8'));
const hierarchy = chsa.features.map(({ properties: p }) => ({
  chsa_code: String(p.CMNTY_HLTH_SERV_AREA_CODE), chsa_name: p.CMNTY_HLTH_SERV_AREA_NAME,
  lha_code: String(p.LOCAL_HLTH_AREA_CODE), lha_name: p.LOCAL_HLTH_AREA_NAME,
  hsda_code: String(p.HLTH_SERVICE_DLVR_AREA_CODE), hsda_name: p.HLTH_SERVICE_DLVR_AREA_NAME,
  health_authority_code: String(p.HLTH_AUTHORITY_CODE), health_authority_name: p.HLTH_AUTHORITY_NAME,
})).sort((a, b) => a.chsa_code.localeCompare(b.chsa_code));
if (new Set(hierarchy.map(r => r.chsa_code)).size !== 231) throw new Error('Unexpected CHSA hierarchy count');
writeFileSync(join(output, 'crosswalk-health-hierarchy.csv'), csv(hierarchy, Object.keys(hierarchy[0])));
writeFileSync(join(output, 'crosswalk-health-hierarchy.json'), `${JSON.stringify(hierarchy, null, 2)}\n`);
writeFileSync(join(output, 'boundaries-provenance.json'), `${JSON.stringify({
  schema: 'nhhr-boundaries-v1', pgMapsCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: pgRoot, encoding: 'utf8' }).trim(),
  bcDataMapperCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: vendor, encoding: 'utf8' }).trim(),
  sources,
  crosswalkSource: 'https://www150.statcan.gc.ca/n1/pub/82-402-x/2025001/app-ann/app-ann01-eng.htm',
  crosswalkMethod: 'Explicit reviewed 16-row Statistics Canada 2024 HSDA code to BC Ministry of Health HSDA code lookup. No names, prefixes or fuzzy matches used at runtime.',
  healthAuthorityCrosswalkMethod: 'Exact reviewed CIHI source label to the five Ministry territorial HA codes. Province and PHSA are intentionally unmatched. See crosswalk-health-authority.README.md.',
  hierarchyMethod: 'Parent identifiers as supplied by BC Ministry of Health CHSA snapshot. No population allocation or new spatial intersection.',
  limitations: ['Boundary vintage is unestablished in the local snapshot.', 'Historical values are displayed on contextual polygons; no claim of boundary harmonization.', 'City and institution observations retain their source grain at verified representative points, without health-area allocation.', 'PHSA and province reporting units are not allocated among the five territorial HA polygons.'],
}, null, 2)}\n`);
console.log(`Prepared 16 HSDA, 89 LHA, 5 HA polygons; 16 exact HSDA links; ${hierarchy.length} health hierarchy rows.`);
