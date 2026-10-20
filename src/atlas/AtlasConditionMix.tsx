import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { formatMeasure } from "@pgmaps/geo-toolkit/format";
import type { AtlasDataset, AtlasRow } from "./types";
import "./condition-mix.css";

interface AtlasConditionMixProps {
  dataset: AtlasDataset;
  rows: AtlasRow[];
  metric: string;
  compact?: boolean;
}

type MixMetric = {
  share: boolean;
  countField: string;
  shareField: string;
  denominatorField: string;
  recruiting: boolean;
};
const METRICS: Record<string, MixMetric> = {
  condition_share_pct: { share: true, countField: "studies", shareField: "condition_share_pct", denominatorField: "city_studies", recruiting: false },
  studies: { share: false, countField: "studies", shareField: "condition_share_pct", denominatorField: "city_studies", recruiting: false },
  recruiting_condition_share_pct: { share: true, countField: "recruiting_snapshot_studies", shareField: "recruiting_condition_share_pct", denominatorField: "city_recruiting_snapshot_studies", recruiting: true },
  recruiting_snapshot_studies: { share: false, countField: "recruiting_snapshot_studies", shareField: "recruiting_condition_share_pct", denominatorField: "city_recruiting_snapshot_studies", recruiting: true },
};

// Five UNBC-compatible roots, with related tones and redundant pattern/number
// encodings. Category identity is stable when cities or domains are filtered.
const COLORS = ["#035642", "#977000", "#43677a", "#75536b", "#697144", "#568174", "#b59952", "#88a0ac", "#aa8e9e", "#9aa384", "#d6e3dc", "#ece2c8", "#dde6ea"];
const PATTERNS = [
  "none",
  "repeating-linear-gradient(135deg, transparent 0 4px, #ffffff60 4px 6px)",
  "repeating-linear-gradient(90deg, transparent 0 4px, #29292a35 4px 5px)",
];

