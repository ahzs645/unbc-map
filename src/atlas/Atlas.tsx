import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight, BarChart3, BookOpen, Check, ChevronLeft, ChevronRight, Database, Download, ExternalLink, Info, Layers, Link2, Map as MapIcon, Search, Table2, X } from "lucide-react";
import { atlasDatasets, atlasStories, atlasInventory } from "./data";
import type { AtlasDataset, AtlasRow, AtlasStory } from "./types";
import AtlasChart, { formatValue } from "./AtlasChart";
import AtlasMap from "./AtlasMap";
import AtlasPairedAgeMaps from "./AtlasPairedAgeMaps";
import AtlasConditionMix from "./AtlasConditionMix";
import { boundaryAssetUrl, canMapDataset, canMapMetric } from "./geography";
import AtlasStoryMap from "./AtlasStoryMap";
import AtlasConnections from "./AtlasConnections";
import AtlasZoerCatalogue from "./AtlasZoerCatalogue";
import { atlasStoryMaps, type StoryMapChapter } from "./storyMaps";
import { ChromeHeader, ChromeFooter, ChromeBreadcrumbs } from "../chrome";
import { atlasDev, atlasHome, atlasMenuUrl, atlasRoot, isZoerUrl } from "./mode";
import "../styles.css";
import "../brand.css";
import "./atlas.css";
import "./unbc-atlas.css";
import "./story-maps.css";

type Section = "stories" | "explore" | "sources";
const nhhrUrl = "https://www.unbc.ca/office-research-and-innovation/northern-hub-health-research";
/** The UNBC header on Atlas pages lists the Atlas sections, as a unbc.ca section's menu does. */
const atlasSite = {
  skipLink: { label: "Skip to NHHR content", target: "#atlas-main" },
  menu: [
    { label: "Research stories", url: atlasMenuUrl() },
    { label: "Data explorer", url: atlasMenuUrl("explore") },
    { label: "Sources & methods", url: atlasMenuUrl("sources") },
    { label: "Campus map", url: "/campus" },
  ],
  audience: { label: "NHHR links", links: [{ label: "NHHR website", url: nhhrUrl }, { label: "Campus map", url: "/campus" }] },
  tabs: [{ label: "NHHR website", url: nhhrUrl }, { label: "Campus map", url: "/campus" }],
};
type State = { section: Section; story: string; dataset: string; metric: string; year: string; entity: string; entities: string[]; search: string; chart: "chart" | "map" | "paired" | "table"; region: string; filters: Record<string, string> };
const firstDataset = atlasDatasets[0];
function readState(): State {
  const params = new URLSearchParams(window.location.search);
  const dataset = atlasDatasets.find(item => item.id === params.get("dataset")) ?? firstDataset;
  const metric = dataset?.columns.find(column => column.type === "number" && column.key === params.get("metric"))?.key ?? dataset?.defaultMetric ?? "";
  const pathStory = window.location.pathname.startsWith(`${atlasRoot}/`) ? window.location.pathname.slice(atlasRoot.length + 1).match(/^([^/]+)\/?$/)?.[1] : undefined;
  const section = pathStory ? "stories" : params.get("view");
  const display = params.get("display");
  const chart = display === "chart" || display === "map" || display === "table" || (display === "paired" && dataset.id === "population-lha-ages") ? display : defaultDisplay(dataset);
  const filters: Record<string, string> = {};
  params.forEach((value, key) => { if (key.startsWith("filter.")) filters[key.slice(7)] = value; });
  for (const [key, value] of Object.entries(dataset.defaultFilters ?? {})) if (!params.has(`filter.${key}`)) filters[key] = value;
  // A default on the entity field belongs in the visible entity selector. It
  // must not survive as a second hidden filter after that selector changes.
  const entity = params.get("entity") ?? (params.has('entities') ? '' : filters[dataset.entityField] ?? '');
  delete filters[dataset.entityField];
  return { section: section === "explore" || section === "sources" ? section : "stories", story: pathStory ? decodeURIComponent(pathStory) : params.get("story") ?? "", dataset: dataset?.id ?? "", metric: chart === "paired" ? "share_65_plus" : metric, year: params.get("year") ?? ((chart === "map" || chart === "paired") && dataset ? latestPeriod(dataset) : ""), entity, entities: params.getAll("entities"), search: params.get("q") ?? "", chart, region: params.get("region") ?? "", filters };
}
function writeState(state: State, push: boolean) {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  const storyMap = state.section === "stories" && atlasStoryMaps.some(item => item.id === state.story);
  url.pathname = storyMap ? `${atlasRoot}/${state.story}` : atlasHome;
  if (state.section !== "stories") url.searchParams.set("view", state.section);
  if (state.story && state.section === "stories" && !storyMap) { url.searchParams.set("story", state.story); if (state.region) url.searchParams.set("region", state.region); }
  if (state.section === "explore") {
    url.searchParams.set("dataset", state.dataset);
    url.searchParams.set("metric", state.metric);
    if (state.year || ((state.chart === "map" || state.chart === "paired") && atlasDatasets.find(item => item.id === state.dataset)?.timeField)) url.searchParams.set("year", state.year);
    if (state.entity || atlasDatasets.find(item => item.id === state.dataset)?.defaultFilters?.[atlasDatasets.find(item => item.id === state.dataset)!.entityField]) url.searchParams.set("entity", state.entity);
    state.entities.forEach(entity => url.searchParams.append("entities", entity));
    if (state.search) url.searchParams.set("q", state.search);
    url.searchParams.set("display", state.chart);
    if (state.region) url.searchParams.set("region", state.region);
    for (const [key, value] of Object.entries(state.filters)) url.searchParams.set(`filter.${key}`, value);
  }
  window.history[push ? "pushState" : "replaceState"]({}, "", url);
}
function Badge({ status }: { status: AtlasDataset["status"] }) { return <span className={`atlas-badge atlas-badge-${status}`}>{status === "projection" ? "Projection" : status === "scenario" ? "Scenario" : status === "review" ? "Review needed" : "Source records"}</span>; }
function geographyLabel(dataset: AtlasDataset) { if (dataset.mapLocationsAsset === 'boundaries-lfs-er-2021.geojson') return 'LFS reporting areas · 2021 boundaries · combined North Coast–Nechako'; return ({ hsda: "Health service delivery areas", lha: "Local health areas", ha: "Reporting health authorities", hr2015: "Historical health regions · December 2015 boundaries", chsa: "Community health service areas · source-matched boundaries", cd: "Census divisions · 2021 boundaries", csd: "Census subdivisions · 2021 contextual boundaries", er: "Economic regions · 2021 boundaries", institution: "Institution totals at representative campus locations", city: hasMap(dataset) ? "City-tagged counts at representative place points" : "City-tagged records", facility: "Reviewed physical facilities", stop: "Verified sites and representative towns", route: "Recorded stops and schematic connections", none: "Nonspatial data" })[dataset.geography]; }
function uniqueValues(rows: AtlasRow[], field: string) { return [...new Set(rows.map(row => row[field]).filter(value => value !== null && value !== undefined && value !== "").map(String))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })); }
function latestPeriod(dataset: AtlasDataset) { return dataset.timeField ? uniqueValues(dataset.rows, dataset.timeField).at(-1) ?? "" : ""; }
function hasMap(dataset: AtlasDataset) { return canMapDataset(dataset); }
function defaultDisplay(dataset: AtlasDataset): State["chart"] { return ["clinical-condition-mix", "trial-facility-coverage", "community-disease-incidence", "community-disease-prevalence"].includes(dataset.id) ? "chart" : hasMap(dataset) ? "map" : ["travel-benchmarks", "northern-capital-projects"].includes(dataset.id) ? "table" : "chart"; }
function defaultDatasetView(dataset: AtlasDataset) {
  const chart = defaultDisplay(dataset);
  return { chart, year: chart === "map" ? latestPeriod(dataset) : "", entity: dataset.defaultFilters?.[dataset.entityField] ?? '', filters: Object.fromEntries(Object.entries(dataset.defaultFilters ?? {}).filter(([key]) => key !== dataset.entityField)) };
}
function storyGeographyNote(dataset: AtlasDataset) {
  if (dataset.geography === "institution" && hasMap(dataset)) return "The map places institution-level totals at representative campus locations. These coordinates do not allocate funding or research activity to surrounding populations, health areas or individual campus facilities.";
  if (dataset.geography === "city" && hasMap(dataset)) return "City points locate the exact query labels in the collected registry summary. They are representative place locations, not trial facilities, enrollments, catchments or current trial availability. Multi-site studies can appear in several cities.";
  if (dataset.geography === "chsa") return "CHSA rates join native source identifiers and the matched 2018 display boundaries. Unreleased communities and absent cells remain without values. These areas are reporting contexts, not facility catchments or a complete Northern cohort.";
  if (dataset.geography === "facility") return "Physical sites use a reviewed source-identity crosswalk and independently verified coordinates. Grouped, broad or unverified descriptions remain unassigned; historical records do not establish current service availability.";
  if (dataset.geography === "route" || dataset.geography === "stop") return "Schedule locations distinguish verified sites from representative towns. Connections follow recorded stop order and are schematic, not road routes, measured journey times, passenger counts or current schedules.";
  if (dataset.geography === "ha") return dataset.id.startsWith('community-disease-') ? "The Northern HA source identifier joins its PGMaps health-authority polygon as contemporary context. Historical boundary vintage is unverified. Select one indicator, sex and fiscal period; no values are allocated to communities or facilities." : "The map connects the five territorial reporting authorities through an explicit source-label crosswalk. Province and PHSA observations remain in the records without a polygon match. The values describe organizational costs, not residents' costs or utilization.";
  if (["cd", "csd", "er"].includes(dataset.geography)) return "The map follows native source identifiers and reviewed 2021 Statistics Canada boundaries from PGMaps. Municipal estimates use those polygons as context rather than a historical boundary harmonization. Combined economic regions retain their original totals without allocation into separate polygons.";
  return hasMap(dataset) ? "The geography follows the source health-area codes. Boundary matches are checked against the PGMaps reference, with unmatched areas identified." : `This story describes ${geographyLabel(dataset).toLowerCase()}. A source record is not a population estimate for the place where it is tagged.`;
}
function mapPeriodCaption(dataset: AtlasDataset) {
  const period = latestPeriod(dataset);
  const types = uniqueValues(dataset.rows.filter(row => String(row[dataset.timeField!]) === period), "population_type");
  return `Map period: ${[period, ...types, ...Object.values(dataset.defaultFilters ?? {})].join(" · ")}. The trend chart retains every available period for this subset.`;
}
function defaultSubset(dataset: AtlasDataset, rows = dataset.rows) { return rows.filter(row => Object.entries(dataset.defaultFilters ?? {}).every(([key, value]) => !value || String(row[key]) === value)); }

