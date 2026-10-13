# NHHR Atlas health geography

These local polygons let the Atlas work without an external map service. They
are contextual Ministry of Health administrative boundaries, supplied from the
read-only PGMaps BCDataMapper source snapshots. No coordinates are simplified or
otherwise altered during this copy. Polygon attributes are reduced to the
identifiers and labels used by the application.

## Provenance and licence

`boundaries-provenance.json` records exact input hashes, PGMaps and BCDataMapper
commits, feature counts and the upstream simplification metadata. The upstream
complete shared-topology layers were simplified using Mapshaper 0.6.113 in BC
Albers EPSG:3005, then exported in WGS84 EPSG:4326 with six decimal places:

| Snapshot | Polygons | Upstream simplification interval |
| --- | ---: | ---: |
| Health service delivery areas | 16 | 75 m |
| Local health areas | 89 | 50 m |
| Health authorities | 5 | 100 m |

Source: Province of British Columbia, Ministry of Health. Reuse is under the
[Open Government Licence – British Columbia](https://www2.gov.bc.ca/gov/content/data/open-data/open-government-licence-bc).
Official catalogue: [HSDA boundaries](https://catalogue.data.gov.bc.ca/dataset/health-service-delivery-area-boundaries),
[LHA boundaries](https://catalogue.data.gov.bc.ca/dataset/local-health-area-boundaries),
[health authority boundaries](https://catalogue.data.gov.bc.ca/dataset/health-authority-boundaries).

The local snapshots do not establish a boundary vintage. We deliberately keep
that value null. Historic observations are shown on these polygons as geographic
context; this does not establish that their boundaries were identical in the
observation year. The application does not reallocate people, interpolate values
or assert boundary harmonization.

## Exact joins

`crosswalk-hsda.csv` and `.json` contain 16 explicit links between Statistics
Canada / CIHI four-digit BC HSDA codes and BC Ministry of Health HSDA codes.
The four-digit codes and names were reviewed against the official
[Health regions in Canada, 2024](https://www150.statcan.gc.ca/n1/pub/82-402-x/2025001/app-ann/app-ann01-eng.htm)
classification. The two-digit codes were checked against the Ministry source
index. For example, `5952` is linked explicitly to `52` (Northern Interior).
No prefix stripping or name similarity is used in the application. Alternate
source names such as Thompson/Cariboo and Thompson Cariboo Shuswap remain
labels; they do not alter the code join.

`crosswalk-health-hierarchy.csv` and `.json` contain the 231 explicit
CHSA → LHA → HSDA → health authority memberships supplied by the Ministry CHSA
snapshot. This is a hierarchy lookup, not population weighting and not a
universal census/city-to-health-area allocation table. The Atlas currently maps
HSDA and LHA observations with verified codes. Institution and city observations
stay in charts and tables until an appropriate geography is independently
verified.

Only one row per region may colour the map. Unmatched identifiers, duplicate
region observations, null metrics and non-finite values are withheld and reported
in the map's join counts. Filter a multi-year dataset to one year before mapping.
No averages or sums are silently manufactured by the map renderer.

## Rebuild

From the NHHR Atlas repository root:

```sh
PGMAPS_ROOT=/absolute/path/to/PGMaps node scripts/prepare-nhhr-boundaries.mjs
```

The script reads PGMaps without modifying it, validates expected identifiers and
counts, and deterministically writes the app snapshots and lookup indexes. Its
source-of-truth input is `vendor/bcdatamapper/datascrapers/bc/boundaries/output/BCMoH`.
