import { ATTRIBUTE_KEYS, ROSTER_USERS, type AttributeKey, type RosterUser } from '@lgs/shared';

export const moodLabel: Readonly<Record<AttributeKey, string>> = {
  adventure: 'Big adventures',
  nature: 'Time outside',
  culture: 'Local culture',
  food: 'Local food',
  history: 'Old places',
  urban: 'City energy',
  novelty: 'New experiences',
  physicalIntensity: 'Active days',
};

export const moodPortraitManifest: Readonly<Record<RosterUser, Readonly<Record<AttributeKey, string>>>> = Object.fromEntries(
  ROSTER_USERS.map((traveler) => [
    traveler,
    Object.fromEntries(ATTRIBUTE_KEYS.map((dimension) => [dimension, `/moods/${traveler}/${dimension}.webp`])),
  ]),
) as Record<RosterUser, Record<AttributeKey, string>>;

const legacyThemeKeys: Readonly<Record<string, AttributeKey>> = {
  'adventurous days': 'adventure',
  'time outside': 'nature',
  'local culture': 'culture',
  'food with a sense of place': 'food',
  'old places': 'history',
  'city energy': 'urban',
  'distinctive experiences': 'novelty',
  'days that get you moving': 'physicalIntensity',
};

/** Compatibility only for an older immutable result snapshot without safe mood keys. */
export function moodKeyFromTheme(theme: string): AttributeKey | undefined {
  return legacyThemeKeys[theme.trim().toLowerCase()];
}
