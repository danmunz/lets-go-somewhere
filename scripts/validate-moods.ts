import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ATTRIBUTE_KEYS, ROSTER_USERS } from '@lgs/shared';

type SpriteBounds = Record<string, Record<string, unknown>>;
const root = resolve(new URL('..', import.meta.url).pathname);
const source = resolve(root, 'assets/images/guys-moods');
const output = resolve(root, 'frontend/public/moods');
const bounds = JSON.parse(readFileSync(resolve(source, 'sprite-bounds.json'), 'utf8')) as SpriteBounds;

for (const traveler of ROSTER_USERS) {
  const sheet = `${traveler}-moods.png`;
  if (!bounds[sheet]) throw new Error(`Mood bounds missing source sheet: ${sheet}`);
  for (const key of ATTRIBUTE_KEYS) {
    if (!bounds[sheet][key]) throw new Error(`Mood bounds missing ${traveler}/${key}`);
    const file = resolve(output, traveler, `${key}.webp`);
    if (!existsSync(file)) throw new Error(`Built mood portrait missing ${traveler}/${key}`);
  }
}
console.log(`Validated ${ROSTER_USERS.length * ATTRIBUTE_KEYS.length} mood portraits.`);
