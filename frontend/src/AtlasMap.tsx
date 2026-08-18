import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { type GeoJSONSource, type Map as MapLibreMap, type MapLayerMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export type AtlasMapDestination = { id: string; name: string; coordinates: { longitude: number; latitude: number } };

type Props = { destinations: AtlasMapDestination[]; activeId?: string; onSelect: (id: string) => void };

export function AtlasMap({ destinations, activeId, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null); const map = useRef<MapLibreMap | undefined>(undefined); const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    if (!container.current || !destinations.length || map.current || unavailable) return;
    try {
      const instance = new maplibregl.Map({ container: container.current, style: 'https://tiles.openfreemap.org/styles/liberty', center: [-89, 20], zoom: 2.7, cooperativeGestures: true });
      map.current = instance;
      instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      let styleLoaded = false;
      instance.on('error', () => { if (!styleLoaded) setUnavailable(true); });
      instance.on('load', () => {
        styleLoaded = true;
        const features = destinations.map((destination) => ({ type: 'Feature' as const, properties: { id: destination.id }, geometry: { type: 'Point' as const, coordinates: [destination.coordinates.longitude, destination.coordinates.latitude] } }));
        const bounds = new maplibregl.LngLatBounds();
        for (const destination of destinations) bounds.extend([destination.coordinates.longitude, destination.coordinates.latitude]);
        instance.fitBounds(bounds, { padding: 72, maxZoom: 4, duration: 0 });
        instance.addSource('destinations', { type: 'geojson', data: { type: 'FeatureCollection', features }, cluster: true, clusterMaxZoom: 5, clusterRadius: 44 });
        instance.addLayer({ id: 'clusters', type: 'circle', source: 'destinations', filter: ['has', 'point_count'], paint: { 'circle-color': '#4b7eb2', 'circle-radius': ['step', ['get', 'point_count'], 22, 8, 28, 16, 34], 'circle-stroke-color': '#f2ebe3', 'circle-stroke-width': 2 } });
        instance.addLayer({ id: 'cluster-count', type: 'symbol', source: 'destinations', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Open Sans Bold'], 'text-size': 16 }, paint: { 'text-color': '#f2ebe3' } });
        instance.addLayer({ id: 'destination-points', type: 'circle', source: 'destinations', filter: ['!', ['has', 'point_count']], paint: { 'circle-color': '#c04f3d', 'circle-radius': 10, 'circle-stroke-color': '#f2ebe3', 'circle-stroke-width': 3 } });
        instance.on('click', 'destination-points', (event: MapLayerMouseEvent) => { const id = event.features?.[0]?.properties?.id; if (typeof id === 'string') onSelect(id); });
        instance.on('click', 'clusters', (event: MapLayerMouseEvent) => { const feature = instance.queryRenderedFeatures(event.point, { layers: ['clusters'] })[0]; const source = instance.getSource('destinations') as GeoJSONSource; const clusterId = feature?.properties?.cluster_id; const geometry = feature?.geometry as { coordinates?: [number, number] } | undefined; if (typeof clusterId !== 'number' || !geometry?.coordinates) return; void source.getClusterExpansionZoom(clusterId).then((zoom: number) => instance.easeTo({ center: geometry.coordinates!, zoom })); });
        instance.on('mouseenter', 'destination-points', () => { instance.getCanvas().style.cursor = 'pointer'; });
        instance.on('mouseleave', 'destination-points', () => { instance.getCanvas().style.cursor = ''; });
      });
    } catch { setUnavailable(true); }
    return () => { map.current?.remove(); map.current = undefined; };
  }, [destinations, onSelect, unavailable]);
  useEffect(() => { const destination = destinations.find((item) => item.id === activeId); if (destination && map.current?.isStyleLoaded()) map.current.flyTo({ center: [destination.coordinates.longitude, destination.coordinates.latitude], zoom: 6.1, speed: 1.2, essential: false }); }, [activeId, destinations]);
  if (unavailable) return <div className="atlas-map-fallback" role="status"><strong>Map taking the scenic route.</strong><span>The destination gallery and list are still ready to explore.</span></div>;
  return <div ref={container} className="atlas-map-real" aria-label="Interactive map of candidate destinations" />;
}
