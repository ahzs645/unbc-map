import type { AtlasStoryMap, StoryMapChapter } from './storyMaps';

const diabetesIncidence = 'Diabetes Mellitus age-standardized incidence rate per 1000 population (1+ yrs)';
const diabetesPrevalence = 'Diabetes Mellitus age-standardized lifetime prevalence rate per 1000 population (1+ yrs)';

export const researchFollowupChapters: StoryMapChapter[] = [
  { id: 'historical-awards', title: 'Extend the funding view into its historical window', paragraphs: [
    'Historical NSERC fiscal records cover 1991–2000, separately from the existing recent window. Exact original institution names and organization codes retain the administering institution. Missing institution-years remain absent.',
    'The complete 1999 export contributes once; its truncated excerpt does not add another award cohort. Institution allocations and instalments remain distinct, and competition year is not substituted for fiscal year.',
    'Recorded fiscal AwardAmount totals are nominal source amounts. They do not establish cash paid, lifetime commitments or health-only funding. Current campus references do not locate historical projects.',
  ], evidence: { kind: 'chart', datasetId: 'nserc-awards-history', metric: 'award_amount_cad' } },
  { id: 'middle-award-window', title: 'Connect the middle years through their own source collection', paragraphs: [
    'The 2001–2018 Zoer originals fill the available window between the older and recent NSERC views. They retain exact source institution identities, fiscal labels and allocation keys.',
    'Instalments and institution-specific allocations are not discarded by global application deduplication. Partner and co-applicant tables remain relationship metadata, rather than additional funding observations.',
    'The collected 2011 original was truncated. Its complete official NSERC export has now been recovered and independently verified, filling the year with seven institutional observations. Publisher origins and the failed capture remain explicit. Nominal fiscal amounts are separate from paid cash, lifetime commitments and health-only funding; campuses do not locate historical projects.',
  ], evidence: { kind: 'chart', datasetId: 'nserc-awards-2001-2018', metric: 'award_amount_cad' } },
  { id: 'published-intensity', title: 'Keep the ratio attached to its headcount definition', paragraphs: [
    'The selected publisher comparison uses fiscal 2024 sponsored-research income and academic-year 2023–2024 headcounts. Faculty and graduate-student denominators have different coverage and exclusions.',
    'Published income per headcount is not salary, FTE or staff available for a trial. Rounded ratios are retained as published; no new headcount is reverse-calculated.',
    'Representative campus dots retain institutional scope. The publisher’s source definitions and revisions remain visible, and its income cannot be added to payments or infrastructure contributions.',
  ], evidence: { kind: 'map', datasetId: 'university-research-intensity', metric: 'income_per_faculty_cad', year: '2024' } },
  { id: 'organization-spending', title: 'An authority-level research record stays organizational', paragraphs: [
    'Five selected public-health organizations or administrative zones report fiscal 2024 research spending. Some records include affiliated hospitals and research centres. A record does not locate one building.',
    'The explorer keeps spending, spending share and published spending per researcher headcount separate. Two na shares remain missing, and organizations outside the selected comparison are not assigned zeros.',
    'A chart preserves this organizational scope. Placing an authority total at a hospital or university point would imply a facility allocation absent from the source.',
  ], evidence: { kind: 'chart', datasetId: 'hospital-research-organizations', metric: 'research_spending_cad', year: '2024' } },
];

