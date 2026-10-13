# NHHR Atlas reviewed data snapshot

Core data reviewed on **11 October 2026**, with supplementary evidence and locations reviewed on **12 October 2026**. The application combines **71 explorer views, 10,382 bounded source rows, and 42 short evidence stories**, alongside **62 chapters across nine guided story maps**. The eighteen snapshots have overlapping grains: supporting observations and their summaries are not independent people, trials or journeys. Source periods are retained; the review date does not make registries, schedules or benchmarks current.

| Reviewed snapshot | Explorer views | Source rows |
| --- | ---: | ---: |
| `atlas-snapshot.json` | 12 | 294 |
| `additional-evidence.json` | 2 | 133 |
| `population-ages.json` | 1 | 102 |
| `research-income.json` | 1 | 28 |
| `nursing-workforce.json` | 1 | 120 |
| `trial-sites.json` | 2 | 14 |
| `hospital-facilities.json` | 2 | 420 |
| `travel-network.json` | 2 | 344 |
| `clinical-condition-mix.json` | 1 | 77 |
| `trial-facility-conditions.json` | 2 | 178 |
| `public-expansion.json` | 2 | 580 |
| `research-expansion.json` | 6 | 289 |
| `regional-expansion.json` | 18 | 755 |
| `service-expansion.json` | 5 | 333 |
| `research-followup.json` | 4 | 205 |
| `community-followup.json` | 5 | 1,951 |
| `facility-followup.json` | 3 | 100 |
| `chsa-connections.json` | 2 | 4,459 |
| Total | 71 | 10,382 |

Six short stories are retained in the core snapshot and 36 more are authored in the Atlas modules; nine guided routes contain 62 chapters. Atlas maps use vector Streets and Dark basemaps, defaulting to Streets. The original campus map retains its existing imagery options.

The authoritative NHHR Data Space manifest lists **86 datasets, 3,382 tables, and 46,415,914 table rows** at revision 93, updated 7 October 2026. These are **inventory counts with overlapping raw/derived data and cached workbook grids**, not unique scientific observations and not the number of records loaded by this atlas.

## Files

- `atlas-snapshot.json`: reviewed explorer datasets, column units, row values, stories, and release scope.
- `source-inventory.json`: collection metadata only. Participant/consent collection details are omitted. The strategic work package appears as restricted; only its separately reviewed public physician aggregate is released.
- `source-provenance.json`: selected source collection IDs, actual dataset/table IDs, original-file IDs, original SHA256 hashes, relative catalogue paths, and source row counts. No credentials or absolute workstation paths are included.
- `additional-evidence.json`: reviewed surgical-wait and hospital-stay cost tables, mirrored in `src/atlas/snapshots/`.
- `additional-evidence-provenance.json`: manifest-listed dataset/table IDs, original file IDs, SHA256 hashes, units, source-grain and suppression decisions from the supplementary review.
- `population-ages.json`, `research-income.json`, `nursing-workforce.json`: three additional hash-verified source selections with corresponding `*-provenance.json` files and byte-identical source-module mirrors.
- [hospital-facilities.json](hospital-facilities.json): alias-collapsed directory entries and original facility/fiscal-year CIHI cost records. [Provenance](hospital-facilities-provenance.json) and [hospital location evidence](locations-hospitals.README.md) document original IDs/hashes, 84 union display points, suppression, unmatched labels and historical-site limits.
- [trial-sites.json](trial-sites.json): four site/category summaries and ten original study-site evidence rows, describing the same historical whitelist. [Provenance](trial-sites-provenance.json) and [trial location evidence](locations-trial-sites.README.md) document three verified points, alias collapse, rejected city centroids and the retained unlocated regional record.
- [travel-network.json](travel-network.json): 286 original schedule-event rows and 58 reviewed location-group rows. [Provenance](travel-network-provenance.json), [travel location evidence](locations-travel-stops.README.md), [stop points](locations-travel-stops.geojson) and [schematic connections](travel-route-connections.geojson) retain event order, precision, unresolved labels and original CSV/SQLite reconciliation.
- `locations-clinical-cities.geojson` and its README: seven exact source city labels with verified representative place points.
- `crosswalk-health-authority.json` and its README: five exact CIHI reporting labels joined to territorial HA codes; province and PHSA intentionally unmatched.
- [connections-review.md](connections-review.md) and [connections-review.json](connections-review.json): implemented connections, actual source IDs/hashes, release counts and remaining source opportunities.
- `locations-institutions.geojson` and `locations-institutions.README.md`: eight verified representative campus/site points, official address and OpenStreetMap links, distributed-campus caveats and ODbL attribution. `src/atlas/institutionLocations.json` supplies the exact comparator crosswalk.
- Boundary and geographic crosswalk files are prepared independently from PGMaps. Source data and polygon vintages are distinct concepts.

