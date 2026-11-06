import { useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent, type RefObject } from "react";
import type { AtlasDataset, AtlasRow } from "./types";
import { formatValue } from "./AtlasChart";

type Point = { year: string; value: number; projection: boolean };
type Panel = { name: string; points: Point[]; note?: string };
type Box = { width: number; height: number };

const estimatesOf = (panel: Panel) => panel.points.filter(point => !point.projection);
const projectionOf = (panel: Panel) => panel.points.find(point => point.projection);
const signed = (value: number, digits = 1) => `${value > 0 ? "+" : value < 0 ? "−" : "±"}${Math.abs(value).toFixed(digits)}%`;
const sinceFirst = (panel: Panel, point: Point) => { const base = panel.points[0]!.value; return (point.value - base) / base * 100; };
const change = (panel: Panel) => sinceFirst(panel, estimatesOf(panel).at(-1)!);
const summary = (panel: Panel, unit?: string) => {
  const estimates = estimatesOf(panel), first = estimates[0], last = estimates.at(-1), projection = projectionOf(panel);
  return `${panel.name}: ${first ? `${formatValue(first.value, unit)} in the ${first.year} estimate` : ""}${last && last !== first ? `, ${formatValue(last.value, unit)} in the ${last.year} estimate` : ""}${projection ? `, ${formatValue(projection.value, unit)} in the ${projection.year} projection` : ""}.`;
};

function niceTicks(low: number, high: number, count: number) {
  const rough = (high - low) / count, power = 10 ** Math.floor(Math.log10(rough)), ratio = rough / power;
  const step = (ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 5 ? 5 : 10) * power;
  const ticks: number[] = [];
  for (let tick = Math.ceil(low / step) * step; tick <= high + step * 1e-6; tick += step) ticks.push(Math.round(tick / step) * step);
  return ticks;
}

/** A shared vertical range, in percent since each series' first point. */
function percentRange(panels: Panel[]): [number, number] {
  const percents = panels.flatMap(panel => panel.points.map(point => sinceFirst(panel, point)));
  return [Math.floor(Math.min(...percents)) - 1, Math.ceil(Math.max(...percents)) + 1];
}

// A chart is drawn in its box's own pixels, so it can fill whatever room the
// panel gives it while its labels and points keep their size.
function useBox(): [RefObject<HTMLDivElement>, Box] {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Box>({ width: 320, height: 160 });
  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const measure = () => { const width = element.clientWidth, height = element.clientHeight; if (width > 0 && height > 0) setSize(previous => previous.width === width && previous.height === height ? previous : { width, height }); };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [box, size];
}

/** Which year column the pointer is over. Touch has no hover, so a tap opens a year and a second tap closes it. */
function useYearPointer(count: number, left: number, step: number) {
  const [index, setIndex] = useState<number>();
  const at = (event: { clientX: number; currentTarget: Element }) => {
    const found = Math.floor((event.clientX - event.currentTarget.getBoundingClientRect().left - left) / step);
    return found >= 0 && found < count ? found : undefined;
  };
  return {
    index,
    pointer: {
      onPointerMove: (event: PointerEvent<SVGSVGElement>) => { if (event.pointerType === "mouse") setIndex(at(event)); },
      onPointerLeave: (event: PointerEvent<SVGSVGElement>) => { if (event.pointerType === "mouse") setIndex(undefined); },
      onClick: (event: MouseEvent<SVGSVGElement>) => {
        if ((event.nativeEvent as globalThis.PointerEvent).pointerType === "mouse") return;
        const found = at(event);
        setIndex(current => current === found ? undefined : found);
      },
    },
  };
}

function YearTip({ year, projection, x, width, rows }: { year: string; projection: boolean; x: number; width: number; rows: { name: string; value: number; percent: number; total?: boolean }[] }) {
  // Beside the year's line, on the roomier side, and never past the chart's edge.
  const tip = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState(0);
  useLayoutEffect(() => {
    const tipWidth = tip.current?.offsetWidth ?? 0;
    setLeft(Math.max(0, Math.min(x > width / 2 ? x - 12 - tipWidth : x + 12, width - tipWidth)));
  }, [x, width]);
  return <div ref={tip} className="atlas-trend-tip" data-testid="trend-tip" style={{ left }}>
    <p><strong>{year}</strong>{projection ? "Projection" : "Source estimate"}</p>
    <dl>{rows.map(row => <div key={row.name} className={row.total ? "is-total" : ""}><dt>{row.name}</dt><dd>{formatValue(row.value)}<span>{signed(row.percent)}</span></dd></div>)}</dl>
  </div>;
}

