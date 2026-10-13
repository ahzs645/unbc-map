#!/usr/bin/env python3
"""Prepare two bounded NHHR public-source views from hash-verified originals."""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
import re
from pathlib import Path
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
BASE = "https://zoer.k8s.overtheedgepaper.ca"
MANIFEST_URL = BASE + "/api/projects/acdd692f-a188-4f85-bb5a-83c48d5c7e82/database/data-spaces/de1fe530-a762-52fa-ba11-d01cc5b344df/manifest"
REVIEWED_AT = "2026-10-12"
SOURCE_VERSION = "NHHR manifest revision 93; source catalogue recovery 2026-10-07"

SOURCES = {
    "waits": {
        "collectionId": "DATA-C072",
        "datasetId": "a2987ed6-8b5d-4548-aab0-10f962545539",
        "filename": "health_authority_wait_times.csv",
        "originalFileId": "d09fd7d5-d771-41df-984d-9873e97f1628",
        "sha256": "4378bc2a00e7a01aa7612d09a5157aafc7a497b5109c3e0ca69dec371c6b7140",
        "tableName": "nhhr_data_c072_8ecfe860a47c_zip_data_c072_health",
        "sourceRelativePath": "outputs/theo_cba_full_data_package_20260831/converted_csv/DATA-C072/health_authority_wait_times.csv",
        "sourceRowCount": 1483,
    },
    "procedures": {
        "collectionId": "DATA-C072",
        "datasetId": "a2987ed6-8b5d-4548-aab0-10f962545539",
        "filename": "procedures.csv",
        "originalFileId": "0978a0a9-04f5-4b60-9901-957dae624290",
        "sha256": "ed0904be958977b318a00a65dea14becd6e3bae83947c854cd2ca619e4bae0c3",
        "tableName": "nhhr_data_c072_8ecfe860a47c_zip_data_c072__13",
        "sourceRelativePath": "outputs/theo_cba_full_data_package_20260831/converted_csv/DATA-C072/procedures.csv",
        "sourceRowCount": 156,
    },
    "periods": {
        "collectionId": "DATA-C072",
        "datasetId": "a2987ed6-8b5d-4548-aab0-10f962545539",
        "filename": "procedure_summaries.csv",
        "originalFileId": "3e267868-b81e-4a46-83c8-f4d970964acf",
        "sha256": "72c14599d022573dabb636ebde5a4ee3c7304f4c049f3c14759bbacda4ca7779",
        "tableName": "nhhr_data_c072_8ecfe860a47c_zip_data_c072__17",
        "sourceRelativePath": "outputs/theo_cba_full_data_package_20260831/converted_csv/DATA-C072/procedure_summaries.csv",
        "sourceRowCount": 321,
        "releasedFields": ["procedure_key", "run_id", "report_as_of", "period_start", "period_end"],
        "excludedFields": ["p50_weeks", "p90_weeks", "cases_waiting", "cases_waiting_raw"],
    },
    "costs": {
        "collectionId": "DATA-C073",
        "datasetId": "8502dc29-352e-4bb5-80a4-1d7b14cd843d",
        "filename": "CIHI_cshs_BC_Sheet1.csv",
        "originalFileId": "48d6a3e1-45c9-4c89-82f7-e1923a0a4a47",
        "sha256": "9372e92ede277c93448bc7b51a56bed9e92106a7b4ad971a37524b09c1ce737a",
        "tableName": "nhhr_recovered_data_c073_20261007_zip_cihi_2",
        "sourceRelativePath": "Generated derivative: CIHI_cshs_BC_Sheet1.csv",
        "sourceRowCount": 417,
        "sourceStatus": "verified-generated-derivative; original workbook separately retained",
        "originalWorkbook": {
            "originalFileId": "d8140f05-d1fb-4f9e-84c2-d8e14d110324",
            "sha256": "7caa4b328a8cd82447bbfce62f7ffa447d54e5a73284be0ab477fa780c768953",
            "tableName": "nhhr_data_c073_2b844a747e06_zip_data_c073__2",
            "sourceRelativePath": "Data Research/healthdata/cihi_cshs/source/cihi_cshs_bc_2026-05.xlsx",
            "worksheet": "Sheet1",
        },
    },
}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def get_bytes(url: str, headers: dict[str, str]) -> bytes:
    with urlopen(Request(url, headers=headers), timeout=45) as response:
        return response.read()


