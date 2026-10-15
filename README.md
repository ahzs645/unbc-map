# NHHR Atlas

The Northern Hub for Health Research Atlas brings collected NHHR evidence into one place: editorial evidence stories, a general data explorer, and regional maps when a dataset has a verified geographic join. It is an independent research interface for the NHHR feasibility work, built with React, MapLibre and the PGMaps GeoToolkit.

The site opens on the public NHHR Atlas: research stories at `/`, the data explorer at `/?view=explore`, sources at `/?view=sources` and guided story maps at `/<story>` (for example `/northern-communities`). `/dev/projects` serves the same Atlas with its Zoer workspace details: the NHHR datasets in Zoer catalogue, Zoer dataset IDs and source tables, and links into Zoer. Public pages name the NHHR Data Space instead and leave those out (`src/atlas/mode.ts`). The original UNBC Campus Explorer is at `/campus` (older `/#place=…` links still open it). Atlas pages sit inside the same UNBC header, breadcrumbs, typography and footer. The logo department text reads “Northern Hub for / Health Research”. Atlas pages follow the www.unbc.ca page anatomy: the header menu lists the Atlas sections (Research stories, Data explorer, Sources & methods, Campus map), each page opens with a gold Helvetica Black title over a 6px warm rule with breadcrumbs beneath, and UNBC-style tabs switch sections in place. Body copy, links, buttons, cards, tables and form controls use the unbc.ca type scale and colours (`src/atlas/unbc-atlas.css`). On phones the dataset list folds into a section menu, topic filters scroll sideways, and a guided story fills the screen with its chapter controls in view.

## Guided story maps

Nine guided stories contain fifty-nine source-backed chapters, using the PGMaps GeoToolkit's reusable sidecar, chapter navigation and reading-section components:

| Route under `/` (or `/dev/projects/`) | Story | Interaction |
| --- | --- | --- |
| `northern-communities` | One North, many communities | Scroll from the Northern LHAs to Prince George, the Northwest and Northeast; inspect estimates and projections |
| `physician-supply` | How physician supply varies across the North | Focus regional rates and reveal synchronized 2020/2024 specialist-count maps with a shared colour domain |
| `research-pathways` | From research activity to trial presence | Move from regional and city context to verified trial sites, institutional research measures and hospital reporting records |
| `travel-and-time` | Travel, time and the evidence we still need | Inspect reviewed stop references and schematic schedule connections, then adjust hypothetical travel and patient-time assumptions |
| `community-context` | Communities, housing and the local economy | Compare native municipal/Census measures and disjoint regional labour areas |
| `research-resources` | The resources behind a research network | Follow institutional funding, research intensity and organizational spending with distinct accounting scopes |
| `workforce-context` | Workforce measures answer different questions | Compare observed professional supply, wages, worked hours, vacancies and historical cancer measures |
| `education-and-health` | Education pipelines and Northern health context | Inspect labelled BC projections, verified institutional enrolment and Northern HA disease rates |
| `facilities-and-investment` | Facilities, directory records and reported investment | Explore reviewed directory additions and original capital-project reporting windows |

The chapter hash is shareable and restores inside the bounded story reader, including on phones. The maps remain mounted while readers change focus or measures. All maps have accessible regional-value tables and links to the data explorer; charts retain their source grain. Media expansion, keyboard controls and reduced-motion preferences are supported. Population projections have hollow chart points and dashed lines.

The scenario reader preserves custom inputs in its URL, reproduces the three collected cases, validates inputs and displays travel and patient-time values separately. Its arithmetic is not an NHHR forecast or observed impact. Physical trial and hospital points use independently reviewed official identity/address and returned OpenStreetMap evidence. Travel lines follow source event order schematically; no road routes, facility catchments or Indigenous territory boundaries are inferred.

## Explore the evidence

