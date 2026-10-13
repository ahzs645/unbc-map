# PGMaps data use and mapping gaps

77 family/dataset entries reviewed against the current NHHR implementation. Inventory covers 46 public data directories, nine top-level data files and 96 sync mappings. Detailed checks and catalogue-only limits are stated per entry; this is not a claim that every remote dataset, coordinate or scientific row has been validated.

The source checkout was read only. Scraper-owned snapshots remain in `vendor/bcdatamapper`; generated `public/data` copies were not altered. Existing UNBC design is retained.

Usage describes the selected data family and must be read alongside its reuse evidence. A family represented through Zoer is not proof that its entire PGMaps artifact was imported. Points are not automatically verified facilities; a compatible geometry does not establish a valid analytical join or permission to redistribute data.

## Classification

| Status | Entries |
| --- | ---: |
| partial | 5 |
| source-only | 17 |
| unavailable | 4 |
| unused | 47 |
| used | 4 |

These are review entries, including families and individual datasets; overlapping products and duplicate source copies are not independent measurements.

## Practical next additions

- Reviewed immunization-service points and facility-specific procedure waits have usable source geography; retain their own dates, definitions and suppressed values.
- Census DA/CT/CSD variables and the health-area bridge offer geographic joins, with native codes, source vintage, missing parents and valid weighting checked first.
- PG transit/walkability products can supply dated modeled access context; they do not establish patient travel, current schedules or clinical access.
- Environmental components can provide context after source/reconstruction flags and native polygon/grid handling are reviewed. They do not establish individual exposure or cause health outcomes.

## Missing mapping methods

The Atlas currently registers health polygons and reviewed institution/city/facility/stop points. Generic arbitrary geometry, other native administrative keys, PMTiles/H3/native grids and valid area/population-weighted aggregation need explicit adapters; the presence of those files does not add those methods automatically.

## Reviewed entries

### Health-place identity registry and child sites

**Health and access · partial**

Grain: Canonical place and separate parent-to-child physical-site relations
Geometry: Point; some CSV parent rows intentionally have no coordinate
Vintage: No collection-level vintage. Per-row verification and source URLs retained; existing Atlas provenance pins registry hashes.
Source terms: Mixed official directories and derived registry; no blanket licence verified.

Map support:

- Reviewed physical place points can be added to the existing facility renderer. Already used for candidate identities and official address references.

Missing or required:

- data: Independently review source-provided coordinates, aliases, rollups and physical-place classification.
- appMethod: Sanitized directory adapter; stable location_code and optional point-in-health-area join.
- sourceRights: Verify each source and coordinate derivative terms.

Cannot infer:

- Capacity, patients served, catchments, current services, or distribution of parent organization payments to child sites.

Next connection: Exact alias to reviewed location_code; retain parent/child relation without duplicating or allocating clinical measures.

Reuse evidence: candidate-evidence

Verification scope: Family metadata, file evidence and selected schemas inspected; individual rows and coordinates are not all independently verified.

PGMaps source paths:

- `vendor/bcdatamapper/data-sources/healthdata/health_place_registry/README.md`
- `vendor/bcdatamapper/data-sources/healthdata/health_place_registry/health_place_registry.csv`
- `vendor/bcdatamapper/data-sources/healthdata/health_place_registry/health_place_registry.geojson`
- `vendor/bcdatamapper/data-sources/healthdata/health_place_registry/health_place_sites.csv`
- `vendor/bcdatamapper/data-sources/healthdata/health_place_registry/health_place_sites.geojson`
- `public/data/health/echoscreen-northern-health-hospitals.geojson`

### Statistics Canada healthcare-facility directory

**Health and access · unused**

Grain: ODHF source facility record
Geometry: Point;86 BC records not mapped
Vintage: ODHF v 1.1 archive is 2020/2020001; export generated 2026-06-24 does not establish current facility status.
Source terms: StatCan and contributing-provider terms must be retained; GeoJSON has source URLs but no licence field.

Map support:

- 1230 BC point features can support a historical facility-type directory.

Missing or required:

- data: Reconcile duplicates, stale facilities and 86 unmapped BC records. Registry already incorporates ODHF membership, so a second overlay can duplicate facilities.
- appMethod: Sanitized ODHF point adapter and explicit physical-site crosswalk.
- sourceRights: Verify ODHF/contributing source redistribution terms.

Cannot infer:

- Current service availability, capacity, complete access coverage, unique establishments from overlapping sources.

Next connection: odhf_index stable key to reviewed location_code; preserve source membership and unmatched records.

Reuse evidence: not-reused

Verification scope: Family metadata, file evidence and selected schemas inspected; individual rows and coordinates are not all independently verified.

PGMaps source paths:

- `vendor/bcdatamapper/data-sources/healthdata/statcan_odhf/scrape_statcan_odhf.py`
- `vendor/bcdatamapper/data-sources/healthdata/statcan_odhf/statcan_odhf.db`
- `public/data/health/statcan-odhf-bc.geojson`

### HealthLinkBC immunization service listings

**Health and access · unused**

Grain: Service listing at location, not unique building
Geometry: 559 Point features
Vintage: Downloaded 2026-06-28; catalogue modifiedJune 27; resource last-modified 2025-11-26; documented monthly cycle and at-least-biennial record review.
Source terms: Stored source metadata explicitly Open Government Licence–BC. Preferred official bulk source; README documents Vaccines 411 bulk scraping restriction.

Map support:

- 559 service listings can be mapped with historical listing accessibility/language/hour metadata.

Missing or required:

- data: Verify geometry/status and multiple listings at the same location; distinguish service listings from unique sites.
- appMethod: New sanitized snapshot/point asset; existing Atlas facility renderer can be adapted.
- sourceRights: Retain OGL–BC and HealthLinkBC attribution; exclude contact fields.

Cannot infer:

- Uptake, eligibility, stock, appointments, capacity or population coverage.

Next connection: service_listing_id grain; location_id relation; only explicit additive listing counts, with unique-site summaries separately.

Reuse evidence: not-reused

Verification scope: Family metadata, file evidence and selected schemas inspected; individual rows and coordinates are not all independently verified.

PGMaps source paths:

- `vendor/bcdatamapper/data-sources/healthdata/bc_immunization_services/README.md`
- `vendor/bcdatamapper/data-sources/healthdata/bc_immunization_services/bc_immunization_services.db`
- `vendor/bcdatamapper/data-sources/healthdata/bc_immunization_services/output/bc-immunization-services.geojson`

### Surgical waiting lists and completed-case wait percentiles

**Health and access · partial**

Grain: Capture run × procedure × age group × HA/facility; export also includes specialist memberships
Geometry: Facility coordinates in export; original clinical statistics not geographic
Vintage: 5 capture runs June 15,2026. Report periods March 31/April 30; Atlas retains run 5 Northern records: April 30 waiting lists and February 1–April 30 completed surgeries.
Source terms: BC Ministry health terms. Export also contains professional identities; do not copy those into a public statistical release.

Map support:

- Atlas charts 99 Northern procedure/age rows. Facility-level measures can map at existing independently checked points; HA statistics can use 5 HApolygons after oneprocedure/period selection.

Missing or required:

- data: Choose one genuine report/capture; preserve suppression; reconcile rollup child facilities and aliases.
- appMethod: Bounded facility/HA statistical adapter and scope filters; no additive p 50/p 90 aggregation.
- sourceRights: Retain source terms and definitions.

Cannot infer:

- Patient-specific predicted waits, complete referral delays, extra patients from repeated captures, averaged/summed percentiles.

Next connection: run/report period + procedure_key + adult_flag + facility_id/HA; exact reviewed facility alias join. Keep waiting-list counts separate from completed-case percentiles.

Reuse evidence: zoer-source-equivalent

Verification scope: Family metadata, file evidence and selected schemas inspected; individual rows and coordinates are not all independently verified.

PGMaps source paths:

- `vendor/bcdatamapper/data-sources/healthdata/bc_wait_times/bc_wait_times.db`
- `vendor/bcdatamapper/data-sources/healthdata/bc_wait_times/output/bc-wait-specialists.json`

### CIHI cost per weighted inpatient case

**Health and access · partial**

Grain: Reporting entity × fiscal year × indicator, multiple levels
Geometry: No source geometry; existing Atlas HA/independently checked facility points
Vintage: Local database 3342 rows. Atlas reads separately locked BC original May 2026 workbook, not assumed byte-identical to this database.
Source terms: CIHI terms and attribution; manual export retained. Availability is not a new licence grant.

Map support:

- Already mapped in Atlas:34 HA/province records and 363 facility records. More periods/report scopes possible if compatible.

Missing or required:

- data: Consistent indicator/fiscal/reporting scope, suppression; weighted-case denominators if any aggregation proposed.
- appMethod: Existing one-record-per-entity map supports scoped values; new filters/adapters needed for additional scopes.
- sourceRights: Verify original CIHI redistribution terms.

Cannot infer:

- Patient bill, procedure price, marginal savings, total spending or regional costs from unweighted means/sums.

Next connection: Exact original reporting entity to reviewed alias/HA crosswalk; fiscal/indicator filters; preserve suppression and co-located ambiguity.

Reuse evidence: zoer-source-equivalent

Verification scope: Family metadata, file evidence and selected schemas inspected; individual rows and coordinates are not all independently verified.

PGMaps source paths:

- `vendor/bcdatamapper/data-sources/healthdata/cihi_cshs/load_cihi_cshs.py`
- `vendor/bcdatamapper/data-sources/healthdata/cihi_cshs/cihi_cshs.db`

### Institutional MSP payee map

**Health and access · unused**

Grain: Facility-like payee × fiscal year; corporate/HQ and multisite entities possible
Geometry: 89 point features out of 146 facility-like payees
Vintage: GeneratedJune 22,2026; fiscal start years 2014–2024.
Source terms: BC MSP Blue Book/provider-layer/coordinate source terms. Raw database contains practitioners; audit proposes only facility-like payee metadata.

Map support:

- Individually reviewed institutional payee/year point map.

Missing or required:

- data: Check 89 mapped/57 unmapped payees; corporate/multisite precision and fiscal-year grain.
- appMethod: Bounded facility-only snapshot/year selector; exact parent/place review.
- sourceRights: Verify source redistribution and coordinate terms; remove contacts.

Cannot infer:

- Patients, productivity, hospital capacity, local benefit or payments allocated to each child site.

Next connection: Exact institutional payee to reviewed canonical parent; label corporate/HQ precision and never distribute to affiliated sites.

Reuse evidence: not-reused

Verification scope: Family metadata, file evidence and selected schemas inspected; individual rows and coordinates are not all independently verified.

PGMaps source paths:

- `vendor/bcdatamapper/datascrapers/health/msp-facilities/README.md`
- `vendor/bcdatamapper/datascrapers/health/msp-facilities/output/msp-facilities.geojson`

### ER service/wait historical snapshot

**Health and access · unused**

Grain: Provider/hospital record with heterogeneous actual/estimated/predicted/status fields
Geometry: 839 records;92 BCwithlat/lng
Vintage: Mixed data_updated_at strings April 18–June 16,2026; each field has its own time. Historical capture, not live.
Source terms: ERStat and heterogeneous provider terms; no blanket licence. Some BC source labels explicitly contain LLM derivation.

Map support:

- Directory points after independent public-source verification; metric release only after accepting specific source/time/definition.

Missing or required:

- data: Separate official observations, LLM-derived statuses and predictions; review metric provenance and stale availability.
- appMethod: Source-specific status/time/refresh adapters; static point map alone cannot communicate live status.
- sourceRights: Establish third-party/provider redistribution permission.

Cannot infer:

- Current ER wait/availability, comparable nationwide performance from heterogeneous fields.

Next connection: Directory-first allowlist. Keep observed waits, predictions and inferred narratives separate; never generic-import all fields.

Reuse evidence: not-reused

Verification scope: Family metadata, file evidence and selected schemas inspected; individual rows and coordinates are not all independently verified.

PGMaps source paths:

- `vendor/bcdatamapper/data-sources/healthdata/erstat/output/erstat-hospitals.json`
- `public/data/erstat-hospitals.json`

### NH Connections historical schedule and benchmarks

**Health and access · used**

Grain: 286 schedule events and 5 separatebenchmark rows
Geometry: Original no road geometry;Atlas 56 reviewedreference points and 28 schematic segments
Vintage: Source capturedJune 16,2026; not a live schedule.
Source terms: NH schedule/benchmark terms; independent geocoder/OSM attribution retained.

Map support:

- Atlas 280 mapped/6 unresolved events,184 townrepresentative/96 facility-address events;58 labels/56 points and 28 split schematic segments.

Missing or required:

- data: Resolve Mackenzie Junction/Small River 6 events and exactboardingpoints for 184 coarse-town events. Validated road geometry required for road routes.
- appMethod: Existing schematic renderer; road routing is distinct and cannot be inferred from stop lines.
- sourceRights: Retain coordinate/source attribution.

Cannot infer:

- Passenger usage, patient count, current service, road distance/speed or catchment.

Next connection: Keep stable event IDs, original service-day/direction/sequence; exact reviewed alias join; split at unresolved stops and sequence restarts.

Reuse evidence: zoer-source-equivalent

Verification scope: Family metadata, file evidence and selected schemas inspected; individual rows and coordinates are not all independently verified.

PGMaps source paths:

- `vendor/bcdatamapper/data-sources/healthdata/bc_patient_travel/bc_patient_travel.db`
- `vendor/bcdatamapper/data-sources/healthdata/bc_patient_travel/scrape_bc_patient_travel.py`

### PG GTFS and modeled timetable/walking access

**Health and access · unused**

Grain: Service-date trips/connections and walking graph; older route/stop summaries are independent products
Geometry: StopPoint,shapeLineString,walkingnetwork,derivedtravel-timegrid
Vintage: ReferenceOctober 7,2026;feedOctober 5–January 2,2027. Older summary/supplement files are not presumed same feed cohort.
Source terms: Official BC Transit feed source/hash; verify GTFS and municipal street-source terms.

Map support:

- 518 stops/18 routes/487 trips/13981 connections available. Model access to independently checked Atlas hospitals/trialsites inside PG bounds.

Missing or required:

- data: Validated entrance/access points, residual walk gaps, service date within feed validity; anothercity needs its own feed/bounds/projection.
- appMethod: Port connection-scan/Dijkstra worker, actual shape overlay/time controls. Current static schematic lines are not a timetable/access model.
- sourceRights: Check GTFS/street-source redistribution.

Cannot infer:

- Live delays, actual patient journeys, surveyed safe/accessible entrances or sidewalks, Northernwide transit access.