export const followupStoryMaps: AtlasStoryMap[] = [
  { id: 'education-and-health', title: 'Education pipelines and Northern health context', topic: 'Workforce', summary: 'Follow projected graduates and occupation entrants, verified enrolment and historical Northern HA and CHSA disease rates, keeping their source populations distinct.', chapters: [
    { id: 'projected-graduates', title: 'Begin with the provincial graduate projection', paragraphs: [
      'The BC supply model contains twelve fiscal periods from 2023–2024. Its December 2024 model preparation date does not turn elapsed fiscal periods into observed graduates. Every value remains a projection.',
      'This chapter follows baccalaureate degrees at ages 17–29. Change the credential and age group in the explorer. Counts are rounded to five, eligibility exclusions remain visible, and Total overlaps credential components.',
      'There is no campus or local-health-area allocation in this source. Provincial projections cannot establish Northern graduates or the people available to NHHR.',
    ], evidence: { kind: 'chart', datasetId: 'bc-graduate-projections', metric: 'projected_graduates', filters: { age_group: '17 to 29', credential_type: 'Baccalaureate degree' } } },
    { id: 'occupation-entrants', title: 'Projected occupation entry is another model stage', paragraphs: [
      'Weighted 2019–2023 Student Outcomes surveys inform the model’s occupation estimates. This chapter follows registered nurses and registered psychiatric nurses aged 17–29.',
      'Projected entrants are not licensed registrations, observed employment or vacancies. The original fiscal labels and whole-number rounding remain in the records; omitted combinations are not synthesized as zero.',
      'The province-level model does not identify future Northern jobs or available research staff. Compare it with observed workforce views while retaining those different definitions.',
    ], evidence: { kind: 'chart', datasetId: 'bc-health-occupation-projections', metric: 'projected_occupation_entries', filters: { age_group: '17 to 29', occupation: 'Registered nurses and registered psychiatric nurses' } } },
    { id: 'institutional-enrolment', title: 'Locate the institution without relocating its students', paragraphs: [
      'Seven institution records retain the four full-/part-time undergraduate/graduate categories published for Fall 2025. Dots scale with the selected category total and locate representative campus references.',
      'Lakehead’s verified institution-only total is 8,499; the approximate NOSM addition in the collected city comparison is excluded. UBC retains its institutional scope rather than a Vancouver-campus label.',
      'These counts are not FTEs, graduates or resident students. City ratios remain withheld because campus scope and compatible population denominators are unresolved.',
    ], evidence: { kind: 'map', datasetId: 'institution-enrolment', metric: 'total_enrolment', year: '2025' } },
    { id: 'historical-incidence', title: 'Read recorded incidence in its historical frame', paragraphs: [
      'The Northern HA registry series spans fiscal 2001–2002 through 2020–2021. This chart follows the published diabetes age-standardized incidence rate per 1,000 for the source Total sex category.',
      'A rate is not a case count or a crude percentage of today’s population. The source age universes differ across conditions, and its standardization population and confidence intervals are absent from this collected CSV.',
      'The source HA ID supports an optional contextual Northern HA map in the explorer. No CHSA observations are supplied, and the historical HA values cannot be spread across communities or facilities.',
    ], evidence: { kind: 'chart', datasetId: 'community-disease-incidence', metric: 'rate_per_1000', filters: { indicator: diabetesIncidence, sex: 'Total' } } },
    { id: 'lifetime-prevalence', title: 'Change the rate definition while retaining its scope', paragraphs: [
      'The paired source series reports diabetes age-standardized lifetime prevalence per 1,000. It remains separate from incidence, with the same original fiscal labels and source sex categories.',
      'Incidence and prevalence must not be added. Neither series supplies trial eligibility, current unmet demand or evidence that an NHHR intervention changed outcomes.',
      'Open the explorer to change one indicator, sex and period, or inspect the exact original rate literal. The current PGMaps HA polygon provides context without claiming harmonized historical boundaries.',
    ], evidence: { kind: 'chart', datasetId: 'community-disease-prevalence', metric: 'rate_per_1000', filters: { indicator: diabetesPrevalence, sex: 'Total' } } },
    { id: 'community-incidence', title: 'Move to community reporting areas with their own observations', paragraphs: [
      'The public PHSA source supplies historical CHSA measurements directly. The collected Zoer C016 file did not supply these community observations; the supplementary release keeps that provenance separate.',
      'This map shows diabetes incidence in fiscal 2020–2021 for 29 publicly listed Northern CHSAs. Source codes match 2018 display boundaries. McBride/Valemount retains its original combined reporting area rather than distributing one rate across newer polygons.',
      'The rate is standardized to the 2011 Canadian Census population and expressed per 1,000, with the original ages 1+ definition. Snow Country has an explicit unreported source cell. Unreleased polygons remain grey and are not counted as zeros or complete Northern coverage.',
    ], evidence: { kind: 'map', datasetId: 'northern-chsa-incidence', metric: 'rate_per_1000', year: '2020–2021', filters: { indicator: diabetesIncidence } } },
    { id: 'community-prevalence', title: 'Keep the same areas while changing the registry definition', paragraphs: [
      'Lifetime prevalence is a separate published rate, not an amount to add to incidence. This map retains the same diabetes definition, ages 1+, fiscal 2020–2021 period and source-era community boundaries.',
      'All 29 listed CHSAs report this selected prevalence measure in the latest source period. The eleven other context polygons have no released observations in this public subset; they do not imply an absence of disease.',
      'Different conditions have different age universes. The explorer preserves the selected condition and period when switching paired views, with original definitions and missingness visible in the records. No case totals, trial catchments or causal interpretations are derived.',
    ], evidence: { kind: 'map', datasetId: 'northern-chsa-prevalence', metric: 'rate_per_1000', year: '2020–2021', filters: { indicator: diabetesPrevalence } } },
    { id: 'prince-george-communities', title: 'Read Prince George’s community rates in their historical frame', paragraphs: [
      'Prince George City North, Central and Southwest report diabetes lifetime prevalence of 90.4, 103.3 and 89.6 per 1,000 in fiscal 2020–2021. The three rates retain separate community identities and standardized source definitions.',
      'Their corresponding incidence rates are 7.5, 8.6 and 7.9 per 1,000. A difference in this historical source is not evidence of its cause or a count of residents needing care today.',
      'Small-number volatility and absent confidence intervals limit comparisons. Open the explorer to inspect one community’s fiscal series or switch its selected condition to incidence, without allocating the rates to nearby hospitals or trial facilities.',
    ], evidence: { kind: 'map', datasetId: 'northern-chsa-prevalence', metric: 'rate_per_1000', year: '2020–2021', filters: { indicator: diabetesPrevalence }, entities: ['Prince George City - North', 'Prince George City - Central', 'Prince George City - Southwest'], focusRegions: ['5241', '5242', '5243'] } },
  ] },
  { id: 'facilities-and-investment', title: 'Facilities, directory records and reported investment', topic: 'Health services', summary: 'Follow additional hospital identities and original capital-project records, with moved facilities and incomplete locations kept visible.', chapters: [
    { id: 'directory-additions', title: 'A source directory entry needs a physical identity', paragraphs: [
      'Additional HealthLink records are compared with the existing Atlas hospital registry. Existing aliases remain in verification receipts rather than creating duplicate dots.',
      'Nine new source entries remain in the additions view; eight have verified points. A pavilion and a campus may share an address without being the same mapped feature. Dr. Al Hogg’s unresolved building location is retained without a guessed point.',
      'Each value of one describes directory presence. It is not a bed count, clinical capacity, research participation or current service availability.',
    ], evidence: { kind: 'map', datasetId: 'healthlink-hospital-additions', metric: 'site_count', year: '2026-04-29' } },
    { id: 'original-capital-records', title: 'Recover the original report rows before comparing values', paragraphs: [
      'Northern Health’s printed reports contain 64 capital-project records across 2020–2022 and 2022–2024. The dedicated parsed summary retained 46, omitting eighteen rows and some wrapped headings.',
      'The reviewed extract preserves project value and district funding as separate nominal CAD columns. A printed dash remains missing numerically. The windows can repeat projects, so their costs are not summed into lifetime investment.',
      'Project labels may describe equipment, renovations or replacement buildings. Read the records and source headings before interpreting what the amounts represent.',
    ], evidence: { kind: 'chart', datasetId: 'northern-capital-projects', metric: 'project_value', year: '2022-2024' } },
    { id: 'verified-capital-sites', title: 'Map only the facility context the evidence supports', paragraphs: [
      'The site view counts reported project rows within one original reporting window at each reviewed facility. A dot compares record counts, rather than capital dollars, asset values or equipment available today.',
      'Verified facilities and explicitly labelled civic-address parcels provide reporting context. Six recovered parcel references locate eight more project records; 60 of 64 source rows now have context points. Mills equipment retains its original-address parcel label. The four replacement/leasehold project records remain unlocated, and no point is presented as a historical equipment or building position.',
      'The linked project view retains all original records, including unlocated projects and missing district funding. Point coverage is a statement about location evidence, not completeness of investment or service provision.',
    ], evidence: { kind: 'map', datasetId: 'northern-capital-site-context', metric: 'reported_projects', year: '2022-2024' } },
  ] },
];
