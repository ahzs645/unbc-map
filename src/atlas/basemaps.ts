import type { StyleSpecification } from 'maplibre-gl';
import { loadCampusStyle } from '../mapStyles';

export type AtlasBasemap = 'streets' | 'dark';
export const atlasBasemaps: { id: AtlasBasemap; label: string }[] = [
  { id: 'streets', label: 'Streets' },
  { id: 'dark', label: 'Dark' },
];
export const atlasBackgroundStyle: StyleSpecification = {
  version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#f0f5f6' } }],
};
const styles = new Map<AtlasBasemap, Promise<StyleSpecification>>();

/** Basemaps and analytical overlays remain vector geometry at every zoom. */
export async function loadAtlasBasemap(id: AtlasBasemap): Promise<StyleSpecification> {
  let pending = styles.get(id);
  if (!pending) {
    pending = (async () => {
      let style: StyleSpecification;
      if (id === 'streets') style = await loadCampusStyle();
      else {
        const response = await fetch('https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json');
        if (!response.ok) throw new Error('The vector basemap could not be loaded.');
        style = await response.json() as StyleSpecification;
      }
      if (Object.values(style.sources).some(source => source.type === 'raster' || source.type === 'raster-dem') || style.layers.some(layer => layer.type === 'raster' || layer.type === 'hillshade')) throw new Error('This basemap does not provide the required vector geometry.');
      for (const layer of style.layers) if (layer.type === 'symbol' && layer['source-layer'] === 'place' && /place_(city|town)/.test(layer.id)) layer.minzoom = Math.min(layer.minzoom ?? 0, /city/.test(layer.id) ? 3 : 5);
      return style;
    })();
    styles.set(id, pending);
    pending.catch(() => { if (styles.get(id) === pending) styles.delete(id); });
  }
  return structuredClone(await pending);
}
