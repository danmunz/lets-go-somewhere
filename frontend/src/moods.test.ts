import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ATTRIBUTE_KEYS, ROSTER_USERS } from '@lgs/shared';
import { describe, expect, it } from 'vitest';
import { moodKeyFromTheme, moodPortraitManifest } from './moods.js';

describe('mood companion manifest', () => {
  it('covers every traveler and every canonical dimension with an optimized local portrait', () => {
    for (const traveler of ROSTER_USERS) {
      expect(Object.keys(moodPortraitManifest[traveler]).sort()).toEqual([...ATTRIBUTE_KEYS].sort());
      for (const key of ATTRIBUTE_KEYS) {
        const path = moodPortraitManifest[traveler][key];
        expect(path).toMatch(new RegExp(`^/moods/${traveler}/${key}\\.webp$`));
        expect(existsSync(resolve(process.cwd(), 'frontend/public', `.${path}`))).toBe(true);
      }
    }
  });

  it('maps old controlled explanation labels only to canonical keys', () => {
    expect(moodKeyFromTheme('old places')).toBe('history');
    expect(moodKeyFromTheme('the overall trip mix')).toBeUndefined();
  });
});
