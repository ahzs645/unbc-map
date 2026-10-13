# NHHR clinical condition composition

Reviewed **12 October 2026**. The source is a **77-row city × NHHR-coded condition-domain aggregate**, covering **seven comparator cities and 13 exact category labels**. It is a ragged table, not a complete seven-by-thirteen grid. The 14 absent city/domain pairs remain absent; no synthetic zero observations are added.

The release uses **29 April 2026 as its aligned comparator snapshot**. The original aggregate CSV has **no own timestamp column**. This label aligns with the existing validated comparator baseline and its exact counts; it does not claim that all underlying registry records were downloaded on that date or that historical statuses remain current.

## Dataset and source

Dataset ID in the atlas: `clinical-condition-mix`. Geography: `city`. Entity: `query_city`. Time field: `snapshot_date`, labelled **Aligned comparator snapshot**. Default measure: `condition_share_pct`. No default condition filter is imposed. The map scale cohort is identified by `condition_domain`.

The source was independently re-downloaded through the authorized NHHR manifest and its current source catalogue:

- Collection: DATA-C037, Strategic Work Package.
- Actual Zoer dataset: `a308df09-ac89-4591-980f-624a4908a9b6`.
- Original CSV: `comparator_clinical_condition_domain_summary.csv`.
- Original file ID: `ac6c958e-45ff-4dc1-828a-3ac2bd3cc04a`.
- SHA256: `c53a2738c462388d5b76453f9951bac3825adfd2df180f266f1b1d3b555d9674`.
- Imported table: `nhhr_data_c037_69b3f9e8dcdc_zip_data_c037_compar`.
- Original fields: `query_city`, `condition_domain`, `studies`, `recruiting_now`.

Only these public aggregate fields and derived composition measures are released. Broader strategic-package contacts, candidates, consent/participant information, remuneration and other restricted records are excluded. `clinical-condition-mix-provenance.json` records source row coordinates, public study-ID reconciliation metadata and calculations; it does not contain participant records.

## Measures and denominator rules

| Selectable measure | Definition | Unit |
| --- | --- | --- |
| `studies` | Source study records with a matched city site and the coded domain | Study/city-site matches |
| `recruiting_snapshot_studies` | Original `recruiting_now` aggregate; historical overall study status | Study/city-site matches |
| `condition_share_pct` | 100 × domain studies / all source study matches in that city | Percentage points, 0–100 |
| `recruiting_condition_share_pct` | 100 × domain RECRUITING records / all source RECRUITING records in that city | Percentage points, 0–100 |

The two shares describe **different compositions**. The recruiting share is a domain's contribution to the city's historical recruiting portfolio; it is **not** the percentage of studies within that domain that are recruiting.

Both shares use fixed full-city denominators, rounded to six decimal percentage points. Filtering out other categories must not renormalize them. For example, Prince George oncology remains 7/10 = **70% of all matched study records**, and 5/6 = **83.333333% of its historical RECRUITING records**, even when another condition is hidden.

`city_studies` and `city_recruiting_snapshot_studies` remain numeric row metadata. Their column types are deliberately **text**, so repeated full-city totals cannot be selected as additive numeric measures. They must not be added across domain rows. A zero full-city recruiting denominator would produce a null recruiting share rather than a made-up zero; all seven reviewed cities currently have positive historical recruiting denominators.

The source publishes **16 explicit zero `recruiting_now` cells**. Those retain numerical zero counts and zero recruiting composition shares. They are distinct from the **14 absent category pairs**, for which the source supplies no row.

## Reconciliation

Every city's aggregate study count and historical recruiting count matches the existing `clinical-city` reference exactly:

| City | Domain rows | Study/city-site matches | Historical RECRUITING |
| --- | ---: | ---: | ---: |
| Vancouver | 13 | 5,588 | 616 |
| Calgary | 13 | 4,478 | 522 |
| Halifax | 13 | 2,824 | 301 |
| Saskatoon | 13 | 1,357 | 129 |
| Sudbury | 11 | 566 | 35 |
| Thunder Bay | 10 | 205 | 18 |
| Prince George | 4 | 10 | 6 |

Prince George also reconciles with ten unique public NCT study records in `clinical-pg`. The fine analytical labels are explicitly linked to broader aggregate labels:

| Existing study-table code | Aggregate code | Study records | Historical RECRUITING |
| --- | --- | ---: | ---: |
| Cancer / oncology | Cancer / oncology | 7 | 5 |
| Diabetes / prevention | Diabetes / metabolic | 1 | 1 |
| Respiratory / COPD | Respiratory | 1 | 0 |
| Trauma / orthopedics | Surgery / trauma | 1 | 0 |

Those mappings are **NHHR analysis coding**. They are not original registry-controlled diagnosis categories or measured disease prevalence. Two Prince George studies carry `UNKNOWN` overall status and two carry `ACTIVE_NOT_RECRUITING`; only the six original `RECRUITING` statuses contribute to the recruiting aggregate. Unknown is not converted into a current availability judgement.

## Interpretation limits

- A multi-site study may appear in several cities. Cross-city counts must not be summed into a count of unique studies.
- Exact city matches do not establish institution catchments, health-authority coverage, local enrollment, participant eligibility or current trial availability.
- City map points locate query labels, not physical research facilities. Compare one domain at a time. Multiple domain rows at one city are not automatically summed or averaged into a map value.
- A source category mix is not disease burden, unmet need, interview findings, research quality or an NHHR effect.
- Sparse category coverage remains visible. Absence from this historical aggregate does not establish that a city has no research in a clinical area.

## Files and refresh

`clinical-condition-mix.json` contains the bounded dataset and snapshot metadata. Its application mirror is `src/atlas/snapshots/clinical-condition-mix.json`; both are byte-identical. Provenance is in `clinical-condition-mix-provenance.json`.

```sh
python3 scripts/prepare-nhhr-condition-mix.py --input /private/nhhr-review
python3 scripts/prepare-nhhr-condition-mix.py --input /private/nhhr-review --check
python3 scripts/prepare-nhhr-condition-mix.py --input /private/nhhr-refresh --refresh --check
```

Arrange the input at `DATA-C037/comparator_clinical_condition_domain_summary.csv`, or pass its CSV path directly. A refresh follows the authorized manifest, obtains its authoritative `NHHR_files.csv` and `NHHR_tables.csv`, checks the selected dataset/original-file/hash/table lineage, then downloads the actual original CSV. It does not assume scientific rows are embedded in the manifest.

Generation checks exact original hashes/schema, 77 unique city/domain keys, seven-city/thirteen-label coverage, integer nonnegative counts, recruiting ≤ studies, complete city-total reconciliation, explicit Prince George condition/status mappings, fixed-denominator share sums and byte-identical outputs. Source hash/schema/coding drift stops generation for review. Optional private request headers can be supplied with `--headers-file`; they are not published. The browser imports committed source JSON and does not request protected tables or credentials.
