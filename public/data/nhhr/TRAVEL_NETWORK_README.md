# NHHR historical travel reference map

Reviewed **12 October 2026** using the user's authorized NHHR Data Space access, the PGMaps public health-place registry, the BC Address Geocoder and returned OpenStreetMap hospital features. The original Northern Health Connections schedule was captured **16 June 2026**; it is a historical snapshot, not current booking or service advice.

## Coverage and units

| Item | Count | Meaning |
| --- | ---: | --- |
| Source schedule events | 286 | Original arrival, departure or combined stop-event rows |
| Route source keys | 12 | Recorded route pages |
| Raw route / service-day patterns | 18 | Exact source day strings, including whitespace and asterisk differences |
| Source schedule legs | 26 | Separate ordered source tables, detected from sequence restarting at 1 |
| Events with a geographic reference | 280 | Facility/address or coarse town references; not 280 verified boarding points |
| Events at town representatives | 184 | Coarse official locality points; the named stop address is not verified |
| Events at facility/address references | 96 | Public hospital, lodge or station references; boarding door/bay is not established |
| Unmapped events | 6 | Four Mackenzie Junction and two Small River rest-area records |
| Reviewed geographic reference points | 56 | Source-cited facility or town points, not a count of physical bus stops |
| Stop-summary rows | 58 | 56 mapped references plus two unresolved source labels |
| Drawn schematic segments | 28 | Ordered connections split at unknown events and source-leg boundaries |

`event_count` is exactly **1 per source row**. `recorded_stop_events` counts those rows at a reviewed geographic reference or unresolved source label. These measures are **not passengers, unique bus trips, departures per week, appointment access or avoided travel**. Separate arrival/departure records and several service-day patterns can contribute to one reference point.

## Files and contracts

- `travel-network.json`: two explorer datasets and coverage metadata. The byte-identical module mirror is `src/atlas/snapshots/travel-network.json`.
- `travel-network-provenance.json`: original file/table IDs and hashes, reviewed aliases, coordinate evidence and coverage by raw route/day pattern.
- `locations-travel-stops.geojson`: 56 source-cited points. Every feature has `code` / `location_code`, name, site, city, `location_precision`, source and coordinate links, and a location note.
- `src/atlas/travelStopLocations.json`: the corresponding application registry: code, name, site, city, coordinates, sourceUrl, coordinateSourceUrl, locationNote and locationPrecision.
- `travel-route-connections.geojson`: 28 LineString features. These are **schematic connections, not road routes**.
- `scripts/nhhr-travel-stop-review.json`: explicit reviewed source-label aliases and independently returned coordinate evidence. Changed geography requires review; refresh does not silently re-geocode it.

The event dataset ID is `travel-stop-events`, geographic type `route`, entity field `stop_name`, with unique text `event_id` values `nhc-event-0001` through `nhc-event-0286`. Original source event text, stop time, route URL and capture timestamp are retained. `sequence` and `source_leg` are text metadata; the only numeric metric is `event_count`. The source `direction` field is preserved as `service_day`: it usually lists weekdays and must not be interpreted as an outbound/inbound direction or a weekly frequency.

The principal map declares `mapAggregation: {method: "sum", metric: "event_count"}`, `mapScaleFields: ["route_slug", "service_day"]`, its point/connection asset names, and a default Burns Lake–Prince George route filter. This permits summing original event rows at the same reference point, rather than applying generic aggregation to arbitrary metrics.

The summary dataset ID is `travel-stop-locations`, geographic type `stop`, entity field `stop_name`, metric `recorded_stop_events`. Its located rows are unique by `location_code`; unresolved source labels have null codes and reasons. The 58 row counts sum exactly to the original 286 events.

## Coordinate verification and precision

Town references use the **actual Point returned by the BC Address Geocoder**, constrained to `matchPrecision=LOCALITY`, province BC and an explicit reviewed community alias. They are labelled **Town representative point** with coarse precision. Town references locate the named community rather than asserting a pickup address, petrol station, clinic, rest stop or boarding entrance. Returned API URLs and precision evidence are retained.

