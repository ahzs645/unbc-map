import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  ExternalLink,
  Info,
  Layers,
  MapPin,
  Mountain,
  RotateCcw,
  Search,
  Share2,
  Trees,
  X,
} from "lucide-react";
import {
  Map,
  MapControls,
  MapFillLayer,
  MapLineLayer,
  MapMarker,
  MapScaleBar,
  MarkerContent,
  useMap,
} from "@pgmaps/geo-toolkit/map";
import {
  WorkspaceProvider,
  MapSectionLayout,
  MAP_SIDEBAR_CLASS,
  useWorkspace,
} from "@pgmaps/geo-toolkit/workspace";
import { MapSidebarShell } from "@pgmaps/geo-toolkit/ui/map-panels";
import {
  MobileFeatureCard,
  ResponsiveFeatureDetail,
} from "@pgmaps/geo-toolkit/ui/mobile-feature-card";
import {
  campusBounds,
  campusCenter,
  categories,
  officialMap,
  places,
  type Category,
  type Place,
} from "./data";
import {
  contrastStyle,
  fallbackStyle,
  loadCampusStyle,
  satelliteStyle,
  type Basemap,
} from "./mapStyles";
import type { StyleSpecification } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import "@pgmaps/geo-toolkit/styles.css";
import "./styles.css";

const icons = {
  learning: BookOpen,
  life: MapPin,
  outdoors: Trees,
  arrival: ArrowRight,
};
const colour = (category: Category) =>
  categories.find((item) => item.id === category)!.color;
const initialPlace = () =>
  places.find(
    (place) =>
      place.id === new URLSearchParams(location.hash.slice(1)).get("place"),
  ) ?? null;
const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Detail({ place, onClose }: { place: Place; onClose: () => void }) {
  const category = categories.find((item) => item.id === place.category)!;
  return (
    <article className="place-detail" aria-label={`About ${place.name}`}>
      <div className="detail-top">
        <span className="eyebrow" style={{ color: category.color }}>
          {category.label}
        </span>
        <button
          className="icon-button close-detail"
          onClick={onClose}
          aria-label="Close place details"
        >
          <X size={18} />
        </button>
      </div>
      <h2>{place.name}</h2>
      <p className="detail-description">{place.description}</p>
      <div className="detail-address">
        <MapPin size={16} />
        <span>
          Prince George campus
          <span className="subtext">
            {place.number.match(/^\d+$/) ? `Building ${place.number} · ` : ""}
            3333 University Way
          </span>
        </span>
      </div>
      <p className="detail-body">{place.detail}</p>
      <a
        className="primary-link"
        href={place.url}
        target="_blank"
        rel="noreferrer"
      >
        {place.url === officialMap
          ? "Official campus maps"
          : "Visit official website"}
        <ExternalLink size={14} />
      </a>
      <p className="location-note">
        Approximate location ·{" "}
        <a
          href={`https://www.openstreetmap.org/${place.osm}`}
          target="_blank"
          rel="noreferrer"
        >
          Map source
        </a>
      </p>
    </article>
  );
}