- Browse forty evidence stories connecting regional context, research capacity, clinical trials and verified sites, population, patient travel, surgical waits, hospital directory/cost records, nursing supply and university research income.
- Search and filter the reviewed source views (current counts are generated in `public/data/nhhr/catalogue-review.json`), select a measure, compare entities and periods, and switch between Map, Chart and Table views. The same subset drives every view and the CSV export. Source summaries and supporting rows overlap; the count is not independent people, trials or journeys. Graduate and occupation projections, historical fiscal records and observed measures retain separate definitions.
- Explore physician measures on BC Health Service Delivery Area polygons and population measures on Local Health Area polygons. Map publication, CIHR, NSERC and CAUBO research-income institutional comparators at reviewed representative campus or research-site locations, including verified McMaster context.
- Explore 54 verified physical hospital directory sites plus eight independently verified HealthLink additions, 363 original facility/fiscal-year cost records, three verified trial facilities and historical schedule references with explicit town/facility precision. Broad or unresolved descriptions remain in the source records without invented points.
- Read source definitions, measurement periods, transformations and limitations alongside the view. The Sources page includes a connection register, the implemented hospital/trial/travel releases and remaining source gaps.
- Export the filtered records as CSV and copy a link preserving the current selection.
- Review hypothetical travel scenarios separately from observed source data.

The explorer loads a bounded, reviewed selection of the collected data. The broader source catalogue contains overlapping raw tables, extracts, derived analyses and working materials; its row count is not a count of independent observations. Links identify the source dataset and table behind each reviewed view.

## Data and geography

