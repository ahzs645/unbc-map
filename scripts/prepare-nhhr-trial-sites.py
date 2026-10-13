#!/usr/bin/env python3
"""Prepare verified physical trial-site counts and safe study/site evidence."""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
import re
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
BASE = "https://zoer.k8s.overtheedgepaper.ca"
MANIFEST_URL = BASE + "/api/projects/acdd692f-a188-4f85-bb5a-83c48d5c7e82/database/data-spaces/de1fe530-a762-52fa-ba11-d01cc5b344df/manifest"
REVIEWED_AT = "2026-10-12"
SNAPSHOT_DATE = "2026-04-29"
LOCATION_REVIEW_SHA256 = "74dfd16c0126f4f10e946d52fc6d00f71141d9fd375c79d81f4e257b654b46b8"
GENERIC_CITY_COORDINATES = [-122.75301, 53.9166]
BROAD_DESCRIPTION = "13 individual First Nations in north-Central BC near Prince George, BC"
UNLOCATED_REASON = "The source describes 13 First Nations across north-central BC rather than one named physical facility. Individual community identities and site coordinates are not established by this reviewed table; the Prince George city tag is insufficient for a point."

SOURCES = [
    {
        "collectionId": "DATA-C010", "datasetId": "d85b189f-9d24-421c-883c-6b759f081900",
        "filename": "prince_george_exact_site_whitelist.csv",
        "originalFileId": "b1cbb418-b55d-4745-b56d-f9905f36c2d3",
        "sha256": "8a73850827226665484d5ccccd0354065d4c8d637ffca5ed5647bb3ab0d7b765",
        "tableName": "nhhr_data_c010_9e6f293c5f27_zip_data_c010__3",
        "tableParquetSha256": "65e0cc425aac22b992a7dfd9066dc16ddbb8af5d4a60b13419548d6f5f55e4d5",
        "sourceRelativePath": "Data Research/Data/processed/clinical_trials/prince_george_whitelist_2026-04-29/prince_george_exact_site_whitelist.csv",
        "sourceRowCount": 10,
    },
    {
        "collectionId": "DATA-C010", "datasetId": "d85b189f-9d24-421c-883c-6b759f081900",
        "filename": "prince_george_final_validated_whitelist.csv",
        "originalFileId": "72546d16-6f7b-4e1f-a3c8-9f966bd5fa04",
        "sha256": "f8f079ecca4997571004f2afb8c907375e592ed5305701600c5fcaa509f0aafa",
        "tableName": "nhhr_data_c010_9e6f293c5f27_zip_data_c010__4",
        "tableParquetSha256": "62ed9ff9e4986d6c89e4bf8d82bd11fe5d8144097befccdf8ddb8c8271268284",
        "sourceRelativePath": "Data Research/Data/processed/clinical_trials/prince_george_whitelist_2026-04-29/prince_george_final_validated_whitelist.csv",
        "sourceRowCount": 10,
    },
    {
        "collectionId": "DATA-C019", "datasetId": "960a9b75-413f-4f1c-9fc6-19e11fe04707",
        "filename": "prince_george_clinical_trials_coded.csv",
        "originalFileId": "0681a2cb-fb75-4a25-b75f-65302f729518",
        "sha256": "c062d1f662c498b3e4712b801ce34106b9b94bae2a86d9ef1d9f1849981c1290",
        "tableName": "nhhr_data_c019_abdefd338a78_zip_data_c019_prince",
        "tableParquetSha256": "47feb2afb1e16043e751642b014d8e58020eab6c0161d1e2125fd9bbce2e8c3c",
        "sourceRelativePath": "Data Research/Data/processed/report_ready_synthesis_2026-04-29/smarter_ai_minimum_bundle/tables/prince_george_clinical_trials_coded.csv",
        "sourceRowCount": 10,
    },
    {
        "collectionId": "DATA-C042", "datasetId": "570ebb49-f165-4d5a-89e8-78e1122ab485",
        "filename": "clinicaltrials_v2_studies_sample_city_prince_george.json",
        "originalFileId": "2abf3657-bc8c-45af-ace4-9fbd5fc0e59d",
        "sha256": "7eb9bf9d61e02e6634a30f6f108e74e6f86dccd408b32a0ce8300376ff22423e",
        "tableName": "nhhr_data_c042_9a0d86bdb6f3_zip_data_c042__9",
        "tableParquetSha256": "e01006dcc89e79317c116f7e3589488e0553633a0abf40219c95d0d2716d62a9",
        "sourceRelativePath": "Data Research/Data/raw/clinical_trials/clinicaltrials_v2_studies_sample_city_prince_george.json",
        "sourceRowCount": 25,
        "envelopeTableName": "nhhr_data_c042_9a0d86bdb6f3_zip_data_c042__10",
        "envelopeTableParquetSha256": "d0bae1c5a604e88613bf610cc57374de544ce8055f59c15da1f48bc191b8a7e7",
    },
]
EXPECTED_STUDIES = {
    "NCT02756793": ("bc-cancer-prince-george", "ACTIVE_NOT_RECRUITING"),
    "NCT03862911": ("bc-cancer-prince-george", "ACTIVE_NOT_RECRUITING"),
    "NCT04797299": ("bc-cancer-prince-george", "RECRUITING"),
    "NCT05050929": ("bc-cancer-prince-george", "RECRUITING"),
    "NCT05470010": ("bc-cancer-prince-george", "RECRUITING"),
    "NCT05640999": ("bc-cancer-prince-george", "RECRUITING"),
    "NCT07152821": ("bc-cancer-prince-george", "RECRUITING"),
    "NCT06440395": ("prince-george-family-ymca", "RECRUITING"),
    "NCT02963233": ("prince-george-surgery-centre", "UNKNOWN"),
    "NCT04105088": (None, "UNKNOWN"),
}
WHITELIST_FIELDS = (
    "nct_id", "brief_title", "overall_status", "exact_prince_george_site_count",
    "exact_prince_george_sites", "classification",
)
CODED_FIELDS = ("nct_id", "brief_title", "overall_status", "condition_domain", "facilities")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def get_bytes(url: str, headers: dict[str, str]) -> bytes:
    with urlopen(Request(url, headers=headers), timeout=45) as response:
        return response.read()