def refresh(input_root: Path, headers: dict[str, str]) -> None:
    manifest = json.loads(get_bytes(MANIFEST_URL, headers))
    listed = {item["id"] for item in manifest["resources"] if item.get("kind") == "dataset" and item.get("available")}
    require(manifest["revision"] == 93, "Manifest revision changed; review source coverage before updating this release.")
    require(all(source["datasetId"] in listed for source in SOURCES.values()), "A reviewed dataset is no longer listed as available.")
    catalogue = next(item for item in manifest["manifestSources"] if item.get("role") == "manifest")
    file_link = next(item for item in catalogue["files"] if item["name"] == "NHHR_files.csv")
    files = list(csv.DictReader(io.StringIO(get_bytes(BASE + file_link["url"], headers).decode("utf-8-sig"))))
    for source in SOURCES.values():
        matches = [item for item in files if item["dataset_id"] == source["datasetId"] and source["originalFileId"] in item["original_file_ids"].split(";")]
        require(any(item["sha256"] == source["sha256"] for item in matches), "Source identity or hash changed; review before refreshing.")
        data = get_bytes(BASE + "/api/files/" + source["originalFileId"] + "/download", headers)
        require(hashlib.sha256(data).hexdigest() == source["sha256"], "Downloaded source hash did not match the reviewed lock.")
        target = input_root / source["collectionId"] / source["filename"]
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)


def read_source(input_root: Path, key: str) -> list[dict[str, str]]:
    source = SOURCES[key]
    data = (input_root / source["collectionId"] / source["filename"]).read_bytes()
    require(hashlib.sha256(data).hexdigest() == source["sha256"], f"Hash changed for {source['filename']}; review before releasing.")
    records = list(csv.DictReader(io.StringIO(data.decode("utf-8-sig"))))
    require(len(records) == source["sourceRowCount"], f"Unexpected source row count for {source['filename']}.")
    return records


def numeric(raw: str) -> int | float | None:
    value = raw.strip().replace(",", "")
    if not value:
        return None
    require(bool(re.fullmatch(r"-?\d+(?:\.\d+)?", value)), "Unexpected numeric source token; do not infer a value.")
    result = float(value)
    require(math.isfinite(result), "Non-finite source measurement.")
    return int(result) if result.is_integer() else result


def column(key: str, label: str, unit: str | None = None, numeric_type: bool = False) -> dict:
    result = {"key": key, "label": label, "type": "number" if numeric_type else "text"}
    if unit:
        result["unit"] = unit
    return result


