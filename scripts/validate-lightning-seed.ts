import { readFileSync } from 'node:fs';
import { z } from 'zod';

const candidateIds = z.array(z.object({ id: z.string() })).parse(JSON.parse(readFileSync(new URL('../seed/destinations.json', import.meta.url), 'utf8'))).map(({ id }) => id).sort();
const briefSchema = z.object({
  id: z.string(), name: z.string().min(1), country: z.string().min(1), photoPath: z.string().regex(/^\/media\/(cards|destinations)\/.+\.webp$/), shortPitch: z.string().min(20),
  highlights: z.array(z.string().min(12)).length(3), weather: z.object({ typicalHighF: z.number().int(), typicalLowF: z.number().int(), note: z.string().min(12) }),
  airfare: z.object({ dc: z.number().int().positive(), nyc: z.number().int().positive(), sfo: z.number().int().positive(), qualifier: z.string().min(12) }),
  travel: z.object({ effort: z.number().int().min(1).max(5), description: z.string().min(12) }), caveat: z.string().min(12), researchedAt: z.string().date(), sources: z.array(z.object({ title: z.string().min(1), url: z.string().url() })).min(1),
}).strict();
const briefs = briefSchema.array().length(24).parse(JSON.parse(readFileSync(new URL('../seed/lightning-round/destination-briefs.json', import.meta.url), 'utf8')));
const ids = briefs.map(({ id }) => id).sort();
if (new Set(ids).size !== ids.length || JSON.stringify(ids) !== JSON.stringify(candidateIds)) throw new Error('Lightning Round briefs must cover each existing destination exactly once.');
console.log(`Validated ${briefs.length} isolated Lightning Round destination briefs.`);
