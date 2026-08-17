import { readFileSync } from 'node:fs';
import { activitySchema, destinationSchema } from '@lgs/shared';

const destinations = destinationSchema.array().parse(JSON.parse(readFileSync(new URL('../seed/destinations.json', import.meta.url), 'utf8')));
const activities = activitySchema.array().parse(JSON.parse(readFileSync(new URL('../seed/activities.json', import.meta.url), 'utf8')));
const ids = new Set(destinations.map(({ id }) => id));
for (const activity of activities) if (!ids.has(activity.destinationId)) throw new Error(`Unknown destination: ${activity.destinationId}`);
const count = new Map<string, number>();
for (const activity of activities) count.set(activity.destinationId, (count.get(activity.destinationId) ?? 0) + 1);
for (const destination of destinations) { const total = count.get(destination.id) ?? 0; if (total < 5 || total > 8) throw new Error(`${destination.id} has ${total} activities`); }
console.log(`Validated ${destinations.length} destinations and ${activities.length} activities.`);
