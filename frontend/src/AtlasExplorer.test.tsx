import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AtlasDestination } from '@lgs/shared';
import { AtlasExplorer, galleryThumbnailAction } from './AtlasExplorer.js';

const photo = (id: string) => ({ path: `/media/destinations/${id}.webp`, sourceUrl: 'https://images.unsplash.com/photo-123456789', photographerName: 'A photographer', photographerUrl: 'https://unsplash.com/@photographer', alt: 'A detailed editorial travel photograph.' });
const destinations: AtlasDestination[] = ['first', 'second'].map((id, index) => ({ id, name: index ? 'Second Place' : 'First Place', country: 'Test Country', tagline: 'A complete destination description for the atlas.', novemberWeather: 'Warm with a cool evening', travelFriction: 3, coordinates: { longitude: -70 + index, latitude: 20 + index }, gallery: [photo(`${id}-1`), photo(`${id}-2`), photo(`${id}-3`)] }));

describe('AtlasExplorer', () => {
  it('keeps browse controls, the selected inspector, and the sealed-ranking rule together', () => {
    const markup = renderToStaticMarkup(<AtlasExplorer destinations={destinations} user="dan" travelerName={() => 'Dan'} onOpenWaiting={() => undefined} onOpenProfile={() => undefined} />);
    expect(markup).toContain('All 2 places');
    expect(markup).toContain('This is the full candidate set—not your ranking.');
    expect(markup).toContain('First Place');
    expect(markup).toContain('Your private shortlist is ready for you.');
    expect(markup).toContain('Open larger photo of First Place');
  });

  it('gives the selected thumbnail an accessible second activation to open the photo viewer', () => {
    expect(galleryThumbnailAction(0, 0)).toBe('open');
    expect(galleryThumbnailAction(0, 1)).toBe('select');
  });
});
