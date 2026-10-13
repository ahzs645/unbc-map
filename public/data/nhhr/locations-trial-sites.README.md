# Verified trial-site locations

These three representative physical-facility points support the NHHR `trial-sites`
dataset. They locate named sites in a **historical April 29, 2026 source snapshot**;
they do not establish current recruitment, local enrollment, eligibility, capacity,
patient counts, service demand or a catchment. The linked registry may have changed.

| Code | Verified physical place | Official identity/address | Returned OpenStreetMap object |
| --- | --- | --- | --- |
| `bc-cancer-prince-george` | BC Cancer – Prince George (Centre for the North), 1215 Lethbridge Street | [BC Cancer](https://www.bccancer.bc.ca/centre-for-the-north-site) | [Clinic way 445255632](https://www.openstreetmap.org/way/445255632) |
| `prince-george-family-ymca` | Prince George Family YMCA, 2020 Massey Drive | [YMCA BC](https://www.ymcabc.ca/locations/prince-george-family-ymca) | [Sports-centre node 7033781790](https://www.openstreetmap.org/node/7033781790) |
| `prince-george-surgery-centre` | Prince George Surgery Centre, 500 Victoria Street | [HealthLink BC / Northern Health](https://www.healthlinkbc.ca/find-care/find-health-services/program/surgical-services-1?location_nid=27051) | [Address node 4268588591](https://www.openstreetmap.org/node/4268588591) |

Review date: October 12, 2026. Coordinates use longitude, latitude in WGS84.
Named clinic/sports-centre objects and the Surgery Centre building address match
the official street number, street and city. Nominatim context postal codes for
the cancer centre and Surgery Centre differ from the official facility postal
codes; official codes are retained. A point is a representative facility/building
location, not a trial room.

The read-only PGMaps `vendor/bcdatamapper` health-place and site registries were
checked. The Surgery Centre candidate at 500 Victoria St matches the official
HealthLink BC identity. PGMaps has no matching Family YMCA or Centre for the North
record; these use the independently verified official/OSM sources above. The
PGMaps **B.C. Cancer Agency in Vancouver** is a different physical place and is
excluded. UHNBC is adjacent to the cancer centre but is not a trial-whitelist site.

Seven original BC Cancer/BCCA Prince George study records collapse to the single
Prince George cancer centre. The YMCA and Surgery Centre have one source study
each. The record describing **13 individual First Nations in north-central BC**
remains unlocated, with its original description, null location code, reason and
[original NCT link](https://clinicaltrials.gov/study/NCT04105088). No named community,
boundary or coordinate is inferred.

The C042 raw sample includes only three of the ten selected NCT IDs. Their reused
Prince George point `[-122.75301, 53.9166]` is rejected as a city centroid; it is not
in this GeoJSON. No city-query national totals or duplicate source copies are added.

`trial-sites.json` contains four aggregate site/category rows and ten safe original
study-site evidence rows in separate datasets. They describe the **same records**
and must not be added together. `trial-sites-provenance.json` retains exact dataset,
table, original file IDs/hashes, source fields, deduplication rules, alias checks,
location evidence, excluded points and the unmatched record. Personal contact and
participant fields are excluded.

Regenerate and verify byte-identical releases:

```sh
python3 scripts/prepare-nhhr-trial-sites.py --input /path/to/review-sources --refresh
python3 scripts/prepare-nhhr-trial-sites.py --input /path/to/review-sources --check
```

The refresh follows the authorized NHHR manifest, actual dataset metadata and
catalogue before retrieving four hash-locked originals. Geographic review is
frozen in `scripts/nhhr-trial-sites-reviewed-locations.json`; changed source or
location hashes require an explicit new review. No credentials are in the outputs.

Coordinate attribution: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright),
available under the [Open Database License](https://opendatacommons.org/licenses/odbl/).
Official facility text is used for identity/address verification; no imagery is copied.