def refresh(input_root: Path, headers: dict[str, str]) -> None:
    """Follow manifest, actual dataset metadata and source catalogue before download."""
    manifest_bytes = get_bytes(MANIFEST_URL, headers)
    manifest = json.loads(manifest_bytes)
    require(manifest["revision"] == 93, "Manifest revision changed; review coverage before refreshing.")
    available = {item["id"]: item for item in manifest["resources"] if item.get("kind") == "dataset"}
    for dataset_id in {source["datasetId"] for source in SOURCES}:
        resource = available.get(dataset_id)
        require(resource is not None and resource.get("available"), "A reviewed source dataset is unavailable in the manifest.")
        metadata = json.loads(get_bytes(BASE + resource["datasetUrl"], headers))["dataset"]
        require(metadata["id"] == dataset_id and metadata["status"] == "ready" and metadata["artifactVersion"] == 1, "Reviewed source dataset identity/version changed.")
        table_lookup = {table["name"]: table for table in resource["tables"]}
        for source in (item for item in SOURCES if item["datasetId"] == dataset_id):
            require(source["tableName"] in table_lookup and table_lookup[source["tableName"]]["rows"] == source["sourceRowCount"], "Reviewed source table coverage changed.")
            if "envelopeTableName" in source:
                require(source["envelopeTableName"] in table_lookup and table_lookup[source["envelopeTableName"]]["rows"] == 1, "Raw-sample metadata table changed.")
    catalogue = next((item for item in manifest["manifestSources"] if item.get("kind") == "dataset" and item.get("available")), None)
    require(catalogue is not None, "Source catalogue is unavailable.")
    tables = []
    files = []
    for filename, target in [("NHHR_tables.csv", tables), ("NHHR_files.csv", files)]:
        source_file = next(item for item in catalogue["files"] if item["name"] == filename)
        target.extend(csv.DictReader(io.StringIO(get_bytes(BASE + source_file["url"], headers).decode("utf-8-sig"))))
    for source in SOURCES:
        matches = [row for row in files if row["dataset_id"] == source["datasetId"] and row["relative_path"] == source["sourceRelativePath"]]
        require(len(matches) == 1 and matches[0]["sha256"] == source["sha256"] and matches[0]["original_file_ids"] == source["originalFileId"], "Original source catalogue binding changed.")
        for table_name, table_hash, count in [(source["tableName"], source["tableParquetSha256"], source["sourceRowCount"])] + ([(source["envelopeTableName"], source["envelopeTableParquetSha256"], 1)] if "envelopeTableName" in source else []):
            matches = [row for row in tables if row["dataset_id"] == source["datasetId"] and row["table_name"] == table_name]
            require(len(matches) == 1 and matches[0]["source_relative_path"] == source["sourceRelativePath"] and matches[0]["source_sha256"] == source["sha256"] and matches[0]["parquet_sha256"] == table_hash and int(matches[0]["row_count"]) == count, "Scientific table lineage/version changed.")

    def download(source: dict) -> None:
        data = get_bytes(BASE + "/api/files/" + source["originalFileId"] + "/download", headers)
        require(hashlib.sha256(data).hexdigest() == source["sha256"], "Downloaded original hash differs from reviewed source lock.")
        path = input_root / source["collectionId"] / source["filename"]
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    with ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(download, SOURCES))


