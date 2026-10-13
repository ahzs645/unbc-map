import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, ExpressionSpecification, Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FeatureCollection, Geometry } from 'geojson';
import type { AtlasDataset, AtlasRow } from './types';
import { allowsMapAggregation, boundaryAssetUrl, boundaryCaption, canMapDataset, canMapMetric, getBoundaryJoin, mapGroupValue } from './geography';
import { atlasBackgroundStyle, atlasBasemaps, loadAtlasBasemap, type AtlasBasemap } from './basemaps';
import './basemap.css';
import { pointScale } from './pointScale';

export interface AtlasMapCamera {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
}

interface AtlasMapProps {
  dataset: AtlasDataset;
  metric: string;
  rows: AtlasRow[];
  selectedRegion?: string | null;
  onSelectRegion?: (id: string | null) => void;
  compact?: boolean;
  focusRegions?: string[];
  scaleDomain?: [number, number];
  interactive?: boolean;
  camera?: AtlasMapCamera;
  onCameraChange?: (camera: AtlasMapCamera) => void;
  basemap?: AtlasBasemap;
  onBasemapChange?: (basemap: AtlasBasemap) => void;
}
type BoundaryProperties = { code: string; name: string; site?: string; city?: string; source_url?: string; coordinate_source_url?: string; location_note?: string; location_precision?: string; health_authority_code?: string; value?: number | null; radius?: number; selected?: boolean; focused?: boolean };
type BoundaryCollection = FeatureCollection<Geometry, BoundaryProperties>;
type ConnectionCollection = FeatureCollection<Geometry, { segment_id: string; event_ids: string[]; route_slug: string; service_day: string }>;
const BC_BOUNDS: [[number, number], [number, number]] = [[-139.1, 48.1], [-114.0, 60.2]];
const MISSING_COLOR = '#d8e1e4';

function numeric(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function format(value: number | null, unit?: string) {
  if (value === null) return 'No value';
  if (unit === 'CAD' || unit === 'CAD nominal') return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
  if (unit?.startsWith('CAD/')) return `${new Intl.NumberFormat('en-CA', { maximumFractionDigits: 2 }).format(value)} ${unit}`;
  const suffix = unit === '%' ? '%' : unit && !['people', 'studies', 'awards', 'rows', 'events', 'records', 'cases', 'files', 'works', 'chairholders'].includes(unit) ? ` ${unit}` : '';
  return new Intl.NumberFormat('en-CA', { maximumFractionDigits: 1 }).format(value) + suffix;
}
function collectionBounds(collection: BoundaryCollection, ids?: Set<string>): [[number, number], [number, number]] | null {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  const visit = (coordinates: unknown) => {
    if (!Array.isArray(coordinates)) return;
    if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
      west = Math.min(west, coordinates[0]); east = Math.max(east, coordinates[0]);
      south = Math.min(south, coordinates[1]); north = Math.max(north, coordinates[1]);
    } else coordinates.forEach(visit);
  };
  for (const feature of collection.features) {
    if (ids && !ids.has(feature.properties.code)) continue;
    if ('coordinates' in feature.geometry) visit(feature.geometry.coordinates);
  }
  return Number.isFinite(west) ? [[west, south], [east, north]] : null;
}

function readCamera(map: MapLibreMap): AtlasMapCamera {
  const center = map.getCenter();
  return { center: [center.lng, center.lat], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() };
}

function sameCamera(a: AtlasMapCamera, b: AtlasMapCamera) {
  return Math.abs(a.center[0] - b.center[0]) < 0.000001 && Math.abs(a.center[1] - b.center[1]) < 0.000001
    && Math.abs(a.zoom - b.zoom) < 0.000001 && Math.abs(a.bearing - b.bearing) < 0.000001 && Math.abs(a.pitch - b.pitch) < 0.000001;
}

function motionDuration(duration: number) {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : duration;
}