## What is loaded

| Explorer dataset | Source | Scope / interpretation |
| --- | --- | --- |
| Publications | DATA-C030 | Eight institutional comparators, 2021–2025; all research fields; overlapping affiliations |
| CIHR annual payments | DATA-C025 | FY 2019–2024; payment flow, not lifetime commitments; incomplete all-zero FY2025 omitted |
| NSERC awards | DATA-C029 | FY 2019–2024; source award measure, broad sciences/engineering scope |
| Exact-city clinical trials | DATA-C019 | Seven comparator cities; recorded sites, not enrollments or catchments |
| Prince George study portfolio | DATA-C019 | Ten public registry records; identifiers/facilities retained; no personal contacts |
| HSDA physician supply | DATA-C037 | Sixteen public regional aggregates; source 2020/2024 counts and 2024 rates |
| Northern LHA population | DATA-C051 | Seventeen areas × six years; exactly one raw Gender=T row per area/year |
| NH Connections route patterns | DATA-C069 | Aggregated route/service-day patterns from 286 June 2026 stop events |
| Travel benchmarks | DATA-C069 | Five mixed-unit assumptions; fare citation still requires verification |
| Avoided-travel scenarios | DATA-C032 | Three hypothetical planning cases; no observed NHHR benefit |
| Validation evidence requests | DATA-C019 | Thirteen institution-level requests; no supplied or completed interview findings |
| Denominator audit | DATA-C024 + DATA-C051 | Original doubled figures alongside verified total rows, for review |
| Northern surgical waits | DATA-C072 | 99 procedure/age-group records; waiting-list counts at April 30, 2026, with completed-surgery percentiles for February–April 2026; suppression retained |
| Standard hospital-stay costs | DATA-C073 | 34 province/health-region records across FY 2020–2021 to 2024–2025; five territorial HA map joins; province and PHSA unmatched; nominal CAD per weighted case |
| Northern LHA age structure | DATA-C051 | 17 areas × 6 years; ages 0–19/20–64/65+ reconcile to raw Gender=T total; 2025 projection |
| University research income | DATA-C052 | Seven exact institutional comparators × four fiscal years; CAUBO sponsored-research subtotal, converted from thousands CAD |
| Northern nursing workforce | DATA-C040 | 3 HSDAs × 4 nursing types × 10 years; exact source count/rate joins; published rates per 10,000 |
| Verified hospital directory | DATA-C072 | 57 alias-collapsed entries retaining 61 source IDs; 54 verified physical directory sites and three unlocated descriptions; presence is not clinical capacity |
| Facility hospital-stay costs | DATA-C073 | 363 original entity/fiscal-year rows, 32 `Suppressed` numeric nulls, 72 latest FY2024–2025 rows; current display points provide reporting context, not historical building locations |
| Verified Prince George trial sites | DATA-C010 + DATA-C019 + DATA-C042 review | Four site/category summaries; nine study-site pairs at three physical sites and one unlocated regional record; April 29, 2026 overall study status |
| Prince George study-site evidence | DATA-C010 + DATA-C019 | Ten deduplicated original NCT/site relationships behind the summary, with historical statuses, aliases and registry links; not a second trial total |
| NH Connections stop events | DATA-C069 | 286 recorded events, 280 located references (184 town / 96 facility), six unresolved; event order supports 28 schematic segments across 26 legs |
| NH Connections reviewed locations | DATA-C069 | 58 source location groups, 56 reviewed reference points; preserve original 286 event counts and distinguish coarse towns from facility references |

## Findings that affect interpretation

