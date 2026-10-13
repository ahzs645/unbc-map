import { useEffect, useMemo, useRef, useState } from "react";
import type { AtlasDataset, AtlasRow } from "./types";

export function formatValue(value: unknown, unit?: string): string {
  if (value === null || value === undefined || value === "") return "Not reported";
  if (typeof value !== "number") return String(value);
  const number = new Intl.NumberFormat("en-CA", { maximumFractionDigits: 2 }).format(value);
  if (unit === "%" || unit === "percent") return `${number}%`;
  if (unit && /^(CAD|\$|CAD\s*\$)$/i.test(unit)) return `$${number}`;
  return unit ? `${number} ${unit}` : number;
}

export function rowLabel(dataset: AtlasDataset, row: AtlasRow): string {
  const primary = String(row[dataset.entityField] ?? "Unspecified");
  // Numeric denominators can be table-only metadata. Keep them out of unlabeled
  // identity text; their named columns retain the exact values in the records.
  const details = dataset.columns.filter(column => column.type === "text" && column.key !== dataset.entityField && column.key !== dataset.boundaryKeyField && typeof row[column.key] === "string" && row[column.key] !== "").slice(0, 2).map(column => String(row[column.key]));
  if (dataset.timeField && !details.includes(String(row[dataset.timeField] ?? "")) && row[dataset.timeField] != null) details.unshift(String(row[dataset.timeField]));
  return [primary, ...details].join(" · ");
}

function periodYear(value: unknown): number {
  const text = String(value ?? "");
  if (/^\d{4}$/.test(text)) return Number(text);
  const month = text.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (month) return Number(month[1]) + (Number(month[2]) - 1) / 12;
  const quarter = text.match(/^(\d{4}) Q([1-4])$/);
  if (quarter) return Number(quarter[1]) + (Number(quarter[2]) - 1) / 4;
  const window = text.match(/^(\d{4})[–/-](\d{4})$/);
  // Source windows are displayed with their full labels. The first year only
  // positions a fiscal period or rolling three-year window on the time axis.
  return window && [1, 2].includes(Number(window[2]) - Number(window[1])) ? Number(window[1]) : NaN;
}

