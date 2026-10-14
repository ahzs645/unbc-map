import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight, ExternalLink, Link2 } from "lucide-react";
import { StoryChapterNavigation, StorySidecar, useReadingSection } from "@pgmaps/geo-toolkit/stories/components";
import useStoryChapterUrl from "./useStoryChapterUrl";
import { atlasDatasets } from "./data";
import type { AtlasStoryMap as StoryDefinition, StoryMapChapter } from "./storyMaps";
import type { AtlasDataset, AtlasRow } from "./types";
import AtlasMap from "./AtlasMap";
import AtlasMapComparison from "./AtlasMapComparison";
import AtlasPairedAgeMaps from "./AtlasPairedAgeMaps";
import AtlasConditionMix from "./AtlasConditionMix";
import AtlasChart, { formatValue } from "./AtlasChart";
import { allowsMapAggregation, boundaryCaption, getBoundaryJoin, mapGroupValue } from './geography';
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

function ChapterEvidence({ chapter }: { chapter: StoryMapChapter }) {
  const dataset = atlasDatasets.find(item => item.id === chapter.evidence.datasetId)!;
  const rows = useMemo(() => chapterRows(dataset, chapter), [dataset, chapter]);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  useEffect(() => setSelectedRegion(null), [chapter.id]);
  const evidence = chapter.evidence;
  const isMap = evidence.kind === "map";
  const periodTypes = [...new Set(rows.map(row => row.population_type).filter(Boolean))];
  return <div className="atlas-chapter-evidence" data-testid="story-evidence" data-chapter={chapter.id} data-dataset={dataset.id} data-metric={evidence.metric} data-period={evidence.year ?? "all"}>
    <div className="atlas-chapter-evidence-heading"><strong>{dataset.title}</strong><span>{evidence.year ? `${evidence.year}${periodTypes.length ? ` · ${periodTypes.join(", ")}` : ""}` : dataset.timeLabel}{evidence.filters ? ` · ${Object.entries(evidence.filters).map(([key, value]) => key === "route_slug" ? rows[0]?.route_label ?? value : value).join(" · ")}` : ""}</span></div>
    <div className={`atlas-chapter-viz is-${evidence.kind}`}>
      {isMap && <AtlasMap dataset={dataset} metric={evidence.metric} rows={rows} compact focusRegions={evidence.focusRegions} scaleDomain={evidence.scaleDomain} selectedRegion={selectedRegion} onSelectRegion={setSelectedRegion} />}
      {evidence.kind === "comparison" && <AtlasMapComparison dataset={dataset} rows={rows} metric={evidence.metric} comparisonMetric={evidence.comparisonMetric!} focusRegions={evidence.focusRegions} scaleDomain={evidence.scaleDomain} />}
      {evidence.kind === "paired" && <AtlasPairedAgeMaps dataset={dataset} rows={rows} compact focusRegions={evidence.focusRegions} selectedRegion={selectedRegion || undefined} onSelectRegion={setSelectedRegion} />}
      {evidence.kind === "chart" && (dataset.id === "clinical-condition-mix" ? <AtlasConditionMix dataset={dataset} rows={rows} metric={evidence.metric} compact /> : <AtlasChart dataset={dataset} rows={rows} metric={evidence.metric} embedded />)}
      {evidence.kind === "scenario" && <ScenarioLab dataset={dataset} />}
    </div>
    <p className="atlas-chapter-source">{rows.length} source records · <a href={dataset.sourceUrl} target="_blank" rel="noreferrer">{dataset.geography === "route" || dataset.geography === "stop" ? "NH Connections source" : dataset.geography === "facility" ? "Facility source" : dataset.geography === "chsa" ? "PHSA / BCCDC registry" : dataset.sourceName} <ExternalLink size={11} /></a>{isMap || evidence.kind === "comparison" || evidence.kind === "paired" ? <span>{dataset.geography === "institution" ? "Campus points © OpenStreetMap. Totals describe whole institutions." : dataset.geography === "city" ? "City points © OpenStreetMap. Counts describe city-tagged studies, not facilities or enrollment." : dataset.geography === 'facility' ? 'Reviewed current facility display points © OpenStreetMap; historical reporting scope retained.' : dataset.geography === 'route' || dataset.geography === 'stop' ? 'Facility/town references © BC & OpenStreetMap; schematic schedule connections.' : dataset.geography === 'chsa' ? '2018 CHSA boundaries © BC Ministry of Health via Community Map of Canada · display use only.' : boundaryCaption(dataset)}</span> : null}</p>
  </div>;
}