def prepare(input_root: Path) -> tuple[dict, dict]:
    waits = read_source(input_root, "waits")
    procedures = read_source(input_root, "procedures")
    periods = read_source(input_root, "periods")
    costs = read_source(input_root, "costs")
    procedure_lookup = {row["procedure_key"]: row for row in procedures}
    require(len(procedure_lookup) == len(procedures), "Procedure identifiers are not unique.")
    selected_periods = [row for row in periods if row["run_id"] == "5"]
    period_lookup = {row["procedure_key"]: row for row in selected_periods}
    require(len(period_lookup) == len(selected_periods), "Run 5 procedure-period identifiers are not unique.")
    selected = [row for row in waits if row["run_id"] == "5" and row["health_authority"] == "Northern Health"]
    require(len(selected) == 99 and len({row["procedure_key"] for row in selected}) == 99, "Northern wait-time source grain changed.")
    released_waits = []
    for row in selected:
        procedure = procedure_lookup[row["procedure_key"]]
        period = period_lookup[row["procedure_key"]]
        require(procedure["adult_flag"] in {"Y", "N"}, "Unknown procedure age group.")
        age = "Adult" if procedure["adult_flag"] == "Y" else "Child"
        require((period["report_as_of"], period["period_start"], period["period_end"]) == ("2026-04-30", "2026-02-01", "2026-04-30"), "Northern reporting period changed.")
        p50, p90 = numeric(row["p50_weeks"]), numeric(row["p90_weeks"])
        require(p50 is None or p50 >= 0, "Negative median wait.")
        require(p90 is None or p90 >= 0, "Negative 90th-percentile wait.")
        require(p50 is None or p90 is None or p50 <= p90, "Median wait exceeds 90th-percentile wait.")
        waiting = numeric(row["cases_waiting"])
        raw = row["cases_waiting_raw"]
        if raw == "Less than 5":
            require(waiting is None, "Suppressed waiting counts must remain null.")
            status = "Suppressed: less than 5"
        elif not raw:
            require(waiting is None, "Missing waiting count unexpectedly has a value.")
            status = "Not reported"
        else:
            require(waiting == numeric(raw) and waiting is not None and waiting >= 0, "Waiting count does not match its raw source value.")
            status = "Reported"
        released_waits.append({
            "procedure": f"{procedure['name']} · {age}",
            "procedure_key": row["procedure_key"],
            "procedure_name": procedure["name"],
            "age_group": age,
            "health_authority": row["health_authority"],
            "report_as_of": period["report_as_of"],
            "completed_period_start": period["period_start"],
            "completed_period_end": period["period_end"],
            "cases_waiting_raw": raw,
            "waiting_count_status": status,
            "cases_waiting": waiting,
            "p50_weeks": p50,
            "p90_weeks": p90,
        })
    require(len({row["procedure"] for row in released_waits}) == 99, "Procedure display labels are not unique.")
    require(sum(row["cases_waiting"] is None for row in released_waits) == 40, "Northern waiting-count coverage changed.")
    require(sum(row["p90_weeks"] is None for row in released_waits) == 39, "Northern percentile coverage changed.")

    selected_costs = [row for row in costs if row["Reporting level"] in {"Province/territory", "Health region"}]
    require(len(selected_costs) == 34, "BC province/health-region cost coverage changed.")
    released_costs = []
    for row in selected_costs:
        require(row["Province/territory"] == "British Columbia", "Non-BC record in the BC cost export.")
        require(row["Indicator"] == "Cost of a Standard Hospital Stay" and row["Unit of measure"] == "Dollars", "Cost measure or unit changed.")
        require(row["Time scale"] == "Fiscal year" and re.fullmatch(r"202[0-4]–202[1-5]", row["Time frame"]) is not None, "Unexpected fiscal-year label.")
        start, end = (int(value) for value in row["Time frame"].split("–"))
        require(end == start + 1, "Invalid fiscal period.")
        raw = row["CSHS"]
        value = None if raw == "Suppressed" else numeric(raw)
        require(value is None or value > 0, "Unexpected non-positive standard hospital stay cost.")
        released_costs.append({
            "place_or_organization": row["Place or organization"],
            "reporting_level": row["Reporting level"],
            "province": row["Province/territory"],
            "source_region": row["Region"],
            "fiscal_year": row["Time frame"],
            "cost_per_weighted_case": value,
            "cost_raw": raw,
            "suppression_status": "Suppressed" if raw == "Suppressed" else "Reported" if value is not None else "Not reported",
            "source_refresh_date": row["Refresh date"].split("T")[0],
        })
    cost_keys = {(row["reporting_level"], row["place_or_organization"], row["fiscal_year"]) for row in released_costs}
    require(len(cost_keys) == 34, "Duplicate fiscal-year cost observations.")
    northern_latest = next(row for row in released_costs if row["place_or_organization"] == "Northern Health (B.C.)" and row["fiscal_year"] == "2024–2025")
    require(northern_latest["cost_per_weighted_case"] == 13055, "Northern latest source cost changed.")

    datasets = [
        {
            "id": "surgical-waits-northern",
            "title": "Northern Health scheduled surgery waits",
            "description": "Procedure and age-group aggregates for Northern Health in the collected BC surgical wait-time snapshot. Waiting-list counts and completed-surgery wait percentiles describe different groups.",
            "topic": "Service access",
            "geography": "none",
            "status": "observed",
            "timeLabel": "As of 30 April 2026 · completed surgeries 1 February–30 April · captured 15 June 2026",
            "sourceName": "BC Ministry of Health · Surgery Wait Times",
            "sourceUrl": "https://swt.hlth.gov.bc.ca/swt/WaitTimeDefinitions.xhtml",
            "datasetId": SOURCES["waits"]["datasetId"],
            "tableName": SOURCES["waits"]["tableName"],
            "notes": [
                "One record is a Northern Health procedure and adult/child group. Only run 5 is retained; earlier same-day captures repeat these observations and are not additional patients.",
                "Cases waiting describes the list at 30 April 2026. Median and 90th-percentile waits concern scheduled surgeries completed during 1 February–30 April 2026, from the booking received by the health authority to surgery. They do not predict an individual's wait or include the full referral journey.",
                "Forty waiting counts are published as Less than 5 and remain null numerically. Thirty-nine 90th-percentile values are unreported. Missing or suppressed values are not zero; percentiles must not be averaged or summed across procedures.",
                "Procedure labels and age groups join through procedure_key. Reporting dates join through run_id and procedure_key. The separate province-wide procedure-summary percentile columns fail basic consistency checks and are excluded; these waits come only from the health-authority table.",
                "This is a historical capture, not a current clinical service directory, patient demand estimate, or evidence of an NHHR effect. No provider contact or patient records are released, and no HSDA/LHA allocation is inferred.",
            ],
            "columns": [
                column("procedure", "Procedure and age group"),
                column("procedure_key", "Source procedure key"),
                column("procedure_name", "Procedure"),
                column("age_group", "Age group"),
                column("health_authority", "Health authority"),
                column("report_as_of", "Reported as of"),
                column("completed_period_start", "Completed-surgery period start"),
                column("completed_period_end", "Completed-surgery period end"),
                column("cases_waiting_raw", "Waiting count · source text"),
                column("waiting_count_status", "Waiting-count reporting status"),
                column("cases_waiting", "Cases waiting · 30 April 2026", "cases", True),
                column("p50_weeks", "Median wait · completed surgeries", "weeks", True),
                column("p90_weeks", "90th-percentile wait · completed surgeries", "weeks", True),
            ],
            "rows": released_waits,
            "defaultMetric": "p90_weeks",
            "entityField": "procedure",
            "timeField": "report_as_of",
        },
        {
            "id": "hospital-stay-costs",
            "title": "BC standard hospital stay costs",
            "description": "CIHI's fiscal-year cost per weighted acute inpatient case, retained separately for the BC province and reporting health regions. This adjusted accounting measure is not a patient bill or a marginal saving.",
            "topic": "Health system costs",
            "geography": "ha",
            "status": "observed",
            "timeLabel": "FY2020–2021 to FY2024–2025 · source refresh 19 May 2026",
            "sourceName": "Canadian Institute for Health Information · CSHS",
            "sourceUrl": "https://www.cihi.ca/en/indicators/cost-of-a-standard-hospital-stay-cshs",
            "datasetId": SOURCES["costs"]["datasetId"],
            "tableName": SOURCES["costs"]["tableName"],
            "notes": [
                "CSHS relates acute inpatient expenses to weighted inpatient cases. Case weighting accounts for differing resource needs. The source measure excludes day procedures and must not be read as the bill for a particular person or procedure.",
                "Each record has an explicit reporting level. Province and health-region observations overlap geographically; they must not be added together or averaged into a provincial cost. Hospital-level records are excluded from this view.",
                "The BC worksheet is used once. The separate Canada export overlaps it and is not appended. Six entities have five fiscal periods; PHSA begins at FY2021–2022 because FY2020–2021 is absent in the reviewed BC source.",
                "Dollar values describe their source fiscal years; no inflation adjustment is applied. Differences can reflect organizational structure, staffing, facility characteristics, methods, and data quality. They do not alone identify inefficiency or an avoidable expense.",
                "Cost per weighted case cannot be multiplied by a hypothetical avoided event and presented as an NHHR budget saving. Actual changes, case mix, and marginal costs would require separate evidence. No patient records or invented geographic codes are included.",
                "The map uses an explicit reviewed source-region-label crosswalk to the five territorial BC health-authority polygons. Province and PHSA observations remain unmatched and available in charts and records; they are not a sixth polygon or distributed among authorities. Polygons locate reporting authorities, not residents' costs or utilization. Boundary vintage is unestablished.",
            ],
            "columns": [
                column("place_or_organization", "Province / reporting health region"),
                column("reporting_level", "Reporting level"),
                column("province", "Province"),
                column("source_region", "Region · source label"),
                column("fiscal_year", "Fiscal year"),
                column("cost_per_weighted_case", "Cost per weighted acute inpatient case", "CAD", True),
                column("cost_raw", "Cost · source text"),
                column("suppression_status", "Reporting status"),
                column("source_refresh_date", "Source refresh date"),
            ],
            "rows": released_costs,
            "defaultMetric": "cost_per_weighted_case",
            "entityField": "place_or_organization",
            "timeField": "fiscal_year",
            "boundaryKeyField": "source_region",
        },
    ]
    for dataset in datasets:
        require(0 < len(dataset["rows"]) < 1000, "Release exceeds its bounded row scope.")
        allowed = {item["key"] for item in dataset["columns"]}
        require(all(set(row) == allowed for row in dataset["rows"]), "A row contains an unallowlisted field.")
    evidence = {"reviewedAt": REVIEWED_AT, "sourceVersion": SOURCE_VERSION, "datasets": datasets}
    provenance = {
        "reviewedAt": REVIEWED_AT,
        "manifestUrl": MANIFEST_URL,
        "manifestRevision": 93,
        "sourceVersion": SOURCE_VERSION,
        "releaseScope": "Bounded public secondary aggregates only; no participant, consent, contact, or ethics-draft records.",
        "sources": SOURCES,
        "releases": {
            "surgical-waits-northern": {"rows": 99, "sourceKeys": ["waits", "procedures", "periods"], "selection": "run_id=5 and health_authority=Northern Health; periods and labels joined by source keys", "uniqueness": "procedure_key", "suppressedWaitingCounts": 40, "unreportedP90Values": 39},
            "hospital-stay-costs": {"rows": 34, "sourceKeys": ["costs"], "selection": "BC worksheet Reporting level in Province/territory or Health region", "uniqueness": "reporting_level + place_or_organization + fiscal_year", "excluded": "Facility and corporation rows; overlapping Canada export"},
        },
        "qualityFindings": [
            "Latest surgical run 5 repeats run 1, which is not appended.",
            "Procedure-summary p50 equals cases_waiting in 265 of 321 source records; 235 p50 values exceed p90. Those numeric columns are excluded rather than repaired by guessing.",
            "Northern health-authority percentile pairs satisfy p50<=p90; suppressed and missing measurements stay null.",
            "BC cost records have one observation per reporting level, entity, and fiscal year; the source's absent PHSA FY2020–2021 is not created as a zero.",
            "Five exact source reporting labels map to BC territorial HA identifiers; province and PHSA rows deliberately have no polygon. See crosswalk-health-authority.json and its README for the reviewed identity lookup.",
        ],
        "methodReferences": [
            "https://swt.hlth.gov.bc.ca/swt/WaitTimeDefinitions.xhtml",
            "https://www.cihi.ca/en/indicators/cost-of-a-standard-hospital-stay-cshs",
        ],
        "rightsNote": "Original publisher terms and attribution apply. The source catalogue's sharing classification is not blanket permission for unrelated or participant-level content.",
    }
    return evidence, provenance