1. **Population summaries duplicate sex totals.** DATA-C024 adds Female + Male + Total. Northern's recorded 596,414 is exactly twice the raw 2025 `Gender=T` value of 298,207. DATA-C031 has the same problem: Prince George LHA 211,088 versus the raw total 105,544. The LHA explorer derives one `Gender=T` total directly from the original DATA-C051 rows. The source `Type` is retained; 2025 is a projection. Historical suspect figures are preserved in the audit rather than used for rates or polygon shading.
2. **Funding measures differ.** CIHR `amount_paid_fy` and NSERC award amounts are not a common economic-impact measure. Lifetime CIHR commitments are omitted from the annual series. Source FY2025 zero payments occur alongside funded-project records and are excluded because payment completeness is not established.
3. **City-site trials are not regional access measures.** A multi-site study can appear in several cities. Public status fields are a historical registry snapshot; current trial details belong in the linked registry.
4. **Scenarios are assumptions.** Travel and patient-time outputs depend on assumed reach, avoided trips, unit cost, and hours. The doubled population field in DATA-C032 is omitted. No causal, ROI, or realized-benefit claim is made.
5. **Interviews remain an evidence gap in this release.** Guides, consent templates, recruitment scripts, and blank analysis workbooks are preparation materials. Contact lists, candidates, consent/participant records, and internal remuneration are not published.

6. **Institution locations are representative.** Circles show whole-institution measures at reviewed campus/site points. Circle area uses the full cohort for the selected period; entity filters do not enlarge dots. Records from multiple periods are not summed or allocated to surrounding populations.
7. **Waiting-list counts and completed-surgery waits differ.** Suppressed `Less than 5` counts remain null with their original text. Missing percentiles remain missing. A separate province-wide summary column was rejected after failing consistency checks; only the reviewed health-authority percentiles are released.
8. **Hospital costs are not bills or marginal savings.** Expense divided by weighted inpatient cases is a nominal average. Province and health-region rows overlap, PHSA lacks the earliest fiscal period, and no missing row becomes zero.
9. **Physical-site verification retains source limits.** The hospital directory's three unresolved descriptions remain unlocated; its 54 points and the facility-cost sites form an 84-point union. Current points do not geolocate past values at current buildings. Nats’oojeh's replacement opened 14 January 2025, while the source applies its reporting label before and across that opening; the location note explains the difference. Trial BC Cancer/BCCA aliases collapse to one Prince George centre, while the Vancouver agency record and repeated C042 city-centroid points are rejected. The broad 13 First Nations description keeps its original NCT link and no point.
10. **Schedules are events with mixed location precision.** Town representatives are not exact boarding addresses. Source service-day strings and stop times remain text, sequence resets preserve legs, and arrival/departure records remain separate. Schematic lines split at unresolved events and never imply road paths, journey durations, passengers, service frequency or realized NHHR benefits. Event summaries and their supporting records overlap.

## Refresh and validation

Run from the repository root with Python 3; no additional packages are required:

```sh
python3 scripts/prepare-nhhr-data.py --input /private/reviewed-original-csvs
python3 scripts/prepare-nhhr-data.py --input /private/reviewed-original-csvs --check
```

Input CSVs are arranged by collection: for example `DATA-C030/monetization_openalex_works_by_comparator_year.csv`. The script uses `scripts/nhhr-source-lock.json` to verify each original SHA256 before selecting explicitly allowlisted columns. It refuses changed hashes, non-finite numeric values, duplicate LHA/year totals, unexpected population-audit findings, and datasets larger than 1,000 released rows.

For a manifest-linked refresh using the user's authorized Zoer access:

```sh
python3 scripts/prepare-nhhr-data.py --refresh --input /private/nhhr-refresh
```

The script first follows the manifest and confirms every reviewed dataset ID remains listed, then downloads **original files** using the catalogue `originalFileId`, and verifies their hashes. It never assumes scientific records live inside the manifest. If the server needs authorized request headers, pass `--headers-file /private/headers.json`; that file is never copied into the public release. Fresh hashes require source review and a deliberate lock update.

Optional metadata regeneration from saved authorized catalogue inputs:

```sh
python3 scripts/prepare-nhhr-data.py --input /private/reviewed-original-csvs \
  --manifest /private/NHHR.manifest.json --catalogue /private/NHHR_collections.csv --check
```

The preparation script also writes byte-identical module mirrors of `atlas-snapshot.json` and `source-inventory.json` under `src/atlas/snapshots/`; `--check` verifies both mirrors against the public evidence files. Vite imports these source modules in development and production. The browser does not fetch protected source tables or secrets. Existing source classifications and licence/citation obligations still apply when extending the release.

To verify or refresh the supplementary evidence using its four hash-locked originals:

```sh
python3 scripts/prepare-nhhr-additional.py --input /private/nhhr-additional --check
python3 scripts/prepare-nhhr-additional.py --refresh --input /private/nhhr-additional --check
```