function CampusMap({
  placesShown,
  selected,
  select,
  geometry,
  outlines,
  basemap,
  homeKey,
  focusKey,
  onReady,
}: {
  placesShown: Place[];
  selected: Place | null;
  select: (place: Place) => void;
  geometry: FeatureCollection | null;
  outlines: boolean;
  basemap: Basemap;
  homeKey: number;
  focusKey: number;
  onReady: (ready: boolean) => void;
}) {
  const { map, isLoaded } = useMap();
  const isMobile = useWorkspace()?.isMobile ?? false;
  const [campusLayerCount, setCampusLayerCount] = useState(0);
  const [renderedCampusFeatures, setRenderedCampusFeatures] = useState(0);
  const [campusDetailVisible, setCampusDetailVisible] = useState(false);
  useEffect(() => {
    if (!map || !isLoaded) return;
    const inspectLayers = () => {
      const layers = map
        .getStyle()
        .layers.filter(
          (layer) =>
            layer.id.startsWith("fill-layer-") ||
            layer.id.startsWith("line-layer-"),
        );
      setCampusLayerCount(layers.length);
      setRenderedCampusFeatures(
        map.queryRenderedFeatures({ layers: layers.map((layer) => layer.id) })
          .length,
      );
      setCampusDetailVisible(
        layers.some((layer) => layer.layout?.visibility !== "none"),
      );
    };
    map.on("idle", inspectLayers);
    inspectLayers();
    return () => {
      map.off("idle", inspectLayers);
    };
  }, [map, isLoaded]);
  useEffect(() => {
    onReady(isLoaded);
  }, [isLoaded, onReady]);
  useEffect(() => {
    if (!map || !isLoaded) return;
    map.fitBounds(campusBounds, {
      padding: { top: 110, bottom: 60, left: 65, right: 65 },
      maxZoom: 16,
      duration: homeKey === 0 || reducedMotion() ? 0 : 650,
    });
  }, [map, isLoaded, homeKey]);
  useEffect(() => {
    if (!map || !isLoaded || !selected) return;
    map.flyTo({
      center: selected.coordinates,
      zoom: 17.2,
      duration: reducedMotion() ? 0 : 700,
      padding: {
        top: 40,
        bottom: isMobile ? 300 : 30,
        left: 25,
        right: isMobile ? 25 : 320,
      },
    });
  }, [map, isLoaded, selected, focusKey, isMobile]);
  const polygons = useMemo(
    () =>
      geometry && {
        ...geometry,
        features: geometry.features.filter(
          (feature) => feature.geometry.type === "Polygon",
        ),
      },
    [geometry],
  );
  const paths = useMemo(
    () =>
      geometry && {
        ...geometry,
        features: geometry.features.filter(
          (feature) => feature.geometry.type === "LineString",
        ),
      },
    [geometry],
  );
  return (
    <>
      {polygons && (
        <MapFillLayer
          data={polygons}
          visible={outlines}
          fillColor={[
            "match",
            ["get", "kind"],
            "building",
            "#035642",
            "parking",
            "#b79527",
            "#6c9b72",
          ]}
          fillOpacity={basemap === "satellite" ? 0.23 : 0.3}
          lineColor={basemap === "contrast" ? "#c8dbbb" : "#035642"}
          lineWidth={1.1}
          lineOpacity={0.65}
          selectedId={selected?.osm.split("/")[1]}
          selectionColor="#977000"
          selectionWidth={3}
          onFeatureClick={(id) => {
            const place = placesShown.find(
              (place) => place.osm === `way/${id}`,
            );
            if (place) select(place);
          }}
        />
      )}
      {paths && (
        <MapLineLayer
          data={paths}
          visible={outlines}
          color={basemap === "contrast" ? "#b79527" : "#977000"}
          width={1.7}
          opacity={0.6}
        />
      )}
      {placesShown.map((place) => (
        <MapMarker
          key={place.id}
          longitude={place.coordinates[0]}
          latitude={place.coordinates[1]}
          onClick={() => select(place)}
        >
          <MarkerContent>
            <button
              aria-label={`Show ${place.name}`}
              className={`campus-marker ${selected?.id === place.id ? "is-selected" : ""}`}
              style={
                { "--marker-color": colour(place.category) } as CSSProperties
              }
            >
              <span>{place.number}</span>
            </button>
          </MarkerContent>
        </MapMarker>
      ))}
      <MapScaleBar position="bottom-left" />
      <span
        className="map-state"
        data-testid="map-state"
        data-ready={isLoaded}
        data-campus-layers={campusLayerCount}
        data-rendered-campus-features={renderedCampusFeatures}
        data-campus-detail={campusDetailVisible}
      >
        Map {isLoaded ? "ready" : "loading"}
      </span>
    </>
  );
}