def write_or_check(path: Path, value: dict, check: bool) -> None:
    content = (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    if check:
        require(path.exists() and path.read_bytes() == content, f"Generated file differs: {path.relative_to(ROOT)}")
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True, help="Directory containing DATA-C072 and DATA-C073 source CSVs")
    parser.add_argument("--refresh", action="store_true", help="Follow the authorized manifest and catalogue, then download the reviewed source IDs")
    parser.add_argument("--headers-file", type=Path, help="Optional private JSON request headers; never written to release files")
    parser.add_argument("--check", action="store_true", help="Verify generated files without changing them")
    args = parser.parse_args()
    if args.refresh:
        headers = json.loads(args.headers_file.read_text()) if args.headers_file else {}
        require(isinstance(headers, dict) and all(isinstance(key, str) and isinstance(value, str) for key, value in headers.items()), "Request headers must be a JSON string map.")
        refresh(args.input, headers)
    evidence, provenance = prepare(args.input)
    write_or_check(ROOT / "src/atlas/snapshots/additional-evidence.json", evidence, args.check)
    write_or_check(ROOT / "public/data/nhhr/additional-evidence.json", evidence, args.check)
    write_or_check(ROOT / "public/data/nhhr/additional-evidence-provenance.json", provenance, args.check)
    print(f"{'Verified' if args.check else 'Prepared'} 2 additional datasets / 133 source records; SHA256, source grain, periods, suppression, and percentile validity checked.")


if __name__ == "__main__":
    main()