Next connection: Join stop IDs only after feed/date alignment; preserve trip/sequence identity. Verified facility entry to modelgraphaccess. Keep actual GTFS shapes distinct from NHschematic lines.

Reuse evidence: not-reused

Verification scope: Family metadata, file evidence and selected schemas inspected; individual rows and coordinates are not all independently verified.

PGMaps source paths:

- `vendor/bcdatamapper/datascrapers/transit/TRAVEL-TIME.md`
- `vendor/bcdatamapper/datascrapers/transit/source/prince_george_gtfs_2026-10-07.zip`
- `vendor/bcdatamapper/datascrapers/transit/output/prince_george_travel_time.json.gz`
- `public/data/transit/travel-time-audit.json`
- `docs/transit-pipeline.md`

### PG local walkability/mobility products

**Health and access · unused**

Grain: Community summaries,assetconditions/priorities andderived 30 mgrid have different grains
Geometry: 31 community polygons;1916 asset lines;849×647 grid/147 factor masks
Vintage: Community/gridMay 8,2026;factor masksJune 21. Inputs and report/crashperiods differ.
Source terms: CityPG/ICBC public base sources; local reconstruction/report assets need method and redistribution review; OSMsupplements ODbL.

Map support:

- Map local community metrics or reviewed lineassetcondition;overlay verified service facilities for context.

Missing or required:

- data: Input vintages/variantdefinitions, reconstruction rights, independent quality; no invented Northern coverage.
- appMethod: Addcommunity/DApolygon,lineasset,grid adapters. Atlas currently health-area polygons only.
- sourceRights: Separate publicwebbase from supplemental/report derivative permissions.

Cannot infer:

- Exposure-adjusted crash risk, engineering rating, actual mobility or health causation; comparable scores across cities from PGrelative normalization.

Next connection: communityId to community polygons; sourceLayer+AssetID to linegeometry; retain variant/denominators. Centroid allocation is not exact boundary clipping.

Reuse evidence: not-reused

Verification scope: Family metadata, file evidence and selected schemas inspected; individual rows and coordinates are not all independently verified.

PGMaps source paths:

- `public/data/walkability/manifest.json`
- `public/data/walkability/community_walkability.geojson`
- `public/data/walkability/assets/asset_priority_joined.geojson`
- `public/data/walkability/heatmap/citywide_mi_grid.json`
- `public/data/walkability/heatmap/factor_masks.json`

### HealthyPlan-PG education/food/retail service candidates

**Health and access · unused**

Grain: Educationpoint,OSMPOI andbusinesslicence record aredifferentgrains
Geometry: Point;overlapping source inventories
Vintage: EducationMay 31/businessJune 17,2026. MainmanifestMay 31 stale 327 POIs vsnewbusiness/actual 328.
Source terms: EducationOGL–BC;CityPGlowndata/itemterms;OSMODbL;BCAddressGeocoderOGL–BC frommanifest.

Map support:

- 205 educationpoints and 328 POIs,9 healthyfoodclassified; licences expand candidate inventory after review.

Missing or required:

- data: Reconcile version drift, duplicate establishments/licences, classification/coordinate quality and public accessibility.
- appMethod: Sanitized point/class adapters;neighborhood/DAaggregations need spatialjoin/denominators.
- sourceRights: PreserveODbL/municipalterms;licences can include homebusinesses: allowlist public service points.

Cannot infer:

- Foodsecurity,nutrition,eligibility,capacity,usage;all restaurants as healthyfood;businesslicence as openpublicretail.

Next connection: Stableeducationid/OSMtype+id/licenceid;reviewedexactcrosswalk instead ofname-onlymatching. Healthyfoodclassification differs frominspectionhazardrating.

Reuse evidence: not-reused

Verification scope: Family metadata, file evidence and selected schemas inspected; individual rows and coordinates are not all independently verified.

PGMaps source paths:

- `vendor/bcdatamapper/datascrapers/healthyplan-pg/sync-healthyplan-pg.mjs`
- `public/data/healthyplan-pg/manifest.json`
- `public/data/healthyplan-pg/education_manifest.json`
- `public/data/healthyplan-pg/business_manifest.json`

### Exact HealthyPlan.City pairwise equity method

**Health and access · unavailable**

Grain: City-relative dissemination-block demographic/environment decile pairs
Geometry: Method code; no complete verified block metric release
Vintage: Method reviewMay 2026;notcurrent scientific observationdata.
Source terms: Contract notes singlecity/noncommercial requests andCANUEaccess;permissions not established bymethodcode.

Map support:

- Reuse pure scoring helpers only with licensed/validated input records. ServicePOIs are not complete HealthyPlan reproduction.

Missing or required:

- data: Finalblock metrics/ranks,exactties,exposureinputs/vintages/methods andDBgeometry.
- appMethod: DBadapter,pairwiseprioritycityuniverse,transparentnonprioritymap,matrixlegend;notexistingAtlasmethod.
- sourceRights: LicensedHealthyPlan/CANUEdata andderivativepermissions.

Cannot infer:

- ExactHealthyPlanoutput fromcurrentPOIs,weightedindex asHealthyPlan,healthcausation.

Next connection: DBUID + city universe + method lock; keep pairwise screening separate from ordinary Atlas shares.

Reuse evidence: not-reused

Verification scope: Family metadata, file evidence and selected schemas inspected; individual rows and coordinates are not all independently verified.

PGMaps source paths:

- `docs/healthyplan-rebuild-contract.md`
- `src/lib/healthyplan/scoring.ts`
- `src/lib/healthyplan/config.ts`

### HealthSpace restaurant inspection history

**Health and access · unused**

Grain: Premise with nestedinspectionevents
Geometry: 457 records withcoordinates;432 qualityok/25 review
Vintage: Mixed scraped_atDecember 16,2025–May 6,2026;inspectiondates separate. Sep 2026 classificationaudit is not newinspectioncapture.
Source terms: HealthSpace / Northern Healthpublicpages; no bulk licence established inREADME. Google/OSMgeocoding fields need term/precision review.

Map support:

- Historical checkedpremises anddatedsourcehazardratings;flattenedinspectioneventcharts.

Missing or required:

- data: Verifypremiseidentity/coordinates, nested eventdefinitions; preserve geocode reviewflags.
- appMethod: Sanitizedpremise/inspection adapters,categoricalmaplegend andeventdates.
- sourceRights: Checkinspection redistribution andGoogle coordinate/displayrestrictions.

Cannot infer:

- Currentfoodsafety,illnessrisk,healthyfoodaccessfromhazardrating,popularity/customers.

Next connection: details_url/publicpremiseID tostablelocation_code; separateplaceparent andinspectiondatechildrecords; no counts from repeatedscrapes.

Reuse evidence: not-reused

Verification scope: Family metadata, file evidence and selected schemas inspected; individual rows and coordinates are not all independently verified.

PGMaps source paths:

- `vendor/bcdatamapper/datascrapers/food-health/README.md`
- `vendor/bcdatamapper/datascrapers/food-health/output/restaurants.json`
- `public/data/restaurant-classifications.json`

### Water facilities, advisories and laboratory sample containers

**Health and access · unused**

Grain: Facility containers,nestedlab events,noticeevents fromoverlapping sources
Geometry: Lat/lon;manyqualityreviewflags;noverified water-servicepolygons
Vintage: Facilities/samplesMay 8;HealthSpaceadvisoriesMay 10,2026. Retainedmanifestrecords 405 failedbacteriologicalrequest despiteexistingfiles.
Source terms: HealthSpace / Northern Health/WaterToday;nooneconfirmedredistributionlicence. Googlegeocodingprecision/termsneedreview.

Map support:

- Historicalreviewedfacility/advisorypoints andsource-specific sampleeventcharts.

Missing or required:

- data: Noticeidentity/start/end/currentstatus,geocodeprecision,labunits/detectionlimits,failedrefresh/completeness.
- appMethod: Separatefacility/notice/sample adapters,categoricalstatus/time filter;noaffectedpopulationmap withoutserviceboundaries.
- sourceRights: EstablishHealthSpace/WaterToday/coordinatepermissions.

Cannot infer:

- Currentpotability,safety,servicearea,exposure orpeopleaffected;711 noticesasallNorthernHealth/current.

Next connection: Exactsourcefacility/detailsID; only same-noticeproof merges crosssourceevents. Preserve nestedlabunits/time/detectionlimit.

Reuse evidence: not-reused

Verification scope: Family metadata, file evidence and selected schemas inspected; individual rows and coordinates are not all independently verified.

PGMaps source paths:

- `vendor/bcdatamapper/datascrapers/food-health/output/water/drinking_water_facilities.json`
- `public/data/water/active_water_notices.json`
- `public/data/water/combined_water_notices_summary.json`
- `public/data/water/water_download_manifest.json`

### PHSA/BCCDC community/chronic disease scraper references

**Health and access · source-only**

Grain: Potentialindicator × geography × period × age/sex; actualgrainunverified
Geometry: No outputfolders incheckout;querycode offersHA/HSDA/LHA/CHSA/etc
Vintage: No sourceobservationvintage toverify;code/sourceURLonly.
Source terms: PHSA/BCCDCterms,suppression andage-standardization needactualdownloadreview.

Map support:

- Existing Atlas HA/HSDA/LHAjoin once actual verifieddataexists;CHSApolygons inPGMapsbuthave noAtlasgeographyadapter.

Missing or required:

- data: Actualscientificrows,codes,period,units,age-standardization,suppression,uncertainty,denominators.
- appMethod: Indicatoradapter/exactcodes;CHSAgeography/index iffinerscope needed.
- sourceRights: Verifyaccess/redistributionandhealthindicatorrules.

Cannot infer:

- Diseaseburdenfromkeywords,clinicaltrialdomainsasincidence,unverified/unsuppressedlocalstatistics.

Next connection: StartboundedoneindicatorLHA releasewithnativecodes/sourcepopulation/perioddefinitions;preserveage-standardizationandsuppression.

Reuse evidence: not-reused

Verification scope: Family metadata, file evidence and selected schemas inspected; individual rows and coordinates are not all independently verified.

PGMaps source paths:

- `vendor/bcdatamapper/datascrapers/health/phsa-community-health/sync-phsa-community-health.mjs`
- `vendor/bcdatamapper/datascrapers/health/phsa-community-health/build-chsa-lha-crosswalk.mjs`
- `vendor/bcdatamapper/datascrapers/health/phsa-community-health/output`
- `vendor/bcdatamapper/datascrapers/health/bccdc-chronic-disease-tableau/probe-bccdc-chronic-disease-tableau.mjs`
- `vendor/bcdatamapper/datascrapers/health/bccdc-chronic-disease-tableau/output`

### CBA economic/unit-price reference tables

**Health and access · unused**

Grain: GEO/year/classificationstatistics;fee/rate/documentlinebenchmarks
Geometry: Nonspatial;regionalnames notfacilityaddresses
Vintage: Different observation/effectivedates andscrapetimes;noonecommontime.
Source terms: StatCandataterms;MSPsecondaryDrBillsource andutility/bylawdocumenttermsrequireindependentchecks.

Map support:

- Referencecharts/cards. Economicregion statisticsmaponlywithtrueeconomicregiongeometry,notNorthernHealthcatchment.

Missing or required:

- data: ExactsourceGEO/table/units/classification/vintage/effectiveprices.
- appMethod: Economicregion/provinceadapter andstatisticalfilters;institutionmapsmustnotallocate provincialearnings.
- sourceRights: Confirmsecondaryfee/utilityrights;preferofficialMSPschedule.

Cannot infer:

- NHHR causalbenefit,UNBCgraduatesearningsfromprovinceaverage,localspendingfromunitpriceswithoutusage.

Next connection: ExactsourceGEO/classificationjoin;keepobservedstatistics separatefromscenariocostinputs.

Reuse evidence: not-reused

Verification scope: Family metadata, file evidence and selected schemas inspected; individual rows and coordinates are not all independently verified.

PGMaps source paths:

- `vendor/bcdatamapper/data-sources/healthdata/statcan_cba/statcan_cba.db`
- `vendor/bcdatamapper/data-sources/healthdata/statcan_education_earnings/education_earnings.db`
- `vendor/bcdatamapper/data-sources/healthdata/msp_codes/msp_codes.db`
- `vendor/bcdatamapper/data-sources/healthdata/bc_utility_tariffs/bc_utility_tariffs.db`
- `vendor/bcdatamapper/data-sources/healthdata/bc_permit_fees/bc_permit_fees.db`

### Health authorities

**Geography and population · used**

Grain: One territorial health area
Geometry: Polygon/MultiPolygon with original Ministry string code
Vintage: Captured October 2025; boundary effective vintage unestablished. Historical observations use contextual polygons.
Source terms: Atlas provenance records Open Government Licence – British Columbia.

Map support:

- Compatible source geometry exists; the adapter and interpretation requirements are listed below.

Missing or required:

- vintage: Dated historical concordance needed for harmonized comparisons

Cannot infer:

- Not a practice location, catchment or measure of service availability.
- PHSA/province totals cannot be allocated to territorial HA polygons.

Next connection: Keep existing hash-locked native-code adapters; version observation periods separately from geometry.

Reuse evidence: datasets: hospital-stay-costs assets: public/data/nhhr/boundaries-ha.geojson

Verification scope: local: yes actualFeatures: 5 verified: All NHHR geometry/code sets equal PGMaps source; hashes match Atlas provenance

PGMaps source paths:

- `vendor/bcdatamapper/datascrapers/bc/boundaries/output/BCMoH/simplified/health_authorities.json`
- `vendor/bcdatamapper/datascrapers/bc/boundaries/output/BCMoH/health_authorities.json`

### Health service delivery areas

**Geography and population · used**

Grain: One territorial health area
Geometry: Polygon/MultiPolygon with original Ministry string code
Vintage: Captured October 2025; boundary effective vintage unestablished. Historical observations use contextual polygons.
Source terms: Atlas provenance records Open Government Licence – British Columbia.

Map support:

- Compatible source geometry exists; the adapter and interpretation requirements are listed below.

Missing or required:

- vintage: Dated historical concordance needed for harmonized comparisons

Cannot infer:

- Not a practice location, catchment or measure of service availability.
- PHSA/province totals cannot be allocated to territorial HA polygons.

Next connection: Keep existing hash-locked native-code adapters; version observation periods separately from geometry.

Reuse evidence: datasets: physicians-hsda datasets: nursing-workforce-northern assets: public/data/nhhr/boundaries-hsda.geojson

Verification scope: local: yes actualFeatures: 16 verified: All NHHR geometry/code sets equal PGMaps source; hashes match Atlas provenance

