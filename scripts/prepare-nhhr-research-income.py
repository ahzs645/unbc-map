#!/usr/bin/env python3
"""Prepare bounded CAUBO sponsored-research income from reviewed annual sources."""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
import posixpath
import re
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from pathlib import Path
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parents[1]
BASE = "https://zoer.k8s.overtheedgepaper.ca"
MANIFEST_URL = BASE + "/api/projects/acdd692f-a188-4f85-bb5a-83c48d5c7e82/database/data-spaces/de1fe530-a762-52fa-ba11-d01cc5b344df/manifest"
DATASET_ID = "a90c9d46-801e-4a6d-9b04-b3835def053a"
REVIEWED_AT = "2026-10-12"
UNIT_STATEMENT = "The amounts are in thousands of dollars."
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

DERIVATIVE = {
    "filename": "CAUBO_available_annual_records_2020-2024.csv",
    "originalFileId": "c4d97c0e-15af-4e72-b0c0-ebf0e79c22f4",
    "sha256": "9e0b4fe3129f22aa49d314b30890784a1fe1122f122ea123c61d5a93c88fc51c",
    "sourceRelativePath": "Generated derivative: CAUBO_available_annual_records_2020-2024.csv",
    "tableName": "nhhr_recovered_data_c052_20261007_zip_caubo_avai",
    "tableParquetSha256": "927d0d33ee61207eb22ac2ad693f5164d2f6eb5b6015025da3fa75286913fd09",
    "sourceRowCount": 39359,
}
WORKBOOKS = [
    {
        "period": "2020-2021", "filename": "caubo_fiuc_2020-2021.xlsx",
        "originalFileId": "ab965263-ec79-43e2-a800-020f3c162172",
        "sha256": "c88770cb634bc33b90002d15141f9dfaa9798cb4013f4d8b9d2834aa8d267a4d",
        "tableName": "nhhr_data_c052_e16435c9c282_zip_data_c052__4",
        "archiveMember": "2020-2021 - CAUBO  data - English.xlsx",
    },
    {
        "period": "2021-2022", "filename": "caubo_fiuc_2021-2022.xlsx",
        "originalFileId": "e9555733-b2ea-422f-9809-7ef4612b5d52",
        "sha256": "f24f7d2d4137b95cd5500d687bcda54dacec8a3682d3a989e21a6f8b7ca3508f",
        "tableName": "nhhr_data_c052_e16435c9c282_zip_data_c052__21",
        "archiveMember": "2021-2022 - CAUBO data - English.xlsx",
    },
    {
        "period": "2022-2023", "filename": "caubo_fiuc_2022-2023.xlsx",
        "originalFileId": "ab0fcaa2-40f2-49dd-a5e0-95999aa90d63",
        "sha256": "fbeba869e1f0ca39fe470a402c42373907a57998804b659ac46afc06013ff9d3",
        "tableName": "nhhr_data_c052_e16435c9c282_zip_data_c052__35", "archiveMember": "",
    },
    {
        "period": "2023-2024", "filename": "caubo_fiuc_2023-2024.xlsx",
        "originalFileId": "21cad511-e6ae-4ee6-a04e-2efa51d63c9f",
        "sha256": "034b63b5770e30f857c4cf6c665ff76bf863842fe3c69488b069fd9ed502d48c",
        "tableName": "nhhr_data_c052_e16435c9c282_zip_data_c052__52", "archiveMember": "",
    },
]

# The code is the join key; names are checked against each original source row.
INSTITUTIONS = {
    "830": ("Calgary / Calgary", "University of Calgary"),
    "232": ("Dalhousie / Halifax", "Dalhousie University"),
    "538": ("Lakehead / Thunder Bay", "Lakehead University"),
    "918": ("UBC / Vancouver", "The University of British Columbia"),
    "996": ("UNBC / Prince George", "University of Northern British Columbia"),
    "766": ("USask / Saskatoon", "University of Saskatchewan"),
    "546": ("NOSM / Thunder Bay", "Northern Ontario School of Medicine"),
}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def get_bytes(url: str, headers: dict[str, str]) -> bytes:
    with urlopen(Request(url, headers=headers), timeout=45) as response:
        return response.read()


def source_path(source: dict) -> str:
    return source.get("sourceRelativePath", "Data Research/Data/raw/source_pull_2026-04-28/caubo/" + source["filename"])


