import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight, ExternalLink, Link2 } from "lucide-react";
import { StorySidecar, useReadingSection } from "@pgmaps/geo-toolkit/stories/components";
import useStoryChapterUrl from "./useStoryChapterUrl";
import { atlasDatasets } from "./data";
import type { AtlasStoryMap as StoryDefinition, StoryMapChapter } from "./storyMaps";
import type { AtlasDataset, AtlasRow } from "./types";
import AtlasMap from "./AtlasMap";
import AtlasMapComparison from "./AtlasMapComparison";
import AtlasPairedAgeMaps from "./AtlasPairedAgeMaps";
import AtlasConditionMix from "./AtlasConditionMix";
import AtlasChart, { formatValue } from "./AtlasChart";
import AtlasEstimateTrends from "./AtlasEstimateTrends";
import { allowsMapAggregation, boundaryCaption, getBoundaryJoin, mapGroupValue } from './geography';
import { atlasDev, atlasStoriesHome, isZoerUrl } from "./mode";
import "@pgmaps/geo-toolkit/stories/styles.css";

export function chapterRows(dataset: AtlasDataset, chapter: StoryMapChapter): AtlasRow[] {
  const { year, entities, filters } = chapter.evidence;
  return dataset.rows.filter(row => (!year || String(row[dataset.timeField ?? ""]) === year) && (!entities?.length || entities.includes(String(row[dataset.entityField]))) && Object.entries(filters ?? {}).every(([key, value]) => !value || String(row[key]) === value));
}

function ChapterValues({ chapter }: { chapter: StoryMapChapter }) {
  if (chapter.evidence.kind !== "map") return null;
  const dataset = atlasDatasets.find(item => item.id === chapter.evidence.datasetId)!;
  const rows = chapterRows(dataset, chapter);
  const column = dataset.columns.find(item => item.key === chapter.evidence.metric)!;
  const label = dataset.geography === 'institution' ? 'Institution' : dataset.geography === 'city' ? 'City' : dataset.geography === 'facility' ? 'Facility' : dataset.geography === 'route' || dataset.geography === 'stop' ? 'Stop reference' : 'Region';
  const valueLabel = label === 'Region' ? 'regional' : label.toLowerCase();
  const groups = new Map<string, AtlasRow[]>();
  rows.forEach((row, index) => { const key = allowsMapAggregation(dataset, chapter.evidence.metric) ? getBoundaryJoin(dataset, row) ?? String(row[dataset.entityField]) : String(index); groups.set(key, [...(groups.get(key) ?? []), row]); });
  return <details className="atlas-chapter-values"><summary>Read the {valueLabel} values</summary><div><table><caption>{column.label}{chapter.evidence.year ? ` · ${chapter.evidence.year}` : ""}{chapter.evidence.filters ? ` · ${Object.values(chapter.evidence.filters).join(" · ")}` : ""}{column.unit ? ` (${column.unit})` : ""}</caption><thead><tr><th scope="col">{label}</th><th scope="col">Source value</th></tr></thead><tbody>{[...groups].map(([key, records]) => <tr key={key}><th scope="row">{String(records[0][dataset.entityField])}</th><td>{formatValue(mapGroupValue(dataset, records, chapter.evidence.metric))}</td></tr>)}</tbody></table></div></details>;
}