/**
 * Every area on one chart, in percent since the first year, so a large area and
 * a small one can be compared. Source estimates are joined by a line; the
 * projection is set apart in a shaded column and never joined to them. People
 * counts are in the table beneath.
 */
function Together({ panels, years, unit }: { panels: Panel[]; years: Point[]; unit?: string }) {
  const [box, { width, height }] = useBox();
  const [hot, setHot] = useState<string>();
  const left = 36, right = width < 480 ? 118 : 136, top = 12, bottom = 24;
  const [low, high] = percentRange(panels);
  const step = (width - left - right) / years.length;
  const { index: shown, pointer } = useYearPointer(years.length, left, step);
  const x = (index: number) => left + (index + 0.5) * step;
  const xOf = (point: Point) => x(years.findIndex(year => year.year === point.year));
  const y = (percent: number) => top + (high - percent) / (high - low) * (height - top - bottom);
  const projectionIndex = years.findIndex(point => point.projection);
  // End labels sit by their projection ring. Labels that would touch form a
  // group that spreads around its rings, so none drifts level with another's.
  const gap = 16;
  const rings = panels.map(panel => ({ panel, at: y(sinceFirst(panel, panel.points.at(-1)!)) })).sort((a, b) => a.at - b.at);
  const groups: (typeof rings)[] = [];
  for (const ring of rings) {
    const group = groups.at(-1);
    const middle = group && group.reduce((sum, item) => sum + item.at, 0) / group.length;
    if (group && middle !== undefined && ring.at - (middle + (group.length - 1) * gap / 2) < gap) group.push(ring); else groups.push([ring]);
  }
  const labels = groups.flatMap(group => {
    const middle = group.reduce((sum, item) => sum + item.at, 0) / group.length;
    return group.map((item, index) => ({ panel: item.panel, at: middle + (index - (group.length - 1) / 2) * gap }));
  });
  const firstEstimate = estimatesOf(panels[0]!)[0], lastEstimate = estimatesOf(panels[0]!).at(-1), projected = projectionOf(panels[0]!);
  const year = shown === undefined ? undefined : years[shown];
  return <div className="atlas-trend-together">
    <div ref={box} className="atlas-trend-plot">
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={panels.map(panel => summary(panel, unit)).join(" ")} {...pointer}>
        {projectionIndex >= 0 && <rect className="atlas-trend-band" x={x(projectionIndex) - step / 2} y={0} width={step} height={height - bottom + 2} />}
        {niceTicks(low, high, 6).map(tick => <g key={tick}><line className={tick ? "atlas-trend-grid" : "atlas-trend-base"} x1={left} x2={left + step * years.length} y1={y(tick)} y2={y(tick)} /><text className="atlas-trend-year" x={left - 8} y={y(tick) + 4} textAnchor="end">{tick ? signed(tick, 0) : "0%"}</text></g>)}
        {years.map((point, index) => <text key={point.year} className="atlas-trend-year" x={x(index)} y={height - 6} textAnchor="middle">{point.year}</text>)}
        {shown !== undefined && <line className="atlas-trend-cross" x1={x(shown)} x2={x(shown)} y1={0} y2={height - bottom + 2} />}
        {[...panels].reverse().map(panel => {
          const estimates = estimatesOf(panel), projection = projectionOf(panel);
          return <g key={panel.name} className={`atlas-trend-series${panel.note ? " is-total" : ""}${hot === panel.name ? " is-hot" : hot ? " is-dimmed" : ""}`}>
            <polyline points={estimates.map(point => `${xOf(point)},${y(sinceFirst(panel, point))}`).join(" ")} />
            {estimates.map(point => <circle key={point.year} cx={xOf(point)} cy={y(sinceFirst(panel, point))} r={3} />)}
            {projection && <circle className="atlas-trend-projection" cx={xOf(projection)} cy={y(sinceFirst(panel, projection))} r={4.5} />}
          </g>;
        })}
        {labels.map(label => <text key={label.panel.name} className={`atlas-trend-end${hot && hot !== label.panel.name ? " is-dimmed" : ""}${label.panel.note ? " is-total" : ""}`} x={left + step * years.length + 8} y={label.at + 4}>{label.panel.name}</text>)}
      </svg>
      {year && shown !== undefined && <YearTip year={year.year} projection={year.projection} x={x(shown)} width={width} rows={panels.flatMap(panel => {
        const point = panel.points.find(item => item.year === year.year);
        return point ? [{ name: panel.name, value: point.value, percent: sinceFirst(panel, point), total: Boolean(panel.note) }] : [];
      })} />}
    </div>
    <div className="atlas-trend-table"><table>
      <thead><tr><th scope="col">Area</th><th scope="col">{firstEstimate?.year} estimate</th><th scope="col">{lastEstimate?.year} estimate</th><th scope="col">Change {firstEstimate?.year}→{lastEstimate?.year}</th><th scope="col">{projected?.year} projection</th></tr></thead>
      <tbody>{panels.map(panel => {
        const estimates = estimatesOf(panel), projection = projectionOf(panel);
        return <tr key={panel.name} className={panel.note ? "is-total" : ""} onMouseEnter={() => setHot(panel.name)} onMouseLeave={() => setHot(undefined)}>
          <th scope="row">{panel.name}{panel.note && <span>{panel.note}</span>}</th>
          <td>{formatValue(estimates[0]?.value)}</td><td>{formatValue(estimates.at(-1)?.value)}</td><td>{signed(change(panel))}</td><td className="is-projection">{formatValue(projection?.value)}</td>
        </tr>;
      })}</tbody>
    </table></div>
  </div>;
}