PGMaps source paths:

- `vendor/bcdatamapper/datascrapers/bc/boundaries/output/BCMoH/simplified/health_service_delivery_areas.json`
- `vendor/bcdatamapper/datascrapers/bc/boundaries/output/BCMoH/health_service_delivery_areas.json`

### Local health areas

**Geography and population · used**

Grain: One territorial health area
Geometry: Polygon/MultiPolygon with original Ministry string code
Vintage: Captured October 2025; boundary effective vintage unestablished. Historical observations use contextual polygons.
Source terms: Atlas provenance records Open Government Licence – British Columbia.

Map support:

- Compatible source geometry exists; the adapter and interpretation requirements are listed below.

Missing or required:

- vintage: Dated historical concordance needed for harmonized comparisons

Cannot infer:

- Not a practice location, catchment or measure of service availability.
- PHSA/province totals cannot be allocated to territorial HA polygons.

Next connection: Keep existing hash-locked native-code adapters; version observation periods separately from geometry.

Reuse evidence: datasets: population-lha datasets: population-lha-ages assets: public/data/nhhr/boundaries-lha.geojson

Verification scope: local: yes actualFeatures: 89 verified: All NHHR geometry/code sets equal PGMaps source; hashes match Atlas provenance

PGMaps source paths:

- `vendor/bcdatamapper/datascrapers/bc/boundaries/output/BCMoH/simplified/local_health_areas.json`
- `vendor/bcdatamapper/datascrapers/bc/boundaries/output/BCMoH/local_health_areas.json`

### Community health service areas

**Geography and population · partial**

Grain: One CHSA; explicit LHA/HSDA/HA parents
Geometry: Polygon/MultiPolygon keyed CMNTY_HLTH_SERV_AREA_CODE
Vintage: Boundary vintage and CHSA_POPULATION_CENSUS year unestablished.
Source terms: BC Ministry source; verify specific publisher metadata for a new export.

Map support:

- No direct compatible map was verified in this review.

Missing or required:

- data: Select a real CHSA measure; boundary population field is not NHHR's 2025 projection
- appMethod: Add chsa geometry/index/selector
- join: Native CHSA IDs; preserve bridge code-set differences

Cannot infer:

- CHSA is not an Indigenous territory or facility catchment.

Next connection: Export unchanged simplified CHSA geometry and native ID index, then add source-backed CHSA observations; retain 2210/changed-code diagnostics.

Reuse evidence: used: Hierarchy exported; CHSA geometry not loaded

Verification scope: local: yes actualFeatures: 231 atlasHierarchyRows: 231

PGMaps source paths:

- `vendor/bcdatamapper/datascrapers/bc/boundaries/output/BCMoH/simplified/community_health_service_areas.json`
- `vendor/bcdatamapper/datascrapers/bc/boundaries/output/BCMoH/index.json`

### 2021 census–health–economic bridge

**Geography and population · unused**

Grain: One 2021 DB membership; pair relationships repeat counts across 12 comparison families
Geometry: No new geometry; explicit DB→DA/CSD/CD/ER and DB→CHSA/LHA/HSDA/HA identifiers
Vintage: 2021 block universe; current health index vintage unestablished. CHSA2210 unresolved; 14 current index codes absent from block crosswalk.
Source terms: Ministry/BCCDC and Statistics Canada inputs; source-specific redistribution review needed.

Map support:

- No direct compatible map was verified in this review.

Missing or required:

- source: Dated official concordance before repairing missing health parents
- data: Retain excluded 36 extra population DBs and unresolved groups
- appMethod: Bridge drilldown/ER profiles adapter
- join: Filter one censusLevel/healthLevel before sums; shares are fractions 0–1, unlike Atlas percentage points

Cannot infer:

- Covered residents are not a new official province estimate.
- Resident shares are not universal allocation weights for jobs, costs, trials or capacity.
- No universal DA→CT hierarchy; source contains pseudo-tract codes.

Next connection: Expose eight ER profiles and membership diagnostics. Compatible covered-universe counts can map through existing HA/LHA/HSDA adapters, retaining the unresolved group; never allocate arbitrary NHHR indicators through resident weights.

Reuse evidence: used: no

Verification scope: local: yes actualBlocks: 52387 uniqueDBUIDs: 52387 coveredPopulation: 5000874 unresolvedHealthBlocks: 533 unresolvedHealthPopulation: 78916 relationshipRows: 4226 comparisonFamilies: 12

PGMaps source paths:

- `vendor/bcdatamapper/datascrapers/bc/boundaries/geography-bridge/README.md`
- `vendor/bcdatamapper/datascrapers/bc/boundaries/output/GeographyBridge/manifest.json`
- `vendor/bcdatamapper/datascrapers/bc/boundaries/output/GeographyBridge/blocks.json.gz`
- `vendor/bcdatamapper/datascrapers/bc/boundaries/output/GeographyBridge/relationships.json.gz`
- `vendor/bcdatamapper/datascrapers/bc/boundaries/output/GeographyBridge/economic-region-profiles.json`

### BC economic regions and census hierarchy

**Geography and population · unused**

Grain: 2021 ER with official census memberships
Geometry: ERUID polygons; shared-topology 50m derivative
Vintage: 2021; do not apply this hierarchy to 2025 CSDs without concordance.
Source terms: Manifest: Statistics Canada Open Licence.

Map support:

- No direct compatible map was verified in this review.

Missing or required:

- data: ER-grained measure or covered-universe profile
- appMethod: Economic-region geometry adapter
- join: Exact ERUID; combined North Coast/Nechako remains one group observation

Cannot infer:

- ERs are not governments or NDIT service regions.
- No universal Northern BC polygon applies to every table.

Next connection: Normalize ERUID to feature code; introduce ER/group adapter with a labelled group union and one retained source value.

Reuse evidence: used: no

Verification scope: local: yes regions: 8 officialCDMemberships: 29 officialCSDMemberships: 751

PGMaps source paths:

- `vendor/bcdatamapper/datascrapers/bc/boundaries/ECONOMIC-REGIONS.md`
- `vendor/bcdatamapper/datascrapers/bc/boundaries/output/StatCan/bc_economic_regions_2021.geojson.gz`
- `vendor/bcdatamapper/datascrapers/bc/boundaries/output/StatCan/bc_economic_regions_2021.hierarchy.json`
- `vendor/bcdatamapper/datascrapers/bc/boundaries/output/StatCan/bc_economic_regions_2021.manifest.json`

### BC municipalities and regional districts

**Geography and population · unused**

Grain: Legal administrative area
Geometry: Polygon/MultiPolygon keyed boundaryCode/LGL_ADMIN_AREA_ID
Vintage: Effective date absent from inspected metadata.
Source terms: BC Geographic Warehouse; inspected outputs lack explicit licence field.

Map support:

- No direct compatible map was verified in this review.

Missing or required:

- source: Confirm effective date/licence
- data: True municipal/RD observations
- appMethod: Municipal/RD geometry adapter
- join: Reviewed legal-area ID concordance, not mailing-city name matching

Cannot infer:

- Institution totals and city-tagged trials do not establish resident polygon coverage.
- UBC's Vancouver mailing address does not put its campus in Vancouver municipality.

Next connection: Offer optional legal context boundaries; permit choropleths only for compatible official source IDs and geography.

Reuse evidence: used: no existingCityGrain: Atlas city-query counts remain city points

Verification scope: local: yes actualMunicipalities: 160 actualRegionalDistricts: 28

PGMaps source paths:

- `vendor/bcdatamapper/datascrapers/bc/boundaries/output/BC/municipalities.geojson`
- `vendor/bcdatamapper/datascrapers/bc/boundaries/output/BC/regional_districts.geojson`

### 2021 census boundary foundation

**Geography and population · unused**

Grain: 2021 DA/CT/CSD/CD; tract coverage is not universal
Geometry: Chunked shared-topology polygons and province parent polygons keyed explicit id
Vintage: 2021, separate from current 2025 CSD product.
Source terms: Statistics Canada source; carry source terms and attribution.

Map support:

- No direct compatible map was verified in this review.

Missing or required:

- data: BC geometry is complete but current compact demographic metrics are local subsets
- appMethod: Census enums/native IDs and viewport chunk loader
- join: Same-vintage IDs; retain statistical-equivalent type

Cannot infer:

- A CSD is not always a municipality; a CD is not always government.
- Geometry availability does not imply observation availability.

Next connection: Start with the 135-DA reviewed local subset; use existing province parents for all 28 CT/13 CSD source rows.

Reuse evidence: used: no

Verification scope: local: yes actualUniqueBCOverviewDAs: 7848 overviewChunksExisting: 21 mediumChunksExisting: 21 BCParentCDs: 29 BCParentCSDs: 751 BCParentCTs: 844 actualBCCSDChunk: 751

PGMaps source paths:

- `vendor/bcdatamapper/datascrapers/census/README.md`
- `vendor/bcdatamapper/datascrapers/census/output/bc-da-simplified/manifest.json`
- `vendor/bcdatamapper/datascrapers/census/output/bc-da-simplified/parents/cd.geojson`
- `vendor/bcdatamapper/datascrapers/census/output/bc-da-simplified/parents/csd.geojson`
- `vendor/bcdatamapper/datascrapers/census/output/bc-da-simplified/parents/ct.geojson`
- `vendor/bcdatamapper/datascrapers/census/output/canada-csd/provinces/59.geojson.gz`

### Current Canada administrative reference layers

**Geography and population · unused**

Grain: Current statistical administrative equivalents and separate 2021 comparisons
Geometry: GeoJSON/advertised vector PMTiles with referenceDate and representationRole
Vintage: CSD effective 2025-01-01; CD comparison 2021; derived 2025 CDs dissolve current CSD parents.
Source terms: Manifest records Statistics Canada Open Licence / Open Government Licence – Canada by product.

Map support:

- No direct compatible map was verified in this review.

Missing or required:

- data: Matching current-CSD observations absent in selected Atlas data
- appMethod: Generic vector/PMTiles adapter
- join: Dated concordance needed for 2021 measures on 2025 boundaries

Cannot infer:

- Do not relabel every CSD/CD as government.
- Current boundaries do not harmonize history.

Next connection: Add separate current-context boundary mode; keep analytical 2021 census joins on 2021 shapes.

Reuse evidence: used: no

Verification scope: local: yes actualCSD2025Features: 5054 actualCD2021Features: 293 localOverviews: yes remotePMTiles: Listed in catalogue; remote availability not network-verified

PGMaps source paths:

- `vendor/bcdatamapper/datascrapers/canada/admin-geographies/README.md`
- `vendor/bcdatamapper/datascrapers/canada/admin-geographies/output/manifest.json`
- `vendor/bcdatamapper/datascrapers/canada/admin-geographies/output/overview/census-subdivisions-2025.geojson`
- `vendor/bcdatamapper/datascrapers/canada/admin-geographies/output/overview/census-divisions-2021.geojson`
- `vendor/bcdatamapper/datascrapers/canada/admin-geographies/output/r2/pmtiles-catalog.json`

### BC census postal areas

**Geography and population · unused**

Grain: Census-reported three-character FSA; derived prefix unions
Geometry: CFSAUID polygons; PGMaps-defined V0–V9 unions may be disconnected
Vintage: 2021; 25m display simplification.
Source terms: Statistics Canada source; carry manifest terms.

Map support:

- No direct compatible map was verified in this review.

Missing or required:

- data: Actual FSA-grained measure
- appMethod: Postal geometry adapter
- join: Same-vintage CFSAUID; six-character delivery polygons unavailable

Cannot infer:

- Not Canada Post six-character delivery boundaries.
- Individual patient postal addresses are outside this task.

Next connection: Support reviewed FSA observations and explicit unmatched prefixes; do not fabricate finer postal polygons.

Reuse evidence: used: no

Verification scope: local: yes actualFSAs: 191 actualPrefix2Groups: 10 derivedRegion: V missingExamples: V7X missingExamples: V7Y

PGMaps source paths:

- `vendor/bcdatamapper/datascrapers/bc/boundaries/STATCAN-FSA.md`
- `vendor/bcdatamapper/datascrapers/bc/boundaries/output/StatCan/bc_fsa_2021.geojson.gz`
- `vendor/bcdatamapper/datascrapers/bc/boundaries/output/StatCan/bc_fsa_2021.manifest.json`
- `vendor/bcdatamapper/datascrapers/bc/boundaries/output/StatCan/bc_postal_prefix2_2021.geojson.gz`

### Prince George Census demographic vectors

**Geography and population · unused**

Grain: One GeoUID×vector; sex and overlapping age/category universes
Geometry: 135 DA polygons keyed id matching source GeoUID
Vintage: CA21; income year, 100%/25% universe and denominator vary by vector.
Source terms: Underlying Statistics Canada/CensusMapper feed; compact catalogue lacks complete rights/quality ledger.

Map support:

- No direct compatible map was verified in this review.

Missing or required:

- source: Review source/vector universes and quality notes
- data: Builder collapses blank/x/F/unparseable to null and rounds numeric decimals to two places; retain original statuses
- appMethod: Vector→AtlasDataset and DA renderer
- join: Total sex once; never sum sex or overlapping hierarchical vectors

Cannot infer:

- One DA population vector449 differs from age total450; do not force agreement.
- Indigenous identity/ancestry is not Nation citizenship, title, consent or governance.
- Demographics are not disease prevalence or trial eligibility.

Next connection: Release a small reviewed total-sex age/housing vector selection for 135 DAs with original statuses, units, denominators and exact IDs.

Reuse evidence: used: no separateAtlasSource: BC Stats LHA estimates/projection, not these census vectors

Verification scope: local: yes catalogVectors: 7555 topics: 19 actualDARows: 135 ageVectors: 426 exactGeometryMatches: 135

PGMaps source paths:

- `vendor/bcdatamapper/datascrapers/census/output/variables/catalog.json`
- `vendor/bcdatamapper/datascrapers/census/output/variables/da/age.json`
- `vendor/bcdatamapper/datascrapers/census/output/variables/da/population_dwellings.json`
- `vendor/bcdatamapper/datascrapers/census/output/prince_george_da.geo.json`
- `vendor/bcdatamapper/datascrapers/census/build-census-variables.py`

### Census parent attributes and wider boundary coverage

**Geography and population · unused**

Grain: 2021 CT/CSD/CD source variable
Geometry: Province parent geometries already cover all wider source IDs
Vintage: 2021; source coverage extends beyond the city-only subset.
Source terms: Same census-feed rights review needed.

Map support:

- No direct compatible map was verified in this review.

Missing or required:

