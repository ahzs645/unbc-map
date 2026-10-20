import { canEncodeAsArea, crosswalkResolver, groupValue } from '@pgmaps/geo-toolkit/calculations';
import hsdaCrosswalk from './hsdaCrosswalk.json';
import boundaryIndex from './boundaryIndex.json';
import institutions from './institutionLocations.json';
import cities from './cityLocations.json';
import healthAuthorities from './healthAuthorityCrosswalk.json';
import regionalBoundaryIndex from './regionalBoundaryIndex.json';
import mappingBoundaryIndex from './mappingBoundaryIndex.json';
import chsaBoundaryIndex from './chsaBoundaryIndex.json';
import type { AtlasDataset, AtlasRow } from './types';

const institutionLinks = new Map(institutions.map(item => [item.comparator, item.code]));
const cityLinks = new Map(cities.map(item => [item.query_city, item.code]));
const healthAuthorityLinks = new Map(healthAuthorities.map(item => [item.source_region, item.bc_ha_code]));
const sourceBoundaryIndexes: Record<string, string[]> = { ...mappingBoundaryIndex, ...chsaBoundaryIndex };
const resolvers = {
  institution: crosswalkResolver({ links: institutionLinks }),
  city: crosswalkResolver({ links: cityLinks }),
  ha: crosswalkResolver({ links: healthAuthorityLinks, native: boundaryIndex.ha }),
  hsda: crosswalkResolver({ links: hsdaCrosswalk.map(row => [row.health_region_code, row.bc_hsda_code] as const), native: hsdaCrosswalk.map(row => row.bc_hsda_code) }),
  lha: crosswalkResolver({ native: boundaryIndex.lha }),
  cd: crosswalkResolver({ native: regionalBoundaryIndex.cd }),
  csd: crosswalkResolver({ native: regionalBoundaryIndex.csd }),
  er: crosswalkResolver({ native: regionalBoundaryIndex.er }),
};
const reviewedResolvers = new Map(Object.entries(sourceBoundaryIndexes).map(([asset, codes]) => [asset, crosswalkResolver({ native: codes })]));

export function boundaryAssetUrl(file: string): string {
  return `${import.meta.env.BASE_URL}data/nhhr/${file}`;
}

export function boundaryCaption(dataset: AtlasDataset): string {
  if (dataset.mapBoundaryCaption) return dataset.mapBoundaryCaption;
  if (dataset.geography === 'hr2015') return 'Statistics Canada December 2015 health-region boundaries; exact original DGUID/HR_UID joins. The BC aggregate remains in charts and records without an overlapping province polygon.';
  if (dataset.mapLocationsAsset === 'boundaries-lfs-er-2021.geojson') return 'Statistics Canada 2021 boundaries via PGMaps. North Coast and Nechako use one verified union of ERs 5960 and 5970; the combined source value is shown once. LFS population exclusions still apply.';
  if (['cd', 'csd', 'er'].includes(dataset.geography)) return 'Statistics Canada 2021 boundaries via PGMaps; exact native source-code joins. Municipal estimates use contextual 2021 polygons without historical boundary harmonization.';
  return 'BC Ministry of Health boundaries via PGMaps; boundary vintage unestablished.';
}

export function canMapDataset(dataset: AtlasDataset): boolean {
  const reviewedCodes = dataset.mapLocationsAsset && sourceBoundaryIndexes[dataset.mapLocationsAsset];
  if (reviewedCodes) return !!dataset.boundaryKeyField && dataset.rows.some(row => reviewedCodes.includes(String(row[dataset.boundaryKeyField!])));
  if (dataset.geography === 'facility' || dataset.geography === 'stop' || dataset.geography === 'route') return !!dataset.mapLocationsAsset && /^[a-z0-9-]+\.geojson$/.test(dataset.mapLocationsAsset) && dataset.rows.some(row => !!row[dataset.boundaryKeyField ?? 'location_code']);
  if (dataset.geography === 'institution') return dataset.rows.some(row => institutionLinks.has(String(row[dataset.entityField])));
  if (dataset.geography === 'city') return dataset.rows.some(row => cityLinks.has(String(row[dataset.entityField])));
  if (dataset.geography === 'ha') return !!dataset.boundaryKeyField && dataset.rows.some(row => healthAuthorityLinks.has(String(row[dataset.boundaryKeyField!])) || boundaryIndex.ha.includes(String(row[dataset.boundaryKeyField!])));
  if (dataset.geography === 'cd' || dataset.geography === 'csd' || dataset.geography === 'er') {
    const codes: string[] = regionalBoundaryIndex[dataset.geography];
    return !!dataset.boundaryKeyField && dataset.rows.some(row => codes.includes(String(row[dataset.boundaryKeyField!])));
  }
  return (dataset.geography === 'hsda' || dataset.geography === 'lha') && !!dataset.boundaryKeyField;
}

/** Circle area cannot encode a signed amount or percentage change. */
export function canMapMetric(dataset: AtlasDataset, metric: string): boolean {
  if (!canMapDataset(dataset)) return false;
  if (!['institution', 'city', 'facility', 'stop', 'route'].includes(dataset.geography)) return true;
  return canEncodeAsArea(dataset.rows.map(row => row[metric]));
}

/** Polygon joins use source codes; point joins use the reviewed exact comparator crosswalk. */
export function getBoundaryJoin(dataset: AtlasDataset, row: AtlasRow): string | null {
  if (dataset.geography === 'facility' || dataset.geography === 'stop' || dataset.geography === 'route') {
    const code = row[dataset.boundaryKeyField ?? 'location_code'];
    return typeof code === 'string' && code.trim() ? code : null;
  }
  if (dataset.geography === 'institution' || dataset.geography === 'city') return resolvers[dataset.geography](row[dataset.entityField]);
  if (!canMapDataset(dataset) || !dataset.boundaryKeyField) return null;
  const value = row[dataset.boundaryKeyField];
  const reviewed = dataset.mapLocationsAsset && reviewedResolvers.get(dataset.mapLocationsAsset);
  if (reviewed) return reviewed(value);
  const geography = dataset.geography === 'ha' || dataset.geography === 'hsda' || dataset.geography === 'cd' || dataset.geography === 'csd' || dataset.geography === 'er' ? dataset.geography : 'lha';
  return resolvers[geography](value);
}

/** Aggregation is opt-in for a declared additive source metric, never percentiles. */
export function mapGroupValue(dataset: AtlasDataset, rows: AtlasRow[] | undefined, metric: string): number | null {
  return groupValue(rows?.map(row => row[metric]) ?? [], { allowsSum: allowsMapAggregation(dataset, metric) });
}

export function allowsMapAggregation(dataset: AtlasDataset, metric: string) { return dataset.mapAggregation?.method === 'sum' && dataset.mapAggregation.metric === metric; }
