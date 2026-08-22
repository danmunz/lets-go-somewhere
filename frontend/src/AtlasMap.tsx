import { useCallback, useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { type Map as MapLibreMap, type Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export type AtlasMapDestination = { id: string; name: string; country?: string; coordinates: { longitude: number; latitude: number } };
export type AtlasMapViewRequest = { kind: 'destination'; id: string; requestId: number } | { kind: 'all'; requestId: number };
type AtlasMapViewIntent = { kind: 'destination'; id: string } | { kind: 'all' };

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
  // The explorer's navigator and inspector sit outside the map's own element.
  // Padding must therefore be based on the map viewport—not those outer
  // columns—or a narrow desktop map cannot fit its full destination set.
  : { top: 64, right: 36, bottom: 64, left: 36 };

export const atlasHasExpectedMarkerCount = (markerCount: number, destinationCount: number) => markerCount === destinationCount;

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
  const pendingViewRequest = useRef<AtlasMapViewRequest | undefined>(undefined);
  const appliedViewRequestId = useRef<number | undefined>(undefined);
  const requestSequence = useRef(0);
  const previousActiveId = useRef(activeId);
  const [failure, setFailure] = useState<AtlasMapFailure | null>(null);
  const [ready, setReady] = useState(false);
  const [markerCount, setMarkerCount] = useState(0);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  const applyViewRequest = useCallback((request: AtlasMapViewRequest) => {
    const instance = map.current;
    // Camera movement does not depend on tiles, glyphs, or the sprite sheet.
    // Waiting for every style resource makes a healthy, visible map ignore
    // user input on slower connections.
    if (!instance) return false;
    const compact = window.matchMedia?.('(max-width: 1023px)').matches ?? false;
    const duration = prefersReducedMotion() ? 0 : 520;
    instance.stop();
    if (request.kind === 'all') {
      const bounds = new maplibregl.LngLatBounds();
      destinations.forEach((item) => bounds.extend([item.coordinates.longitude, item.coordinates.latitude]));
      instance.fitBounds(bounds, { padding: atlasMapInset(compact), maxZoom: 4.2, duration, essential: false });
    } else {
      const destination = destinations.find((item) => item.id === request.id);
      if (!destination) return false;
      instance.easeTo({ center: [destination.coordinates.longitude, destination.coordinates.latitude], zoom: compact ? 3.8 : 4.6, duration, essential: false });
    }
    appliedViewRequestId.current = request.requestId;
    return true;
  }, [destinations]);

  const requestView = useCallback((request: AtlasMapViewIntent) => {
    const requestId = requestSequence.current + 1;
    const nextRequest: AtlasMapViewRequest = request.kind === 'all'
      ? { kind: 'all', requestId }
      : { kind: 'destination', id: request.id, requestId };
    requestSequence.current = requestId;
    pendingViewRequest.current = nextRequest;
    appliedViewRequestId.current = undefined;
    applyViewRequest(nextRequest);
  }, [applyViewRequest]);

  useEffect(() => {
    if (!container.current || !destinations.length || map.current || failure) return;
    let observer: ResizeObserver | undefined;
    let disposed = false;
    let styleLoaded = false;
    let mapInitialized = false;
    let loadTimer: number | undefined;
    const showFallback = () => { if (!disposed) setFailure((current) => current ?? { retryAttempted: retryKey > 0 }); };
    const fitAll = (instance: MapLibreMap) => {
      const bounds = new maplibregl.LngLatBounds();
      destinations.forEach((destination) => bounds.extend([destination.coordinates.longitude, destination.coordinates.latitude]));
      const compact = window.matchMedia?.('(max-width: 1023px)').matches ?? false;
      instance.fitBounds(bounds, { padding: atlasMapInset(compact), maxZoom: 4.2, duration: 0 });
    };
    const addMarkers = (instance: MapLibreMap) => {
      destinations.forEach((destination) => {
        if (markers.current.has(destination.id)) return;
        const element = document.createElement('button');
        element.type = 'button';
        element.className = ATLAS_MARKER_CLASS;
        element.dataset.destinationId = destination.id;
        element.setAttribute('aria-label', `Explore ${destination.name}${destination.country ? `, ${destination.country}` : ''}`);
        element.innerHTML = '<span aria-hidden="true">✦</span>';
        element.addEventListener('click', () => onSelectRef.current(destination.id));
        const marker = new maplibregl.Marker({ element, anchor: 'bottom' })
          .setLngLat([destination.coordinates.longitude, destination.coordinates.latitude])
          .addTo(instance);
        markers.current.set(destination.id, marker);
      });
      setMarkerCount(markers.current.size);
    };
    try {
      const instance = new maplibregl.Map({ container: container.current, style: 'https://tiles.openfreemap.org/styles/liberty', center: [-72, 22], zoom: 2.5, cooperativeGestures: true });
      map.current = instance;
      instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      // Markers are independent of the basemap style. Adding them immediately means a
      // slow style load cannot leave the explorer looking empty once the map is visible.
      addMarkers(instance);
      // Individual tiles, glyphs, and sprites can fail transiently while the map
      // is still perfectly usable. The loading timeout, construction failure, and
      // WebGL-context loss below are the actual fatal cases; do not tear down an
      // otherwise healthy atlas because of a recoverable resource error.
      container.current.addEventListener('webglcontextlost', showFallback, { once: true });
      const establishInitialView = () => {
        if (mapInitialized || disposed) return;
        mapInitialized = true;
        instance.resize();
        fitAll(instance);
        setReady(true);
      };
      const finishStyleSetup = () => {
        styleLoaded = true;
        if (loadTimer) window.clearTimeout(loadTimer);
        addMarkers(instance);
        if (!atlasHasExpectedMarkerCount(markers.current.size, destinations.length)) { showFallback(); return; }
        establishInitialView();
      };
      // `load` waits for the current tile set to settle, which can be delayed by
      // slow public basemap resources. `style.load` means the style is ready for
      // markers and camera work, so it is the correct readiness gate here.
      instance.once('style.load', finishStyleSetup);
      instance.once('load', finishStyleSetup);
      // Set the usable camera immediately. A slow style resource must not make
      // rail selection or the overview control appear broken.
      requestAnimationFrame(establishInitialView);
      loadTimer = window.setTimeout(() => { if (!styleLoaded) showFallback(); }, 12_000);
      if (typeof ResizeObserver !== 'undefined') { observer = new ResizeObserver(() => instance.resize()); observer.observe(container.current); }
    } catch { showFallback(); }
    return () => {
      disposed = true;
      if (loadTimer) window.clearTimeout(loadTimer);
      observer?.disconnect();
      markers.current.forEach((marker) => marker.remove());
      markers.current.clear();
      setMarkerCount(0);
      map.current?.remove();
      map.current = undefined;
    };
  }, [destinations, failure, retryKey]);

  useEffect(() => {
    markers.current.forEach((marker, id) => marker.getElement().classList.toggle('is-active', id === activeId));
  }, [activeId]);

  // The selected rail row is the single source of truth for camera movement.
  // This keeps rail, marker, and inspector selection synchronized without
  // relying on an imperative parent-to-child handoff.
  useEffect(() => {
    if (!activeId || previousActiveId.current === activeId) return;
    previousActiveId.current = activeId;
    requestView({ kind: 'destination', id: activeId });
  }, [activeId, requestView]);

  // A request made while the map is starting is replayed when `ready` changes.
  // This also keeps an imperative request alive across MapLibre's initial style fit.
  useEffect(() => {
    const pending = pendingViewRequest.current;
    if (!pending || appliedViewRequestId.current === pending.requestId) return;
    applyViewRequest(pending);
  }, [applyViewRequest, ready]);

  useEffect(() => { if (failure && atlasFallbackShouldTakeFocus(failure)) fallbackHeading.current?.focus(); }, [failure]);

  if (failure) return <section className="atlas-map-fallback" role="status" aria-live="polite" aria-labelledby="atlas-map-fallback-title">
    <h2 id="atlas-map-fallback-title" ref={fallbackHeading} tabIndex={-1}>{atlasFallbackCopy.title}</h2><p>{atlasFallbackCopy.description}</p>
    <button className="lgs-button lgs-button--secondary" onClick={() => { setFailure(null); setRetryKey((key) => key + 1); }}>{atlasFallbackCopy.retry}</button>
    <p className="atlas-map-fallback__attribution">{atlasFallbackCopy.attribution}</p>
  </section>;
  return <>
    <div ref={container} className="atlas-map-real" role="region" aria-label="Interactive map of all candidate destinations" aria-busy={!ready} data-marker-count={markerCount} />
    <button className="atlas-map-see-all" onClick={() => requestView({ kind: 'all' })}>See all locations</button>
    {ready && <p className="screen-reader-status" role="status" aria-live="polite">{markerCount} places are on the map.</p>}
  </>;
}