- appMethod: Census-level loader/asset packaging
- join: Use explicit province parent id; do not truncate wider source rows

Cannot infer:

- 13 CSDs are not 13 Prince George neighbourhoods.
- Outside-city tracts must not be substituted with city shapes.

Next connection: Filter province parent geometry by all 28 CT/13 CSD source IDs. This is a packaging/renderer gap, not missing source geometry.

Reuse evidence: used: no

Verification scope: local: yes attributeRows: CT: 28 attributeRows: CSD: 13 attributeRows: CD: 1 cityGeometryRows: CT: 23 cityGeometryRows: CSD: 1 cityGeometryRows: CD: 1 verifiedProvinceMatches: CT: 28 verifiedProvinceMatches: CSD: 13 cityMissingCTIDs: 9700100.00 cityMissingCTIDs: 9700101.00 cityMissingCTIDs: 9700102.00 cityMissingCTIDs: 9700103.01 cityMissingCTIDs: 9700103.02

PGMaps source paths:

- `vendor/bcdatamapper/datascrapers/census/output/variables/ct/population_dwellings.json`
- `vendor/bcdatamapper/datascrapers/census/output/variables/csd/population_dwellings.json`
- `vendor/bcdatamapper/datascrapers/census/output/variables/cd/population_dwellings.json`
- `vendor/bcdatamapper/datascrapers/census/output/prince_george_ct.geo.json`
- `vendor/bcdatamapper/datascrapers/census/output/prince_george_csd.geo.json`
- `vendor/bcdatamapper/datascrapers/census/output/bc-da-simplified/parents/ct.geojson`
- `vendor/bcdatamapper/datascrapers/census/output/bc-da-simplified/parents/csd.geojson`

### Prince George DB boundaries with empty compact vectors

**Geography and population · source-only**

Grain: DB record; inspected compact file has no numeric population/dwelling values
Geometry: 1011 DB polygons available
Vintage: 2021; raw legacy attributes need separate verification.
Source terms: Verify original source terms/universe.

Map support:

- No direct compatible map was verified in this review.

Missing or required:

- source: Authoritative DB counts/universe
- data: Seven compact vectors all null
- appMethod: Geometry may render; meaningful choropleth cannot use these null vectors
- join: Reconcile with distinct 52,387-block bridge universe

Cannot infer:

- Missing is not zero.
- DA demographics cannot become measured DB demographics.

Next connection: Use independently verified same-universe DB counts or label DB shapes as context only.

Reuse evidence: used: no

Verification scope: local: yes actualDBGeometry: 1011 compactDBRows: 1011 populationDwellingCells: 7077 nullCells: 7077

PGMaps source paths:

- `vendor/bcdatamapper/datascrapers/census/output/prince_george_db.geo.json`
- `vendor/bcdatamapper/datascrapers/census/output/prince_george_db_data.json`
- `vendor/bcdatamapper/datascrapers/census/output/variables/db/population_dwellings.json`

### Province-wide DB geometry chunk release

**Geography and population · unavailable**

Grain: BC 2021 DB
Geometry: Builder described; expected local geometry manifest/chunks absent
Vintage: 2021 source package; no successful local release inspected.
Source terms: Source archive/rights/deployment path need review.

Map support:

- No direct compatible map was verified in this review.

Missing or required:

- source: Original BCCDC db21 raw archive
- data: Boundary manifest/chunks absent
- appMethod: Viewport LOD/chunk deployment loader
- join: Validate boundary DBUID universe equals intended crosswalk

Cannot infer:

- 52,387 crosswalk records do not prove available DB polygons.

Next connection: Build/validate existing chunk pipeline after input availability and rights are confirmed; keep unavailable status visible meanwhile.

Reuse evidence: used: no

Verification scope: local: no expectedManifestExists: no expectedManifest: vendor/bcdatamapper/datascrapers/census/output/bc-db-chunks/manifest.json availableCrosswalkRows: 52387

PGMaps source paths:

- `vendor/bcdatamapper/datascrapers/census/README.md`
- `vendor/bcdatamapper/datascrapers/census/output/bc_db_population_chsa_crosswalk.json`

### 2016 Census DA→current-LHA socioeconomic derivation

**Geography and population · source-only**

Grain: Derived LHA rollup via DA representative point against current boundaries
Geometry: Existing Atlas LHA geometry can draw values, but spatial method is approximate
Vintage: 2016 Census/2015 income context; current LHA vintage unspecified.
Source terms: Statistics Canada inputs; preserve derivation and source terms.

Map support:

- No direct compatible map was verified in this review.

Missing or required:

- source: Official dated concordance preferable
- data: Metric-specific numerator/denominator, coverage and null review
- appMethod: Existing LHA renderer reusable after validated adapter
- join: Exact LHA code does not validate representative-point allocation

Cannot infer:

- Unweighted mean of DA percentages is not whole-LHA rate.
- Not a harmonized 2025 measure.
- Do not expose all alternative numeric columns blindly.

Next connection: Whitelist reviewed ratios from compatible numerators/denominators, with coverage threshold and derived-geography label; retain missing DA and original nulls.

Reuse evidence: used: no

Verification scope: local: yes actualLHARows: 89 sourceDARows: 7617 assignedDAFeatures: 7616 missingDAFeature: 1 allNullMetric: low_income_all_percent (89/89 null)

PGMaps source paths:

- `vendor/bcdatamapper/datascrapers/census/output/bcenviroscreen-census-lha/manifest.json`
- `vendor/bcdatamapper/datascrapers/census/output/bcenviroscreen-census-lha/2016/da-to-lha-crosswalk.json`
- `vendor/bcdatamapper/datascrapers/census/output/bcenviroscreen-census-lha/2016/lha-socioeconomic.json`

### Official 2021 population ecumene

**Geography and population · unused**

Grain: ECUID ecumene feature, not demographic row
Geometry: ECUID/ECUMENE polygon properties; no DAUID
Vintage: 2021; released 2022-02-09.
Source terms: Manifest: Open Government Licence – Canada.

Map support:

- No direct compatible map was verified in this review.

Missing or required:

- data: No embedded demographic values
- appMethod: Optional context mask/intersection display
- join: Cannot directly join DAUID; union overlapping ECUIDs for binary mask

Cannot infer:

- Ecumene is not participant, precise residence or catchment.
- Clipping display does not allocate whole-DA totals.

Next connection: Add optional inhabited-area background; preserve original DA IDs and totals in any derived display mask.

Reuse evidence: used: no

Verification scope: local: yes actualFeatures: 219 sourceOverlapPairs: 1 overlapAreaKm2: 4.467895

PGMaps source paths:

- `vendor/bcdatamapper/datascrapers/census/ecumene/README.md`
- `vendor/bcdatamapper/datascrapers/census/output/ecumene/statcan-bc-population-ecumene-2021.manifest.json`
- `vendor/bcdatamapper/datascrapers/census/output/ecumene/statcan-bc-population-ecumene-2021.geojson.gz`

### Experimental Prince George inhabited-area pilot

**Geography and population · source-only**

Grain: Alternative display geometry per 2021 DA
Geometry: DAUID polygons; same-vintage DA values can join
Vintage: 2018 GHSL input; 2021 DA/DB framework; inferred parameters and approximate smoothing.
Source terms: Verify GHSL/Census rights; evaluation baseline is not generation input.

Map support:

- No direct compatible map was verified in this review.

Missing or required:

- appMethod: Opt-in alternative DA display
- data: Experimental method/status label
- join: Same 135 DAUIDs; preserve canonical analytical geography

Cannot infer:

- Reported fidelity does not validate health effects or household locations.
- Not canonical census geography.

Next connection: Keep opt-in experimental label and original-DA comparison; do not replace default population geography.

Reuse evidence: used: no

Verification scope: local: yes actualDAFeatures: 135 status: experimental

PGMaps source paths:

- `vendor/bcdatamapper/datascrapers/census/ecumene/README.md`
- `vendor/bcdatamapper/datascrapers/census/output/ecumene/prince-george-city-ghsl-ecumene-pilot.geojson.gz`
- `vendor/bcdatamapper/datascrapers/census/output/ecumene/prince-george-city-ghsl-ecumene-pilot.evaluation.json`

### Statistics Canada North/South classification

**Geography and population · unused**

Grain: 2021 CSD classification
Geometry: Exact CSDUID join to separate 2021 geometry
Vintage: SGC2021 variant.
Source terms: Statistics Canada classification; carry attribution.

Map support:

- No direct compatible map was verified in this review.

Missing or required:

- appMethod: CSD categorical context
- join: Same-vintage CSDUID, not unchanged 2025 codes

Cannot infer:

- StatCan North is not Northern Health, NDIT or clinical catchment.

Next connection: Add a compare-definitions view keeping each Northern-region definition explicit.

Reuse evidence: used: no

Verification scope: local: yes classificationRows: 5161 matchingBCGeometry: 751 classificationContainsGeometry: no

PGMaps source paths:

- `vendor/bcdatamapper/datascrapers/census/README.md`
- `vendor/bcdatamapper/datascrapers/census/output/canada-csd/north-south.json`
- `vendor/bcdatamapper/datascrapers/census/output/canada-csd/provinces/59.geojson.gz`

### State of the North source pilots

**Geography and population · source-only**

Grain: Table-specific project/city-market/route/MRDT/ER/group/province observation
Geometry: Mines/housing candidate coordinates; vacancy explicit geography object
Vintage: Model refreshed 2026-04-30; actual observation dates remain distinct.
Source terms: README documents research reuse; source-specific redistribution still needs review.

Map support:

- No direct compatible map was verified in this review.

Missing or required:

- source: Primary feeds and table-specific grouping methodology
- data: Complete capped housing; validate mine locations/status; retain 370 unresolved Northern BC rows
- appMethod: ER/group/city/route adapter
- join: Table-specific reviewed aliases; combined group retained once

Cannot infer:

- Pilots do not reproduce DAX measures/dashboard filters.
- Nearest town is not jurisdiction; city point is not market coverage; route name is not line geometry.

Next connection: Start with vacancy ER/group records using explicit join objects; preserve provincial/unverified records and never duplicate a group value across member polygons.

Reuse evidence: used: no

Verification scope: local: yes pages: 25 referencedEntities: 41 pilotRows: mines: 25 pilotRows: IPPs: 850 pilotRows: capacity: 11 pilotRows: housing: 5000 pilotRows: ferries: 402 pilotRows: tourism: 687 pilotRows: vacancies: 866 housingCapped: yes vacancyStatuses: province: 126 vacancyStatuses: economicRegion: 247 vacancyStatuses: regionGroup: 123 vacancyStatuses: definitionUnverified: 370

PGMaps source paths:

- `vendor/bcdatamapper/datascrapers/bc/state-of-north/README.md`
- `vendor/bcdatamapper/datascrapers/bc/state-of-north/output/inventory.json`
- `vendor/bcdatamapper/datascrapers/bc/state-of-north/output/jobvacancy_bygeo.json.gz`
- `vendor/bcdatamapper/datascrapers/bc/boundaries/output/GeographyBridge/job-vacancies-linked.json.gz`

### State of the North population/age/income schema

**Geography and population · source-only**

Grain: Schema only; not scientific observations
Geometry: No quantitative join from schema alone
Vintage: Model 2026-04-30; reference periods and forecast status need actual rows.
Source terms: Research reuse noted; individual source terms need review.

Map support:

- No direct compatible map was verified in this review.

Missing or required:

- source: Bounded primary/dashboard extraction and methodology
- data: Actual observation rows absent in inspected pilots
- appMethod: Geography-specific adapter after row inspection
- join: ER/NDIT/CD/city/province IDs and definitions

Cannot infer:

- 41 model entities are not 41 independent scientific datasets.
- Inventory schemas cannot supply plotted values.

Next connection: Acquire one named population table with original age/year/geography/forecast fields before selecting geometry.

Reuse evidence: used: no atlasPopulationSource: Separate DATA-C051 BC Stats original

Verification scope: local: yes schemaAvailable: yes scientificPopulationRowsExtracted: no examples: PopulationEstimates_AgeGroup_Annually examples: PopulationHistorical_AgeGroup_Annually examples: PopulationForecastHistory_Annually_ByGEO examples: PopulationHistorical_ByGEO examples: Income examples: LowIncome

PGMaps source paths:

- `vendor/bcdatamapper/datascrapers/bc/state-of-north/output/inventory.json`
- `vendor/bcdatamapper/datascrapers/bc/boundaries/output/GeographyBridge/dashboard-registry.json`

### Manual Index Lab indicator catalogue

**Geography and population · source-only**

Grain: Indicator definition, not observation
Geometry: References candidate points/grids/DA/DB/postal/catchment sources
Vintage: Mixed latest/desired reference years; no common period.
Source terms: Mixed public/licensed/future sources; metadata is not a data licence.

Map support:

- No direct compatible map was verified in this review.

Missing or required:

- source: Verify each actual upstream acquisition
- data: Measures/denominators/coverage/statuses
- appMethod: Source-specific adapters, not unvalidated composite
- join: Each native geography separately

Cannot infer:

- 34 definitions do not prove 34 available datasets.
- Proxy/identity/exposure definitions do not diagnose individuals or establish governance.

Next connection: Whitelist actually acquired source-backed indicators; environmental availability is covered by the parallel environmental audit.

Reuse evidence: used: no

Verification scope: local: yes definitions: 34 embeddedObservations: no

PGMaps source paths:

- `vendor/bcdatamapper/datascrapers/manual/output/indicators/README.md`
- `vendor/bcdatamapper/datascrapers/manual/output/indicators/indicator-catalog.json`

### Native Land Digital territories/languages/treaties

**Geography and population · unused**

Grain: Overlapping educational context feature
Geometry: Global MultiPolygons; id/Slug/Name; longitude extents may cross 180°
Vintage: Snapshot 2026-06-17; per-feature effective date unestablished.
Source terms: Manifest explicitly requires confirming redistribution permission outside approved uses and links Data Sovereignty Treaty.

Map support:

- No direct compatible map was verified in this review.

Missing or required:

- rights: Confirm approved redistribution scope
- appMethod: Optional educational overlap context/evidence layer
- join: Overlap/name/nearest is not Nation-governance assignment

Cannot infer:

- Not authoritative title/territory, consent, study permission, catchment or acknowledgement authority.
- Language/treaty names are distinct from Nations.

Next connection: After documented reuse permission, expose educational context with source links; never allocate NHHR clinical/population values to territory polygons.

Reuse evidence: used: no

Verification scope: local: yes actualFeatures: territories: 2057 actualFeatures: languages: 1473 actualFeatures: treaties: 833 globalCoverage: yes

