export const officialMap = "https://www.unbc.ca/about-unbc/campus-maps";
export type Category = "learning" | "life" | "outdoors" | "arrival";
export const categories: { id: Category; label: string; color: string }[] = [
  { id: "learning", label: "Learning & research", color: "#035642" },
  { id: "life", label: "Campus life", color: "#977000" },
  { id: "outdoors", label: "Outdoors", color: "#006161" },
  { id: "arrival", label: "Getting here", color: "#685c75" },
];
export type Place = {
  id: string;
  name: string;
  short: string;
  number: string;
  category: Category;
  coordinates: [number, number];
  description: string;
  detail: string;
  osm: string;
  url: string;
};
export const places: Place[] = [
  {
    id: "library",
    name: "Geoffrey R. Weller Library",
    short: "Weller Library",
    number: "5",
    category: "learning",
    coordinates: [-122.81309, 53.893002],
    description: "A place to read, research, and connect.",
    detail:
      "Find Library Services in building 5. Use UNBC’s building directory for room locations and the library website for current services and hours.",
    osm: "way/41298822",
    url: "https://www.unbc.ca/library",
  },
  {
    id: "hall",
    name: "Charles J. McCaffray Hall",
    short: "McCaffray Hall",
    number: "3",
    category: "learning",
    coordinates: [-122.813111, 53.891646],
    description: "The southern end of the main academic complex.",
    detail:
      "Building 3 on the official campus overview. Consult the building directory for offices and room locations.",
    osm: "way/41298823",
    url: officialMap,
  },
  {
    id: "research",
    name: "Research Laboratory",
    short: "Research Laboratory",
    number: "4",
    category: "learning",
    coordinates: [-122.814442, 53.893029],
    description: "Research at the heart of campus.",
    detail:
      "Building 4 on the official campus overview. This point marks the building, rather than a public entrance or individual laboratory.",
    osm: "way/41298828",
    url: officialMap,
  },
  {
    id: "teaching",
    name: "Teaching Laboratory",
    short: "Teaching Laboratory",
    number: "8",
    category: "learning",
    coordinates: [-122.814131, 53.893758],
    description: "Space for hands-on learning.",
    detail:
      "Building 8 on the official campus overview. Room numbers begin with the building number; consult UNBC’s directory for the room and floor you need.",
    osm: "way/41298829",
    url: officialMap,
  },
  {
    id: "health",
    name: "Dr. Donald Rix Northern Health Sciences Centre",
    short: "Health Sciences Centre",
    number: "9",
    category: "learning",
    coordinates: [-122.813098, 53.893704],
    description: "A home for health sciences on campus.",
    detail:
      "Building 9 on the official campus overview. Follow the official directory for lecture theatres and specific room locations.",
    osm: "way/41298830",
    url: officialMap,
  },
  {
    id: "tlc",
    name: "Teaching and Learning Centre",
    short: "Teaching & Learning",
    number: "10",
    category: "learning",
    coordinates: [-122.813825, 53.894433],
    description: "The northern end of the academic complex.",
    detail:
      "Building 10 on the official campus overview. Use the building directory to locate services and classrooms inside.",
    osm: "way/41298832",
    url: officialMap,
  },
  {
    id: "forestry",
    name: "I.K. Barber Enhanced Forestry Laboratory",
    short: "Forestry Laboratory",
    number: "F",
    category: "learning",
    coordinates: [-122.815958, 53.893309],
    description: "A connection to the forests of northern B.C.",
    detail:
      "Named on UNBC’s campus overview. The map marker is an approximate building centre; check access arrangements with your host.",
    osm: "way/41298820",
    url: officialMap,
  },
  {
    id: "student",
    name: "Conference Centre & Northern University Student Centre",
    short: "Student Centre",
    number: "6",
    category: "life",
    coordinates: [-122.814303, 53.891861],
    description: "A gathering place in the main campus complex.",
    detail:
      "Building 6 on the current UNBC campus overview. Consult the official directory for the NUSC Event Space, student offices, and food services.",
    osm: "way/41298827",
    url: officialMap,
  },
  {
    id: "sport",
    name: "Charles Jago Northern Sport Centre",
    short: "Northern Sport Centre",
    number: "14",
    category: "life",
    coordinates: [-122.812498, 53.888804],
    description: "Space to move, play, and train.",
    detail:
      "Building 14 on the official map. Visit the Northern Sport Centre website for current programs, hours, and facility information.",
    osm: "way/41298811",
    url: "https://www.unbc.ca/northern-sport-centre",
  },
  {
    id: "neyoh",
    name: "Neyoh Residence",
    short: "Neyoh Residence",
    number: "R1",
    category: "life",
    coordinates: [-122.816344, 53.89165],
    description: "Residence 1, on the west side of campus.",
    detail:
      "Neyoh is identified as Residence 1 on the official campus overview. Use UNBC Housing for current residence information.",
    osm: "way/41298818",
    url: "https://www.unbc.ca/housing",
  },
  {
    id: "keyoh",
    name: "Keyoh Residence",
    short: "Keyoh Residence",
    number: "R2",
    category: "life",
    coordinates: [-122.817583, 53.891586],
    description: "Residence 2, beside Neyoh.",
    detail:
      "Keyoh is identified as Residence 2 on the official campus overview. Use UNBC Housing for current residence information.",
    osm: "way/86094387",
    url: "https://www.unbc.ca/housing",
  },
  {
    id: "agora",
    name: "Agora Courtyard",
    short: "Agora Courtyard",
    number: "7",
    category: "outdoors",
    coordinates: [-122.813459, 53.892384],
    description: "An open space within the academic complex.",
    detail:
      "Number 7 on UNBC’s campus overview. The courtyard sits between the library and the southern academic buildings.",
    osm: "way/41303130",
    url: officialMap,
  },
  {
    id: "garden",
    name: "David Douglas Botanical Garden",
    short: "Botanical Garden",
    number: "G",
    category: "outdoors",
    coordinates: [-122.81066, 53.892839],
    description: "A garden beside the campus.",
    detail:
      "An outdoor landmark shown in OpenStreetMap. Visit UNBC’s campus information for more about its gardens and surroundings.",
    osm: "way/468461089",
    url: "https://www.unbc.ca/about-unbc/campus-location-details",
  },
  {
    id: "bus",
    name: "UNBC Exchange",
    short: "Bus exchange",
    number: "B",
    category: "arrival",
    coordinates: [-122.813667, 53.891248],
    description: "Arrive by bus at the Ceremonial Loop.",
    detail:
      "The bus loop is marked on UNBC’s official campus maps. Use BC Transit for current routes and schedules; this explorer does not show live departures.",
    osm: "node/8580971526",
    url: "https://www.bctransit.com/prince-george/",
  },
  {
    id: "parking-a",
    name: "Parking Lot A",
    short: "Parking Lot A",
    number: "PA",
    category: "arrival",
    coordinates: [-122.810948, 53.891283],
    description: "Parking east of the academic complex.",
    detail:
      "Lot A is labelled on UNBC’s campus overview. Check current parking rules, permits, and payment information before your visit.",
    osm: "way/41298794",
    url: "https://www.unbc.ca/parking",
  },
  {
    id: "parking-b",
    name: "Parking Lot B",
    short: "Parking Lot B",
    number: "PB",
    category: "arrival",
    coordinates: [-122.811094, 53.893914],
    description: "Parking northeast of the library.",
    detail:
      "Lot B is labelled on UNBC’s campus overview. This marker identifies the lot, not an accessible parking space or verified entrance.",
    osm: "way/41298795",
    url: "https://www.unbc.ca/parking",
  },
  {
    id: "parking-c",
    name: "Parking Lot C",
    short: "Parking Lot C",
    number: "PC",
    category: "arrival",
    coordinates: [-122.81319, 53.895422],
    description: "Parking at the north end of campus.",
    detail:
      "Lot C is labelled on UNBC’s campus overview. Check UNBC Parking for current permits, rules, and payment information.",
    osm: "way/41298804",
    url: "https://www.unbc.ca/parking",
  },
];
export const campusCenter: [number, number] = [-122.8138, 53.89225];
export const campusBounds: [[number, number], [number, number]] = [
  [-122.8192, 53.8876],
  [-122.8091, 53.8962],
];
