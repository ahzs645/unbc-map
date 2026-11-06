import { formatMeasure } from '@pgmaps/geo-toolkit/format';
import { atlasDatasets } from './data';
import type { AtlasRow } from './types';
import type { AtlasStoryMap } from './storyMaps';

// Stories that read across datasets rather than walking through one. Every
// figure comes from the reviewed rows. A switched-off story's datasets are left
// out of the build, so these lookups must tolerate an empty dataset, and a
// missing value reads "Not available", never zero.
const rows = (id: string): AtlasRow[] => atlasDatasets.find(dataset => dataset.id === id)?.rows ?? [];
const value = (row: AtlasRow | undefined, key: string): number | undefined => {
  const item = row?.[key];
  return typeof item === 'number' && Number.isFinite(item) ? item : undefined;
};
const total = (records: AtlasRow[], key: string): number | undefined => {
  const items = records.map(row => value(row, key));
  return records.length && items.every((item): item is number => item !== undefined) ? items.reduce((sum, item) => sum + item, 0) : undefined;
};
const reported = (records: AtlasRow[], key: string) => records.reduce((sum, row) => sum + (value(row, key) ?? 0), 0);
const ranked = (records: AtlasRow[], key: string) => records.filter(row => value(row, key) !== undefined).sort((a, b) => value(a, key)! - value(b, key)!);
const text = (item: number | undefined, decimals = 0) => formatMeasure(item, undefined, { fallback: 'Not available', minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const cad = (item: number | undefined) => item === undefined ? 'Not available' : `$${text(item)}`;
const million = (item: number | undefined) => item === undefined ? 'Not available' : `$${text(item / 1e6, 1)} million`;
const billion = (item: number | undefined) => item === undefined ? 'Not available' : `$${text(item / 1e9, 2)} billion`;
const ratio = (a: number | undefined, b: number | undefined) => a === undefined || !b ? undefined : a / b;
const share = (a: number | undefined, b: number | undefined) => { const part = ratio(a, b); return part === undefined ? undefined : part * 100; };
const growth = (from: number | undefined, to: number | undefined) => from === undefined || to === undefined || !from ? undefined : (to - from) / from * 100;
const percent = (item: number | undefined, decimals = 1) => item === undefined ? 'Not available' : `${text(item, decimals)}%`;
const span = (row: AtlasRow | undefined) => `${text(value(row, 'standardized_ci_low'), 1)}–${text(value(row, 'standardized_ci_high'), 1)}`;

// Two northern cities
const cities = rows('clinical-city');
const city = (name: string) => cities.find(row => row.query_city === name);
const princeGeorge = city('Prince George');
const thunderBay = city('Thunder Bay');
const vancouver = city('Vancouver');
const portfolioRatio = ratio(value(thunderBay, 'exact_city_site_studies'), value(princeGeorge, 'exact_city_site_studies'));
const recruitingRatio = ratio(value(thunderBay, 'recruiting_now'), value(princeGeorge, 'recruiting_now'));
const oncologyShare = (row: AtlasRow | undefined) => share(value(row, 'oncology_studies'), value(row, 'exact_city_site_studies'));
const industryShare = (row: AtlasRow | undefined) => share(value(row, 'industry_sponsored_studies'), value(row, 'exact_city_site_studies'));
const facilityRows = rows('trial-facility-conditions');
const thunderBayHospital = 'Thunder Bay Regional Health Sciences Centre — Oliver Road campus';
const princeGeorgeCancerCentre = 'BC Cancer – Prince George (Centre for the North)';
const hospitalStudies = value(facilityRows.find(row => row.facility_name === thunderBayHospital), 'facility_studies');
const cancerCentreStudies = value(facilityRows.find(row => row.facility_name === princeGeorgeCancerCentre), 'facility_studies');
const universityHospitalListed = facilityRows.some(row => String(row.facility_name).includes('University Hospital of Northern'));
const coverage = (name: string) => rows('trial-facility-coverage').find(row => row.query_city === name);
const intensity = (name: string) => rows('university-research-intensity').find(row => row.comparator === name);
const enrolment = (name: string) => rows('institution-enrolment').find(row => row.comparator === name);
const chairs = (name: string) => rows('research-chairs').find(row => row.comparator === name);
const unbc = 'UNBC / Prince George';
const lakehead = 'Lakehead / Thunder Bay';

// The Northeast gap
const northeast = 'Northeast HSDA';
const northernInterior = 'Northern Interior HSDA';
const northwest = 'Northwest HSDA';
const northernHsdas = [northwest, northernInterior, northeast];
const physicians = rows('physicians-hsda');
const physician = (name: string) => physicians.find(row => row.health_region === name);
const byTotalRate = ranked(physicians, 'total_physicians_per_100k_2024');
const totalRateCap = value(byTotalRate[byTotalRate.length - 2], 'total_physicians_per_100k_2024');
const totalRateDomain: [number, number] | undefined = totalRateCap === undefined ? undefined : [0, totalRateCap];
const familyCounts = physicians.filter(row => northernHsdas.includes(String(row.health_region))).flatMap(row => [value(row, 'family_physicians_2020'), value(row, 'family_physicians_2024')]);
const familyDomain: [number, number] | undefined = familyCounts.length && familyCounts.every(item => item !== undefined) ? [0, Math.max(...familyCounts as number[])] : undefined;
const nursing = (region: string, type: string) => value(rows('nursing-workforce-northern').find(row => row.region_name === region && row.nursing_type === type && row.year === '2024'), 'direct_care_per_10k');
const allied = (region: string, profession: string) => value(rows('allied-health-northern').find(row => row.region_name === region && row.profession === profession && row.year === '2024'), 'direct_care_per_10k');
const northeastLhas = ['Peace River South', 'Peace River North', 'Fort Nelson'];
const ages = rows('population-lha-ages');
const ages2025 = ages.filter(row => row.year === '2025');
const peaceNorth = ages2025.find(row => row.region_name === 'Peace River North');
const youngestLha = ranked(ages2025, 'share_65_plus')[0];
const population = (year: string) => total(ages.filter(row => row.year === year && northeastLhas.includes(String(row.region_name))), 'total_population');

// The North's lungs
const cancer = rows('historical-cancer-incidence');
const latestCancer = '2013/2015';
const lungSite = 'Bronchus and lung cancer [C34.0-C34.9]';
const allSites = 'All invasive primary cancer sites (including in situ bladder)';
const cancerRow = (region: string, site: string) => cancer.find(row => row.health_region === region && row.cancer_site === site && row.sex === 'Both sexes' && row.period === latestCancer);
const lung = (region: string) => cancerRow(region, lungSite);
const bc = 'British Columbia';
const copdIncidence = 'Chronic Obstructive Pulmonary Disease (COPD) age-standardized incidence rate per 1000 population (35+ yrs)';
const asthmaIncidence = 'Asthma age-standardized incidence rate per 1000 population (1+ yrs)';
const copdPrevalence = 'Chronic Obstructive Pulmonary Disease (COPD) age-standardized lifetime prevalence rate per 1000 population (35+ yrs)';
const diseaseSeries = (dataset: string, indicator: string) => rows(dataset).filter(row => row.indicator === indicator && row.sex === 'Total').sort((a, b) => String(a.period).localeCompare(String(b.period)));
const copdIncidenceSeries = diseaseSeries('community-disease-incidence', copdIncidence);
const asthmaIncidenceSeries = diseaseSeries('community-disease-incidence', asthmaIncidence);
const copdPrevalenceSeries = diseaseSeries('community-disease-prevalence', copdPrevalence);
const first = (series: AtlasRow[]) => series[0];
const last = (series: AtlasRow[]) => series[series.length - 1];
const latestDisease = '2020–2021';
const copdCommunities = ranked(rows('northern-chsa-prevalence').filter(row => row.indicator === copdPrevalence && row.period === latestDisease), 'rate_per_1000');
const copdLow = copdCommunities[0];
const copdHigh = copdCommunities[copdCommunities.length - 1];

// Waiting for surgery
const surgery = rows('surgical-waits-northern');
const procedure = (name: string) => surgery.find(row => row.procedure === name);
const cataract = procedure('Cataract Surgery · Adult');
const knee = procedure('Knee Replacement · Adult');
const hip = procedure('Hip Replacement · Adult');
const suppressedGroups = surgery.filter(row => row.cases_waiting === null || row.cases_waiting === undefined).length;
const unreportedP90 = surgery.filter(row => value(row, 'p90_weeks') === undefined).length;
const children = surgery.filter(row => row.age_group === 'Child');
const childLists = ranked(children, 'cases_waiting');
const largestChildList = childLists[childLists.length - 1];
const byP90 = ranked(surgery, 'p90_weeks');
const longestP90 = byP90[byP90.length - 1];

// What care costs
const stayCosts = rows('hospital-stay-costs');
const stay = (place: string, year: string) => value(stayCosts.find(row => row.place_or_organization === place && row.fiscal_year === year), 'cost_per_weighted_case');
const northernHealth = 'Northern Health (B.C.)';
const costYear = '2024–2025';
const earliestCostYear = '2020–2021';
const northernSites = rows('hospital-facility-costs').filter(row => row.health_authority === northernHealth && row.fiscal_year === costYear);
const sitesByCost = ranked(northernSites, 'cost_per_weighted_case');
const cheapestSite = sitesByCost[0];
const dearestSite = sitesByCost[sitesByCost.length - 1];
const fortStJohn = northernSites.find(row => String(row.facility_name).startsWith('Fort St. John'));
const suppressedSites = northernSites.length - sitesByCost.length;
const capital = rows('northern-capital-projects');
const capitalIn = (period: string) => capital.filter(row => row.report_period === period);
const capitalTotal = (period: string) => reported(capitalIn(period), 'project_value');
const replacements = capitalIn('2020-2022').filter(row => String(row.project_name) === 'Hospital Replacement');
const unreportedCapital = capital.filter(row => value(row, 'project_value') === undefined || row.funding_status === 'Source dash; amount not reported').length;

// Keeping the workforce
const inpatient = rows('bc-hospital-staffing').filter(row => row.service_area === 'Nursing inpatient services').sort((a, b) => String(a.fiscal_year).localeCompare(String(b.fiscal_year)));
const nurseVacancyLabel = 'Registered nurses and registered psychiatric nurses*';
const nurseVacancies = rows('bc-health-occupation-vacancies').filter(row => row.occupation === nurseVacancyLabel && value(row, 'average_vacancies') !== undefined).sort((a, b) => String(a.fiscal_year).localeCompare(String(b.fiscal_year)));
const retirement = [...rows('canada-retirement-age')].sort((a, b) => String(a.year).localeCompare(String(b.year)));
const migration = [...rows('bc-interprovincial-migration')].sort((a, b) => String(a.period).localeCompare(String(b.period)));
const peakMigration = ranked(migration, 'net_migration').at(-1);
const nurseOccupation = 'Registered nurses and registered psychiatric nurses';
const nurseWages = rows('health-occupation-wages').filter(row => row.occupation === nurseOccupation);
const wage = (region: string) => value(nurseWages.find(row => row.region_name === region), 'median_hourly_wage');
const nursePractitionerWages = rows('health-occupation-wages').filter(row => row.occupation === 'Nurse practitioners' && row.region_name !== bc);
const nurseEntrants = rows('bc-health-occupation-projections').filter(row => row.age_group === '17 to 29' && row.occupation === nurseOccupation && value(row, 'projected_occupation_entries') !== undefined).sort((a, b) => String(a.period).localeCompare(String(b.period)));
const registeredNurses = (region: string, year: string) => value(rows('nursing-workforce-northern').find(row => row.region_name === region && row.nursing_type === 'Registered nurses' && row.year === year), 'direct_care_per_10k');

export const evidenceStoryMaps: AtlasStoryMap[] = [
  {
    id: 'two-northern-cities', title: 'Two northern cities, two trial portfolios', topic: 'Clinical research',
    summary: 'Compare Prince George and Thunder Bay: their registered studies, where those studies sit, and how much of the gap the universities explain.',
    chapters: [
      { id: 'two-portfolios', title: 'Thunder Bay has many times the registered studies', paragraphs: [
        `Thunder Bay has ${text(value(thunderBay, 'exact_city_site_studies'))} registered studies with an exact-city site; Prince George has ${text(value(princeGeorge, 'exact_city_site_studies'))}. That is about ${text(portfolioRatio)} to 1 in the April 2026 registry snapshot.`,
        'Both counts cover the whole recorded portfolio, including studies that have finished. A registered site shows that a study named the city. It does not show how many local people enrolled.',
        'The cities differ in size and the Atlas holds no city populations for this comparison, so these are counts and not rates per person.',
      ], evidence: { kind: 'map', datasetId: 'clinical-city', metric: 'exact_city_site_studies', focusRegions: ['Prince George', 'Thunder Bay'] }, takeaway: { value: `${text(value(thunderBay, 'exact_city_site_studies'))} / ${text(value(princeGeorge, 'exact_city_site_studies'))}`, label: 'Thunder Bay / Prince George · registered studies' } },
      { id: 'recruiting-now', title: 'The gap narrows among studies recruiting now', paragraphs: [
        `Counting only studies listed as recruiting, the gap falls to ${text(value(thunderBay, 'recruiting_now'))} in Thunder Bay and ${text(value(princeGeorge, 'recruiting_now'))} in Prince George, about ${text(recruitingRatio)} to 1. Most of Thunder Bay's portfolio is no longer active, while most of Prince George's still is.`,
        `Adding studies that are active but no longer recruiting gives ${text(value(thunderBay, 'recruiting_or_active'))} and ${text(value(princeGeorge, 'recruiting_or_active'))}. Sudbury, the other Northern Ontario comparator, lists ${text(value(city('Sudbury'), 'recruiting_now'))} recruiting studies.`,
        'These are historical statuses from 29 April 2026. They do not establish that a study is open today or that any site recruited at that time.',
      ], evidence: { kind: 'chart', datasetId: 'clinical-city', metric: 'recruiting_now', entities: ['Prince George', 'Thunder Bay', 'Sudbury'], order: 'high' }, takeaway: { value: `${text(value(thunderBay, 'recruiting_now'))} / ${text(value(princeGeorge, 'recruiting_now'))}`, label: 'Thunder Bay / Prince George · studies listed as recruiting' } },
      { id: 'shared-oncology-lean', title: 'Both portfolios lean heavily toward cancer', paragraphs: [
        `${percent(oncologyShare(princeGeorge))} of Prince George's studies are coded cancer or oncology, close to Thunder Bay's ${percent(oncologyShare(thunderBay))}. In Vancouver the share is ${percent(oncologyShare(vancouver))}.`,
        'The map shows the oncology share for all seven comparator cities. The condition codes are an NHHR analytical choice, and a city point marks the registry search label rather than a hospital.',
        `With only ${text(value(princeGeorge, 'exact_city_site_studies'))} Prince George studies, one study moves its share by ten percentage points.`,
      ], evidence: { kind: 'map', datasetId: 'clinical-condition-mix', metric: 'condition_share_pct', filters: { condition_domain: 'Cancer / oncology' }, focusRegions: ['Prince George', 'Thunder Bay'] }, takeaway: { value: `${percent(oncologyShare(princeGeorge), 0)} / ${percent(oncologyShare(thunderBay), 0)}`, label: 'Prince George / Thunder Bay · oncology share of studies' } },
      { id: 'where-studies-sit', title: 'In Thunder Bay the hospital carries the portfolio', paragraphs: [
        `${text(hospitalStudies)} of Thunder Bay's ${text(value(thunderBay, 'exact_city_site_studies'))} studies are verified at its regional hospital. In Prince George, ${text(cancerCentreStudies)} of ${text(value(princeGeorge, 'exact_city_site_studies'))} are at the BC Cancer centre, and University Hospital of Northern BC ${universityHospitalListed ? 'appears in the reviewed list' : 'does not appear in the reviewed list at all'}.`,
        `${text(value(coverage('Thunder Bay'), 'no_verified_facility_studies'))} Thunder Bay studies have no verified facility, so the hospital count is a minimum. The map shows oncology studies at the two main sites.`,
        'Absence from these registry records is not absence of research. Hospital-based work that never reached the registry, or that was registered under another name, would not appear.',
      ], evidence: { kind: 'map', datasetId: 'trial-facility-conditions', metric: 'distinct_studies', year: '2026-04-29', filters: { condition_domain: 'Cancer / oncology' }, entities: [thunderBayHospital, princeGeorgeCancerCentre] }, takeaway: { value: `${text(hospitalStudies)} / ${text(cancerCentreStudies)}`, label: 'Studies at Thunder Bay Regional / BC Cancer Prince George' } },
      { id: 'universities-closer-than-trials', title: 'The universities differ far less than the trials', paragraphs: [
        `UNBC reports ${million(value(intensity(unbc), 'sponsored_research_income_cad'))} in sponsored research income and Lakehead ${million(value(intensity(lakehead), 'sponsored_research_income_cad'))}, a gap of about ${text(ratio(value(intensity(lakehead), 'sponsored_research_income_cad'), value(intensity(unbc), 'sponsored_research_income_cad')), 1)} to 1, not ${text(portfolioRatio)} to 1. Per faculty member UNBC is higher: ${cad(value(intensity(unbc), 'income_per_faculty_cad'))} against ${cad(value(intensity(lakehead), 'income_per_faculty_cad'))}.`,
        `Lakehead is the larger university, with ${text(value(enrolment(lakehead), 'total_enrolment'))} students to UNBC's ${text(value(enrolment(unbc), 'total_enrolment'))} and ${text(value(chairs(lakehead), 'crc_count'))} Canada Research Chairs to UNBC's ${text(value(chairs(unbc), 'crc_count'))}.`,
        'Sponsored research income covers every field, not health alone. These measures show that university scale alone does not account for the trial gap; they do not show what does.',
      ], evidence: { kind: 'chart', datasetId: 'university-research-intensity', metric: 'sponsored_research_income_cad', entities: [unbc, lakehead], order: 'high' }, takeaway: { value: `${million(value(intensity(unbc), 'sponsored_research_income_cad'))} / ${million(value(intensity(lakehead), 'sponsored_research_income_cad'))}`, label: 'UNBC / Lakehead · sponsored research income' } },
      { id: 'who-sponsors', title: 'Prince George and Thunder Bay are not industry-led', paragraphs: [
        `Industry sponsors ${text(value(princeGeorge, 'industry_sponsored_studies'))} of Prince George's studies and ${text(value(thunderBay, 'industry_sponsored_studies'))} of Thunder Bay's, or ${percent(industryShare(thunderBay))}. In Vancouver the share is ${percent(industryShare(vancouver))}.`,
        `Being in the North does not explain this. Sudbury, also in Northern Ontario, has industry sponsors on ${percent(industryShare(city('Sudbury')))} of its studies, and its portfolio is ${percent(oncologyShare(city('Sudbury')))} oncology.`,
        'Sponsor category comes from the registry record. It does not show who paid for local staff, space or coordination.',
      ], evidence: { kind: 'chart', datasetId: 'clinical-city', metric: 'industry_sponsored_studies', order: 'high' }, takeaway: { value: percent(industryShare(thunderBay)), label: 'Share of Thunder Bay studies with an industry sponsor' } },
      { id: 'questions-for-prince-george', title: 'What the comparison can and cannot say', paragraphs: [
        `Facility evidence is much stronger for Prince George, where ${percent(value(coverage('Prince George'), 'verified_facility_share_pct'), 0)} of studies have a verified site, than for Thunder Bay at ${percent(value(coverage('Thunder Bay'), 'verified_facility_share_pct'), 0)}.`,
        'The comparison raises questions it cannot answer: how Thunder Bay built a hospital-based portfolio, how long that took, what staffing it needed, and whether any of it would transfer to Prince George.',
        'Answering those would take enrolment records, staffing and funding evidence from the institutions involved. None of that is in this public data.',
      ], evidence: { kind: 'chart', datasetId: 'trial-facility-coverage', metric: 'verified_facility_share_pct', year: '2026-04-29', entities: ['Prince George', 'Thunder Bay'], order: 'high' }, takeaway: { value: `${percent(value(coverage('Prince George'), 'verified_facility_share_pct'), 0)} / ${percent(value(coverage('Thunder Bay'), 'verified_facility_share_pct'), 0)}`, label: 'Prince George / Thunder Bay · studies with a verified facility' } },
    ],
  },
  {
    id: 'the-northeast-gap', title: 'The Northeast gap', topic: 'Workforce',
    summary: 'Across physicians, nurses and allied health, the Northeast usually records the thinnest supply in the North, and it has the youngest population.',
    chapters: [
      { id: 'fewest-physicians', title: 'The lowest physician rate in BC', paragraphs: [
        `Northeast HSDA records ${text(value(physician(northeast), 'total_physicians_per_100k_2024'))} physicians per 100,000 people, the lowest of BC's ${physicians.length} regions. The next lowest is ${String(byTotalRate[1]?.health_region ?? 'Not available').replace(/ HSDA$/, '')} at ${text(value(byTotalRate[1], 'total_physicians_per_100k_2024'))}.`,
        `Northern Interior records ${text(value(physician(northernInterior), 'total_physicians_per_100k_2024'))}, about twice the Northeast rate. The highest region sits beyond the top of the colour scale, so the rest stay distinguishable.`,
        'These rates come from the source. They count physicians where they are recorded as working, not full-time equivalents or the services a resident can reach.',
      ], evidence: { kind: 'map', datasetId: 'physicians-hsda', metric: 'total_physicians_per_100k_2024', focusRegions: [northeast], scaleDomain: totalRateDomain }, takeaway: { value: text(value(physician(northeast), 'total_physicians_per_100k_2024')), label: 'Northeast physicians per 100,000 · lowest in BC · 2024' } },
      { id: 'registered-nurses', title: 'Fewer than half the nurses of Northern Interior', paragraphs: [
        `The Northeast has ${text(nursing(northeast, 'Registered nurses'), 1)} direct-care registered nurses per 10,000 people, against ${text(nursing(northernInterior, 'Registered nurses'), 1)} in Northern Interior and ${text(nursing(northwest, 'Registered nurses'), 1)} in the Northwest.`,
        `Nurse practitioners follow the same pattern: ${text(nursing(northeast, 'Nurse practitioners'), 1)} per 10,000 in the Northeast, ${text(nursing(northernInterior, 'Nurse practitioners'), 1)} in Northern Interior and ${text(nursing(northwest, 'Nurse practitioners'), 1)} in the Northwest.`,
        'Direct care excludes administration, education and research. These are head counts by region, not full-time positions or vacancies.',
      ], evidence: { kind: 'map', datasetId: 'nursing-workforce-northern', metric: 'direct_care_per_10k', year: '2024', filters: { nursing_type: 'Registered nurses' }, focusRegions: [northeast] }, takeaway: { value: `${text(nursing(northeast, 'Registered nurses'), 1)} / ${text(nursing(northernInterior, 'Registered nurses'), 1)}`, label: 'Registered nurses per 10,000 · Northeast / Northern Interior · 2024' } },
      { id: 'allied-health', title: 'Allied health shows the same shape', paragraphs: [
        `Physiotherapists number ${text(allied(northeast, 'Physiotherapists'), 1)} per 10,000 in the Northeast, against ${text(allied(northernInterior, 'Physiotherapists'), 1)} in Northern Interior and ${text(allied(northwest, 'Physiotherapists'), 1)} in the Northwest.`,
        `Occupational therapists (${text(allied(northeast, 'Occupational therapists'), 1)}) and pharmacists (${text(allied(northeast, 'Pharmacists'), 1)}) are also lowest in the Northeast among the three regions.`,
        'A rate of one or two per 10,000 can rest on a few people, so a small change in staff moves it visibly.',
      ], evidence: { kind: 'map', datasetId: 'allied-health-northern', metric: 'direct_care_per_10k', year: '2024', filters: { profession: 'Physiotherapists' }, focusRegions: [northeast] }, takeaway: { value: text(allied(northeast, 'Physiotherapists'), 1), label: 'Northeast physiotherapists per 10,000 · 2024' } },
      { id: 'not-every-measure', title: 'Not every measure runs the same way', paragraphs: [
        `Registered psychiatric nurses reverse the pattern: the Northeast records ${text(nursing(northeast, 'Registered psychiatric nurses'), 1)} per 10,000, the highest of the three regions, against ${text(nursing(northernInterior, 'Registered psychiatric nurses'), 1)} in Northern Interior.`,
        `Licensed practical nurses are not lowest there either: ${text(nursing(northeast, 'Licensed practical nurses'), 1)} per 10,000 against ${text(nursing(northwest, 'Licensed practical nurses'), 1)} in the Northwest. The gap is real but it is not uniform.`,
        'These are small groups, so one direct-care rate is not a verdict on any service. Each measure stays separate and rates are never added across professions.',
      ], evidence: { kind: 'map', datasetId: 'nursing-workforce-northern', metric: 'direct_care_per_10k', year: '2024', filters: { nursing_type: 'Registered psychiatric nurses' }, focusRegions: [northeast] }, takeaway: { value: text(nursing(northeast, 'Registered psychiatric nurses'), 1), label: 'Northeast registered psychiatric nurses per 10,000 · 2024' } },
      { id: 'youngest-population', title: 'The thinnest supply meets the youngest population', paragraphs: [
        `${String(youngestLha?.region_name ?? 'Not available')} has the lowest share aged 65+ of the seventeen Northern areas in the 2025 projection, at ${percent(value(youngestLha, 'share_65_plus'))}. ${percent(share(value(peaceNorth, 'population_0_19'), value(peaceNorth, 'total_population')))} of Peace River North is under 20, the highest share in the North.`,
        `Across the three Northeast areas the estimates rise from ${text(population('2020'))} people in 2020 to ${text(population('2024'))} in 2024.`,
        'A younger population needs different care from an older one, so a low physician rate does not translate directly into unmet need. The 2025 values are projections.',
      ], evidence: { kind: 'map', datasetId: 'population-lha-ages', metric: 'share_65_plus', year: '2025', focusRegions: northeastLhas }, takeaway: { value: percent(value(peaceNorth, 'share_65_plus')), label: 'Peace River North aged 65+ · lowest in the North · 2025 projection' } },
      { id: 'family-physicians-flat', title: 'Family physicians stayed flat', paragraphs: [
        `The Northeast records ${text(value(physician(northeast), 'family_physicians_2020'))} family physicians in 2020 and ${text(value(physician(northeast), 'family_physicians_2024'))} in 2024, while Northern Interior moves from ${text(value(physician(northernInterior), 'family_physicians_2020'))} to ${text(value(physician(northernInterior), 'family_physicians_2024'))}.`,
        `Its specialists rise from ${text(value(physician(northeast), 'specialists_2020'))} to ${text(value(physician(northeast), 'specialists_2024'))}, a small count where a few arrivals or departures change the picture.`,
        'Two points cannot show a trend, and the counts do not show who arrived, left or retired in between.',
      ], evidence: { kind: 'comparison', datasetId: 'physicians-hsda', metric: 'family_physicians_2020', comparisonMetric: 'family_physicians_2024', entities: northernHsdas, focusRegions: northernHsdas, scaleDomain: familyDomain }, takeaway: { value: `${text(value(physician(northeast), 'family_physicians_2020'))} → ${text(value(physician(northeast), 'family_physicians_2024'))}`, label: 'Northeast family physicians · 2020 → 2024' } },
      { id: 'what-rates-miss', title: 'Rates show where staff work, not where people go', paragraphs: [
        'These rates describe where clinicians are recorded, not where residents receive care. A person may travel to another region or across a provincial border, and the Atlas holds no data on those journeys.',
        'That matters most in the Northeast, which sits against the Alberta border. A low local rate could reflect care received elsewhere, a real gap, or both, and these sources cannot separate them.',
        'A research network planning work in the Peace region would need referral patterns, vacancies and local service evidence alongside these counts.',
      ], evidence: { kind: 'chart', datasetId: 'physicians-hsda', metric: 'total_physicians_per_100k_2024', entities: northernHsdas, order: 'low' }, takeaway: { value: String(northernHsdas.length), label: 'Northern regions compared · journeys between them are not in the data' } },
    ],
  },
  {
    id: 'the-norths-lungs', title: 'The North’s lungs', topic: 'Health',
    summary: 'Northern Interior has the clearest cancer excess in the data, and COPD keeps climbing across Northern communities. The data shows where, not why.',
    chapters: [
      { id: 'lung-cancer-excess', title: 'Lung cancer stands out in Northern Interior', paragraphs: [
        `Northern Interior's age-standardized lung cancer rate is ${text(value(lung(northernInterior), 'age_standardized_rate'), 1)} per 100,000, against ${text(value(lung(bc), 'age_standardized_rate'), 1)} for BC in 2013–2015. The confidence intervals, ${span(lung(northernInterior))} and ${span(lung(bc))}, do not overlap.`,
        'The chart follows overlapping three-year windows, so it smooths the series and neighbouring points share years. Northern Interior stays above the provincial rate across the whole series.',
        'This data ends in 2015. It describes an archived period rather than current incidence, and the latest window carries the source’s preliminary marker.',
      ], evidence: { kind: 'chart', datasetId: 'historical-cancer-incidence', metric: 'age_standardized_rate', filters: { sex: 'Both sexes', cancer_site: lungSite } }, takeaway: { value: `${text(value(lung(northernInterior), 'age_standardized_rate'), 1)} / ${text(value(lung(bc), 'age_standardized_rate'), 1)}`, label: 'Lung cancer rate per 100,000 · Northern Interior / BC · 2013–2015' } },
      { id: 'across-the-north', title: 'The excess is not the same across the North', paragraphs: [
        `The Northeast's rate is ${text(value(lung(northeast), 'age_standardized_rate'), 1)}, but its interval of ${span(lung(northeast))} overlaps BC's. The Northwest's ${text(value(lung(northwest), 'age_standardized_rate'), 1)} is close to the provincial rate.`,
        `Across all cancers, Northern Interior records ${text(value(cancerRow(northernInterior, allSites), 'age_standardized_rate'), 1)} per 100,000 against ${text(value(cancerRow(bc, allSites), 'age_standardized_rate'), 1)} for BC, with intervals of ${span(cancerRow(northernInterior, allSites))} and ${span(cancerRow(bc, allSites))}.`,
        `These rates rest on about ${text(value(lung(northernInterior), 'new_cases'))} lung cancer cases in Northern Interior and ${text(value(lung(northeast), 'new_cases'))} in the Northeast over three years, so wider intervals are expected in smaller regions. Boundaries are the December 2015 health regions.`,
      ], evidence: { kind: 'map', datasetId: 'historical-cancer-incidence', metric: 'age_standardized_rate', year: latestCancer, filters: { sex: 'Both sexes', cancer_site: lungSite }, focusRegions: [northernInterior] }, takeaway: { value: span(lung(northernInterior)), label: `Northern Interior lung cancer interval · BC is ${span(lung(bc))}` } },
      { id: 'copd-rising', title: 'New COPD diagnoses rose while asthma fell', paragraphs: [
        `Northern Health's age-standardized COPD incidence rose from ${text(value(first(copdIncidenceSeries), 'rate_per_1000'), 1)} per 1,000 in ${String(first(copdIncidenceSeries)?.period ?? 'Not available')} to ${text(value(last(copdIncidenceSeries), 'rate_per_1000'), 1)} in ${String(last(copdIncidenceSeries)?.period ?? 'Not available')}. Asthma incidence fell from ${text(value(first(asthmaIncidenceSeries), 'rate_per_1000'), 1)} to ${text(value(last(asthmaIncidenceSeries), 'rate_per_1000'), 1)} over the same years.`,
        'Incidence counts people newly identified in health records, so changes in testing, coding and access can move it as well as changes in illness.',
        'The latest period overlaps the COVID-19 pandemic, when contact with health services changed. Read its values with care, especially asthma’s final drop.',
      ], evidence: { kind: 'chart', datasetId: 'community-disease-incidence', metric: 'rate_per_1000', filters: { sex: 'Total' }, entities: [copdIncidence, asthmaIncidence] }, takeaway: { value: `${text(value(first(copdIncidenceSeries), 'rate_per_1000'), 1)} → ${text(value(last(copdIncidenceSeries), 'rate_per_1000'), 1)}`, label: 'Northern Health COPD incidence per 1,000 · 2001–2002 → 2020–2021' } },
      { id: 'lifetime-prevalence', title: 'More people are living with a COPD diagnosis', paragraphs: [
        `Lifetime COPD prevalence in Northern Health rose from ${text(value(first(copdPrevalenceSeries), 'rate_per_1000'), 1)} to ${text(value(last(copdPrevalenceSeries), 'rate_per_1000'), 1)} per 1,000 people aged 35 and over.`,
        'Lifetime prevalence counts everyone who has ever had the diagnosis and is still in the population. It tends to build up over time, so a rising line is not the same as a rising number of new cases.',
        'The two measures answer different questions: incidence asks how many people are newly diagnosed, and prevalence asks how many are living with that history.',
      ], evidence: { kind: 'chart', datasetId: 'community-disease-prevalence', metric: 'rate_per_1000', filters: { sex: 'Total', indicator: copdPrevalence } }, takeaway: { value: text(value(last(copdPrevalenceSeries), 'rate_per_1000'), 1), label: 'Northern Health COPD lifetime prevalence per 1,000 · 2020–2021' } },
      { id: 'copd-by-community', title: 'COPD varies more than two-fold between communities', paragraphs: [
        `${String(copdHigh?.chsa_name ?? 'Not available')} records ${text(value(copdHigh, 'rate_per_1000'), 1)} per 1,000 and ${String(copdLow?.chsa_name ?? 'Not available')} records ${text(value(copdLow, 'rate_per_1000'), 1)}, about ${text(ratio(value(copdHigh, 'rate_per_1000'), value(copdLow, 'rate_per_1000')), 1)} times as high, in ${latestDisease}.`,
        `The map shows the ${copdCommunities.length} Community Health Service Areas with published rates. They do not cover all of the North, and unshaded areas have no public rate here rather than a low one.`,
        'Rates are age-standardized, so age alone should not explain the difference. Small areas swing more from year to year, and a one-year map is a snapshot.',
      ], evidence: { kind: 'map', datasetId: 'northern-chsa-prevalence', metric: 'rate_per_1000', year: latestDisease, filters: { indicator: copdPrevalence } }, takeaway: { value: `${text(ratio(value(copdHigh, 'rate_per_1000'), value(copdLow, 'rate_per_1000')), 1)}×`, label: 'Highest to lowest community COPD prevalence · 2020–2021' } },
      { id: 'what-this-cannot-say', title: 'The data shows where, not why', paragraphs: [
        'Nothing here identifies a cause. The Atlas holds no smoking, occupational or air-quality measures for these areas, so these maps cannot connect lung disease to any exposure.',
        'The sources also differ. Cancer rates come from a cancer registry and end in 2015, while COPD and asthma rates come from a separate chronic disease registry and end in 2020–2021. They should not be read as one story about the same people.',
        'Linking them properly would need current cancer data, smoking and exposure measures on matching geography, and advice from the communities concerned.',
      ], evidence: { kind: 'chart', datasetId: 'historical-cancer-incidence', metric: 'age_standardized_rate', year: latestCancer, filters: { sex: 'Both sexes', cancer_site: lungSite }, order: 'high' }, takeaway: { value: '2015', label: 'Where the cancer series stops · no exposure data is in the Atlas' } },
    ],
  },
  {
    id: 'waiting-for-surgery', title: 'Waiting for surgery', topic: 'Health services',
    summary: 'See who is waiting for scheduled surgery in Northern Health, which waits run longest, and what these snapshots cannot predict.',
    chapters: [
      { id: 'the-list', title: 'More than five thousand people on the list', paragraphs: [
        `At least ${text(reported(surgery, 'cases_waiting'))} cases were waiting for scheduled surgery in Northern Health on 30 April 2026. That counts only the groups with a published number.`,
        `Another ${text(suppressedGroups)} groups are published only as “less than 5”. They stay missing rather than being guessed, so the true total is somewhat higher.`,
        'Cataract surgery has the longest list, followed by knee replacement. A case is a procedure on the list, not necessarily a separate person.',
      ], evidence: { kind: 'chart', datasetId: 'surgical-waits-northern', metric: 'cases_waiting', order: 'high' }, takeaway: { value: `${text(reported(surgery, 'cases_waiting'))}+`, label: 'Cases waiting in groups with a published count · 30 April 2026' } },
      { id: 'cataracts-move-quickly', title: 'The longest list is not the longest wait', paragraphs: [
        `Cataract surgery has ${text(value(cataract, 'cases_waiting'))} adult cases waiting, yet half of completed surgeries happened within ${text(value(cataract, 'p50_weeks'), 1)} weeks. Knee replacement has ${text(value(knee, 'cases_waiting'))} waiting and a median of ${text(value(knee, 'p50_weeks'), 1)} weeks.`,
        'A long list can move quickly when procedures are short and frequent. Size alone does not say how long anyone waits.',
        'The median describes surgeries completed from 1 February to 30 April, while the list is a count on one day. They describe different groups of people.',
      ], evidence: { kind: 'chart', datasetId: 'surgical-waits-northern', metric: 'p50_weeks', entities: ['Cataract Surgery · Adult', 'Knee Replacement · Adult', 'Hip Replacement · Adult'], order: 'high' }, takeaway: { value: `${text(value(cataract, 'p50_weeks'), 1)} / ${text(value(knee, 'p50_weeks'), 1)} weeks`, label: 'Median wait · cataract / knee replacement' } },
      { id: 'the-long-tail', title: 'One in ten knee replacements waited nearly a year', paragraphs: [
        `The 90th percentile for knee replacement is ${text(value(knee, 'p90_weeks'), 1)} weeks, so one in ten completed surgeries took at least that long. For hip replacement it is ${text(value(hip, 'p90_weeks'), 1)} weeks.`,
        `The longest 90th percentile in the table is ${text(value(longestP90, 'p90_weeks'), 1)} weeks, for ${String(longestP90?.procedure ?? 'Not available')}, which has a much shorter list.`,
        `The source reports no 90th percentile for ${text(unreportedP90)} groups. They are left out of this chart rather than shown as zero.`,
      ], evidence: { kind: 'chart', datasetId: 'surgical-waits-northern', metric: 'p90_weeks', order: 'high' }, takeaway: { value: `${text(value(knee, 'p90_weeks'), 1)} weeks`, label: 'Knee replacement · 90th percentile of completed surgeries' } },
      { id: 'children-waiting', title: 'Children wait too, on shorter lists', paragraphs: [
        `${String(largestChildList?.procedure ?? 'Not available')} is the largest children’s list, with ${text(value(largestChildList, 'cases_waiting'))} cases. In total, ${text(reported(children, 'cases_waiting'))} children’s cases are waiting in groups with a published count.`,
        `Children's lists make up ${text(children.length)} of the ${text(surgery.length)} groups, and many are too small to publish.`,
        'The source separates only adults and children, so these figures do not show age any more finely than that.',
      ], evidence: { kind: 'chart', datasetId: 'surgical-waits-northern', metric: 'cases_waiting', filters: { age_group: 'Child' }, order: 'high' }, takeaway: { value: text(reported(children, 'cases_waiting')), label: 'Children’s cases waiting · groups with a published count' } },
      { id: 'an-older-north', title: 'Older people live across the whole region', paragraphs: [
        `The 2025 projection has ${text(total(ages2025, 'population_65_plus'))} people aged 65 and over across the seventeen Northern areas. Cataract and joint surgery are more common later in life, so this is useful context for the longest lists.`,
        'The map shows counts by local health area. The waitlist data has no geography within Northern Health, so it cannot show where the people waiting live or where they will have surgery.',
        'This places two facts side by side. It does not show that ageing caused these waits, or predict future demand.',
      ], evidence: { kind: 'map', datasetId: 'population-lha-ages', metric: 'population_65_plus', year: '2025' }, takeaway: { value: text(total(ages2025, 'population_65_plus')), label: 'Northern people aged 65+ · 2025 projection' } },
      { id: 'reading-a-wait', title: 'A wait time is not a promise', paragraphs: [
        'These figures describe what happened to groups of patients. They cannot predict how long any one person will wait, which depends on urgency, surgeon, site and the point at which the wait is counted.',
        'They also come from one reporting window, so they show no trend. A short window can be affected by staffing or closures that the table does not record.',
        'Current wait information should come from a surgeon’s office or the provincial surgical wait-times service, not from this archive.',
      ], evidence: { kind: 'chart', datasetId: 'surgical-waits-northern', metric: 'p50_weeks', filters: { age_group: 'Adult' }, order: 'high' }, takeaway: { value: text(suppressedGroups), label: 'Groups published only as “less than 5”' } },
    ],
  },
  {
    id: 'what-care-costs', title: 'What care costs', topic: 'Health services',
    summary: 'Compare hospital-stay costs and capital spending across Northern Health, and see why a cost per case is not a patient bill or a possible saving.',
    chapters: [
      { id: 'northern-cost', title: 'A hospital stay costs more in the North than in most of BC', paragraphs: [
        `Northern Health's cost per weighted case was ${cad(stay(northernHealth, costYear))} in FY${costYear}, against ${cad(stay(bc, costYear))} for BC. Fraser, Interior and Island Health were lower; Vancouver Coastal, at ${cad(stay('Vancouver Coastal Health (B.C.)', costYear))}, was slightly higher.`,
        'A weighted case adjusts for how resource-intensive each stay is, so this is not simply a measure of sicker patients.',
        'The Provincial Health Services Authority is left off the map because it has no territory, and province and region rows overlap, so they must not be added together.',
      ], evidence: { kind: 'map', datasetId: 'hospital-stay-costs', metric: 'cost_per_weighted_case', year: costYear, focusRegions: [northernHealth] }, takeaway: { value: `${cad(stay(northernHealth, costYear))} / ${cad(stay(bc, costYear))}`, label: `Cost per weighted case · Northern Health / BC · FY${costYear}` } },
      { id: 'costs-over-time', title: 'Costs rose faster in the North', paragraphs: [
        `Northern Health's figure rose from ${cad(stay(northernHealth, earliestCostYear))} in FY${earliestCostYear} to ${cad(stay(northernHealth, costYear))}, up ${percent(growth(stay(northernHealth, earliestCostYear), stay(northernHealth, costYear)), 0)}. BC rose ${percent(growth(stay(bc, earliestCostYear), stay(bc, costYear)), 0)} over the same years.`,
        'These are nominal dollars, not adjusted for inflation. The period includes the pandemic, but the data does not assign the change to any cause.',
        'The indicator is an average across a whole organization. It does not describe the cost of any one procedure, or of one more admission.',
      ], evidence: { kind: 'chart', datasetId: 'hospital-stay-costs', metric: 'cost_per_weighted_case', entities: [bc, northernHealth] }, takeaway: { value: `${cad(stay(northernHealth, earliestCostYear))} → ${cad(stay(northernHealth, costYear))}`, label: `Northern Health · FY${earliestCostYear} → FY${costYear}` } },
      { id: 'sites-vary', title: 'Costs vary widely between Northern hospitals', paragraphs: [
        `Reported costs in FY${costYear} run from ${cad(value(cheapestSite, 'cost_per_weighted_case'))} at ${String(cheapestSite?.facility_name ?? 'Not available')} to ${cad(value(dearestSite, 'cost_per_weighted_case'))} at ${String(dearestSite?.facility_name ?? 'Not available')}.`,
        `${text(suppressedSites)} of ${text(northernSites.length)} sites are suppressed in the source. They remain missing and are not shown as zero.`,
        'Each point is a reporting site on the map, not a boundary. The cost does not spread across the people who live nearby.',
      ], evidence: { kind: 'map', datasetId: 'hospital-facility-costs', metric: 'cost_per_weighted_case', year: costYear, filters: { health_authority: northernHealth } }, takeaway: { value: `${cad(value(cheapestSite, 'cost_per_weighted_case'))} – ${cad(value(dearestSite, 'cost_per_weighted_case'))}`, label: `Reported cost per weighted case across Northern sites · FY${costYear}` } },
      { id: 'size-is-not-the-whole-answer', title: 'Size is only part of the answer', paragraphs: [
        `University Hospital of Northern BC, the region's largest, reports the lowest cost, and a very small hospital reports the highest. It is tempting to read this as an effect of size, but Fort St. John Hospital, which is not a small site, reports ${cad(value(fortStJohn, 'cost_per_weighted_case'))}.`,
        'Fixed staffing, low volumes and year-to-year swings all affect small sites, and a few unusual stays can move an average.',
        'The table has no volumes, staffing or service mix, so it can rank sites but it cannot explain them.',
      ], evidence: { kind: 'chart', datasetId: 'hospital-facility-costs', metric: 'cost_per_weighted_case', year: costYear, filters: { health_authority: northernHealth }, order: 'high' }, takeaway: { value: cad(value(fortStJohn, 'cost_per_weighted_case')), label: `Fort St. John Hospital · FY${costYear}` } },
      { id: 'three-replacements', title: 'Three hospital replacements dominate capital spending', paragraphs: [
        `Three hospital replacements total ${billion(reported(replacements, 'project_value'))} of the ${billion(capitalTotal('2020-2022'))} in project value reported for 2020–2022.`,
        `The ${text(capitalIn('2020-2022').length)} records in that report also include equipment, so the chart runs from the largest buildings to much smaller items.`,
        'Project value is the reported size of a project, and it is not spending in that period. Multi-year projects can span reports, so totals should not be added across report windows.',
      ], evidence: { kind: 'chart', datasetId: 'northern-capital-projects', metric: 'project_value', year: '2020-2022', order: 'high' }, takeaway: { value: `${billion(reported(replacements, 'project_value'))} of ${billion(capitalTotal('2020-2022'))}`, label: 'Three hospital replacements · reported project value · 2020–2022' } },
      { id: 'a-cost-is-not-a-saving', title: 'A cost per case is not a possible saving', paragraphs: [
        `The 2022–2024 report lists ${million(capitalTotal('2022-2024'))} in project value, a very different picture from the earlier window. ${text(unreportedCapital)} capital records across both reports have no published amount.`,
        'Neither a cost per case nor a capital total shows what a patient pays, or what care in a new setting would save. Average costs include fixed building and staffing costs that do not disappear when one stay is avoided.',
        'Estimating a saving would need evidence about a specific change and its marginal costs. Neither is in this data.',
      ], evidence: { kind: 'chart', datasetId: 'northern-capital-projects', metric: 'project_value', year: '2022-2024', order: 'high' }, takeaway: { value: million(capitalTotal('2022-2024')), label: 'Reported project value · 2022–2024 report' } },
    ],
  },
  {
    id: 'keeping-the-workforce', title: 'Keeping the workforce', topic: 'Workforce',
    summary: 'Overtime, vacancies, retirement, migration and new entrants across BC, and how little of that picture can be seen for the North.',
    chapters: [
      { id: 'overtime-doubled', title: 'Inpatient nursing overtime doubled across BC', paragraphs: [
        `Overtime in BC inpatient nursing rose from ${percent(value(first(inpatient), 'overtime_share_pct'))} of worked hours in FY${String(first(inpatient)?.fiscal_year ?? 'Not available')} to ${percent(value(last(inpatient), 'overtime_share_pct'))} in FY${String(last(inpatient)?.fiscal_year ?? 'Not available')}.`,
        'Overtime can reflect vacancies, sick leave, surges in demand or local scheduling, and this measure cannot tell them apart. Purchased agency hours are counted separately.',
        'This is a province-wide figure. It cannot be assigned to Northern Health or any single hospital.',
      ], evidence: { kind: 'chart', datasetId: 'bc-hospital-staffing', metric: 'overtime_share_pct', filters: { service_area: 'Nursing inpatient services' } }, takeaway: { value: `${percent(value(first(inpatient), 'overtime_share_pct'))} → ${percent(value(last(inpatient), 'overtime_share_pct'))}`, label: `BC inpatient nursing overtime share · FY${String(first(inpatient)?.fiscal_year ?? '')} → FY${String(last(inpatient)?.fiscal_year ?? '')}` } },
      { id: 'nurse-vacancies', title: 'Nursing vacancies are well above their 2015 level', paragraphs: [
        `BC averaged ${text(value(last(nurseVacancies), 'average_vacancies'))} vacant registered and psychiatric nursing jobs in FY${String(last(nurseVacancies)?.fiscal_year ?? 'Not available')}, against ${text(value(first(nurseVacancies), 'average_vacancies'))} in FY${String(first(nurseVacancies)?.fiscal_year ?? 'Not available')}.`,
        'The FY2020–2021 estimate rests on only two quarters, because collection was suspended during the pandemic, so treat that point with care.',
        'Vacancies are employer survey estimates rounded to the nearest five. They count open jobs, not unique positions across a year, and they have no Northern breakdown here.',
      ], evidence: { kind: 'chart', datasetId: 'bc-health-occupation-vacancies', metric: 'average_vacancies', filters: { occupation: nurseVacancyLabel } }, takeaway: { value: text(value(last(nurseVacancies), 'average_vacancies')), label: `BC average nursing vacancies · FY${String(last(nurseVacancies)?.fiscal_year ?? '')}` } },
      { id: 'retirement-age', title: 'People are retiring a little later', paragraphs: [
        `The median retirement age in Canada moved from ${text(value(first(retirement), 'median_age'), 1)} in ${String(first(retirement)?.year ?? 'Not available')} to ${text(value(last(retirement), 'median_age'), 1)} in ${String(last(retirement)?.year ?? 'Not available')}.`,
        'This covers all retirees in all occupations, across the country. It is context for workforce planning, not a forecast of when Northern health staff will leave.',
        'The Atlas has no age profile of the Northern health workforce, which is what a retirement estimate would actually need.',
      ], evidence: { kind: 'chart', datasetId: 'canada-retirement-age', metric: 'median_age' }, takeaway: { value: text(value(last(retirement), 'median_age'), 1), label: `Canadian median retirement age · ${String(last(retirement)?.year ?? '')}` } },
      { id: 'migration-turned', title: 'BC stopped gaining people from other provinces', paragraphs: [
        `BC's net interprovincial migration peaked at ${text(value(peakMigration, 'net_migration'))} people in ${String(peakMigration?.period ?? 'Not available')} and fell to ${text(value(last(migration), 'net_migration'))} in ${String(last(migration)?.period ?? 'Not available')}.`,
        'Recruitment from other provinces is one way health systems fill positions, so a smaller inflow matters in general. This figure covers everyone, not health workers.',
        'The measure is for all of BC. It cannot show whether people are moving to or leaving the North.',
      ], evidence: { kind: 'chart', datasetId: 'bc-interprovincial-migration', metric: 'net_migration' }, takeaway: { value: text(value(last(migration), 'net_migration')), label: `BC net interprovincial migration · ${String(last(migration)?.period ?? '')}` } },
      { id: 'northern-wages', title: 'Published Northern wages stop short', paragraphs: [
        `The median hourly wage for registered and psychiatric nurses is $${text(wage('Northeast'), 2)} in the Northeast and $${text(wage('Cariboo'), 2)} in Cariboo, against $${text(wage(bc), 2)} for BC.`,
        `Wage estimates are not published for nurse practitioners in any of the ${text(nursePractitionerWages.filter(row => value(row, 'median_hourly_wage') === undefined).length)} Northern reporting regions, so that map would be empty rather than low.`,
        'These are published estimates for an occupation. They do not show what any one employer pays, or the local cost of living.',
      ], evidence: { kind: 'map', datasetId: 'health-occupation-wages', metric: 'median_hourly_wage', filters: { occupation: nurseOccupation } }, takeaway: { value: `$${text(wage('Northeast'), 2)}`, label: 'Northeast median hourly wage · registered nurses' } },
      { id: 'new-entrants', title: 'New nurses are projected, not guaranteed', paragraphs: [
        `BC projects ${text(value(first(nurseEntrants), 'projected_occupation_entries'))} new registered and psychiatric nurses aged 17 to 29 in ${String(first(nurseEntrants)?.period ?? 'Not available')} and ${text(value(last(nurseEntrants), 'projected_occupation_entries'))} in ${String(last(nurseEntrants)?.period ?? 'Not available')}.`,
        'These are model projections, labelled as such. They describe people entering the occupation across BC, not where they will choose to work.',
        'Whether a new nurse settles in the North depends on training location, housing and support, none of which this projection measures.',
      ], evidence: { kind: 'chart', datasetId: 'bc-health-occupation-projections', metric: 'projected_occupation_entries', filters: { age_group: '17 to 29', occupation: nurseOccupation } }, takeaway: { value: text(value(last(nurseEntrants), 'projected_occupation_entries')), label: `Projected new nurses aged 17–29 · ${String(last(nurseEntrants)?.period ?? '')}` } },
      { id: 'what-the-north-can-see', title: 'What can be seen in the North', paragraphs: [
        `Regional head counts are the one part of this picture available for the North. Registered nurse rates rose from ${text(registeredNurses(northernInterior, '2015'), 1)} to ${text(registeredNurses(northernInterior, '2024'), 1)} per 10,000 in Northern Interior between 2015 and 2024, and only from ${text(registeredNurses(northeast, '2015'), 1)} to ${text(registeredNurses(northeast, '2024'), 1)} in the Northeast.`,
        'Overtime, vacancies, retirement and migration all stop at the provincial or national level here. Treat them as the setting for Northern questions, not as Northern findings.',
        'A real retention picture would need Northern Health and university workforce records: turnover, vacancies and age by role.',
      ], evidence: { kind: 'chart', datasetId: 'nursing-workforce-northern', metric: 'direct_care_per_10k', filters: { nursing_type: 'Registered nurses' } }, takeaway: { value: `${text(registeredNurses(northeast, '2015'), 1)} → ${text(registeredNurses(northeast, '2024'), 1)}`, label: 'Northeast registered nurses per 10,000 · 2015 → 2024' } },
    ],
  },
];
