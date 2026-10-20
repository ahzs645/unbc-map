import { atlasDatasets } from './data';
import type { AtlasStoryMap } from './storyMaps';
import { researchFollowupChapters } from './followupStoryMaps';

// A switched-off story map's dataset may be absent from the build (manifest/).
const dataset = (id: string) => atlasDatasets.find(item => item.id === id);
const housing = dataset('census-housing-csd');
const needMaximum = Math.max(0, ...(housing?.rows ?? []).flatMap(row => [row.tenant_core_need_pct, row.owner_core_need_pct]).filter((value): value is number => typeof value === 'number' && Number.isFinite(value)));

export const expansionStoryMaps: AtlasStoryMap[] = [
  {
    id: 'community-context', title: 'Communities, housing and the local economy', topic: 'Communities',
    summary: 'Move between municipal population, housing measures, employer locations and regional employment while keeping each source geography distinct.',
    chapters: [
      { id: 'municipal-population', title: 'A municipality and a local health area answer different questions', paragraphs: [
        'The 2025 BC Stats estimate for the municipality of Prince George is 85,944. The existing Prince George LHA projection is 105,544. Those figures refer to different areas and source series; they are not competing estimates of the same population.',
        'Seven Northern municipalities connect through exact source codes to 2021 Census subdivisions. BC Stats defines each estimate using July 1 municipal boundaries in that year, so the 2021 polygons provide context without asserting a harmonized historical boundary.',
        'A municipal count can help describe a community. It does not count research participants or define a hub catchment, and should not be added to the overlapping local health area.',
      ], evidence: { kind: 'map', datasetId: 'municipal-population', metric: 'population', year: '2025' }, takeaway: { value: '85,944', label: 'Prince George municipality · 2025 estimate' } },
      { id: 'tenant-housing-context', title: 'Read the tenant housing measure in its source universe', paragraphs: [
        'The 2021 Census reports 17.0% of the eligible tenant households in Prince George as being in core housing need. The map compares the published measure across seven selected municipalities, rather than calculating a new share from a different population denominator.',
        'The source housing measures have defined household universes and exclusions. Income in this view refers to 2020; shelter and labour characteristics retain their own published definitions. None of these observations establish a household’s health, trial eligibility or access to care.',
        'The next chapter shows the owner measure with the same percentage scale and geography. Keeping the scale fixed makes the change of measure visible without implying that owners and tenants share the same denominator.',
      ], evidence: { kind: 'map', datasetId: 'census-housing-csd', metric: 'tenant_core_need_pct', year: '2021', scaleDomain: [0, needMaximum] }, takeaway: { value: '17.0%', label: 'Prince George · published tenant core housing need measure · 2021' } },
      { id: 'owner-housing-context', title: 'Change the household group, keep the comparison clear', paragraphs: [
        'Prince George’s published owner core housing need measure is 2.5% in the same Census. It describes a different household group from the tenant measure. The difference alone does not identify a causal explanation or show the circumstances of individual households.',
        'Both chapters use exact 2021 Census subdivision identifiers and the same source-based percentage scale. The explorer also contains 29 Census divisions for a broader regional view, along with shelter burden, median shelter costs and income indicators.',
        'Municipal, Census-division and health-area observations remain separate. The presence of a boundary bridge does not authorize distributing household characteristics or health totals into another geography.',
      ], evidence: { kind: 'map', datasetId: 'census-housing-csd', metric: 'owner_core_need_pct', year: '2021', scaleDomain: [0, needMaximum] }, takeaway: { value: '2.5%', label: 'Prince George · published owner core housing need measure · 2021' } },
      { id: 'employer-locations', title: 'A business location is a different kind of place', paragraphs: [
        'The July 2025 employer-business source records 458 health care and social assistance locations in Prince George. It counts employer locations in an industry classification, rather than companies, health professionals, hospital beds or patients.',
        'The source excludes businesses without employees. Its all-industry total and smaller industry groups overlap; adding them would count locations repeatedly. Absent source industry cells remain absent instead of becoming zero locations.',
        'Native Census subdivision identifiers support a municipal map. The dataset has no location-level addresses, so these counts cannot identify or verify the individual clinics, care sites or social-service offices within a polygon.',
      ], evidence: { kind: 'map', datasetId: 'municipal-business-locations', metric: 'business_locations', year: '2025-07', filters: { industry: 'Health care and social assistance [62]' } }, takeaway: { value: '458', label: 'Prince George · employer locations in health care/social assistance · July 2025' } },
      { id: 'regional-employment', title: 'Move to the survey’s regional employment geography', paragraphs: [
        'The Labour Force Survey records 13.6 thousand people employed in health care and social assistance in Cariboo economic region in 2025. This is an industry-based employment estimate, rather than a count of licensed clinicians or available research staff.',
        'The nursing and allied-health occupation group is an alternative classification that overlaps the industry group. They must not be added. Employment units remain thousands of people throughout the map, chart and download.',
        'The source combines North Coast and Nechako into one survey observation with no native DGUID. Statistics Canada confirms this reporting area; the map uses a verified union of the two 2021 PGMaps regions and shows the value once. The original blank identifier is retained, and no value is split between individual regions.',
      ], evidence: { kind: 'map', datasetId: 'regional-employment-annual', metric: 'employment_thousands', year: '2025', filters: { employment_group: 'Health care and social assistance [62]' } }, takeaway: { value: '13.6 thousand', label: 'Cariboo · health care/social assistance employment · 2025' } },
    ],
  },
  {
    id: 'research-resources', title: 'The resources behind a research network', topic: 'Research capacity',
    summary: 'Follow chair listings, infrastructure contributions, administered payments, research spending and indexed output as separate forms of evidence.',
    chapters: [
      { id: 'listed-chairs', title: 'Begin with the collected chairholder listing', paragraphs: [
        'The collected UNBC listing contains four chairholder records, all Tier 2. Two are associated with CIHR, one with NSERC and one with SSHRC. The tier and agency classifications each describe the same total and should not be added together.',
        'Eight institution summaries reconcile to the original public listing. All eight connect to reviewed campus references, including the verified McMaster main-campus point in Hamilton. A listing snapshot does not establish current filled allocations, available staff or local clinical capacity.',
      ], evidence: { kind: 'map', datasetId: 'research-chairs', metric: 'crc_count' }, takeaway: { value: '4', label: 'UNBC · records in the collected April 2026 chairholder listing' } },
      { id: 'infrastructure-contributions', title: 'Infrastructure contributions have their own accounting meaning', paragraphs: [
        'The selected CFI source contains 45 UNBC project records and $7,542,484 in infrastructure contributions over its collected decision years. This is not annual cash paid, total project cost or sponsored-research income.',
        'The workbook has no stable project-ID column, so counts describe original project records rather than independently verified unique grants. Exact lead institutions receive the source contribution; collaborating organizations are not assigned a fraction of it.',
        'Campus points provide institutional context. They do not locate funded equipment or individual projects. The publisher’s medical, health and life sciences category is available as a separate measure and includes life sciences.',
      ], evidence: { kind: 'map', datasetId: 'cfi-projects-total', metric: 'cfi_contribution_cad' }, takeaway: { value: '$7,542,484', label: 'UNBC · collected-period CFI contributions · nominal CAD' } },
      { id: 'decision-years', title: 'Look at decision years before comparing totals', paragraphs: [
        'The annual CFI view retains only observed institution and decision-year groups. An absent year is not manufactured as a zero. Decision timing is different from the fiscal timing of payments or university accounts.',
        'The year groups reconcile to the collected-period institution summaries. Those two views overlap and cannot be added together. Use the linked explorer views to retain a selected institution while changing between the annual and collected-period perspectives.',
      ], evidence: { kind: 'chart', datasetId: 'cfi-projects-by-year', metric: 'cfi_contribution_cad' } },
      { id: 'administered-payments', title: 'Keep administered payments separate from commitments', paragraphs: [
        'The SSHRC extract retains institution-administered payments tagged with source fiscal-year code 2024. Fifteen entries tagged 2022 in that collected file are excluded. Calendar-year dates are not inferred from the source code.',
        'Some funding files split payments across institutions. Their original allocations are retained; deduplicating globally by file number would discard valid amounts. Absent comparators are not assigned zero payments, and applicant fields are excluded.',
        'This is a broad research funding measure. It is not health-only funding, a researcher salary, an NHHR revenue stream or an award commitment. It remains separate from the CIHR, NSERC and CFI views.',
      ], evidence: { kind: 'map', datasetId: 'sshrc-payments', metric: 'paid_amount_cad', year: '2024' } },
      { id: 'research-expenditures', title: 'University research spending describes another flow', paragraphs: [
        'The two reviewed CAUBO years retain sponsored-research expenditure totals, converted from thousands of CAD to CAD. The source components reconcile to the subtotal, which is selected once. Conversion does not increase the reported precision.',
        'Expenditure, income and grant payments have different accounting definitions. The whole-institution expenditure series spans research fields and is not an NHHR budget or clinical research cost. It should not be summed with the other funding views.',
      ], evidence: { kind: 'chart', datasetId: 'research-expenditures', metric: 'sponsored_research_expenditures_cad' } },
      ...researchFollowupChapters,
      { id: 'indexed-research', title: 'Read indexed output alongside its search definition', paragraphs: [
        'The longer OpenAlex series extends the collected institutional records to 2016–2025. Its 2021–2025 observations reconcile to the existing publication view. It counts institution-linked indexed works across fields, rather than only biomedical papers or NHHR output.',
        'The separate PubMed affiliation-query view retains each recorded query and its returned match count. Its twenty returned IDs are a sample, not the full bibliography. Saved responses have no publication-year filter or capture timestamp, and one article may match several institutions.',
        'Source identity matters: a file labelled Northern Health resolved to Northern Norway, so it is excluded from BC views. Neither index count demonstrates clinical capacity, research impact or a unique national publication total.',
      ], evidence: { kind: 'chart', datasetId: 'publications-history', metric: 'works' } },
    ],
  },
  {
    id: 'workforce-context', title: 'Workforce measures answer different questions', topic: 'Workforce',
    summary: 'Compare direct care, regional wage estimates, hospital worked hours and vacancy averages, then examine a historical population-health source.',
    chapters: [
      { id: 'allied-health', title: 'Extend the direct-care picture beyond nurses and physicians', paragraphs: [
        'The CIHI allied-health view connects occupational therapists, pharmacists and physiotherapists through exact Northern HSDA codes, profession and year. The 2024 occupational-therapist counts are 26 in Northwest, 45 in Northern Interior and 11 in Northeast.',
        'The map uses the publisher’s rates per 10,000 people. These are direct-care professionals, not FTEs, vacancies or research staff. Profession groups are not added, and the rates are not recomputed from a different population source.',
      ], evidence: { kind: 'map', datasetId: 'allied-health-northern', metric: 'direct_care_per_10k', year: '2024', filters: { profession: 'Occupational therapists' } } },
      { id: 'wage-estimates', title: 'A wage estimate carries its source method', paragraphs: [
        'The Job Bank snapshot records low, median and high hourly estimates for six health occupations in BC and four Northern economic regions. Reference periods are 2023–2024 or 2024, rather than the November 2025 release date.',
        'Some regional entries use provincial Labour Force Survey estimates, while other estimates use regional data or Small Area Estimation. Matching figures do not prove identical local wage distributions. Missing medians stay missing and low/high values are not confidence intervals.',
        'Economic regions differ from health areas. The 2021 boundaries provide context without claiming historical harmonization, and the provincial aggregate remains unallocated in the records.',
      ], evidence: { kind: 'map', datasetId: 'health-occupation-wages', metric: 'median_hourly_wage', filters: { occupation: 'Registered nurses and registered psychiatric nurses' } } },
      { id: 'worked-hours', title: 'Hospital overtime is a worked-hours ratio', paragraphs: [
        'BC nursing inpatient service records cover FY2019–2020 through FY2023–2024. Overtime share divides worked overtime by overtime plus regular worked hours, excluding purchased and benefit hours from that denominator.',
        'Hospital service-area totals overlap their components. Hours do not count unique workers, and province-level staffing cannot be assigned to Northern facilities. The explorer retains purchased and sick-leave hours as separate measures.',
      ], evidence: { kind: 'chart', datasetId: 'bc-hospital-staffing', metric: 'overtime_share_pct', filters: { service_area: 'Nursing inpatient services' } } },
      { id: 'vacancy-estimates', title: 'Vacancy averages are not a direct-care supply count', paragraphs: [
        'The original vacancy table defines its year labels using four quarters across a fiscal period. The FY2020–2021 observation uses two quarters because collection was suspended in the other two. The source labels and quarter coverage remain available in the records.',
        'Vacancy averages are rounded to the nearest five. X marks suppressed values and F marks unreliable data; both remain missing. Overlapping broad and narrow occupation groups cannot be added into a new total.',
        'These BC employer estimates do not establish current openings, Northern facility vacancies or staff available for a trial. The published composition share is different from a standard job vacancy rate.',
      ], evidence: { kind: 'chart', datasetId: 'bc-health-occupation-vacancies', metric: 'average_vacancies', filters: { occupation: 'Registered nurses and registered psychiatric nurses*' } } },
      { id: 'historical-health-context', title: 'Keep historical population health in its original frame', paragraphs: [
        'Archived cancer observations extend through the 2013/2015 window and use December 2015 health regions. Age-standardized rates use the 2011 Census population structure; confidence intervals and source symbols remain in the table.',
        'The windows overlap, and both-sex and all-site totals overlap their components. These observations follow residence at diagnosis rather than the location of treatment or research facilities. They cannot establish current disease demand, trial eligibility or an NHHR effect.',
        'The three Northern regions now connect to the official December 2015 boundary release through exact original identifiers. The map shows one sex, cancer site and window at a time. The BC benchmark remains in charts and records without an overlapping province polygon; confidence intervals remain available in the source table.',
      ], evidence: { kind: 'map', datasetId: 'historical-cancer-incidence', metric: 'age_standardized_rate', year: '2013/2015', filters: { sex: 'Both sexes', cancer_site: 'All invasive primary cancer sites (including in situ bladder)' } } },
    ],
  },
];