function ScenarioLab({ dataset }: { dataset: AtlasDataset }) {
  const base = dataset.rows.find(row => row.scenario === "base")!;
  const [inputs, setInputs] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return { patients: params.get("patients") ?? String(base.patients_reached), trips: params.get("trips") ?? String(Number(base.avoided_trips) / Number(base.patients_reached)), cost: params.get("cost") ?? String(base.cost_per_trip), hours: params.get("hours") ?? String(base.hours_saved_per_patient), hourly: params.get("hourly") ?? String(base.value_per_hour) };
  });
  const [preset, setPreset] = useState(() => ["patients", "trips", "cost", "hours", "hourly"].some(key => new URLSearchParams(window.location.search).has(key)) ? "" : "base");
  const fields = [{ key: "patients", label: "Assumed patients reached", min: 0, max: 100000, step: 1 }, { key: "trips", label: "Assumed avoided trips per patient", min: 0, max: 100, step: 0.1 }, { key: "cost", label: "Assumed cost per trip (CAD)", min: 0, max: 10000, step: 1 }, { key: "hours", label: "Assumed hours saved per patient", min: 0, max: 1000, step: 0.5 }, { key: "hourly", label: "Assumed value per hour (CAD)", min: 0, max: 1000, step: 1 }] as const;
  const numbers = fields.map(field => inputs[field.key] === "" ? NaN : Number(inputs[field.key]));
  const valid = fields.every((field, index) => Number.isFinite(numbers[index]) && numbers[index] >= field.min && numbers[index] <= field.max && (field.key !== "patients" || Number.isInteger(numbers[index])));
  const totalTrips = numbers[0] * numbers[1];
  const total = totalTrips * numbers[2];
  const timeValue = numbers[0] * numbers[3] * numbers[4];
  const change = (next: typeof inputs) => {
    setInputs(next);
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(next)) url.searchParams.set(key, value);
    window.history.replaceState(window.history.state, "", url);
  };
  return <div className="atlas-scenario-lab">
    <p className="atlas-scenario-label">Hypothetical planning model</p>
    <p>Adjust the assumptions to see how the model changes. The presets reproduce the collected scenarios.</p>
    <div className="atlas-scenario-presets" aria-label="Scenario presets">{dataset.rows.map(row => <button key={String(row.scenario)} aria-pressed={preset === row.scenario} onClick={() => { setPreset(String(row.scenario)); change({ patients: String(row.patients_reached), trips: String(Number(row.avoided_trips) / Number(row.patients_reached)), cost: String(row.cost_per_trip), hours: String(row.hours_saved_per_patient), hourly: String(row.value_per_hour) }); }}>{String(row.scenario)}</button>)}</div>
    <div className="atlas-scenario-fields">{fields.map((field, index) => <label key={field.key} className={`atlas-scenario-field atlas-scenario-field-${field.key}`}><span>{field.label}</span><input type="number" min={field.min} max={field.max} step={field.step} value={inputs[field.key]} aria-invalid={!Number.isFinite(numbers[index]) || numbers[index] < field.min || numbers[index] > field.max || (field.key === "patients" && !Number.isInteger(numbers[index]))} onChange={event => { setPreset(""); change({ ...inputs, [field.key]: event.target.value }); }} /></label>)}</div>
    <div className="atlas-scenario-result" role="status" data-testid="scenario-result">{valid ? <><strong>{formatValue(total, "CAD")}</strong><span>Modelled travel value · {formatValue(totalTrips)} assumed avoided trips</span><small>{formatValue(numbers[0])} patients × {formatValue(numbers[1])} trips per patient × {formatValue(numbers[2], "CAD")} per trip</small><strong>{formatValue(timeValue, "CAD")}</strong><span>Separate modelled patient-time value</span><small>{formatValue(numbers[0])} patients × {formatValue(numbers[3])} hours × {formatValue(numbers[4], "CAD")} per hour</small></> : <span>Enter valid assumptions within the displayed input limits.</span>}</div>
    <p className="atlas-scenario-caveat">This is an arithmetic scenario, not a forecast, observed saving or NHHR impact estimate. Travel and patient-time values are shown separately; neither represents a financial return to the hub.</p>
  </div>;
}

/**
 * The reader's "Expand media" control, placed beside the chapter's legend.
 * It drives the story frame's own toggle, which closes the expanded view and
 * owns its dialog behaviour; focus returns here when the view closes.
 */
function ExpandMediaButton() {
  const expand = (event: ReactMouseEvent<HTMLButtonElement>) => {
    const button = event.currentTarget;
    const frame = button.closest<HTMLElement>(".editorial-expandable");
    const toggle = frame?.querySelector<HTMLButtonElement>(":scope > .editorial-expand");
    if (!frame || !toggle) return;
    const observer = new MutationObserver(() => {
      if (frame.classList.contains("is-expanded")) return;
      observer.disconnect();
      if (button.isConnected) button.focus();
    });
    observer.observe(frame, { attributes: true, attributeFilter: ["class"] });
    toggle.click();
  };
  return <button type="button" className="atlas-expand-media" onClick={expand}>Expand media ↗</button>;
}

// The other chapters, nearest first (the next one before the previous).
function byDistance(chapters: StoryMapChapter[], index: number) {
  return chapters.map((chapter, i) => ({ chapter, d: i > index ? (i - index) * 2 - 1 : (index - i) * 2 })).filter(item => item.d > 0).sort((a, b) => a.d - b.d).map(item => item.chapter);
}

// Map views stay mounted once a chapter has shown them. Moving between, say, a
// single map and the paired maps then reveals an already-drawn view instead of
// starting new maps that paint their basemap and regions from blank.
const keptKinds = ["map", "comparison", "paired"] as const;
type KeptKind = typeof keptKinds[number];
const isKept = (kind: string): kind is KeptKind => (keptKinds as readonly string[]).includes(kind);