PGMaps source paths:

- `vendor/bcdatamapper/datascrapers/native-land/snapshot/manifest.json`
- `vendor/bcdatamapper/datascrapers/native-land/snapshot/territories.geojson`
- `vendor/bcdatamapper/datascrapers/native-land/snapshot/languages.geojson`
- `vendor/bcdatamapper/datascrapers/native-land/snapshot/treaties.geojson`
- `src/pages/dev-acknowledgement/data.ts`

### FPCC language/community/place context

**Geography and population · unused**

Grain: Community-contributed language area, community reference or named place
Geometry: Language polygons/community points/mixed place geometry
Vintage: Fetched 2026-06-18; not population/service-area vintage.
Source terms: Indigenous manifest marks FPCC permission_required and requests permission before automation; FPCC snapshot has no explicit redistribution licence.

Map support:

- No direct compatible map was verified in this review.

Missing or required:

- rights: Resolve documented permission before new automation/public redistribution
- data: Only approved public context; exclude arts/grant/person/contact records
- appMethod: Mixed-geometry context renderer
- join: Names/language areas do not define Nation governance

Cannot infer:

- Language areas do not establish Nation territory/citizenship/consent.
- Community reference is not catchment or verified physical service location.

Next connection: Record approved FPCC public reuse, then display only permitted language/community/place context with separate legend and publisher links.

Reuse evidence: used: no

Verification scope: local: yes actualLanguagePolygons: 39 actualCommunityPoints: 205 actualPlaceFeatures: 419 placeGeometryTypes: Point: 403 placeGeometryTypes: LineString: 14 placeGeometryTypes: Polygon: 2 manifestSearchPlaceRecords: 420

PGMaps source paths:

- `vendor/bcdatamapper/datascrapers/fpcc/output/manifest.json`
- `vendor/bcdatamapper/datascrapers/fpcc/output/language-geo.geojson`
- `vendor/bcdatamapper/datascrapers/fpcc/output/community-geo.geojson`
- `vendor/bcdatamapper/datascrapers/fpcc/output/placename-geo.geojson`
- `vendor/bcdatamapper/datascrapers/bc/indigenous/snapshot/manifest.json`

### Official treaty/reserve/community reference layers

**Geography and population · unused**

Grain: Legal/admin feature or approximate community/office reference
Geometry: Native legal IDs, AREA_TYPE/LAND_TYPE/TREATY/EFFECTIVE_DATE, overlapping polygons and points
Vintage: Feature effective dates vary; no single date in manifest.
Source terms: BC/Canada publisher-specific terms; no blanket licence inferred.

Map support:

- No direct compatible map was verified in this review.

Missing or required:

- source: Review individual licence/effective date
- data: Strip address/contact fields from optional context release
- appMethod: Separate legal/context layer
- join: Native feature IDs and legal types; no automatic population allocation

Cannot infer:

- Reserve is not traditional territory.
- Nearest office is not territory/acknowledgement authority.
- Treaty geometry alone is not research approval.

Next connection: Add minimal public legal/context overlays with exact types and links; keep quantitative observations at source geography.

Reuse evidence: used: no

Verification scope: local: yes actualTreatyAreas: 69 actualTreatyLands: 148 actualReserveBandNameFeatures: 1687 actualBCCommunityPoints: 208 nationalCommunityManifest: 638 reserveAliasFiles: Two 1687-feature reserve files; not two independent populations

PGMaps source paths:

- `vendor/bcdatamapper/datascrapers/bc/indigenous/snapshot/manifest.json`
- `vendor/bcdatamapper/datascrapers/bc/indigenous/snapshot/first_nations_treaty_areas.geojson`
- `vendor/bcdatamapper/datascrapers/bc/indigenous/snapshot/first_nations_treaty_lands.geojson`
- `vendor/bcdatamapper/datascrapers/bc/indigenous/snapshot/cad_pip_layer_382_indian_reserves_band_names.geojson`
- `vendor/bcdatamapper/datascrapers/bc/indigenous/snapshot/first_nation_community_locations.geojson`

### Canada Lands Survey System legal distribution areas

**Geography and population · unused**

Grain: Legal distribution area, with distinct reserve/settlement types
Geometry: Polygon/MultiPolygon keyed adminAreaId/representationRole
Vintage: No single effective date in inspected manifest.
Source terms: Manifest: Open Government Licence – Canada.

Map support:

- No direct compatible map was verified in this review.

Missing or required:

- appMethod: Type-preserving context adapter
- data: No NHHR measures at CLSS grain
- join: Exact legal feature IDs; no Nation/health-area equivalence

Cannot infer:

- Do not collapse reserves, Inuit Owned Lands, Yukon settlement lands and Tlicho Lands into one category.
- Not all traditional territories or governance relationships.

Next connection: Use separately labelled legal context only; retain distribution types and no quantitative allocation.

Reuse evidence: used: no

Verification scope: local: yes actualFeatures: 3372

PGMaps source paths:

- `vendor/bcdatamapper/datascrapers/canada/admin-geographies/README.md`
- `vendor/bcdatamapper/datascrapers/canada/admin-geographies/output/overview/indigenous-lands-clss.geojson`
- `vendor/bcdatamapper/datascrapers/canada/admin-geographies/output/manifest.json`

### CAD/PIP consultation-area geometry

**Geography and population · unavailable**

Grain: Manual consultation report context
Geometry: No downloadable consultation-area polygons inspected
Vintage: Catalogue modified 2025-06-10; no geometry release.
Source terms: Access Only; does not authorize harvesting report contacts.

Map support:

- No direct compatible map was verified in this review.

Missing or required:

- source: Authorized workflow/data access needed
- data: Actual consultation geometry unavailable
- appMethod: Linkout, not fabricated layer
- join: Never relabel layer382 reserves as consultation areas

Cannot infer:

- Preliminary reports are not final consultation obligations or research consent.
- Native Land overlap/nearest community is not substitute.

Next connection: Keep explicit unavailable status; link official workflow where relevant, without scraping contacts or manufacturing territories.

Reuse evidence: used: no

Verification scope: local: yes localGeometry: no catalogueAccess: Access Only availableWorkflow: Interactive preliminary report layer382: Indian reserve/band-name geography, not consultation area

PGMaps source paths:

- `vendor/bcdatamapper/datascrapers/bc/indigenous/snapshot/manifest.json`
- `src/pages/dev-acknowledgement/data.ts`

### Curated acknowledgement relationships

**Geography and population · source-only**

Grain: Reviewed relationship fact for named institution/place
Geometry: No authoritative territorial geometry; broad matchRegion is address guard
Vintage: Curated June–September 2026; evidence dates vary.
Source terms: Graph notes require wording review before publication; linked source terms remain distinct.

Map support:

- No direct compatible map was verified in this review.

Missing or required:

- source: Local relationship/wording review
- appMethod: Evidence card rather than choropleth
- join: Exact named place/institution context only

Cannot infer:

- 85 records are not complete BC Nation coverage.
- Generated wording is not research-governance approval.

Next connection: Use reviewed source links for a named-site context, preserving Nation/language/territory distinctions.

Reuse evidence: used: no

Verification scope: local: yes nationRegistryRecords: 85 notBoundaryDataset: yes

PGMaps source paths:

- `vendor/bcdatamapper/datascrapers/manual/output/acknowledgement/nation-registry.json`
- `vendor/bcdatamapper/datascrapers/manual/output/acknowledgement/relationship-graph.json`
- `vendor/bcdatamapper/datascrapers/manual/output/acknowledgement/fpcc-language-map.json`

### Cached food/water geocoding candidates

**Geography and population · source-only**

Grain: Source-record geocoding result; repeated measurements may share place
Geometry: Candidate coordinates with precision/quality/fault/expected-city fields
Vintage: Per-record geocoding dates and source periods vary.
Source terms: Google-derived outputs require provider-specific reuse review; not open rights by existence.

Map support:

- No direct compatible map was verified in this review.

Missing or required:

- source: Official identity/address and provider-rights verification
- data: Retain quality and partial matches; collapse reviewed aliases, not equal coordinates
- appMethod: Review queue→accepted point registry
- join: Exact identity/address evidence; no fuzzy automatic join

Cannot infer:

- 3592 geocoded records are not3592 verified physical sites.
- City centroid/partial result is not boarding door or clinic.

Next connection: Reuse only as candidate evidence; independently verify physical locations, retaining null map keys and unresolved reasons.

Reuse evidence: used: no

Verification scope: local: yes actualRecords: 3592 withCoordinates: 3592 partialMatches: 1031 manualOverrides: 5

PGMaps source paths:

- `vendor/bcdatamapper/datascrapers/food-health/output/geocoding/geocoded_locations.json`
- `vendor/bcdatamapper/datascrapers/food-health/output/geocoding/geocode_location_overrides.json`

### BC Address Geocoder review method

**Geography and population · partial**

Grain: Address-query candidate or explicitly dropped map point
Geometry: WGS84 point; arbitrary drop separately labelled
Vintage: Returned base-data/search timestamps, not historical identity verification.
Source terms: Official provider terms/attribution; do not publish private queries.

Map support:

- No direct compatible map was verified in this review.

Missing or required:

- source: Verify public source identity/address
- data: maxResults=1 is not automatic exact match
- appMethod: Existing Atlas registry accepts reviewed points
- join: Exact evidence crosswalk; distinguish locality vs physical address

Cannot infer:

- Score is not facility/boarding-door/historical-site proof.
- Dropped point is not verified geocode.

Next connection: Retain candidate faults/precision, verify identity independently, then export only reviewed public location codes and evidence.

Reuse evidence: used: Some Atlas travel references independently use BC Geocoder; PGMaps UI module itself is not imported evidence: public/data/nhhr/travel-network-provenance.json evidence: public/data/nhhr/locations-travel-stops.README.md

Verification scope: local: yes localMethod: yes fields: score fields: matchPrecision fields: precisionPoints fields: faults fields: baseDataDate fields: searchTimestamp notScientificDataset: yes

PGMaps source paths:

- `src/pages/dev-acknowledgement/geocode.ts`
- `vendor/bcdatamapper/datascrapers/manual/output/acknowledgement/relationship-graph.json`

### BC Stats Local Area Economic Profiles

**Geography and population · unused**

Grain: Historical modelled area×period measure; RD and EDA grains distinct
Geometry: 29 CD-keyed summaries reuse existing2021CD shapes; EDAs tabular pending geography review
Vintage: 2025 release, reference2010/2015/2020; employment relates to following census year; nominal money.
Source terms: README: Open Government Licence – BC; census boundaries retain Statistics Canada attribution.

Map support:

- No direct compatible map was verified in this review.

Missing or required:

- source: Resolve duplicated cleaned inputs before model reconstruction
- data: Preserve F/x/-/blank statuses and metric definitions
- appMethod: CD adapter can map published RD outputs
- join: EDA concordance conflict: Moricetown1 5949830 vs2021CSD5949817; no silent replacement

Cannot infer:

- Basic/external-income dependency % is not job share or all household income.
- Relative forest vulnerability is not loss probability; no mixed RD/EDA ranking.
- Published-table consistency does not reproduce model.

Next connection: Expose reviewed published RD indicators with native CD IDs and historical units; retain EDAs as table until concordance dispute and geography are resolved.

Reuse evidence: used: no

Verification scope: local: yes publishedRecords: 399 areaComposition: 103 EDAs,29 RDs,BC ×3 periods mappedCDIDs: 29 cleanedInputNumericRows: 425 identical2010And2015InputRows: 425 usesCleanedCensusInputs: no

PGMaps source paths:

- `vendor/bcdatamapper/datascrapers/bc/laep/README.md`
- `vendor/bcdatamapper/datascrapers/bc/laep/output/audit.json`
- `vendor/bcdatamapper/datascrapers/bc/laep/output/area-indicators.json.gz`
- `vendor/bcdatamapper/datascrapers/bc/laep/output/regional-districts.json`
- `vendor/bcdatamapper/datascrapers/bc/laep/source/manifest.json`

### Air monitoring stations and cached readings

**Environment and other context · unused**

Grain: Station/sensor metadata and cached pollutant readings; multiple networks are not interchangeable measurements.
Geometry: Latitude/longitude points; combined catalogue has 3,712 records across 12 networks.
Vintage: Root manifest generated 18 October 2025; reading timestamps and site status must be taken from each source record.
Source terms: BC, EPA, research-network and community-sensor terms differ. DatasetInfo describes source-dependent terms; no unified redistribution licence verified.

Map support:

- A bounded station-presence point layer is technically possible from supplied coordinates.
- Cached readings can accompany a station only with original parameter, unit, method and observation time.

Missing or required:

- Review network-specific units, calibration and missing markers before combining readings.
- Generate reviewed station IDs/location metadata and a bounded point release.
- Add native observation-time controls, rather than treating snapshot date as measurement date.

Cannot infer:

- Monitoring presence is not exposure, population coverage or current air quality.
- Nearest-monitor distance is not a valid concentration interpolation.
- Station and sensor-network duplicates cannot be added as independent measurements.

Next connection: Start with BC regulatory station metadata around Northern communities, preserving network/status/time and a direct source link.

Reuse evidence: No current NHHR use established.

Verification scope: Root catalogue and station CSV/JSON schemas/counts inspected; reading series and all coordinates were not validated. No mentor/contact fields copied.

PGMaps source paths:

- `public/data/manifest.json`
- `public/data/monitors/all.json`
- `public/data/monitors.csv`
- `public/data/spartan.csv`
- `public/data/ascent-sites.json`
- `public/data/bc/bc_air_monitoring_stations.csv`
- `public/data/epa`

### Dated PM2.5 forecast bands and smoke snapshots

**Environment and other context · unused**

Grain: Forecast model run/valid time and displayed concentration bands; satellite smoke polygons are a separate product.
Geometry: Native PM2.5 band polygons plus raster tiles; visible smoke: 126 polygons, fallback modelled smoke: 10 multipolygons.
Vintage: Raster manifest pins 23 June 2026 ECCC RAQDPS.SFC_PM2.5 run; app-owned smoke files have feature-level times and no enclosing provenance manifest.
Source terms: ECCC/NOAA and fallback-source terms require original attribution; app-owned fallback provenance is not established by its filename.

Map support:

- Native vector band geometry can be displayed as a dated categorical model overlay after a source review.

Missing or required:

- NHHR needs arbitrary polygon/grid overlay support and band legends, separate from its health-area joins.
- Keep model run, valid time, concentration units and forecast classification together.
- Recover original numerical grids for any numerical zonal concentration calculation; available polygons expose bands (pm25_min/pm25_max), not full cell measurements.
- Raster PM2.5 tiles need an explicit raster analysis adapter; current Atlas maps are vector only.