The supplementary pipeline follows the same manifest-to-original-file process. It validates one latest-run procedure/age-group record, completed-case windows, p50/p90 ordering, suppressed-count literals, fiscal-period labels and both snapshot mirrors. The browser loads the reviewed static release; it does not treat a live Zoer connection as a new extraction date.

The [connection review](connections-review.md) records implemented source joins and the remaining identity/boarding-address opportunities. To reproduce age, income and nursing evidence, use the corresponding `scripts/prepare-nhhr-population-ages.py`, `scripts/prepare-nhhr-research-income.py` or `scripts/prepare-nhhr-nursing.py` with `--input /private/nhhr-originals --check`; add `--refresh` to follow the authorized manifest and original-file IDs. Selecting All nursing types preserves multiple records per region rather than summing rates or inventing a map value.

Verify the hospital, trial-site and travel releases with their [hospital](../../../scripts/prepare-nhhr-hospitals.py), [trial-site](../../../scripts/prepare-nhhr-trial-sites.py) and [travel](../../../scripts/prepare-nhhr-travel-network.py) preparation scripts:

```sh
python3 scripts/prepare-nhhr-hospitals.py --input /private/nhhr-originals --check
python3 scripts/prepare-nhhr-trial-sites.py --input /private/nhhr-originals --check
python3 scripts/prepare-nhhr-travel-network.py --input /private/nhhr-originals --check
```

Each verifies original hashes and reviewed location evidence, preserves the release grain and checks byte-identical source/public mirrors. Add `--refresh` for authorized manifest-linked original-file reads. The travel script independently reconciles all 286 CSV rows to the original read-only SQLite table. Source and location changes require renewed review; no live source-system write occurs.

## Trial condition mix and paired age maps

The [condition release](clinical-condition-mix.json) preserves 77 original city/domain rows across seven cities and thirteen exact NHHR coded condition labels. It is a ragged table: omitted combinations are not additional zero observations. All city study totals and historical RECRUITING totals reconcile to the existing comparator baseline. Shares retain the full source city denominator when categories are filtered. The separate recruiting composition share uses the full city RECRUITING denominator; it is not a within-condition recruiting rate. Repeated city totals are metadata and are not selectable measures. The aggregate CSV has no separate timestamp field: 29 April 2026 labels its alignment with the reviewed comparator baseline. [Provenance](clinical-condition-mix-provenance.json) and [review notes](clinical-condition-mix.README.md) retain original source IDs, hashes, classification and reconciliation.

The paired age view uses the existing 102 Northern LHA/year age rows. Each map has its own scale: `share_65_plus` in percent and `population_65_plus` in people. Camera, basemap and area selection are linked. Explorer links preserve `display=paired`, the source year and geographic filters; tables and CSV retain the same rows. Multiple periods remain available as records while ambiguous per-LHA values are withheld. The 2025 values remain projections.

No new service connection or boundary file is required for these views. Original three-digit LHA codes join the reviewed PGMaps LHA polygons; the 17 Northern codes and contextual geometry are checked. Trial city/domain rows join the existing seven reviewed city points through exact `query_city` labels. These city points are not facility locations or health-area polygons. Mapping trial condition counts to facilities outside the reviewed Prince George portfolio requires original NCT/site records plus verified facility addresses; allocating them to LHAs requires explicit compatible source geography. Boundary geometry alone supplies neither.

## Trial conditions at comparator facilities

The [facility-condition release](trial-facility-conditions.json) contains 171 observed facility/domain records and seven city coverage records derived from 15,028 unique original city/NCT records. The 25 reviewed points include 22 sites outside Prince George. The [study-site CSV](trial-facility-study-sites.csv) contains 4,401 deduplicated city/NCT/physical-site relationships; it is supporting evidence and must not be counted as an additional independent cohort. Of the original city/NCT records, 4,208 have at least one reviewed site and 10,820 have none; 200 are partly located with a nonempty unresolved recorded alias. These measures describe finite alias-review coverage, not the number of all facilities in a city.

Source totals and condition counts reconcile to the existing seven-city/77-row summaries. Site aliases are reviewed with operator addresses, named OpenStreetMap objects and PGMaps candidate records; Children’s/Women’s, UBC/VGH and former Tom Baker/Arthur Child identities remain distinct. Source-count/list disagreements are retained separately and do not manufacture additional facilities. The share denominator remains each facility’s full reviewed portfolio. A study may appear at multiple cities/sites, and historical overall statuses do not establish local recruitment or study-visit locations at every date.