export default function App() {
  const [selected, setSelected] = useState<Place | null>(initialPlace);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [basemap, setBasemap] = useState<Basemap>("campus");
  const [style, setStyle] = useState<StyleSpecification>(fallbackStyle);
  const [styleError, setStyleError] = useState(false);
  const [geometry, setGeometry] = useState<FeatureCollection | null>(null);
  const [dataError, setDataError] = useState(false);
  const [outlines, setOutlines] = useState(true);
  const [homeKey, setHomeKey] = useState(0);
  const [focusKey, setFocusKey] = useState(0);
  const [about, setAbout] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const [mapReady, setMapReady] = useState(false);
  useEffect(() => {
    loadCampusStyle()
      .then(setStyle)
      .catch(() => setStyleError(true));
    fetch(`${import.meta.env.BASE_URL}data/campus.geojson`)
      .then((response) => {
        if (!response.ok) throw new Error("Map geometry unavailable");
        return response.json();
      })
      .then(setGeometry)
      .catch(() => setDataError(true));
  }, []);
  useEffect(() => {
    const sync = () => setSelected(initialPlace());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const visible = useMemo(
    () =>
      places.filter(
        (place) =>
          (category === "all" || category === place.category) &&
          `${place.name} ${place.short} ${place.number} ${categories.find((item) => item.id === place.category)!.label}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ),
    [category, query],
  );
  function select(place: Place | null) {
    setSelected(place);
    setFocusKey((key) => key + 1);
    history.replaceState(
      null,
      "",
      `${location.pathname}${location.search}${place ? `#place=${place.id}` : ""}`,
    );
  }
  function filter(nextCategory: Category | "all", nextQuery: string) {
    setCategory(nextCategory);
    setQuery(nextQuery);
    if (
      selected &&
      ((nextCategory !== "all" && selected.category !== nextCategory) ||
        !`${selected.name} ${selected.short} ${selected.number} ${categories.find((item) => item.id === selected.category)!.label}`
          .toLowerCase()
          .includes(nextQuery.trim().toLowerCase()))
    )
      select(null);
  }
  function reset() {
    select(null);
    setHomeKey((key) => key + 1);
  }
  async function share() {
    try {
      await navigator.clipboard.writeText(location.href);
      setShareStatus("Link copied");
    } catch {
      setShareStatus("Copy the URL from your address bar");
    }
  }
  useEffect(() => {
    if (!shareStatus) return;
    const timer = setTimeout(() => setShareStatus(""), 4500);
    return () => clearTimeout(timer);
  }, [shareStatus]);
  const activeStyle =
    basemap === "satellite"
      ? satelliteStyle
      : basemap === "contrast"
        ? contrastStyle
        : style;
  const styles = useMemo(
    () => ({ light: activeStyle, dark: activeStyle }),
    [activeStyle],
  );
  const sidebar = (
    <MapSidebarShell
      className={`${MAP_SIDEBAR_CLASS} campus-sidebar`}
      title="Find your place."
      subtitle="Learning, living, and exploring at UNBC."
      headerClassName="campus-sidebar-header"
      titleClassName="campus-sidebar-title"
    >
      <div className="sidebar-content">
        <label className="search-box">
          <Search size={18} aria-hidden="true" />
          <input
            aria-label="Search campus places"
            type="search"
            placeholder="Search buildings, places…"
            value={query}
            onChange={(event) => filter(category, event.target.value)}
          />
        </label>
        <div className="category-filters" aria-label="Place categories">
          <button
            aria-pressed={category === "all"}
            onClick={() => filter("all", query)}
          >
            All places
          </button>
          {categories.map((item) => (
            <button
              key={item.id}
              aria-pressed={category === item.id}
              onClick={() => filter(item.id, query)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="results-heading">
          <span>
            {visible.length} {visible.length === 1 ? "place" : "places"} to
            discover
          </span>
          <span>ON THE MAP</span>
        </div>
        <ul className="place-list">
          {visible.map((place) => {
            const Icon = icons[place.category];
            return (
              <li key={place.id}>
                <button
                  className={`place-row ${selected?.id === place.id ? "selected" : ""}`}
                  aria-pressed={selected?.id === place.id}
                  onClick={() => select(place)}
                >
                  <span
                    className="place-symbol"
                    style={{
                      color: colour(place.category),
                      background: `${colour(place.category)}0e`,
                    }}
                  >
                    <Icon size={18} />
                  </span>
                  <span className="place-row-copy">
                    <strong>{place.short}</strong>
                    <span>
                      {place.number.match(/^\d+$/)
                        ? `Building ${place.number}`
                        : categories.find((item) => item.id === place.category)!
                            .label}
                    </span>
                  </span>
                  <ChevronRight size={16} />
                </button>
              </li>
            );
          })}
        </ul>
        {visible.length === 0 && (
          <div className="empty-results">
            <Search size={24} />
            <h3>No places found</h3>
            <p>Try a building name or choose another category.</p>
            <button onClick={() => filter("all", "")}>Clear filters</button>
          </div>
        )}
        <a
          className="directory-link"
          href={officialMap}
          target="_blank"
          rel="noreferrer"
        >
          <ArrowDownToLine size={19} />
          <span>
            <strong>Looking for a room?</strong>
            <span>Open UNBC’s building directory</span>
          </span>
          <ExternalLink size={14} />
        </a>
        <div className="territory-note">
          <Mountain size={18} />
          <p>On the unceded traditional territory of the Lheidli T’enneh.</p>
        </div>
      </div>
    </MapSidebarShell>
  );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#campus-search">
        Skip to campus explorer
      </a>
      <header className="masthead">
        <a
          className="wordmark"
          href={location.pathname}
          aria-label="UNBC Campus Explorer home"
        >
          <span className="wordmark-name">
            UNBC
            <span className="wordmark-rule" />
          </span>
          <span className="wordmark-text">
            UNIVERSITY OF
            <br />
            NORTHERN BRITISH COLUMBIA
          </span>
        </a>
        <div className="masthead-right">
          <span className="product-name">Campus Explorer</span>
          <button
            className="about-button"
            aria-label="About this map"
            onClick={() => setAbout(true)}
          >
            <Info size={16} />
            <span>About this map</span>
          </button>
          <a
            className="visit-link"
            href="https://www.unbc.ca/"
            target="_blank"
            rel="noreferrer"
          >
            Visit UNBC
            <ArrowRight size={16} />
          </a>
        </div>
      </header>
      <div className="context-bar">
        <span>
          <MapPin size={14} />
          Prince George, British Columbia
        </span>
        <a
          href="https://www.unbc.ca/about-unbc/tour"
          target="_blank"
          rel="noreferrer"
        >
          Your campus. Your next discovery.
          <ArrowRight size={14} />
        </a>
      </div>
      <main
        id="campus-search"
        className="map-workspace"
        aria-label="Interactive campus explorer"
      >
        <WorkspaceProvider theme="light" className="unbc-workspace">
          <MapSectionLayout
            sidebar={sidebar}
            desktopSidebarWidth={350}
            mobilePeekTitle="Explore campus"
            mobilePeekSubtitle={`${visible.length} places · Search buildings and landmarks`}
            mobileInitialSheetState="collapsed"
          >
            <Map
              styles={styles}
              center={campusCenter}
              zoom={15.6}
              maxZoom={20}
              minZoom={8}
              maxBounds={[
                [-123.2, 53.6],
                [-122.3, 54.1],
              ]}
              controls={
                <MapControls
                  position="top-right"
                  mobilePosition="top-right"
                  showZoom
                  showCompass
                />
              }
              loader="spinner"
              showStyleLoadingOverlay={false}
              attributionControl={{
                compact: true,
                customAttribution:
                  '<a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap contributors</a>',
              }}
            >
              <CampusMap
                placesShown={visible}
                selected={selected}
                select={select}
                geometry={geometry}
                outlines={outlines}
                basemap={basemap}
                homeKey={homeKey}
                focusKey={focusKey}
                onReady={setMapReady}
              />
            </Map>
            <div className="map-toolbar">
              <div className="basemap-options" aria-label="Basemap style">
                <Layers size={16} />
                {(["campus", "satellite", "contrast"] as Basemap[]).map(
                  (item) => (
                    <button
                      key={item}
                      aria-pressed={basemap === item}
                      onClick={() => setBasemap(item)}
                    >
                      {item === "campus"
                        ? "Campus"
                        : item === "satellite"
                          ? "Satellite"
                          : "Dark"}
                    </button>
                  ),
                )}
              </div>
              <div className="toolbar-actions">
                <button
                  className="icon-button"
                  aria-label="Show whole campus"
                  title="Show whole campus"
                  onClick={reset}
                >
                  <RotateCcw size={17} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Copy map link"
                  title="Copy map link"
                  onClick={share}
                >
                  {shareStatus === "Link copied" ? (
                    <Check size={17} />
                  ) : (
                    <Share2 size={17} />
                  )}
                </button>
              </div>
            </div>
            <div className="map-caption">
              <span className="caption-dot" />
              <span>Explore the Prince George campus</span>
            </div>
            <button
              className="layer-toggle"
              aria-pressed={outlines}
              onClick={() => setOutlines((value) => !value)}
            >
              <span className={`toggle-box ${outlines ? "checked" : ""}`}>
                {outlines && <Check size={12} />}
              </span>
              Campus detail
            </button>
            {(styleError || dataError) && (
              <div role="status" className="map-notice">
                {styleError
                  ? "Basemap unavailable. Campus places are still searchable; try Satellite or Dark."
                  : "Campus outlines unavailable. Place markers are still available."}
              </div>
            )}
            {shareStatus && (
              <div role="status" className="share-status">
                {shareStatus}
              </div>
            )}
            {selected && (
              <ResponsiveFeatureDetail
                popup={
                  <div className="desktop-detail">
                    <Detail place={selected} onClose={() => select(null)} />
                  </div>
                }
                card={
                  <MobileFeatureCard
                    title={selected.short}
                    subtitle={
                      categories.find((item) => item.id === selected.category)!
                        .label
                    }
                    cardKey={selected.id}
                    height={410}
                    initialVisibleHeight={310}
                    onClose={() => select(null)}
                  >
                    <Detail place={selected} onClose={() => select(null)} />
                  </MobileFeatureCard>
                }
              />
            )}
            <span className="sr-only" role="status">
              {mapReady
                ? "Interactive campus map is ready."
                : "Campus map is loading."}
            </span>
          </MapSectionLayout>
        </WorkspaceProvider>
      </main>
      <footer className="app-footer">
        <span>Independent UNBC map concept</span>
        <span className="footer-credit">
          Built with{" "}
          <a
            href="https://github.com/ahzs645/geo-toolkit"
            target="_blank"
            rel="noreferrer"
          >
            PGMaps GeoToolkit
          </a>
          <span className="footer-divider">/</span>
          <button onClick={() => setAbout(true)}>Sources & map notes</button>
        </span>
      </footer>
      {about && <About onClose={() => setAbout(false)} />}
    </div>
  );
}

function About({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLDialogElement>("#about-map")!;
    dialog.showModal();
    return () => {
      dialog.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      id="about-map"
      className="about-dialog"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="about-content">
        <button
          autoFocus
          className="icon-button about-close"
          aria-label="Close about map"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <span className="eyebrow">THE MAP BEHIND THE PLACES</span>
        <h2>A northern point of view.</h2>
        <p>
          A campus explorer made with the{" "}
          <a
            href="https://github.com/ahzs645/geo-toolkit"
            target="_blank"
            rel="noreferrer"
          >
            PGMaps GeoToolkit
          </a>
          , styled using the UNBC palette and BC Sans typography supplied in the
          NALS theme.
        </p>
        <h3>Map sources</h3>
        <p>
          Building names and numbers follow{" "}
          <a href={officialMap} target="_blank" rel="noreferrer">
            UNBC’s campus maps
          </a>{" "}
          (overview: March 2026; directory: April 2026). Places, building
          outlines, parking areas, and paths use a local{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            OpenStreetMap
          </a>{" "}
          snapshot retrieved October 10, 2026, under the ODbL. Campus and dark
          basemaps use CARTO; satellite imagery uses Esri.
        </p>
        <h3>Using this explorer</h3>
        <p>
          Search a place, choose a category, or select a marker. Switch map
          styles, toggle campus detail, return to the full campus, or copy a
          link to a selected place.
        </p>
        <p>
          Locations mark approximate building or area centres. Use UNBC’s
          official directory for entrances, rooms, accessibility, and current
          services. This independent design concept is not an official
          university map.
        </p>
        <a
          className="primary-link"
          href="https://www.unbc.ca/about-unbc/contact"
          target="_blank"
          rel="noreferrer"
        >
          UNBC campus information
          <ExternalLink size={15} />
        </a>
      </div>
    </dialog>
  );
}