/** One area large, in people. Every area spans the same percent range, so a bigger chart never makes a small change look steep. */
function LargeLine({ panel, spread, unit }: { panel: Panel; spread: [number, number]; unit?: string }) {
  const [box, { width, height }] = useBox();
  const left = width < 480 ? 50 : 58, right = 8, top = 26, bottom = 24;
  const base = panel.points[0]!.value, min = base * (1 + spread[0] / 100), max = base * (1 + spread[1] / 100);
  const step = (width - left - right) / panel.points.length;
  const { index: shown, pointer } = useYearPointer(panel.points.length, left, step);
  const x = (index: number) => left + (index + 0.5) * step;
  const y = (value: number) => top + (max - value) / (max - min) * (height - top - bottom);
  const estimates = estimatesOf(panel), projection = projectionOf(panel), at = (point: Point) => panel.points.indexOf(point);
  const labelled = [estimates[0], estimates.at(-1), projection].filter((point): point is Point => Boolean(point));
  const point = shown === undefined ? undefined : panel.points[shown];
  return <div ref={box} className="atlas-trend-plot">
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={summary(panel, unit)} {...pointer}>
      {projection && <rect className="atlas-trend-band" x={x(at(projection)) - step / 2} y={0} width={step / 2 + width - right - x(at(projection))} height={height - bottom + 2} />}
      {niceTicks(min, max, 5).map(tick => <g key={tick}><line className="atlas-trend-grid" x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} /><text className="atlas-trend-year" x={left - 8} y={y(tick) + 4} textAnchor="end">{formatValue(tick)}</text></g>)}
      {point && <line className="atlas-trend-cross" x1={x(at(point))} x2={x(at(point))} y1={0} y2={height - bottom + 2} />}
      <polyline className="atlas-trend-line" points={estimates.map(item => `${x(at(item))},${y(item.value)}`).join(" ")} />
      {estimates.map(item => <circle key={item.year} className="atlas-trend-estimate" cx={x(at(item))} cy={y(item.value)} r={4} />)}
      {projection && <circle className="atlas-trend-projection" cx={x(at(projection))} cy={y(projection.value)} r={5} />}
      {labelled.map(item => <text key={item.year} className="atlas-trend-value" x={x(at(item))} y={y(item.value) - 12} textAnchor="middle">{formatValue(item.value)}</text>)}
      {panel.points.map((item, index) => <text key={item.year} className="atlas-trend-year" x={x(index)} y={height - 6} textAnchor="middle">{item.year}</text>)}
    </svg>
    {point && <YearTip year={point.year} projection={point.projection} x={x(at(point))} width={width} rows={[{ name: panel.name, value: point.value, percent: sinceFirst(panel, point) }]} />}
  </div>;
}