No additional source access or boundary file was needed for this bounded release. Extending the unlocated records needs an unambiguous physical facility identity/address (and historical concordance where relevant), rather than a city centroid or an allocation from city totals. See [location and source provenance](trial-facility-conditions-provenance.json) and the [PGMaps use/mapping-gap review](pgmaps-data-audit.md).


## Catalogue review and new source releases

[`catalogue-review.md`](catalogue-review.md) records decisions for every public NHHR Zoer dataset UUID. [`catalogue-review.json`](catalogue-review.json) is the safe product summary; [`catalogue-review-evidence.json`](catalogue-review-evidence.json) preserves endpoint and original-file/table verification, with protected source packages redacted. Catalogue inventories and copies are not counted as additional scientific observations.

The four expansion snapshots have paired `*-provenance.json` files. Regional maps use `boundaries-cd.geojson`, `boundaries-csd.geojson` and `boundaries-er.geojson` with exact 2021 native IDs; see [`regional-boundaries-provenance.json`](regional-boundaries-provenance.json). Municipal estimate polygons are contextual. Combined survey regions, archived 2015 health regions and unreviewed institution points remain unallocated.

C054 Q3 expected-payment fields are empty and no financial value is substituted. The Northern Norway OpenAlex candidate is excluded from BC records. Private participant/interview/case/remuneration data is not included in these releases.

## Reviewed mapping follow-up

Historical cancer now joins three official December 2015 health-region polygons. Current annual/monthly LFS views use a verified combined North Coast–Nechako region, without splitting its source value. McMaster uses a verified representative main-campus point. Scientific totals and original identifiers are preserved. See [mapping verification receipts](mapping-connections-provenance.json) and [the mapping preparation script](../../../scripts/prepare-nhhr-mapping-connections.py).

## Catalogue follow-up · 12 October 2026

The three Zoer follow-up release families contain twelve explorer views and 2,256 bounded rows after recovery. The separate PHSA supplement adds two CHSA views / 4,459 rows. Four research views connect NSERC 1991–2000 and 2001–2018 originals, university publisher intensity and health-organization research spending. Five community views connect two BC supply-model projections, Northern HA incidence/lifetime prevalence and verified Fall 2025 institution enrolment. Three facility views connect HealthLink additions, 64 printed capital records and their reviewed site context.

The collected 2011 NSERC original is truncated. A complete official publisher export was independently recovered and verified as its exact continuation, restoring seven institutional source groups with explicit publisher origins and the failed-capture audit. Northern HA rates use only source HA ID 5 and contemporary PGMaps context; that collected source has no CHSA measurements. Two separately attributed PHSA CDR2022 views add 4,459 historical CHSA source rows (4,453 reported rates plus six explicit null source cells), matched to archived 2018 display boundaries. The 29 public measured areas do not provide complete Northern coverage; current PGMaps boundaries cannot replace changed 2018 areas. Provincial projections cannot be allocated to campuses or health areas. Current site points do not locate historical equipment or replacement buildings. Charity financial units, campus/city enrolment ratios and fee/utilization references retain their review gaps.

Preparation: `prepare-nhhr-research-followup.py`, `prepare-nhhr-community-followup.py`, and `prepare-nhhr-facility-followup.py` follow manifest, dataset and actual original-file IDs and lock hashes/table lineage. Each supports private `--input` caches, authorized `--refresh` and deterministic `--check`. The catalogue merger incorporates the bounded follow-ups while retaining unresolved sibling-source limits. Public originals, protected personal records and private input caches are not included.

## Mapping-gap completion and size

Six new verified civic-address parcel references locate eight additional capital records, covering 60 of 64 original rows and 23 of 27 site/period groups. Historical Mills equipment retains its original-address parcel label, separate from its unlocated replacement project. [Remaining location review](facility-location-gap-review.json) records eleven source-specific decisions.

[CHSA data and provenance](chsa-connections-provenance.json), [boundary notes](boundaries-chsa-2018.README.md) and [the reproducible CHSA generator](../../../scripts/prepare-nhhr-chsa-connections.py) retain native identifiers, fiscal periods, 2011 Canadian Census standardization, nulls, source precision and the display-mirror licence scope. The official historical geometry ZIP was unavailable (HTTP 404), so no fresh direct official ZIP verification is claimed.

Measure current extracts, geometry and production assets with `python3 scripts/measure-atlas-payload.py --output docs/nhhr-payload-size.json`. This excludes private/raw caches. Maps fetch geometry on demand; compressed byte estimates depend on hosting configuration.