function KeptView({ kind, chapter, dormant, selectedRegion, onSelectRegion }: { kind: KeptKind; chapter: StoryMapChapter; dormant: boolean; selectedRegion: string | null; onSelectRegion: (value: string | null) => void }) {
  const dataset = atlasDatasets.find(item => item.id === chapter.evidence.datasetId)!;
  const rows = useMemo(() => chapterRows(dataset, chapter), [dataset, chapter]);
  const evidence = chapter.evidence;
  // A hidden view keeps its last chapter, stays out of the accessibility tree and takes no input.
  const hidden = dormant ? { "aria-hidden": true, inert: "" } as Record<string, unknown> : {};
  return <div className={`atlas-chapter-view${dormant ? " is-dormant" : ""}`} {...hidden}>
    {kind === "map" && <AtlasMap dataset={dataset} metric={evidence.metric} rows={rows} compact focusRegions={evidence.focusRegions} scaleDomain={evidence.scaleDomain} selectedRegion={dormant ? null : selectedRegion} onSelectRegion={onSelectRegion} legendAction={<ExpandMediaButton />} dormant={dormant} />}
    {kind === "comparison" && <AtlasMapComparison dataset={dataset} rows={rows} metric={evidence.metric} comparisonMetric={evidence.comparisonMetric!} focusRegions={evidence.focusRegions} scaleDomain={evidence.scaleDomain} dormant={dormant} />}
    {kind === "paired" && <AtlasPairedAgeMaps dataset={dataset} rows={rows} compact focusRegions={evidence.focusRegions} selectedRegion={dormant ? undefined : selectedRegion || undefined} onSelectRegion={onSelectRegion} dormant={dormant} />}
  </div>;
}