function StoryEvidenceView({ dataset, story, selectedRegion, onSelectRegion }: { dataset: AtlasDataset; story: AtlasStory; selectedRegion: string; onSelectRegion: (value: string | null) => void }) {
  const mapRows = defaultSubset(dataset, dataset.timeField ? dataset.rows.filter(row => String(row[dataset.timeField!]) === latestPeriod(dataset)) : dataset.rows)
    .filter(row => Object.entries(story.mapFilters ?? {}).every(([key, value]) => String(row[key]) === value));
  if (story.visualization === 'pairedAgeMaps') return <><AtlasPairedAgeMaps dataset={dataset} rows={mapRows} selectedRegion={selectedRegion || undefined} onSelectRegion={onSelectRegion} /><p className="atlas-evidence-source">{mapPeriodCaption(dataset)}</p></>;
  return <>{dataset.id === 'clinical-condition-mix' ? <AtlasConditionMix dataset={dataset} rows={defaultSubset(dataset)} metric={story.metric} /> : <AtlasChart dataset={dataset} rows={defaultSubset(dataset)} metric={story.metric} />}
    {hasMap(dataset) && <div className="atlas-story-map"><AtlasMap dataset={dataset} metric={story.metric} rows={mapRows} selectedRegion={selectedRegion || undefined} onSelectRegion={onSelectRegion} />
      {(dataset.timeField || story.mapFilters) && <p className="atlas-evidence-source">{dataset.timeField ? mapPeriodCaption(dataset) : ''}{story.mapFilters ? ` Map condition: ${Object.values(story.mapFilters).join(' · ')}.` : ''}</p>}
    </div>}</>;
}

function DataTable({ dataset, rows }: { dataset: AtlasDataset; rows: AtlasRow[] }) {
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ key: string; reverse: boolean } | null>(null);
  useEffect(() => { setPage(0); }, [rows]);
  useEffect(() => { setSort(null); }, [dataset.id]);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((a, b) => {
      const left = a[sort.key], right = b[sort.key];
      if (left == null) return right == null ? 0 : 1;
      if (right == null) return -1;
      const result = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right), undefined, { numeric: true });
      return sort.reverse ? -result : result;
    });
  }, [rows, sort]);
  const pages = Math.ceil(rows.length / 25);
  const safePage = Math.min(page, Math.max(pages - 1, 0));
  return <div className="atlas-data-table"><div className="atlas-table-scroll" tabIndex={0} role="region" aria-label="Source data table; scroll horizontally to see all columns"><table><thead><tr>{dataset.columns.map(column => <th key={column.key} scope="col" aria-sort={sort?.key === column.key ? sort.reverse ? "descending" : "ascending" : "none"}><button onClick={() => { setSort(current => ({ key: column.key, reverse: current?.key === column.key ? !current.reverse : false })); setPage(0); }}>{column.label}{column.unit && <small>{column.unit}</small>}<span aria-hidden="true">{sort?.key === column.key ? sort.reverse ? " ↓" : " ↑" : " ↕"}</span></button></th>)}</tr></thead><tbody>{sorted.slice(safePage * 25, (safePage + 1) * 25).map((row, index) => <tr key={index}>{dataset.columns.map(column => <td key={column.key} className={column.type === "number" ? "is-number" : undefined}>{typeof row[column.key] === "string" && /(?:^|_)urls?$/.test(column.key) && /^https:\/\/[^\s;]+$/.test(String(row[column.key])) ? <a href={String(row[column.key])} target="_blank" rel="noreferrer">{formatValue(row[column.key])}</a> : formatValue(row[column.key])}</td>)}</tr>)}</tbody></table></div>{!rows.length && <div className="atlas-empty"><strong>No records match these filters.</strong><p>Clear your filters to return to the full selected dataset.</p></div>}<div className="atlas-pagination"><span>{rows.length ? `${safePage * 25 + 1}–${Math.min((safePage + 1) * 25, rows.length)} of ${rows.length.toLocaleString()} records` : "0 records"}</span><div><button aria-label="Previous table page" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}><ChevronLeft size={17} /></button><span>Page {safePage + 1} of {pages || 1}</span><button aria-label="Next table page" disabled={safePage + 1 >= pages} onClick={() => setPage(safePage + 1)}><ChevronRight size={17} /></button></div></div></div>;
}

