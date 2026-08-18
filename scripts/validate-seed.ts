import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { activitySchema, destinationSchema, localMediaPathSchema, photoCreditSchema } from '@lgs/shared';

const destinations = destinationSchema.array().parse(JSON.parse(readFileSync(new URL('../seed/destinations.json', import.meta.url), 'utf8')));
const activities = activitySchema.array().parse(JSON.parse(readFileSync(new URL('../seed/activities.json', import.meta.url), 'utf8')));
const activityMedia = photoCreditSchema.extend({ activityId: z.string().min(1), imageUrl: localMediaPathSchema }).array().parse(JSON.parse(readFileSync(new URL('../seed/activity-media.json', import.meta.url), 'utf8')));
const ids = new Set(destinations.map(({ id }) => id));
for (const activity of activities) if (!ids.has(activity.destinationId)) throw new Error(`Unknown destination: ${activity.destinationId}`);
const count = new Map<string, number>();
for (const activity of activities) count.set(activity.destinationId, (count.get(activity.destinationId) ?? 0) + 1);
for (const destination of destinations) { const total = count.get(destination.id) ?? 0; if (total < 5 || total > 8) throw new Error(`${destination.id} has ${total} activities`); }
const mediaRoot = resolve(new URL('../frontend/public', import.meta.url).pathname);
const mediaPathExists = (path: string) => existsSync(resolve(mediaRoot, `.${path}`));
for (const destination of destinations) {
  if (!mediaPathExists(destination.imageUrl)) throw new Error(`Missing destination cover image: ${destination.imageUrl}`);
  if (destination.gallery.length !== 3) throw new Error(`${destination.id} needs exactly three gallery images`);
  for (const image of destination.gallery) if (!mediaPathExists(image.path)) throw new Error(`Missing gallery image: ${image.path}`);
}
for (const activity of activities) {
  if (!activity.imageUrl || !mediaPathExists(activity.imageUrl)) throw new Error(`Missing activity image: ${activity.id}`);
  if (!activity.imageUrl.startsWith('/media/cards/')) throw new Error(`Activity image path must remain opaque: ${activity.id}`);
}
if (activityMedia.length !== activities.length) throw new Error(`Activity media catalog must cover every activity`);
const activityMediaById = new Map(activityMedia.map((media) => [media.activityId, media]));
for (const activity of activities) {
  const media = activityMediaById.get(activity.id);
  if (!media) throw new Error(`Missing activity media credit: ${activity.id}`);
  if (media.imageUrl !== activity.imageUrl || media.path !== activity.imageUrl) throw new Error(`Activity media must match the activity image: ${activity.id}`);
}
console.log(`Validated ${destinations.length} destinations and ${activities.length} activities.`);