function ChapterEvidence({ chapter, nearby = [] }: { chapter: StoryMapChapter; nearby?: StoryMapChapter[] }) {
  const dataset = atlasDatasets.find(item => item.id === chapter.evidence.datasetId)!;
  const rows = useMemo(() => chapterRows(dataset, chapter), [dataset, chapter]);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  useEffect(() => setSelectedRegion(null), [chapter.id]);
  const evidence = chapter.evidence;
  const isMap = evidence.kind === "map";
  const kept = useRef<Partial<Record<KeptKind, StoryMapChapter>>>({});
  // Every map view the story uses is drawn hidden in advance, so reaching it
  // reveals a painted map rather than one starting from blank. Starting a map
  // is GPU set-up (a WebGL context, its canvas and shaders), not loading, and
  // it blocks the page, so it waits until the shown map has loaded and its
  // camera move has finished, then takes one idle moment per view, nearest
  // chapter first.
  const evidenceRoot = useRef<HTMLDivElement>(null);
  if (isKept(evidence.kind)) kept.current[evidence.kind] = chapter;
  const [warmNext, setWarmNext] = useState<string>();
  const findCold = () => nearby.find(next => isKept(next.evidence.kind) && !kept.current[next.evidence.kind]);
  let cold = findCold();
  if (cold && warmNext === cold.id && isKept(cold.evidence.kind)) { kept.current[cold.evidence.kind] = cold; cold = findCold(); }
  useEffect(() => {
    if (!cold) return;
    const warm = () => setWarmNext(cold.id);
    const idle = typeof window.requestIdleCallback === "function";
    const shownLoaded = () => [...evidenceRoot.current?.querySelectorAll('.atlas-chapter-view:not(.is-dormant) [data-testid="atlas-map-state"]') ?? []]
      .every(state => state.getAttribute("data-ready") === "true" && state.getAttribute("data-basemap-status") !== "loading");
    let handle = 0, timer = 0;
    const check = () => {
      if (!shownLoaded()) { timer = window.setTimeout(check, 400); return; }
      handle = idle ? window.requestIdleCallback(warm, { timeout: 1500 }) : window.setTimeout(warm, 0);
    };
    timer = window.setTimeout(check, 700);
    return () => { window.clearTimeout(timer); if (idle) window.cancelIdleCallback(handle); else window.clearTimeout(handle); };
  }, [chapter.id, cold?.id]);
  const periodTypes = [...new Set(rows.map(row => row.population_type).filter(Boolean))];
  return <div ref={evidenceRoot} className="atlas-chapter-evidence" data-testid="story-evidence" data-chapter={chapter.id} data-dataset={dataset.id} data-metric={evidence.metric} data-period={evidence.year ?? "all"}>
    <div className="atlas-chapter-evidence-heading"><strong>{dataset.title}</strong><span>{evidence.year ? `${evidence.year}${periodTypes.length ? ` · ${periodTypes.join(", ")}` : ""}` : dataset.timeLabel}{evidence.filters ? ` · ${Object.entries(evidence.filters).map(([key, value]) => key === "route_slug" ? rows[0]?.route_label ?? value : value).join(" · ")}` : ""}</span></div>
    <div className={`atlas-chapter-viz is-${evidence.kind}`}>
      {keptKinds.map(kind => kept.current[kind] && <KeptView key={kind} kind={kind} chapter={kept.current[kind]!} dormant={kind !== evidence.kind} selectedRegion={selectedRegion} onSelectRegion={setSelectedRegion} />)}
      {evidence.kind === "chart" && (dataset.id === "clinical-condition-mix" ? <AtlasConditionMix dataset={dataset} rows={rows} metric={evidence.metric} compact /> : <AtlasChart dataset={dataset} rows={rows} metric={evidence.metric} embedded />)}
      {evidence.kind === "trends" && <AtlasEstimateTrends dataset={dataset} rows={rows} metric={evidence.metric} totalLabel="All Northern LHAs" />}
      {evidence.kind === "scenario" && <ScenarioLab dataset={dataset} />}
    </div>
    <p className="atlas-chapter-source">{rows.length} source records · {atlasDev || !isZoerUrl(dataset.sourceUrl) ? <a href={dataset.sourceUrl} target="_blank" rel="noreferrer">{dataset.geography === "route" || dataset.geography === "stop" ? "NH Connections source" : dataset.geography === "facility" ? "Facility source" : dataset.geography === "chsa" ? "PHSA / BCCDC registry" : dataset.sourceName} <ExternalLink size={11} /></a> : <>{dataset.geography === "route" || dataset.geography === "stop" ? "NH Connections source" : dataset.geography === "facility" ? "Facility source" : dataset.geography === "chsa" ? "PHSA / BCCDC registry" : dataset.sourceName}</>}{isMap || evidence.kind === "comparison" || evidence.kind === "paired" ? <span>{dataset.geography === "institution" ? "Campus points © OpenStreetMap. Totals describe whole institutions." : dataset.geography === "city" ? "City points © OpenStreetMap. Counts describe city-tagged studies, not facilities or enrollment." : dataset.geography === 'facility' ? 'Reviewed current facility display points © OpenStreetMap; historical reporting scope retained.' : dataset.geography === 'route' || dataset.geography === 'stop' ? 'Facility/town references © BC & OpenStreetMap; schematic schedule connections.' : dataset.geography === 'chsa' ? '2018 CHSA boundaries © BC Ministry of Health via Community Map of Canada · display use only.' : boundaryCaption(dataset)}</span> : null}</p>
    {!isMap && <div className="atlas-chapter-actions"><ExpandMediaButton /></div>}
  </div>;
}

// A current chapter title too long for the rail scrolls back and forth, like a
// ticker, instead of being cut off; reduced motion keeps an ellipsis (CSS).
function fitTicker(nav: HTMLElement, current: HTMLElement) {
  nav.querySelectorAll<HTMLElement>(".is-ticker").forEach(button => { if (button !== current) button.classList.remove("is-ticker"); });
  const label = current.querySelector<HTMLElement>(".atlas-story-chapter-label");
  if (!label) return;
  const overflow = label.scrollWidth - current.clientWidth;
  current.classList.toggle("is-ticker", overflow > 1);
  current.style.setProperty("--ticker-shift", `${-Math.ceil(overflow + 4)}px`);
  current.style.setProperty("--ticker-duration", `${Math.max(6, overflow / 24 + 4).toFixed(1)}s`);
}

