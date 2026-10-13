import { useMemo, useState } from 'react';
import AtlasMap, { type AtlasMapCamera } from './AtlasMap';
import type { AtlasDataset, AtlasRow } from './types';
import type { AtlasBasemap } from './basemaps';

interface AtlasMapComparisonProps {
  dataset: AtlasDataset;
  rows: AtlasRow[];
  metric: string;
  comparisonMetric: string;
  focusRegions?: string[];
  scaleDomain?: [number, number];
}

function valueLabel(value: unknown, unit?: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'No value';
  return new Intl.NumberFormat('en-CA', { maximumFractionDigits: 1 }).format(value) + (unit === '%' ? '%' : '');
}

/** Both full-size maps share a camera and scale. Only the later map is clipped. */
export default function AtlasMapComparison({ dataset, rows, metric, comparisonMetric, focusRegions, scaleDomain }: AtlasMapComparisonProps) {
  const [reveal, setReveal] = useState(50);
  const [camera, setCamera] = useState<AtlasMapCamera>();
  const [basemap, setBasemap] = useState<AtlasBasemap>('streets');
  const earlierColumn = dataset.columns.find(column => column.key === metric);
  const laterColumn = dataset.columns.find(column => column.key === comparisonMetric);
  const domain = useMemo<[number, number]>(() => {
    const values = rows.flatMap(row => [row[metric], row[comparisonMetric]]).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    if (scaleDomain?.every(Number.isFinite) && scaleDomain[0] <= scaleDomain[1]) values.push(...scaleDomain);
    return values.length ? [Math.min(...values), Math.max(...values)] : [0, 0];
  }, [rows, metric, comparisonMetric, scaleDomain]);
  const earlierLabel = earlierColumn?.label || metric;
  const laterLabel = laterColumn?.label || comparisonMetric;
  const unitsMatch = earlierColumn?.unit === laterColumn?.unit;

  if (!unitsMatch) return <p role="status">These measures use different units. Compare them in the data explorer using separate charts.</p>;

  return <section className="atlas-map-comparison" aria-label={`${earlierLabel} compared with ${laterLabel}`}
    style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
    <div className="atlas-comparison-labels" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '8px 12px', fontSize: 12 }}>
      <strong>{earlierLabel}</strong><strong>{laterLabel}</strong>
    </div>
    <div className="atlas-comparison-stage" data-testid="atlas-map-comparison" data-reveal={reveal}
      data-scale-domain={JSON.stringify(domain)} style={{ position: 'relative', flex: 1, minHeight: 180, overflow: 'hidden' }}>
      <div className="atlas-comparison-map atlas-comparison-map-earlier" style={{ position: 'absolute', inset: 0 }}>
        <AtlasMap dataset={dataset} rows={rows} metric={metric} compact focusRegions={focusRegions} scaleDomain={domain} onCameraChange={setCamera} basemap={basemap} onBasemapChange={setBasemap} />
      </div>
      <div className="atlas-comparison-map atlas-comparison-map-later" aria-hidden="true"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', clipPath: `inset(0 0 0 ${100 - reveal}%)` }}>
        <AtlasMap dataset={dataset} rows={rows} metric={comparisonMetric} compact focusRegions={focusRegions} scaleDomain={domain} camera={camera} interactive={false} basemap={basemap} />
      </div>
      <div className="atlas-comparison-divider" aria-hidden="true" style={{ position: 'absolute', top: 0, bottom: 0, left: `${100 - reveal}%`, width: 2, background: '#035642', pointerEvents: 'none' }} />
    </div>
    <label className="atlas-comparison-control" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 12px', fontSize: 12 }}>
      Reveal later-year map
      <input type="range" min={0} max={100} value={reveal} aria-label="Reveal later-year map" aria-valuetext={`${reveal}% of the later-year map is visible`}
        onChange={event => setReveal(Number(event.target.value))} style={{ flex: 1, minWidth: 50 }} />
      <output>{reveal}%</output>
    </label>
    <details className="atlas-comparison-values" style={{ flex: '0 0 auto', padding: '0 12px 8px', fontSize: 12 }}>
      <summary>Compare every region’s values</summary>
      <div className="atlas-comparison-table-scroll" style={{ maxHeight: 220, overflow: 'auto' }}>
        <table>
          <caption>{earlierLabel} and {laterLabel}{earlierColumn?.unit ? ` (${earlierColumn.unit})` : ''}. Both maps use the same color scale.</caption>
          <thead><tr><th scope="col">Region</th><th scope="col">{earlierLabel}</th><th scope="col">{laterLabel}</th></tr></thead>
          <tbody>{rows.map((row, index) => <tr key={`${row[dataset.entityField]}-${index}`}>
            <th scope="row">{String(row[dataset.entityField] ?? 'Unnamed record')}</th>
            <td>{valueLabel(row[metric], earlierColumn?.unit)}</td><td>{valueLabel(row[comparisonMetric], laterColumn?.unit)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </details>
  </section>;
}
