import { atlasDatasets } from "./data";
import type { AtlasRow } from "./types";
import { expansionStoryMaps } from './expansionStoryMaps';
import { followupStoryMaps } from './followupStoryMaps';

export interface StoryMapChapter {
  id: string;
  title: string;
  paragraphs: string[];
  evidence: {
    kind: "map" | "chart" | "comparison" | "paired" | "scenario";
    datasetId: string;
    metric: string;
    year?: string;
    entities?: string[];
    focusRegions?: string[];
    comparisonMetric?: string;
    scaleDomain?: [number, number];
    filters?: Record<string, string>;
  };
  takeaway?: { value: string; label: string };
}

export interface AtlasStoryMap {
  id: string;
  title: string;
  summary: string;
  topic: string;
  chapters: StoryMapChapter[];
}

// Takeaways are calculated from the same reviewed rows shown by the explorer.
// An absent/non-numeric value stays unavailable; it must never become zero.
function rows(datasetId: string): AtlasRow[] {
  return atlasDatasets.find((dataset) => dataset.id === datasetId)?.rows ?? [];
}

function number(row: AtlasRow | undefined, metric: string): number | undefined {
  const value = row?.[metric];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function sum(records: AtlasRow[], metric: string): number | undefined {
  if (!records.length) return undefined;
  const values = records.map((row) => number(row, metric));
  return values.every((value): value is number => value !== undefined)
    ? values.reduce((total, value) => total + value, 0)
    : undefined;
}

function format(value: number | undefined, decimals = 0): string {
  return value === undefined
    ? "Not available"
    : new Intl.NumberFormat("en-CA", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value);
}

function cad(value: number | undefined): string {
  return value === undefined ? "Not available" : `$${format(value)}`;
}

const population = rows("population-lha");
const projectedLhas = population.filter((row) => row.year === "2025");
const northernProjection = sum(projectedLhas, "population");
const princeGeorgeProjection = number(
  projectedLhas.find((row) => row.region_name === "Prince George"),
  "population",
);
const princeGeorgeShare =
  princeGeorgeProjection !== undefined && northernProjection !== undefined && northernProjection > 0
    ? (princeGeorgeProjection / northernProjection) * 100
    : undefined;
const outsidePrinceGeorge = sum(
  projectedLhas.filter((row) => row.region_name !== "Prince George"),
  "population",
);
const northwestLhas = [
  "Haida Gwaii", "Snow Country", "Prince Rupert", "Upper Skeena", "Smithers",
  "Kitimat", "Stikine", "Terrace", "Nisga'a", "Telegraph Creek",
];
const northeastLhas = ["Peace River South", "Peace River North", "Fort Nelson"];
const northwestProjection = sum(
  projectedLhas.filter((row) => northwestLhas.includes(String(row.region_name))),
  "population",
);
const northeastProjection = sum(
  projectedLhas.filter((row) => northeastLhas.includes(String(row.region_name))),
  "population",
);

const physicians = rows("physicians-hsda");
const northernRegions = ["Northwest HSDA", "Northern Interior HSDA", "Northeast HSDA"];
const northernPhysicians = physicians.filter((row) =>
  northernRegions.includes(String(row.health_region)),
);
const northernSpecialists2020 = sum(northernPhysicians, "specialists_2020");
const northernSpecialists2024 = sum(northernPhysicians, "specialists_2024");
const northernFamily2024 = sum(northernPhysicians, "family_physicians_2024");
const northernTotal2024 = sum(northernPhysicians, "total_physicians_2024");
const northeastPhysicians = physicians.find((row) => row.health_region === "Northeast HSDA");
const northwestPhysicians = physicians.find((row) => row.health_region === "Northwest HSDA");
const interiorPhysicians = physicians.find((row) => row.health_region === "Northern Interior HSDA");
const northeastRate = number(northeastPhysicians, "specialists_per_100k_2024");
const northwestRate = number(northwestPhysicians, "specialists_per_100k_2024");
const interiorRate = number(interiorPhysicians, "specialists_per_100k_2024");
const countValues = northernPhysicians.flatMap((row) => [
  number(row, "specialists_2020"), number(row, "specialists_2024"),
]);
const specialistCountDomain: [number, number] | undefined =
  countValues.length && countValues.every((value): value is number => value !== undefined)
    ? [0, Math.max(...countValues)]
    : undefined;

const princeGeorgeStudies = rows("clinical-pg");
const oncologyStudies = princeGeorgeStudies.filter((row) => row.condition_domain === "Cancer / oncology");
const princeGeorgeCity = rows("clinical-city").find((row) => row.query_city === "Prince George");
const unbcPublications = rows("publications").filter((row) => row.comparator === "UNBC / Prince George");
const unbcPayments = rows("cihr-payments").filter((row) => row.comparator === "UNBC / Prince George");
const schedules = rows("travel-schedule");
const burnsLakeRoute = "Burns Lake Prince George Burns Lake";
const burnsLakePatterns = schedules.filter((row) => row.route === burnsLakeRoute);
const baseScenario = rows("travel-scenarios").find((row) => row.scenario === "base");
const unbcNserc2024 = rows('nserc-awards').find(row => row.comparator === 'UNBC / Prince George' && row.fiscal_year === '2024');
const northernAges2025 = rows('population-lha-ages').filter(row => row.year === '2025');
const olderNorthern = sum(northernAges2025, 'population_65_plus');
const ageTotalNorthern = sum(northernAges2025, 'total_population');
const olderNorthernShare = olderNorthern !== undefined && ageTotalNorthern && ageTotalNorthern > 0 ? 100 * olderNorthern / ageTotalNorthern : undefined;
const northernNPs2024 = rows('nursing-workforce-northern').filter(row => row.year === '2024' && row.nursing_type === 'Nurse practitioners');
const unbcIncomeLatest = rows('research-income').find(row => row.comparator === 'UNBC / Prince George' && row.fiscal_year === '2023-2024');
const hospitalLatest = rows('hospital-facility-costs').filter(row => row.fiscal_year === '2024–2025');
const uhnLatest = hospitalLatest.find(row => row.location_code === 'hospital-university-hospital-of-northern-british-columbia');
const verifiedTrialSites = rows('trial-sites').filter(row => row.location_code);
const travelEvents = rows('travel-stop-events');
const locatedTravelEvents = travelEvents.filter(row => row.location_code);

export const atlasStoryMaps: AtlasStoryMap[] = [
  {
    id: "northern-communities",
    title: "One North, many communities",
    summary: "Move from the Northern Health region to individual local health areas, compare age structure, and distinguish population estimates from the 2025 projection.",
    topic: "Communities",
    chapters: [
      {
        id: "a-regional-start",
        title: "Begin with the whole North",
        paragraphs: [
          `The reviewed BC Stats series contains ${projectedLhas.length} Northern local health areas. Together their 2025 projected population is ${format(northernProjection)}. This is a regional population denominator, rather than a count of NHHR participants or people who will use a research hub.`,
          "Every area joins to a polygon through its original three-digit LHA code. The map shows the collected boundary snapshot for geographic context; its metadata does not establish a historical boundary vintage.",
        ],
        evidence: { kind: "map", datasetId: "population-lha", metric: "population", year: "2025" },
        takeaway: { value: format(northernProjection), label: "Northern LHA population · 2025 projection" },
      },
      {
        id: "prince-george-in-context",
        title: "A hub within a wider region",
        paragraphs: [
          `Prince George LHA accounts for ${format(princeGeorgeProjection)} people in the 2025 projection, or ${format(princeGeorgeShare, 1)}% of the Northern total. The other LHAs together account for ${format(outsidePrinceGeorge)} people. A story about a Prince George hub therefore needs a regional view as well as a local one.`,
          "Prince George LHA is larger than the municipality. The shaded polygon and its population cannot be read as a city census count, a facility catchment, or a measure of demand for research services.",
        ],
        evidence: {
          kind: "map", datasetId: "population-lha", metric: "population", year: "2025",
          focusRegions: ["Prince George"],
        },
        takeaway: { value: `${format(princeGeorgeShare, 1)}%`, label: "Share of Northern projected population in Prince George LHA" },
      },
      {
        id: "western-communities",
        title: "Follow the map west",
        paragraphs: [
          `The ten Northwest LHAs represented here include Haida Gwaii, Prince Rupert, Terrace, Smithers, and smaller areas farther north. Their combined 2025 projection is ${format(northwestProjection)} people. Individual area totals keep this diversity visible instead of reducing the west to one point on a map.`,
          "Administrative health areas do not represent every community boundary or Indigenous territory. Their populations describe the source geography; they do not establish community priorities, governance arrangements, or service needs.",
        ],
        evidence: {
          kind: "map", datasetId: "population-lha", metric: "population", year: "2025",
          focusRegions: northwestLhas,
        },
        takeaway: { value: format(northwestProjection), label: "Ten Northwest LHAs · 2025 projected population" },
      },
      {
        id: "peace-and-far-north",
        title: "Look toward the Peace and Fort Nelson",
        paragraphs: [
          `Peace River South, Peace River North, and Fort Nelson have a combined 2025 projected population of ${format(northeastProjection)}. The map offers a different geographic perspective on the same regional question: how could a hub connect with people across several local health areas?`,
          "Population and polygon size do not measure travel burden. Road journeys, referrals, and actual access experiences would need their own evidence before planning a specific service model.",
        ],
        evidence: {
          kind: "map", datasetId: "population-lha", metric: "population", year: "2025",
          focusRegions: northeastLhas,
        },
        takeaway: { value: format(northeastProjection), label: "Three Northeast LHAs · 2025 projected population" },
      },
      {
        id: "population-age-structure",
        title: "Compare age structure across the North",
        paragraphs: [
          `The 2025 projection contains ${format(olderNorthern)} people aged 65+ across the seventeen Northern LHAs, or ${format(olderNorthernShare, 1)}% of their combined projected population. The shaded values are each area's own share, rather than an average of the LHA percentages.`,
          "These groups are derived from the original single-year age columns, selecting Gender=T once. Ages 0–19, 20–64 and 65+ add exactly to the source total in every released area and year. The oldest source category is 90+.",
          "Age structure adds demographic context to regional research questions. It does not establish disease prevalence, care demand, trial eligibility or community priorities. The 2025 values remain projections; the trend view retains the source estimate labels for earlier years.",
        ],
        evidence: { kind: "map", datasetId: "population-lha-ages", metric: "share_65_plus", year: "2025" },
        takeaway: { value: `${format(olderNorthernShare, 1)}%`, label: "Share aged 65+ in the combined Northern population · 2025 projection" },
      },
      {
        id: 'older-population-share-and-count',
        title: 'Compare the share of older people with their number',
        paragraphs: [
          'In the 2025 projection, Telegraph Creek LHA has 245 people aged 65+ out of 794 people, a share of 30.9%. Prince George LHA has 18,654 people aged 65+ out of 105,544, a share of 17.7%. The area with the higher share is not necessarily the area with the larger number of older people.',
          'The paired maps show these two measures on the same Northern LHA geography and synchronized view, outlining Telegraph Creek and Prince George while retaining all seventeen source areas. Each map has its own labelled scale: percentages on one side and people on the other. On a narrow story panel, switch between Share and Count or expand the maps.',
          'Both measures come from the same original Gender=T age row for each area and year. The age 65+ count includes ages 65–89 and the source 90+ category once. All age groups reconcile to the original total. The 2025 figures remain projections, and the polygons provide geographic context rather than a disease or service catchment.',
        ],
        evidence: { kind: 'paired', datasetId: 'population-lha-ages', metric: 'share_65_plus', comparisonMetric: 'population_65_plus', year: '2025', focusRegions: ['Telegraph Creek', 'Prince George'] },
        takeaway: { value: '30.9% · 245 people', label: 'Telegraph Creek LHA aged 65+ · 2025 projection' },
      },
      {
        id: "estimates-and-projections",
        title: "Read the years with their labels",
        paragraphs: [
          `Across the same seventeen LHAs, the source total is ${format(sum(population.filter((row) => row.year === "2020"), "population"))} in the 2020 estimate and ${format(sum(population.filter((row) => row.year === "2024"), "population"))} in the 2024 estimate. The 2025 point is a projection. Connecting these points does not turn that projection into an observed population change.`,
          "The Atlas selects one Gender=T total per area and year. Earlier derived summaries added female, male, and total rows together, doubling the population; those summaries are kept in the audit rather than used in this story.",
        ],
        evidence: {
          kind: "chart", datasetId: "population-lha", metric: "population",
          entities: ["Prince George", "Peace River North", "Terrace", "Prince Rupert"],
        },
        takeaway: { value: "2025", label: "Projection · 2020–2024 points are source estimates" },
      },
    ],
  },
  {
    id: "physician-supply",
    title: "How physician supply varies across the North",
    summary: "Explore regional specialist rates, compare 2020 and 2024 counts on a shared scale, and see what physician supply can tell us about research planning.",
    topic: "Workforce",
    chapters: [
      {
        id: "regional-supply",
        title: "Start with a comparable regional measure",
        paragraphs: [
          "The reviewed physician dataset covers sixteen BC health service delivery areas. Its 2024 specialist rates allow a regional comparison using the source's measure per 100,000 people, while the counts answer a separate question about the number of physicians recorded.",
          "The Atlas preserves the published rates. It does not recompute them from its population series. An explicit crosswalk joins source 59xx health-region codes to BC HSDA polygons; the shading represents regional aggregates rather than physician practice locations.",
        ],
        evidence: { kind: "map", datasetId: "physicians-hsda", metric: "specialists_per_100k_2024" },
        takeaway: { value: String(physicians.length), label: "BC health service delivery areas in the reviewed snapshot" },
      },
      {
        id: "the-northeast",
        title: "Focus on the Northeast",
        paragraphs: [
          `Northeast HSDA has ${format(number(northeastPhysicians, "specialists_2024"))} specialists in the 2024 source, with a rate of ${format(northeastRate, 1)} per 100,000. The corresponding 2020 count is ${format(number(northeastPhysicians, "specialists_2020"))}. The count and the rate provide different perspectives on the same area.`,
          "These figures do not identify specialties, vacancies, full-time equivalents, appointment waits, or research staff. They can frame questions about operating a research network, but they cannot answer those questions alone.",
        ],
        evidence: {
          kind: "map", datasetId: "physicians-hsda", metric: "specialists_per_100k_2024",
          focusRegions: ["Northeast HSDA"],
        },
        takeaway: { value: format(northeastRate, 1), label: "Northeast specialists per 100,000 · 2024 source rate" },
      },
      {
        id: "two-northern-contrasts",
        title: "Compare the Northwest and Northern Interior",
        paragraphs: [
          `The 2024 source specialist rate is ${format(northwestRate, 1)} per 100,000 in Northwest HSDA and ${format(interiorRate, 1)} in Northern Interior HSDA. Their specialist counts are ${format(number(northwestPhysicians, "specialists_2024"))} and ${format(number(interiorPhysicians, "specialists_2024"))}, respectively. A single Northern average would hide this variation.`,
          "The regional rates should not be averaged into a Northern Health rate without the matching source denominators. Regional supply also does not establish whether a person can obtain a particular service or participate in a study.",
        ],
        evidence: {
          kind: "map", datasetId: "physicians-hsda", metric: "specialists_per_100k_2024",
          focusRegions: ["Northwest HSDA", "Northern Interior HSDA"],
        },
        takeaway: { value: `${format(northwestRate, 1)} / ${format(interiorRate, 1)}`, label: "Northwest / Northern Interior · specialists per 100,000 in 2024" },
      },
      {
        id: "counts-over-time",
        title: "Compare the same count in two years",
        paragraphs: [
          `The three Northern HSDAs together record ${format(northernSpecialists2020)} specialists in 2020 and ${format(northernSpecialists2024)} in 2024. Northeast changes from ${format(number(northeastPhysicians, "specialists_2020"))} to ${format(number(northeastPhysicians, "specialists_2024"))}; Northwest from ${format(number(northwestPhysicians, "specialists_2020"))} to ${format(number(northwestPhysicians, "specialists_2024"))}; Northern Interior from ${format(number(interiorPhysicians, "specialists_2020"))} to ${format(number(interiorPhysicians, "specialists_2024"))}.`,
          "The two maps show the three Northern HSDAs with the same count measure and colour scale. Grey areas outside them are not part of this comparison. Both years appear on the collected contextual boundaries; this comparison does not assert that historical boundary definitions have been harmonized, or explain why counts changed.",
        ],
        evidence: {
          kind: "comparison", datasetId: "physicians-hsda", metric: "specialists_2020",
          comparisonMetric: "specialists_2024", entities: northernRegions, focusRegions: northernRegions,
          scaleDomain: specialistCountDomain,
        },
        takeaway: { value: `${format(northernSpecialists2020)} → ${format(northernSpecialists2024)}`, label: "Northern specialist counts · 2020 → 2024" },
      },
      {
        id: "nursing-alongside-physicians",
        title: "Add a separate nursing perspective",
        paragraphs: [
          `The three Northern HSDAs record ${format(sum(northernNPs2024, 'direct_care_nurses'))} nurse practitioners employed in direct care in the 2024 source: 14 in Northwest, 28 in Northern Interior and 7 in Northeast. The map shows their publisher rates per 10,000 population, not the physician dataset's per-100,000 scale.`,
          "The source tables also distinguish registered nurses, licensed practical nurses and registered psychiatric nurses. Select one type and year in the explorer before mapping; the Atlas never sums regional or professional rates. Counts and publisher rates answer different questions.",
          "Direct-care employment excludes administration, education and research. It does not identify research staffing, vacancies, full-time equivalents or appointment access. Missing source markers remain missing, and the source's historical mapping changes and the contextual polygon vintage limit comparisons.",
        ],
        evidence: { kind: "map", datasetId: "nursing-workforce-northern", metric: "direct_care_per_10k", year: "2024", filters: { nursing_type: "Nurse practitioners" }, focusRegions: northernRegions },
        takeaway: { value: format(sum(northernNPs2024, 'direct_care_nurses')), label: "Direct-care nurse practitioners across three Northern HSDAs · 2024" },
      },
      {
        id: "planning-questions",
        title: "Turn the pattern into better questions",
        paragraphs: [
          `In 2024 the three Northern HSDAs record ${format(northernTotal2024)} physicians: ${format(northernFamily2024)} family physicians and ${format(northernSpecialists2024)} specialists. The chart retains each HSDA so that the regional total does not obscure how those physicians are distributed.`,
          "Planning a research hub would also require evidence on protected research time, coordinator support, relevant specialties, infrastructure, and local priorities. The public physician counts describe one part of that context, rather than a pool of staff available to NHHR.",
        ],
        evidence: {
          kind: "chart", datasetId: "physicians-hsda", metric: "total_physicians_2024",
          entities: northernRegions,
        },
        takeaway: { value: format(northernTotal2024), label: "Physicians across three Northern HSDAs · 2024 source count" },
      },
    ],
  },
  {
    id: "research-pathways",
    title: "From research activity to trial presence",
    summary: "Put Prince George's registered study portfolio beside regional population, UNBC publication activity, and historical CIHR payments without treating them as one measure.",
    topic: "Research",
    chapters: [
      {
        id: "a-place-to-start",
        title: "Begin with place, then change the lens",
        paragraphs: [
          `Prince George LHA's 2025 projected population is ${format(princeGeorgeProjection)}. This supplies geographic context for a hub located in Prince George, but it cannot identify a trial's eligible population or the population a university's research serves.`,
          "The next chapters use city-site and institution records. Those observations remain attached to their recorded city or institution; they are not assigned to the LHA polygon or converted into a regional rate.",
        ],
        evidence: {
          kind: "map", datasetId: "population-lha", metric: "population", year: "2025",
          focusRegions: ["Prince George"],
        },
        takeaway: { value: format(princeGeorgeProjection), label: "Prince George LHA · 2025 projected population" },
      },
      {
        id: "registered-site-presence",
        title: "Find Prince George in the registry snapshot",
        paragraphs: [
          `The collected April 2026 registry query identifies ${format(number(princeGeorgeCity, "exact_city_site_studies"))} studies with an exact Prince George city-site match. The city points show Prince George alongside Thunder Bay and Sudbury; dot area compares their collected study counts on the full seven-city snapshot scale. These are selected comparators, rather than evidence of otherwise equivalent cities.`,
          "These counts include historical study statuses. A multi-site study can appear in several cities, and a registered site does not establish local enrollment, participant eligibility, or current trial availability.",
        ],
        evidence: {
          kind: "map", datasetId: "clinical-city", metric: "exact_city_site_studies",
          entities: ["Prince George", "Thunder Bay", "Sudbury"],
        },
        takeaway: { value: format(number(princeGeorgeCity, "exact_city_site_studies")), label: "Studies with a Prince George city-site match · April 2026 snapshot" },
      },
      {
        id: 'trial-condition-mix',
        title: 'Compare the conditions represented in trial portfolios',
        paragraphs: [
          'Seven of the ten reviewed Prince George studies are coded as cancer or oncology, a share of 70%. Thunder Bay has 153 of 205 records in that category, or 74.6%; Vancouver has 1,446 of 5,588, or 25.9%. A percentage view makes portfolio composition visible while the counts retain the very different scales of these selected cities.',
          'The reviewed condition summary preserves 77 original city/domain rows across seven cities and thirteen distinct NHHR coded condition labels. Each city’s condition counts reconcile to the existing collected city total. Domains omitted by the source remain absent; no additional observed zero rows are created.',
          'The denominator stays the full source city portfolio when a condition filter hides other categories. Condition coding is NHHR analysis, and a multi-site study can appear in several cities. These historical records do not establish disease prevalence, local enrollment, research capacity or current trial availability.',
        ],
        evidence: { kind: 'chart', datasetId: 'clinical-condition-mix', metric: 'condition_share_pct', entities: ['Prince George', 'Thunder Bay', 'Vancouver'], year: '2026-04-29' },
        takeaway: { value: '7 / 10 · 70%', label: 'Prince George source portfolio coded cancer / oncology' },
      },
      {
        id: "look-inside-the-portfolio",
        title: "Look inside the local study portfolio",
        paragraphs: [
          `${oncologyStudies.length} of the ${princeGeorgeStudies.length} reviewed Prince George registry records are coded as cancer or oncology in the NHHR analysis. Each bar represents one of those public study records; the IDs make it possible to inspect the original registry entries in the explorer.`,
          "The portfolio also includes diabetes/prevention, respiratory/COPD, and trauma/orthopedics records. Its condition coding is an analytical interpretation. Registry presence can suggest subjects for feasibility work, but it does not establish a ready research program or the capacity to run additional trials.",
        ],
        evidence: {
          kind: "chart", datasetId: "clinical-pg", metric: "study_count",
          entities: oncologyStudies.map((row) => String(row.nct_id)),
        },
        takeaway: { value: `${oncologyStudies.length} of ${princeGeorgeStudies.length}`, label: "Reviewed Prince George study records coded cancer / oncology" },
      },
      {
        id: 'verified-study-sites',
        title: 'Move from a city tag to a physical study site',
        paragraphs: [
          `The reviewed portfolio connects ${format(sum(verifiedTrialSites, 'distinct_studies'))} study-site records to ${verifiedTrialSites.length} physical sites: BC Cancer’s Centre for the North, the Family YMCA and Prince George Surgery Centre. The cancer centre’s source aliases resolve to one facility with seven studies.`,
          'The points use official facility addresses and independently returned map features. Reused registry city-centre coordinates and the Vancouver BC Cancer Agency point are excluded. The original descriptions, registry IDs and location evidence remain available in the explorer.',
          'One record describes thirteen First Nations near Prince George rather than a unique facility and stays unlocated. Historical study statuses do not establish current recruitment, local enrollment, eligibility or study-room locations.',
        ],
        evidence: { kind: 'map', datasetId: 'trial-sites', metric: 'distinct_studies', year: '2026-04-29' },
        takeaway: { value: String(verifiedTrialSites.length), label: 'Reviewed physical study sites · April 2026 portfolio' },
      },
      {
        id: 'trial-conditions-at-facilities',
        title: 'Connect conditions to verified facilities beyond Prince George',
        paragraphs: [
          'The collected comparator study table contains exact-city facility names and NHHR condition codes, making a facility view possible without distributing city totals across guessed sites. This map shows the cancer/oncology subset at individually reviewed Vancouver facilities. Use the explorer to change the city, condition, count or facility share.',
          'Aliases of the same study at one physical facility count once. Each share retains the full reviewed facility portfolio as its denominator. A study may occur at multiple facilities, so site counts must not be added to make a distinct city total. The points are representative facilities or buildings rather than exact trial rooms.',
          'The review extends to named sites in six cities outside Prince George. Operator addresses and named map features resolve conflicting PGMaps candidates: Children’s and Women’s remain separate, UBC Hospital does not receive the VGH payee point, and Calgary’s former Tom Baker building remains separate from Arthur Child. These historical records do not establish current recruitment or visit locations at every date.',
        ],
        evidence: { kind: 'map', datasetId: 'trial-facility-conditions', metric: 'distinct_studies', year: '2026-04-29', filters: { query_city: 'Vancouver', condition_domain: 'Cancer / oncology' } },
        takeaway: { value: '22 + 3', label: 'Reviewed facilities outside Prince George + existing local sites' },
      },
      {
        id: 'trial-facility-mapping-gaps',
        title: 'Read facility coverage alongside the condition map',
        paragraphs: [
          'These bars count source city studies with at least one verified facility connection. They describe mapping coverage within the collected portfolio, rather than all studies at a city’s facilities. The connected explorer preserves each city’s full source denominator, the number with no verified facility, and the partially located records.',
          'A study with one located facility can also have an unresolved site. Generic Research Site names, broad health organizations, universities and names requiring a further address or historical-site review remain unassigned. An absent condition row is not reported as an observed zero.',
          'The source study IDs and condition counts reconcile with the existing seven-city summaries. The downloadable reviewed study-site evidence and location provenance make these joins inspectable. Additional verified aliases can extend the map without changing the original city observations or the UNBC design.',
        ],
        evidence: { kind: 'chart', datasetId: 'trial-facility-coverage', metric: 'studies_with_verified_facility', year: '2026-04-29' },
      },
      {
        id: 'hospital-reporting-sites',
        title: 'Read hospital measures at reviewed display sites',
        paragraphs: [
          `The latest CIHI period contains ${hospitalLatest.length} hospital reporting rows across BC. Northern Health’s facility points put the source’s cost per weighted case in geographic context; UHNBC’s FY2024–2025 value is ${cad(number(uhnLatest, 'cost_per_weighted_case'))}.`,
          'The measure is an organizational cost indicator, not a patient bill, care-quality score or estimate of research capacity. Suppressed values remain missing and retain the source literal. Choose one fiscal year before comparing sites; costs are not summed across years or hospitals.',
          'Map points represent reviewed current display sites. Natsoojeh’s current hospital opened on 14 January 2025; the workbook retroactively uses its reporting name for earlier periods. Those costs describe the continuing reporting unit and are not assigned to the old or new building. The separate directory preserves ambiguous groups without a map point.',
        ],
        evidence: { kind: 'map', datasetId: 'hospital-facility-costs', metric: 'cost_per_weighted_case', year: '2024–2025', filters: { health_authority: 'Northern Health (B.C.)' } },
        takeaway: { value: cad(number(uhnLatest, 'cost_per_weighted_case')), label: 'UHNBC cost per weighted case · FY2024–2025' },
      },
      {
        id: "institutional-research-activity",
        title: "Broaden the view to UNBC research activity",
        paragraphs: [
          `The collected OpenAlex series records ${format(sum(unbcPublications, "works"))} UNBC-affiliated works across 2021–2025. Keeping the annual series visible shows variation rather than presenting a five-year total as a typical year.`,
          "These works cover all research fields. They are neither health-research-only publications nor outputs attributable to NHHR. Multi-affiliated works can appear in several institutional totals, and the source's 2025 coverage may be affected by indexing lag.",
        ],
        evidence: { kind: "chart", datasetId: "publications", metric: "works", entities: ["UNBC / Prince George"] },
        takeaway: { value: format(sum(unbcPublications, "works")), label: "UNBC-affiliated works · all fields, 2021–2025 source snapshot" },
      },
      {
        id: "funding-is-another-measure",
        title: "Keep funding flows distinct from outputs",
        paragraphs: [
          `The reviewed UNBC CIHR series records ${cad(sum(unbcPayments, "amount_paid_fy"))} in annual payments across FY2019–2024. These are fiscal-year payment flows, rather than lifetime award commitments or an estimate of NHHR revenue.`,
          "FY2025 is omitted because every source comparator has a zero payment placeholder despite project records. Publication counts, registered studies, and payments describe different aspects of research activity. Together they frame questions about partnerships and operating requirements; they do not quantify the hub's future impact.",
        ],
        evidence: { kind: "chart", datasetId: "cihr-payments", metric: "amount_paid_fy", entities: ["UNBC / Prince George"] },
        takeaway: { value: cad(sum(unbcPayments, "amount_paid_fy")), label: "UNBC CIHR annual payments · FY2019–2024 reviewed series" },
      },
      {
        id: 'research-income-on-the-map',
        title: 'Keep research income in its accounting context',
        paragraphs: [
          `UNBC's FY2023–2024 sponsored-research income in the reviewed CAUBO source is ${cad(number(unbcIncomeLatest, 'sponsored_research_income_cad'))}. This map compares seven verified university records using one annual sponsored-research subtotal per institution.`,
          "The original figures are in thousands of dollars and are explicitly converted to CAD. Source fiscal labels and reporting precision are retained. BC Cancer has no matching university record in this selection; it is absent rather than assigned zero.",
          "Sponsored-research income is an accounting measure across fields. It is distinct from NSERC award amounts, CIHR annual payments, health-only funding and NHHR revenue. Point locations represent campuses without assigning institution-wide income to an individual site or local population.",
        ],
        evidence: { kind: 'map', datasetId: 'research-income', metric: 'sponsored_research_income_cad', year: '2023-2024' },
        takeaway: { value: cad(number(unbcIncomeLatest, 'sponsored_research_income_cad')), label: 'UNBC sponsored-research income · FY2023–2024 source account' },
      },
      {
        id: 'institutional-awards-on-the-map',
        title: 'Compare institutions on a map',
        paragraphs: [
          `The reviewed NSERC comparison contains six institutions for FY2024. UNBC's source award amount is ${cad(number(unbcNserc2024, 'total_award_amount'))}. Each dot uses a verified representative campus location; its area is proportional to the institution's award amount for that fiscal year.`,
          'These awards cover NSERC’s science and engineering scope. They are distinct from CIHR annual payments, health-only activity, and NHHR funding. University totals can include multiple campuses and affiliations; the dots do not allocate money to the displayed campus or its surrounding population.',
          'Open the explorer to change the fiscal year, compare award counts or medians, filter institutions, and switch between the map, graph and source records. The dot scale stays anchored to the full comparator cohort in the selected period.',
        ],
        evidence: { kind: 'map', datasetId: 'nserc-awards', metric: 'total_award_amount', year: '2024' },
        takeaway: { value: '6', label: 'Reviewed institutional comparators · FY2024 NSERC awards' },
      },
    ],
  },
  {
    id: "travel-and-time",
    title: "Travel, time and the evidence we still need",
    summary: "Explore northern geography, read the recorded NH Connections schedule patterns, and change the assumptions behind hypothetical travel and patient-time values.",
    topic: "Travel",
    chapters: [
      {
        id: "geography-before-assumptions",
        title: "Put the travel question in its geographic context",
        paragraphs: [
          `The seventeen Northern LHAs have a combined 2025 projected population of ${format(northernProjection)}. This map establishes where the source areas are; it does not tell us how many people travel for care or which journeys a local research service could avoid.`,
          "Travel questions depend on origin, destination, service line, mode, companions, and accommodation. The Atlas keeps the geographic context visible while distinguishing the schedule evidence and the assumptions that follow.",
        ],
        evidence: { kind: "map", datasetId: "population-lha", metric: "population", year: "2025" },
        takeaway: { value: String(projectedLhas.length), label: "Northern local health areas in the population context" },
      },
      {
        id: "what-the-schedule-records",
        title: "Read a schedule as a schedule",
        paragraphs: [
          `The June 2026 NH Connections extraction contains ${format(sum(schedules, "recorded_stop_events"))} recorded stop events summarized into ${schedules.length} route and service-day patterns. The chart counts those source events; it does not count passengers, departures per week, or trips completed.`,
          "An arrival, departure, break, or overnight event can be a separate source record. The collected times are preserved as text. Current schedules, fares, eligibility, and booking information belong on the linked route source pages.",
        ],
        evidence: { kind: "chart", datasetId: "travel-schedule", metric: "recorded_stop_events" },
        takeaway: { value: format(sum(schedules, "recorded_stop_events")), label: "Recorded schedule stop events · June 2026 extraction" },
      },
      {
        id: "one-corridor-two-patterns",
        title: "Look closely at one recorded corridor",
        paragraphs: [
          `The Burns Lake–Prince George–Burns Lake route appears in ${burnsLakePatterns.length} source patterns, Tuesday and Wednesday. Their stop-event counts differ. The route label provides a useful starting point for investigating journeys, while the individual records preserve the recorded day and stops.`,
          "A route's first and last recorded times are not automatically an individual's travel duration. We do not draw an inferred road route, allocate passengers to its endpoints, or convert stop-event counts into patient demand.",
        ],
        evidence: {
          kind: "chart", datasetId: "travel-schedule", metric: "recorded_stop_events",
          entities: [burnsLakeRoute],
        },
        takeaway: { value: String(burnsLakePatterns.length), label: "Collected service-day patterns for the Burns Lake–Prince George route" },
      },
      {
        id: 'recorded-stop-connections',
        title: 'Follow the recorded stops on the map',
        paragraphs: [
          'This map follows the collected Tuesday Burns Lake–Prince George schedule. Dot area shows the number of source events at each reviewed reference point. Separate arrival, departure and break records are preserved; their count does not measure trips or passengers.',
          'Dashed lines connect recorded reference points in source order within one schedule leg. Unknown locations, sequence restarts and outward/return leg boundaries split the lines. These connections are schematic: they do not follow roads or measure driving distance and journey time.',
          'The explorer keeps route, recorded day, event type and source leg available as filters. A line appears only while all its contributing events are included. Source times remain text and the linked route pages provide the schedule context.',
        ],
        evidence: { kind: 'map', datasetId: 'travel-stop-events', metric: 'event_count', filters: { route_slug: 'burns-lake-prince-george-burns-lake', service_day: 'Tuesday' } },
        takeaway: { value: format(sum(travelEvents.filter(row => row.route_slug === 'burns-lake-prince-george-burns-lake' && row.service_day === 'Tuesday'), 'event_count')), label: 'Recorded Tuesday schedule events · June 2026 extraction' },
      },
      {
        id: 'travel-location-precision',
        title: 'Keep the precision of each reference visible',
        paragraphs: [
          `${locatedTravelEvents.length} of ${travelEvents.length} source events connect to reviewed locations: 96 facility or address references and 184 broader town references. Fifty-six distinct points cover those records. The town points are geographic context because the exact boarding address remains unverified.`,
          'Four Mackenzie Junction and two Small River events remain unresolved. Their rows and original labels stay in the table and download; no city-centre substitute or line through those missing stops is created.',
          'Even a reviewed hospital or civic address reference does not verify a boarding door or historical pickup bay. Selecting a point reveals its precision, location evidence and limitations. The size compares source event counts across the extraction rather than observed patient travel.',
        ],
        evidence: { kind: 'map', datasetId: 'travel-stop-locations', metric: 'recorded_stop_events' },
        takeaway: { value: `${locatedTravelEvents.length} / ${travelEvents.length}`, label: 'Source events with reviewed geographic references · six unresolved' },
      },
      {
        id: "change-the-assumptions",
        title: "Test assumptions before claiming a benefit",
        paragraphs: [
          `The source's hypothetical base case assumes ${format(number(baseScenario, "patients_reached"))} patients reached and ${format(number(baseScenario, "avoided_trips"))} avoided trips at ${cad(number(baseScenario, "cost_per_trip"))} per trip. It produces ${cad(number(baseScenario, "avoided_travel_value"))} in modelled travel value, while its separate patient-time assumptions produce ${cad(number(baseScenario, "patient_time_value"))}. Change the inputs to see how much the outputs depend on those choices.`,
          "Travel value equals assumed avoided trips multiplied by assumed cost per trip. Patient-time value equals assumed patients reached multiplied by assumed hours saved per patient and assumed value per hour. These are hypothetical calculations, not observed savings, forecasts, or an NHHR causal effect.",
          "A credible applied estimate would need a defined intervention, eligible patient population, baseline journeys, measured changes, and defensible cost and time inputs. The current snapshot does not supply those patient-level or service-line measurements.",
        ],
        evidence: { kind: "scenario", datasetId: "travel-scenarios", metric: "avoided_travel_value", entities: ["base"] },
        takeaway: { value: cad(number(baseScenario, "avoided_travel_value")), label: "Hypothetical base-case travel value · source assumptions" },
      },
    ],
  },
  ...expansionStoryMaps,
  ...followupStoryMaps,
];