const linkedViews: Record<string, { id: string; label: string }[]> = {
  'clinical-condition-mix': [{ id: 'clinical-city', label: 'City portfolio totals' }, { id: 'trial-facility-conditions', label: 'Verified facility conditions' }, { id: 'clinical-pg', label: 'Prince George study records' }],
  'trial-facility-conditions': [{ id: 'clinical-condition-mix', label: 'Full city condition mix' }, { id: 'trial-facility-coverage', label: 'Facility mapping coverage' }],
  'trial-facility-coverage': [{ id: 'trial-facility-conditions', label: 'Verified facility conditions' }, { id: 'clinical-city', label: 'Full city portfolio totals' }],
  'clinical-city': [{ id: 'clinical-condition-mix', label: 'Trial condition mix' }],
  'trial-sites': [{ id: 'trial-site-evidence', label: 'Study-site records' }],
  'trial-site-evidence': [{ id: 'trial-sites', label: 'Verified trial-site map' }],
  'hospital-facilities': [{ id: 'hospital-facility-costs', label: 'Hospital cost records' }],
  'hospital-facility-costs': [{ id: 'hospital-facilities', label: 'Hospital directory' }],
  'travel-stop-events': [{ id: 'travel-stop-locations', label: 'Reviewed travel locations' }, { id: 'travel-schedule', label: 'Route/day summaries' }],
  'travel-stop-locations': [{ id: 'travel-stop-events', label: 'Original schedule events' }],
  'cfi-projects-by-year': [{ id: 'cfi-projects-total', label: 'Collected CFI period totals' }],
  'cfi-projects-total': [{ id: 'cfi-projects-by-year', label: 'CFI decision-year records' }],
  'publications': [{ id: 'publications-history', label: 'Longer collected publication series' }],
  'publications-history': [{ id: 'publications', label: 'Existing recent publication selection' }],
  'bc-graduate-projections': [{ id: 'bc-health-occupation-projections', label: 'Projected occupation entrants' }],
  'bc-health-occupation-projections': [{ id: 'bc-graduate-projections', label: 'Projected graduates' }, { id: 'nursing-workforce-northern', label: 'Observed nursing workforce' }],
  'community-disease-incidence': [{ id: 'community-disease-prevalence', label: 'Lifetime prevalence rates' }],
  'community-disease-prevalence': [{ id: 'community-disease-incidence', label: 'Incidence rates' }],
  'northern-chsa-incidence': [{ id: 'northern-chsa-prevalence', label: 'CHSA lifetime prevalence' }],
  'northern-chsa-prevalence': [{ id: 'northern-chsa-incidence', label: 'CHSA incidence' }],
  'nserc-awards-history': [{ id: 'nserc-awards-2001-2018', label: 'NSERC fiscal records · 2001–2018' }, { id: 'nserc-awards', label: 'Recent NSERC award window' }],
  'nserc-awards-2001-2018': [{ id: 'nserc-awards-history', label: 'Historical NSERC fiscal records' }, { id: 'nserc-awards', label: 'Recent NSERC award window' }],
  'nserc-awards': [{ id: 'nserc-awards-2001-2018', label: 'NSERC fiscal records · 2001–2018' }, { id: 'nserc-awards-history', label: 'Historical NSERC fiscal records' }],
  'institution-enrolment': [{ id: 'university-research-intensity', label: 'Published research intensity' }],
  'university-research-intensity': [{ id: 'institution-enrolment', label: 'Institutional enrolment' }, { id: 'research-income', label: 'Research-income source series' }],
  'healthlink-hospital-additions': [{ id: 'hospital-facilities', label: 'Existing hospital directory' }],
  'northern-capital-projects': [{ id: 'northern-capital-site-context', label: 'Verified capital-site context' }],
  'northern-capital-site-context': [{ id: 'northern-capital-projects', label: 'Original capital-project records' }],
};
function LinkedViews({ dataset, onOpen }: { dataset: AtlasDataset; onOpen: (id: string) => void }) {
  const views = linkedViews[dataset.id]?.filter(view => atlasDatasets.some(item => item.id === view.id));
  if (!views?.length) return null;
  return <div className="atlas-linked-views"><strong>Connected views</strong>{views.map(view => <button key={view.id} className="atlas-text-button" onClick={() => onOpen(view.id)}>{view.label} <ArrowUpRight size={15} /></button>)}</div>;
}

function SourceNotes({ dataset, indicator }: { dataset: AtlasDataset; indicator?: string }) { return <details className="atlas-source-notes"><summary><Info size={16} /> Source, interpretation & limitations</summary><div><p><strong>{dataset.sourceName}</strong> · {dataset.timeLabel}</p><p>{dataset.description}</p>{dataset.sourceOrigin === "supplemental" && <p>Supplementary measurements retrieved from the named publisher.{atlasDev && " Their source reference is separate from the NHHR Zoer collection inventory."}</p>}{dataset.supplementalSources?.map(source => <p key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.name}</a> · {source.scope}</p>)}<ul>{dataset.notes.map((note, index) => <li key={index}>{note}</li>)}</ul>{dataset.indicatorMetadata && Object.entries(dataset.indicatorMetadata).filter(([name]) => !indicator || name === indicator).map(([name, metadata]) => <details key={name}><summary>{name} · original definition</summary><p>{metadata.definition}</p><p>{metadata.notes}</p><p>{metadata.comments}</p><a href={metadata.furtherInformation} target="_blank" rel="noreferrer">Publisher case definitions</a></details>)}<dl>{atlasDev && <><dt>{dataset.sourceOrigin === "supplemental" ? "Source dataset reference" : dataset.sourceOrigin === "mixed" ? "Primary Zoer dataset ID" : "Zoer dataset ID"}</dt><dd>{dataset.datasetId}</dd><dt>Source table</dt><dd>{dataset.tableName}</dd></>}<dt>Geographic scope</dt><dd>{geographyLabel(dataset)}</dd></dl>{(atlasDev || !isZoerUrl(dataset.sourceUrl)) && <a href={dataset.sourceUrl} target="_blank" rel="noreferrer">Open source reference <ExternalLink size={14} /></a>}{dataset.id.startsWith("trial-facility-") && <p><a href={boundaryAssetUrl("trial-facility-study-sites.csv")} download>Download all reviewed study-site evidence (CSV)</a> · <a href={boundaryAssetUrl("trial-facility-conditions-provenance.json")} target="_blank" rel="noreferrer">Source and location verification</a></p>}</div></details>; }