const phoneQuery = "(max-width: 700px)";
function usePhone() {
  const [phone, setPhone] = useState(() => typeof window !== "undefined" && window.matchMedia(phoneQuery).matches);
  useEffect(() => {
    const media = window.matchMedia(phoneQuery);
    const update = () => setPhone(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return phone;
}

// On a phone a chapter opens with its lead paragraph; the method and caveat
// paragraphs that follow fold away, so the map changes more often as you scroll.
function ChapterText({ paragraphs, folded }: { paragraphs: string[]; folded: boolean }) {
  if (!folded || paragraphs.length < 2) return <>{paragraphs.map((paragraph, p) => <p key={p}>{paragraph}</p>)}</>;
  return <><p>{paragraphs[0]}</p><details className="atlas-chapter-more"><summary>More about this data</summary>{paragraphs.slice(1).map((paragraph, p) => <p key={p}>{paragraph}</p>)}</details></>;
}

export default function AtlasStoryMap({ story, onExplore, onCopy, onBack }: { story: StoryDefinition; onExplore?: (chapter: StoryMapChapter) => void; onCopy: () => void; onBack: () => void }) {
  const scrollRoot = useRef<HTMLDivElement>(null);
  const chapterRail = useRef<HTMLElement>(null);
  const panels = useRef<Array<HTMLElement | null>>([]);
  const active = useReadingSection(scrollRoot, panels, story.chapters.length);
  const phone = usePhone();
  useStoryChapterUrl(scrollRoot, story.chapters.map(chapter => chapter.id));
  // The current chapter sits in the middle of the rail; the others fade out at
  // its edges. It is centred on opening and on resize too, without animation.
  const centreChapter = (smooth: boolean) => {
    const nav = chapterRail.current;
    const button = nav?.querySelector<HTMLElement>('[aria-current="location"]');
    if (!nav || !button) return;
    fitTicker(nav, button);
    const navBounds = nav.getBoundingClientRect(), buttonBounds = button.getBoundingClientRect();
    nav.scrollTo({ left: nav.scrollLeft + buttonBounds.left - navBounds.left - (nav.clientWidth - button.clientWidth) / 2, behavior: smooth && !window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "auto" });
  };
  const centred = useRef(false);
  useEffect(() => { centreChapter(centred.current); centred.current = true; }, [active]);
  useEffect(() => {
    const nav = chapterRail.current;
    if (!nav) return;
    const observer = new ResizeObserver(() => centreChapter(false));
    observer.observe(nav);
    document.fonts?.ready.then(() => centreChapter(false));
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const root = scrollRoot.current;
    if (!root) return;
    const measure = () => root.style.setProperty("--editorial-viewport", `${root.clientHeight}px`);
    measure();
    const observer = new ResizeObserver(measure); observer.observe(root);
    return () => observer.disconnect();
  }, []);
  // Where the story is locked to the window, the UNBC header shows only on the
  // cover. The window-high reader sits below it, so reading on scrolls the
  // locked shell by the header's height: the header slides out and nothing is
  // resized, so the maps never redraw. It returns at the top of the reader, or
  // when keyboard focus moves into it. Separate hide and show points keep it
  // from flickering between the two.
  useEffect(() => {
    const root = scrollRoot.current, shell = root?.closest<HTMLElement>(".unbc-atlas-shell");
    const header = shell?.querySelector<HTMLElement>(":scope > .chrome-slot");
    if (!root || !shell || !header) return;
    const locked = window.matchMedia("(min-width: 701px)");
    let reading = false;
    const show = (next: boolean, instant = false) => {
      reading = next;
      shell.classList.toggle("is-story-reading", next);
      if (!locked.matches) return;
      const smooth = !instant && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      shell.scrollTo({ top: next ? header.offsetHeight : 0, behavior: smooth ? "smooth" : "auto" });
    };
    const update = () => {
      const inHeader = header.contains(document.activeElement);
      const next = inHeader ? false : reading ? root.scrollTop > 4 : root.scrollTop > 24;
      if (next !== reading) show(next);
    };
    const reset = () => show(reading, true);
    show(!header.contains(document.activeElement) && root.scrollTop > 24, true);
    root.addEventListener("scroll", update, { passive: true });
    header.addEventListener("focusin", update); header.addEventListener("focusout", update);
    locked.addEventListener("change", reset);
    return () => {
      root.removeEventListener("scroll", update);
      header.removeEventListener("focusin", update); header.removeEventListener("focusout", update);
      locked.removeEventListener("change", reset);
      shell.classList.remove("is-story-reading");
      shell.scrollTo({ top: 0 });
    };
  }, []);
  const select = (index: number) => {
    const root = scrollRoot.current, panel = panels.current[index];
    if (!root || !panel) return;
    const mobile = window.matchMedia("(max-width: 700px)").matches;
    const media = root.querySelector<HTMLElement>(".editorial-immersive-media");
    const offset = mobile ? 8 + (media?.clientHeight ?? 260) : 8;
    const coverEnd = root.querySelector<HTMLElement>(".atlas-story-cover")?.offsetHeight ?? 0;
    root.scrollTo({ top: Math.max(coverEnd, root.scrollTop + panel.getBoundingClientRect().top - root.getBoundingClientRect().top - offset), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  // Begin reading lands the chapter navigation at the top of the reader.
  const begin = () => {
    const root = scrollRoot.current, cover = root?.querySelector<HTMLElement>(".atlas-story-cover");
    if (!root || !cover) return;
    // Phones scroll the page to the reader first; wider screens lock it in place.
    if (window.matchMedia("(max-width: 700px)").matches) root.scrollIntoView({ block: "start", behavior: "auto" });
    root.scrollTo({ top: cover.offsetHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    root.focus({ preventScroll: true });
  };
  const storiesUrl = atlasStoriesHome;
  const backToStories = <a className="atlas-story-back" href={storiesUrl} onClick={event => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onBack(); } }}><ArrowLeft size={16} aria-hidden="true" />Back to all stories</a>;
  // The story fills the window below the UNBC header, as a PGMaps project
  // story does: one slim bar (back, the chapter rail between its previous and
  // next steps, and the story link), then one reader that scrolls from the
  // cover through the chapters; the last one ends with the way back.
  return <article className="atlas-storymap">
    <div className="atlas-story-toolbar">
      <a className="atlas-story-back" href={storiesUrl} aria-label="All stories" onClick={event => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onBack(); } }}><ArrowLeft size={16} aria-hidden="true" /><span className="atlas-story-bar-label">All stories</span></a>
      <button className="atlas-story-step" aria-label="Previous chapter" disabled={active === 0} onClick={() => select(active - 1)}><ChevronLeft size={18} aria-hidden="true" /></button>
      <nav ref={chapterRail} className="atlas-story-chapters" data-testid="editorial-nav" aria-label="Story chapters">{story.chapters.map((chapter, index) => <button key={chapter.id} type="button" aria-current={index === active ? "location" : undefined} onClick={() => select(index)}><span className="atlas-story-chapter-label">{index + 1}. {chapter.title}</span></button>)}</nav>
      <button className="atlas-story-step" aria-label="Next chapter" disabled={active === story.chapters.length - 1} onClick={() => select(active + 1)}><ChevronRight size={18} aria-hidden="true" /></button>
      <span className="unbc-sr-only" aria-live="polite">Chapter {active + 1} of {story.chapters.length}: {story.chapters[active]?.title}</span>
      <button className="atlas-story-copy" aria-label="Copy story link" title="Copy story link" onClick={onCopy}><Link2 size={16} aria-hidden="true" /><span className="atlas-story-bar-label">Copy story link</span></button>
    </div>
    <div ref={scrollRoot} className="editorial-story atlas-story-reader" data-theme="light" tabIndex={0} role="region" aria-label="Guided story reader" data-testid="story-reader" data-active-chapter={story.chapters[active]?.id}>
      <header className="atlas-story-cover"><div className="atlas-story-cover-copy"><p className="atlas-eyebrow">Guided story map · {story.topic}</p><h1>{story.title}</h1><p>{story.summary}</p><button className="atlas-primary" onClick={begin}>Begin reading <ChevronRight size={16} aria-hidden="true" /></button></div><nav className="atlas-story-contents" aria-label="Chapters"><p>{story.chapters.length} chapters</p><ol>{story.chapters.map((chapter, index) => <li key={chapter.id}><button onClick={() => select(index)}>{chapter.title}</button></li>)}</ol></nav></header>
      <StorySidecar id={`storymap-${story.id}`} scrollRoot={scrollRoot} slides={story.chapters.map((chapter, index) => ({ id: chapter.id, media: <ChapterEvidence chapter={chapter} nearby={byDistance(story.chapters, index)} />, content: <div ref={element => { panels.current[index] = element?.closest<HTMLElement>(".editorial-slide") ?? null; }}><p className="atlas-eyebrow">Chapter {index + 1} / {story.chapters.length}</p><h2>{chapter.title}</h2>{chapter.takeaway && <div className="atlas-chapter-takeaway"><strong>{chapter.takeaway.value}</strong><span>{chapter.takeaway.label}</span></div>}<ChapterText paragraphs={chapter.paragraphs} folded={phone} />{onExplore && <button className="atlas-text-button" onClick={() => onExplore(chapter)}>Explore the source data <ArrowUpRight size={16} /></button>}{FLAGS.stories.storyMapValues && <ChapterValues chapter={chapter} />}{index === story.chapters.length - 1 && <div className="atlas-chapter-end">{backToStories}</div>}</div> }))} />
    </div>
  </article>;
}