function number(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function exact(value: number | null, percent = false): string {
  // Display the reviewed source precision, rather than rounding small domains
  // to zero. The share fields are supplied by the reviewed release.
  return formatMeasure(value, percent ? "%" : undefined, { fallback: "Not reported", maximumFractionDigits: 12 });
}
function rowKey(row: AtlasRow): string {
  return JSON.stringify([row.query_city, row.condition_domain, row.snapshot_date]);
}
function domainStyle(index: number): CSSProperties {
  return {
    backgroundColor: COLORS[index % COLORS.length],
    backgroundImage: PATTERNS[Math.floor(index / 5) % PATTERNS.length],
    color: index % COLORS.length < 5 ? "#fff" : "#29292a",
    "--mix-color": COLORS[index % COLORS.length],
  } as CSSProperties;
}

export default function AtlasConditionMix({ dataset, rows, metric, compact = false }: AtlasConditionMixProps) {
  const definition = METRICS[metric];
  const tooltipId = useId();
  const helpId = useId();
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hoverAnchorRef = useRef<HTMLElement | null>(null);
  const focusAnchorRef = useRef<HTMLElement | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ left: 16, top: 16, width: 310 });
  const domains = useMemo(() => [...new Set(dataset.rows.map(row => String(row.condition_domain ?? "")))].filter(Boolean).sort((a, b) => a.localeCompare(b)), [dataset.rows]);
  const domainIndexes = useMemo(() => new Map(domains.map((domain, index) => [domain, index])), [domains]);
  const activeKey = hovered ?? focused;
  const active = rows.find(row => rowKey(row) === activeKey);
  const snapshotLabel = dataset.columns.find(column => column.key === "snapshot_date")?.label ?? "Aligned comparator snapshot";
  const metricLabel = dataset.columns.find(column => column.key === metric)?.label ?? metric;

  const bars = useMemo(() => {
    if (!definition) return [];
    const grouped = new Map<string, AtlasRow[]>();
    for (const row of rows) {
      const city = String(row.query_city ?? "Unspecified city");
      grouped.set(city, [...(grouped.get(city) ?? []), row]);
    }
    return [...grouped].sort(([a], [b]) => a.localeCompare(b)).map(([city, records]) => {
      const denominators = records.map(row => number(row[definition.denominatorField]));
      const uniqueDenominators = new Set(denominators);
      const denominator = uniqueDenominators.size === 1 ? denominators[0] : null;
      const counts = records.map(row => number(row[definition.countField]));
      const visibleCount = counts.every((value): value is number => value !== null) ? counts.reduce((total, value) => total + value, 0) : null;
      const duplicate = new Set(records.map(row => String(row.condition_domain))).size !== records.length;
      const invalid = duplicate || denominator === null || (visibleCount !== null && visibleCount > denominator);
      return { city, records: [...records].sort((a, b) => (domainIndexes.get(String(a.condition_domain)) ?? 0) - (domainIndexes.get(String(b.condition_domain)) ?? 0)), denominator, visibleCount, invalid };
    });
  }, [rows, definition, domainIndexes]);
  const axisMaximum = useMemo(() => definition?.share ? 100 : Math.max(0, ...dataset.rows.map(row => number(row[definition?.denominatorField ?? ""]) ?? 0)), [definition, dataset.rows]);

  useEffect(() => { setHovered(null); setFocused(null); hoverAnchorRef.current = null; focusAnchorRef.current = null; }, [rows, metric]);
  useLayoutEffect(() => {
    if (!active) return;
    const place = () => {
      const anchor = hovered ? hoverAnchorRef.current : focusAnchorRef.current;
      if (!anchor?.isConnected) return;
      const rect = anchor.getBoundingClientRect();
      const width = Math.min(310, window.innerWidth - 32);
      const height = tooltipRef.current?.getBoundingClientRect().height ?? 160;
      const left = Math.max(16, Math.min(rect.left, window.innerWidth - width - 16));
      const below = rect.bottom + 8;
      const top = Math.max(8, below + height < window.innerHeight - 8 ? below : rect.top - height - 8);
      setTooltipPosition({ left, top, width });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [active, hovered, focused]);

  function inspect(row: AtlasRow, anchor: HTMLElement, interaction: "hover" | "focus") {
    if (interaction === "hover") { hoverAnchorRef.current = anchor; setHovered(rowKey(row)); }
    else { focusAnchorRef.current = anchor; setFocused(rowKey(row)); }
  }
  function dismiss() { setHovered(null); setFocused(null); }
  function inspectedLabel(row: AtlasRow) {
    return `${row.query_city}, ${row.condition_domain}: ${exact(number(row.studies))} source studies, ${exact(number(row.condition_share_pct), true)} of ${exact(number(row.city_studies))} city studies; ${exact(number(row.recruiting_snapshot_studies))} historical recruiting studies, ${exact(number(row.recruiting_condition_share_pct), true)} of ${exact(number(row.city_recruiting_snapshot_studies))} city historical recruiting studies`;
  }

  if (!definition) return <section className="condition-mix-chart" data-testid="condition-mix-chart" data-source-count={rows.length}><p role="status">This measure has no reviewed condition-composition definition. Choose a condition count or share.</p></section>;
  if (!rows.length) return <section className="condition-mix-chart" data-testid="condition-mix-chart" data-source-count="0"><p role="status">No condition records match these filters.</p></section>;

  return <section className={`condition-mix-chart${compact ? " is-compact" : ""}`} data-testid="condition-mix-chart" data-metric={metric} data-source-count={rows.length} data-domain-count={domains.length} data-scale-max={axisMaximum} aria-label="Clinical study condition mix by city">
    <div className="condition-mix-heading">
      {!compact && <h3>Condition mix by city</h3>}
      <p>{definition.share ? `Share of each city's full ${definition.recruiting ? "historical recruiting" : "study"} snapshot (%)` : `${definition.recruiting ? "Historical recruiting study" : "Source study"} counts · shared scale from zero`}</p>
    </div>
    <div className="condition-mix-bars" aria-describedby={helpId}>
      {bars.map(bar => {
        let offset = 0;
        return <div className="condition-mix-city" key={bar.city} data-city={bar.city} data-source-count={bar.visibleCount ?? "unavailable"} data-denominator={bar.denominator ?? "unavailable"} data-record-count={bar.records.length} data-invalid={bar.invalid}>
          <div className="condition-mix-city-label"><strong>{bar.city}</strong><span>City total: {exact(bar.denominator)}{compact ? "" : definition.recruiting ? " historical recruiting studies" : " source studies"}</span></div>
          <div>
            <div className="condition-mix-track" role="group" aria-label={`${bar.city} · ${metricLabel} · full city denominator ${exact(bar.denominator)}`}>
              {!bar.invalid && bar.records.map(row => {
                const value = number(row[metric]);
                const count = number(row[definition.countField]);
                const share = number(row[definition.shareField]);
                const index = domainIndexes.get(String(row.condition_domain)) ?? 0;
                const valid = value !== null && value >= 0 && (!definition.share || (value <= 100 && bar.denominator !== 0));
                const width = valid && axisMaximum > 0 ? value / axisMaximum * 100 : 0;
                const left = offset;
                offset += width;
                // A reported zero occupies no area. Its original zero remains
                // keyboard-inspectable in the source table below.
                if (width === 0) return null;
                const key = rowKey(row);
                return <button key={key} type="button" className="condition-mix-segment" style={{ ...domainStyle(index), left: `${left}%`, width: `${width}%` }} data-city={bar.city} data-domain={String(row.condition_domain)} data-source-count={count ?? "unavailable"} data-denominator={bar.denominator ?? "unavailable"} data-source-share={share ?? "unavailable"} data-value={value} aria-label={inspectedLabel(row)} aria-describedby={activeKey === key ? tooltipId : undefined}
                  onPointerEnter={event => inspect(row, event.currentTarget, "hover")} onPointerLeave={() => setHovered(null)} onFocus={event => inspect(row, event.currentTarget, "focus")} onBlur={() => setFocused(null)} onClick={event => inspect(row, event.currentTarget, "focus")} onKeyDown={event => { if (event.key === "Escape") { dismiss(); event.stopPropagation(); } }}>
                  {width >= 5.5 && <span aria-hidden="true">{index + 1}</span>}
                </button>;
              })}
            </div>
            {bar.invalid && <p className="condition-mix-row-note">Stack withheld: conflicting denominator or duplicate categories. Inspect the source rows.</p>}
            {!bar.invalid && definition.share && bar.denominator === 0 && <p className="condition-mix-row-note">City denominator is zero; a share is unavailable. Source zeros remain in the table.</p>}
            {!bar.invalid && bar.visibleCount !== null && bar.denominator !== null && bar.visibleCount < bar.denominator && <span className="condition-mix-shown">Shown categories: {exact(bar.visibleCount)} of {exact(bar.denominator)} source {definition.recruiting ? "historical recruiting " : ""}studies</span>}
          </div>
        </div>;
      })}
      <div className="condition-mix-axis" aria-label={definition.share ? "Percent scale from zero to one hundred" : `Source count scale from zero to ${exact(axisMaximum)}`}>
        {[0, 0.25, 0.5, 0.75, 1].map(part => <span key={part}>{exact(axisMaximum * part, definition.share)}</span>)}
      </div>
    </div>
    <details className="condition-mix-key" open={compact ? undefined : true}>
      <summary>Condition key · {domains.length} source categories</summary>
      <ol className="condition-mix-legend">{domains.map((domain, index) => <li key={domain}><span className="condition-mix-swatch" style={domainStyle(index)} aria-hidden="true">{index + 1}</span><span>{domain}</span></li>)}</ol>
    </details>
    <p className="condition-mix-note" id={helpId}>{definition.share ? "Filters retain full-city denominators; unshown shares are not redistributed." : "Stacks retain original category counts; the shared scale stays fixed under filters."} Study matches can overlap across cities. {definition.recruiting && "Recruiting is a historical overall study status."}</p>
    <details className="condition-mix-values">
      <summary>Inspect source values · {rows.length} records, including zeros</summary>
      <div className="condition-mix-table-scroll" tabIndex={0} role="region" aria-label="Condition source values; scroll for all columns">
        <table>
          <caption>Original filtered city/condition records. Shares use the full city snapshot; omitted category rows are not invented as zeros.</caption>
          <thead><tr><th scope="col">City / condition</th><th scope="col">Source studies</th><th scope="col">Share of city studies</th><th scope="col">Historical recruiting</th><th scope="col">Share of city historical recruiting</th><th scope="col">Full city denominators</th></tr></thead>
          <tbody>{bars.flatMap(bar => bar.records.map(row => {
            const key = rowKey(row);
            const index = domainIndexes.get(String(row.condition_domain)) ?? 0;
            return <tr key={key}><th scope="row"><button type="button" className="condition-mix-inspect" aria-label={`Inspect ${row.query_city}, ${row.condition_domain}`} aria-describedby={activeKey === key ? tooltipId : undefined} onPointerEnter={event => inspect(row, event.currentTarget, "hover")} onPointerLeave={() => setHovered(null)} onFocus={event => inspect(row, event.currentTarget, "focus")} onBlur={() => setFocused(null)} onClick={event => inspect(row, event.currentTarget, "focus")} onKeyDown={event => { if (event.key === "Escape") { dismiss(); event.stopPropagation(); } }}><span className="condition-mix-swatch" style={domainStyle(index)} aria-hidden="true">{index + 1}</span><span>{row.query_city}<br />{row.condition_domain}</span></button></th><td>{exact(number(row.studies))}</td><td>{exact(number(row.condition_share_pct), true)}</td><td>{exact(number(row.recruiting_snapshot_studies))}</td><td>{exact(number(row.recruiting_condition_share_pct), true)}</td><td>{exact(number(row.city_studies))} studies<br />{exact(number(row.city_recruiting_snapshot_studies))} historical recruiting</td></tr>;
          }))}</tbody>
        </table>
      </div>
    </details>
    {active && typeof document !== "undefined" && createPortal(<div ref={tooltipRef} className="condition-mix-tooltip" id={tooltipId} role="tooltip" style={tooltipPosition}>
      <strong>{active.query_city} · {active.condition_domain}</strong>
      <span>{exact(number(active.studies))} source studies · {exact(number(active.condition_share_pct), true)}</span>
      <small>Denominator: {exact(number(active.city_studies))} full-city source studies</small>
      <span>{exact(number(active.recruiting_snapshot_studies))} historical recruiting studies · {exact(number(active.recruiting_condition_share_pct), true)}</span>
      <small>Denominator: {exact(number(active.city_recruiting_snapshot_studies))} full-city historical recruiting studies</small>
      {active.snapshot_date != null && <small>{snapshotLabel}: {active.snapshot_date}</small>}
    </div>, document.body)}
  </section>;
}
