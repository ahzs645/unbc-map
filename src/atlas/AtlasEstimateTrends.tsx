import { useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AtlasDataset, AtlasRow } from "./types";
import { formatValue } from "./AtlasChart";

type Point = { year: string; value: number; projection: boolean };
type Panel = { name: string; points: Point[]; note?: string };

/**
 * Small multiples for a series whose last year is a projection: one panel per
 * area on its own scale, source estimates joined by a line and the projection
 * set apart in a shaded column, never joined to them.
 */
export default function AtlasEstimateTrends({ dataset, rows, metric, totalLabel }: { dataset: AtlasDataset; rows: AtlasRow[]; metric: string; totalLabel?: string }) {
  const timeField = dataset.timeField!;
  const isProjection = (row: AtlasRow) => String(row.population_type ?? "").toLowerCase() === "projection";
  const series = (records: AtlasRow[]): Point[] => records
    .filter(row => typeof row[metric] === "number")
    .map(row => ({ year: String(row[timeField]), value: row[metric] as number, projection: isProjection(row) }))
    .sort((a, b) => a.year.localeCompare(b.year));
  const entities = [...new Set(rows.map(row => String(row[dataset.entityField])))];
  const panels: Panel[] = entities.map(name => ({ name, points: series(rows.filter(row => String(row[dataset.entityField]) === name)) }));
  if (totalLabel) {
    // A regional total is shown only for years where every area reports.
    const areas = new Set(dataset.rows.map(row => String(row[dataset.entityField])));
    const years = [...new Set(dataset.rows.map(row => String(row[timeField])))].sort();
    const points = years.flatMap(year => {
      const records = dataset.rows.filter(row => String(row[timeField]) === year);
      if (records.length !== areas.size || records.some(row => typeof row[metric] !== "number")) return [];
      return [{ year, value: records.reduce((sum, row) => sum + (row[metric] as number), 0), projection: records.every(isProjection) }];
    });
    if (points.length) panels.unshift({ name: totalLabel, points, note: `Sum of ${areas.size} areas` });
  }
  const column = dataset.columns.find(item => item.key === metric);
  // A phone's story panel shows one area at a time, starting with the regional
  // total, and steps through the rest; every other view shows them all (CSS).
  const [current, setCurrent] = useState(0);
  const shown = Math.min(current, panels.length - 1);
  return <div className="atlas-trend-multiples" data-testid="estimate-trends">
    <div className="atlas-trend-key">
      <strong>{column?.label ?? metric}{column?.unit ? ` (${column.unit})` : ""}</strong>
      <span><i className="is-estimate" aria-hidden="true" /><span className="atlas-trend-key-long">Source e</span><span className="atlas-trend-key-short">E</span>stimate</span>
      <span><i className="is-projection" aria-hidden="true" />Projection</span>
    </div>
    {panels.length > 1 && <div className="atlas-trend-pager">
      <button type="button" aria-label="Previous area" disabled={shown === 0} onClick={() => setCurrent(shown - 1)}><ChevronLeft size={18} aria-hidden="true" /></button>
      <p aria-live="polite"><strong>{panels[shown]?.name}</strong><span>{shown + 1} of {panels.length}</span></p>
      <button type="button" aria-label="Next area" disabled={shown === panels.length - 1} onClick={() => setCurrent(shown + 1)}><ChevronRight size={18} aria-hidden="true" /></button>
    </div>}
    <ul>{panels.map((panel, index) => <TrendPanel key={panel.name} panel={panel} unit={column?.unit} current={index === shown} />)}</ul>
  </div>;
}

function TrendPanel({ panel, unit, current }: { panel: Panel; unit?: string; current: boolean }) {
  const estimates = panel.points.filter(point => !point.projection);
  const projection = panel.points.find(point => point.projection);
  const first = estimates[0], last = estimates.at(-1);
  // The chart is drawn in its box's own pixels, so it can fill whatever room
  // the panel gives it while its year labels and points keep their size.
  const plot = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 240, height: 92 });
  useLayoutEffect(() => {
    const element = plot.current;
    if (!element) return;
    const measure = () => { const width = element.clientWidth, height = element.clientHeight; if (width > 0 && height > 0) setSize(previous => previous.width === width && previous.height === height ? previous : { width, height }); };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const { width, height } = size, left = 6, right = 6, top = 10, bottom = 20;
  const values = panel.points.map(point => point.value);
  const low = Math.min(...values), high = Math.max(...values);
  const pad = (high - low || high * 0.02 || 1) * 0.18;
  const y = (value: number) => top + (high + pad - value) / (high - low + pad * 2) * (height - top - bottom);
  const step = (width - left - right) / Math.max(panel.points.length - 1, 1);
  const x = (index: number) => left + index * step;
  const at = (point: Point) => panel.points.indexOf(point);
  const change = (from?: Point, to?: Point) => from && to && from.value ? (to.value - from.value) / from.value * 100 : undefined;
  const percent = (value?: number) => value === undefined ? "" : `${value > 0 ? "+" : value < 0 ? "−" : "±"}${Math.abs(value).toFixed(1)}%`;
  const estimateChange = change(first, last);
  const projectionChange = change(last, projection);
  const summary = `${panel.name}: ${first ? `${formatValue(first.value, unit)} in the ${first.year} estimate` : ""}${last && last !== first ? `, ${formatValue(last.value, unit)} in the ${last.year} estimate` : ""}${projection ? `, ${formatValue(projection.value, unit)} in the ${projection.year} projection` : ""}.`;
  return <li className={`atlas-trend-panel${panel.note ? " is-total" : ""}${current ? " is-current" : ""}`}>
    <div className="atlas-trend-heading"><h4>{panel.name}</h4>{panel.note && <span>{panel.note}</span>}</div>
    <div ref={plot} className="atlas-trend-plot"><svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={summary}>
      {projection && <rect className="atlas-trend-band" x={x(at(projection)) - step / 2} y={0} width={width - (x(at(projection)) - step / 2)} height={height - bottom + 4} />}
      <polyline className="atlas-trend-line" points={estimates.map(point => `${x(at(point))},${y(point.value)}`).join(" ")} />
      {estimates.map(point => <circle key={point.year} className="atlas-trend-estimate" cx={x(at(point))} cy={y(point.value)} r={3.5} />)}
      {projection && <circle className="atlas-trend-projection" cx={x(at(projection))} cy={y(projection.value)} r={4.5} />}
      {panel.points.map((point, index) => (index === 0 || point === last || point === projection) && <text key={point.year} className="atlas-trend-year" x={x(index)} y={height - 5} textAnchor={index === 0 ? "start" : point === projection ? "end" : "middle"}>{point.year}</text>)}
    </svg></div>
    <dl>
      {first && last && <div><dt>Estimates {first.year}→{last.year}</dt><dd><span>{percent(estimateChange)}</span>{formatValue(first.value)} → {formatValue(last.value)}</dd></div>}
      {projection && <div className="is-projection"><dt>{last ? <>Projection {last.year}→{projection.year}</> : <>{projection.year} projection</>}</dt><dd><span>{percent(projectionChange)}</span>{formatValue(projection.value)}</dd></div>}
    </dl>
  </li>;
}