function Spark({ panel }: { panel: Panel }) {
  const width = 72, height = 26, pad = 4;
  const values = panel.points.map(point => point.value), low = Math.min(...values), high = Math.max(...values);
  const x = (index: number) => pad + index * (width - pad * 2) / Math.max(panel.points.length - 1, 1);
  const y = (value: number) => pad + (high - value) / (high - low || 1) * (height - pad * 2);
  const estimates = estimatesOf(panel), projection = projectionOf(panel), at = (point: Point) => panel.points.indexOf(point);
  return <svg className="atlas-trend-spark" viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
    <polyline points={estimates.map(point => `${x(at(point))},${y(point.value)}`).join(" ")} />
    {projection && <circle cx={x(at(projection))} cy={y(projection.value)} r={2.5} />}
  </svg>;
}

/** One area large, with every area listed as the way to switch. Not the default; a chapter asks for it with `layout: "focus"`. */
function Focus({ panels, unit }: { panels: Panel[]; unit?: string }) {
  const [current, setCurrent] = useState(0);
  const panel = panels[Math.min(current, panels.length - 1)]!;
  const estimates = estimatesOf(panel), first = estimates[0]!, last = estimates.at(-1)!, projection = projectionOf(panel);
  return <div className="atlas-trend-focus">
    <section>
      <div className="atlas-trend-focus-head">
        <h4>{panel.name}{panel.note && <span>{panel.note}</span>}</h4>
        <div className="atlas-trend-figures">
          <p><b>{signed(change(panel))}</b>Estimates {first.year}→{last.year}</p>
          {projection && <p className="is-projection"><b>{formatValue(projection.value)}</b>{projection.year} projection</p>}
        </div>
      </div>
      <LargeLine key={panel.name} panel={panel} spread={percentRange(panels)} unit={unit} />
    </section>
    <nav aria-label="Choose an area">{panels.map((item, index) => <button key={item.name} type="button" aria-pressed={item === panel} onClick={event => { setCurrent(index); event.currentTarget.scrollIntoView({ inline: "center", block: "nearest" }); }}>
      <span>{item.name}</span><Spark panel={item} /><b>{signed(change(item))}</b>
    </button>)}</nav>
  </div>;
}

export default function AtlasEstimateTrends({ dataset, rows, metric, totalLabel, layout = "together" }: { dataset: AtlasDataset; rows: AtlasRow[]; metric: string; totalLabel?: string; layout?: "together" | "focus" }) {
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
  // Percent change needs an estimate and a non-zero start; an area without them
  // stays off the chart rather than reading as zero. The total leads, then the
  // areas from largest to smallest.
  const shown = panels
    .filter(panel => estimatesOf(panel).length > 0 && panel.points[0]!.value !== 0)
    .sort((a, b) => Number(Boolean(b.note)) - Number(Boolean(a.note)) || estimatesOf(b).at(-1)!.value - estimatesOf(a).at(-1)!.value);
  if (!shown.length) return null;
  const column = dataset.columns.find(item => item.key === metric);
  const label = column?.label ?? metric;
  const years = [...new Map(shown.flatMap(panel => panel.points).map(point => [point.year, point])).values()].sort((a, b) => a.year.localeCompare(b.year));
  return <div className={`atlas-trends is-${layout}`} data-testid="estimate-trends">
    <div className="atlas-trend-key">
      <strong>{layout === "together"
        ? <><span className="atlas-trend-key-long">{label} c</span><span className="atlas-trend-key-short">C</span>hange since {years[0]?.year}<span className="atlas-trend-key-long"> (%)</span></>
        : <>{label}<span className="atlas-trend-key-long">{column?.unit ? ` (${column.unit})` : ""} · same % range for every area</span></>}</strong>
      <span><i className="is-estimate" aria-hidden="true" /><span className="atlas-trend-key-long">Source e</span><span className="atlas-trend-key-short">E</span>stimate</span>
      <span><i className="is-projection" aria-hidden="true" />Projection</span>
    </div>
    {layout === "focus" ? <Focus panels={shown} unit={column?.unit} /> : <Together panels={shown} years={years} unit={column?.unit} />}
  </div>;
}
