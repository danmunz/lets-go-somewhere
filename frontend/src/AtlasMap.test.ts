import { describe, expect, it } from 'vitest';
import { atlasFallbackCopy, atlasFallbackShouldTakeFocus, atlasHasExpectedMarkerCount, atlasMapInset } from './AtlasMap.js';

describe('atlas fallback contract', () => {
  it('keeps a calm recovery explanation, retry path, and required attribution', () => {
    expect(atlasFallbackCopy.title).toBe('The map took the scenic route.');
    expect(atlasFallbackCopy.description).toContain('every destination');
    expect(atlasFallbackCopy.retry).toBe('Try map again');
    expect(atlasFallbackCopy.attribution).toContain('OpenFreeMap');
    expect(atlasFallbackCopy.attribution).toContain('OpenStreetMap');
  });

  it('only moves focus to the fallback after a user-triggered retry fails', () => {
    expect(atlasFallbackShouldTakeFocus({ retryAttempted: false })).toBe(false);
    expect(atlasFallbackShouldTakeFocus({ retryAttempted: true })).toBe(true);
  });

  it('uses padding that fits inside the map viewport, not its neighboring explorer panels', () => {
    expect(atlasMapInset(false)).toMatchObject({ left: 36, right: 36 });
    expect(atlasMapInset(true)).toMatchObject({ bottom: 360 });
  });

  it('fails closed rather than presenting a map with missing destination markers', () => {
    expect(atlasHasExpectedMarkerCount(24, 24)).toBe(true);
    expect(atlasHasExpectedMarkerCount(23, 24)).toBe(false);
  });
});