def read_locked(input_root: Path, source: dict) -> bytes:
    data = (input_root / source["collectionId"] / source["filename"]).read_bytes()
    require(hashlib.sha256(data).hexdigest() == source["sha256"], f"Original hash changed for {source['filename']}.")
    return data


def project_csv(data: bytes, fields: tuple[str, ...]) -> list[dict[str, str]]:
    """Access only allowlisted scientific columns, excluding contact fields."""
    reader = csv.reader(io.StringIO(data.decode("utf-8-sig")))
    header = next(reader)
    require(len(header) == len(set(header)), "Duplicate source CSV headers.")
    require(all(key in header for key in fields), "An allowlisted source column is unavailable.")
    indexes = {field: header.index(field) for field in fields}
    return [{field: row[index] for field, index in indexes.items()} for row in reader if row and any(row)]


def reviewed_locations() -> tuple[list[dict], dict]:
    data = (ROOT / "scripts/nhhr-trial-sites-reviewed-locations.json").read_bytes()
    require(hashlib.sha256(data).hexdigest() == LOCATION_REVIEW_SHA256, "Location review changed; re-verify identity/address/coordinates before release.")
    review = json.loads(data)
    locations = review["locations"]
    require(len(locations) == 3 and len({item["code"] for item in locations}) == 3, "Physical-site registry is not one point per reviewed facility.")
    require({item["code"] for item in locations} == {code for code, _ in EXPECTED_STUDIES.values() if code}, "Site code coverage changed.")
    for location, evidence in zip(locations, review["locationEvidence"]):
        require(location["code"] == evidence["code"], "Location evidence order/identity changed.")
        point = location["coordinates"]
        require(len(point) == 2 and all(isinstance(value, (int, float)) and math.isfinite(value) for value in point), "Invalid physical-site point.")
        require(-122.80 < point[0] < -122.72 and 53.88 < point[1] < 53.94 and point != GENERIC_CITY_COORDINATES, "Unverified city centroid or wrong-city point entered the release.")
        osm = evidence["returnedOSM"]
        require(point == [float(osm["lon"]), float(osm["lat"])], "Point differs from returned OpenStreetMap coordinates.")
        require(location["coordinateSourceUrl"] == f"https://www.openstreetmap.org/{osm['osm_type']}/{osm['osm_id']}", "Permanent coordinate-source identity changed.")
        require(all(osm["address"][key] == evidence["officialAddress"][key] for key in ["house_number", "road", "city"]), "Returned OSM address does not match official physical address.")
    return locations, review