The controlling inventory is the [NHHR Data Space manifest](https://zoer.k8s.overtheedgepaper.ca/api/projects/acdd692f-a188-4f85-bb5a-83c48d5c7e82/database/data-spaces/de1fe530-a762-52fa-ba11-d01cc5b344df/manifest), revision 93, updated October 7, 2026. The source catalogue identifies original files, their SHA-256 hashes, table lineage and source publishers. Manifest metadata is separate from the scientific rows: the preparation pipeline follows original file identifiers and checks their hashes before creating the Atlas snapshot.

Only reviewed secondary evidence is included. Interview recruitment registers, contact information, consent documents, attributable participant responses, and individual remuneration records are excluded. The supplied REB proposal and interview guide frame the questions the Atlas addresses; they are draft context and do not establish interview completion or ethics approval.

The geography snapshot comes from PGMaps' BC Ministry of Health boundary data and health-area hierarchy. An explicit crosswalk connects the NHHR/CIHI `59xx` health-region identifiers to the BC HSDA polygon identifiers. LHA population records use original three-digit LHA codes. Institution and city observations stay at their recorded grain; they are not allocated to health regions. Institution display points use an exact comparator crosswalk and verified OpenStreetMap coordinates with official campus addresses. Distributed institutions retain their institution-wide totals; a point does not assign activity to a particular campus. Missing values and unmatched identifiers must not become zeros.

Atlas maps use vector **Streets** and **Dark** basemaps, defaulting to Streets (CARTO/OpenStreetMap). Analytical overlays and reference geometry remain vector data. Changing the basemap preserves the map, camera, source joins and selected measure; both comparison maps share the selection. Provider attribution appears in each map. Basemaps require network access; an outage displays a notice while local reviewed geometry and source records remain usable. The original campus explorer retains its existing imagery options.

Compatible explorer datasets open in Map view at the latest source period. Institution circle **area** is proportional to the selected amount or count, using a common maximum across the full comparator cohort for that period. Filtering institutions keeps that scale fixed. Selecting all periods preserves the records but withholds ambiguous point values rather than summing years. Chart views can compare the full series; fiscal ranges retain their original labels.

The October 12 supplementary review adds 99 Northern Health procedure/age-group surgical-wait records and 34 BC/health-region hospital-stay cost records. Suppressed waiting-list counts remain missing, and a misparsed province-wide percentile column is excluded. Completed-surgery waits and current waiting-list counts describe different windows; hospital-stay costs are weighted-case averages, not patient bills or marginal savings. Surgical waits retain charts and records. Hospital costs now map the five territorial reporting authorities through an explicit label/code crosswalk; province and PHSA rows remain unmatched and available in charts and records.

Boundary snapshot metadata does not establish its vintage. Historical observations are displayed on contextual polygons and are not presented as a harmonized historical geography. Boundary provenance records the input repositories, hashes, simplification metadata, join method and limitation.

A source audit found that the previous population denominator added female, male and total rows, doubling the population. The Atlas population series filters the original BC Stats source to `Gender = T`. For example, Northern Health's 2025 **projection** is 298,207; the previous derived denominator was 596,414. Prince George LHA's 2025 projection is 105,544, not 211,088. Estimate/projection labels are preserved. These are LHA/health-authority populations, not Prince George municipal census counts.

CIHR paid amounts and NSERC award amounts remain distinct measures. The paid CIHR series excludes the source's incomplete FY2025 payment rows; zero placeholders in those rows are not presented as measured absence of funding. OpenAlex works cover all fields linked to the selected institutions, not only health research. Trial registration counts measure study presence, not enrollment or local research employment. Hypothetical avoided-travel values do not establish realized savings or an NHHR causal effect.

The [connection review](docs/nhhr-data-connections.md) documents the source joins, exact release counts and remaining opportunities. Nursing defaults to one profession and year; an explicit All-types choice persists on reload and withholds ambiguous map values. Publisher rates remain per 10,000 with their own denominators. Age groups reconcile to original totals and retain the 2025 projection.

The hospital release preserves 61 source directory IDs in 57 alias-collapsed rows: 54 verified sites and three unresolved descriptions. All 363 facility/fiscal-year cost records remain, including 32 numeric-null `Suppressed` values and 72 records in the latest FY2024–2025. The directory/cost union registry contains 84 physical display points. Current coordinates locate reporting context, not historical buildings: Nats’oojeh's replacement opened 14 January 2025, and its row note preserves the distinction for source periods before and across opening. Hospital costs are not summed or averaged into a new regional measure. See the [hospital provenance](public/data/nhhr/hospital-facilities-provenance.json) and [location evidence](public/data/nhhr/locations-hospitals.README.md).

The trial release maps nine original study-site relationships at three verified physical facilities. Seven BC Cancer/BCCA aliases collapse to the Prince George centre; the YMCA and Surgery Centre have one study each. One broad “13 individual First Nations” description remains unlocated. Four site/category summaries and ten supporting relationship rows describe the same historical April 29, 2026 portfolio and must not be added together. Reused C042 city-centroid coordinates and the Vancouver BC Cancer agency match are rejected. See the [trial provenance](public/data/nhhr/trial-sites-provenance.json) and [location evidence](public/data/nhhr/locations-trial-sites.README.md).

The travel release preserves 286 historical schedule events, with 280 located references: 184 coarse town references and 96 facility/address references. Six events at two unresolved labels remain unmapped. Its 58 location groups use 56 reference points, and 28 schematic segments retain recorded order across 26 legs. Arrival/departure records remain separate; no road paths, distances, journey durations, passengers or service frequency are inferred. See the [travel provenance](public/data/nhhr/travel-network-provenance.json), [location evidence](public/data/nhhr/locations-travel-stops.README.md), [stop geometry](public/data/nhhr/locations-travel-stops.geojson) and [schematic connections](public/data/nhhr/travel-route-connections.geojson).

The completed mapping-gap review recovers the full official 2011 NSERC export, adds two clearly attributed PHSA CHSA rate views on matching 2018 display boundaries, and verifies six additional civic-address parcel references for capital records. The release contains 71 explorer views / 10,382 source rows, 42 short stories and 62 chapters across nine guides. The 29 publicly listed Northern CHSAs do not provide complete Northern coverage; newer PGMaps boundary codes cannot replace changed 2018 areas. See [the completion report](docs/nhhr-mapping-gap-completion.md) and [CHSA boundary provenance](public/data/nhhr/boundaries-chsa-2018.README.md).

## Develop

Requires Node.js 22.12 or newer and npm 11.19.0. Initialize the existing toolkit and logo submodules when cloning.

```sh
npm ci
npm run toolkit:build
npm run dev
```

Vite defaults to a root base path, so local navigation can use `/dev/projects` directly. To build for a static project subpath:

```sh
ATLAS_BASE_PATH=/nhhr-atlas/ npm run build
ATLAS_BASE_PATH=/nhhr-atlas/ npm test
```

For a root deployment:

```sh
npm run build
npm test
```

The build emits direct entry pages for `dev/projects`, each of the nine guided story routes (at the root and under `dev/projects`), and `campus`, plus a `404.html` SPA fallback. Assets use the configured absolute base. GitHub Pages CI reads the configured site base path and uses it for both the build and browser checks before deploying. The configured repository currently serves `/unbc-map/`.

The browser checks cover the evidence explorer, URL state, filters and exports, live WebGL boundary rendering and source joins, responsive layouts, and the retained campus explorer. Local map geometry works without a remote basemap. Data snapshots are deliberately static: opening the application does not refresh Zoer or claim that an old source extraction is current.

## Rebuild source snapshots

The preparation scripts keep source-system reads separate from the application. They do not write to Zoer or change PGMaps.

- `scripts/prepare-nhhr-data.py` creates the bounded reviewed evidence snapshot from the NHHR inventory and verified original files. See its command help and the data provenance files for source scope and transformations.
- `scripts/prepare-nhhr-additional.py` follows manifest-listed DATA-C072/DATA-C073 originals, verifies their hashes, preserves suppression and checks source grain and percentile consistency. Run `python3 scripts/prepare-nhhr-additional.py --refresh --input /private/nhhr-additional --check` to verify the supplementary release.
- `scripts/prepare-nhhr-population-ages.py`, `prepare-nhhr-research-income.py` and `prepare-nhhr-nursing.py` reproduce the three new bounded datasets. Each supports `--input /private/nhhr-originals --check` and manifest-linked `--refresh`; each verifies original hashes and keeps a byte-identical source/public mirror.
- [prepare-nhhr-hospitals.py](scripts/prepare-nhhr-hospitals.py), [prepare-nhhr-trial-sites.py](scripts/prepare-nhhr-trial-sites.py) and [prepare-nhhr-travel-network.py](scripts/prepare-nhhr-travel-network.py) reproduce the verified facility and schedule releases. Each supports `--input /private/nhhr-originals --check` and authorized manifest-linked `--refresh`; original source and reviewed location hashes are checked. Geographic identity, unlocated rows, suppression and source-grain limits remain explicit.
- `scripts/prepare-nhhr-boundaries.mjs` reads the sibling PGMaps checkout. Override its source location with `PGMAPS_ROOT=/absolute/path/to/PGMaps`.
- [public/data/nhhr/](public/data/nhhr/README.md) contains eighteen evidence snapshot families: 71 explorer views / 10,382 source rows at overlapping grains, including two clearly attributed PHSA supplements. Each snapshot has a byte-identical source-module mirror, alongside geometry, crosswalks and provenance.
- `src/atlas/types.ts` defines the common dataset and story contracts.
- `src/atlas/Atlas.tsx` and `atlas.css` own the Atlas interface.
- `src/atlas/AtlasMap.tsx` and `geography.ts` own maps and explicit geographic joins.
- `src/atlas/storyMaps.ts` defines guided chapters and computes takeaways from the reviewed rows; `AtlasStoryMap.tsx` composes the PGMaps story components, source visualizations and scenario reader.
- `src/atlas/AtlasMapComparison.tsx` owns the synchronized two-map reveal; `useStoryChapterUrl.ts` handles bounded-reader chapter restoration.
- `src/App.tsx`, `data.ts` and `chrome.tsx` retain the original campus interface.

A refresh can change data, coverage and conclusions. Inspect source periods and warnings, verify joins and exported values, rebuild, and run the relevant browser checks before distributing an updated snapshot.

Read-only checks for the three facility/schedule releases:

```sh
python3 scripts/prepare-nhhr-hospitals.py --input /private/nhhr-originals --check
python3 scripts/prepare-nhhr-trial-sites.py --input /private/nhhr-originals --check
python3 scripts/prepare-nhhr-travel-network.py --input /private/nhhr-originals --check
```

## Sources and licences

The individual dataset entries name the original publishers and their source metadata. Original publisher licences and attribution requirements continue to apply. BC Ministry of Health polygons are attributed to the Province of British Columbia under the [Open Government Licence – British Columbia](https://www2.gov.bc.ca/gov/content/data/open-data/open-government-licence-bc).

The institutional location registry and campus geometry derive from OpenStreetMap and remain under the ODbL; campus coordinates represent approximate building centres. The campus view retains CARTO/OpenStreetMap and Esri imagery attribution. BC Sans uses the SIL Open Font License included in `licenses/BC-Sans-OFL.txt`.

The application retains GPL v2 or later for the supplied UNBC Chrome components; the GeoToolkit retains its MIT licence. UNBC artwork, marks and commercial brand fonts retain their owners' rights. The Atlas is not an official UNBC website or a clinical service directory.

## Trial condition mix and paired age maps

The [condition release](public/data/nhhr/clinical-condition-mix.json) preserves 77 original city/domain rows across seven cities and thirteen exact NHHR coded condition labels. It is a ragged table: omitted combinations are not additional zero observations. All city study totals and historical RECRUITING totals reconcile to the existing comparator baseline. Shares retain the full source city denominator when categories are filtered. The separate recruiting composition share uses the full city RECRUITING denominator; it is not a within-condition recruiting rate. Repeated city totals are metadata and are not selectable measures. The aggregate CSV has no separate timestamp field: 29 April 2026 labels its alignment with the reviewed comparator baseline. [Provenance](public/data/nhhr/clinical-condition-mix-provenance.json) and [review notes](public/data/nhhr/clinical-condition-mix.README.md) retain original source IDs, hashes, classification and reconciliation.

The paired age view uses the existing 102 Northern LHA/year age rows. Each map has its own scale: `share_65_plus` in percent and `population_65_plus` in people. Camera, basemap and area selection are linked. Explorer links preserve `display=paired`, the source year and geographic filters; tables and CSV retain the same rows. Multiple periods remain available as records while ambiguous per-LHA values are withheld. The 2025 values remain projections.

No new service connection or boundary file is required for these views. Original three-digit LHA codes join the reviewed PGMaps LHA polygons; the 17 Northern codes and contextual geometry are checked. Trial city/domain rows join the existing seven reviewed city points through exact `query_city` labels. These city points are not facility locations or health-area polygons. Mapping trial condition counts to facilities outside the reviewed Prince George portfolio requires original NCT/site records plus verified facility addresses; allocating them to LHAs requires explicit compatible source geography. Boundary geometry alone supplies neither.

## Comparator trial facilities and PGMaps data review

The [facility-condition release](public/data/nhhr/trial-facility-conditions.json) follows the actual Zoer C037 original table of 15,028 city/NCT records. Its 171 observed facility/condition summaries and seven coverage records retain the NHHR coding and aligned April 2026 cohort. Twenty-five independently reviewed physical reference points include 22 beyond Prince George. The [safe study-site CSV](public/data/nhhr/trial-facility-study-sites.csv) contains 4,401 distinct city/NCT/physical-site relationships; those overlap and are not extra loaded explorer rows or independent people. Generic, broad, missing and unverified site labels remain unassigned. The [provenance](public/data/nhhr/trial-facility-conditions-provenance.json) reconciles all seven city totals and 77 condition summaries to the source, and distinguishes partial named-site coverage from original site-count/list discrepancies.

`/dev/projects/research-pathways#trial-conditions-at-facilities` and `#trial-facility-mapping-gaps` connect the condition map to the source coverage. Explorer filters, fixed facility-share denominators, table/CSV and links retain one subset. All-condition map values are withheld when multiple rows remain at a site. [PGMaps data review](docs/pgmaps-data-audit.md) classifies direct reuse, candidate evidence, unused data and missing source/adapter/rights checks; the saved review remains separate from the NHHR source catalogue. Sources & methods lists NHHR collections from the authorized Zoer manifest, with search, explorer-connection filters and links to reviewed data. Two CHSA publisher supplements appear in a separate attributed section. Source folders in PGMaps remain read only, and the existing UNBC chrome and design are preserved.


## Full NHHR catalogue connection review

The [complete review](docs/nhhr-catalogue-review.md) covers all **85 public NHHR Zoer dataset entries**, matched by exact dataset UUID. C058 has seven distinct dataset UUIDs under one source-family label; those entries are not collapsed by the family name. The authorized manifest remains revision 93. Original scientific files and table lineage were inspected by source family; the manifest does not embed those measurements.

The Atlas now contains **71 explorer views / 10,382 loaded source rows**, with **69 primary views from 46 Zoer collections and two separately attributed PHSA supplements**, **42 short stories and 62 chapters across nine guided routes**. These are bounded selections at overlapping grains, not distinct people, grants, publications or studies. The UNBC design and logo remain intact; Atlas basemaps remain vector-only.

New guided routes are `/dev/projects/community-context`, `/dev/projects/research-resources` and `/dev/projects/workforce-context`. They connect municipal and Census housing context, workforce/source definitions and separate research-resource measures. Maps, charts, source records, CSV downloads and shared URLs keep the same subset. Month and quarter charts retain original labels and missing periods; defaults on an entity field are visible in the entity selector rather than hidden filters.

Four additional release families add 31 views: [public sources](public/data/nhhr/public-expansion.json) (2 views / 580 rows), [research](public/data/nhhr/research-expansion.json) (6 / 289), [regional](public/data/nhhr/regional-expansion.json) (18 / 755), and [service/workforce](public/data/nhhr/service-expansion.json) (5 / 333). Each has a public provenance file and a byte-identical source-module mirror. Exact native 2021 CD/CSD/ER polygons come from PGMaps, which was read only. Municipal estimate periods remain explicitly contextual rather than boundary-harmonized.

Sources shows the 85 NHHR Zoer catalogue entries and a separate section for two attributed CHSA supplements, with connection-review filters, interpretation limits, verification receipts and boundary proposals. Supporting inventories, duplicate delivery copies, sensitive records and unresolved sources are distinguished from newly loaded observations. C054 Q3 expected-payment cells are all blank; awarded and total-paid fields have different definitions and are not substituted. The incorrectly identified Northern Norway OpenAlex institution is excluded from BC output. Protected people/case material is not released.

Rebuild the new source releases from authorized retained originals with `prepare-nhhr-public-expansion.py`, `prepare-nhhr-research-expansion.py`, `prepare-nhhr-regional-expansion.py` and `prepare-nhhr-service-expansion.py`. Each supports `--input DIR --refresh --check`. After the four family reviews are complete, `python3 scripts/prepare-nhhr-catalogue-review.py --check` verifies the complete catalogue coverage, dataset identities and release mirrors. The merge preserves selected-measure validation scope; it does not claim every unreleased table has been scientifically validated.

The [mapping follow-up](docs/nhhr-mapping-connections.md) documents verified historical cancer boundaries, the combined LFS reporting area and McMaster’s campus reference, with reproducible geometry preparation and source receipts.
