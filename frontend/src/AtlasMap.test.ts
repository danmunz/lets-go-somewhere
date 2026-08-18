import { describe, expect, it } from 'vitest';
import { atlasFallbackCopy, atlasFallbackShouldTakeFocus } from './AtlasMap.js';

describe('atlas fallback contract', () => {
  it('keeps a calm recovery explanation, retry path, and required attribution', () => {
    expect(atlasFallbackCopy.title).toBe('The map took the scenic route.');
    expect(atlasFallbackCopy.description).toContain('browse every destination');
    expect(atlasFallbackCopy.retry).toBe('Try map again');
    expect(atlasFallbackCopy.attribution).toContain('OpenFreeMap');
    expect(atlasFallbackCopy.attribution).toContain('OpenStreetMap');
  });

  it('only moves focus to the fallback after a user-triggered retry fails', () => {
    expect(atlasFallbackShouldTakeFocus({ retryAttempted: false })).toBe(false);
    expect(atlasFallbackShouldTakeFocus({ retryAttempted: true })).toBe(true);
  });
});