def prepare(input_root: Path) -> tuple[dict, dict, list[dict], dict]:
    exact = project_csv(read_locked(input_root, SOURCES[0]), WHITELIST_FIELDS)
    validated = project_csv(read_locked(input_root, SOURCES[1]), WHITELIST_FIELDS + ("final_validation_tier",))
    coded = project_csv(read_locked(input_root, SOURCES[2]), CODED_FIELDS)
    for rows in [exact, validated, coded]:
        require(len(rows) == 10 and len({row["nct_id"] for row in rows}) == 10 and {row["nct_id"] for row in rows} == set(EXPECTED_STUDIES), "Original ten-study whitelist or uniqueness changed.")
    lookup = {row["nct_id"]: row for row in coded}
    exact_lookup = {row["nct_id"]: row for row in exact}
    locations, location_review = reviewed_locations()
    location_lookup = {item["code"]: item for item in locations}
    aliases = {alias: evidence["code"] for evidence in location_review["locationEvidence"] for alias in evidence["sourceSiteAliases"]}
    require(len(aliases) == 5, "Reviewed facility alias coverage changed.")
    relationships = []
    for row in sorted(validated, key=lambda item: item["nct_id"]):
        nct_id = row["nct_id"]
        require(re.fullmatch(r"NCT\d{8}", nct_id) is not None, "Invalid original registry ID.")
        require(all(row[key] == exact_lookup[nct_id][key] for key in WHITELIST_FIELDS), "Exact and final whitelist science fields disagree.")
        require(row["exact_prince_george_site_count"] == "1", "Source site multiplicity changed; do not implicitly aggregate it.")
        parts = row["exact_prince_george_sites"].split(" | ")
        require(len(parts) == 4 and parts[1:] == ["Prince George", "British Columbia", "Canada"], "Source site grain/geography changed.")
        source_site = parts[0]
        code = aliases.get(source_site)
        expected_code, expected_status = EXPECTED_STUDIES[nct_id]
        require(code == expected_code and row["overall_status"] == expected_status, "Reviewed site identity or historical status changed.")
        require(all(lookup[nct_id][key] == row[key] for key in ["brief_title", "overall_status"]), "C019 coded study identity/status differs from C010 whitelist.")
        require(lookup[nct_id]["facilities"] == source_site, "C019 facility alias differs from validated exact-site record.")
        location = location_lookup.get(code)
        if code is None:
            require(source_site == BROAD_DESCRIPTION and row["final_validation_tier"] == "REVIEW_TIER_STRUCTURED_CITY_PG_BUT_REGIONAL_COMMUNITY_SITE", "Unlocated source description/tier changed.")
        else:
            require(row["final_validation_tier"] == "WHITELIST_DIRECT_PRINCE_GEORGE_PHYSICAL_SITE", "Physical source validation tier changed.")
        relationships.append({
            "nct_id": nct_id, "brief_title": row["brief_title"],
            "facility_name": location["name"] if location else source_site,
            "source_facility_name": source_site, "location_code": code,
            "city": "Prince George", "overall_status": row["overall_status"],
            "condition_domain": lookup[nct_id]["condition_domain"],
            "source_validation_tier": row["final_validation_tier"],
            "location_status": "Verified physical facility" if location else "Unlocated regional description",
            "location_note": location["locationNote"] if location else UNLOCATED_REASON,
            "snapshot_date": SNAPSHOT_DATE, "study_site_record": 1,
            "registry_url": "https://clinicaltrials.gov/study/" + nct_id,
        })
    require(len({(row["nct_id"], row["location_code"] or row["source_facility_name"]) for row in relationships}) == 10, "Duplicate study/site pair entered the release.")
    require(sum(row["location_code"] is not None for row in relationships) == 9, "Reviewed physical study/site coverage changed.")

    raw = json.loads(read_locked(input_root, SOURCES[3]))
    require(len(raw["studies"]) == 25, "C042 raw sample coverage changed.")
    # Only public study ID and facility/location metadata are inspected. Never
    # access centralContacts, location.contacts, investigators or person fields.
    raw_location_checks = []
    for study in raw["studies"]:
        protocol = study["protocolSection"]
        nct_id = protocol["identificationModule"]["nctId"]
        if nct_id not in EXPECTED_STUDIES:
            continue
        for site in protocol.get("contactsLocationsModule", {}).get("locations", []):
            if site.get("city") != "Prince George":
                continue
            fields = {key: site.get(key) for key in ["facility", "city", "state", "zip", "country", "geoPoint"]}
            raw_location_checks.append({"nctId": nct_id, **fields, "coordinateDecision": "Rejected repeated Prince George city-centroid coordinates; not a physical-site locator."})
    require({item["nctId"] for item in raw_location_checks} == {"NCT02963233", "NCT04105088", "NCT07152821"} and len(raw_location_checks) == 3, "Raw sample/whitelist intersection changed.")
    require(all(item["geoPoint"] == {"lat": GENERIC_CITY_COORDINATES[1], "lon": GENERIC_CITY_COORDINATES[0]} for item in raw_location_checks), "Raw coordinate quality changed; review before releasing.")

    groups = defaultdict(list)
    for row in relationships:
        groups[row["location_code"] or row["source_facility_name"]].append(row)
    summary = []
    for key in [item["code"] for item in locations] + [BROAD_DESCRIPTION]:
        rows = groups[key]
        statuses = Counter(row["overall_status"] for row in rows)
        location = location_lookup.get(key)
        summary.append({
            "facility_name": location["name"] if location else key,
            "location_code": key if location else None,
            "city": "Prince George",
            "site_category": "Physical facility" if location else "Regional source description",
            "distinct_studies": len({row["nct_id"] for row in rows}),
            "recruiting_snapshot_studies": statuses["RECRUITING"],
            "active_not_recruiting_snapshot_studies": statuses["ACTIVE_NOT_RECRUITING"],
            "unknown_status_studies": statuses["UNKNOWN"],
            "snapshot_date": SNAPSHOT_DATE,
            "source_facility_aliases": "; ".join(sorted({row["source_facility_name"] for row in rows})),
            "nct_ids": "; ".join(row["nct_id"] for row in rows),
            "registry_urls": "; ".join(row["registry_url"] for row in rows),
            "location_status": "Verified physical facility" if location else "Unlocated regional description",
            "location_note": location["locationNote"] if location else UNLOCATED_REASON,
        })
    require([row["distinct_studies"] for row in summary] == [7, 1, 1, 1], "Source distinct-study summary changed.")
    require([row["recruiting_snapshot_studies"] for row in summary] == [5, 1, 0, 0], "Historical recruiting-status counts changed.")
    require(all(row["distinct_studies"] == row["recruiting_snapshot_studies"] + row["active_not_recruiting_snapshot_studies"] + row["unknown_status_studies"] for row in summary), "Historical statuses do not partition distinct studies.")
    common_notes = [
        "Coverage is the ten distinct NCT IDs in the NHHR April 29, 2026 exact-site whitelist, reconciled with the final validation tiers and C019 coded study table. This selected historical portfolio is not all Prince George trials or a national total.",
        "Status is overall study status recorded in the source snapshot, not verified local-site status or current availability. A listing does not establish local enrollment, screening capacity, eligibility or current recruitment. UNKNOWN is retained and is not recoded as inactive.",
        "BC Cancer - Prince George, BC Cancer - Centre for the North (Prince George), and BCCA - Prince George collapse to one verified Prince George physical facility. The PGMaps Vancouver B.C. Cancer Agency record and the adjacent UHNBC hospital are different places and are not substituted.",
        "The source description of 13 individual First Nations in north-central BC remains one unlocated source record. No community names or points are inferred, and the source city tag is not sufficient for a location.",
        "The C042 raw sample contains only three of these ten NCT IDs. All three reuse the same Prince George city-centroid coordinates; those coordinates are rejected. Verified physical points instead use official facility addresses and returned permanent OpenStreetMap objects reviewed on October 12, 2026.",
        "Summary and study-site evidence describe the same source records and must not be added together. Each summary count uses distinct NCT IDs within a site; no patient or participant counts are inferred. Personal contact, investigator and interview-target fields are excluded.",
    ]
    common = {
        "topic": "Clinical research", "status": "observed",
        "timeLabel": "Historical registry snapshot · April 29, 2026",
        "sourceName": "ClinicalTrials.gov · NHHR validated site whitelist",
        "sourceUrl": "https://clinicaltrials.gov/",
        "datasetId": SOURCES[1]["datasetId"], "tableName": SOURCES[1]["tableName"],
        "timeField": "snapshot_date",
    }
    main_columns = [
        {"key": "facility_name", "label": "Verified facility / source description", "type": "text"},
        {"key": "location_code", "label": "Verified physical-site code", "type": "text"},
        {"key": "city", "label": "Source city tag", "type": "text"},
        {"key": "site_category", "label": "Site category", "type": "text"},
        {"key": "distinct_studies", "label": "Distinct source studies", "type": "number", "unit": "studies"},
        {"key": "recruiting_snapshot_studies", "label": "RECRUITING in source snapshot", "type": "number", "unit": "studies"},
        {"key": "active_not_recruiting_snapshot_studies", "label": "ACTIVE_NOT_RECRUITING in source snapshot", "type": "number", "unit": "studies"},
        {"key": "unknown_status_studies", "label": "UNKNOWN in source snapshot", "type": "number", "unit": "studies"},
        {"key": "snapshot_date", "label": "Source snapshot date", "type": "text"},
        {"key": "source_facility_aliases", "label": "Original facility names", "type": "text"},
        {"key": "nct_ids", "label": "Original registry IDs", "type": "text"},
        {"key": "registry_urls", "label": "Public study links", "type": "text"},
        {"key": "location_status", "label": "Location verification", "type": "text"},
        {"key": "location_note", "label": "Location scope / unmatched reason", "type": "text"},
    ]
    principal = {
        **common, "id": "trial-sites", "title": "Verified Prince George trial sites",
        "description": "Distinct studies from the ten-study historical whitelist, grouped at three verified physical facilities; one regional First Nations description remains unlocated.",
        "geography": "facility", "mapLocationsAsset": "locations-trial-sites.geojson",
        "notes": common_notes + ["Three map points locate named source facilities. Marker values count historical study records associated with that site, not patients, service demand, site recruitment capacity or a catchment. Coordinates represent the mapped facility/building; they do not identify a trial room."],
        "columns": main_columns, "rows": summary, "defaultMetric": "distinct_studies",
        "entityField": "facility_name", "boundaryKeyField": "location_code",
    }
    evidence_columns = [
        {"key": "nct_id", "label": "Registry ID", "type": "text"},
        {"key": "brief_title", "label": "Public study title", "type": "text"},
        {"key": "facility_name", "label": "Verified facility / source description", "type": "text"},
        {"key": "source_facility_name", "label": "Original facility name", "type": "text"},
        {"key": "location_code", "label": "Verified physical-site code", "type": "text"},
        {"key": "city", "label": "Source city tag", "type": "text"},
        {"key": "overall_status", "label": "Status in source snapshot", "type": "text"},
        {"key": "condition_domain", "label": "NHHR coded condition domain", "type": "text"},
        {"key": "source_validation_tier", "label": "Source validation tier", "type": "text"},
        {"key": "location_status", "label": "Location verification", "type": "text"},
        {"key": "location_note", "label": "Location scope / unmatched reason", "type": "text"},
        {"key": "snapshot_date", "label": "Source snapshot date", "type": "text"},
        {"key": "study_site_record", "label": "Reviewed study-site record", "type": "number", "unit": "records"},
        {"key": "registry_url", "label": "Public registry link", "type": "text"},
    ]
    evidence = {
        **common, "id": "trial-site-evidence", "title": "Prince George study-site evidence",
        "description": "Ten deduplicated original NCT/site relationships behind the verified-facility summary, retaining source aliases, historical study statuses and the unlocated regional description.",
        "geography": "none", "notes": common_notes + ["Each record is an original NCT ID and reviewed site/category. This table supports inspection and public registry links; it is not separately spatially aggregated at runtime. NHHR condition-domain coding is an analytical interpretation."],
        "columns": evidence_columns, "rows": relationships, "defaultMetric": "study_site_record", "entityField": "nct_id",
    }
    for dataset in [principal, evidence]:
        allowed = {column["key"] for column in dataset["columns"]}
        require(all(set(row) == allowed for row in dataset["rows"]), "An unallowlisted field entered a public release.")
        require(all(value is None or isinstance(value, (str, int, float)) for row in dataset["rows"] for value in row.values()), "Non-scalar source data entered public rows.")
    snapshot = {"reviewedAt": REVIEWED_AT, "sourceVersion": "NHHR manifest revision 93 · April 29, 2026 validated trial whitelist", "datasets": [principal, evidence]}
    provenance = {
        "reviewedAt": REVIEWED_AT, "manifestUrl": MANIFEST_URL, "manifestRevision": 93,
        "sourceSnapshotDate": SNAPSHOT_DATE, "originalSources": SOURCES,
        "sourceFieldsSelected": {"whitelist": list(WHITELIST_FIELDS) + ["final_validation_tier"], "codedStudyTable": list(CODED_FIELDS), "rawSample": ["protocolSection.identificationModule.nctId", "protocolSection.contactsLocationsModule.locations facility/city/state/zip/country/geoPoint"]},
        "releaseGrain": {"trial-sites": "One source-snapshot row per verified physical facility or distinct unlocated source description; distinct NCT IDs counted within that site/category.", "trial-site-evidence": "One deduplicated original NCT ID / reviewed source site-category pair."},
        "coverage": {"whitelistedDistinctStudies": 10, "physicalFacilities": 3, "locatedStudySitePairs": 9, "unlocatedStudySitePairs": 1, "sourceSiteCategories": 4, "summaryValues": [7, 1, 1, 1], "historicalRecruitingStudyCounts": [5, 1, 0, 0], "unknownStudyStatuses": 2},
        "locationReviewSha256": LOCATION_REVIEW_SHA256,
        "locationEvidence": location_review["locationEvidence"], "pgMapsReview": location_review["pgMapsReview"],
        "rawSampleCoordinateReview": {"sourceSampleStudyRows": 25, "whitelistIntersectionRows": 3, "sourcePointRejected": GENERIC_CITY_COORDINATES, "records": raw_location_checks, "decision": "No raw city-centroid point is used in the physical-site registry or GeoJSON."},
        "rowBindings": [{"nctId": row["nct_id"], "sourceFacility": row["source_facility_name"], "locationCode": row["location_code"], "sourceStatus": row["overall_status"], "sourceValidationTier": row["source_validation_tier"], "registryUrl": row["registry_url"]} for row in relationships],
        "unmatched": [{"nctId": "NCT04105088", "sourceDescription": BROAD_DESCRIPTION, "locationCode": None, "coordinates": None, "reason": UNLOCATED_REASON, "registryUrl": "https://clinicaltrials.gov/study/NCT04105088"}],
        "privacy": "Only allowlisted public science/site metadata is accessed for transformation. Personal contact names, emails, phones, investigators, participant records and interview-target fields are not copied to released rows or provenance.",
        "aggregation": "Distinct NCT IDs per verified site/category, after alias collapse and NCT/site deduplication. Source site summaries, near-site duplicates, C019 copies, and C042 sample rows are not added to these counts. The two released datasets describe the same source records and must not be summed together.",
        "limitations": common_notes,
        "coordinateAttribution": "© OpenStreetMap contributors; coordinate objects and returned location context are available under the Open Database License (ODbL). https://www.openstreetmap.org/copyright",
    }
    geojson = {"type": "FeatureCollection", "name": "Verified physical Prince George trial facilities", "reviewedAt": REVIEWED_AT, "attribution": "© OpenStreetMap contributors · ODbL", "features": [{"type": "Feature", "id": item["code"], "properties": {key: value for key, value in item.items() if key != "coordinates"}, "geometry": {"type": "Point", "coordinates": item["coordinates"]}} for item in locations]}
    return snapshot, provenance, locations, geojson


