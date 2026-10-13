# Reviewed comparator trial facilities and condition portfolios

The original DATA-C037 exact-city CSV contains 15,028 unique city/NCT observations. All seven city totals and all 77 city/domain counts and historical RECRUITING counts reconcile to the existing comparator baseline.

The finite review accepts 25 named physical facilities and 106 exact city/alias bindings. It produces 171 observed facility/domain rows and 4,401 downloadable city/NCT/physical-site relationships. Absent combinations are not synthesized as zero records.

## Meaning and units

Distinct study counts deduplicate alias variants at one physical facility. A study at several facilities retains a relationship at each; sums across facilities or cities are not unique studies. Condition shares are percentage points using the fixed full-facility denominator. Filtering conditions never renormalizes shares. Repeated facility/city denominators remain numeric row metadata with text column types, excluding them from selectable measures.

Historical RECRUITING is overall study status in the aligned 29 April 2026 baseline. It does not establish local-site activation, current recruitment, appointments, enrollment, eligibility or clinical capacity. NHHR condition domains are analysis coding, not controlled diagnosis categories or measured disease burden.

## Coverage

City coverage retains all original coded studies. Studies with a reviewed facility and studies without a verified facility join form a two-part city partition. Partly located is a subset of the first group with at least one nonempty unreviewed recorded alias. Missing labels and source count/list disagreements remain separate.

The recorded matched-site count differs from the literal-delimiter deduplicated alias-list length in 1,304 observations. Repeated source site rows may have the same alias. Disagreement does not prove additional physical facilities and does not increase partly located counts by itself.

The exact delimiter is semicolon followed by space. Bare semicolons, commas, fuzzy names, generic Research Site labels, umbrella institutions and broad regional descriptions are not reinterpreted as verified facilities. Unreviewed raw labels are not republished; city counts and reason categories are released.

## Geographic evidence

Point metadata retains official operator references, returned OSM evidence, coordinate precision and exceptions. Current building references do not establish the location of every historical study visit. Old Tom Baker Cancer Centre is separate from Arthur J.E. Child Comprehensive Cancer Centre. Generic Sudbury and Thunder Bay regional hospital aliases remain unresolved. The Sudbury cancer point uses an explicitly noted hospital-campus position.

PGMaps registry entries are candidate identity/address references, never a substitute for independent coordinate verification. No city-centroid substitution, invented coordinates or allocation to surrounding populations is used.

Coordinate data © OpenStreetMap contributors under ODbL. Official operator and ClinicalTrials.gov source terms and attribution apply; no endorsement is implied.

## Files and reproducibility

- trial-facility-conditions.json: two bounded aggregate datasets, byte-identical to the source import mirror.
- locations-comparator-trial-sites.geojson: 25 reviewed points with provenance notes.
- trial-facility-study-sites.csv: separate safe study/site evidence with registry URLs, excluded from JavaScript snapshots.
- trial-facility-conditions-provenance.json: original ID/hash/table lock, reconciliation and location review.
- scripts/prepare-nhhr-trial-facility-conditions.py: reproducible preparation, authorized refresh and checks.

Run with --input /path/to/source, optionally --refresh to follow the authorized manifest, dataset, catalogue and original file. Use --check to compare every released file byte for byte. Private headers may be supplied with --headers-file; they never enter releases. Source or location hash drift stops preparation for independent review.

Only public scientific fields enter the allowlist. No contact, participant, consent, candidate or remuneration records are released. Formula-like public CSV strings are escaped for spreadsheet safety.
