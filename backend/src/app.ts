import { Hono } from 'hono';
import { comparisonSchema, toSafeActivity } from '@lgs/shared';
import { activities, addComparison, destinations, getComparisons, isRevealOpen, openReveal, ROSTER, setPending, takePending, type RosterUser } from './store.js';
import { isComplete, rankUser, selectNextPair } from './ranking.js';

const userFrom = (value: string | undefined): RosterUser | undefined => ROSTER.find((user) => user === value);
export const app = new Hono<{ Variables: { user: RosterUser } }>();
app.get('/health', (context) => context.json({ ok: true }));
app.use('*', async (context, next) => {
  if (process.env.NODE_ENV === 'production') return context.json({ error: 'Firebase authentication is required in production.' }, 501);
  const user = userFrom(context.req.header('X-Demo-User'));
  if (!user) return context.json({ error: 'Use an approved local roster identity.' }, 401);
  context.set('user', user);
  await next();
});
app.get('/v1/session', (context) => context.json({ user: context.get('user'), roster: ROSTER }));
app.get('/v1/comparison/next', (context) => {
  const user = context.get('user') as RosterUser, comparisons = getComparisons(user);
  if (isComplete(activities, comparisons)) return context.json({ complete: true });
  const pair = selectNextPair(activities, comparisons);
  if (!pair) return context.json({ complete: true });
  setPending(user, [pair[0].id, pair[1].id]);
  return context.json({ complete: false, progress: { comparisons: comparisons.length, estimatedCompletion: Math.min(0.98, comparisons.length / 30) }, activityA: toSafeActivity(pair[0]), activityB: toSafeActivity(pair[1]) });
});
app.post('/v1/comparisons', async (context) => {
  const user = context.get('user') as RosterUser;
  let body: unknown;
  try { body = await context.req.json(); } catch { return context.json({ error: 'Comparison body must be JSON.' }, 400); }
  const parsed = comparisonSchema.safeParse(body);
  if (!parsed.success) return context.json({ error: 'Invalid comparison.', details: parsed.error.flatten() }, 400);
  const pending = takePending(user);
  if (!pending || ![...pending].every((id) => [parsed.data.activityA, parsed.data.activityB].includes(id))) return context.json({ error: 'That comparison was not offered.' }, 409);
  addComparison(user, parsed.data);
  return context.json({ accepted: true });
});
app.get('/v1/profile', (context) => {
  const user = context.get('user') as RosterUser, comparisons = getComparisons(user);
  if (!isComplete(activities, comparisons)) return context.json({ error: 'Finish the preference game first.' }, 409);
  const { attributeScores } = rankUser(destinations, activities, comparisons);
  return context.json({ attributes: attributeScores });
});
app.get('/v1/group-status', (context) => context.json({ revealOpen: isRevealOpen(), members: ROSTER.map((user) => ({ user, complete: isComplete(activities, getComparisons(user)) })) }));
app.post('/v1/reveal', (context) => {
  const user = context.get('user') as RosterUser;
  if (user !== 'dan') return context.json({ error: 'Only the trip organizer can open the reveal.' }, 403);
  if (!isComplete(activities, getComparisons(user))) return context.json({ error: 'Finish your preference game before opening the reveal.' }, 409);
  openReveal();
  return context.json({ revealOpen: true });
});
app.get('/v1/results/me', (context) => {
  const user = context.get('user') as RosterUser, comparisons = getComparisons(user);
  if (!isComplete(activities, comparisons)) return context.json({ error: 'Finish the preference game first.' }, 409);
  if (!isRevealOpen()) return context.json({ error: 'The group reveal is still closed.' }, 423);
  const ranking = rankUser(destinations, activities, comparisons);
  const results = destinations.map((destination) => ({ ...destination, preferenceScore: ranking.destinationScores[destination.id] })).sort((a, b) => b.preferenceScore - a.preferenceScore).slice(0, 5);
  return context.json({ results });
});
