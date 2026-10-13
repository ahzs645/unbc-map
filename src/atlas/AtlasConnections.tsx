import { atlasDatasets } from './data';
import { boundaryAssetUrl } from './geography';
import type { AtlasDataset } from './types';

const connections = [
  ['clinical-city', 'Exact queried city → verified place point', 'Seven city labels; dots compare collected study-site counts. They do not locate individual facilities or describe enrollment.'],
  ['clinical-condition-mix', 'Original city/domain row → full city portfolio denominator → reviewed city point', '77 original rows and 13 coded condition labels. A condition filter retains the full city denominator; select one domain to map values.'],
  ['hospital-stay-costs', 'Exact reporting label → territorial health-authority polygon', 'Five authorities; province and PHSA records have no polygon and remain in charts and tables.'],
  ['research-income', 'CAUBO institution code → comparator → campus point', 'Seven universities and four fiscal years. Sponsored-research income stays separate from award amounts and payments.'],
  ['population-lha-ages', 'Original LHA code → LHA polygon → paired share/count maps', 'Seventeen Northern areas. Both maps use the same source rows, with separate percentage and people scales. Age groups reconcile; 2025 remains a projection.'],
  ['nursing-workforce-northern', 'Reviewed HSDA identity + nursing type + year', 'Three Northern regions and four nursing types. Choose one type and year; rates retain the publisher’s per-10,000 denominator.'],
  ['hospital-facility-costs', 'Exact source facility alias → reviewed current display site', '363 cost rows across five fiscal years; 32 suppressions stay missing. Historical measures describe reporting units rather than individual buildings.'],
  ['trial-sites', 'Reviewed NCT/site record → verified physical facility', 'Three physical sites with nine study-site records; one broad regional description remains unlocated. Reused city-centre coordinates are excluded.'],
  ['trial-facility-conditions', 'Exact city + NCT ID + reviewed facility alias → physical site + NHHR condition code', 'Twenty-five reviewed facilities across seven cities. A city portfolio can include unresolved sites; condition shares retain the full reviewed facility denominator, and multi-site studies are not additive across facilities.'],
  ['travel-stop-events', 'Original event → reviewed facility/address or town reference', '286 preserved events, 280 references and six unresolved events. Dashed links retain source order and schedule legs; they are schematic connections.'],
  ['census-housing-csd', 'Original 2021 DGUID/CSD code → native 2021 Census subdivision', 'Seven Northern municipalities; housing measures retain their household universes, income refers to 2020, and suppression/status fields remain available. A separate view covers 29 Census divisions.'],
  ['municipal-population', 'BC Stats source SGC code → reviewed municipal identity → 2021 contextual CSD', 'Seven municipalities and 2011–2025 estimates. Source boundaries follow July 1 of each stated year; 2021 display polygons are not historical boundary harmonization.'],
  ['regional-employment-annual', 'Original economic-region DGUID → native 2021 economic-region polygon', 'Seven survey areas; health-industry and nursing/allied-health occupation groups overlap. North Coast/Nechako uses one verified union of ERs 5960 and 5970; the combined value is shown once, without disaggregation. Units are thousands of people.'],
  ['allied-health-northern', 'Exact CIHI HSDA + profession + year → Northern health polygon', '90 direct-care observations for occupational therapists, pharmacists and physiotherapists, with source rates per 10,000. Different professions and rate scales are kept separate.'],
  ['health-occupation-wages', 'Original ER identifier + occupation → contextual 2021 economic region', '30 source rows, including 13 missing medians. Four Northern regions use map polygons; BC totals, provincial estimate fallbacks and methods retain their original scope.'],
  ['cfi-projects-total', 'Exact lead-institution name → reviewed institutional comparator', 'Seven lead institutions with seven reviewed campus references, including McMaster. Contributions are infrastructure records, not project costs or annual payments; annual and collected-period views overlap.'],
  ['sshrc-payments', 'Original administration institution + fiscal code → reviewed comparator', 'Six source institutions. Original amounts for funding files split between institutions are retained; absent institutions receive no invented zero.'],
  ['historical-cancer-incidence', 'Original 2015 health-region DGUID → official December 2015 polygon', '572 rows reconcile to the archived original. Three Northern HSDAs use verified December 2015 polygons; the BC benchmark stays unallocated; confidence intervals, source symbols and overlapping windows remain explicit.'],
] as const;

export default function AtlasConnections({ onExplore }: { onExplore: (dataset: AtlasDataset) => void }) {
  return <section className="atlas-connections" aria-label="Dataset connections">
    <div className="atlas-section-heading"><div><p className="atlas-eyebrow">Reviewed 12 October 2026</p><h2>How the data connects.</h2></div></div>
    <p>These views use explicit identifiers and reviewed place identities. Each connection retains the source observation and reporting period.</p>
    <div className="atlas-data-table"><div className="atlas-table-scroll" tabIndex={0} role="region" aria-label="Dataset connections; scroll horizontally to see all columns"><table><thead><tr><th scope="col">Dataset</th><th scope="col">Connection</th><th scope="col">Scope of the view</th></tr></thead><tbody>{connections.map(([id, join, scope]) => {
      const dataset = atlasDatasets.find(item => item.id === id)!;
      return <tr key={id}><th scope="row"><button className="atlas-text-button" onClick={() => onExplore(dataset)}>{dataset.title}</button></th><td>{join}</td><td>{scope}</td></tr>;
    })}</tbody></table></div></div>
    <p>Hospital, trial and travel points link to reviewed source evidence and location caveats. Broad descriptions remain unassigned. Town references do not establish boarding addresses, and the collected travel tables do not contain road-route geometry. Streets and Dark basemaps use vector layers.</p>
    <p><a href={boundaryAssetUrl('connections-review.md')} target="_blank" rel="noreferrer">Read the connection review</a> · <a href={boundaryAssetUrl('connections-review.json')} download>Source IDs, join checks and remaining gaps</a></p>
  </section>;
}