def refresh(input_root: Path, headers: dict[str, str]) -> None:
    manifest = json.loads(get_bytes(MANIFEST_URL, headers))
    require(manifest["revision"] == 93, "Manifest version changed; review the source coverage before refreshing this release.")
    dataset = next((item for item in manifest["resources"] if item.get("kind") == "dataset" and item["id"] == DATASET_ID), None)
    require(dataset is not None and dataset.get("available"), "The reviewed CAUBO dataset is not listed as available.")
    require(DERIVATIVE["tableName"] in {item["name"] for item in dataset["tables"]}, "The reviewed scientific table is no longer listed.")
    catalogue = next(item for item in manifest["manifestSources"] if item.get("role") == "manifest")
    files_link = next(item for item in catalogue["files"] if item["name"] == "NHHR_files.csv")
    tables_link = next(item for item in catalogue["files"] if item["name"] == "NHHR_tables.csv")
    with ThreadPoolExecutor(max_workers=2) as pool:
        contents = list(pool.map(lambda link: get_bytes(BASE + link["url"], headers), [files_link, tables_link]))
    files = list(csv.DictReader(io.StringIO(contents[0].decode("utf-8-sig"))))
    tables = list(csv.DictReader(io.StringIO(contents[1].decode("utf-8-sig"))))
    sources = [DERIVATIVE, *WORKBOOKS]
    for source in sources:
        matches = [row for row in files if row["dataset_id"] == DATASET_ID and source["originalFileId"] in row["original_file_ids"].split(";")]
        require(any(row["sha256"] == source["sha256"] for row in matches), "A CAUBO original file identifier or hash changed.")
        matches = [row for row in tables if row["dataset_id"] == DATASET_ID and row["table_name"] == source["tableName"]]
        require(len(matches) == 1, "A reviewed scientific table is missing or ambiguous.")
        if source is DERIVATIVE:
            require(matches[0]["parquet_sha256"] == source["tableParquetSha256"] and int(matches[0]["row_count"]) == source["sourceRowCount"], "Recovered table version changed.")
        else:
            require(matches[0]["source_sha256"] == source["sha256"] and matches[0]["worksheet"] == "Income - Data", "Annual workbook table identity changed.")

    def download(source: dict) -> None:
        data = get_bytes(BASE + "/api/files/" + source["originalFileId"] + "/download", headers)
        require(hashlib.sha256(data).hexdigest() == source["sha256"], "Downloaded source hash does not match the reviewed lock.")
        path = input_root / "DATA-C052" / source["filename"]
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    with ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(download, sources))


def read_locked(input_root: Path, source: dict) -> bytes:
    data = (input_root / "DATA-C052" / source["filename"]).read_bytes()
    require(hashlib.sha256(data).hexdigest() == source["sha256"], f"Hash changed for {source['filename']}; review before releasing.")
    return data


def workbook_cells(data: bytes, source: dict) -> tuple[dict[str, str], dict[str, str]]:
    """Read cached OOXML cells, including the two reviewed ZIP-wrapped originals."""
    with ZipFile(io.BytesIO(data)) as outer:
        if source["archiveMember"]:
            require(source["archiveMember"] in outer.namelist(), "Expected nested annual workbook is absent.")
            workbook_data = outer.read(source["archiveMember"])
        else:
            workbook_data = data
    with ZipFile(io.BytesIO(workbook_data)) as workbook:
        require("xl/workbook.xml" in workbook.namelist(), "Annual source is not an OOXML workbook.")
        strings = []
        if "xl/sharedStrings.xml" in workbook.namelist():
            strings = ["".join(node.itertext()) for node in ET.fromstring(workbook.read("xl/sharedStrings.xml")).findall("m:si", NS)]
        relationships = {node.attrib["Id"]: node.attrib["Target"] for node in ET.fromstring(workbook.read("xl/_rels/workbook.xml.rels"))}
        sheets = ET.fromstring(workbook.read("xl/workbook.xml")).findall("m:sheets/m:sheet", NS)
        output = {}
        for sheet in sheets:
            name = sheet.attrib["name"]
            if name not in {"COVER PAGE", "Income - Data"}:
                continue
            target = relationships[sheet.attrib[f"{{{REL_NS}}}id"]]
            target = posixpath.normpath(target.lstrip("/") if target.startswith("/") else "xl/" + target)
            require(target.startswith("xl/"), "Unexpected workbook relationship path.")
            cells = {}
            for cell in ET.fromstring(workbook.read(target)).findall(".//m:c", NS):
                value_node = cell.find("m:v", NS)
                value = value_node.text or "" if value_node is not None else ""
                if cell.attrib.get("t") == "s":
                    value = strings[int(value)]
                elif cell.attrib.get("t") == "inlineStr":
                    value = "".join(cell.find("m:is", NS).itertext())
                cells[cell.attrib["r"]] = value
            output[name] = cells
        require(set(output) == {"COVER PAGE", "Income - Data"}, "Annual unit or income sheet is missing.")
        return output["COVER PAGE"], output["Income - Data"]


