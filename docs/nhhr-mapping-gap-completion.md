# NHHR mapping-gap completion · 12 October 2026

The Atlas now contains **71 explorer views / 10,382 source rows**, **42 short stories**, and **62 chapters across nine guided routes**. Of the views, 69 retain primary lineage to 46 Zoer collections; two use separately attributed PHSA publisher measurements. All 85 public Zoer catalogue entries retain a review. Rows overlap across summaries and source records and are not distinct people, grants or studies. The UNBC design and NHHR subtitle are retained. PGMaps remained read only; Atlas basemaps remain vector Streets/Dark.

## Connected in this review

| Gap | Implemented connection | Coverage and limits |
|---|---|---|
| 2011 NSERC | Recovered the [complete official annual CSV](https://www.nserc-crsng.gc.ca/opendata/nserc_grt_fyr2011_award.csv); the original collected file is an exact truncated prefix. Direct and ranged downloads reconcile to the same SHA-256. | 23,265 complete original funding rows; seven selected institutional groups / 4,307 funding records added to the explorer. UNBC has 63 records and nominal CAD 1,615,488. C055 keeps its collected lineage, with explicit publisher-recovery origins. The 2001–2018 view now has 126 institutional/fiscal groups and 18 fiscal codes. Funding allocations and instalments are retained; amounts are not annual paid cash, health-only funding or inflation-adjusted changes. |
| CHSA measurements | Retrieved actual [PHSA / BCCDC public registry downloads](https://communityhealth.phsa.ca/GetTheData/SearchByLocation) using stable source key CDR2022. The original C016 CSV still has no CHSA scientific rows. | 29 publicly listed Northern CHSAs, four conditions, Total only, 20 fiscal periods ending in 2020–2021. Two views contain 4,453 reported rates plus six explicit latest source dashes retained as null. Other historical omissions remain absent. All measures use the 2011 Canadian Census standard population; age universes differ by condition. No case counts, population allocations, trial eligibility or NHHR effects are inferred. |
| CHSA boundaries | Source identifiers and names join 40 archived Northern 2018 display polygons from the Community Map of Canada mirror, attributed to BC Ministry of Health April 2019. The historical official ZIP returned 404; that limitation is explicit. | 29 measured public areas plus eleven unreleased context polygons. Combined 5246 McBride/Valemount remains unsplit; current PGMaps geography cannot substitute for it. Shared-topology 50 m display simplification preserves valid polygons and shared edges. The mirror is licensed for mapping/visualization only; no downstream spatial analysis or area-weighted allocation is performed. Unreleased communities are not zero and this subset does not supply a complete Northern total. |
| Facility references | Six official civic-address parcels: Gateway, Houston, Rotary Manor, Tumbler Ridge, original-period Stikine address, and original-address Mills Memorial. Operator identity plus BC Address Geocoder CIVIC_NUMBER matches, score 99–100 and public site IDs are retained. | Eight additional original capital rows have context points, bringing coverage to 60 of 64 rows and 23 of 27 facility/period groups. The original printed monetary values remain unchanged. These points are labelled parcel references, not hospital building centroids or historical equipment positions. Replacement and leasehold targets remain unlocated. |

## Stories and explorer

Two new short stories are `community-incidence-map` and `community-prevalence-map`. The `education-and-health` guide adds `community-incidence`, `community-prevalence`, and `prince-george-communities`. These map native historical observations, explain the different rate definitions and keep public-coverage limits visible.

The paired explorer views preserve selected community, condition and fiscal period when switching incidence/prevalence. Maps require one source observation per place; selecting multiple periods or conditions withholds ambiguous values while retaining records and CSV. Explicit nulls and spreadsheet-safe source dash literals survive export. Source notes retain original case definitions once per indicator, rather than repeating long prose in every row. The phone reader uses a concise attributed caption with full boundary provenance available in the explorer.

The recovered 2011 year is available in maps, records, origin filters and contiguous fiscal trends. Existing funding, enrolment, workforce, facility and campus views retain their original source grain. The Sources page keeps the 85 collected Zoer entries separate from the two publisher supplements; related C016 links do not inflate the collection count.

## Remaining location decisions

All eleven decisions were reviewed. Each remains unlocated or deliberately without a unique point, rather than using an unsupported coordinate. [The full location review](../public/data/nhhr/facility-location-gap-review.json) includes source keys, periods, evidence URLs and exact reasons.

| Source description | Decision | Evidence needed or constraint |
|---|---|---|
| Dr. Al Hogg Pavilion | Unlocated | Shared 15521 Russell Avenue campus address does not verify the named North Bluff Road building. Returned OSM way 673740191 is about 180 metres from the source directory point. Municipal search metadata describes Al Hogg Pavilion on North Bluff Road, but its full plan and operator map images could not be retrieved (HTTP 403); no precise building join is accepted. The shared campus-address coordinate is not substituted for the named building. |
| Dawson Creek and District Hospital: Hospital Replacement | Unlocated project target | Operator documents identify a greenfield replacement beside Northern Lights College, distinct from the operating 11100 13th Street hospital. Neither an old hospital point nor a BLOCK-only guessed address is adopted; an exact project-site geometry or published coordinate is still needed. |
| Mills Memorial Hospital: Hospital Replacement | Unlocated project target | The original replacement project includes the hospital, Seven Sisters and site demolition/redevelopment. A present Ksyen hospital point or former-address parcel cannot represent the complete planned construction target. Exact bounded project-site geometry is still needed. |
| Stuart Lake Hospital: Hospital Replacement | Unlocated project target | Official project and relocation records distinguish former 600 Stuart Drive East from new 606, and the project includes old-building demolition and site redevelopment. The current named OSM hospital geometry is campus-wide, not a verified historical construction-target footprint. No old/current building substitution is made. |
| Quesnel Substance Abuse Club: Leasehold Improvement | Unlocated leasehold | Original and subsequent operator project tables confirm the project label but no physical leased-site address. An organization or community name is insufficient. |
| Greater Victoria Hospitals | Aggregate; no point | The source names a hospital group. Individual constituent allocations are not established. |
| Surgery Centre | Identity unresolved | Generic source label is insufficient to adopt the independently verified Prince George Surgery Centre trial location. |
| B.C. Cancer Agency | Organization; no unique point | The provincial agency label does not identify one cancer centre and cannot inherit the Prince George trial centre. |
| 13 individual First Nations in north-Central BC near Prince George, BC | Unnamed regional description | No individual First Nation facility identities or consent/governance context are established. The city tag cannot become a point or inferred community allocation. |
| Mackenzie Junction | Pickup location unresolved | A road junction is established, but the original schedule lacks a verified boarding-side/pickup point. Current reseller listings use 400 Skeena Drive in town, which conflicts with the original junction grain; that coordinate is not adopted. |
| Small River (Rest Area) | Pickup location unresolved | The operator schedule establishes the stop name, not a precise rest-area boarding point. No arbitrary locality, unrelated River Jordan result or assumed road-side location is adopted. |

## Verification

Source preparation checks reproduce the research, facility, location-gap and CHSA public/module releases from reviewed private caches. Agents completed fresh publisher/Zoer source checks; PHSA metadata checks exclude transient request GUIDs while scientific CSV receipts remain hash locked. The catalogue merger verifies all UUIDs, source partitions, row/view counts and byte-identical release mirrors.

The live development maps were checked on desktop and phone without basemap fixtures: CHSA incidence (29 source joins), the Prince George story (three), 2011 NSERC (seven), and 2020–2022 capital context (thirteen singleton groups). All eight checks rendered real vector basemap features, zero raster sources, no page errors and no horizontal overflow. [Live results](nhhr-gap-live-check.json) preserve the diagnostics. The phone caption adjustment retains a visible map in its media frame.

Production build passed with the `/nhhr-atlas/` Pages base path. All 456 current unique desktop/mobile cases were covered across runs: the broad run passed 451, with five stale source-catalogue expectations or an intermediate-build mirror check. After correcting those assertions and rebuilding the final release, all 46 affected source/story cases passed, including each CHSA phone map at more than 120 px canvas height. Scientific checks cover null preservation, native joins, source partitions, exports, signed values and source limits. The real phone map canvas measured 152.7 px with no page overflow. The earlier long-caption preview was replaced after repair.

## Website payload

The reproducible [payload measurement](nhhr-payload-size.json) counts reviewed public extracts, geometry and the production build, excluding raw/private source caches. Snapshot JSON is currently bundled in the initial application script and also supplied as downloadable files; geometry is requested on demand. Downloadable evidence is not all fetched on an ordinary visit. Gzip sizes are computed estimates; actual transfer depends on hosting compression and caching.

Run `python3 scripts/measure-atlas-payload.py --output docs/nhhr-payload-size.json` after the final build. | Payload | Uncompressed | Computed gzip |
|---|---:|---:|
| All reviewed dataset JSON | 10.24 MB | 321 KB |
| All local display geometry | 19.50 MB | 4663 KB |
| CHSA 2018 boundary layer (subset of geometry) | 4.89 MB | 486 KB |
| Main app script (includes reviewed dataset JSON) | 9.13 MB | 756 KB |

NHHR public assets total **39.40 MB**; the full production build totals **51.88 MB** including evidence downloads, fonts and campus assets. These totals are not the initial browser download. Main and secondary app scripts together are approximately **786 KB** with computed gzip, before styles, fonts, map workers and viewport-dependent remote basemap tiles. A CHSA view adds approximately **486 KB** of locally served geometry on demand. Hosting compression and cache behaviour were not inferred from these computed examples.


## Review files

- [Catalogue connection review](nhhr-catalogue-review.md) and [full source receipts](nhhr-catalogue-review.json).
- [CHSA source and boundary provenance](../public/data/nhhr/chsa-connections-provenance.json).
- [Research recovery provenance](../public/data/nhhr/research-followup-provenance.json).
- [Facility and parcel provenance](../public/data/nhhr/facility-followup-provenance.json).
- [Remaining location decisions](../public/data/nhhr/facility-location-gap-review.json).
- [Payload measurement](nhhr-payload-size.json).