Cannot infer:

- Forecast bands are not observed personal exposure, current readings or a measured health outcome.
- Smoke density/class is not equivalent to surface PM2.5.
- Band midpoints do not establish a defensible regional mean.

Next connection: Use one pinned forecast as an explicitly modelled illustration alongside monitoring points; do not derive an NHHR exposure metric from colour bands.

Reuse evidence: No current NHHR use established.

Verification scope: Tile manifest, smoke feature schemas/counts and one compressed native-vector feature inspected; forecast fields/cells and fallback provenance not fully audited.

PGMaps source paths:

- `public/data/aqmap/modelled-pm25-raster-tiles/manifest.json`
- `public/data/aqmap/modelled-pm25-native-vector.geojson.gz`
- `public/data/smoke/visible.json`
- `public/data/smoke/modelled.json`
- `scripts/sync-bcdatamapper-data.mjs`

### Satellite and atmospheric-grid demonstration metadata

**Environment and other context · source-only**

Grain: Product descriptors, coverage footprints and four listed H3 cells; not a concentration time series.
Geometry: Illustrative coverage rectangles/multipolygons and H3 identifiers.
Vintage: Product descriptors say 2000/2017/2018–present, but contain no dated measurement rows.
Source terms: NASA/ESA/NOAA product terms remain to be checked; metadata does not authorize scientific-data redistribution.

Map support:

- Coverage metadata can be shown as a product catalogue, with a clear metadata label.

Missing or required:

- Acquire actual product granules/values, QA flags, units and times.
- Add native raster/H3 decoding and true geometry, cloud/quality masking and reviewed aggregation.

Cannot infer:

- Coverage rectangles are not NO2, aerosol optical depth or PM2.5 measurements.
- The GEOS-CF entry explicitly describes demonstration metadata.

Next connection: Treat these entries as source links until an actual scientific extract is obtained and validated.

Reuse evidence: No current NHHR use established.

Verification scope: Both small metadata files inspected in full; no remotely hosted granules fetched.

PGMaps source paths:

- `public/data/grids/tropomi.json`
- `public/data/satellite/coverage.json`

### CANUE environmental exposure and neighbourhood extracts

**Environment and other context · source-only**

Grain: Dataset/variable/year; postal-derived extracts and a referenced 1 km BC PMTiles grid.
Geometry: Referenced PMTiles grid and generated boundary aggregates; public/data/canue is absent in this checkout.
Vintage: Years are variable-specific; the source catalogue URL alone does not establish local temporal coverage.
Source terms: CANUE research-data terms; original postal data and derivative redistribution require explicit terms review. The sync excludes compact CANUE postal aggregate rebuild inputs.

Map support:

- PGMaps already has PMTiles selection and boundary-aggregate adapters, but the remote catalogue/tiles were not verified in this audit.

Missing or required:

- Acquire a specific permitted source variable/year with source methods and exact bounds.
- NHHR needs PMTiles/native-grid or prevalidated LHA/HSDA aggregate adapters.
- Retain centroid/postal aggregation method, valid-cell coverage and weighting; do not substitute area/population means.

Cannot infer:

- A postal/grid proxy is not personal exposure or a health-area outcome.
- A PMTiles centroid aggregate is not automatically population weighted.
- No scientific rows are embedded in the URL/catalogue declaration.

Next connection: Choose one exposure metric and year, verify its permitted source and aggregation, then release a small source-backed Northern LHA table.

Reuse evidence: No current NHHR use established.

Verification scope: Adapter interfaces, supported boundary levels and source holdings metadata inspected; remote catalogue, tiles and raw postal records uninspected.

PGMaps source paths:

- `src/maps/pgdata/canueV2.ts`
- `src/maps/pgdata/canue/constants.ts`
- `vendor/bcdatamapper/datascrapers/canue`
- `public/data/climate-vulnerability/holdings-evidence.json`

### BC EnviroScreen research reconstruction

**Environment and other context · unused**

Grain: 89 LHA rows, 21 component indicators, a province-wide comparison universe and derived composite scores.
Geometry: Exact lha_code joins: all 89 released codes exist in the Atlas native LHA index.
Vintage: Pinned 3 September 2026 release; component observation years differ. Latest status: hybrid-reconstruction.
Source terms: Research reconstruction, explicitly not an official provincial or paper-author product. Underlying CANUE/health/census/environmental source terms differ.

Map support:

- Geometry join is ready using existing LHA polygons; a bounded 89-row table is possible.

Missing or required:

- Nine benchmark-derived gap indicators need prominent per-indicator provenance and source-equivalence flags.
- Validate definitions, direction, normalization, missing-data treatment and intended interpretation before showing an overall score.
- Keep source years and the all-89-LHA comparison universe under Northern filters.

Cannot infer:

- A composite reconstruction is not a validated health-risk probability or NHHR impact.
- Underlying health/environment relationships do not establish causality.
- Exact geometry coverage does not establish source equivalence.

Next connection: Begin with one independently sourced environmental component and its year/unit/provenance; avoid presenting the hybrid overall score as an official index.

Reuse evidence: No current NHHR use established.

Verification scope: Pinned release manifest, score/indicator schemas, provenance and validation summaries inspected; all 89 code joins independently checked against Atlas boundaryIndex. Underlying primitive data and score equations were not reproduced.

PGMaps source paths:

- `public/data/environmental-burden/bc-enviro-screen/release/latest.json`
- `public/data/environmental-burden/bc-enviro-screen/release/v2026-09-03-231d562533cb/manifest.json`
- `public/data/environmental-burden/bc-enviro-screen/release/v2026-09-03-231d562533cb/lha-scores.json`
- `public/data/environmental-burden/bc-enviro-screen/release/v2026-09-03-231d562533cb/lha-indicators.json`
- `public/data/environmental-burden/bc-enviro-screen/release/v2026-09-03-231d562533cb/source-provenance.json`
- `public/data/environmental-burden/bc-enviro-screen/release/v2026-09-03-231d562533cb/validation-summary.json`

### MHCCA climate-vulnerability FSA inputs

**Environment and other context · unused**

Grain: 193 author-prepared FSA records, 76 downloaded variables versus 80 catalogue variables; mixed aggregated/averaged/imputed inputs.
Geometry: 191 matches to 2021 census FSA geometry; V7X and V7Y remain unlocated.
Vintage: Checked 22 September 2026; variable years differ and include historical averages and future temperature-change fields.
Source terms: Report, author-prepared dataset, CANUE and other source terms need separate review; no blanket open licence verified.

Map support:

- Individual source inputs can be mapped at native FSA grain with appropriate definitions.

Missing or required:

- Add native FSA geometry and exact code registration to NHHR; FSA codes are not LHA codes.
- Original boundary edition and selected-variable ambiguities remain unresolved.
- Final CVI is explicitly not reproduced: standardized PCA fails to match the reported model.
- Do not aggregate FSA rates/scores to LHA without valid denominators/methods.

Cannot infer:

- The supplied inputs are not primitive observations.
- Input magnitude colours are not a verified vulnerability score or universal risk direction.
- No final reproduced CVI score is available.

Next connection: Offer a labelled diagnostic FSA input browser after rights review; keep the unreproduced composite score out of NHHR maps.

Reuse evidence: No current NHHR use established.

Verification scope: Manifest, variable headers, input cautions and reproducibility status inspected; primitive source values and PCA model not independently reconstructed.

PGMaps source paths:

- `public/data/climate-vulnerability/manifest.json`
- `public/data/climate-vulnerability/inputs.json`
- `public/data/climate-vulnerability/mhcca-fsa-inputs.csv`
- `public/data/climate-vulnerability/reproducibility.json`
- `public/data/climate-vulnerability/holdings-evidence.json`

### Pinned BC climate projection story sources

**Environment and other context · source-only**

Grain: Indicator × 30-year climatology × SSP5-8.5 scenario × supplied ensemble percentile; hosted native climate cells.
Geometry: Referenced BC-intersecting vector cells from pinned R2 release 01b4b7e982f9b2e6d042; no local main climate scientific rows inspected.
Vintage: Projects updated 6 September 2026; report comparisons 1971–2000, 2041–2070 and 2071–2100.
Source terms: CanDCS-U6/ClimateData.ca/PAVICS and archived ClimateBC source terms apply; archive ClimateBC version is not independently established.

Map support:

- Existing PGMaps stories demonstrate source-cell comparisons; scientific manifest/tiles remain remote and were not fetched here.

Missing or required:

- Acquire and hash-lock the exact manifest, variable/unit, periods, scenario and percentile.
- Add native cell/polygon streaming and interval/scenario controls, or validate a bounded health-area aggregate.
- Population-weighted report summaries require original population/grid weighting and cannot be substituted with a cell mean.

Cannot infer:

- A 30-year climatology is not a forecast for an individual year.
- SSP5-8.5 has no assigned probability here; P10/P50/P90 are not three emissions scenarios.
- Display bins do not classify health risk or hospital-building design temperatures.

Next connection: Adapt one clearly labelled heat indicator and baseline/future comparison, keeping scenario, ensemble spread and whole cell footprints explicit.

Reuse evidence: No current NHHR use established.

Verification scope: Two source packages and their sourceNote/details/layer identities inspected; scientific remote release and all other climate story packages remain catalogue-only.

PGMaps source paths:

- `public/data/projects/northern-health-climate-resilience.json`
- `public/data/projects/bc-climate-mean-temperature.json`
- `scripts/generate-climate-stories.mjs`

### EchoScreen Northern climate vector output

**Environment and other context · source-only**

Grain: Four converted layers: hot-days-past, hot-days-future, summer-precip-change and precip-change.
Geometry: Vendor output has vector assets with 9,031–12,779 features per layer; public/data/echoscreen-climate is absent despite a configured sync mapping.
Vintage: Source is NH_climate_projection_maps.gpkg; temporal/scenario/units need the individual layer manifests and original project.
Source terms: User-supplied GPKG/project and upstream climate terms need review; conversion alone establishes no reuse licence.

Map support:

- Vendor conversion exists, but it is not a deployed NHHR data layer.

Missing or required:

- Review original GPKG layer units, period/scenario and nodata.
- Confirm omitted/merged geometry semantics and complete conversion before syncing or releasing.
- Add native grid/polygon support and a source-specific legend.

Cannot infer:

- Converted geometry counts are not valid measurements, health risk or observed patients.
- A missing public deploy directory is not evidence that the source data never existed.

Next connection: Review one layer manifest and original source definition before generating a bounded explicit modelled dataset.

Reuse evidence: No current NHHR use established.

Verification scope: Vendor manifest and sync mapping inspected; original 82 MB GPKG and scientific layer rows uninspected.

PGMaps source paths:

- `vendor/bcdatamapper/datascrapers/climate/echoscreen/output/manifest.json`
- `public/data/projects/echoscreen-climate-health.json`
- `scripts/sync-bcdatamapper-data.mjs`

### Canadian fire-danger categorical snapshots

**Environment and other context · unused**

Grain: Captured CWFIS public:fdr_current_shp fire-danger category geometry.
Geometry: Multipolygon category field g and 39 generated vector tiles.
Vintage: Captured 23 June 2026, not a live current fire-danger feed.
Source terms: CWFIS/source terms and class legend require original attribution/verification.

Map support:

- Dated categorical polygons/tiles can be drawn with the original class legend.

Missing or required:

- Native arbitrary-polygon or vector-tile overlay adapter, snapshot date and class decoding.
- A live-warning view would need an explicit refresh/freshness pipeline.

Cannot infer:

- Fire danger is not an observed fire perimeter, evacuation order, ignition prediction or individual health risk.

Next connection: Use a clearly dated contextual fire-danger overlay beside Northern sites; retain missing classes and official source links.

Reuse evidence: No current NHHR use established.

Verification scope: Manifest and one compressed feature schema inspected; current source feed/classes not refreshed.

PGMaps source paths:

- `public/data/aqmap/fire-danger-vector-tiles/manifest.json`
- `public/data/aqmap/fire-danger-vector.geojson.gz`
- `scripts/build-aqmap-fire-danger-vector.mjs`

### Prince George planning hazard and evacuation layers

**Environment and other context · unused**

Grain: Municipal planning polygons and incident/zone metadata, separate datasets.
Geometry: 400 OCP wildfire polygons, 8 OCP flood polygons and 9 evacuation-zone features.
Vintage: OCP label 2025; incident fields have dates, but capture/effective completeness was not established.
Source terms: City of Prince George open-data terms; exact layer attribution/licence and incident redistribution terms need confirmation.

Map support:

- Native municipal context geometries are locally available.

Missing or required:

- Generic categorical polygon overlay support and per-layer effective dates.
- Retain official class/incident status; many OCP feature schemas expose IDs without a hazard severity field.
- Review geometry coverage and official layer definitions before facility intersection.

Cannot infer:

- Planning polygons are not observed burn/flood extents or probabilities.
- Cached evacuation features do not establish a current order, safe route or available shelter.

Next connection: Compare verified current facility locations with a dated planning layer as context only, retaining municipal extent and official definition.

Reuse evidence: No current NHHR use established.

Verification scope: All three local GeoJSON schemas, feature counts and geometry types inspected; only metadata fields, not personnel values, retained.

PGMaps source paths:

- `public/data/citypg/ocp_2025_wildfire_development.geojson`
- `public/data/citypg/ocp_2025_flood_hazard.geojson`
- `public/data/citypg/evacuation_zones.geojson`

### BC River Forecast Centre advisory archive

**Environment and other context · unused**

Grain: 707 deduplicated discovered advisory documents; documents can have several levels/areas.
Geometry: Historical advisory polygons are not supplied; matchedBoundaries are inferred from bulletin area names.
Vintage: Discovered documents span 19 October 2010–15 May 2026; capture 16 May 2026, with unknown dates and incomplete historical discovery.
Source terms: BC RFC/source-document terms apply; original official bulletin links should remain available.

Map support:

- A source timeline/table and explicitly inferred area-context map are possible.

Missing or required:

- Review each bulletin-name to canonical watershed/basin/region match and keep ambiguity.
- Add source-native boundary support; these names cannot directly join LHA codes.
- Do not treat the archive as complete across years or level counts as mutually exclusive events.

Cannot infer:

- Matched region context is not a flooded footprint.
- Advisory frequency is not flood incidence, injury burden or a stable historical trend.
- The snapshot does not establish current warnings.

Next connection: Use a small dated bulletin/region explorer with original URLs and clear inferred-context labels, not a flood-extent choropleth.

Reuse evidence: No current NHHR use established.