def numeric(raw: str) -> Decimal | None:
    value = raw.strip().replace(",", "")
    if not value:
        return None
    require(re.fullmatch(r"-?\d+(?:\.\d+)?", value) is not None, "Unknown financial token; do not infer a measurement.")
    result = Decimal(value)
    require(result.is_finite(), "Non-finite source measurement.")
    return result


def json_number(value: Decimal | None) -> int | float | None:
    if value is None:
        return None
    if value == value.to_integral_value():
        return int(value)
    result = float(value)
    require(math.isfinite(result), "Non-finite converted measurement.")
    return result


def prepare(input_root: Path) -> tuple[dict, dict]:
    records = list(csv.DictReader(io.StringIO(read_locked(input_root, DERIVATIVE).decode("utf-8-sig"))))
    require(len(records) == DERIVATIVE["sourceRowCount"], "Recovered annual-record coverage changed.")
    locations = json.loads((ROOT / "src/atlas/institutionLocations.json").read_text())
    location_labels = {item["comparator"] for item in locations}
    require(all(comparator in location_labels for comparator, _ in INSTITUTIONS.values()), "A reviewed comparator location label changed.")
    workbook_lookup = {}
    unit_evidence = []
    for source in WORKBOOKS:
        cover, cells = workbook_cells(read_locked(input_root, source), source)
        require(cover.get("E17") == UNIT_STATEMENT, "Original workbook unit statement changed.")
        require(cells.get("A1", "").startswith("Table 1.") and "Income" in cells["A1"], "Wrong original source table.")
        require(cells.get("K2") == "Sponsored research" and cells.get("M3") == "Sub-total", "Original fund subtotal headers changed.")
        require(cells.get("K5") == "C03" and cells.get("L5") == "C04" and cells.get("M5") == "C05", "Original fund column codes changed.")
        workbook_lookup[source["period"]] = (source, cells)
        unit_evidence.append({"period": source["period"], "worksheet": "COVER PAGE", "cell": "E17", "statement": UNIT_STATEMENT, "sha256": source["sha256"]})

    selected = [row for row in records if row["source_sheet"] == "Income - Data" and row["LineID"] == "L25" and row["INST_CD"] in INSTITUTIONS]
    keys = [(row["INST_CD"], row["REPYEAR"]) for row in selected]
    require(len(keys) == len(set(keys)), "Duplicate institution/fiscal-year income observations.")
    require(len(selected) == 28, "Reviewed comparator coverage changed; do not fill missing rows with zeros.")
    require(set(keys) == {(code, source["period"]) for code in INSTITUTIONS for source in WORKBOOKS}, "A reviewed fiscal-year observation is unavailable.")
    released = []
    bindings = []
    column_checks = {"REPYEAR": "A", "INST_CD": "E", "INSTNAME": "F", "LineID": "G", "VAR_ENGLISH": "H", "C03": "K", "C04": "L", "C05": "M"}
    for row in sorted(selected, key=lambda row: (row["REPYEAR"], INSTITUTIONS[row["INST_CD"]][0])):
        source, cells = workbook_lookup[row["REPYEAR"]]
        require(row["source_sha256"] == source["sha256"] and row["source_relative_path"] == source_path(source), "Recovered observation has unexpected original-file lineage.")
        comparator, expected_name = INSTITUTIONS[row["INST_CD"]]
        require(row["INSTNAME"].casefold() == expected_name.casefold(), "Original institution name does not match its reviewed code.")
        require("Total" in row["VAR_ENGLISH"], "Selected row is not the published total-income line.")
        labels = json.loads(row["measure_labels_json"])
        require(labels.get("C05") == "Sub-total" and "Sponsored research" in labels.get("C03", ""), "Recovered measure label changed.")
        require(row["source_row"].isdigit(), "Invalid original Excel row reference.")
        for field, excel_column in column_checks.items():
            require(cells.get(excel_column + row["source_row"], "") == row[field], f"Recovered {field} differs from its original workbook cell.")
        consolidated, not_consolidated, subtotal = (numeric(row[key]) for key in ["C03", "C04", "C05"])
        if all(value is not None for value in [consolidated, not_consolidated, subtotal]):
            require(consolidated + not_consolidated == subtotal, "Sponsored-research subtotal does not match its two source components.")
        amount = json_number(subtotal * 1000 if subtotal is not None else None)
        released.append({
            "comparator": comparator,
            "caubo_institution_code": row["INST_CD"],
            "source_institution_name": row["INSTNAME"],
            "fiscal_year": row["REPYEAR"],
            "sponsored_research_income_cad": amount,
            "source_subtotal_thousands_cad": row["C05"],
        })
        bindings.append({
            "comparator": comparator, "cauboInstitutionCode": row["INST_CD"], "fiscalYear": row["REPYEAR"],
            "originalFileId": source["originalFileId"], "originalSha256": source["sha256"],
            "sourceTableName": source["tableName"], "worksheet": "Income - Data", "sourceRow": int(row["source_row"]),
            "sourceLineId": "L25", "sourceFundCode": "C05", "sourceCell": "M" + row["source_row"],
            "sourceValueThousandsCAD": row["C05"], "releasedValueCAD": amount,
        })
    require(len(released) < 1000, "Release exceeds its bounded scope.")
    unbc = {row["fiscal_year"]: row["sponsored_research_income_cad"] for row in released if row["comparator"] == "UNBC / Prince George"}
    require(unbc == {"2020-2021": 15153000, "2021-2022": 17718000, "2022-2023": 17710000, "2023-2024": 19612000}, "Reviewed UNBC source series changed.")

    dataset = {
        "id": "research-income",
        "title": "CAUBO sponsored research income",
        "description": "Published sponsored-research income subtotals for seven reviewed institutional comparators over four fiscal years, converted from source thousands of dollars to CAD.",
        "topic": "Funding",
        "geography": "institution",
        "status": "observed",
        "timeLabel": "FY2020–2021 to FY2023–2024 · four annual source workbooks",
        "sourceName": "CAUBO · Financial Information of Universities and Colleges",
        "sourceUrl": "https://www.caubo.ca/knowledge-centre/analytics-and-reports/",
        "datasetId": DATASET_ID,
        "tableName": DERIVATIVE["tableName"],
        "notes": [
            "Each value is Table 1 Income, line L25 Total, fund column C05 Sponsored research subtotal. Only this subtotal is released; component fund columns, total funds, expenditures, and net assets are not added to it.",
            "The original cover page in every annual workbook states that amounts are in thousands of dollars. Values are multiplied by 1,000 for the CAD display, while the original source subtotal is retained. This conversion does not increase the source's thousand-dollar reporting precision. Values are nominal, without an inflation adjustment.",
            "The subtotal combines reported sponsored research in consolidated and non-consolidated affiliated entities. It covers external research support across fields, including grants and contracts. It is not health-research-only income, NHHR revenue, or an estimate of research impact.",
            "CAUBO institution-reported income has a different accounting scope from CIHR annual payment records and NSERC award amounts. Fiscal labels, affiliation reporting, and financial reporting boundaries can differ; these measures should not be merged or added together as a common funding total.",
            "Exact CAUBO institution codes select the comparator records. Published institution names are retained, including Northern Ontario School of Medicine for code 546 under the NOSM comparator. This series preserves source identities and does not assert harmonized corporate scope across institutional changes.",
            "All seven selected institutions have four source fiscal periods. BC Cancer has no matching university record in this source and is omitted without inventing zero income. The unavailable 2001–2024 historical master is not used; coverage is limited to the four recovered annual workbooks.",
            "Representative campus map points locate institution-level records for context. They do not allocate income to that campus, surrounding residents, health areas, or individual award sites. Multi-campus and affiliated research activity remains in the source institution total.",
        ],
        "columns": [
            {"key": "comparator", "label": "Institution / city", "type": "text"},
            {"key": "caubo_institution_code", "label": "CAUBO institution code", "type": "text"},
            {"key": "source_institution_name", "label": "Published institution name", "type": "text"},
            {"key": "fiscal_year", "label": "Fiscal year", "type": "text"},
            {"key": "sponsored_research_income_cad", "label": "Sponsored research income", "type": "number", "unit": "CAD"},
            {"key": "source_subtotal_thousands_cad", "label": "Source subtotal · thousands of CAD", "type": "text"},
        ],
        "rows": released,
        "defaultMetric": "sponsored_research_income_cad",
        "entityField": "comparator",
        "timeField": "fiscal_year",
    }
    allowed = {column["key"] for column in dataset["columns"]}
    require(all(set(row) == allowed for row in released), "An unallowlisted field entered the release.")
    evidence = {"reviewedAt": REVIEWED_AT, "sourceVersion": "NHHR manifest revision 93; CAUBO annual recovery 2026-10-07", "datasets": [dataset]}
    provenance = {
        "reviewedAt": REVIEWED_AT, "manifestUrl": MANIFEST_URL, "manifestRevision": 93,
        "collectionId": "DATA-C052", "datasetId": DATASET_ID, "sourceTable": DERIVATIVE,
        "originalWorkbooks": [{**source, "sourceRelativePath": source_path(source), "worksheet": "Income - Data"} for source in WORKBOOKS],
        "unitEvidence": unit_evidence,
        "currencyReference": "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3710002601",
        "currencyBasis": "The Canadian Financial Information of Universities survey reports current Canadian dollars; original annual cover pages independently establish the thousand-dollar scale.",
        "accountingReference": "https://www.statcan.gc.ca/en/statistical-programs/document/3121_D1_V23",
        "selection": {"worksheet": "Income - Data", "LineID": "L25", "fundCode": "C05", "calculation": "Published C05 subtotal multiplied by 1000; no sum of subtotal plus components", "releasedRows": 28, "institutions": 7, "periods": [source["period"] for source in WORKBOOKS], "uniqueness": "CAUBO institution code + source fiscal-year label"},
        "institutionCrosswalk": [{"cauboInstitutionCode": code, "comparator": comparator, "expectedSourceName": name} for code, (comparator, name) in INSTITUTIONS.items()],
        "rowBindings": bindings,
        "unavailable": [{"comparator": "BC Cancer / Vancouver", "reason": "No matching CAUBO university income observation in the four reviewed annual sources; no zero row created."}, {"source": "CAUBO 2001–2024 historical master", "reason": "Acquired response was HTML rather than a workbook; not used."}],
        "qualityChecks": ["Five source SHA256 hashes verified", "All four original cover-page unit cells checked", "All selected identifiers and monetary cells compared directly to original cached workbook cells", "C05 agrees with C03+C04, used as a validation only", "Seven exact comparator labels checked against reviewed institution locations", "No component, total-funds, expenditure, or participant records included"],
        "rightsNote": "Original publisher terms and attribution apply. This bounded secondary aggregate release does not include preparer contacts, affiliation contacts, participant data, or unrelated workbook fields.",
    }
    return evidence, provenance


