import { useEffect, useRef, useState } from 'react';
import type { AtlasDestination, RosterUser } from '@lgs/shared';
import { AtlasMap } from './AtlasMap.js';
import { MediaImage, TravelEffortKey } from './components/index.js';

type Props = {
  destinations: AtlasDestination[];
  user: RosterUser;
  travelerName: (user: RosterUser) => string;
  avatarSrc?: string;
  onOpenWaiting: () => void;
  /** A changing token requests focus after an intentional app-level navigation. */
  focusHeading?: number;
};
type GalleryPhoto = AtlasDestination['gallery'][number];

export const galleryThumbnailAction = (activeIndex: number, requestedIndex: number) => activeIndex === requestedIndex ? 'open' : 'select';

function AtlasLightbox({ destination, photo, photoIndex, onClose, onPrevious, onNext }: { destination: AtlasDestination; photo: GalleryPhoto; photoIndex: number; onClose: () => void; onPrevious: () => void; onNext: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); if (event.key === 'ArrowLeft') onPrevious(); if (event.key === 'ArrowRight') onNext(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, onNext, onPrevious]);
  return <div className="atlas-lightbox" role="dialog" aria-modal="true" aria-labelledby="atlas-lightbox-title">
    <button className="atlas-lightbox__backdrop" tabIndex={-1} aria-label="Close photo viewer" onClick={onClose} />
    <section className="atlas-lightbox__content"><header><div><p className="eyebrow">Photo {photoIndex + 1} of 3</p><h2 id="atlas-lightbox-title">{destination.name}</h2></div><button ref={closeButton} className="atlas-lightbox__close" onClick={onClose} aria-label="Close photo viewer">×</button></header><MediaImage src={photo.path} alt={photo.alt} fallbackLabel="Photo unavailable" /><footer><button className="lgs-button lgs-button--secondary" onClick={onPrevious}>Previous photo</button><p>Photo by <a href={photo.photographerUrl} target="_blank" rel="noreferrer">{photo.photographerName}</a> on Unsplash</p><button className="lgs-button lgs-button--secondary" onClick={onNext}>Next photo</button></footer></section>
  </div>;
}

/** Completion-gated destination explorer. It deliberately receives no rank data. */
export function AtlasExplorer({ destinations, user, travelerName, avatarSrc, onOpenWaiting, focusHeading }: Props) {
  const [activeId, setActiveId] = useState(destinations[0]?.id ?? '');
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const galleryTrigger = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const destination = destinations.find((item) => item.id === activeId) ?? destinations[0];
  useEffect(() => { if (!destinations.some((item) => item.id === activeId)) setActiveId(destinations[0]?.id ?? ''); }, [activeId, destinations]);
  useEffect(() => {
    if (focusHeading) headingRef.current?.focus();
  }, [focusHeading]);
  if (!destination) return null;
  const selectDestination = (id: string) => {
    setActiveId(id);
    setGalleryIndex(0);
  };
  const cyclePhoto = (offset: number) => setGalleryIndex((index) => (index + offset + destination.gallery.length) % destination.gallery.length);
  const closeLightbox = () => { setLightboxOpen(false); window.setTimeout(() => galleryTrigger.current?.focus(), 0); };
  const activePhoto = destination.gallery[galleryIndex]!;
  const candidateCount = destinations.length;
  return <main className="atlas-explorer screen-enter" aria-labelledby="atlas-title">
    <header className="atlas-explorer__header"><div className="atlas-explorer__brand"><div><p className="eyebrow">THE ATLAS</p><h1 id="atlas-title" ref={headingRef} tabIndex={-1}>All {candidateCount} possible trips.</h1></div></div><p className="atlas-explorer__purpose">Use this map to explore every place that was in the running. This is the full candidate set, not your ranking.</p><div className="atlas-explorer__traveler">{avatarSrc && <img src={avatarSrc} alt="" />}<span>{travelerName(user)}</span></div></header>
    <section className="atlas-explorer__stage" aria-label="Explore all trip destinations">
      <aside className="atlas-navigator" aria-labelledby="atlas-navigator-title"><div><p className="eyebrow">Browse the map</p><h2 id="atlas-navigator-title">All {candidateCount} places</h2><p>Choose a place to see its photos and practical feel.</p></div><div className="atlas-navigator__list">{destinations.map((item) => <button key={item.id} className={item.id === activeId ? 'is-active' : undefined} onClick={() => selectDestination(item.id)} aria-pressed={item.id === activeId}><MediaImage src={item.gallery[0]?.path} alt="" fallbackLabel="Photo unavailable" /><span><b>{item.name}</b><small>{item.country}</small></span><i aria-hidden="true">↗</i></button>)}</div></aside>
      <div className="atlas-explorer__map"><AtlasMap destinations={destinations} activeId={activeId} onSelect={selectDestination} /><p className="atlas-selection-status" role="status" aria-live="polite">Now exploring {destination.name}, {destination.country}.</p></div>
      <aside className="atlas-inspector" aria-labelledby="atlas-destination-title"><div className="atlas-inspector__heading"><p className="eyebrow">Now exploring</p><h2 id="atlas-destination-title">{destination.name}</h2><p className="country">{destination.country}</p><p>{destination.tagline}</p></div><button ref={galleryTrigger} className="atlas-inspector__lead-photo" onClick={() => setLightboxOpen(true)} aria-label={`Open larger photo of ${destination.name}`}><MediaImage src={activePhoto.path} alt={activePhoto.alt} fallbackLabel="Photo unavailable" /></button><div className="atlas-filmstrip" aria-label={`${destination.name} photo gallery`}>{destination.gallery.map((photo, index) => <button key={photo.path} className={index === galleryIndex ? 'is-active' : undefined} onClick={() => { if (galleryThumbnailAction(galleryIndex, index) === 'open') setLightboxOpen(true); else setGalleryIndex(index); }} aria-label={index === galleryIndex ? `Open photo ${index + 1} of ${destination.name}` : `Show photo ${index + 1} of ${destination.name}`} aria-pressed={index === galleryIndex}><MediaImage src={photo.path} alt="" fallbackLabel="Photo unavailable" /></button>)}</div><div className="atlas-facts"><div><span>November</span><b>{destination.novemberWeather}</b></div><div><span>Travel effort</span><b>{destination.travelFriction}/5</b></div></div><TravelEffortKey /><p className="atlas-credit">Photo by <a href={activePhoto.photographerUrl} target="_blank" rel="noreferrer">{activePhoto.photographerName}</a> on Unsplash</p></aside>
    </section>
    <div className="atlas-mobile-strip" aria-label="Quick destination picker">{destinations.map((item) => <button key={item.id} className={item.id === activeId ? 'is-active' : undefined} onClick={() => selectDestination(item.id)} aria-pressed={item.id === activeId}><MediaImage src={item.gallery[0]?.path} alt="" fallbackLabel="Photo unavailable" /><span>{item.name}</span></button>)}</div>
    <section className="atlas-sealed-note"><div><p className="eyebrow">Still private</p><h2>Explore the places. Everyone else’s picks stay hidden.</h2><p>Your own top five is ready. Everyone else’s picks—and the group results—stay hidden until Dan opens the envelope.</p></div><button className="lgs-button lgs-button--primary" onClick={onOpenWaiting}>See who’s finished</button></section>
    {lightboxOpen && <AtlasLightbox destination={destination} photo={activePhoto} photoIndex={galleryIndex} onClose={closeLightbox} onPrevious={() => cyclePhoto(-1)} onNext={() => cyclePhoto(1)} />}
  </main>;
}