function StoryCard({ story, dataset, onOpen, featured = false }: { story: AtlasStory; dataset: AtlasDataset; onOpen: () => void; featured?: boolean }) {
  return <button className={`atlas-story-card${featured ? " atlas-featured-card" : ""}`} onClick={onOpen}><div className="atlas-story-art" aria-hidden="true"><div className="atlas-art-grid" /><span className="atlas-art-topic">{dataset.topic}</span><div className="atlas-mini-bars">{dataset.rows.filter(row => typeof row[story.metric] === "number").slice(0, 7).map((row, index, all) => <span key={index} style={{ height: `${Math.max(4, Math.abs(Number(row[story.metric])) / (Math.max(...all.map(value => Math.abs(Number(value[story.metric])))) || 1) * 100)}%` }} />)}</div><span className="atlas-art-label">{hasMap(dataset) ? "Explore the geography" : dataset.status === "scenario" ? "Explore the assumptions" : "Explore the evidence"}</span><span className="atlas-art-arrow"><ArrowUpRight size={22} /></span></div><div className="atlas-story-card-body"><div className="atlas-card-meta"><span>{story.kicker}</span><Badge status={dataset.status} /></div><h3>{story.title}</h3><p>{story.summary}</p><span className="atlas-card-cta">Read the story <ArrowRight size={17} /></span></div></button>;
}

