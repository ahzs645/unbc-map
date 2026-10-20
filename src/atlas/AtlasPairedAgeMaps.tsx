import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import AtlasMap, { type AtlasMapCamera } from './AtlasMap';
import type { AtlasDataset, AtlasRow } from './types';
import type { AtlasBasemap } from './basemaps';
import { getBoundaryJoin } from './geography';
import './paired-age-maps.css';

interface Props {
  dataset: AtlasDataset;
  rows: AtlasRow[];
  compact?: boolean;
  focusRegions?: string[];
  selectedRegion?: string;
  onSelectRegion?: (value: string | null) => void;
  /** Kept mounted but hidden in a story reader. */
  dormant?: boolean;
}
type AgeView = 'share' | 'count';
const views = [
  { id: 'share' as const, metric: 'share_65_plus', title: 'Share aged 65+', unit: '%' },
  { id: 'count' as const, metric: 'population_65_plus', title: 'People aged 65+', unit: 'people' },
];

function exactValue(value: unknown, percentage = false) {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('en-CA', { maximumFractionDigits: percentage ? 6 : 0 }).format(value) + (percentage ? '%' : '')
    : 'No value';
}
function sameCamera(a: AtlasMapCamera | undefined, b: AtlasMapCamera) {
  return !!a && [...a.center, a.zoom, a.bearing, a.pitch].every((value, i) => Math.abs(value - [...b.center, b.zoom, b.bearing, b.pitch][i]) < 0.000001);
}

/** Recreate the camera only when the geographic subset changes, never when a
 * reader selects a region or changes between years of the same areas. */
export default function AtlasPairedAgeMaps(props: Props) {
  const geographicContext = useMemo(() => JSON.stringify([
    props.dataset.id,
    [...new Set(props.rows.map(row => getBoundaryJoin(props.dataset, row)).filter(Boolean))].sort(),
    [...props.focusRegions ?? []].sort(),
  ]), [props.dataset, props.rows, props.focusRegions]);
  return <PairedAgeWorkspace key={geographicContext} {...props} />;
}