Verification scope: Manifest discovery/completeness/era statistics inspected; bulletin text and all inferred boundary matches unreviewed.

PGMaps source paths:

- `public/data/flood/manifest.json`
- `public/data/flood/advisories.json`
- `public/data/flood/discovery.json`

### Historical BC drought basin levels

**Environment and other context · unused**

Grain: Source basin/date drought levels, plus canonical 2025-geometry time-series representation.
Geometry: 40 canonical basins; manifest declares 9,105 canonical records and 11 yearly GeoJSON files for 2015–2025.
Vintage: 2015–2025 historical source windows; stable display geometry is 2025.
Source terms: BC Government/ArcGIS source terms; OGL attribution and original service identities are in metadata.

Map support:

- Source-native basin/date ordinal levels can be mapped; canonical basin IDs exist.

Missing or required:

- Add basin geometry registration and an as-of/date selector.
- Review historical basin changes before using the 2025 geometry for earlier periods.
- Manifest lists 562 features versus expected 563 for 2016; disclose/check that gap before completeness claims.

Cannot infer:

- Ordinal drought levels cannot be averaged or summed as a continuous severity measure.
- A basin level does not establish household water availability, clinical demand or NHHR benefit.

Next connection: Release one source date/window with basin IDs and original level classes; retain historical-geometry and missing-record caveats.

Reuse evidence: No current NHHR use established.

Verification scope: Yearly/canonical manifest inspected; all time-series rows and geometry transformations not validated.

PGMaps source paths:

- `public/data/drought/manifest.json`
- `public/data/drought/basins.geojson`
- `public/data/drought/timeseries.json`

### BC snow survey stations and observations

**Environment and other context · unused**

Grain: Station × survey date with snow depth, water equivalent and survey code; active/inactive station catalogue.
Geometry: 390 manual plus 152 automated station points; 23 source basins; 540 station-basin convenience assignments.
Vintage: Manifest describes 461 current manual observations and 60,604 archive rows; exact survey dates govern interpretation. Automated live observations remain external links.
Source terms: Declared Open Government Licence–BC; preserve individual source citations and measurement units.

Map support:

- Station points and a bounded selected survey series can be shown without health-area allocation.

Missing or required:

- Define source-specific units/quality codes and observation-time filters.
- Review point-in-basin boundary assignments and preserve unmatched stations.
- Percent-normal is absent; derive it only with an explicit validated climatological baseline.

Cannot infer:

- Snow water equivalent is not a flood forecast or household drinking-water quality.
- Inactive station inventory is not current monitoring coverage.

Next connection: Start with Northern station map plus source water-equivalent time series and source-missing markers.

Reuse evidence: No current NHHR use established.

Verification scope: Manifest counts/limits and current CSV header sampled; full archive values and basin assignments unvalidated.

PGMaps source paths:

- `public/data/snow-survey/manifest.json`
- `public/data/snow-survey/stations.geojson`
- `public/data/snow-survey/manual-current.csv`
- `public/data/snow-survey/manual-archive.csv.gz`
- `public/data/boundaries/BCSnowSurvey/snow_survey_admin_basins.geojson`

### UNBC river/water-temperature reference snapshots

**Environment and other context · source-only**

Grain: Station/date water and optional Daymet air temperature; source repository is an external configured dependency.
Geometry: Referenced station coordinates and date series; no corresponding source files in PGMaps/public/data.
Vintage: Source config has last_updated/daymet_last_year fields; actual dates/counts were not fetched in this audit.
Source terms: UNBC reference-repository and sensor/provider licences need direct source verification.

Map support:

- PGMaps has station normalization and comparison code, but this audit establishes no loaded scientific station records.

Missing or required:

- Acquire the actual stations.json/config.json and selected observation series.
- Keep missing days and the existing 75% month/season coverage rule.
- Add reviewed station points and a date chart rather than assigning station measurements to entire LHAs.

Cannot infer:

- River temperature is not drinking-water potability, clinical risk or a measurement of nearby residents.

Next connection: Verify one Northern station catalogue and series through the reference source before releasing a small dated dataset.

Reuse evidence: No current NHHR use established.

Verification scope: Loader/schema/coverage calculation source inspected; external/local reference repository data not inspected.

PGMaps source paths:

- `src/pages/dev-water-temperature/useWaterTemperature.ts`
- `src/pages/dev-water-temperature/data.ts`
- `src/pages/DevWaterTemperature.tsx`
- `vite.config.ts`

### Northern-region wildlife road-collision records (WARS)

**Environment and other context · unused**

Grain: Wildlife accident record and reported animal quantity; service areas 18–28 with coordinates.
Geometry: Point archive: 43,801 records and 46,759 reported animals; multiple animals can occur in one record.
Vintage: 1978–2025, captured 18 July 2026; not a complete contemporary hazard feed.
Source terms: Manifest names WARS Data Use Licence Agreement 2026 and all-rights-reserved provincial citation; reuse is not covered by a generic OGL assumption.

Map support:

- A permitted bounded annual/species/service-area aggregate or dated point subset is technically possible.

Missing or required:

- Review WARS agreement before redistribution.
- Use true event coordinates/quality, time and distinct record IDs; preserve animal quantity as a different measure.
- Road-risk rates need exposure/vehicle-kilometre denominators and a reviewed road-segment matching method.

Cannot infer:

- These are wildlife collisions, not human injury cases, water-quality data or clinic admissions.
- Counts do not establish per-driver risk, current unsafe roads or a passenger travel burden.

Next connection: After rights review, summarize Northern collisions by year/species at original service-area grain; only map exact source points or reviewed road-bin aggregates.

Reuse evidence: No current NHHR use established.

Verification scope: Manifest and compressed CSV header inspected; original collisions/coordinate accuracy/record deduplication not fully audited.

PGMaps source paths:

- `public/data/wars/manifest.json`
- `public/data/wars/northern_region_wildlife_accidents.csv.gz`
- `public/data/wars/northern_region_wildlife_accidents.geojson.gz`
- `vendor/bcdatamapper/datascrapers/bc/wars/output`

### National LTE/5G and broadcasting network snapshots

**Environment and other context · unused**

Grain: CRTC reported coverage technology/year, road-coverage segments and separate broadcast stations/contours.
Geometry: Local dissolved LTE/5G multipart polygons (two combined features); 157,175 with-coverage road lines and 6,527 without; other broadcast layers are separate.
Vintage: Preferred combined overlay is year-end 2024; manifest captured 23 June 2026. Historical packages list LTE 2013–2024 and 5G 2020–2024.
Source terms: Government of Canada terms are declared for CRTC/NRCan; carrier/ISED terms are source-dependent.

Map support:

- Dated native LTE/5G coverage polygon context is already locally available and is a practical addition.

Missing or required:

- NHHR needs native polygon/line context overlays and compressed GeoJSON decoding, not a forced health-area-value join.
- Define technology, year and overlap rules; review hospital-point intersection before labelling coverage.
- A service-quality/telehealth measure needs observed reliability, speeds, access and service data absent here.

Cannot infer:

- Reported coverage is not indoor signal quality, actual speed, outage history or ability to obtain telehealth.
- Broadcast contours/stations are not mobile broadband coverage.

Next connection: Clip a permitted YE2024 LTE/5G context overlay to Northern BC and inspect verified facility points, with technology/year and reported-coverage wording.

Reuse evidence: No current NHHR use established.

Verification scope: Manifest/local file presence and layer counts inspected; the very large multipart coverage feature was not decoded fully and road segments were not individually validated.

PGMaps source paths:

- `public/data/network-availability/manifest.json`
- `public/data/network-availability/crtc-wireless-coverage-current.geojson.gz`
- `public/data/network-availability/crtc-major-roads-with-lte-5g.geojson.gz`
- `public/data/network-availability/crtc-major-roads-without-lte-5g.geojson.gz`

### Carrier-specific mobile coverage sources

**Environment and other context · source-only**

Grain: Provider × technology × published map/tile version; five carrier catalogues.
Geometry: Manifest references mixed raster/vector carrier endpoints; public cell-coverage contains only metadata.
Vintage: Captured 26 May 2026; provider layer versions and actual tile availability were not refreshed.
Source terms: Manifest warns source-dependent carrier map terms and against bulk redistribution without review.

Map support:

- PGMaps has carrier display/comparison code; remote tiles require separate availability and rights checks.

Missing or required:

- Pin permitted provider-native vector data or explicitly labelled native raster coverage; current Atlas is vector only.
- Preserve technology/version/legend semantics and source uncertainty.
- Do not treat pixel-traced demonstration geometry as independent provider measurements.

Cannot infer:

- Coverage maps are not measured signal, bandwidth, indoor availability, affordability or health-service uptake.

Next connection: Prefer the openly attributed CRTC reported-coverage context first; add carrier layers only after source/rights and version checks.

Reuse evidence: No current NHHR use established.

Verification scope: Provider catalogue and renderer references inspected; remote endpoints, individual tiles and provider agreements uninspected.

PGMaps source paths:

- `public/data/cell-coverage/manifest.json`
- `src/pages/DevNetworks.tsx`
- `scripts/audit-network-vectors.mjs`

### Canada public EV charging station context

**Environment and other context · unused**

Grain: Station versus charging unit; 15,462 station features and 42,578 units in source metadata.
Geometry: Locally available station points.
Vintage: Captured 26 May 2026; source operational status remains a historical snapshot.
Source terms: NLR Alternative Fuel Stations API terms declared; attribution/reuse conditions need direct review.

Map support:

- A bounded Northern charging-station point subset is technically ready after source-field review.

Missing or required:

- Review station IDs/coordinates/status and distinguish station counts from units/connectors.
- No actual charging availability, outages or route-range model is supplied.

Cannot infer:

- Station inventory does not establish an available charger, accessibility, vehicle range or patient ability to travel.

Next connection: Offer dated station context near reviewed routes/sites, keeping source status and connector metadata separate from any travel scenario.

Reuse evidence: No current NHHR use established.

Verification scope: Manifest counts/resources and local file presence inspected; station records/coordinates and live status not reviewed.

PGMaps source paths:

- `public/data/ev-charging/manifest.json`
- `public/data/ev-charging/stations.geojson`

### OpenLitterMap crowdsourced Prince George observations

**Environment and other context · unused**

Grain: Uploaded litter observations/objects; effort is concentrated in a small number of contributors.
Geometry: Point snapshots exist; public geometry/hex methods require a privacy-preserving aggregate review.
Vintage: Manifest: 18,981 mapped records, dates March 2019–July 2024; capture 28 June 2026.
Source terms: Manifest explicitly says verify current OpenLitterMap reuse terms; contributor/observer fields must not enter a new public release.

Map support:

- A permitted de-identified hex/community count layer is possible after aggregation/rights review.

Missing or required:

- Exclude usernames, contributor identity and unnecessary precise movement traces.
- Define spatial binning, record/object counts, pickup state and observation-effort bias.
- Compare native geometry and any client-side hex aggregation before publishing.

Cannot infer:

- Upload density is not litter prevalence or complete municipal cleanliness.
- Unobserved areas are not clean areas; counts do not establish health burden.

Next connection: Review a coarse de-identified aggregate with original dates and contribution-effort caveats; do not copy person-level raw attributes.

Reuse evidence: No current NHHR use established.

Verification scope: Manifest structure/counts inspected; contributor values and raw point records deliberately not inspected or copied.

PGMaps source paths:

- `public/data/open-litter-map/manifest.json`
- `public/data/open-litter-map`

### CityPG parks, trees, ecology and amenity assets

**Environment and other context · unused**

Grain: Municipal asset/ecological feature, with heterogeneous lifecycle and attribute definitions.
Geometry: Points, lines and polygons: 5,438 tree points, 201 playing areas, 73 park facility polygons, 736 high-conservation features and 33 outdoor rink points inspected.
Vintage: Capture/effective dates vary; filenames alone do not establish active/current assets.
Source terms: CityPG open-data terms declared in catalogue; each source layer/attribute licence and update date need preservation.

Map support:

- Locally available native geometries can support a municipal green-space/amenity context view.

Missing or required:

- NHHR needs native heterogeneous point/line/polygon overlays or a reviewed aggregate at a chosen municipal boundary.
- Accessibility needs validated entrances, routes, opening/access restrictions and a stated distance/time model.
- Tree inventory is not canopy coverage; feature/asset counts are not area or access measures.

Cannot infer:

- Municipal extent is not the Prince George LHA or all Northern communities.
- Asset presence does not establish usable greenspace, current maintenance or health benefit.

Next connection: Start with a dated park/tree-presence overlay around verified sites; derive access only from a reviewed network and access definition.

Reuse evidence: No current NHHR use established.

Verification scope: Bounded local GeoJSON schemas, counts and geometry types inspected. Large riparian/sensitivity files were only inventoried; no full geometry/asset validity check.

PGMaps source paths:

- `public/data/citypg/parks_trees.geojson`
- `public/data/citypg/parks_playing_areas.geojson`
- `public/data/citypg/parks_facilities.geojson`
- `public/data/citypg/ecology_high_conservation_value.geojson`
- `public/data/citypg/ecology_riparian_areas.geojson`
- `public/data/citypg/ecology_sensitivity.geojson`
- `public/data/citypg/outdoor_ice_rinks.geojson`

### Tree/shade/cooling-access and Landsat scene metadata

**Environment and other context · unused**

Grain: Presence proxies and scene metadata; not a measured heat/canopy surface.
Geometry: Seven declared sources: tree points, park/open-space/intact/community forest polygons, facility proxies and Landsat scene metadata.
Vintage: Captured 3 May 2026; raster acquisition dates vary by scene.
Source terms: CityPG and Landsat/source terms differ; source scene links are metadata, not processed values.

Map support:

- Tree/park/forest presence proxies can be drawn at native geometry with explicit labels.

Missing or required:

- Actual NDVI/LST needs raster reading, cloud masks, scale factors and reviewed zonal aggregation.
- Cooling-centre status requires independent current operational verification.
- Canopy/shade requires canopy polygons or LiDAR and a defined solar/geometry model.

Cannot infer:

- Tree points are not a canopy raster, measured shade or temperature reduction.
- Community/response facilities are not confirmed active cooling centres.

Next connection: Use labelled green-space/tree presence first; process a bounded Landsat scene only after QA/units and region aggregation are specified.

Reuse evidence: No current NHHR use established.

Verification scope: Manifest source counts and caveats inspected; no Landsat pixel processing or cooling-centre validation.

PGMaps source paths:

- `public/data/heat-shade/manifest.json`
- `public/data/heat-shade/citypg_trees.geojson`
- `public/data/heat-shade/citypg_park_open_spaces.geojson`
- `public/data/heat-shade/landsat_warm_season_scenes.json`

### Forest visual sensitivity, VQO and forestry modelling

**Environment and other context · unused**

Grain: Visual inventory unit and modelled viewing station/landform/harvest scenario; not a health indicator.
Geometry: 10,000 source sensitivity features in 100 spatial shards, with original full-resolution geometry.
Vintage: Manifest sourceLatestUpdate is 2019; current VRI/harvest queries are live exceptions, not a unified snapshot.
Source terms: Declared OGL-BC for visual inventory; DEM and other source/model terms remain separate.

Map support:

- Native visual-sensitivity geometry can be shown as forest-planning context.

Missing or required:

- Spatial shard loading, ordinal class legends and forestry-specific state are not present in NHHR.
- Full terrain/vegetation/treed-area basis and reviewer-confirmed landform are required for the VQO/VIA model.
- Do not simplify adjacent units independently or silently change the source denominator.

Cannot infer:

- Visual sensitivity/forestry percentages are not disease risk, air pollution or habitat health.
- Nearest sensitivity unit is only a review candidate; perspective and planimetric thresholds differ.

Next connection: Keep forestry maps as a linked specialist viewer unless a specific environmental-context question justifies a small documented overlay.

Reuse evidence: No current NHHR use established.

Verification scope: Manifest and repository renderer constraints inspected; individual shards and forestry model outputs unvalidated.

PGMaps source paths:

- `public/data/forest/visual-inventory/manifest.json`
- `public/data/forest/visual-inventory`
- `src/pages/dev-forestry/terrain.ts`
- `docs/forestry-visual-quality.md`

### Species observations and heritage/big-tree locations

**Environment and other context · unused**

Grain: Public observation/taxon or individual registered tree, with uneven reporting/coordinate accuracy.
Geometry: Species archive metadata describes 118,350 observations across 1,665 taxa; big-tree point asset exists.
Vintage: Species snapshot 28 August 2026, observations 1973–2026; tree effective dates not checked.
Source terms: Mixed observation licences include non-commercial/no-derivatives and 13,576 null licences; no blanket redistribution permission. Respect location obscuration and avoid observer identities.

Map support:

- Permitted coarse biodiversity/heritage context is technically possible after source/rights and location-sensitivity review.

Missing or required:

- Native point aggregation/zoom filtering and licence/obscuration-aware release selection.
- Legal conservation designations need authoritative crosswalks, not the iNaturalist threatened flag.

Cannot infer:

- Observation density is not abundance, habitat suitability, absence or an official species-risk designation.
- Tree record locations do not establish canopy coverage or current tree condition.

Next connection: Prefer a de-identified permitted regional observation summary or specialist source link; preserve missing/obscured locations.

Reuse evidence: No current NHHR use established.

Verification scope: Species manifest counts, licence distribution and caveat inspected; large observation records and observer identities deliberately uninspected.

PGMaps source paths:

- `public/data/forest/species-at-risk/inaturalist_species_at_risk_live_2026-08-28.manifest.json`
- `public/data/forest/species-at-risk/inaturalist_species_at_risk_live_latest.json`
- `public/data/forest/big-trees/bc_bigtree_registry.geojson`

### CCISS tree-species climate suitability reference and trace layers

**Environment and other context · unused**

Grain: Species/site/period reference tables and inferred display-class grid polygons; several artifacts are rendering experiments.
Geometry: Historical Pl/C4 output has 79,887 polygon features; province trace reconstructs an assumed 10-arc-second grid from display classes.
Vintage: Pinned package 1.0.3, deployed version unverified; historical test, current reference and inferred public traces are distinct.
Source terms: Original CCISS/package/source-map terms must be verified; traced display data should not be relabelled authoritative model outputs.

Map support:

- Existing polygon traces can be shown only with their experiment/inferred-display labels.

Missing or required:

- Current Shiny compatibility is false; key schema fields and 14 prediction/site lookup inputs are absent.
- Source model arrays, exact site lookup and class semantics are required for analytical suitability maps.
- Add tiled polygon/grid streaming and explicit resolution/coverage/nodata states.

Cannot infer:

- A rendered colour trace is not independently recovered numerical suitability.
- Tree-species suitability is not clinical health vulnerability or wildfire probability.

Next connection: Retain as specialist forestry source material; acquire original numerical/site model outputs before using an analytic metric.

Reuse evidence: No current NHHR use established.

Verification scope: Four manifests and incompatibility/missing-input declarations inspected; original model arrays/site predictions and geometry reconstruction were not independently reproduced.

PGMaps source paths:

- `public/data/cciss/current-reference/manifest.json`
- `public/data/cciss/historical-Pl-C4-polygons/manifest.json`
- `public/data/cciss/public-grid-trace/polygons/manifest.json`
- `public/data/cciss/province-grid-trace/polygons/manifest.json`

### BC wildlife management unit boundaries

**Environment and other context · unused**

Grain: Regulatory management unit, not a health-region or population denominator.
Geometry: 225 BC units, EPSG:4326, shared-topology 10 m simplification from EPSG:3005; metadata reports max area drift 0.368641%.
Vintage: Source modification 10 March 2026; output captured 19 August 2026.
Source terms: Declared OGL-BC; preserve source layer, simplification and attribution.

Map support:

- Native unit polygons are available for contextual ecology/regulatory mapping.

Missing or required:

- Register source unit codes/geometry, or perform explicit overlay analysis with documented areas.
- Current activity permissions require regulations/effective dates beyond boundary geometry.

Cannot infer:

- Unit boundaries alone do not establish hunting/fishing permission, land access, Indigenous territory or health catchments.

Next connection: Use only for a stated wildlife/ecological source-grain question; do not reuse its unit IDs as LHA codes.

Reuse evidence: No current NHHR use established.

Verification scope: Manifest source CRS, feature count, topology and area-drift metadata inspected; full boundary geometry not independently validated.

PGMaps source paths:

- `public/data/bc/outdoors/manifest.json`
- `public/data/bc/outdoors/regulatory/wildlife-management-units.geojson.gz`

### Planned outdoor access, waterway and regulatory layers

**Environment and other context · unavailable**

Grain: Seven planned families: limited-entry hunting, vehicle closures, corridors, land status, boat access, waterways and fishing zones.
Geometry: No corresponding completed scientific layers declared in the inspected manifest.
Vintage: Not established; planned is not a captured/effective source dataset.
Source terms: Source/rights/effective-date review still required for each proposed family.

Map support:

- No complete mapped-data release established; the manifest complete flag applies to its one delivered wildlife-unit layer.

Missing or required:

- Acquire original legal/official layer geometries, IDs, dates and source conditions.
- Water/land access needs topology and reviewed access points, not label-only anchors.

Cannot infer:

- A planned layer list does not prove assets, routes, open access or current legal permissions exist.

Next connection: Choose one necessary family, obtain the official source and validate temporal/geometry semantics before implementing any map.

Reuse evidence: No current NHHR use established.

Verification scope: Planned-layer catalogue inspected only; no source files or scientific rows inspected.

PGMaps source paths:

- `public/data/bc/outdoors/manifest.json`

### BC environmental reporting and ecosystem indicators

**Environment and other context · unused**

Grain: Distinct grains: 2018 grizzly unit, ecological drainage unit, and regional-district waste/population indicator.
Geometry: 59 grizzly units, 36 ecological drainage units, 29 regional-district attribute records joined to existing census-division geometry.
Vintage: Capture 13 August 2026; grizzly edition 2018, waste latest 2023 and population latest 2025.
Source terms: BC environmental/census source terms apply; preserve per-indicator publisher and source edition.

Map support:

- Local native source geometries and regional-district attributes are available.

Missing or required:

- Register native unit/regional-district IDs and preserve distinct denominators/years.
- Review 122 nearest-assigned invasive occurrences; proximity assignment is not a verified exact location.
- Do not force ecological/drainage counts into health regions without an explicit crosswalk and valid aggregation.

Cannot infer:

- Wildlife/invasive/waste indicators are not individual exposure or clinical outcomes.
- Waste rates and population changes cannot be averaged without their source denominators.

Next connection: Begin with a labelled regional waste-rate or native ecosystem-context view, keeping each geography and observation year separate.

Reuse evidence: No current NHHR use established.

Verification scope: Manifest source statistics, output identities and regional-district schema/counts inspected; underlying mortality/occurrence rows and assignments not independently validated.

PGMaps source paths:

- `public/data/bc/environmental-reporting/manifest.json`
- `public/data/bc/environmental-reporting/regional_district_environmental_indicators.json`
- `public/data/boundaries/BCWildlife/grizzly_bear_population_units_2018.geojson`
- `public/data/boundaries/BCEcology/ecological_drainage_units_aquatic_invasive_species.geojson`

### Industrial/remediation/disturbance reconstruction inputs

**Environment and other context · source-only**

Grain: Original industrial site or normalized LHA candidate indicator; reconstruction is separate from regulatory measurements.
Geometry: Source inventory includes mines/refineries/oil-gas fields/mills; candidate LHA tables reference selected normalized values.
Vintage: Source vintages differ; file names and candidate status do not establish current industrial operations.
Source terms: NRCan/BC/source-specific terms and original source labels need direct review.

Map support:

- Specific independently sourced site geometry may support an environmental context overlay.

Missing or required:

- Verify exact original source, operational status, coordinates and emission/remediation definitions.
- Retain candidate/source-equivalence flags and reviewed aggregation.

Cannot infer:

- Industrial site presence is not measured pollution, personal exposure, toxic dose or causal disease risk.

Next connection: Acquire one authoritative current/historical site inventory and keep presence distinct from any measured emission indicator.

Reuse evidence: No current NHHR use established.

Verification scope: File presence and research-release source provenance inspected; underlying industrial geometry/measurement records catalogue-only.

PGMaps source paths:

- `public/data/environmental-burden/bc-enviro-screen/rebuilt-nrcan-industrial-lha/manifest.json`
- `public/data/environmental-burden/bc-enviro-screen/raw-rebuild-seed/compact/nrcan-industrial`
- `public/data/environmental-burden/bc-enviro-screen/release/v2026-09-03-231d562533cb/source-provenance.json`

### Terrain, hillshade and flatten/visibility dependencies

**Environment and other context · source-only**

Grain: DEM tile or modelled viewing station/route; rendered hillshade is not an observation table.
Geometry: Remote AWS Terrarium raster DEM and local hillshade; PG/SF graphs are separate routing inputs assigned to the access audit.
Vintage: DEM mosaic edition/resolution depends on source/zoom; PG flatten source has OSM/elevation hashes and stated terrain estimates.
Source terms: AWS terrain/source DEM and graph-engine/OSM licences need separate retention; do not infer a single licence from toolkit code.

Map support:

- PGMaps already has terrain/visibility specialist renderers; source DEM availability was not fetched here.

Missing or required:

- NHHR currently lacks analytical raster DEM/terrain, tile decoding and worker/visibility model interfaces.
- Keep missing terrain unknown, source resolution and coordinate registration explicit.
- Visibility/access models need their own reviewer assumptions and data coverage.

Cannot infer:

- Terrain-only visibility is not cellular signal or guaranteed accessibility.
- Regional terrain is not LiDAR; bridges/tunnels and missing turn restrictions limit route interpretations.

Next connection: Link the existing specialist tool first; add terrain only for a concrete environmental/access question with preserved resolution, licence and modelling assumptions.

Reuse evidence: No current NHHR use established.

Verification scope: Terrain/source documentation and flatten provenance schema inspected; raster pixels and graph/model outputs not audited.

PGMaps source paths:

- `src/pages/dev-forestry/terrain.ts`
- `src/features/terrain-viewshed/README.md`
- `public/data/flatten-pg/sources.json`
- `public/data/flatten-pg/hillshade-0a48f5edbc.png`
- `public/data/flatten-sf`

### Historical Canadian fallout reporting posts and shelters

**Environment and other context · unused**

Grain: Historical archival reporting post/shelter or communication line, approximately circa 1963.
Geometry: 1,747 features: 1,439 points and 308 lines; source says shelter locations are approximate.
Vintage: KML conversion 14 June 2026; subject period is circa 1963 and contributing map began 2014.
Source terms: Google My Maps/archival/contributor rights not established by the local KML copy.

Map support:

- Historical context can be mapped after archive/source rights and approximate-location review.

Missing or required:

- Keep historical period, approximate accuracy and provenance with every feature.
- No current facility certification or operational data is supplied.

Cannot infer:

- These are not current emergency shelters, safe destinations or measured radiation levels.

Next connection: Keep outside the clinical Atlas unless a clearly historical research story needs it; link the archival source and mark approximate points.

Reuse evidence: No current NHHR use established.

Verification scope: Summary counts/description inspected; original archival location accuracy and individual records unreviewed.

PGMaps source paths:

- `public/data/fallout/fallout-reporting-posts-canada-summary.json`
- `public/data/fallout/fallout-reporting-posts-canada.geojson`
- `public/data/fallout/fallout-reporting-posts-canada.kml`

### Nechako public research and GIS service showcase

**Environment and other context · unused**

Grain: Public research record/location reference, bibliography entry or WMS service/layer metadata; these grains lack a verified common ID crosswalk.
Geometry: 1,408 research records; 51 location IDs, 46 mapped locations, 365 unmapped records; 32 WMS services and 135 named layers are catalogue entries.
Vintage: Public capture 11 October 2026; saved public projects captured 12 October 2026. Research dates span 12 decades.
Source terms: Each research attachment, WMS service and bibliography source retains its own rights; public metadata is not a universal GIS-data licence.

Map support:

- Public research-reference points and source links can support a separate literature/location explorer.

Missing or required:

- Verify research-location definitions and deduplicate original identities before joining to NHHR study evidence.
- WMS capabilities are metadata; data layers/identify depend on live services and a missing NHHR WMS adapter.
- No verified crosswalk exists among research IDs, Zotero keys and portal submission IDs.

Cannot infer:

- Mapped literature references are not clinical trial sites, participant locations or completed NHHR research.
- Named WMS layers do not establish locally available scientific rows.

Next connection: Offer a linked regional research-source catalogue first; only add a bounded public location/reference table after identity and rights review.

Reuse evidence: No current NHHR use established.

Verification scope: Manifest counts/limitations inspected; WMS services, attachments and underlying portal GIS databases not fetched; private submissions were excluded upstream.

PGMaps source paths:

- `public/data/nechako-showcase/manifest.json`
- `public/data/nechako-showcase/public-projects/index.json`
- `src/maps/nechako/data/portalInventory.ts`