export default function AtlasStoryMap({ story, onExplore, onCopy, onBack }: { story: StoryDefinition; onExplore: (chapter: StoryMapChapter) => void; onCopy: () => void; onBack: () => void }) {
  const scrollRoot = useRef<HTMLDivElement>(null);
  const panels = useRef<Array<HTMLElement | null>>([]);
  const active = useReadingSection(scrollRoot, panels, story.chapters.length);
  useStoryChapterUrl(scrollRoot, story.chapters.map(chapter => chapter.id));
  useEffect(() => {
    const nav = scrollRoot.current?.querySelector<HTMLElement>('[data-testid="editorial-nav"]');
    const button = nav?.querySelector<HTMLElement>('[aria-current="location"]');
    if (!nav || !button) return;
    const navBounds = nav.getBoundingClientRect(), buttonBounds = button.getBoundingClientRect();
    nav.scrollTo({ left: nav.scrollLeft + buttonBounds.left - navBounds.left - (nav.clientWidth - button.clientWidth) / 2, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [active]);
  useLayoutEffect(() => {
    const root = scrollRoot.current;
    if (!root) return;
    const measure = () => root.style.setProperty("--editorial-viewport", `${root.clientHeight}px`);
    measure();
    const observer = new ResizeObserver(measure); observer.observe(root);
    return () => observer.disconnect();
  }, []);
  const select = (index: number) => {
    const root = scrollRoot.current, panel = panels.current[index];
    if (!root || !panel) return;
    const mobile = window.matchMedia("(max-width: 700px)").matches;
    const media = root.querySelector<HTMLElement>(".editorial-immersive-media");
    const offset = mobile ? 64 + (media?.clientHeight ?? 260) : 64;
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
  const sources = [...new Set(story.chapters.map(chapter => chapter.evidence.datasetId))].map(id => atlasDatasets.find(item => item.id === id)!);
  const storiesUrl = `${import.meta.env.BASE_URL}dev/projects`;
  // The story fills the window below the UNBC header, as a PGMaps project
  // story does: a slim toolbar, then one reader that scrolls from the cover
  // through the chapters to the sources.
  return <article className="atlas-storymap">
    <div className="atlas-story-toolbar"><a className="atlas-story-back" href={storiesUrl} onClick={event => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onBack(); } }}><ArrowLeft size={16} aria-hidden="true" />All stories</a><span className="atlas-story-toolbar-title" aria-hidden="true">{story.title}</span><button className="atlas-text-button" onClick={onCopy}><Link2 size={15} aria-hidden="true" /> Copy story link</button></div>
    <div className="atlas-storymap-progress" role="group" aria-label="Story progress"><button aria-label="Previous chapter" disabled={active === 0} onClick={() => select(active - 1)}><ChevronLeft size={17} aria-hidden="true" /> Previous<span className="atlas-progress-more"> chapter</span></button><span aria-live="polite">{active + 1} / {story.chapters.length}<span className="atlas-progress-more"> · {story.chapters[active]?.title}</span></span><button aria-label="Next chapter" disabled={active === story.chapters.length - 1} onClick={() => select(active + 1)}>Next<span className="atlas-progress-more"> chapter</span> <ChevronRight size={17} aria-hidden="true" /></button></div>
    <div ref={scrollRoot} className="editorial-story atlas-story-reader" data-theme="light" tabIndex={0} role="region" aria-label="Guided story reader" data-testid="story-reader" data-active-chapter={story.chapters[active]?.id}>
      <header className="atlas-story-cover"><div className="atlas-story-cover-copy"><p className="atlas-eyebrow">Guided story map · {story.topic}</p><h1>{story.title}</h1><p>{story.summary}</p><button className="atlas-primary" onClick={begin}>Begin reading <ChevronRight size={16} aria-hidden="true" /></button></div><nav className="atlas-story-contents" aria-label="Chapters"><p>{story.chapters.length} chapters</p><ol>{story.chapters.map((chapter, index) => <li key={chapter.id}><button onClick={() => select(index)}>{chapter.title}</button></li>)}</ol></nav></header>
      <StoryChapterNavigation chapters={story.chapters.map((chapter, index) => ({ id: chapter.id, label: `${index + 1}. ${chapter.title}` }))} active={story.chapters[active]?.id} onSelect={id => select(story.chapters.findIndex(chapter => chapter.id === id))} />
      <StorySidecar id={`storymap-${story.id}`} scrollRoot={scrollRoot} slides={story.chapters.map((chapter, index) => ({ id: chapter.id, media: <ChapterEvidence chapter={chapter} />, content: <div ref={element => { panels.current[index] = element?.closest<HTMLElement>(".editorial-slide") ?? null; }}><p className="atlas-eyebrow">Chapter {index + 1} / {story.chapters.length}</p><h2>{chapter.title}</h2>{chapter.takeaway && <div className="atlas-chapter-takeaway"><strong>{chapter.takeaway.value}</strong><span>{chapter.takeaway.label}</span></div>}{chapter.paragraphs.map((paragraph, p) => <p key={p}>{paragraph}</p>)}<button className="atlas-text-button" onClick={() => onExplore(chapter)}>Explore the source data <ArrowUpRight size={16} /></button><ChapterValues chapter={chapter} /></div> }))} />
      <div className="atlas-storymap-sources"><h2>Sources</h2><p>Each source keeps its original period. Projections and scenarios are labelled where they appear.</p>{sources.map(dataset => <details key={dataset.id}><summary>{dataset.title} · {dataset.timeLabel}</summary><div><p>{dataset.description}</p><ul>{dataset.notes.map((note, index) => <li key={index}>{note}</li>)}</ul><p>Zoer dataset: <code>{dataset.datasetId}</code><br />Source table: <code>{dataset.tableName}</code></p><a href={dataset.sourceUrl} target="_blank" rel="noreferrer">Open source reference <ExternalLink size={14} /></a></div></details>)}<a className="atlas-story-back" href={storiesUrl} onClick={event => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onBack(); } }}><ArrowLeft size={16} aria-hidden="true" />Back to all stories</a></div>
    </div>
  </article>;
}