export default function AtlasMap({ dataset, metric, rows, selectedRegion, onSelectRegion, compact = false,
  focusRegions, scaleDomain, interactive = true, camera, onCameraChange, basemap: controlledBasemap, onBasemapChange }: AtlasMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const labelMarkers = useRef<Array<{ marker: maplibregl.Marker; radius: number }>>([]);
  const applyingCamera = useRef(false);
  const fitted = useRef(false);
  const previousFocus = useRef('');
  const [boundaries, setBoundaries] = useState<BoundaryCollection | null>(null);
  const [connections, setConnections] = useState<ConnectionCollection | null>(null);
  const [connectionError, setConnectionError] = useState(false);
  const [renderedConnections, setRenderedConnections] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renderedCount, setRenderedCount] = useState(0);
  const [renderedPoints, setRenderedPoints] = useState<Array<{ code: string; value: number | null; radius: number }>>([]);
  const [actualCamera, setActualCamera] = useState<AtlasMapCamera | null>(null);
  const [localBasemap, setLocalBasemap] = useState<AtlasBasemap>('streets');
  const basemap = controlledBasemap ?? localBasemap;
  const [basemapStatus, setBasemapStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [basemapFeatures, setBasemapFeatures] = useState(0);
  const [rasterSources, setRasterSources] = useState(0);
  const [basemapError, setBasemapError] = useState('');
  const [styleRevision, setStyleRevision] = useState(0);
  const basemapApplied = useRef(false);
  const basemapReady = useRef(false);
  const latest = useRef({ dataset, metric, rows, onSelectRegion, interactive, camera, onCameraChange });
  latest.current = { dataset, metric, rows, onSelectRegion, interactive, camera, onCameraChange };
  const metricColumn = dataset.columns.find(column => column.key === metric);
  const isInstitution = dataset.geography === 'institution';
  const isCity = dataset.geography === 'city';
  const isRoute = dataset.geography === 'route';
  const isStop = dataset.geography === 'stop' || isRoute;
  const isFacility = dataset.geography === 'facility';
  const isPoint = isInstitution || isCity || isFacility || isStop;
  const pointLabel = isCity ? 'City' : isStop ? 'Stop' : isFacility ? 'Site' : 'Institution';
  const pointNoun = pointLabel.toLowerCase();
  const pointPlural = isCity ? 'cities' : `${pointNoun}s`;
  const geographyNoun = dataset.geography === 'hr2015' ? 'December 2015 health region' : dataset.mapLocationsAsset === 'boundaries-lfs-er-2021.geojson' ? 'LFS reporting area' : dataset.geography.toUpperCase();
  const aggregate = allowsMapAggregation(dataset, metric);
  const locationsAsset = dataset.mapLocationsAsset ?? (isCity ? 'locations-clinical-cities.geojson' : isInstitution ? 'locations-institutions.geojson' : `boundaries-${dataset.geography}.geojson`);
  const statCanGeometry = ['hr2015', 'cd', 'csd', 'er'].includes(dataset.geography);
  const boundaryProofAsset = dataset.geography === 'hr2015' || locationsAsset === 'boundaries-lfs-er-2021.geojson' ? 'mapping-connections-provenance.json' : 'regional-boundaries-provenance.json';
  const locationScope = isCity ? dataset.id === 'clinical-condition-mix' ? 'Points locate exact source city-query labels. Values describe one selected condition within each historical city portfolio, retaining the full city denominator. They do not locate facilities or describe disease prevalence, enrollment, current recruitment or health-area catchments. A multi-site study can appear in several cities.' : 'Points locate queried city labels, not trial facilities or service catchments. Counts describe registered study city-site matches, not enrollment or current trial availability. A multi-site study can appear in several cities.' : isStop ? 'Points identify verified sites or explicitly labelled representative towns. Recorded stop-event counts include arrivals, departures and breaks; they are not passengers, journeys or service frequency. Dashed connections follow recorded order and are schematic, not road routes or measured travel times.' : isFacility ? 'Points show independently reviewed sites or explicitly labelled address-parcel references. Grouped or uncertain locations remain unassigned. Facility measures retain their source definitions and period; coordinates do not establish a catchment, current service availability or a historical site location.' : 'Points identify representative campuses or research sites. Amounts and counts describe the institution as a whole, and are not allocated to this point or its surrounding city.';
  const scale = useMemo(() => pointScale(dataset, rows, metric), [dataset, rows, metric]);
  const dataLayer = isPoint ? 'nhhr-institution-bubble' : 'nhhr-region-fill';
  const hitLayer = isPoint ? 'nhhr-institution-hit' : 'nhhr-region-fill';
  const grouped = useMemo(() => {
    const groups = new Map<string, AtlasRow[]>();
    rows.forEach(row => { const code = getBoundaryJoin(dataset, row); if (code) groups.set(code, [...(groups.get(code) || []), row]); });
    return groups;
  }, [dataset, rows]);
  const join = useMemo(() => {
    const available = new Set(boundaries?.features.map(feature => feature.properties.code) || []);
    let matched = 0, missing = 0, unmatched = 0, ambiguous = 0;
    rows.forEach(row => {
      const code = getBoundaryJoin(dataset, row);
      if (!code || (boundaries && !available.has(code))) unmatched++;
      else if ((grouped.get(code)?.length || 0) > 1 && !aggregate) ambiguous++;
      else { matched++; if (numeric(row[metric]) === null) missing++; }
    });
    return { matched, missing, unmatched, ambiguous };
  }, [boundaries, dataset, rows, grouped, metric, aggregate]);
  const values = useMemo(() => [...grouped.values()].map(group => mapGroupValue(dataset, group, metric)).filter((v): v is number => v !== null), [dataset, grouped, metric]);
  const filteredConnections = useMemo<ConnectionCollection>(() => {
    const eventIds = new Set(rows.map(row => String(row.event_id ?? '')));
    return { type: 'FeatureCollection', features: connections?.features.filter(feature => Array.isArray(feature.properties.event_ids) && feature.properties.event_ids.length > 1 && feature.properties.event_ids.every(id => eventIds.has(String(id)))) ?? [] };
  }, [connections, rows]);
  const validDomain = scaleDomain && scaleDomain.every(Number.isFinite) && scaleDomain[0] <= scaleDomain[1] ? scaleDomain : null;
  const min = validDomain ? validDomain[0] : values.length ? Math.min(...values) : 0;
  const max = validDomain ? validDomain[1] : values.length ? Math.max(...values) : 0;
  const diverging = min < 0 && max > 0;
  const colorStops = diverging ? ['#b86842', '#f3efda', '#165d68'] : basemap === 'dark' ? ['#334e4a', '#509780', '#9bdbc9'] : ['#d8edf0', '#238495', '#124653'];
  const pointColor = basemap === 'dark' ? '#85c9b4' : '#035642';
  const selectedRow = rows.find(row => String(row[dataset.entityField]) === selectedRegion);
  const selectedCode = selectedRow ? getBoundaryJoin(dataset, selectedRow) : null;
  const selectedLocation = isPoint ? boundaries?.features.find(feature => feature.properties.code === selectedCode)?.properties : undefined;
  const selectedAmbiguous = !!selectedCode && (grouped.get(selectedCode)?.length || 0) > 1 && !aggregate;
  const selectedValue = selectedCode ? mapGroupValue(dataset, grouped.get(selectedCode), metric) : selectedRow ? numeric(selectedRow[metric]) : null;
  const selectorRows = rows.filter((row, index) => getBoundaryJoin(dataset, row) && rows.findIndex(candidate => aggregate ? getBoundaryJoin(dataset, candidate) === getBoundaryJoin(dataset, row) : candidate[dataset.entityField] === row[dataset.entityField]) === index);
  const focusKey = JSON.stringify(focusRegions || []);
  const focusedCodes = useMemo(() => {
    const names = new Set<string>(JSON.parse(focusKey));
    return new Set(rows.filter(row => names.has(String(row[dataset.entityField]))).map(row => getBoundaryJoin(dataset, row)).filter((code): code is string => !!code));
  }, [dataset, rows, focusKey]);
  const focusedCodeKey = [...focusedCodes].sort().join(',');

  const arrangeLabels = () => {
    const map = mapRef.current, canvas = container.current;
    if (!map || !canvas || !labelMarkers.current.length) return;
    const viewport = canvas.getBoundingClientRect();
    const blocked = [...(canvas.parentElement?.querySelectorAll<HTMLElement>('.atlas-basemap-picker, .maplibregl-ctrl-group, .maplibregl-ctrl-attrib') ?? [])].map(element => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left - viewport.left, top: rect.top - viewport.top, right: rect.right - viewport.left, bottom: rect.bottom - viewport.top };
    });
    for (const { marker, radius } of labelMarkers.current) {
      const element = marker.getElement(), point = map.project(marker.getLngLat());
      const width = element.offsetWidth, height = element.offsetHeight;
      const offsets = [[0, -radius - 6 - height / 2], [0, radius + 6 + height / 2], [radius + 6 + width / 2, 0], [-radius - 6 - width / 2, 0]];
      const placement = offsets.find(([dx, dy]) => {
        const rect = { left: point.x + dx - width / 2, right: point.x + dx + width / 2, top: point.y + dy - height / 2, bottom: point.y + dy + height / 2 };
        if (rect.left < 3 || rect.top < 3 || rect.right > viewport.width - 3 || rect.bottom > viewport.height - 3 || blocked.some(other => rect.left < other.right + 2 && rect.right > other.left - 2 && rect.top < other.bottom + 2 && rect.bottom > other.top - 2)) return false;
        blocked.push(rect); return true;
      });
      element.style.visibility = placement ? 'visible' : 'hidden';
      if (placement) marker.setOffset(placement as [number, number]);
    }
  };

  useEffect(() => {
    setBoundaries(null); setError(null);
    if (!canMapMetric(dataset, metric)) return;
    const abort = new AbortController();
    fetch(boundaryAssetUrl(locationsAsset), { signal: abort.signal })
      .then(response => { if (!response.ok) throw new Error(`Boundary snapshot unavailable (${response.status})`); return response.json(); })
      .then((data: BoundaryCollection) => {
        if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('Location snapshot is invalid');
        // Reviewed registries retain their original property naming. Normalize
        // evidence fields once so every point can expose its source and caveats.
        setBoundaries({ ...data, features: data.features.map(feature => {
          const properties = feature.properties as BoundaryProperties & Record<string, unknown>;
          return { ...feature, properties: { ...properties,
            source_url: properties.source_url ?? properties.sourceUrl,
            coordinate_source_url: properties.coordinate_source_url ?? properties.coordinateSourceUrl,
            location_note: properties.location_note ?? properties.locationNote,
            location_precision: properties.location_precision ?? properties.locationPrecision ?? (dataset.geography === 'facility' ? 'Representative facility/building point' : undefined),
          } as BoundaryProperties };
        }) });
      })
      .catch(reason => { if (!abort.signal.aborted) setError(reason instanceof Error ? reason.message : 'Boundary snapshot unavailable'); });
    return () => abort.abort();
  }, [dataset.geography, dataset.id, locationsAsset]);

  useEffect(() => {
    setConnections(null); setConnectionError(false);
    if (!dataset.mapConnectionsAsset || !/^[a-z0-9-]+\.geojson$/.test(dataset.mapConnectionsAsset)) return;
    const abort = new AbortController();
    fetch(boundaryAssetUrl(dataset.mapConnectionsAsset), { signal: abort.signal }).then(response => { if (!response.ok) throw new Error('Schedule connections unavailable'); return response.json(); }).then((data: ConnectionCollection) => {
      if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('Invalid schedule connections');
      setConnections(data);
    }).catch(() => { if (!abort.signal.aborted) setConnectionError(true); });
    return () => abort.abort();
  }, [dataset.mapConnectionsAsset, dataset.id]);

  useEffect(() => {
    if (!container.current || !canMapDataset(dataset)) return;
    setReady(false); setRenderedCount(0); setRenderedPoints([]); setActualCamera(null); fitted.current = false;
    let map: MapLibreMap;
    try {
      map = new maplibregl.Map({ container: container.current, center: latest.current.camera?.center || [-125.8, 54.1], zoom: latest.current.camera?.zoom ?? 4,
        bearing: latest.current.camera?.bearing ?? 0, pitch: latest.current.camera?.pitch ?? 0, interactive: latest.current.interactive,
        style: structuredClone(atlasBackgroundStyle),
        attributionControl: false, maxZoom: isPoint ? 18 : 11, minZoom: compact || isPoint ? 0.5 : 2, renderWorldCopies: false,
      });
    } catch (reason) { setError(`Map rendering unavailable: ${reason instanceof Error ? reason.message : 'WebGL could not start'}. The chart and table remain available.`); return; }
    mapRef.current = map;
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: isPoint ? isFacility || isStop ? 'Reviewed locations © Province of British Columbia and OpenStreetMap contributors' : `${pointLabel} locations © OpenStreetMap contributors` : 'Health areas © Province of British Columbia' }), 'bottom-right');
    if (latest.current.interactive) map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    if (!latest.current.camera && !isPoint) map.fitBounds(BC_BOUNDS, { padding: 28, duration: 0 });
    map.on('style.load', () => {
      // Compact attribution starts collapsed on these bounded map panels;
      // readers can open the standard info control for full provider credits.
      const attribution = container.current?.querySelector<HTMLDetailsElement>('.maplibregl-ctrl-attrib');
      if (attribution?.classList.contains('maplibregl-compact')) { attribution.classList.remove('maplibregl-compact-show'); attribution.open = false; }
      // Keep place/road labels above the transparent data overlay.
      setRasterSources(Object.values(map.getStyle().sources).filter(source => source.type === 'raster' || source.type === 'raster-dem').length);
      const labels = map.getStyle().layers.find(layer => layer.type === 'symbol')?.id;
      map.addSource('nhhr-boundaries', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      if (isRoute) {
        map.addSource('nhhr-connections', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'nhhr-schedule-connections', type: 'line', source: 'nhhr-connections', paint: { 'line-color': '#977000', 'line-width': 2, 'line-dasharray': [3, 2], 'line-opacity': 0.85 } }, labels);
      }
      if (isPoint) {
        map.addLayer({ id: 'nhhr-institution-location', type: 'circle', source: 'nhhr-boundaries', paint: { 'circle-radius': 3, 'circle-color': '#fff', 'circle-stroke-width': 1, 'circle-stroke-color': ['case', ['==', ['get', 'value'], null], '#849399', '#035642'] } }, labels);
        map.addLayer({ id: 'nhhr-institution-bubble', type: 'circle', source: 'nhhr-boundaries', layout: { 'circle-sort-key': ['-', ['coalesce', ['get', 'radius'], 0]] }, paint: { 'circle-radius': ['coalesce', ['get', 'radius'], 0], 'circle-color': '#035642', 'circle-opacity': 0.6, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1 } }, labels);
        map.addLayer({ id: 'nhhr-institution-hit', type: 'circle', source: 'nhhr-boundaries', paint: { 'circle-radius': ['max', 12, ['coalesce', ['get', 'radius'], 0]], 'circle-opacity': 0 } }, labels);
        map.addLayer({ id: 'nhhr-institution-selected', type: 'circle', source: 'nhhr-boundaries', filter: ['any', ['==', ['get', 'selected'], true], ['==', ['get', 'focused'], true]], paint: { 'circle-radius': ['+', 4, ['max', 3, ['coalesce', ['get', 'radius'], 0]]], 'circle-opacity': 0, 'circle-stroke-color': '#977000', 'circle-stroke-width': 2 } }, labels);
      } else {
        map.addLayer({ id: 'nhhr-region-fill', type: 'fill', source: 'nhhr-boundaries', paint: { 'fill-color': MISSING_COLOR, 'fill-opacity': ['case', ['==', ['get', 'value'], null], 0.1, 0.48] } }, labels);
        map.addLayer({ id: 'nhhr-region-line', type: 'line', source: 'nhhr-boundaries', paint: { 'line-color': '#6d9399', 'line-width': 0.8 } }, labels);
        map.addLayer({ id: 'nhhr-selected-line', type: 'line', source: 'nhhr-boundaries', filter: ['==', ['get', 'selected'], true], paint: { 'line-color': '#172c35', 'line-width': 3 } }, labels);
        map.addLayer({ id: 'nhhr-focused-line', type: 'line', source: 'nhhr-boundaries', filter: ['==', ['get', 'focused'], true], paint: { 'line-color': '#035642', 'line-width': 3 } }, labels);
      }
      setStyleRevision(revision => revision + 1);
      setReady(true);
    });
    map.on('move', () => { if (!applyingCamera.current) latest.current.onCameraChange?.(readCamera(map)); });
    map.on('moveend', () => { setActualCamera(readCamera(map)); arrangeLabels(); });
    map.on('resize', arrangeLabels);
    map.on('idle', () => {
      if (map.getLayer('nhhr-schedule-connections')) setRenderedConnections(new Set(map.queryRenderedFeatures({ layers: ['nhhr-schedule-connections'] }).map(feature => feature.properties.segment_id)).size);
      if (map.getLayer(dataLayer)) {
        const rendered = map.queryRenderedFeatures({ layers: [dataLayer] });
        setRenderedCount(new Set(rendered.map(feature => feature.properties.code)).size);
        if (isPoint) setRenderedPoints([...new Map(rendered.map(feature => [feature.properties.code, {
          code: String(feature.properties.code), value: numeric(feature.properties.value), radius: Number(feature.properties.radius) || 0,
        }])).values()].sort((a, b) => a.code.localeCompare(b.code)));
      }
      const layers = map.getStyle().layers.filter(layer => layer.type !== 'background' && !layer.id.startsWith('nhhr-'));
      if (basemapApplied.current && layers.length && map.areTilesLoaded()) {
        const rendered = map.queryRenderedFeatures({ layers: layers.map(layer => layer.id) }).length;
        setBasemapFeatures(rendered);
        if (rendered > 0) { basemapReady.current = true; setBasemapStatus('ready'); }
      }
    });
    map.on('error', event => {
      const sourceId = 'sourceId' in event ? event.sourceId : null;
      if (sourceId !== 'nhhr-boundaries' && sourceId !== 'nhhr-connections') { setBasemapError(event.error.message); setBasemapStatus('unavailable'); }
    });
    map.on('click', hitLayer, event => {
      const code = String(event.features?.[0]?.properties?.code || '');
      const current = latest.current;
      if (!current.interactive) return;
      const matching = current.rows.filter(row => getBoundaryJoin(current.dataset, row) === code);
      if (matching.length === 1 || (matching.length && allowsMapAggregation(current.dataset, current.metric))) current.onSelectRegion?.(String(matching[0][current.dataset.entityField]));
    });
    map.on('mousemove', hitLayer, event => {
      if (!latest.current.interactive) return;
      map.getCanvas().style.cursor = 'pointer';
      const properties = event.features?.[0]?.properties;
      if (!properties) return;
      const node = document.createElement('div');
      const current = latest.current;
      const unit = current.dataset.columns.find(column => column.key === current.metric)?.unit;
      node.textContent = `${properties.name}: ${format(numeric(properties.value), unit)}`;
      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false }).setLngLat(event.lngLat).setDOMContent(node).addTo(map);
    });
    map.on('mouseleave', hitLayer, () => { map.getCanvas().style.cursor = ''; popupRef.current?.remove(); });
    const resize = new ResizeObserver(() => map.resize()); resize.observe(container.current);
    return () => { resize.disconnect(); popupRef.current?.remove(); labelMarkers.current.forEach(({ marker }) => marker.remove()); labelMarkers.current = []; map.remove(); mapRef.current = null; };
  }, [dataset.id]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;
    basemapApplied.current = false;
    basemapReady.current = false;
    setBasemapStatus('loading'); setBasemapFeatures(0); setBasemapError('');
    const timeout = window.setTimeout(() => { if (!cancelled && !basemapReady.current) setBasemapStatus('unavailable'); }, 15000);
    loadAtlasBasemap(basemap).then(style => {
      if (cancelled) return;
      setReady(false);
      basemapApplied.current = true;
      // Layer order needs a full style replacement; the map and camera persist.
      map.setStyle(style, { diff: false });
    }).catch(reason => { if (!cancelled) { setBasemapError(reason instanceof Error ? reason.message : 'Basemap unavailable'); setBasemapStatus('unavailable'); } });
    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, [basemap, dataset.id]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !boundaries || !map.getSource('nhhr-boundaries')) return;
    const joined: BoundaryCollection = { ...boundaries, features: boundaries.features.filter(feature => !isPoint || grouped.has(feature.properties.code)).map(feature => {
      const matching = grouped.get(feature.properties.code);
      const value = mapGroupValue(dataset, matching, metric);
      return { ...feature, properties: { ...feature.properties, selected: feature.properties.code === selectedCode,
        focused: focusedCodes.has(feature.properties.code),
        value, radius: isPoint ? scale.radius(value) : undefined,
      } };
    }) };
    (map.getSource('nhhr-boundaries') as GeoJSONSource).setData(joined);
    const colors: ExpressionSpecification = min === max
      ? ['case', ['==', ['get', 'value'], null], MISSING_COLOR, colorStops[1]]
      : ['case', ['==', ['get', 'value'], null], MISSING_COLOR,
        ['interpolate', ['linear'], ['get', 'value'], min, colorStops[0], diverging ? 0 : (min + max) / 2, colorStops[1], max, colorStops[2]]];
    if (!isPoint) map.setPaintProperty('nhhr-region-fill', 'fill-color', colors);
    else { map.setPaintProperty('nhhr-institution-bubble', 'circle-color', pointColor); map.setPaintProperty('nhhr-institution-location', 'circle-stroke-color', ['case', ['==', ['get', 'value'], null], '#849399', pointColor]); }
    labelMarkers.current.forEach(({ marker }) => marker.remove()); labelMarkers.current = [];
    if (isPoint) joined.features.forEach(feature => {
      if (feature.geometry.type !== 'Point') return;
      const group = grouped.get(feature.properties.code);
      const label = document.createElement('span'); label.className = 'atlas-institution-label';
      const sourceLabel = String(group?.[0]?.[dataset.mapLabelField ?? dataset.entityField] ?? feature.properties.name).split(' / ')[0];
      label.textContent = isStop && feature.properties.location_precision === 'town' ? `Town reference: ${feature.properties.city || feature.properties.name}` : sourceLabel;
      label.title = label.textContent;
      const radius = feature.properties.radius ?? 0;
      labelMarkers.current.push({ marker: new maplibregl.Marker({ element: label, anchor: 'center', offset: [0, -radius - 15] }).setLngLat(feature.geometry.coordinates as [number, number]).addTo(map), radius });
    });
    arrangeLabels();
    popupRef.current?.remove();
  }, [boundaries, grouped, metric, selectedCode, ready, min, max, diverging, focusedCodeKey, styleRevision, scale, basemap]);

  useEffect(() => {
    const source = mapRef.current?.getSource('nhhr-connections') as GeoJSONSource | undefined;
    if (ready && source) source.setData(filteredConnections);
  }, [ready, styleRevision, filteredConnections]);

  useEffect(() => {
    if (!boundaries || !ready || latest.current.camera || (fitted.current && focusedCodeKey === previousFocus.current)) return;
    const ids = focusedCodes.size ? focusedCodes : new Set(grouped.keys());
    const viewport = mapRef.current?.getContainer().getBoundingClientRect();
    const smallPadding = Math.max(12, Math.min(42, Math.floor(Math.min(viewport?.width ?? 300, viewport?.height ?? 300) * 0.14)));
    const padding = isPoint ? { left: Math.min(48, (viewport?.width ?? 400) * 0.12), right: Math.min(48, (viewport?.width ?? 400) * 0.12), top: Math.min(48, (viewport?.height ?? 300) * 0.16), bottom: compact ? 16 : 48 } : compact ? smallPadding : 35;
    mapRef.current?.fitBounds(collectionBounds(boundaries, ids) || BC_BOUNDS, { padding, maxZoom: isPoint ? 14 : 11, duration: fitted.current && focusRegions?.length ? motionDuration(550) : 0 });
    fitted.current = true;
    previousFocus.current = focusedCodeKey;
  }, [boundaries, ready, focusedCodeKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !camera || map.isMoving() || sameCamera(readCamera(map), camera)) return;
    applyingCamera.current = true;
    map.jumpTo({ center: camera.center, zoom: camera.zoom, bearing: camera.bearing, pitch: camera.pitch });
    applyingCamera.current = false;
    setActualCamera(readCamera(map));
  }, [ready, camera]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    [map.scrollZoom, map.boxZoom, map.dragRotate, map.dragPan, map.keyboard, map.doubleClickZoom, map.touchZoomRotate].forEach(handler => {
      if (interactive) handler.enable(); else handler.disable();
    });
    if (!interactive) popupRef.current?.remove();
  }, [interactive, ready]);

  if (!canMapMetric(dataset, metric)) return <div className="atlas-map-fallback" role="status">{canMapDataset(dataset) ? "This signed measure is available in charts and tables; circle area cannot represent a negative value." : "This dataset has no verified boundary join. Explore its chart and table; institution and city observations do not describe health-area coverage."}</div>;
  return <section className={`atlas-map-panel${isPoint ? ' atlas-map-points' : ''}${compact ? ' atlas-map-panel-compact atlas-map-compact' : ''}`} aria-label="Geographic data explorer"
    style={compact ? { height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 } : undefined}>
    {!compact && <div className="atlas-map-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{isPoint ? pointLabel : 'Region'}
        <select aria-label={isPoint ? `Select map ${pointNoun}` : 'Select map region'} value={selectedRegion || ''} onChange={event => onSelectRegion?.(event.target.value || null)}>
          <option value="">{isPoint ? `All ${pointPlural}` : 'All regions'}</option>
          {selectorRows.map(row => <option key={String(row[dataset.entityField])} value={String(row[dataset.entityField])}>{String(row[dataset.mapLabelField ?? dataset.entityField])}</option>)}
        </select>
      </label>
      <button type="button" onClick={() => { if (boundaries) mapRef.current?.fitBounds(collectionBounds(boundaries, new Set(grouped.keys())) || BC_BOUNDS, { padding: 45, maxZoom: isPoint ? 16 : 10, duration: motionDuration(300) }); }}>{isPoint ? `Fit ${pointPlural}` : 'Fit data regions'}</button>
    </div>}
    <div className="atlas-map-viewport" style={{ position: 'relative', ...(compact ? { flex: 1, minHeight: 180 } : {}) }}>
      <div ref={container} className="atlas-map-canvas" role="img" aria-label={`${metricColumn?.label || metric} by ${isPoint ? pointNoun : geographyNoun} on a vector basemap; use ${compact ? 'the accompanying table' : 'the selector or table'} for accessible values`} style={{ height: compact ? '100%' : 470, minHeight: compact ? 180 : 320, width: '100%', borderRadius: compact ? 0 : 16, overflow: 'hidden' }} />
      {interactive && <label className="atlas-basemap-picker">Basemap<select aria-label="Basemap" value={basemap} onChange={event => { const value = event.target.value as AtlasBasemap; if (onBasemapChange) onBasemapChange(value); else setLocalBasemap(value); }}>
        {atlasBasemaps.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select></label>}
      {basemapStatus === 'unavailable' && <p className="atlas-basemap-notice" data-testid="basemap-notice" role="status">Basemap unavailable. {isPoint ? `${pointLabel} locations` : 'Geographic data'} remain visible.</p>}
      {!boundaries && !error && <p role="status" style={{ position: 'absolute', left: 16, top: 12 }}>Loading {isPoint ? `${pointNoun} locations` : 'boundary snapshot'}…</p>}
      {error && <p role="alert" className="atlas-map-error">{error}. Explore the chart and table below.</p>}
      {connectionError && <p className="atlas-basemap-notice" role="status">Schedule connections unavailable. Stop points and source records remain usable.</p>}
      {selectedRow && <div className="atlas-map-detail" style={{ position: 'absolute', left: 16, bottom: 16, maxWidth: 280, padding: '12px 16px', borderRadius: 12, background: '#fff', boxShadow: '0 4px 24px #14354120' }}>
        <strong>{String(selectedRow[dataset.mapLabelField ?? dataset.entityField])}</strong><br />
        {dataset.mapLabelField && <small>{[selectedRow[dataset.entityField], selectedRow.sex, dataset.timeField && selectedRow[dataset.timeField]].filter(Boolean).join(' · ')}</small>}
        <span>{selectedAmbiguous ? 'Multiple observations; filter to one source record per place to map a value.' : `${metricColumn?.label}: ${format(selectedValue, metricColumn?.unit)}`}</span>
        {aggregate && selectedCode && <small>{grouped.get(selectedCode)?.length} recorded source events at this point</small>}
        {selectedLocation && <small className="atlas-location-detail"><span>{selectedLocation.site || selectedLocation.name}</span>{selectedLocation.source_url && <a href={selectedLocation.source_url} target="_blank" rel="noreferrer">{pointLabel} location</a>}{selectedLocation.coordinate_source_url && <> · <a href={selectedLocation.coordinate_source_url} target="_blank" rel="noreferrer">Mapped point</a></>}{selectedLocation.location_precision && <span>Location: {selectedLocation.location_precision}</span>}{!compact && selectedLocation.location_note && <span>{selectedLocation.location_note}</span>}</small>}
      </div>}
    </div>
    <div data-testid="atlas-map-state" data-ready={ready && !!boundaries} data-feature-count={boundaries?.features.length || 0} data-matched-count={join.matched} data-rendered-features={renderedCount}
      data-metric={metric} data-focus-regions={focusKey} data-focus-count={focusedCodes.size} data-scale-domain={JSON.stringify([min, max])} data-camera={actualCamera ? JSON.stringify(actualCamera) : ''}
      data-basemap={basemap} data-basemap-format="vector" data-raster-sources={rasterSources} data-basemap-status={basemapStatus} data-basemap-features={basemapFeatures} data-basemap-error={basemapError} data-geometry={isPoint ? 'points' : 'polygons'} data-bubble-scale-max={isPoint ? scale.maximum : undefined}
      data-rendered-points={isPoint ? JSON.stringify(renderedPoints) : undefined} data-connections={isRoute ? filteredConnections.features.length : undefined} data-rendered-connections={isRoute ? renderedConnections : undefined} data-map-aggregation={aggregate ? 'sum' : 'none'}
      style={{ marginTop: compact ? 8 : 14, ...(compact ? { padding: '0 12px 8px', flex: '0 0 auto' } : {}) }}>
      {isPoint ? <div className="atlas-point-legend" aria-label="Proportional dot legend">
        <strong>{metricColumn?.label || metric}{metricColumn?.unit ? ` (${metricColumn.unit})` : ''}</strong>
        {values.length > 0 && scale.maximum > 0 ? compact ? <p>Circle area ∝ source value · scale maximum {format(scale.maximum, metricColumn?.unit)}{aggregate ? ' events at a stop' : ''}.</p> : <svg viewBox="0 0 290 96" role="img" aria-label={`Circle area is proportional to the source value, with a maximum reference value of ${format(scale.maximum, metricColumn?.unit)}`}>
          {[0.25, 0.5, 1].map((part, index) => <g key={part}><circle cx={45 + index * 100} cy={36} r={32 * Math.sqrt(part)} fill={pointColor} fillOpacity="0.6" /><text x={45 + index * 100} y={88} textAnchor="middle">{format(scale.maximum * part, metricColumn?.unit)}</text></g>)}
        </svg> : <p>{join.ambiguous ? 'Filter to one source record per place to map a value.' : 'No nonzero numeric values are mapped in this selection.'}</p>}
        {isRoute && <p className="atlas-route-legend">Dashed lines: schematic recorded stop connections.</p>}
        {!compact && <p>Circle area is proportional to {aggregate ? 'the recorded source-event count at each located stop' : 'the source value'}. The scale uses the full {dataset.mapScaleFields?.includes('condition_domain') ? 'selected condition cohort' : isStop && dataset.mapScaleFields?.length ? 'selected route and service-day cohort' : 'comparator cohort'} in {dataset.timeField ? 'the selected period' : 'this source snapshot'}{scale.cohortRecords ? ` (${scale.cohortRecords} records)` : ''}, so filtering individual {pointPlural} does not enlarge their dots. Empty grey rings have no single value to map.</p>}
      </div> : <div className="atlas-map-legend" aria-label="Map legend" style={{ display: 'flex', gap: compact ? 8 : 12, alignItems: 'center', flexWrap: 'wrap', ...(compact ? { fontSize: 13 } : {}) }}>
        <strong>{metricColumn?.label || metric}{metricColumn?.unit && metricColumn.unit !== '%' ? ` (${metricColumn.unit})` : ''}</strong>
        <span>{format(values.length || validDomain ? min : null, metricColumn?.unit)}</span>
        <span aria-hidden="true" style={{ width: 100, height: 10, borderRadius: 6, background: min === max ? colorStops[1] : `linear-gradient(90deg, ${colorStops.join(',')})` }} />
        <span>{format(values.length || validDomain ? max : null, metricColumn?.unit)}</span>
        <span><i aria-hidden="true" style={{ display: 'inline-block', width: 10, height: 10, background: MISSING_COLOR, marginRight: 5 }} />No data</span>
      </div>}
      {!compact && <><p className="atlas-map-join-note" style={{ fontSize: 14, marginBottom: 8 }}>{join.matched} {isStop ? 'source rows with reviewed stop references' : `exact ${isPoint ? `${pointNoun} location matches` : 'boundary joins'}`} · {join.unmatched} unmatched rows · {join.missing} missing values{join.ambiguous > 0 ? ` · ${join.ambiguous} ambiguous rows withheld (filter to one observation per ${isPoint ? pointNoun : 'region'})` : ''}.</p>
      {isPoint ? <p className="atlas-institution-scope">{locationScope} <a href={boundaryAssetUrl(locationsAsset.replace('.geojson', '.README.md'))} target="_blank" rel="noreferrer">Location sources & caveats</a> · <a href={boundaryAssetUrl(locationsAsset)} download>Location GeoJSON</a>{isRoute && dataset.mapConnectionsAsset && <> · <a href={boundaryAssetUrl(dataset.mapConnectionsAsset)} download>Schematic connections GeoJSON</a></>}</p> : dataset.geography === 'chsa' ? <p style={{ fontSize: 12, color: '#61747e', lineHeight: 1.6 }}>{boundaryCaption(dataset)} <a href={boundaryAssetUrl(locationsAsset)} download>Boundary GeoJSON</a> · <a href={boundaryAssetUrl('chsa-connections-provenance.json')} download>Source and boundary provenance</a> · <a href={boundaryAssetUrl('boundaries-chsa-2018.README.md')} target="_blank" rel="noreferrer">Boundary scope and licence</a></p> : statCanGeometry ? <p style={{ fontSize: 12, color: '#61747e', lineHeight: 1.6 }}>{boundaryCaption(dataset)} <a href={boundaryAssetUrl(locationsAsset)} download>Boundary GeoJSON</a> · <a href={boundaryAssetUrl(boundaryProofAsset)} download>Boundary provenance</a> · <a href="https://www.statcan.gc.ca/en/reference/licence" target="_blank" rel="noreferrer">Statistics Canada licence</a></p> : <p style={{ fontSize: 12, color: '#61747e', lineHeight: 1.6 }}>BC Ministry of Health polygons via PGMaps. Boundary vintage is unestablished; the snapshot provides geographic context for the source period.
        {dataset.geography === 'ha' && dataset.id.startsWith('community-disease-') && <><br />Historical Northern HA age-standardized registry rates, shown on the current PGMaps HA polygon as context. Historical boundary vintage is unverified; HA values are not allocated to CHSAs, communities or facilities. </>}{dataset.geography === 'ha' && !dataset.id.startsWith('community-disease-') && <><br />Province and PHSA reporting units have no territorial polygon; they remain in charts and records. Costs describe reporting organizations, not residents’ bills or utilization. <a href={boundaryAssetUrl('crosswalk-health-authority.README.md')} target="_blank" rel="noreferrer">Health-authority crosswalk & scope</a> · <a href={boundaryAssetUrl('crosswalk-health-authority.json')} download>Crosswalk JSON</a> · </>}{' '}<a href={boundaryAssetUrl('crosswalk-hsda.csv')} download>HSDA crosswalk</a> · <a href={boundaryAssetUrl('crosswalk-health-hierarchy.csv')} download>Health-area hierarchy</a> · <a href={boundaryAssetUrl('boundaries-provenance.json')} download>Provenance</a> · <a href="https://www2.gov.bc.ca/gov/content/data/open-data/open-government-licence-bc" target="_blank" rel="noreferrer">BC open licence</a>
      </p>}</>}
    </div>
  </section>;
}
