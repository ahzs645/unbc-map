#!/usr/bin/env python3
"""Prepare reviewed hospital directory, facility costs and verified point locations.

Offline: python3 scripts/prepare-nhhr-hospitals.py --input /tmp/nhhr-hospital-review
Refresh: python3 scripts/prepare-nhhr-hospitals.py --refresh --input /tmp/nhhr-refresh
Use --check for a read-only deterministic comparison. Optional authorized headers
come from --headers-file; neither headers nor raw workbooks enter the public release.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
import re
import xml.etree.ElementTree as ET
import zipfile
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://zoer.k8s.overtheedgepaper.ca"
MANIFEST_URL = BASE + "/api/projects/acdd692f-a188-4f85-bb5a-83c48d5c7e82/database/data-spaces/de1fe530-a762-52fa-ba11-d01cc5b344df/manifest"
LOCATION_REVIEW_SHA256 = "2ab18001007f365c022c92258fbc4860f2a184a4e6e4254ef5c073c4215d92fa"
SOURCES = {
    "directory": {"collectionId": "DATA-C072", "datasetId": "a2987ed6-8b5d-4548-aab0-10f962545539", "filename": "facilities.csv", "originalFileId": "e81873f1-8e9f-4b87-8cac-99eb080d0d53", "sha256": "4408d8cf9f5b03d279f58f463df63a920d2611325a438b9925835ef3dceccf4a", "tableName": "nhhr_data_c072_8ecfe860a47c_zip_data_c072__16", "sourceRows": 61},
    "costs": {"collectionId": "DATA-C073", "datasetId": "8502dc29-352e-4bb5-80a4-1d7b14cd843d", "filename": "cihi_cshs_bc_2026-05.xlsx", "originalFileId": "d8140f05-d1fb-4f9e-84c2-d8e14d110324", "sha256": "7caa4b328a8cd82447bbfce62f7ffa447d54e5a73284be0ab477fa780c768953", "tableName": "nhhr_data_c073_2b844a747e06_zip_data_c073__2", "worksheet": "Sheet1", "gridRows": 418},
}
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
COST_HEADERS = ["Province/territory", "Reporting level", "Region", "Place or organization", "Time scale", "Time frame", "Indicator", "CSHS", "Unit of measure", "Confidence interval lower limit", "Confidence interval upper limit", "Refresh date"]


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def get_bytes(url: str, headers: dict[str, str]) -> bytes:
    with urlopen(Request(url, headers=headers), timeout=45) as response:
        return response.read()


def refresh(input_root: Path, headers: dict[str, str]) -> None:
    manifest = json.loads(get_bytes(MANIFEST_URL, headers))
    available = {r["id"] for r in manifest.get("resources", []) if r.get("kind") == "dataset" and r.get("available")}
    require(all(s["datasetId"] in available for s in SOURCES.values()), "A reviewed hospital source is unavailable in the manifest.")
    for source in SOURCES.values():
        descriptor = json.loads(get_bytes(BASE + "/api/datasets/" + source["datasetId"], headers)).get("dataset", {})
        require(descriptor.get("id") == source["datasetId"], "Selected hospital dataset identity changed.")
    catalogue = next(r for r in manifest["manifestSources"] if r.get("role") == "manifest")
    file_link = next(r for r in catalogue["files"] if r["name"] == "NHHR_files.csv")
    files = list(csv.DictReader(io.StringIO(get_bytes(BASE + file_link["url"], headers).decode("utf-8-sig"))))
    for source in SOURCES.values():
        records = [r for r in files if r["dataset_id"] == source["datasetId"] and source["originalFileId"] in r["original_file_ids"].split(";")]
        require(any(r["sha256"] == source["sha256"] for r in records), "Source identity/hash changed; review before refreshing.")
        data = get_bytes(BASE + "/api/files/" + source["originalFileId"] + "/download", headers)
        require(hashlib.sha256(data).hexdigest() == source["sha256"], "Downloaded source hash differs from the reviewed lock.")
        target = input_root / source["collectionId"] / source["filename"]
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)


def source_bytes(input_root: Path, key: str) -> bytes:
    source = SOURCES[key]
    data = (input_root / source["collectionId"] / source["filename"]).read_bytes()
    require(hashlib.sha256(data).hexdigest() == source["sha256"], f"Source hash changed for {source['filename']}.")
    return data


def workbook_costs(data: bytes) -> list[dict]:
    # Extract the read-only original source grid, with no recalculation or authoring.
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        shared = ["".join(t.text or "" for t in s.findall(".//m:t", NS)) for s in ET.fromstring(archive.read("xl/sharedStrings.xml")).findall("m:si", NS)]
        grid = []
        for row in ET.fromstring(archive.read("xl/worksheets/sheet1.xml")).findall("m:sheetData/m:row", NS):
            values = {}
            for cell in row.findall("m:c", NS):
                column = re.match(r"[A-Z]+", cell.attrib["r"]).group()
                if column not in set("ABCDEFGHIJKL"):
                    continue
                require(cell.find("m:f", NS) is None, "Unexpected source formula; review cached-value extraction.")
                value = cell.find("m:v", NS)
                values[column] = shared[int(value.text)] if cell.get("t") == "s" and value is not None else value.text if value is not None else None
            grid.append((int(row.attrib["r"]), values))
    require(max(r for r, _ in grid) == 418, "Original cost grid extent changed.")
    require([grid[0][1].get(c) for c in "ABCDEFGHIJKL"] == COST_HEADERS, "Original cost headers changed.")
    result = []
    for row_number, row in grid[1:]:
        if row.get("B") != "Facility":
            continue
        require(row.get("A") == "British Columbia" and row.get("E") == "Fiscal year" and row.get("G") == "Cost of a Standard Hospital Stay" and row.get("I") == "Dollars", "Facility cost scope/unit changed.")
        literal = row.get("H")
        if literal == "Suppressed":
            value, status = None, "Suppressed in source"
        else:
            require(literal is not None and re.fullmatch(r"\d[\d,]*", literal), "Unknown cost missing-value marker; review rather than imputing.")
            value, status = int(literal.replace(",", "")), "Reported"
        refresh_date = (datetime(1899, 12, 30) + timedelta(days=float(row["L"]))).date().isoformat()
        result.append({"source_facility_name": row["D"], "health_authority": row["C"], "fiscal_year": row["F"], "cost_per_weighted_case": value, "source_cost_raw": literal, "cost_status": status, "source_refresh_date": refresh_date, "source_cell": f"Sheet1!H{row_number}"})
    require(len(result) == 363, "Unexpected facility cost observation count.")
    require(len({(r["source_facility_name"], r["fiscal_year"]) for r in result}) == 363, "Duplicate facility/fiscal-year source observations.")
    return result


def column(key: str, label: str, numeric: bool = False, unit: str | None = None) -> dict:
    c = {"key": key, "label": label, "type": "number" if numeric else "text"}
    if unit:
        c["unit"] = unit
    return c


def prepare(input_root: Path) -> tuple[dict, dict, list[dict], dict, str]:
    review_bytes = (ROOT / "scripts/reviewed-hospital-locations.json").read_bytes()
    require(hashlib.sha256(review_bytes).hexdigest() == LOCATION_REVIEW_SHA256, "Reviewed location registry changed; independently review identity/coordinates before updating the lock.")
    review = json.loads(review_bytes)
    locations = review["locations"]
    require(len({r["code"] for r in locations}) == len(locations), "Duplicate physical-site registry codes.")
    aliases = {}
    for location in locations:
        require(len(location["coordinates"]) == 2 and all(isinstance(v, (int, float)) and math.isfinite(v) for v in location["coordinates"]), "Invalid reviewed point.")
        require(-140 < location["coordinates"][0] < -114 and 48 < location["coordinates"][1] < 61, "Reviewed point falls outside BC geographic bounds.")
        require(location["coordinateSourceUrl"].startswith("https://www.openstreetmap.org/"), "Coordinates require a verified permanent OSM object source.")
        for name in location["sourceAliases"]:
            require(name not in aliases, f"Ambiguous exact source alias: {name}")
            aliases[name] = location
    unresolved = {r["sourceLabel"]: r["reason"] for r in review["unresolvedAliases"]}
    directory_source = list(csv.DictReader(io.StringIO(source_bytes(input_root, "directory").decode("utf-8-sig"))))
    require(len(directory_source) == 61 and len({r["facility_id"] for r in directory_source}) == 61, "Source directory IDs/count changed.")
    # Directory aliases identify one physical site, not additional hospitals.
    groups = defaultdict(list)
    for row in directory_source:
        location = aliases.get(row["facility_name"])
        require(location is not None or row["facility_name"] in unresolved, "Directory alias is absent from reviewed matched/unmatched crosswalk.")
        groups[location["code"] if location else row["facility_name"]].append(row)
    directory_rows = []
    for key, group in groups.items():
        location = aliases.get(group[0]["facility_name"])
        directory_rows.append({"facility_name": location["name"] if location else group[0]["facility_name"], "source_facility_names": "; ".join(sorted({r["facility_name"] for r in group})), "source_facility_ids": "; ".join(sorted(r["facility_id"] for r in group)),
            "location_code": location["code"] if location else None, "city": location["city"] if location else None, "site_count": 1 if location else None, "directory_entry_count": 1,
            "location_status": "Verified physical display site" if location else "Unmapped source entry", "location_note": location["locationNote"] if location else unresolved[group[0]["facility_name"]],
            "first_seen_at": min(r["first_seen_at"] for r in group), "last_seen_at": max(r["last_seen_at"] for r in group), "location_source_url": location["sourceUrl"] if location else None})
    costs = workbook_costs(source_bytes(input_root, "costs"))
    cost_rows = []
    for row in costs:
        location = aliases.get(row["source_facility_name"])
        require(location is not None or row["source_facility_name"] in unresolved, "Cost alias is absent from reviewed matched/unmatched crosswalk.")
        cost_rows.append({"facility_name": location["name"] if location else row["source_facility_name"], **row, "location_code": location["code"] if location else None,
            "city": location["city"] if location else None, "location_status": "Verified current display site" if location else "Unmapped source facility", "location_note": location["locationNote"] if location else unresolved[row["source_facility_name"]], "location_source_url": location["sourceUrl"] if location else None})
    directory = {"id": "hospital-facilities", "title": "Hospital and surgical facility source directory", "description": "Reviewed physical display locations for the collected BC surgical facility directory. Duplicate source IDs are collapsed; unresolved and aggregate entries remain visible.",
        "topic": "Health services", "geography": "facility", "status": "observed", "timeLabel": "Directory capture · 15 June 2026", "sourceName": "BC Ministry of Health · collected surgical facility directory", "sourceUrl": "https://swt.hlth.gov.bc.ca/",
        "datasetId": SOURCES["directory"]["datasetId"], "tableName": SOURCES["directory"]["tableName"], "entityField": "facility_name", "boundaryKeyField": "location_code", "mapLocationsAsset": "locations-hospitals.geojson", "defaultMetric": "site_count",
        "notes": ["A site count of one means one verified physical display location. It is directory presence, not patients, beds, waiting-list size, surgical volume, staffing or clinical capacity.",
            "The original 61 facility IDs include duplicate aliases. Exact reviewed aliases collapse to a single directory entry while all source IDs and labels remain available. This does not combine clinical values.",
            "Greater Victoria Hospitals is a group, not one building. Broad or unidentified labels remain as entries with null location keys and explicit reasons. Missing location verification is not zero presence.",
            "Official facility addresses/identity and returned OpenStreetMap objects independently verify the points. PGMaps supplies candidate identity/address references only; no point is invented, shifted or jittered.",
            "Current verified display sites are contextual and are not a live service directory, a catchment, a participant location or a verified trial site. Source capture timestamps do not describe hospital opening/closure dates."],
        "columns": [column("facility_name", "Facility"), column("source_facility_names", "Original facility labels"), column("source_facility_ids", "Original facility IDs"), column("city", "Location community"), column("location_code", "Verified location code"), column("site_count", "Verified physical display sites", True, "sites"), column("directory_entry_count", "Directory entries", True, "entries"), column("location_status", "Location verification"), column("location_note", "Location interpretation"), column("first_seen_at", "First source capture"), column("last_seen_at", "Last source capture"), column("location_source_url", "Official location reference")], "rows": directory_rows}
    cost_dataset = {"id": "hospital-facility-costs", "title": "Hospital facility costs per weighted case", "description": "Original CIHI facility reporting values by fiscal year, with verified current hospital points for geographic context and source suppression retained.",
        "topic": "Health services", "geography": "facility", "status": "observed", "timeLabel": "FY2020–2021 to FY2024–2025 · source refresh 19 May 2026", "sourceName": "Canadian Institute for Health Information · Cost of a Standard Hospital Stay", "sourceUrl": "https://www.cihi.ca/en/indicators/cost-of-a-standard-hospital-stay-cshs",
        "datasetId": SOURCES["costs"]["datasetId"], "tableName": SOURCES["costs"]["tableName"], "entityField": "facility_name", "timeField": "fiscal_year", "boundaryKeyField": "location_code", "mapLocationsAsset": "locations-hospitals.geojson", "defaultMetric": "cost_per_weighted_case", "defaultPeriod": "2024–2025",
        "notes": ["One record is the original facility reporting entity and fiscal year. Values are cost per weighted acute inpatient case, not patient bills, procedure prices or marginal savings. Dollars are nominal source dollars.",
            "Facility costs must not be summed or averaged into a new hospital/region cost. No weighted-case denominators are supplied here to create an aggregate. Multiple reporting entities at one point remain separate/ambiguous rather than combined.",
            "The exact Suppressed source literal remains visible with null numeric cost. Absent source fiscal-year records are not manufactured as zero. No confidence interval or missing cost is inferred.",
            "Location keys are an explicit reviewed source-label crosswalk. The map uses verified current display sites, including renamed facilities; it does not allocate historic costs to the present building, assert unchanged footprints, or harmonize boundaries.",
            "This extract retains all 363 facility records in the BC workbook. Unverified historical/broad labels remain with null location keys and reasons. Province, health-region and corporation rows are excluded from this facility-only view.",
            "Points identify hospital reporting context. They do not identify research participants, accessible clinical trials, current service availability, referral routes or an NHHR-attributable benefit."],
        "columns": [column("facility_name", "Facility display name"), column("source_facility_name", "Original CIHI facility label"), column("health_authority", "Source reporting health region"), column("fiscal_year", "Fiscal year"), column("city", "Current location community"), column("location_code", "Verified location code"), column("cost_per_weighted_case", "Cost per weighted case", True, "CAD"), column("source_cost_raw", "Original cost literal"), column("cost_status", "Cost reporting status"), column("location_status", "Location verification"), column("location_note", "Location interpretation"), column("source_refresh_date", "Source refresh date"), column("source_cell", "Original cost cell"), column("location_source_url", "Official location reference")], "rows": cost_rows}
    evidence = {"datasets": [directory, cost_dataset], "snapshot": {"reviewedAt": "2026-10-12", "manifestUrl": MANIFEST_URL, "datasetCount": 2, "rowCount": len(directory_rows) + len(cost_rows), "releaseScope": "Public facility directory and original facility/fiscal-year cost aggregates; no patient or contact records."}}
    registry = [{k: r[k] for k in ["code", "name", "site", "city", "coordinates", "sourceUrl", "coordinateSourceUrl", "locationNote", "sourceAliases"]} for r in locations]
    geojson = {"type": "FeatureCollection", "name": "NHHR verified hospital display sites", "attribution": "© OpenStreetMap contributors", "license_url": "https://www.openstreetmap.org/copyright", "verified_at": review["reviewedAt"], "features": [{"type": "Feature", "geometry": {"type": "Point", "coordinates": r["coordinates"]}, "properties": {"code": r["code"], "name": r["name"], "site": r["site"], "city": r["city"], "source_url": r["sourceUrl"], "coordinate_source_url": r["coordinateSourceUrl"], "location_note": r["locationNote"], "source_aliases": r["sourceAliases"]}} for r in locations]}
    validation = {"originalDirectoryIds": 61, "releasedDirectoryEntries": len(directory_rows), "retainedDirectoryIds": sum(len(group) for group in groups.values()), "verifiedDirectoryEntries": sum(r["location_code"] is not None for r in directory_rows), "unmappedDirectoryEntries": sum(r["location_code"] is None for r in directory_rows), "facilityCostRows": 363, "sourceFacilityCostEntities": len({r["source_facility_name"] for r in costs}), "mappedCostRows": sum(r["location_code"] is not None for r in cost_rows), "unmappedCostRows": sum(r["location_code"] is None for r in cost_rows), "suppressedCostValues": sum(r["cost_per_weighted_case"] is None for r in costs), "physicalRegistryPoints": len(locations)}
    provenance = {"schema": "nhhr-hospital-facilities-v1", "reviewedAt": review["reviewedAt"], "manifestRevisionReviewed": 93, "manifestUrl": MANIFEST_URL, "sources": SOURCES, "locationReviewSha256": LOCATION_REVIEW_SHA256, "candidateSource": review["candidateSource"], "validation": validation,
        "crosswalk": [{"code": r["code"], "name": r["name"], "sourceAliases": r["sourceAliases"], "officialSourceUrl": r["sourceUrl"], "officialReferenceTitle": r["officialReferenceTitle"], "coordinateSourceUrl": r["coordinateSourceUrl"], "coordinateQueryUrl": r["coordinateQueryUrl"], "coordinateObjectName": r["coordinateObjectName"], "identityNote": r["identityNote"]} for r in locations], "unresolvedAliases": review["unresolvedAliases"],
        "method": ["Fresh authorized manifest and dataset descriptors were followed; original source file IDs and bytes match the reviewed catalogue SHA-256 locks.", "Read-only original source rows/cells supply all measures. Directory aliases collapse without combining costs or clinical values.", "Exact reviewed alias-to-code crosswalk only. PGMaps candidate references were independently checked against official identity/address evidence and returned public OSM objects.", "No point jitter, invented coordinates, centroid-of-city substitution, clinical-value aggregation or missing-cost imputation."], "limits": directory["notes"] + cost_dataset["notes"], "rightsNote": "Coordinate data © OpenStreetMap contributors under ODbL. BC Ministry of Health and CIHI source terms/attribution apply; no endorsement is implied."}
    lines = ["# Verified hospital display locations", "", f"Reviewed on **{review['reviewedAt']}**. This registry contains {len(locations)} verified physical display sites drawn from the exact source facility directory and hospital cost labels.", "", "## Meaning and source coverage", "", "The source directory has 61 IDs, including duplicate labels. All source IDs are retained while reviewed aliases collapse to one directory entry. A verified site count of one describes presence only. It is not clinical capacity, waiting patients, beds or surgical volume. Aggregate or unresolved names remain visible without a point.", "", "The cost dataset retains all 363 original CIHI facility/fiscal-year records, including source suppression. A current display point provides hospital reporting context; it does not allocate past costs to a present-day building or claim the reporting entity's footprint has never changed. Multiple reporting labels at a shared site remain ambiguous unless an explicit source definition supports combining them. Costs are not summed or averaged.", "", "## Independent location evidence", "", "PGMaps / BCDataMapper health_place_registry is used read-only to propose names, addresses and official references. It is not accepted as location proof. Official facility pages establish identity/address, and Nominatim returns actual mapped OSM objects or exact-address objects. Bus stops, heliports, construction sites and city centroids are rejected. Returned coordinates are preserved without invented points, shifts or artificial jitter. A point may represent a campus or an address rather than an entrance or surveyed building position.", "", "The exact source aliases, official reference titles, OSM objects and query URLs are recorded in hospital-facilities-provenance.json. The preparation script verifies source hashes and the reviewed location registry hash before generating the module/public mirrors. All unresolved source labels and reasons remain in the provenance and explorer rows.", "", "| Physical display site | Community | Coordinates (longitude, latitude) | Official identity/address | Coordinate object |", "| --- | --- | --- | --- | --- |"]
    lines += [f"| {r['name']} | {r['city']} | {r['coordinates'][0]}, {r['coordinates'][1]} | [Official reference]({r['sourceUrl']}) | [OpenStreetMap]({r['coordinateSourceUrl']}) |" for r in locations]
    lines += ["", "## Unresolved source aliases", ""] + [f"- **{r['sourceLabel']}**: {r['reason']}" for r in review["unresolvedAliases"]]
    lines += ["", "Coordinate data **© OpenStreetMap contributors**, licensed under the [Open Database Licence](https://www.openstreetmap.org/copyright). Retain that attribution on maps and coordinate exports. CIHI and BC Ministry of Health data retain their original publisher terms and attribution.", ""]
    return evidence, provenance, registry, geojson, "\n".join(lines)


def write_or_check(path: Path, content: str, check: bool) -> None:
    encoded = content.encode("utf-8")
    if check:
        require(path.exists() and path.read_bytes() == encoded, f"Generated file differs: {path.relative_to(ROOT)}")
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(encoded)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True, help="Directory containing reviewed DATA-C072 and DATA-C073 originals")
    parser.add_argument("--refresh", action="store_true", help="Follow authorized manifest/datasets then download immutable reviewed originals")
    parser.add_argument("--headers-file", type=Path, help="Optional private JSON request headers, never published")
    parser.add_argument("--check", action="store_true", help="Compare all generated outputs without changing them")
    args = parser.parse_args()
    if args.refresh:
        headers = json.loads(args.headers_file.read_text()) if args.headers_file else {}
        require(isinstance(headers, dict) and all(isinstance(k, str) and isinstance(v, str) for k, v in headers.items()), "Request headers must be a JSON string map.")
        refresh(args.input, headers)
    evidence, provenance, registry, geojson, readme = prepare(args.input)
    outputs = [("src/atlas/snapshots/hospital-facilities.json", evidence), ("public/data/nhhr/hospital-facilities.json", evidence), ("public/data/nhhr/hospital-facilities-provenance.json", provenance), ("src/atlas/hospitalLocations.json", registry), ("public/data/nhhr/locations-hospitals.geojson", geojson)]
    for name, value in outputs:
        write_or_check(ROOT / name, json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n", args.check)
    write_or_check(ROOT / "public/data/nhhr/locations-hospitals.README.md", readme, args.check)
    print(f"{'Verified' if args.check else 'Prepared'} {len(evidence['datasets'][0]['rows'])} directory entries and 363 original facility-cost records; {len(registry)} verified physical points, exact aliases and source hashes checked.")


if __name__ == "__main__":
    main()