function PairedAgeWorkspace({ dataset, rows, compact = false, focusRegions, selectedRegion, onSelectRegion, dormant = false }: Props) {
  const host = useRef<HTMLElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [width, setWidth] = useState(0);
  const [activeView, setActiveView] = useState<AgeView>('share');
  const [camera, setCamera] = useState<AtlasMapCamera>();
  const [basemap, setBasemap] = useState<AtlasBasemap>('streets');
  const [localSelection, setLocalSelection] = useState<string | null>(null);
  const [fitRevision, setFitRevision] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const labelId = useId();
  const narrow = compact && width < 600;
  // A parent callback makes selection controlled, including an explicit clear
  // represented by undefined. Standalone readers retain a local selection.
  const selection = onSelectRegion ? selectedRegion ?? null : selectedRegion ?? localSelection;
  const entities = useMemo(() => [...new Set(rows.map(row => String(row[dataset.entityField])))].sort((a, b) => a.localeCompare(b)), [dataset.entityField, rows]);
  const periods = [...new Set(rows.map(row => String(row[dataset.timeField ?? 'year'] ?? '')).filter(Boolean))].sort();
  const sourceTypes = [...new Set(rows.map(row => String(row.population_type ?? '')).filter(Boolean))];
  const coverage = new Set(dataset.rows.map(row => getBoundaryJoin(dataset, row)).filter(Boolean)).size;
  const currentCoverage = new Set(rows.map(row => getBoundaryJoin(dataset, row)).filter(Boolean)).size;
  const multiplePeriods = periods.length > 1;
  const periodCaption = `${periods.length === 1 ? periods[0] : periods.length ? 'All selected periods' : 'No period selected'}${sourceTypes.length ? ` · ${sourceTypes.join(' / ')}` : ''}`;
  const publishCamera = useCallback((next: AtlasMapCamera, view: AgeView, inDialog: boolean) => {
    if (expanded && !inDialog) return;
    // Initial MapLibre resize events can precede the boundary snapshot. Sharing
    // that provisional BC camera would prevent either map fitting its data.
    const scope = inDialog ? host.current?.querySelector('.atlas-age-map-dialog') : host.current?.querySelector('.atlas-age-map-content');
    const state = scope?.querySelector(`.atlas-age-map-${view} [data-testid="atlas-map-state"]`);
    if (state?.getAttribute('data-ready') !== 'true') return;
    setCamera(previous => sameCamera(previous, next) ? previous : next);
  }, [expanded]);
  const select = (value: string | null) => { setLocalSelection(value); onSelectRegion?.(value); };
  const fit = () => { setCamera(undefined); setFitRevision(previous => previous + 1); };

  useLayoutEffect(() => {
    const element = host.current;
    if (!element) return;
    const measure = () => setWidth(element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (expanded && !element.open) element.showModal();
    if (!expanded && element.open) element.close();
  }, [expanded]);

  // Tabs on a narrow panel hide the other map rather than removing it, so
  // switching between Share and Count reveals a drawn map, not a blank one.
  const maps = (inDialog = false) => <div className={`atlas-age-map-grid${narrow && !inDialog ? ' is-tabbed' : ''}`}>
    {views.map(view => {
      const hidden = narrow && !inDialog && activeView !== view.id;
      return <section key={view.id} className={`atlas-age-map-side atlas-age-map-${view.id}${hidden ? ' is-hidden' : ''}`} aria-label={`${view.title} map (${view.unit})`}
        {...(hidden ? { 'aria-hidden': true, inert: '' } as Record<string, unknown> : {})}>
      <h3>{view.title} <span>({view.unit})</span></h3>
      <div className="atlas-age-map-stage"><AtlasMap key={`${fitRevision}-${inDialog ? 'expanded' : 'inline'}-${view.id}`}
        dataset={dataset} rows={rows} metric={view.metric} compact focusRegions={focusRegions}
        selectedRegion={selection} onSelectRegion={select} camera={camera} onCameraChange={next => publishCamera(next, view.id, inDialog)}
        // A story chapter's pair has no room for map controls; its expanded view does.
        basemap={basemap} onBasemapChange={setBasemap} interactive controls={inDialog || !compact} dormant={dormant || hidden} />
      </div>
    </section>;
    })}
  </div>;

  const values = <details className="atlas-age-map-values">
    <summary>Read both values for every local health area</summary>
    <div className="atlas-age-map-table-scroll"><table>
      <caption>Source age 65+ share (%) and population (people). Percentages retain the released calculation’s precision; counts retain exact integers.</caption>
      <thead><tr><th scope="col">Local health area</th><th scope="col">Year</th><th scope="col">Source type</th><th scope="col">Share aged 65+ (%)</th><th scope="col">People aged 65+</th></tr></thead>
      <tbody>{rows.map((row, index) => <tr key={`${row[dataset.entityField]}-${row[dataset.timeField ?? 'year']}-${index}`}>
        <th scope="row">{String(row[dataset.entityField])}</th><td>{String(row[dataset.timeField ?? 'year'] ?? '')}</td><td>{String(row.population_type ?? '')}</td>
        <td>{exactValue(row.share_65_plus, true)}</td><td>{exactValue(row.population_65_plus)}</td>
      </tr>)}</tbody>
    </table></div>
  </details>;

  return <section ref={host} className={`atlas-age-map-pair${compact ? ' is-compact' : ''}${narrow ? ' is-narrow' : ''}`} data-testid={dormant ? undefined : "age-map-pair"}
    data-active-view={narrow ? activeView : 'both'} data-period={periods.length === 1 ? periods[0] : 'all'} aria-labelledby={labelId}>
    <div className="atlas-age-map-controls"><strong id={labelId}>Older-person share and count</strong>
      <label>Region<select aria-label="Select paired age map region" value={selection ?? ''} onChange={event => select(event.target.value || null)}>
        <option value="">All shown regions</option>{entities.map(entity => <option key={entity}>{entity}</option>)}
      </select></label>
      <button type="button" aria-label="Fit both maps" onClick={fit}>{compact ? 'Fit' : 'Fit both maps'}</button>
      {/* In a story the reader's own Expand media control enlarges the pair. */}
      {!compact && <button type="button" aria-label="Expand maps" onClick={() => setExpanded(true)}>Expand maps</button>}
    </div>
    {narrow && <div className="atlas-age-map-tabs" role="tablist" aria-label="Age map measure">
      {views.map((view, index) => <button key={view.id} id={`${labelId}-${view.id}-tab`} type="button" role="tab" aria-selected={activeView === view.id}
        tabIndex={activeView === view.id ? 0 : -1} aria-controls={`${labelId}-active-map`} onClick={() => setActiveView(view.id)}
        onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === 'Home' ? views[0] : event.key === 'End' ? views[1] : views[(index + 1) % views.length];
          setActiveView(next.id); document.getElementById(`${labelId}-${next.id}-tab`)?.focus();
        }}>{view.id === 'share' ? 'Share (%)' : 'Count (people)'}</button>)}
    </div>}
    <div id={`${labelId}-active-map`} className="atlas-age-map-content" role={narrow ? 'tabpanel' : undefined} aria-labelledby={narrow ? `${labelId}-${activeView}-tab` : undefined}>
      {maps()}
    </div>
    <p className="atlas-age-map-caption">{currentCoverage} of {coverage} source LHAs · {periodCaption}. {compact ? 'Separate scales.' : 'Separate colour scales; share and count use different units.'} {multiplePeriods && <strong>Choose one year to map values. Multiple observations per LHA are withheld; the table retains every year.</strong>}</p>
    {/* In a story the value table follows manifest pages.stories.storyMapValues. */}
    {(!compact || FLAGS.stories.storyMapValues) && values}
    {!compact && <p className="atlas-age-map-source"><a href={dataset.sourceUrl} target="_blank" rel="noreferrer">{dataset.sourceName}</a>. Age 65+ includes the source’s terminal 90+ category, using Gender=T once. The 2025 values are projections. BC Ministry of Health polygons via PGMaps provide context; boundary vintage is unestablished. These values do not measure care demand or participants.</p>}
    <dialog ref={dialog} className="atlas-age-map-dialog" aria-label="Expanded paired age maps" onClose={() => setExpanded(false)}>
      <div className="atlas-age-map-dialog-heading"><h2>Older-person share and count</h2><button type="button" onClick={() => setExpanded(false)}>Close expanded maps</button></div>
      {expanded && <><div className="atlas-age-map-controls"><label>Region<select aria-label="Select expanded paired age map region" value={selection ?? ''} onChange={event => select(event.target.value || null)}><option value="">All shown regions</option>{entities.map(entity => <option key={entity}>{entity}</option>)}</select></label><button type="button" onClick={fit}>Fit both maps</button></div><p className="atlas-age-map-caption">{currentCoverage} of {coverage} source LHAs · {periodCaption}. Each map has its own scale; both maps share navigation and region selection.</p>{maps(true)}{values}</>}
    </dialog>
  </section>;
}