export default function Atlas() {
  const [state, setState] = useState<State>(readState);
  const [topic, setTopic] = useState("All topics");
  const [catalogueSearch, setCatalogueSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [datasetSearch, setDatasetSearch] = useState("");
  // On phones the dataset list folds into a section menu, as unbc.ca's does.
  const [datasetMenuOpen, setDatasetMenuOpen] = useState(false);
  const dataset = atlasDatasets.find(item => item.id === state.dataset) ?? firstDataset;
  const storyMap = atlasStoryMaps.find(item => item.id === state.story);
  const story = atlasStories.find(item => item.id === state.story);
  const storyDataset = story ? atlasDatasets.find(item => item.id === story.datasetId) : undefined;
  useEffect(() => {
    // The bounded reader restores chapters itself. Native history restoration
    // otherwise races its scroll position when returning from the explorer.
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => { window.history.scrollRestoration = previous; };
  }, []);
  useEffect(() => { const listener = () => setState(readState()); window.addEventListener("popstate", listener); return () => window.removeEventListener("popstate", listener); }, []);
  useEffect(() => { document.title = `${state.section === "explore" ? "Data explorer" : state.section === "sources" ? "Sources" : storyMap?.title ?? story?.title ?? "Stories"} · NHHR Atlas`; }, [state.section, story, storyMap]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(""), 6500); return () => window.clearTimeout(timer); }, [notice]);
  const update = (patch: Partial<State>, push = false) => { setState(current => { const next = { ...current, ...patch }; writeState(next, push); return next; }); };
  const navigate = (section: Section) => { update({ section, story: "" }, true); window.scrollTo({ top: 0, behavior: "auto" }); };
  const openStory = (id: string) => { update({ section: "stories", story: id, region: "" }, true); window.scrollTo({ top: 0, behavior: "auto" }); };
  const openDataset = (item: AtlasDataset, metric = item.defaultMetric, display?: State["chart"]) => { update({ section: "explore", dataset: item.id, metric, ...defaultDatasetView(item), ...(display ? { chart: display } : {}), entities: [], search: "", region: "", story: "" }, true); window.scrollTo({ top: 0, behavior: "auto" }); };
  const openLinkedView = (id: string) => {
    const target = atlasDatasets.find(item => item.id === id)!;
    const currentEntity = state.region || state.entity;
    const currentRow = dataset.rows.find(row => String(row[dataset.entityField]) === currentEntity);
    const exactTarget = currentRow?.location_code ? target.rows.find(row => row.location_code === currentRow.location_code) : undefined;
    const sourceCity = currentRow?.query_city ?? currentRow?.city ?? state.filters.query_city ?? state.filters.city ?? (dataset.geography === 'city' ? state.entity : '');
    const next = { ...defaultDatasetView(target), entity: exactTarget && target.entityField === 'facility_name' ? String(exactTarget.facility_name) : sourceCity && target.rows.some(row => row[target.entityField] === sourceCity) ? String(sourceCity) : defaultDatasetView(target).entity };
    if (target.entityField === dataset.entityField && currentEntity && target.rows.some(row => row[target.entityField] === currentEntity)) next.entity = currentEntity;
    for (const key of ['age_group', 'sex']) {
      if (Object.hasOwn(state.filters, key) && target.columns.some(column => column.key === key) && (!state.filters[key] || target.rows.some(row => row[key] === state.filters[key]))) next.filters[key] = state.filters[key];
    }
    if (dataset.id.startsWith('northern-chsa-') && target.id.startsWith('northern-chsa-') && state.filters.indicator) {
      const indicator = target.id.endsWith('prevalence') ? state.filters.indicator.replace('age-standardized incidence rate', 'age-standardized lifetime prevalence rate') : state.filters.indicator.replace('age-standardized lifetime prevalence rate', 'age-standardized incidence rate');
      if (target.rows.some(row => row.indicator === indicator)) next.filters.indicator = indicator;
    }
    if (dataset.id.startsWith('community-disease-') && target.id.startsWith('community-disease-')) {
      const pairedIndicator = target.id.endsWith('prevalence') ? currentEntity.replace('age-standardized incidence rate', 'age-standardized lifetime prevalence rate') : currentEntity.replace('age-standardized lifetime prevalence rate', 'age-standardized incidence rate');
      if (target.rows.some(row => row[target.entityField] === pairedIndicator)) next.entity = pairedIndicator;
      else if (!currentEntity) next.entity = '';
    }
    if (target.timeField && state.year && target.rows.some(row => String(row[target.timeField!]) === state.year)) next.year = state.year;
    if (target.id === 'trial-facility-conditions' && sourceCity && target.rows.some(row => row.query_city === sourceCity)) next.filters.query_city = String(sourceCity);
    if (state.filters.condition_domain && target.columns.some(column => column.key === 'condition_domain') && target.rows.some(row => row.condition_domain === state.filters.condition_domain)) next.filters.condition_domain = state.filters.condition_domain;
    if (id === 'trial-site-evidence' && currentRow) next.filters.facility_name = String(currentRow.facility_name);
    if (id === 'travel-stop-events' && currentRow?.location_code) next.filters = { route_slug: '', location_code: String(currentRow.location_code) };
    let entities = target.entityField === dataset.entityField ? state.entities.filter(entity => target.rows.some(row => String(row[target.entityField]) === entity)) : [];
    if (!currentEntity && state.entities.length && dataset.entityField === 'query_city' && target.id === 'trial-facility-conditions') {
      entities = [...new Set(target.rows.filter(row => state.entities.includes(String(row.query_city))).map(row => String(row.facility_name)))];
    } else if (!currentEntity && state.entities.length && dataset.id === 'trial-facility-conditions' && target.entityField === 'query_city') {
      const cities = new Set(dataset.rows.filter(row => state.entities.includes(String(row.facility_name))).map(row => String(row.query_city)));
      entities = [...cities].filter(city => target.rows.some(row => String(row.query_city) === city));
    }
    update({ section: 'explore', story: '', dataset: id, metric: target.defaultMetric, ...next, entities, chart: id === 'trial-site-evidence' ? 'table' : next.chart, search: '', region: '' }, true);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };
  const filteredRows = useMemo(() => dataset.rows.filter(row => (!state.year || String(row[dataset.timeField ?? ""]) === state.year) && (!state.entity || String(row[dataset.entityField]) === state.entity) && (!state.entities.length || state.entities.includes(String(row[dataset.entityField]))) && Object.entries(state.filters).every(([key, value]) => !value || String(row[key]) === value) && (!state.search || dataset.columns.some(column => String(row[column.key] ?? "").toLowerCase().includes(state.search.toLowerCase())))), [dataset, state.year, state.entity, state.entities, state.search, state.filters]);
  const metric = dataset.columns.find(column => column.key === state.metric && column.type === "number")?.key ?? dataset.defaultMetric;
  const metricColumn = dataset.columns.find(column => column.key === metric);
  const selectedDisplay = state.chart === "map" && !canMapMetric(dataset, metric) ? "chart" : state.chart;
  const topics = [...new Set([...atlasStories.map(item => atlasDatasets.find(data => data.id === item.datasetId)?.topic).filter(Boolean), ...atlasStoryMaps.map(item => item.topic)])] as string[];
  const matchingStoryMaps = atlasStoryMaps.filter(item => (topic === "All topics" || item.topic === topic) && (!catalogueSearch || `${item.title} ${item.summary} ${item.topic}`.toLowerCase().includes(catalogueSearch.toLowerCase())));
  const matchingStories = atlasStories.filter(item => { const data = atlasDatasets.find(value => value.id === item.datasetId); return data && (topic === "All topics" || data.topic === topic) && (!catalogueSearch || `${item.title} ${item.summary} ${data.topic}`.toLowerCase().includes(catalogueSearch.toLowerCase())); });
  const featured = matchingStories.find(item => item.featured) ?? matchingStories[0];
  const reviewedFilterFields: Record<string, string[]> = {
    'hospital-facilities': ['city', 'location_status'],
    'hospital-facility-costs': ['health_authority', 'city', 'cost_status'],
    'trial-sites': ['site_category', 'location_status'],
    'trial-site-evidence': ['facility_name', 'overall_status', 'condition_domain', 'location_status'],
    'clinical-condition-mix': ['condition_domain'],
    'trial-facility-conditions': ['query_city', 'condition_domain'],
    'trial-facility-coverage': [],
    'travel-stop-events': ['route_slug', 'service_day', 'event_type', 'location_precision', 'source_leg'],
    'travel-stop-locations': ['city', 'location_precision'],
    'historical-cancer-incidence': ['sex', 'cancer_site'],
    'research-chairs': [],
    'cfi-projects-by-year': [],
    'cfi-projects-total': [],
    'sshrc-payments': [],
    'pubmed-affiliation-counts': [],
    'research-expenditures': [],
    'publications-history': [],
    'allied-health-northern': ['profession'],
    'health-occupation-wages': ['occupation', 'wage_status'],
    'bc-hospital-staffing': [],
    'bc-health-occupation-vacancies': ['vacancy_status'],
    'bc-sector-wages': [],
    'census-housing-cd': [],
    'census-housing-csd': [],
    'municipal-population': [],
    'regional-employment-annual': ['employment_group'],
    'regional-labour-monthly': [],
    'regional-labour-archived': [],
    'municipal-business-locations': ['industry'],
    'bc-business-locations': ['industry', 'employee_size'],
    'bc-hourly-wages': ['industry', 'statistic'],
    'canada-retirement-age': [],
    'bc-interprovincial-migration': [],
    'bc-graduate-income': ['outcome'],
    'bc-export-destinations': [],
    'bc-housing-starts': [],
    'bc-housing-benchmarks': [],
    'vancouver-construction-index': ['building_type'],
    'canada-output-coefficients': ['industry', 'multiplier_type'],
    'bc-output-coefficients': ['industry', 'multiplier_type', 'geographical_coverage'],
    'bc-graduate-projections': ['age_group'],
    'bc-health-occupation-projections': ['age_group'],
    'community-disease-incidence': ['sex'],
    'community-disease-prevalence': ['sex'],
    'northern-chsa-incidence': ['indicator', 'reporting_status'],
    'northern-chsa-prevalence': ['indicator', 'reporting_status'],
    'institution-enrolment': [],
    'nserc-awards-history': [],
    'nserc-awards-2001-2018': ['source_origin'],
    'university-research-intensity': [],
    'hospital-research-organizations': [],
    'healthlink-hospital-additions': ['city', 'location_status'],
    'northern-capital-projects': ['facility_name', 'location_status'],
    'northern-capital-site-context': ['location_status'],
  };
  const extraFilters = dataset.columns.filter(column => (!reviewedFilterFields[dataset.id] || reviewedFilterFields[dataset.id].includes(column.key)) && column.type === "text" && ![dataset.entityField, dataset.timeField, dataset.boundaryKeyField].includes(column.key) && uniqueValues(dataset.rows, column.key).length > 1 && uniqueValues(dataset.rows, column.key).length <= 40);
  const hasFilters = !!(state.year || state.entity || state.entities.length || state.search || Object.values(state.filters).some(Boolean));
  const copyLink = async () => { try { await navigator.clipboard.writeText(window.location.href); setNotice("Link copied. It includes the current view and filters."); } catch { setNotice("Link could not be copied. Copy the address from your browser to share this view."); } };
  const download = () => {
    const escape = (value: unknown) => { let text = value == null ? "" : String(value); if (/^[=+@\t\r]/.test(text) || (/^-/.test(text) && typeof value !== "number")) text = `'${text}`; return `"${text.replace(/"/g, '""')}"`; };
    const content = [dataset.columns.map(column => escape(column.key)).join(","), ...filteredRows.map(row => dataset.columns.map(column => escape(row[column.key])).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `nhhr-${dataset.id}-filtered.csv`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice(`Downloaded ${filteredRows.length.toLocaleString()} filtered source records. Missing values are empty CSV cells.`);
  };

  const pageTitle = state.section === "explore" ? "Data explorer" : state.section === "sources" ? "Sources and methods" : storyMap?.title ?? story?.title ?? (state.story ? "Story not found" : "Research stories");
  const sectionUrl = atlasMenuUrl(state.section === "stories" ? undefined : state.section);
  // Chrome and breadcrumb links to Atlas sections change the view in place.
  const followAtlasLink = (link: HTMLAnchorElement) => {
    const url = new URL(link.href);
    if (url.origin !== window.location.origin || url.pathname.replace(/\/$/, "") !== atlasRoot || url.hash) return false;
    const view = url.searchParams.get("view");
    navigate(view === "explore" || view === "sources" ? view : "stories");
    return true;
  };

  // The chrome's campus-map link is its "home" link.
  const openCampus = () => window.location.assign(`${import.meta.env.BASE_URL}campus`);
  // An open story map fills the window, as PGMaps project stories do.
  const fullStory = state.section === "stories" && !!storyMap;
  return <div className={`unbc-atlas-shell${fullStory ? " is-story-full" : ""}`}>
    <ChromeHeader onHome={openCampus} onAbout={() => navigate("sources")} onLink={followAtlasLink} site={atlasSite} activeUrl={sectionUrl}
      search={{ label: "Search NHHR data", items: atlasDatasets.map(item => ({ id: item.id, name: item.title, searchText: item.topic })), onSelect: item => { const found = atlasDatasets.find(dataset => dataset.id === item.id); if (found) openDataset(found); } }} />
    <div className="atlas-app">
    <main id="atlas-main">
      {!fullStory && <><header className="atlas-title" onClick={event => { const link = (event.target as Element).closest<HTMLAnchorElement>("a[href]"); if (link && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && followAtlasLink(link)) event.preventDefault(); }}><h1>{pageTitle}</h1><ChromeBreadcrumbs section={state.section === "explore" ? "Data explorer" : state.section === "sources" ? "Sources and methods" : storyMap?.title ?? story?.title ?? "Research stories"} className="atlas-breadcrumbs" atlasUrl={atlasMenuUrl()} /></header>
      <nav className="atlas-section-nav" aria-label="NHHR Atlas sections"><ul>{([['stories', 'Stories', BookOpen, ''], ['explore', 'Data explorer', Database, ''], ['sources', 'Sources', Info, ' & methods']] as const).map(([section, label, Icon, more]) => <li key={section}><button onClick={() => navigate(section)} aria-current={state.section === section ? "page" : undefined}><Icon size={16} aria-hidden="true" /><span>{label}{more && <span className="atlas-tab-more">{more}</span>}</span></button></li>)}</ul></nav></>}
      {state.section === "stories" && !state.story && <><section id="atlas-stories" className="atlas-stories-section"><div className="atlas-catalogue-tools"><label className="atlas-search"><Search size={17} /><input aria-label="Search stories" placeholder="Search stories" value={catalogueSearch} onChange={event => setCatalogueSearch(event.target.value)} /></label><label className="atlas-filter-field atlas-topic-select">Topic<select aria-label="Filter stories by topic" value={topic} onChange={event => setTopic(event.target.value)}>{["All topics", ...topics].map(value => <option key={value}>{value}</option>)}</select></label></div><section className="atlas-storymap-collection" aria-label="Guided story maps">{matchingStoryMaps.length > 0 && <><h2>Guided story maps <span className="atlas-count">{matchingStoryMaps.length}</span></h2><div className="atlas-storymap-grid">{matchingStoryMaps.map(item => <a key={item.id} className="atlas-storymap-card" href={`${atlasRoot}/${item.id}`} onClick={event => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); openStory(item.id); } }}><span><MapIcon size={16} />{item.topic} · {item.chapters.length} chapters</span><h3>{item.title}</h3><p>{item.summary}</p><span>Open story map <ArrowRight size={16} /></span></a>)}</div></>}</section>{matchingStories.length > 0 && <h2 className="atlas-story-grid-heading">Short stories <span className="atlas-count">{matchingStories.length}</span></h2>}<div className="atlas-story-grid">{matchingStories.map(item => <StoryCard key={item.id} story={item} dataset={atlasDatasets.find(data => data.id === item.datasetId)!} featured={item.id === featured?.id} onOpen={() => openStory(item.id)} />)}</div>{!matchingStories.length && !matchingStoryMaps.length && <div className="atlas-empty"><strong>No stories found.</strong><p>Try another topic or search term.</p><button className="atlas-text-button" onClick={() => { setTopic("All topics"); setCatalogueSearch(""); }}>Reset story filters</button></div>}<div className="atlas-explore-banner"><div><h3>Go beyond the stories.</h3><p>Compare the source records behind them.</p></div><button className="atlas-primary" onClick={() => navigate("explore")}>Open the data explorer <ArrowUpRight size={19} /></button></div></section></>}
      {state.section === "stories" && storyMap && <AtlasStoryMap key={storyMap.id} story={storyMap} onCopy={copyLink} onBack={() => { navigate("stories"); window.scrollTo({ top: 0, behavior: "auto" }); }} onExplore={(chapter: StoryMapChapter) => {
        // Clicking a chapter action may scroll it into view and change the
        // reading line first. History must return to the clicked chapter.
        const origin = new URL(window.location.href); origin.hash = chapter.id;
        window.history.replaceState(window.history.state, "", origin);
        const data = atlasDatasets.find(item => item.id === chapter.evidence.datasetId)!;
        const filters = { ...data.defaultFilters, ...chapter.evidence.filters };
        const entity = chapter.evidence.entities?.length === 1 ? chapter.evidence.entities[0] : chapter.evidence.entities?.length ? '' : filters[data.entityField] ?? '';
        delete filters[data.entityField];
        update({ section: "explore", dataset: data.id, metric: chapter.evidence.metric, year: chapter.evidence.year ?? "", entity, entities: chapter.evidence.entities && chapter.evidence.entities.length > 1 ? chapter.evidence.entities : [], search: "", region: "", chart: chapter.evidence.kind === "paired" ? "paired" : chapter.evidence.kind === "map" || chapter.evidence.kind === "comparison" ? "map" : "chart", filters, story: "" }, true); window.scrollTo({ top: 0, behavior: "auto" }); }} />}
      {state.section === "stories" && story && storyDataset && <article className="atlas-story-detail"><div className="atlas-story-intro"><p className="atlas-eyebrow">{story.kicker}{story.kicker.toLowerCase().includes(storyDataset.topic.toLowerCase()) ? "" : ` · ${storyDataset.topic}`}</p><p className="atlas-story-deck">{story.summary}</p><div className="atlas-story-byline"><Badge status={storyDataset.status} /><span>{storyDataset.timeLabel}</span><button className="atlas-text-button" onClick={copyLink}><Link2 size={15} /> Copy story link</button></div></div><div className="atlas-story-sidecar"><div className="atlas-story-narrative"><p className="atlas-eyebrow">Reading the evidence</p>{story.body.map((paragraph, index) => <p key={index}>{paragraph}</p>)}<div className="atlas-scope-note"><Info size={18} /><p>{storyGeographyNote(storyDataset)}</p></div><button className="atlas-primary" onClick={() => openDataset(storyDataset, story.metric, story.visualization === "pairedAgeMaps" ? "paired" : undefined)}>Explore this dataset <ArrowUpRight size={18} /></button></div><div className="atlas-story-evidence"><div className="atlas-evidence-topline"><span><BarChart3 size={17} /> From the source table</span><span>{storyDataset.rows.length.toLocaleString()} records</span></div><StoryEvidenceView dataset={storyDataset} story={story} selectedRegion={state.region} onSelectRegion={value => update({ region: value ?? "" })} /><p className="atlas-evidence-source">Source: {storyDataset.sourceName} · {storyDataset.timeLabel}</p></div></div><SourceNotes dataset={storyDataset} /><div className="atlas-related-heading"><h2>Keep exploring</h2><span>More from the collection</span></div><div className="atlas-story-grid atlas-related-grid">{atlasStories.filter(item => item.id !== story.id).slice(0, 3).map(item => <StoryCard key={item.id} story={item} dataset={atlasDatasets.find(data => data.id === item.datasetId)!} onOpen={() => openStory(item.id)} />)}</div></article>}
      {state.section === "stories" && state.story && !story && !storyMap && <div className="atlas-empty"><p>This link does not match a story in the current collection.</p><button className="atlas-primary" onClick={() => navigate("stories")}>Browse stories <ArrowRight size={16} /></button></div>}
      {state.section === "explore" && <section className="atlas-explorer"><div className="atlas-explorer-layout"><aside className="atlas-dataset-sidebar"><div className="atlas-sidebar-heading"><h2>Datasets</h2><span>{atlasDatasets.length}</span></div><button className="atlas-dataset-toggle" aria-expanded={datasetMenuOpen} aria-controls="atlas-dataset-picker" onClick={() => setDatasetMenuOpen(open => !open)}><span><span className="atlas-dataset-toggle-label">Datasets · {atlasDatasets.length}</span><span className="atlas-dataset-toggle-current">{dataset.title}</span></span><span aria-hidden="true" className="atlas-dataset-toggle-icon">{datasetMenuOpen ? "−" : "+"}</span></button><div id="atlas-dataset-picker" className={`atlas-dataset-picker${datasetMenuOpen ? " is-open" : ""}`}><label className="atlas-search"><Search size={16} /><input aria-label="Search datasets" placeholder="Find a dataset" value={datasetSearch} onChange={event => setDatasetSearch(event.target.value)} /></label><div className="atlas-dataset-list">{atlasDatasets.filter(item => `${item.title} ${item.topic}`.toLowerCase().includes(datasetSearch.toLowerCase())).map(item => <button className={dataset.id === item.id ? "is-active" : ""} key={item.id} onClick={() => { setDatasetMenuOpen(false); openDataset(item); }} aria-pressed={dataset.id === item.id}><span className="atlas-dataset-topic">{item.topic}</span><strong>{item.title}</strong><span className="atlas-dataset-detail">{item.rows.length.toLocaleString()} records · {item.timeLabel}</span><span className="atlas-dataset-badges"><Badge status={item.status} />{hasMap(item) && <MapIcon size={14} aria-label="Geographic map available" />}</span></button>)}</div>{!atlasDatasets.some(item => `${item.title} ${item.topic}`.toLowerCase().includes(datasetSearch.toLowerCase())) && <p className="atlas-sidebar-empty">No datasets match this search.</p>}<p className="atlas-sidebar-note">Reviewed NHHR Data Space extracts and clearly attributed publisher supplements. Coverage and source limitations vary by dataset.</p></div></aside><div className="atlas-explorer-workspace"><div className="atlas-dataset-header"><div className="atlas-card-meta"><span>{dataset.topic}</span><Badge status={dataset.status} /></div><h2>{dataset.title}</h2><p>{dataset.description}</p><div className="atlas-dataset-context"><span><Database size={14} />{dataset.rows.length.toLocaleString()} source records</span><span><MapIcon size={14} />{geographyLabel(dataset)}</span><span>{dataset.timeLabel}</span></div></div>{dataset.status !== "observed" && <div className={`atlas-data-caution atlas-data-caution-${dataset.status}`}><Info size={17} /><p>{dataset.status === "projection" ? "Published source projections. These values describe modelled future supply under the source assumptions; they are not observed graduates, licensed professionals or staff available to NHHR." : dataset.status === "scenario" ? "Scenario inputs and assumptions. These values describe a modelled case and should not be presented as observed health outcomes." : "This dataset needs further review. Use the source notes to understand unresolved scope, definitions and coverage before drawing conclusions."}</p></div>}<div className="atlas-filter-panel"><label className="atlas-filter-field atlas-metric-field">Measure<select aria-label="Measure" data-testid="metric-select" disabled={selectedDisplay === "paired"} title={selectedDisplay === "paired" ? "Paired maps show both the age 65+ share and number of people." : undefined} value={metric} onChange={event => update({ metric: event.target.value, region: "", ...(state.chart === "map" && !canMapMetric(dataset, event.target.value) ? { chart: "chart" as const } : {}) })}>{dataset.columns.filter(column => column.type === "number").map(column => <option key={column.key} value={column.key}>{column.label}{column.unit ? ` (${column.unit})` : ""}</option>)}</select></label>{dataset.timeField && <label className="atlas-filter-field">{dataset.columns.find(column => column.key === dataset.timeField)?.label ?? "Period"}<select aria-label={dataset.columns.find(column => column.key === dataset.timeField)?.label ?? "Period"} data-testid="year-select" value={state.year} onChange={event => update({ year: event.target.value, region: "" })}><option value="">All periods</option>{uniqueValues(dataset.rows, dataset.timeField).map(value => <option key={value}>{value}</option>)}</select></label>}<label className="atlas-filter-field">{dataset.columns.find(column => column.key === dataset.entityField)?.label ?? "Entity"}<select aria-label={dataset.columns.find(column => column.key === dataset.entityField)?.label ?? "Entity"} data-testid="entity-select" value={state.entity} onChange={event => update({ entity: event.target.value, entities: [], region: "" })}><option value="">All records</option>{uniqueValues(dataset.rows, dataset.entityField).map(value => <option key={value}>{value}</option>)}</select></label>{extraFilters.map(column => <label className="atlas-filter-field" key={column.key}>{column.label}<select value={state.filters[column.key] ?? ""} onChange={event => update({ filters: { ...state.filters, [column.key]: event.target.value }, region: "" })}><option value="">All values</option>{uniqueValues(dataset.rows, column.key).map(value => <option key={value}>{value}</option>)}</select></label>)}<label className="atlas-search atlas-record-search"><Search size={16} /><input placeholder="Search within records" aria-label="Search within source records" value={state.search} onChange={event => update({ search: event.target.value, region: "" })} /></label></div><div className="atlas-view-toolbar"><div className="atlas-display-tabs" role="tablist" aria-label="Data display">{([['chart', 'Chart', BarChart3], ['map', 'Map', MapIcon], ...(dataset.id === 'population-lha-ages' ? [['paired', 'Paired age maps', Layers] as const] : []), ['table', 'Table', Table2]] as const).map(([id, label, Icon]) => <button role="tab" aria-selected={selectedDisplay === id} aria-controls="atlas-data-panel" id={`atlas-${id}-tab`} className={selectedDisplay === id ? "is-active" : ""} key={id} disabled={id === "map" && !canMapMetric(dataset, metric)} title={id === "map" && !canMapMetric(dataset, metric) ? hasMap(dataset) ? "Signed values are available in charts and tables; circle area cannot represent a negative value." : "No verified boundary join or representative point location is available for this dataset" : undefined} onClick={() => update({ chart: id, ...(id === "paired" ? { metric: "share_65_plus" } : {}), ...((id === "map" || id === "paired") && selectedDisplay !== id && !state.year && dataset.timeField ? { year: uniqueValues(filteredRows, dataset.timeField).at(-1) ?? latestPeriod(dataset) } : {}) })}><Icon size={16} />{label}</button>)}</div><div className="atlas-export-actions"><button aria-label="CSV" onClick={download}><Download size={16} /><span>CSV</span></button><button aria-label="Share view" onClick={copyLink}><Link2 size={16} /><span>Share view</span></button></div></div><div className="atlas-results-line"><span><strong>{filteredRows.length.toLocaleString()}</strong> of {dataset.rows.length.toLocaleString()} source records{state.entities.length > 0 ? ` · ${state.entities.length} selected entities` : ""}{metricColumn?.unit ? ` · ${metricColumn.unit}` : ""}</span>{hasFilters && <button className="atlas-text-button" onClick={() => update({ year: "", entity: "", entities: [], search: "", filters: Object.fromEntries(Object.keys(dataset.defaultFilters ?? {}).map(key => [key, ""])), region: "" })}><X size={14} />Clear filters</button>}</div>{dataset.id === "clinical-condition-mix" && selectedDisplay === "map" && !state.filters.condition_domain && <p className="atlas-geography-note"><Info size={15} />Select one coded condition to map its city values. Multiple condition rows are retained in the records and withheld from the map rather than summed. Percentages always use the full source city portfolio.</p>}{dataset.id === "trial-facility-conditions" && <p className="atlas-geography-note"><Info size={15} />Verified facility subset of the collected city portfolios. Select one condition for map values; percentages retain each facility’s full reviewed study denominator. Missing condition rows are not reported as observed zeros. A study may appear at multiple sites.</p>}<div className="atlas-data-panel" id="atlas-data-panel" role="tabpanel" aria-labelledby={`atlas-${selectedDisplay}-tab`} tabIndex={0}>{selectedDisplay === "chart" && (dataset.id === "clinical-condition-mix" ? <AtlasConditionMix dataset={dataset} rows={filteredRows} metric={metric} /> : <AtlasChart key={`${dataset.id}-${metric}`} dataset={dataset} rows={filteredRows} metric={metric} />)}{selectedDisplay === "map" && <AtlasMap dataset={dataset} metric={metric} rows={filteredRows} selectedRegion={state.region || undefined} onSelectRegion={value => update({ region: value ?? "" })} />}{selectedDisplay === "paired" && <AtlasPairedAgeMaps dataset={dataset} rows={filteredRows} selectedRegion={state.region || undefined} onSelectRegion={value => update({ region: value ?? "" })} />}{selectedDisplay === "table" && <DataTable dataset={dataset} rows={filteredRows} />}</div>{!hasMap(dataset) && <p className="atlas-geography-note"><Info size={15} />{geographyLabel(dataset)}: no reviewed compatible polygon or point join is available for this view. Charts and tables preserve the original unit of observation.</p>}{selectedDisplay === "map" && (dataset.geography === "institution" || dataset.geography === "city") && <p className="atlas-geography-note"><Info size={15} />{dataset.geography === "city" ? "City dots retain the source city-query grain. Their area compares the selected snapshot measure, and does not establish facility locations or population coverage." : "Institution-level records are shown at representative campus coordinates. Dot sizes compare the selected measure for one period; they do not allocate funding or activity to surrounding populations, health regions or campus facilities."}</p>}{hasMap(dataset) && !canMapMetric(dataset, metric) && <p className="atlas-geography-note"><Info size={15} />This measure contains signed values. Charts and tables retain their signs; proportional circle area cannot represent a negative value.</p>}<LinkedViews dataset={dataset} onOpen={openLinkedView} /><SourceNotes dataset={dataset} indicator={state.filters.indicator} /></div></div></section>}
      {state.section === "sources" && <section className="atlas-about"><nav className="atlas-on-page" aria-label="On this page"><p>On this page</p><ul><li><a href="#atlas-principles">Principles</a></li><li><a href="#atlas-connections">How the data connects</a></li>{atlasDev && <li><a href="#atlas-zoer">NHHR datasets in Zoer</a></li>}<li><a href="#atlas-register">Source register ({atlasDatasets.length})</a></li></ul></nav><div className="atlas-about-principles" id="atlas-principles"><div><span>01</span><h2>Start at the source.</h2><p>Every view names its dataset, source table, period and limitations. The {atlasDatasets.length} explorer datasets are a reviewed selection, not the whole Data Space.</p></div><div><span>02</span><h2>Keep geography honest.</h2><p>Regions join to boundaries by their source codes. Institution and city points mark a place; they do not spread activity over the people or facilities around it.</p></div><div><span>03</span><h2>Make uncertainty visible.</h2><p>Scenarios and records needing review are labelled. Missing values stay missing, and counts describe this collection only.</p></div></div><div className="atlas-inventory-summary"><Database size={20} /><div><strong>The source catalogue</strong><p>{atlasInventory.collections.length} NHHR collections in the public catalogue · {atlasDatasets.length} reviewed explorer views. {atlasDev ? "Browse the Zoer source collections below or open a connected view to inspect its records." : "Open a view in the source register below to inspect its records."}</p>{atlasDev && <a href={atlasInventory.manifestUrl} target="_blank" rel="noreferrer">Open the NHHR Data Space manifest <ExternalLink size={14} /></a>}</div></div><AtlasConnections onExplore={openDataset} />{atlasDev && <AtlasZoerCatalogue onExplore={openDataset} />}<div className="atlas-section-heading" id="atlas-register"><div><p className="atlas-eyebrow">Source register</p><h2>What's in this release.</h2></div><span>{atlasDatasets.length} selected datasets</span></div><div className="atlas-source-register">{atlasDatasets.map(item => <article key={item.id}><div><span className="atlas-eyebrow">{item.topic}</span><h3>{item.title}</h3><p>{item.sourceName} · {item.timeLabel}</p><p>{geographyLabel(item)} · {item.rows.length.toLocaleString()} source records</p><Badge status={item.status} /></div><div className="atlas-source-register-actions"><button className="atlas-text-button" onClick={() => openDataset(item)}>Explore records <ArrowUpRight size={16} /></button>{(atlasDev || !isZoerUrl(item.sourceUrl)) && <a href={item.sourceUrl} target="_blank" rel="noreferrer">Source reference <ExternalLink size={14} /></a>}</div><SourceNotes dataset={item} /></article>)}</div></section>}
    </main>{notice && <div className="atlas-notice" role="status"><Check size={17} /><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice("")}><X size={15} /></button></div>}
  </div>{!fullStory && <ChromeFooter onHome={openCampus} onAbout={() => navigate("sources")} />}
  </div>;
}
