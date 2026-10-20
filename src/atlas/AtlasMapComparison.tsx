import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import AtlasMap, { type AtlasMapCamera } from './AtlasMap';
import type { AtlasDataset, AtlasRow } from './types';
import type { AtlasBasemap } from './basemaps';
import { formatMeasure } from '@pgmaps/geo-toolkit/format';

interface AtlasMapComparisonProps {
  dataset: AtlasDataset;
  rows: AtlasRow[];
  metric: string;
  comparisonMetric: string;
  focusRegions?: string[];
  scaleDomain?: [number, number];
  /** Kept mounted but hidden in a story reader. */
  dormant?: boolean;
}

function valueLabel(value: unknown, unit?: string) {
  return formatMeasure(typeof value === 'number' ? value : null, unit === '%' ? '%' : undefined);
}

/** Both full-size maps share a camera and scale. Only the later map is clipped. */
export default function AtlasMapComparison({ dataset, rows, metric, comparisonMetric, focusRegions, scaleDomain, dormant = false }: AtlasMapComparisonProps) {
  const [reveal, setReveal] = useState(50);
  const stage = useRef<HTMLDivElement>(null);
  // The divider spans the map canvas only, not the legend beneath it.
  const [canvasBox, setCanvasBox] = useState<{ top: number; height: number }>();
  useLayoutEffect(() => {
    const root = stage.current;
    if (!root) return;
    const measure = () => {
      const canvas = root.querySelector<HTMLElement>('.atlas-comparison-map-earlier .atlas-map-canvas');
      if (!canvas) return;
      const outer = root.getBoundingClientRect(), inner = canvas.getBoundingClientRect();
      setCanvasBox({ top: inner.top - outer.top, height: inner.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    const canvas = root.querySelector<HTMLElement>('.atlas-comparison-map-earlier .atlas-map-canvas');
    if (canvas) observer.observe(canvas);
    return () => observer.disconnect();
  }, []);
  // The handle's value is the divider's position from the left: the share of
  // the earlier-year map in view. The later-year map fills the rest.
  const position = 100 - reveal;
  const moveTo = (value: number) => setReveal(100 - Math.round(Math.min(100, Math.max(0, value))));
  const drag = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = stage.current?.getBoundingClientRect();
    if (bounds?.width) moveTo((event.clientX - bounds.left) / bounds.width * 100);
  };
  const step = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = { ArrowLeft: position - 5, ArrowDown: position - 5, ArrowRight: position + 5, ArrowUp: position + 5, PageDown: position - 25, PageUp: position + 25, Home: 0, End: 100 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    moveTo(next);
  };
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
    <div ref={stage} className="atlas-comparison-stage" data-testid={dormant ? undefined : "atlas-map-comparison"} data-reveal={reveal}
      data-scale-domain={JSON.stringify(domain)} style={{ position: 'relative', flex: 1, minHeight: 180, overflow: 'hidden' }}>
      <div className="atlas-comparison-map atlas-comparison-map-earlier" style={{ position: 'absolute', inset: 0 }}>
        <AtlasMap dataset={dataset} rows={rows} metric={metric} compact focusRegions={focusRegions} scaleDomain={domain} onCameraChange={setCamera} basemap={basemap} onBasemapChange={setBasemap} dormant={dormant} tipMetrics={[metric, comparisonMetric]} />
      </div>
      <div className="atlas-comparison-map atlas-comparison-map-later" aria-hidden="true"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', clipPath: `inset(0 0 0 ${100 - reveal}%)` }}>
        <AtlasMap dataset={dataset} rows={rows} metric={comparisonMetric} compact focusRegions={focusRegions} scaleDomain={domain} camera={camera} interactive={false} basemap={basemap} dormant={dormant} />
      </div>
      <div className="atlas-comparison-swipe" style={{ left: `${position}%`, top: canvasBox?.top ?? 0, height: canvasBox?.height ?? '100%' }}
        onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); drag(event); }}
        onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) drag(event); }}>
        <span className="atlas-comparison-divider" aria-hidden="true" />
        <div className="atlas-comparison-handle" role="slider" tabIndex={0} aria-label="Year divider" aria-orientation="horizontal"
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={position} aria-valuetext={`${position}% ${earlierLabel}, ${reveal}% ${laterLabel}`} onKeyDown={step}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M9 6l-6 6 6 6M15 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      </div>
    </div>
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
