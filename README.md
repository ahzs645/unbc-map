# UNBC Campus Explorer

A UNBC styled interactive campus map built with the standalone **PGMaps GeoToolkit**, using the forest green, teal, gold, warm neutrals, and BC Sans typography in the supplied NALS WordPress theme.

**Live map:** https://projects.ahmadjalil.com/unbc-map/

This is an independent design concept, not an official University of Northern British Columbia map.

## Explore

- Search 17 Prince George campus places and filter by learning, campus life, outdoors, or arrival.
- Select a list item, building footprint, or numbered marker to open its details.
- Switch between a custom campus basemap, satellite imagery, and a dark basemap.
- Toggle local building, parking, garden, and path detail.
- Reset the campus view or copy a selected-place link, such as `#place=library`.
- Use the responsive sidebar and place cards on phones.
- Open official UNBC maps and service websites from the directory.

## Develop

Requires Node.js 22.12 or newer and npm 11.19.0 (the version used by CI).

```sh
git clone --recurse-submodules https://github.com/ahzs645/unbc-map.git
cd unbc-map
npm install --global npm@11.19.0
npm ci
npm run toolkit:build
npm run dev
```

```sh
npm run build
npx playwright install chromium
npm test
```

The browser checks serve the production build at `/unbc-map/` and cover real WebGL initialization, local campus layers, production asset paths, fonts, search/filter synchronization, empty results, place links, basemap switching, layer visibility, responsive layout, and the accessible source dialog. External CARTO styles are stubbed for reliable tests; live basemaps are checked separately in the browser.

## Architecture and toolkit reuse

`packages/geo-toolkit` pins the same public toolkit commit used by the inspected PGMaps checkout: `a7bc7274a6df0c4063f88c0388b61206bf68c2fb`. The app imports its compiled package exports and CSS. It reuses `Map`, markers, fill and line layers, controls, scale bar, workspace provider, sidebar layout/shell, responsive detail cards, and basemap appearance functions. No PGMaps application data, environment files, or scraper code is copied.

`scripts/build-toolkit.mjs` builds a disposable copy of that pinned source with namespace imports and narrow paint-property type adaptations for MapLibre 6.13. The compatibility step allows use of the fixed renderer release while preserving the toolkit submodule source. It writes only generated `dist` output back to the package. The root overrides keep toolkit dependency resolution reproducible. New toolkit releases can eventually replace this compatibility step.

- `src/data.ts`: curated place directory, category colours, and official links.
- `src/mapStyles.ts`: UNBC basemap palette and tile providers.
- `src/App.tsx`: directory, map interactions, detail cards, and source notes.
- `src/styles.css`: original responsive UNBC styled interface.
- `public/data/campus.geojson`: local, bounded OpenStreetMap geometry snapshot.

## Sources and licences

Building names/numbers follow [UNBC campus maps](https://www.unbc.ca/about-unbc/campus-maps), including the campus overview updated March 2026 and building directory updated April 2026. The Prince George campus address and territory acknowledgement follow [UNBC campus contact information](https://www.unbc.ca/about-unbc/contact). Official sources take priority where OSM building names differ.

Coordinates and 159 building, parking, garden, and path geometries were extracted from the [OpenStreetMap API](https://www.openstreetmap.org/api/0.6/map?bbox=-122.824,53.886,-122.800,53.899) on October 10, 2026. OpenStreetMap data is © OpenStreetMap contributors, available under the [Open Database License](https://www.openstreetmap.org/copyright). The derived geometry dataset and OSM coordinates remain under the ODbL; the MIT application licence does not replace their licence. Each place links to its original OSM object. The snapshot is bounded to the campus and does not require live Overpass queries.

The campus/dark basemaps use [CARTO](https://carto.com/attributions) with OpenStreetMap attribution. Satellite imagery uses Esri World Imagery, with source credits shown on the map. Those remote services require internet access; the local place directory remains usable when a basemap is unavailable. Imagery dates vary by location.

BC Sans Regular/Bold are supplied in the user-provided NALS theme, distributed under the [SIL Open Font License](public/fonts/LICENSE_OFL.txt), with provenance in the [official BC Sans project](https://github.com/bcgov/bc-sans). The proprietary Helvetica Neue Black file from the theme is not redistributed. Display headings use installed system font fallbacks. The interface uses the supplied colour values with original CSS rather than copying the WordPress theme implementation. No official university logo asset is included.

App source is MIT licensed. GeoToolkit retains its MIT licence in the submodule. Other dependencies retain their respective licences.

Locations represent approximate building or area centres, not verified public or accessible entrances. This map does not provide room-level routing, live transit, hours, or accessibility guarantees. Use UNBC’s official resources for those details.

## GitHub Pages

`.github/workflows/pages.yml` installs dependencies with a lockfile, checks out the toolkit submodule, builds the app, and deploys `dist` through GitHub Pages. Relative Vite asset paths support project Pages hosting. Pushes to `main` automatically publish updates. In repository settings, Pages uses **GitHub Actions** as its source.
