# Representative exact-city display locations

Verified on **12 October 2026** for all seven exact `query_city` labels in the reviewed NHHR `clinical-city` dataset.

`src/atlas/cityLocations.json` is an explicit source-label-to-point registry. `locations-clinical-cities.geojson` exports the same points, public references and interpretation notes. These files contain display locations, not scientific source observations, study-site coordinates or participant records.

## Meaning and geographic scope

A point displays study counts tagged with the exact source city string. It is **not** a study facility, municipal catchment, enrolment location, accessible-trial count, patient-population denominator or NHHR building. City tags alone do not establish that every recorded facility lies inside a municipal boundary. Multi-site studies can occur in several cities, so the seven source counts must not be summed as distinct national studies. All source measures remain city-tagged counts: historical studies, recruiting statuses at the collected snapshot, oncology/radiotherapy coding, industry sponsorship and the largest coded condition domain. The point does not change their grain or definitions.

**Halifax:** the selected OSM object is the Halifax urban place within Halifax Regional Municipality. Municipal planning distinguishes Halifax Peninsula and Dartmouth within the broader regional municipality. The source exact label Halifax is retained; it is not broadened to HRM, Dartmouth, Bedford or the metropolitan area.

**Sudbury:** the geocoder returned the Greater Sudbury municipal object and its central city representative point. The municipality amalgamated several communities in 2001. The source label remains exactly Sudbury; the crosswalk is for display identity and does not claim all Greater Sudbury communities were included in the exact-city registry search.

**Vancouver:** this is the city representative point, distinct from the UBC campus point in the institution registry. UBC campus lands are part of Electoral Area A rather than municipal Vancouver; see [Metro Vancouver’s official local-government description](https://metrovancouver.org/services/electoral-area-a/role-of-metro-vancouver). A registry city tag is a text match, not a verified boundary intersection. The city point must not be used to move or allocate institution-wide UBC or BC Cancer measures into this dataset.

**Prince George:** the point is the city label, not the LHA, HSDA, Northern Health catchment, UNBC campus, individual clinical facilities or a future NHHR building.

## Coordinate evidence and method

Public OpenStreetMap objects were retrieved via Nominatim Search (`format=jsonv2`, `countrycodes=ca`, `addressdetails=1`, a full city/province/Canada query). Requests were sequential with at least one second between requests. Selected results were checked for Canadian country identity, exact province and city-level result type; county/district and Vancouver Island results were rejected. Official municipal sources independently establish city/place identity and relevant municipal context.

Coordinates are the returned mapped-object representative points, rounded to five decimal places in longitude/latitude order, EPSG:4326. They are not surveyed facility positions, calculated trial-distribution centroids or invented coordinates. No point was shifted or artificially jittered. Original query URLs and selected permanent OSM object URLs are retained in each record. The registry is a reviewed snapshot and no live geocoder is needed at runtime.

| Exact source query_city | Province | Longitude, latitude | Coordinate evidence | Official municipal identity/context |
| --- | --- | --- | --- | --- |
| Vancouver | British Columbia | -123.11395, 49.26087 | [OpenStreetMap](https://www.openstreetmap.org/relation/1852574) | [Official source](https://vancouver.ca/news-calendar/our-city.aspx) |
| Calgary | Alberta | -114.05754, 51.04561 | [OpenStreetMap](https://www.openstreetmap.org/relation/3227127) | [Official source](https://www.calgary.ca/info-requests/contact-us.html) |
| Halifax | Nova Scotia | -63.58595, 44.64862 | [OpenStreetMap](https://www.openstreetmap.org/relation/9092218) | [Official source](https://cdn.halifax.ca/sites/default/files/documents/city-hall/boards-committees-commissions/191127cdac84.pdf) |
| Saskatoon | Saskatchewan | -106.66077, 52.1318 | [OpenStreetMap](https://www.openstreetmap.org/relation/4189345) | [Official source](https://www.saskatoon.ca/community-culture-heritage/new-saskatoon/life-saskatoon) |
| Sudbury | Ontario | -80.99121, 46.49272 | [OpenStreetMap](https://www.openstreetmap.org/relation/7568929) | [Official source](https://www.greatersudbury.ca/live/about-greater-sudbury/history/) |
| Thunder Bay | Ontario | -89.2598, 48.40641 | [OpenStreetMap](https://www.openstreetmap.org/relation/7596931) | [Official source](https://www.thunderbay.ca/city-hall/history-heritage-and-records/history-of-thunder-bay/) |
| Prince George | British Columbia | -122.74537, 53.91286 | [OpenStreetMap](https://www.openstreetmap.org/relation/2243544) | [Official source](https://www.princegeorge.ca/community-culture/heritage/history-prince-george) |

## Exact crosswalk and integrity checks

The crosswalk is seven source rows to seven unique city point IDs, with **zero unmatched query_city labels**. It joins by the preserved exact `query_city` string; no alias expansion, fuzzy matching or inferred health-area membership is used. Source Zoer dataset ID: `960a9b75-413f-4f1c-9fc6-19e11fe04707`. Source table: `nhhr_data_c019_abdefd338a78_zip_data_c019_compar`.

`src/atlas/cityLocations.json` SHA-256: `5df04b09b4716ff09abe347e39cb4cd82494482a5cd3977ce078b6d1cb5b9bdf`.
`locations-clinical-cities.geojson` SHA-256: `783b51bb2558d3a8aad676cacf42cd4633ed752b1914fa47cd75d824be37b913`.

The GeoJSON `registry_sha256` value pins the matching registry. All exported coordinates and crosswalk labels were checked to agree exactly between both files. Scientific source numbers are intentionally absent from these coordinate files; the application must retain the selected dataset’s actual observation values and source notes.

Coordinate data **© OpenStreetMap contributors**, provided under the [Open Database Licence (ODbL)](https://www.openstreetmap.org/copyright). Keep that attribution on maps and exports using these points. Municipal references establish identity/context; they do not endorse the Atlas.