const SERIES_COLORS = ["#00583d", "#a06c2f", "#587ea0", "#8b5579", "#7c8436", "#b25147", "#447a72", "#77719b", "#4b687e", "#a37c81", "#578940", "#cc8a43", "#397d9e", "#968748", "#804e38", "#418b83", "#7b6689"];
function TrendChart({ dataset, rows, metric, unit, onSelect, embedded = false }: { dataset: AtlasDataset; rows: AtlasRow[]; metric: string; unit?: string; onSelect?: (row: AtlasRow) => void; embedded?: boolean }) {
  const field = dataset.timeField!;
  const entities = useMemo(() => [...new Set(rows.map(row => String(row[dataset.entityField] ?? "Unspecified")))], [rows, dataset.entityField]);
  const preferredEntities = useMemo(() => [...entities].sort((a, b) => {
    const priority = (entity: string) => /UNBC|Prince George/i.test(entity) ? 0 : /Northern|Northwest|Northeast|Interior/i.test(entity) ? 1 : 2;
    return priority(a) - priority(b);
  }).slice(0, 6), [entities]);
  const [selected, setSelected] = useState<string[]>(preferredEntities);
  const [active, setActive] = useState<AtlasRow | null>(null);
  const plotContainer = useRef<HTMLDivElement>(null);
  const [plotWidth, setPlotWidth] = useState(600);
  useEffect(() => { setSelected(preferredEntities); setActive(null); }, [preferredEntities]);
  useEffect(() => {
    const element = plotContainer.current;
    if (!element) return;
    const measure = () => setPlotWidth(Math.max(260, Math.floor(element.getBoundingClientRect().width)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const reportedYears = [...new Set(rows.map(row => periodYear(row[field])).filter(Number.isFinite))].sort((a, b) => a - b);
  const first = reportedYears[0], last = reportedYears[reportedYears.length - 1];
  const periodStrings = rows.map(row => String(row[field]));
  const cadence = periodStrings.every(period => /^\d{4}-\d{2}$/.test(period)) ? 12 : periodStrings.every(period => /^\d{4} Q[1-4]$/.test(period)) ? 4 : 1;
  const firstStep = Math.round(first * cadence), lastStep = Math.round(last * cadence);
  const years = Number.isFinite(first) && Number.isFinite(last) && last - first < 100 && (cadence > 1 || (Number.isInteger(first) && Number.isInteger(last)))
    ? Array.from({ length: lastStep - firstStep + 1 }, (_, index) => { const step = firstStep + index; return Math.floor(step / cadence) + (step % cadence) / cadence; }) : reportedYears;
  const yearFirst = years[0], yearLast = years[years.length - 1];
  const periodLabels = new Map(rows.map(row => [periodYear(row[field]), String(row[field])]));
  const projectedYears = new Set(rows.filter(row => row.population_type === "Projection").map(row => periodYear(row[field])));
  const visible = rows.filter(row => selected.includes(String(row[dataset.entityField] ?? "Unspecified")) && typeof row[metric] === "number" && Number.isFinite(row[metric]));
  const minimum = Math.min(0, ...visible.map(row => Number(row[metric])));
  const maximum = Math.max(0, ...visible.map(row => Number(row[metric]))) || 1;
  const width = plotWidth, height = width < 500 ? embedded ? 130 : 300 : 360, left = width < 500 ? 67 : 93, right = 24, top = 24, bottom = 44;
  const x = (year: number) => left + ((year - yearFirst) / (yearLast - yearFirst || 1)) * (width - left - right);
  const y = (value: number) => top + ((maximum - value) / (maximum - minimum || 1)) * (height - top - bottom);
  const tickEvery = years.length <= 6 ? 1 : Math.max(1, Math.ceil((years.length - 1) / (width < 500 ? 3 : 6)));
  const ticks = years.filter((_, index) => index === 0 || index === years.length - 1 || (index % tickEvery === 0 && years.length - 1 - index > tickEvery / 2));
  return <div ref={plotContainer}>
    <p className="atlas-chart-help">{selected.length} of {entities.length} {dataset.columns.find(column => column.key === dataset.entityField)?.label.toLowerCase() ?? "entities"} shown. Toggle a series below; select a point to read its exact value. Missing records break the line.</p>
    <svg className="atlas-trend-chart" viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`${dataset.columns.find(column => column.key === metric)?.label ?? metric} over ${periodLabels.get(yearFirst) ?? yearFirst} to ${periodLabels.get(yearLast) ?? yearLast}. ${selected.join(", ")}. ${unit ? `Unit: ${unit}.` : ""} Lines connect reported source records; gaps are not interpolated.`}>
      <title>{dataset.title}: {metric} over time</title>
      {Array.from({ length: 5 }, (_, index) => minimum + ((maximum - minimum) / 4) * index).map((value, index) => <g key={index}><line x1={left} y1={y(value)} x2={width - right} y2={y(value)} stroke="#dfe4d7" strokeWidth="1" /><text x={left - 12} y={y(value) + 4} textAnchor="end" fill="#66745e" fontSize="11">{new Intl.NumberFormat("en-CA", { notation: Math.abs(value) >= 1_000_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value)}</text></g>)}
      {ticks.map(year => { const label = periodLabels.get(year) ?? String(year); const window = /[–/-]/.test(label); return <text key={year} x={x(year)} y={height - (window ? 23 : 17)} textAnchor="middle" fill="#66745e" fontSize="11">{window ? <><tspan x={x(year)}>{label.slice(0, 5)}</tspan><tspan x={x(year)} dy="12">{label.slice(5)}</tspan></> : label}{projectedYears.has(year) ? "*" : ""}</text>; })}
      {entities.filter(entity => selected.includes(entity)).map(entity => {
        const color = SERIES_COLORS[entities.indexOf(entity) % SERIES_COLORS.length];
        const byYear = new Map(rows.filter(row => String(row[dataset.entityField] ?? "Unspecified") === entity).map(row => [periodYear(row[field]), row]));
        const paths = { estimates: "", projections: "" };
        let previous: { year: number; value: number; projected: boolean } | null = null;
        years.forEach(year => {
          const row = byYear.get(year), value = row?.[metric];
          if (typeof value !== "number" || !Number.isFinite(value)) { previous = null; return; }
          const projected = row?.population_type === "Projection";
          const previousYear = previous?.year;
          const withheldGap = previousYear !== undefined && dataset.withheldPeriods?.some(period => periodYear(period) > previousYear && periodYear(period) < year);
          if (previous && !withheldGap) paths[projected || previous.projected ? "projections" : "estimates"] += `M${x(previous.year)} ${y(previous.value)} L${x(year)} ${y(value)} `;
          previous = { year, value, projected };
        });
        return <g key={entity}><path d={paths.estimates} stroke={color} fill="none" strokeWidth="2.5" /><path d={paths.projections} stroke={color} fill="none" strokeWidth="2.5" strokeDasharray="5 4" />{years.map(year => { const row = byYear.get(year), value = row?.[metric]; if (!row || typeof value !== "number" || !Number.isFinite(value)) return null; const select = () => { setActive(row); onSelect?.(row); }; const projected = row.population_type === "Projection"; const label = `${entity}, ${periodLabels.get(year) ?? year}${projected ? " (Projection)" : ""}: ${formatValue(value, unit)}`; return <circle key={year} cx={x(year)} cy={y(value)} r="5" fill={projected ? "#fff" : color} stroke={projected ? color : "#fafaf5"} strokeWidth={projected ? "2" : "1.5"} tabIndex={0} role="button" aria-label={label} style={{ cursor: "pointer" }} onClick={select} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(); } }}><title>{label}</title></circle>; })}</g>;
      })}
    </svg>
    <div className="atlas-trend-legend" aria-label="Choose trend series">{entities.map((entity, index) => <label key={entity}><input type="checkbox" checked={selected.includes(entity)} onChange={() => { setSelected(current => current.includes(entity) ? current.filter(item => item !== entity) : [...current, entity]); setActive(null); }} /><i style={{ background: SERIES_COLORS[index % SERIES_COLORS.length] }} />{entity}</label>)}</div>
    <p className="atlas-chart-footnote">{visible.length} reported values in selected series. Each point represents one source record; values are not summed.{unit ? ` Unit: ${unit}.` : ""} See the table for all records and missing values.</p>
    {projectedYears.size > 0 && <p className="atlas-chart-footnote">* {Array.from(projectedYears).sort().join(", ")}: source projection. Hollow points and dashed lines distinguish projections from estimates.</p>}
    {!!dataset.withheldPeriods?.length && <p className="atlas-chart-footnote">Withheld source periods: {dataset.withheldPeriods.join(', ')}. No total is shown for these periods and lines stop across the gap. See source notes for the missing-data reason.</p>}
    {active && <div className="atlas-chart-selection" role="status"><strong>{rowLabel(dataset, active)}</strong><span>{formatValue(active[metric], unit)}</span></div>}
  </div>;
}

export default function AtlasChart({ dataset, rows, metric, compact = false, embedded = false, onSelect }: { dataset: AtlasDataset; rows: AtlasRow[]; metric: string; compact?: boolean; embedded?: boolean; onSelect?: (row: AtlasRow) => void }) {
  const [sort, setSort] = useState("source");
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [mode, setMode] = useState<"trend" | "records">("trend");
  const column = dataset.columns.find(item => item.key === metric);
  const rowUnits = [...new Set(rows.map(row => row.unit).filter(value => value != null && value !== "").map(String))];
  const unit = rowUnits.length === 1 ? rowUnits[0] : column?.unit;
  const times = dataset.timeField ? [...new Set(rows.map(row => periodYear(row[dataset.timeField!])).filter(Number.isFinite))] : [];
  const pairs = dataset.timeField ? rows.map(row => `${row[dataset.entityField]}|${row[dataset.timeField!]}`) : [];
  const canTrend = !!dataset.timeField && times.length > 1 && pairs.length === new Set(pairs).size;
  const numeric = useMemo(() => {
    const values = rows.filter(row => typeof row[metric] === "number" && Number.isFinite(row[metric])).map(row => ({ row, value: row[metric] as number }));
    if (sort === "high") values.sort((a, b) => b.value - a.value);
    if (sort === "low") values.sort((a, b) => a.value - b.value);
    return values;
  }, [rows, metric, sort]);
  const limit = compact ? 5 : expanded ? numeric.length : 24;
  const shown = numeric.slice(0, limit);
  const minimum = Math.min(0, ...numeric.map(item => item.value));
  const maximum = Math.max(0, ...numeric.map(item => item.value));
  const range = maximum - minimum || 1;
  const zero = (-minimum / range) * 100;
  const missing = rows.length - numeric.length;

  if (rowUnits.length > 1) return <div className="atlas-empty"><strong>These records use different units.</strong><p>Filter to one unit or view the table. Comparing {rowUnits.join(", ")} on a shared numeric axis would be misleading.</p></div>;
  if (!numeric.length) return <div className="atlas-empty"><strong>No reported numeric values in this view.</strong><p>Try another measure or clear your filters. Missing values are kept as missing.</p></div>;

  return <div className={`atlas-chart${compact ? " atlas-chart-compact" : ""}${embedded ? " atlas-chart-embedded" : ""}`}>
    {!compact && <div className="atlas-chart-heading"><div><h3>{column?.label ?? metric}</h3><p>{unit ? `Unit: ${unit}. ` : ""}{canTrend && mode === "trend" ? "Compare reported source records over time." : "Each bar represents one source record; values are not summed."}</p></div>{(!canTrend || mode === "records") && <label className="atlas-sort">Order<select aria-label="Chart order" value={sort} onChange={event => { setSort(event.target.value); setActive(null); }}><option value="source">Source order</option><option value="high">Highest first</option><option value="low">Lowest first</option></select></label>}</div>}
    {!compact && canTrend && <div className="atlas-chart-mode" aria-label="Chart type"><button className={mode === "trend" ? "is-active" : ""} aria-pressed={mode === "trend"} onClick={() => setMode("trend")}>Trends over time</button><button className={mode === "records" ? "is-active" : ""} aria-pressed={mode === "records"} onClick={() => setMode("records")}>Source record bars</button></div>}
    {!compact && canTrend && mode === "trend" ? <TrendChart dataset={dataset} rows={rows} metric={metric} unit={unit} onSelect={onSelect} embedded={embedded} /> : <>
    <div className="atlas-bars" role="list" aria-label={`${column?.label ?? metric} by source record`}>
      {shown.map(({ row, value }, index) => {
        const left = value < 0 ? ((value - minimum) / range) * 100 : zero;
        const width = (Math.abs(value) / range) * 100;
        const label = rowLabel(dataset, row);
        return <button type="button" role="listitem" className={`atlas-bar-row${active === index ? " is-active" : ""}`} key={`${index}-${label}`} title={`${label}: ${formatValue(value, unit)}`} aria-label={`${label}: ${formatValue(value, unit)}`} onClick={() => { setActive(index); onSelect?.(row); }}>
          <span className="atlas-bar-label">{label}</span><span className="atlas-bar-track"><span className="atlas-bar-zero" style={{ left: `${zero}%` }} /><span className="atlas-bar-fill" style={{ left: `${left}%`, width: `${value === 0 ? 0 : Math.max(width, .5)}%` }} /></span><span className="atlas-bar-value">{formatValue(value, unit)}</span>
        </button>;
      })}
    </div>
    {!compact && <><div className="atlas-chart-axis"><span>{formatValue(minimum, unit)}</span><span>{formatValue(maximum, unit)}</span></div><p className="atlas-chart-footnote">{numeric.length.toLocaleString()} records with reported values{missing > 0 ? ` · ${missing.toLocaleString()} missing values omitted from chart` : ""}{shown.length < numeric.length ? ` · displaying first ${shown.length}` : ""}.</p>{numeric.length > 24 && <button className="atlas-text-button" onClick={() => setExpanded(value => !value)}>{expanded ? "Show first 24 records" : `Show all ${numeric.length.toLocaleString()} records`}</button>}{active !== null && shown[active] && <div className="atlas-chart-selection" role="status"><strong>{rowLabel(dataset, shown[active].row)}</strong><span>{formatValue(shown[active].value, unit)}</span></div>}</>}
    </>}
  </div>;
}