README = """# Verified trial-site locations

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
"""


def write_or_check(path: Path, content: dict | list | str, check: bool) -> None:
    data = (content if isinstance(content, str) else json.dumps(content, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    if check:
        require(path.exists() and path.read_bytes() == data, f"Generated output differs: {path.relative_to(ROOT)}")
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True, help="Directory containing reviewed DATA-C010, DATA-C019 and DATA-C042 originals")
    parser.add_argument("--refresh", action="store_true", help="Follow authorized manifest/catalogue and retrieve four hash-locked original files")
    parser.add_argument("--headers-file", type=Path, help="Optional private request header JSON; never copied to public output")
    parser.add_argument("--check", action="store_true", help="Verify generated files without writing")
    args = parser.parse_args()
    if args.refresh:
        headers = json.loads(args.headers_file.read_text()) if args.headers_file else {}
        require(isinstance(headers, dict) and all(isinstance(key, str) and isinstance(value, str) for key, value in headers.items()), "Headers must be a JSON string map.")
        refresh(args.input, headers)
    snapshot, provenance, locations, geojson = prepare(args.input)
    for path in ["src/atlas/snapshots/trial-sites.json", "public/data/nhhr/trial-sites.json"]:
        write_or_check(ROOT / path, snapshot, args.check)
    write_or_check(ROOT / "public/data/nhhr/trial-sites-provenance.json", provenance, args.check)
    write_or_check(ROOT / "src/atlas/trialSiteLocations.json", locations, args.check)
    write_or_check(ROOT / "public/data/nhhr/locations-trial-sites.geojson", geojson, args.check)
    write_or_check(ROOT / "public/data/nhhr/locations-trial-sites.README.md", README, args.check)
    print(f"{'Verified' if args.check else 'Prepared'} 4 site/category summaries, 10 unique study-site records, 3 verified physical points and 1 unlocated regional record; original hashes, historical statuses, alias identity and rejected city centroids checked.")


if __name__ == "__main__":
    main()
