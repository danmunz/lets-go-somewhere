import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

type Bounds = Record<string, Record<string, {
  'top-left-x': number;
  'top-left-y': number;
  'bottom-right-x': number;
  'bottom-right-y': number;
}>>;

const root = resolve(new URL('..', import.meta.url).pathname);
const sourceRoot = resolve(root, 'assets/images/guys-moods');
const outputRoot = resolve(root, 'frontend/public/moods');
const bounds = JSON.parse(readFileSync(resolve(sourceRoot, 'sprite-bounds.json'), 'utf8')) as Bounds;

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });

for (const [sheet, dimensions] of Object.entries(bounds)) {
  const traveler = sheet.replace(/-moods\.png$/, '');
  const source = resolve(sourceRoot, sheet);
  if (!existsSync(source)) throw new Error(`Missing mood sprite source: ${source}`);
  const travelerOutput = resolve(outputRoot, traveler);
  mkdirSync(travelerOutput, { recursive: true });
  for (const [dimension, crop] of Object.entries(dimensions)) {
    const width = crop['bottom-right-x'] - crop['top-left-x'];
    const height = crop['bottom-right-y'] - crop['top-left-y'];
    if (width <= 0 || height <= 0) throw new Error(`Invalid crop: ${sheet}/${dimension}`);
    const output = resolve(travelerOutput, `${dimension}.webp`);
    execFileSync('magick', [
      source,
      '-crop', `${width}x${height}+${crop['top-left-x']}+${crop['top-left-y']}`,
      '+repage', '-resize', '320x320>', '-strip', '-quality', '84', output,
    ], { stdio: 'inherit' });
  }
}

console.log(`Built ${Object.keys(bounds).length * 8} optimized mood portraits in ${outputRoot}.`);