Hospital references begin with the public PGMaps facility identity and source address. Where available, an independently returned OSM hospital node or feature centre is used and cited directly. Other facility/address references use an actual BC geocoder `CIVIC_NUMBER` result, with public source evidence. These references represent a public facility/site or address, rather than a confirmed bus boarding bay or a claim that an October 2026 point establishes a June 2026 pickup entrance. OSM feature centres are labelled as facility references, not exact entrance coordinates.

The public Kordyban Lodge address is supported by the Canadian Cancer Society service locator, and the source schedule itself gives Pacific Central Station's 1150 Station Street address. Both addresses were independently returned by the BC geocoder. Contact information was not copied into the release.

Some source labels require explicit interpretation:

- **Prince George (UHNBC/KL)** names two facilities; the combined label is mapped only to a coarse Prince George town representative. Individually named UHNBC and Kordyban Lodge events have separate facility references.
- **Terrace Hospital / Park Avenue Medical Centre** also combines sites. It uses town context rather than silently choosing one building or replacing the source's historical address.
- **Barrier** and **Port Edwards** are recorded source spellings. Explicit aliases resolve to Barriere and Port Edward; the BC geocoder reports spelling faults rather than a different community. Those review notes remain in event rows.
- **Mackenzie Junction** is not the town of Mackenzie. The public locality query returned no match, and no verified pickup-point coordinate is supplied. Four events remain unmapped.
- **Small River (Rest Area)** does not establish a specific address. The locality query returned an unrelated River Jordan result, which was rejected. Two events remain unmapped.

## Schematic connection rules

Source rows preserve original source-ID order. Sequence restarts identify separate source schedule legs; rows are not globally sorted by repeated sequence numbers. No connection crosses a source-leg boundary or an unresolved event. Adjacent arrival/departure events with identical coordinates retain all their IDs, while repeated adjacent coordinates collapse within a line. A segment with fewer than two distinct adjacent points is not drawn.

Each line's properties contain `route_slug`, `service_day`, `source_leg`, `segment_id`, **all contributing `event_ids`**, `location_codes`, `schematic: true`, its source URL and an interpretation label. The renderer must show a line only when **every one of its event IDs is still present in the currently filtered rows**. Filtering a stop, leg, service pattern, sequence or search must not leave a connection through hidden source events.

Lines are not driving paths, validated roads, distance estimates or travel-time estimates. An incomplete route is not drawn as though its unknown stop were known. No speed, patient-volume or NHHR-benefit calculation is introduced.

## Refresh and reproducibility

Original source IDs and hashes are pinned in the review file. Both originals must agree exactly on all 286 rows:

- `bc_patient_travel.db`: original `935d03b3-f4e1-47da-bcb3-eaefaa288be7`, SHA256 `67fa1a28f8ea4228369194d76aa34d12dd7adc324c68a0d19ec5aea8f4e01674`.
- `nh_connections_schedule.csv`: original `67188a5a-5c39-43bf-8ad9-ac8a21ca1201`, SHA256 `16cfbf195d21100219bc7244f501dc4cfbda0c103a06bdcf82eec47b5fe1a07b`.
- Actual source dataset: DATA-C069 `977fa723-d63f-4115-bb6a-3b34a3fbc36c`.

```sh
python3 scripts/prepare-nhhr-travel-network.py --input /private/nhhr-travel-review
python3 scripts/prepare-nhhr-travel-network.py --input /private/nhhr-travel-review --check
python3 scripts/prepare-nhhr-travel-network.py --input /private/nhhr-travel-refresh --refresh --check
```

The refresh follows the authorized manifest, verifies that the selected dataset ID remains listed, then downloads actual catalogue-linked originals and checks hashes. The manifest is not treated as scientific rows. Geographic alias changes or new coordinate evidence require deliberate review. `--headers-file` can supply private authorized headers when required; its contents are not released.

The script checks source hash/schema agreement, exact SQLite/CSV equality, complete reviewed alias coverage, independently returned coordinate evidence, source leg sequence order, unique event IDs, null unmatched locations, summary row preservation and byte-identical generated source/public files. Patient, participant, consent, remuneration and private contact records are excluded.

Public coordinate references require continued attribution to the **BC Address Geocoder / BC Geographic Warehouse** and, where cited, **OpenStreetMap contributors**. Original publisher source/citation obligations continue to apply.
