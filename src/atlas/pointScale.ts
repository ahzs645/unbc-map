import type { AtlasDataset, AtlasRow } from './types';
import { allowsMapAggregation, getBoundaryJoin, mapGroupValue } from './geography';

/** A filter can hide comparators without making the remaining dot look larger. */
export function pointScale(dataset: AtlasDataset, rows: AtlasRow[], metric: string) {
  const fields = [...new Set([...(dataset.timeField ? [dataset.timeField] : []), ...dataset.mapScaleFields ?? []])];
  const key = (row: AtlasRow) => JSON.stringify(fields.map(field => row[field]));
  const scopes = new Set(rows.map(key));
  const cohort = dataset.rows.filter(row => !fields.length || scopes.has(key(row)));
  let values = cohort.map(row => row[metric]).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (allowsMapAggregation(dataset, metric)) {
    const groups = new Map<string, AtlasRow[]>();
    for (const row of cohort) { const code = getBoundaryJoin(dataset, row); if (code) groups.set(code, [...groups.get(code) ?? [], row]); }
    values = [...groups.values()].map(group => mapGroupValue(dataset, group, metric)).filter((value): value is number => value !== null);
  }
  const maximum = values.length ? Math.max(...values.map(Math.abs)) : 0;
  return { maximum, radius: (value: number | null) => value === null || maximum === 0 ? 0 : 32 * Math.sqrt(Math.abs(value) / maximum), cohortRecords: cohort.length };
}
