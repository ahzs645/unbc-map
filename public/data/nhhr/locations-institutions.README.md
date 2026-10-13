# Representative institution display locations

Verified on **12 October 2026** for the nine exact institution/city comparator labels in the reviewed NHHR publications and funding datasets.

`src/atlas/institutionLocations.json` provides the exact comparator-to-point registry. `locations-institutions.geojson` provides the same nine points and their public source links. Neither file contains scientific source rows or participant/contact records.

## Meaning of the points

These points locate a representative campus, campus lands, or research/administration building for visualizing institution-level totals. A bubble at a point describes its source institution, period and measure. It does **not** allocate funding or publication activity to that campus, city, patient population, individual researcher, or specific award site. Institutions may operate across several campuses and affiliated locations.

NOSM uses its Thunder Bay medical-school building because that is the source comparator label; its distributed institution also operates in Sudbury and partner communities. BC Cancer uses its Vancouver research/administration building at 675 West 10th Avenue; it is a province-wide organization. UBC uses the mapped Point Grey campus lands; the source label and postal address say Vancouver, while the campus is outside municipal Vancouver in Electoral Area A.

## Coordinate evidence and method

Institution-owned pages establish campus identity/location. Public OpenStreetMap objects were retrieved through the Nominatim Search API (`format=jsonv2`, `countrycodes=ca`, `addressdetails=1`) and checked against the institution and city. Coordinates are the returned mapped-object representative points, rounded to five decimal places. No coordinate was invented, jittered, or shifted to separate overlapping bubbles. The locations are a reviewed snapshot and the decimal precision is not a claim of survey accuracy.

All selected records identify Canada. City fields match the source comparator, with the explicitly documented UBC campus-lands exception. The NOSM mapped building is separate from the representative Lakehead campus point although they share the campus mailing address.

| Comparator | Site | Longitude, latitude | Coordinate evidence | Institution source |
| --- | --- | --- | --- | --- |
| Calgary / Calgary | Main campus · 2500 University Drive NW | -114.13881, 51.07505 | [OpenStreetMap](https://www.openstreetmap.org/way/4814074) | [Official source](https://www.ucalgary.ca/cted/popup/maincampus.html) |
| Dalhousie / Halifax | Studley campus, Halifax | -63.592, 44.6362 | [OpenStreetMap](https://www.openstreetmap.org/relation/17335000) | [Official source](https://www.dal.ca/faculty/arts/news-events/news0/newsletter/2025_08_20__2025_09_30.html) |
| Lakehead / Thunder Bay | Thunder Bay campus · 955 Oliver Road | -89.26234, 48.42031 | [OpenStreetMap](https://www.openstreetmap.org/way/369361463) | [Official source](https://www.lakeheadu.ca/about/thunder-bay-campus/tb-maps) |
| UBC / Vancouver | Vancouver (Point Grey) campus lands | -123.24298, 49.25789 | [OpenStreetMap](https://www.openstreetmap.org/relation/11678160) | [Official source](https://www.ubc.ca/about/maps.html) |
| UNBC / Prince George | Prince George campus · 3333 University Way | -122.81472, 53.89257 | [OpenStreetMap](https://www.openstreetmap.org/way/446564130) | [Official source](https://www.unbc.ca/about-unbc/contact) |
| USask / Saskatoon | Saskatoon campus | -106.62778, 52.13442 | [OpenStreetMap](https://www.openstreetmap.org/relation/13754325) | [Official source](https://maps.usask.ca/) |
| NOSM / Thunder Bay | Thunder Bay campus · 955 Oliver Road | -89.25987, 48.42189 | [OpenStreetMap](https://www.openstreetmap.org/way/198506186) | [Official source](https://www.nosm.ca/faculty/medical-sciences/contact-us/) |
| BC Cancer / Vancouver | BC Cancer Research Centre · 675 West 10th Avenue | -123.11935, 49.26259 | [OpenStreetMap](https://www.openstreetmap.org/way/135497923) | [Official source](https://www.bccrc.ca/dept/ora/grants-administration/contact-us) |

Coordinate data **© OpenStreetMap contributors**, provided under the [Open Database Licence (ODbL)](https://www.openstreetmap.org/copyright). Keep that attribution in maps or exports using these points. Official institution pages are cited as evidence for the location; they do not endorse the Atlas.

McMaster’s main campus at 1280 Main Street West, Hamilton, matches its official campus page and OpenStreetMap way 23122301. The returned Nominatim point, rounded to five decimal places, falls inside the independently retrieved campus polygon. Its source records describe whole-institution totals, not individual campus projects. See [mapping verification receipts](mapping-connections-provenance.json).
