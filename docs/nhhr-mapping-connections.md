# NHHR mapping connections · reviewed 12 October 2026

The three requested gaps are connected without changing the UNBC design or the scientific values. Six existing explorer views gain reviewed geography: historical cancer, research chairs, the two CFI views, annual regional employment and monthly regional labour. Guided stories use the same joins and retain their selected measure, source period and filters when opening the explorer.

| Connection | Evidence and released geometry | Limits |
|---|---|---|
| Historical cancer | [Statistics Canada’s December 2015 boundary release](https://www150.statcan.gc.ca/n1/pub/82-402-x/2015002/hrbf-flrs-eng.htm). The BC ZIP has 16 HSDAs; Northern regions 5951, 5952 and 5953 match original DGUIDs 2015A00075951, 2015A00075952 and 2015A00075953. Official EPSG:3347 polygons are reprojected to longitude/latitude without independent simplification. | The archive member’s September 2015 label is retained in provenance; the publisher defines the release as December 2015 limits. The province benchmark remains in records/charts, without an overlapping province polygon. Windows, sexes and cancer groups overlap; confidence intervals and provisional symbols remain source fields. |
| North Coast and Nechako | The [2025 LFS geography guide](https://www150.statcan.gc.ca/n1/pub/71-543-g/2025001/app_ann_a-eng.htm) confirms 2021 geography and this combined reporting area. Native PGMaps ERs 5960 and 5970 are adjacent with zero areal overlap; their topological union preserves both polygons’ area. The two current LFS views use seven disjoint reporting polygons. | One combined observation is shown once. Blank original ER code/DGUID fields stay blank; `map_region_code` is an explicitly derived display key. Separate economic-region datasets retain eight native polygons. LFS population exclusions remain; older 2016-geography observations stay chart-only. |
| McMaster | [The official main-campus address](https://nuclear.mcmaster.ca/nuclear-resonance/getting-to-campus/) is 1280 Main Street West, Hamilton. Independently retrieved [OpenStreetMap way 23122301](https://www.openstreetmap.org/way/23122301) has matching institution/address tags. Its returned Nominatim point, rounded to five decimals, is inside that campus polygon: longitude −79.91783, latitude 43.26394. | This is a representative institutional location. CFI contributions and research-chair totals are not allocated to individual campus buildings, projects, participants or nearby residents. Existing scientific totals and missing records remain unchanged. |

Source scientific originals are still governed by their existing hash-locked preparation scripts. Fresh reads of the five relevant Zoer dataset endpoints confirmed they remain available. The manifest is an inventory; no measurements were inferred from it.

The public [mapping receipt](../public/data/nhhr/mapping-connections-provenance.json) records source URLs, original hashes, geometry operations, native identifiers and campus verification. No protected records or credentials are released. The public Sources page marks these three mappings as connected and links to the separately completed [CHSA publisher connection](nhhr-mapping-gap-completion.md). The collected C016 inventory still has no CHSA scientific rows; new PHSA observations supply their own native 2018 reporting geography.

## Reproduce and check

Use a separate Python environment for the geometry preparation dependencies:

```sh
python3 -m venv /private/nhhr-mapping-venv
/private/nhhr-mapping-venv/bin/pip install -r scripts/nhhr-mapping-requirements.txt
/private/nhhr-mapping-venv/bin/python scripts/prepare-nhhr-mapping-connections.py --input /private/nhhr-mapping-originals --refresh
/private/nhhr-mapping-venv/bin/python scripts/prepare-nhhr-mapping-connections.py --input /private/nhhr-mapping-originals --check
```

The boundary archive and mapped-object originals have fixed review hashes. A changed original requires review before replacing the lock. Institution-owned HTML confirms identity and source geography; the original HTML is retained privately, with hashes and URLs in the receipt. Geometry outputs can be reproduced without a network refresh from those retained originals.

Then regenerate the three affected scientific snapshots with their existing public/research/regional preparation scripts and run `prepare-nhhr-catalogue-review.py`. Their pure metadata hook adds the reviewed display connections while preserving original measurement fields, identifiers and periods. `--check` validates source/public mirrors.
