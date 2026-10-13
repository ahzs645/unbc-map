import hsdaCrosswalk from './hsdaCrosswalk.json';
import boundaryIndex from './boundaryIndex.json';
import institutions from './institutionLocations.json';
import cities from './cityLocations.json';
import healthAuthorities from './healthAuthorityCrosswalk.json';
import regionalBoundaryIndex from './regionalBoundaryIndex.json';
import mappingBoundaryIndex from './mappingBoundaryIndex.json';
import chsaBoundaryIndex from './chsaBoundaryIndex.json';
import type { AtlasDataset, AtlasRow } from './types';

const hsdaLinks = new Map(hsdaCrosswalk.map(row => [row.health_region_code, row.bc_hsda_code]));
const nativeHsdaIds = new Set(hsdaCrosswalk.map(row => row.bc_hsda_code));
const nativeLhaIds = new Set(boundaryIndex.lha);
const institutionLinks = new Map(institutions.map(item => [item.comparator, item.code]));
const cityLinks = new Map(cities.map(item => [item.query_city, item.code]));
const healthAuthorityLinks = new Map(healthAuthorities.map(item => [item.source_region, item.bc_ha_code]));
const sourceBoundaryIndexes: Record<string, string[]> = { ...mappingBoundaryIndex, ...chsaBoundaryIndex };

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
  return !dataset.rows.some(row => typeof row[metric] === 'number' && Number(row[metric]) < 0);
}

/** Polygon joins use source codes; point joins use the reviewed exact comparator crosswalk. */
export function getBoundaryJoin(dataset: AtlasDataset, row: AtlasRow): string | null {
  if (dataset.geography === 'facility' || dataset.geography === 'stop' || dataset.geography === 'route') {
    const code = row[dataset.boundaryKeyField ?? 'location_code'];
    return typeof code === 'string' && code.trim() ? code : null;
  }
  if (dataset.geography === 'institution') return institutionLinks.get(String(row[dataset.entityField])) ?? null;
  if (dataset.geography === 'city') return cityLinks.get(String(row[dataset.entityField])) ?? null;
  if (!canMapDataset(dataset) || !dataset.boundaryKeyField) return null;
  const value = row[dataset.boundaryKeyField];
  if (value === null || value === undefined || value === '') return null;
  const code = String(value);
  const reviewedCodes = dataset.mapLocationsAsset && sourceBoundaryIndexes[dataset.mapLocationsAsset];
  if (reviewedCodes) return reviewedCodes.includes(code) ? code : null;
  if (dataset.geography === 'cd' || dataset.geography === 'csd' || dataset.geography === 'er') {
    const codes: string[] = regionalBoundaryIndex[dataset.geography];
    return codes.includes(code) ? code : null;
  }
  if (dataset.geography === 'ha') return healthAuthorityLinks.get(code) || (boundaryIndex.ha.includes(code) ? code : null);
  if (dataset.geography === 'hsda') return hsdaLinks.get(code) || (nativeHsdaIds.has(code) ? code : null);
  return nativeLhaIds.has(code) ? code : null;
}

/** Aggregation is opt-in for a declared additive source metric, never percentiles. */
export function mapGroupValue(dataset: AtlasDataset, rows: AtlasRow[] | undefined, metric: string): number | null {
  if (!rows?.length) return null;
  const values = rows.map(row => row[metric]);
  if (!values.every((value): value is number => typeof value === 'number' && Number.isFinite(value))) return null;
  return rows.length === 1 ? values[0] : dataset.mapAggregation?.method === 'sum' && dataset.mapAggregation.metric === metric ? values.reduce((total, value) => total + value, 0) : null;
}

export function allowsMapAggregation(dataset: AtlasDataset, metric: string) { return dataset.mapAggregation?.method === 'sum' && dataset.mapAggregation.metric === metric; }

export function getJoinDiagnostics(dataset: AtlasDataset, rows: AtlasRow[]) {
  const ids = rows.map(row => getBoundaryJoin(dataset, row));
  const counts = new Map<string, number>();
  for (const id of ids) if (id) counts.set(id, (counts.get(id) || 0) + 1);
  return { total: rows.length, matched: ids.filter(id => id && counts.get(id) === 1).length, unmatched: ids.filter(id => !id).length,
    ambiguous: [...counts.values()].filter(count => count > 1).reduce((sum, count) => sum + count, 0),
  };
}
