import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { type GeoJSONSource, type Map as MapLibreMap, type MapLayerMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export type AtlasMapDestination = { id: string; name: string; coordinates: { longitude: number; latitude: number } };

type Props = { destinations: AtlasMapDestination[]; activeId?: string; onSelect: (id: string) => void };

type AtlasMapFailure = { retryAttempted: boolean };

/**
 * Kept as data so the app shell and visual-QA checks can verify the fallback
 * without depending on MapLibre/WebGL in a test environment.
 */
export const atlasFallbackCopy = {
  title: 'The map took the scenic route.',
  description: 'You can still browse every destination below.',
  retry: 'Try map again',
  attribution: 'Map data © OpenFreeMap and © OpenStreetMap contributors.',
} as const;

export function atlasFallbackShouldTakeFocus(failure: AtlasMapFailure): boolean {
  return failure.retryAttempted;
}

export function AtlasMap({ destinations, activeId, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null); const map = useRef<MapLibreMap | undefined>(undefined);
  const fallbackHeading = useRef<HTMLHeadingElement>(null);
  const [failure, setFailure] = useState<AtlasMapFailure | null>(null);
  const [ready, setReady] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const onSelectRef = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  useEffect(() => {
    if (!container.current || !destinations.length || map.current || failure) return;
    let observer: ResizeObserver | undefined;
    let disposed = false;
    let styleLoaded = false;
    let mapErrorCount = 0;
    setReady(false);
    const showFallback = () => {
      if (!disposed) setFailure((current) => current ?? { retryAttempted: retryKey > 0 });
    };
    try {
      const instance = new maplibregl.Map({ container: container.current, style: 'https://tiles.openfreemap.org/styles/liberty', center: [-89, 20], zoom: 2.7, cooperativeGestures: true });
      map.current = instance;
      instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      // A style/WebGL error is fatal immediately. Once loaded, tolerate one
      // transient tile error but fall back if the tile service repeatedly fails.
      instance.on('error', () => {
        mapErrorCount += 1;
        if (!styleLoaded || mapErrorCount >= 3) showFallback();
      });
      instance.on('load', () => {
        styleLoaded = true;
        setReady(true);
        const features = destinations.map((destination) => ({ type: 'Feature' as const, properties: { id: destination.id, name: destination.name }, geometry: { type: 'Point' as const, coordinates: [destination.coordinates.longitude, destination.coordinates.latitude] } }));
        const bounds = new maplibregl.LngLatBounds();
        for (const destination of destinations) bounds.extend([destination.coordinates.longitude, destination.coordinates.latitude]);
        instance.fitBounds(bounds, { padding: 72, maxZoom: 4, duration: 0 });
        instance.addSource('destinations', { type: 'geojson', data: { type: 'FeatureCollection', features }, cluster: true, clusterMaxZoom: 3, clusterRadius: 36 });
        instance.addLayer({ id: 'clusters', type: 'circle', source: 'destinations', filter: ['has', 'point_count'], paint: { 'circle-color': '#4b7eb2', 'circle-radius': ['step', ['get', 'point_count'], 22, 8, 28, 16, 34], 'circle-stroke-color': '#f2ebe3', 'circle-stroke-width': 3 } });
        instance.addLayer({ id: 'cluster-count', type: 'symbol', source: 'destinations', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Open Sans Bold'], 'text-size': 20 }, paint: { 'text-color': '#f2ebe3' } });
        instance.addLayer({ id: 'destination-points', type: 'circle', source: 'destinations', filter: ['!', ['has', 'point_count']], paint: { 'circle-color': '#d4924d', 'circle-radius': 14, 'circle-stroke-color': '#211c17', 'circle-stroke-width': 5, 'circle-opacity': .98 } });
        instance.addLayer({ id: 'destination-labels', type: 'symbol', source: 'destinations', minzoom: 4, filter: ['!', ['has', 'point_count']], layout: { 'text-field': ['get', 'name'], 'text-font': ['Open Sans Bold'], 'text-size': 20, 'text-offset': [0, 1.55], 'text-anchor': 'top' }, paint: { 'text-color': '#211c17', 'text-halo-color': '#f8f0e5', 'text-halo-width': 2 } });
        instance.on('click', 'destination-points', (event: MapLayerMouseEvent) => { const id = event.features?.[0]?.properties?.id; if (typeof id === 'string') onSelectRef.current(id); });
        instance.on('click', 'clusters', (event: MapLayerMouseEvent) => { const feature = instance.queryRenderedFeatures(event.point, { layers: ['clusters'] })[0]; const source = instance.getSource('destinations') as GeoJSONSource; const clusterId = feature?.properties?.cluster_id; const geometry = feature?.geometry as { coordinates?: [number, number] } | undefined; if (typeof clusterId !== 'number' || !geometry?.coordinates) return; void source.getClusterExpansionZoom(clusterId).then((zoom: number) => instance.easeTo({ center: geometry.coordinates!, zoom })); });
        instance.on('mouseenter', 'destination-points', () => { instance.getCanvas().style.cursor = 'pointer'; });
        instance.on('mouseleave', 'destination-points', () => { instance.getCanvas().style.cursor = ''; });
      });
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(() => instance.resize());
        observer.observe(container.current);
      }
      instance.once('load', () => instance.resize());
    } catch { showFallback(); }
    return () => { disposed = true; observer?.disconnect(); map.current?.remove(); map.current = undefined; };
  }, [destinations, failure, retryKey]);
  useEffect(() => { const destination = destinations.find((item) => item.id === activeId); if (destination && map.current?.isStyleLoaded()) map.current.flyTo({ center: [destination.coordinates.longitude, destination.coordinates.latitude], zoom: 6.1, speed: 1.2, essential: false }); }, [activeId, destinations]);
  useEffect(() => {
    if (failure && atlasFallbackShouldTakeFocus(failure)) fallbackHeading.current?.focus();
  }, [failure]);
  if (failure) return <section className="atlas-map-fallback" role="status" aria-live="polite" aria-labelledby="atlas-map-fallback-title">
    <h2 id="atlas-map-fallback-title" ref={fallbackHeading} tabIndex={-1}>{atlasFallbackCopy.title}</h2>
    <p>{atlasFallbackCopy.description}</p>
    <button className="lgs-button lgs-button--secondary" onClick={() => { setFailure(null); setRetryKey((key) => key + 1); }}>{atlasFallbackCopy.retry}</button>
    <p className="atlas-map-fallback__attribution">{atlasFallbackCopy.attribution}</p>
  </section>;
  return <div ref={container} className="atlas-map-real" role="region" aria-label="Interactive map of candidate destinations" aria-busy={!ready} />;
}
