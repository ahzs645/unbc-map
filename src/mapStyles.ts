import type { StyleSpecification } from "maplibre-gl";
import { buildBasemapStyle } from "@pgmaps/geo-toolkit/map";

export type Basemap = "campus" | "satellite" | "contrast";
export async function loadCampusStyle(): Promise<StyleSpecification> {
  const response = await fetch(
    "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  );
  if (!response.ok) throw new Error("The campus basemap could not be loaded.");
  const style = (await response.json()) as StyleSpecification;
  return buildBasemapStyle(style, {
    backgroundColor: "#f1efe9",
    waterColor: "#83b8b0",
    landcoverColor: "#a9c3ab",
    buildingColor: "#c1cbc0",
    countryBoundaryColor: "#977000",
    otherBoundaryColor: "#c3bcae",
    roadColor: "#ffffff",
    labelColor: "#43584e",
    labelHaloColor: "#f9f8f3",
    showWater: true,
    showLandcover: true,
    showCountryBoundaries: true,
    showOtherBoundaries: false,
    showLabels: true,
  });
}
export const satelliteStyle: StyleSpecification = {
  version: 8,
  sources: {
    imagery: {
      type: "raster",
      tileSize: 256,
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      attribution:
        "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    },
  },
  layers: [{ id: "imagery", type: "raster", source: "imagery" }],
};
export const fallbackStyle: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#eeeee5" },
    },
  ],
};
export const contrastStyle =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
