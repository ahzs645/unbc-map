# CIHI reporting labels to BC territorial health authorities

Reviewed 12 October 2026. `crosswalk-health-authority.json` is an explicit five-row lookup from the original `source_region` labels in the reviewed CIHI BC cost worksheet to the five Ministry of Health polygon identifiers supplied by PGMaps.

The [BC Ministry of Health boundary legend](https://www2.gov.bc.ca/gov/content/health/about-bc-s-health-care-system/partners/health-authorities/health-boundary-maps) identifies Interior=1, Fraser=2, Vancouver Coastal=3, Vancouver Island=4 and Northern=5. The [regional authority register](https://www2.gov.bc.ca/gov/content/health/about-bc-s-health-care-system/partners/health-authorities/regional-health-authorities) identifies the five territorial organizations. Island Health is shown on the source Ministry polygon named Vancouver Island; see the [Island Health region description](https://www.islandhealth.ca/health-topics/your-region).

Province-level British Columbia and Provincial Health Services Authority (PHSA) rows intentionally have no match. The province is an overlapping reporting level. PHSA is a province-wide organization, not a sixth territorial polygon. Both remain available in charts, records and exports. No source value is distributed among the five territorial authorities.

Hospital-stay cost is a source organizational measure per weighted inpatient case. The polygon supplies geographic context for the reporting authority; it does not express residents' bills, community utilization or marginal savings. Fiscal periods are preserved. The collected polygons have an unestablished boundary vintage and do not establish harmonized historical boundaries.

Runtime joins use exact listed source labels only. Unknown labels remain unmatched. PGMaps and BCDataMapper are read-only source repositories; no geometry or coordinates are altered by this crosswalk. Polygon provenance and hashes are in `boundaries-provenance.json`, and scientific original-file identifiers and hashes are in `additional-evidence-provenance.json`.
