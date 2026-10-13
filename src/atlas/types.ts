export type AtlasValue = string | number | null;
export type AtlasRow = Record<string, AtlasValue>;
export interface AtlasColumn {
  key: string;
  label: string;
  type: "text" | "number";
  unit?: string;
}
export interface AtlasDataset {
  id: string;
  title: string;
  description: string;
  topic: string;
  geography: "hsda" | "lha" | "ha" | "hr2015" | "chsa" | "cd" | "csd" | "er" | "institution" | "city" | "facility" | "stop" | "route" | "none";
  status: "observed" | "projection" | "scenario" | "review";
  timeLabel: string;
  sourceName: string;
  sourceUrl: string;
  datasetId: string;
  sourceOrigin?: "zoer" | "mixed" | "supplemental";
  supplementalSources?: { name: string; url: string; scope: string }[];
  relatedZoerDatasetIds?: string[];
  indicatorMetadata?: Record<string, { definition: string; notes: string; comments: string; furtherInformation: string }>;
  tableName: string;
  notes: string[];
  columns: AtlasColumn[];
  rows: AtlasRow[];
  defaultMetric: string;
  entityField: string;
  timeField?: string;
  boundaryKeyField?: string;
  mapLabelField?: string;
  withheldPeriods?: string[];
  defaultFilters?: Record<string, string>;
  mapLocationsAsset?: string;
  mapBoundaryCaption?: string;
  mapConnectionsAsset?: string;
  mapAggregation?: { method: "sum"; metric: string };
  mapScaleFields?: string[];
}
export interface AtlasStory {
  id: string;
  title: string;
  kicker: string;
  summary: string;
  body: string[];
  datasetId: string;
  metric: string;
  featured?: boolean;
  visualization?: "pairedAgeMaps";
  mapFilters?: Record<string, string>;
}
