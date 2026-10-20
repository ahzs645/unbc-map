import { groupByJoin } from '@pgmaps/geo-toolkit/calculations';
import { areaRadiusScale, cohortRows } from '@pgmaps/geo-toolkit/scales';
import type { AtlasDataset, AtlasRow } from './types';
import { allowsMapAggregation, getBoundaryJoin, mapGroupValue } from './geography';

/** A filter can hide comparators without making the remaining dot look larger. */
export function pointScale(dataset: AtlasDataset, rows: AtlasRow[], metric: string) {
  const cohort = cohortRows(dataset.rows, rows, [...(dataset.timeField ? [dataset.timeField] : []), ...dataset.mapScaleFields ?? []]);
  const values = allowsMapAggregation(dataset, metric)
    ? [...groupByJoin(cohort, row => getBoundaryJoin(dataset, row)).values()].map(group => mapGroupValue(dataset, group, metric))
    : cohort.map(row => row[metric]).filter((value): value is number => typeof value === 'number');
  return { ...areaRadiusScale(values, { maxRadius: 32 }), cohortRecords: cohort.length };
}
