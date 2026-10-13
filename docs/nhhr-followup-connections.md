# NHHR follow-up connections · 12 October 2026

Fourteen follow-up views include recovered records and publisher CHSA supplements. The Atlas now contains 71 views / 10,382 rows, 42 short stories and 62 chapters across nine guided routes. Of the 71 views, 69 retain primary Zoer lineage and two are separately attributed publisher supplements. All 85 public catalogue entries retain a review; 46 primary collections supply explorer extracts. Rows and summaries overlap and do not count distinct people, trials or grants. UNBC branding and layout are retained. Atlas basemaps remain vector Streets/Dark; PGMaps was read only.

## Released views

| View | Source collection | Rows | Connection and limits |
|---|---|---:|---|
| `nserc-awards-history` | DATA-C046 | 67 | Exact institutional identities; current representative campus points. Source fiscal labels and instalments retained. |
| `nserc-awards-2001-2018` | DATA-C055 + official NSERC recovery | 126 | Seven institutions across 18 fiscal codes. The complete official 2011 export adds seven source groups; source origins and the truncated collected-file audit remain explicit. |
| `university-research-intensity` | DATA-C045 | 7 | Published income/headcount ratios, retaining denominator definitions. Signed change stays in chart/table rather than proportional dots. |
| `hospital-research-organizations` | DATA-C045 | 5 | Organization/zone-level facts in charts and tables. No allocation to hospital points. |
| `bc-graduate-projections` | DATA-C049 | 468 | BC model outputs, rounded to five, by age and credential. Projection badge, dashed lines and hollow points. No regional allocation. |
| `bc-health-occupation-projections` | DATA-C049 | 996 | BC original occupation-entry projections, including source exclusions and missing combinations. No licensing or staffing inference. |
| `community-disease-incidence` | DATA-C016 | 240 | Northern HA historical age-standardized registry rates per 1,000. Optional native HA5 join to current PGMaps context; no historical boundary harmonization. |
| `community-disease-prevalence` | DATA-C016 | 240 | Separate lifetime-prevalence definition. Same contextual HA5 join; no CHSA observations or rate-to-case conversion. |
| `institution-enrolment` | DATA-X08 | 7 | Seven verified Fall 2025 institution totals at representative campuses. Lakehead-only 8,499 replaces the combined approximate source record for this view; unsupported city ratios held. |
| `healthlink-hospital-additions` | DATA-C049 | 9 | Nine new directory entries, eight verified points and one unresolved building. 82 source records match 79 existing sites and remain in verification receipts. |
| `northern-capital-projects` | DATA-C012 | 64 | All 64 original printed rows across two windows, restoring 18 omitted rows. Literal funding dashes remain null; Table is the default. |
| `northern-capital-site-context` | DATA-C012 | 27 | 27 facility/window groups; 23 located groups represent 60 printed rows. Six new civic-address parcel references retain their precision labels, including original-address Mills equipment context. Replacement and leasehold records remain unlocated. |

| `northern-chsa-incidence` | PHSA CDR2022 supplement | 2,156 | Native historical CHSA rates and explicit non-release markers; Total only; 2018 display polygons. |
| `northern-chsa-prevalence` | PHSA CDR2022 supplement | 2,303 | Separate lifetime prevalence definition and matched 2018 geography. No HA down-allocation, case inference or complete Northern coverage. |

## Stories and navigation

`education-and-health` contains eight chapters spanning projections, enrolment and historical rates. `facilities-and-investment` adds three chapters spanning source directory identities, original capital records and verified site context. `research-resources` gains four chapters for historical and middle-window NSERC records, publisher intensity and organizational research spending. Twelve follow-up short stories link directly to the released views. Compatible sex/age/period filters remain selected across linked views; incidence/prevalence links match the reviewed original condition definitions.

## Remaining evidence needs

- **CHSA provenance and freshness:** directly retrieved PHSA observations are now connected. Source fiscal periods end in 2020–2021; current measurements need separately reviewed definitions and matching geometry. The original official v2018 ZIP returns 404, so the maps explicitly use a licensed display mirror. The public 29-CHSA subset and non-release markers cannot supply a complete Northern total.
- **2011 NSERC:** resolved through the complete official annual export, verified byte-for-byte against the exact collected prefix and independently retrieved in ranged requests. UNBC contributes 63 funding records / CAD 1,615,488 for this fiscal code; these are nominal source amounts, not annual paid cash or health-only awards.
- **Precise facilities:** Dr. Al Hogg building identity and historical moved/replacement sites. A shared campus address or current point does not resolve those projects.
- **Enrolment ratios:** campus allocations and a compatible resident/population denominator; independently verified NOSM observation.
- **CRA finance:** original filing currency/unit practice and legal-entity scope. Correct financial-code definitions are recorded, but the apparent university-scale discrepancy prevents monetary release.
- **Fees and utilities:** dated official fee conditions, units, applicable institutional tariff classes, territories and load profiles. Permit parsed value 69 is a construction valuation per ft², not a $69 fee. Billing codes are a reference catalogue without claims/utilization and include inactive entries.
- **Other candidates:** C002/C048 historical industrial comparisons need exact original geography/vintage/units; C018 heterogeneous policy claims need bounded source-table validation; C068 hydrogen scenarios need engineering/source reconciliation; X04 approximate baselines are not substituted for reviewed observations.
- **Connected collections still contain unused subfamilies:** C049 grant agreements and road/event records, C016 WorkBC headers/incomplete project samples and source vintages, and C012 operating accounts/sector facts retain their earlier scoped review gaps.

The compact Sources review exposes these needs. Detailed collection decisions, original hashes and scoped inspection receipts are in `nhhr-catalogue-review.json` and the follow-up provenance assets, including `chsa-connections-provenance.json` and `facility-location-gap-review.json`. No participant, consent, director, remuneration or contact records are released.

## Verification

The preceding verification receipts describe the prior 69-view release. Current 71-view verification and payload sizes are recorded in [the mapping-gap completion report](nhhr-mapping-gap-completion.md).


Source refresh/hash checks and independent original reconciliations completed for the three families. The public/module mirrors and catalogue UUID/row/view counts are checked by the preparation scripts. Production build passed with the Pages base path. The broad 422-case desktop/mobile run passed 418 cases; four test-selector assertions were repaired and passed in focused reruns. Four later middle-window source/map/trend cases also passed, covering all 426 current unique cases. After the phone chart layout adjustment, the relevant story, source-catalogue and guided-route cases were rerun; **All 126 relevant desktop/mobile story and catalogue cases passed** after that adjustment.

The live development map was checked without basemap fixtures: eight HealthLink points rendered over the Streets vector basemap, with 74 background features and zero raster sources. No page errors occurred. Desktop/mobile Sources and story previews showed no horizontal page overflow. The phone story plot is visible within its media frame without opening the expanded view.

Screenshots: `previews/nhhr-followup-sources-desktop.png`, `previews/nhhr-followup-sources-mobile.png`, `previews/nhhr-education-followup-desktop.png`, `previews/nhhr-education-followup-mobile.png`, `previews/nhhr-facility-followup-live-map.png`. Sources and the live map use actual app data. Production geometry interaction cases use fixed vector basemap fixtures for reproducibility; they do not alone establish external tile availability.