def write_or_check(path: Path, value: dict, check: bool) -> None:
    data = (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    if check:
        require(path.exists() and path.read_bytes() == data, f"Generated output differs: {path.relative_to(ROOT)}")
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True, help="Directory containing DATA-C052 CSV and four original annual workbooks")
    parser.add_argument("--refresh", action="store_true", help="Follow the authorized manifest/catalogue, then download the five reviewed source IDs")
    parser.add_argument("--headers-file", type=Path, help="Optional private JSON request headers; never copied to release files")
    parser.add_argument("--check", action="store_true", help="Verify the generated outputs without writing them")
    args = parser.parse_args()
    if args.refresh:
        headers = json.loads(args.headers_file.read_text()) if args.headers_file else {}
        require(isinstance(headers, dict) and all(isinstance(key, str) and isinstance(value, str) for key, value in headers.items()), "Request headers must be a JSON string map.")
        refresh(args.input, headers)
    evidence, provenance = prepare(args.input)
    write_or_check(ROOT / "src/atlas/snapshots/research-income.json", evidence, args.check)
    write_or_check(ROOT / "public/data/nhhr/research-income.json", evidence, args.check)
    write_or_check(ROOT / "public/data/nhhr/research-income-provenance.json", provenance, args.check)
    print(f"{'Verified' if args.check else 'Prepared'} 28 CAUBO income observations across 7 institutions and 4 fiscal years; source hashes, original unit/header/measurement cells, and comparator identities checked.")


if __name__ == "__main__":
    main()
