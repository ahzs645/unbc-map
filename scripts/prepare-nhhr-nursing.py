#!/usr/bin/env python3
"""Prepare 120 Northern HSDA nursing observations from a hash-locked CIHI workbook.

Offline: python3 scripts/prepare-nhhr-nursing.py --input /tmp/nhhr-connection-review
Refresh: python3 scripts/prepare-nhhr-nursing.py --refresh --input /tmp/nhhr-refresh
Optional private headers: --headers-file /private/path/headers.json
Use --check to compare all generated outputs without modifying them.
The original workbook remains read-only and is never copied into the public release.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
import posixpath
import re
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://zoer.k8s.overtheedgepaper.ca"
MANIFEST_URL = BASE + "/api/projects/acdd692f-a188-4f85-bb5a-83c48d5c7e82/database/data-spaces/de1fe530-a762-52fa-ba11-d01cc5b344df/manifest"
METHOD_URL = "https://www.cihi.ca/sites/default/files/document/nursing-in-canada-2024-meth-notes-en.pdf"
PUBLISHER_URL = "https://www.cihi.ca/en/the-state-of-the-health-workforce-in-canada-2024/go-in-depth-2024-health-workforce-data"
SOURCE = {
    "collectionId": "DATA-C040",
    "datasetId": "50a3dad1-f1e4-413d-9519-356f1089c53f",
    "filename": "nursing-in-canada-2015-2024-data-tables-en.xlsx",
    "originalFileId": "e397fa11-b96a-454e-b640-0be14dbdc269",
    "sha256": "a734d082d9ad06235b1dc000aa791054eec1ed7919a96eb01be197a3b01d1386",
    "sourceRelativePath": "Data Research/Data/raw/cihi/nursing-in-canada-2015-2024-data-tables-en.xlsx",
    "worksheets": {
        "Table 11": {"tableName": "nhhr_data_c040_0efa8996e66d_zip_data_c040__34", "gridRows": 349, "part": "xl/worksheets/sheet13.xml", "measure": "Direct-care nurse count"},
        "Table 12": {"tableName": "nhhr_data_c040_0efa8996e66d_zip_data_c040__35", "gridRows": 346, "part": "xl/worksheets/sheet14.xml", "measure": "Direct-care nurses per 10,000 population"},
    },
}
REGION_LINKS = {"Northwest HSDA": "51", "Northern Interior HSDA": "52", "Northeast HSDA": "53"}
NURSING_TYPES = ["Nurse practitioners", "Registered nurses", "Registered psychiatric nurses", "Licensed practical nurses"]
YEARS = [str(year) for year in range(2015, 2025)]
HEADER = ["Type of professional", "Province/territory", "Health region", *YEARS]
MISSING_STATUS = "Not applicable, nonexistent or unreported (source marker)"
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main", "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def get_bytes(url: str, headers: dict[str, str]) -> bytes:
    with urlopen(Request(url, headers=headers), timeout=45) as response:
        return response.read()


def refresh(input_root: Path, headers: dict[str, str]) -> None:
    # The manifest identifies resources; scientific rows come from the source workbook.
    manifest = json.loads(get_bytes(MANIFEST_URL, headers))
    resources = [r for r in manifest.get("resources", []) if r.get("kind") == "dataset" and r.get("id") == SOURCE["datasetId"]]
    require(len(resources) == 1 and resources[0].get("available"), "Reviewed nursing dataset is not available in the authorized manifest.")
    descriptor = json.loads(get_bytes(BASE + "/api/datasets/" + SOURCE["datasetId"], headers)).get("dataset", {})
    require(descriptor.get("id") == SOURCE["datasetId"], "Selected dataset identity did not match the reviewed source.")
    catalogue = next(r for r in manifest["manifestSources"] if r.get("role") == "manifest")
    file_link = next(r for r in catalogue["files"] if r["name"] == "NHHR_files.csv")
    table_link = next(r for r in catalogue["files"] if r["name"] == "NHHR_tables.csv")
    files = list(csv.DictReader(io.StringIO(get_bytes(BASE + file_link["url"], headers).decode("utf-8-sig"))))
    tables = list(csv.DictReader(io.StringIO(get_bytes(BASE + table_link["url"], headers).decode("utf-8-sig"))))
    file_records = [r for r in files if r["dataset_id"] == SOURCE["datasetId"] and SOURCE["originalFileId"] in r["original_file_ids"].split(";")]
    require(any(r["sha256"] == SOURCE["sha256"] for r in file_records), "Original nursing file identity/hash changed; review before refreshing.")
    for worksheet, lock in SOURCE["worksheets"].items():
        matches = [r for r in tables if r["dataset_id"] == SOURCE["datasetId"] and r["table_name"] == lock["tableName"]]
        require(len(matches) == 1 and matches[0]["source_sha256"] == SOURCE["sha256"] and matches[0]["worksheet"] == worksheet and int(matches[0]["row_count"]) == lock["gridRows"], f"Source identity, worksheet or grid changed for {worksheet}.")
    data = get_bytes(BASE + "/api/files/" + SOURCE["originalFileId"] + "/download", headers)
    require(hashlib.sha256(data).hexdigest() == SOURCE["sha256"], "Downloaded workbook hash differs from reviewed source.")
    target = input_root / SOURCE["collectionId"] / SOURCE["filename"]
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)


def read_workbook(data: bytes) -> dict[str, dict[int, dict[str, str | None]]]:
    """Read original cached cell literals using only the Python standard library."""
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        shared = ["".join(t.text or "" for t in s.findall(".//m:t", NS)) for s in ET.fromstring(archive.read("xl/sharedStrings.xml")).findall("m:si", NS)]
        relationships = {r.attrib["Id"]: r.attrib["Target"] for r in ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))}
        sheets = ET.fromstring(archive.read("xl/workbook.xml")).findall("m:sheets/m:sheet", NS)
        parts = {s.attrib["name"]: posixpath.normpath("xl/" + relationships[s.attrib["{" + NS["r"] + "}id"]]) for s in sheets}
        result = {}
        for name, lock in SOURCE["worksheets"].items():
            require(parts.get(name) == lock["part"], f"Worksheet relationship changed for {name}.")
            tree = ET.fromstring(archive.read(parts[name]))
            rows = {}
            for row in tree.findall("m:sheetData/m:row", NS):
                values = {}
                for cell in row.findall("m:c", NS):
                    # Only A:M is relevant; extra styling/merged columns are not scientific observations.
                    column = re.match(r"[A-Z]+", cell.attrib["r"]).group()
                    if column not in set("ABCDEFGHIJKLM"):
                        continue
                    require(cell.find("m:f", NS) is None, f"Unexpected formula in {name}!{cell.attrib['r']}; no recalculation is authorized.")
                    value = cell.find("m:v", NS)
                    if cell.get("t") == "s" and value is not None:
                        literal = shared[int(value.text)]
                    elif cell.get("t") == "inlineStr":
                        literal = "".join(t.text or "" for t in cell.findall(".//m:t", NS))
                    else:
                        literal = value.text if value is not None else None
                    values[column] = literal
                rows[int(row.attrib["r"])] = values
            require(max(rows) == lock["gridRows"], f"Original grid row count changed for {name}.")
            require([rows[2].get(c) for c in "ABCDEFGHIJKLM"] == HEADER, f"Unexpected source header/years for {name}.")
            expected_title = f"Table {11 if name == 'Table 11' else 12}  Regulated nurses employed in direct care"
            require(rows[1].get("A", "").startswith(expected_title), f"Source table title changed for {name}.")
            if name == "Table 12":
                require("per 10,000 population" in rows[1]["A"], "Source rate unit differs from per 10,000 population.")
            result[name] = rows
        return result


def numeric(literal: str | None, count: bool) -> tuple[int | float | None, str]:
    if literal == "—":
        return None, MISSING_STATUS
    require(literal is not None and literal != "", "Unexpected blank source cell; review its meaning before release.")
    value = float(literal)
    require(math.isfinite(value) and value >= 0, "Invalid numeric workforce value.")
    if count:
        require(value.is_integer(), "Direct-care count must be an integer.")
        return int(value), "Reported"
    return int(value) if value.is_integer() else value, "Reported"


def prepare(input_root: Path) -> tuple[dict, dict]:
    data = (input_root / SOURCE["collectionId"] / SOURCE["filename"]).read_bytes()
    require(hashlib.sha256(data).hexdigest() == SOURCE["sha256"], "Source workbook hash differs; deliberate review is required before release.")
    tables = read_workbook(data)
    indexes = {}
    for name, grid in tables.items():
        index = {}
        for row_number, row in grid.items():
            if row.get("B") != "British Columbia" or row.get("C") not in REGION_LINKS:
                continue
            require(row.get("A") in NURSING_TYPES, "Unexpected nursing profession in selected region.")
            for column, year in zip("DEFGHIJKLM", YEARS):
                key = (row["C"], row["A"], year)
                require(key not in index, f"Duplicate region/profession/year in {name}.")
                index[key] = {"raw": row.get(column), "cell": f"{column}{row_number}"}
        require(len(index) == 120, f"Selected {name} does not contain all 120 expected observations.")
        indexes[name] = index
    require(indexes["Table 11"].keys() == indexes["Table 12"].keys(), "Count/rate source keys differ; no partial or guessed join is allowed.")
    boundary = json.loads((ROOT / "public/data/nhhr/boundaries-hsda.geojson").read_text())
    boundary_labels = {f["properties"]["code"]: f["properties"]["name"] for f in boundary["features"]}
    for region, code in REGION_LINKS.items():
        require(boundary_labels.get(code) == region.removesuffix(" HSDA"), f"Reviewed HSDA crosswalk no longer matches boundary identity for {region}.")
    rows = []
    for profession in NURSING_TYPES:
        for region, code in REGION_LINKS.items():
            for year in YEARS:
                key = (region, profession, year)
                count_cell, rate_cell = indexes["Table 11"][key], indexes["Table 12"][key]
                count, count_status = numeric(count_cell["raw"], True)
                rate, rate_status = numeric(rate_cell["raw"], False)
                rows.append({"region_name": region, "hsda_code": code, "nursing_type": profession, "year": year,
                    "direct_care_nurses": count, "direct_care_per_10k": rate,
                    "source_direct_care_nurses_raw": count_cell["raw"], "source_direct_care_per_10k_raw": rate_cell["raw"],
                    "direct_care_status": count_status, "rate_status": rate_status,
                    "source_count_cell": "Table 11!" + count_cell["cell"], "source_rate_cell": "Table 12!" + rate_cell["cell"]})
    require(len({(r["hsda_code"], r["nursing_type"], r["year"]) for r in rows}) == 120, "Release has duplicate observation keys.")
    missing = [r for r in rows if r["direct_care_nurses"] is None or r["direct_care_per_10k"] is None]
    require(len(missing) == 3 and all(r["nursing_type"] == "Registered psychiatric nurses" and r["year"] == "2019" and r["source_direct_care_nurses_raw"] == r["source_direct_care_per_10k_raw"] == "—" for r in missing), "Unexpected source missing-value coverage.")
    require({r["hsda_code"]: r["direct_care_nurses"] for r in rows if r["nursing_type"] == "Nurse practitioners" and r["year"] == "2024"} == {"51": 14, "52": 28, "53": 7}, "Independent 2024 NP source counts failed validation.")
    notes = [
        "One observation is an HSDA, nursing type and year. Table 11 counts and Table 12 publisher rates join by exact province, region label, nursing type and year; their worksheet row numbers differ. Select one year and nursing type to map. All-type groups remain ambiguous rather than summed.",
        "Direct care means services provided directly to clients. These regional counts exclude nursing administration, education and research. They are not full-time equivalents, vacancies, research staffing or a measure of appointment access.",
        "Publisher rates per 10,000 population are copied from Table 12. They are not recalculated using Atlas population, 2025 projections or rounded source counts. Rates are not summed or averaged across regions or professions.",
        "The source em-dash means not applicable, nonexistent or unreported because of quality issues; it does not specify which. All three 2019 psychiatric-nurse records retain null counts/rates and the exact raw marker. The Northeast NP count/rate in 2018 is a genuine reported zero.",
        "The workbook references PCCF 2022 and Statistics Canada July 1 population estimates using 2023 health-region boundaries. Atlas polygons have an unestablished vintage and provide context only; no boundary harmonization or individual postal-code reassignment is performed.",
        "CIHI assigns regions using primary-worksite postal codes, with residence postal codes when worksite data is absent. The enhanced regional mapping introduced in 2021 applies to the reported 2015–2024 series. BC regulatory and reporting changes require care with historical comparisons, especially 2018–2019.",
        "The source is CIHI Nursing in Canada, 2024, Tables 11 and 12. No individual registrations, identities, contacts or participant records are included. Source collection and current service availability are different questions.",
    ]
    columns = [
        {"key": "region_name", "label": "Health service delivery area", "type": "text"},
        {"key": "hsda_code", "label": "BC HSDA code", "type": "text"},
        {"key": "nursing_type", "label": "Nursing type", "type": "text"},
        {"key": "year", "label": "Year", "type": "text"},
        {"key": "direct_care_nurses", "label": "Nurses employed in direct care", "type": "number", "unit": "nurses"},
        {"key": "direct_care_per_10k", "label": "Direct-care nurses per 10,000 population", "type": "number", "unit": "per 10,000"},
        {"key": "source_direct_care_nurses_raw", "label": "Source count literal", "type": "text"},
        {"key": "source_direct_care_per_10k_raw", "label": "Source rate literal", "type": "text"},
        {"key": "direct_care_status", "label": "Count reporting status", "type": "text"},
        {"key": "rate_status", "label": "Rate reporting status", "type": "text"},
        {"key": "source_count_cell", "label": "Count source cell", "type": "text"},
        {"key": "source_rate_cell", "label": "Rate source cell", "type": "text"},
    ]
    dataset = {"id": "nursing-workforce-northern", "title": "Nursing direct-care workforce in Northern health regions", "description": "CIHI direct-care nurse counts and published population rates for Northwest, Northern Interior and Northeast HSDAs, by nursing type and year.",
        "topic": "Workforce", "geography": "hsda", "status": "observed", "timeLabel": "2015–2024 · CIHI Nursing in Canada, 2024 source edition", "sourceName": "Canadian Institute for Health Information · Nursing in Canada, 2024", "sourceUrl": PUBLISHER_URL,
        "datasetId": SOURCE["datasetId"], "tableName": SOURCE["worksheets"]["Table 11"]["tableName"] + " + " + SOURCE["worksheets"]["Table 12"]["tableName"],
        "notes": notes, "columns": columns, "rows": rows, "defaultMetric": "direct_care_per_10k", "entityField": "region_name", "timeField": "year", "boundaryKeyField": "hsda_code", "defaultFilters": {"nursing_type": "Registered nurses"}}
    evidence = {"datasets": [dataset], "snapshot": {"reviewedAt": "2026-10-12", "manifestUrl": MANIFEST_URL, "datasetCount": 1, "rowCount": 120, "releaseScope": "Public regional nursing aggregates; four source professions and ten years, no individual records."}}
    lineage = []
    for name, lock in SOURCE["worksheets"].items():
        grid = tables[name]
        source_lines = [r["A"].strip() for r in grid.values() if r.get("A", "").startswith("Statistics Canada.") or r.get("A", "").startswith("Health Workforce Database,")]
        lineage.append({"worksheet": name, **lock, "title": grid[1]["A"], "headerCells": "A2:M2", "headers": HEADER, "sourceStatements": source_lines})
    provenance = {"schema": "nhhr-nursing-workforce-v1", "reviewedAt": "2026-10-12", "manifestRevisionReviewed": 93, "manifestUrl": MANIFEST_URL, "source": SOURCE,
        "publisherUrl": PUBLISHER_URL, "methodologyUrl": METHOD_URL, "sourceTables": lineage,
        "selection": {"province": "British Columbia", "regions": list(REGION_LINKS), "nursingTypes": NURSING_TYPES, "years": YEARS},
        "crosswalk": [{"sourceProvince": "British Columbia", "sourceRegionName": region, "bcHsdaCode": code, "boundaryLabel": boundary_labels[code]} for region, code in REGION_LINKS.items()],
        "crosswalkMethod": "Explicit three-row source-name identity lookup verified against the Ministry of Health HSDA index. No fuzzy matching, generic prefix inference or geographic allocation.",
        "joinKeys": ["province", "region_name", "nursing_type", "year"], "uniqueness": "hsda_code + nursing_type + year", "rows": 120,
        "validation": {"countKeys": 120, "rateKeys": 120, "exactJoinedKeys": 120, "unmatchedKeys": 0, "duplicateKeys": 0, "boundaryMatches": 120, "unreportedCountValues": 3, "unreportedRateValues": 3, "sourceUnreportedMarker": "—", "unreportedMeaning": MISSING_STATUS, "reportedNortheastNp2018ZeroPreserved": True, "np2024Counts": {"51": 14, "52": 28, "53": 7}},
        "methods": ["Original cached cell literals from the selected workbook sheets only; no formulas are recalculated.", "Numeric counts and publisher rates parsed directly; exact source literals, source cell coordinates and reporting statuses retained.", "Counts/rates joined by explicit keys rather than worksheet row positions; no missing-cell imputation or rates aggregation.", "Only public HSDA/type/year aggregates are released. Raw source bytes and authorized request headers remain outside the public release."],
        "limitations": notes,
        "rightsNote": "© Canadian Institute for Health Information. Original publisher terms and attribution apply; this extract does not imply CIHI endorsement. The source catalogue's sharing classification is not blanket permission for unrelated individual-level content."}
    return evidence, provenance


def write_or_check(path: Path, value: dict, check: bool) -> None:
    content = (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")
    if check:
        require(path.exists() and path.read_bytes() == content, f"Generated file differs: {path.relative_to(ROOT)}")
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True, help="Directory containing DATA-C040 and the reviewed original workbook")
    parser.add_argument("--refresh", action="store_true", help="Verify manifest/dataset/catalogue identities then download the hash-locked original")
    parser.add_argument("--headers-file", type=Path, help="Optional private JSON request headers, never written to generated files")
    parser.add_argument("--check", action="store_true", help="Check deterministic generated outputs without modifying them")
    args = parser.parse_args()
    if args.refresh:
        headers = json.loads(args.headers_file.read_text()) if args.headers_file else {}
        require(isinstance(headers, dict) and all(isinstance(k, str) and isinstance(v, str) for k, v in headers.items()), "Request headers must be a JSON string map.")
        refresh(args.input, headers)
    evidence, provenance = prepare(args.input)
    write_or_check(ROOT / "src/atlas/snapshots/nursing-workforce.json", evidence, args.check)
    write_or_check(ROOT / "public/data/nhhr/nursing-workforce.json", evidence, args.check)
    write_or_check(ROOT / "public/data/nhhr/nursing-workforce-provenance.json", provenance, args.check)
    print(f"{'Verified' if args.check else 'Prepared'} 120 Northern HSDA nursing observations; exact count/rate joins, three unreported pairs, one genuine zero and source SHA-256 checked.")


if __name__ == "__main__":
    main()
