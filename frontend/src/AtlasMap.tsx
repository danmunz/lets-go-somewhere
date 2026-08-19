import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { type Map as MapLibreMap, type Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export type AtlasMapDestination = { id: string; name: string; country?: string; coordinates: { longitude: number; latitude: number } };

type Props = { destinations: AtlasMapDestination[]; activeId?: string; onSelect: (id: string) => void };
type AtlasMapFailure = { retryAttempted: boolean };

export const atlasFallbackCopy = {
  title: 'The map took the scenic route.',
  description: 'The interactive map is unavailable, but every destination is still here to explore.',
  retry: 'Try map again',
  attribution: 'Map data © OpenFreeMap and © OpenStreetMap contributors.',
} as const;

export const ATLAS_MARKER_CLASS = 'atlas-map-marker';
export const atlasMapInset = (isCompact: boolean) => isCompact
  ? { top: 64, right: 24, bottom: 360, left: 24 }
  : { top: 76, right: 480, bottom: 76, left: 360 };

export function atlasFallbackShouldTakeFocus(failure: AtlasMapFailure): boolean {
  return failure.retryAttempted;
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** DOM marker buttons make every candidate visible, keyboard reachable, and testable. */
export function AtlasMap({ destinations, activeId, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | undefined>(undefined);
  const markers = useRef(new Map<string, Marker>());
  const fallbackHeading = useRef<HTMLHeadingElement>(null);
  const onSelectRef = useRef(onSelect);
  const initializedActiveId = useRef<string | undefined>(undefined);
  const [failure, setFailure] = useState<AtlasMapFailure | null>(null);
  const [ready, setReady] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    if (!container.current || !destinations.length || map.current || failure) return;
    let observer: ResizeObserver | undefined;
    let disposed = false;
    let styleLoaded = false;
    let loadTimer: number | undefined;
    const showFallback = () => { if (!disposed) setFailure((current) => current ?? { retryAttempted: retryKey > 0 }); };
    const fitAll = (instance: MapLibreMap) => {
      const bounds = new maplibregl.LngLatBounds();
      destinations.forEach((destination) => bounds.extend([destination.coordinates.longitude, destination.coordinates.latitude]));
      const compact = window.matchMedia?.('(max-width: 1023px)').matches ?? false;
      instance.fitBounds(bounds, { padding: atlasMapInset(compact), maxZoom: 4.2, duration: 0 });
    };
    try {
      const instance = new maplibregl.Map({ container: container.current, style: 'https://tiles.openfreemap.org/styles/liberty', center: [-72, 22], zoom: 2.5, cooperativeGestures: true });
      map.current = instance;
      instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      instance.on('error', () => { if (!styleLoaded) showFallback(); });
      container.current.addEventListener('webglcontextlost', showFallback, { once: true });
      instance.on('load', () => {
        styleLoaded = true;
        if (loadTimer) window.clearTimeout(loadTimer);
        destinations.forEach((destination) => {
          const element = document.createElement('button');
          element.type = 'button';
          element.className = ATLAS_MARKER_CLASS;
          element.dataset.destinationId = destination.id;
          element.setAttribute('aria-label', `Explore ${destination.name}${destination.country ? `, ${destination.country}` : ''}`);
          element.innerHTML = '<span aria-hidden="true">✦</span>';
          element.addEventListener('click', () => onSelectRef.current(destination.id));
          const marker = new maplibregl.Marker({ element, anchor: 'bottom' }).setLngLat([destination.coordinates.longitude, destination.coordinates.latitude]).addTo(instance);
          markers.current.set(destination.id, marker);
        });
        initializedActiveId.current = activeId;
        setReady(true);
        requestAnimationFrame(() => { instance.resize(); fitAll(instance); });
      });
      loadTimer = window.setTimeout(() => { if (!styleLoaded) showFallback(); }, 12_000);
      if (typeof ResizeObserver !== 'undefined') { observer = new ResizeObserver(() => instance.resize()); observer.observe(container.current); }
    } catch { showFallback(); }
    return () => {
      disposed = true;
      if (loadTimer) window.clearTimeout(loadTimer);
      observer?.disconnect();
      markers.current.forEach((marker) => marker.remove());
      markers.current.clear();
      map.current?.remove();
      map.current = undefined;
    };
  }, [destinations, failure, retryKey]);

  useEffect(() => {
    markers.current.forEach((marker, id) => marker.getElement().classList.toggle('is-active', id === activeId));
    const destination = destinations.find((item) => item.id === activeId);
    const instance = map.current;
    if (!destination || !instance?.isStyleLoaded() || !ready) return;
    if (initializedActiveId.current === undefined) { initializedActiveId.current = activeId; return; }
    if (initializedActiveId.current === activeId) return;
    initializedActiveId.current = activeId;
    instance.flyTo({ center: [destination.coordinates.longitude, destination.coordinates.latitude], zoom: 5.6, speed: prefersReducedMotion() ? 100 : 1.45, duration: prefersReducedMotion() ? 0 : 520, essential: false });
  }, [activeId, destinations, ready]);

  useEffect(() => { if (failure && atlasFallbackShouldTakeFocus(failure)) fallbackHeading.current?.focus(); }, [failure]);

  if (failure) return <section className="atlas-map-fallback" role="status" aria-live="polite" aria-labelledby="atlas-map-fallback-title">
    <h2 id="atlas-map-fallback-title" ref={fallbackHeading} tabIndex={-1}>{atlasFallbackCopy.title}</h2><p>{atlasFallbackCopy.description}</p>
    <button className="lgs-button lgs-button--secondary" onClick={() => { setFailure(null); setRetryKey((key) => key + 1); }}>{atlasFallbackCopy.retry}</button>
    <p className="atlas-map-fallback__attribution">{atlasFallbackCopy.attribution}</p>
  </section>;
  return <div ref={container} className="atlas-map-real" role="region" aria-label="Interactive map of all candidate destinations" aria-busy={!ready} />;
}
