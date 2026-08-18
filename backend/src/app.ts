import { Hono } from 'hono';
import { comparisonSchema, toAtlasDestination, toSafeActivity } from '@lgs/shared';
import { activities, addComparison, destinations, getAllComparisons, getComparisons, isRevealOpen, openReveal, ROSTER, setPending, takePending, type RosterUser } from './store.js';
import { groupRankings, isComplete, normalizeDestinationScores, rankUser, selectNextPair } from './ranking.js';
import { authenticate } from './auth.js';

export const app = new Hono<{ Variables: { user: RosterUser } }>();
app.get('/health', (context) => context.json({ ok: true }));
app.use('*', async (context, next) => {
  const user = await authenticate(context.req.header('Authorization'), context.req.header('X-Demo-User'));
  if (!user) return context.json({ error: 'Sign in with an approved roster account.' }, 401);
  context.set('user', user);
  await next();
});
app.get('/v1/session', (context) => context.json({ user: context.get('user'), roster: ROSTER }));
app.get('/v1/comparison/next', async (context) => {
  const user = context.get('user') as RosterUser, comparisons = await getComparisons(user);
  if (isComplete(activities, comparisons)) return context.json({ complete: true });
  const pair = selectNextPair(activities, comparisons);
  if (!pair) return context.json({ complete: true });
  await setPending(user, [pair[0].id, pair[1].id]);
  return context.json({ complete: false, progress: { comparisons: comparisons.length, minimum: 24, maximum: 40, estimatedCompletion: Math.min(1, comparisons.length / 24) }, activityA: toSafeActivity(pair[0]), activityB: toSafeActivity(pair[1]) });
});
app.post('/v1/comparisons', async (context) => {
  const user = context.get('user') as RosterUser;
  let body: unknown;
  try { body = await context.req.json(); } catch { return context.json({ error: 'Comparison body must be JSON.' }, 400); }
  const parsed = comparisonSchema.safeParse(body);
  if (!parsed.success) return context.json({ error: 'Invalid comparison.', details: parsed.error.flatten() }, 400);
  const pending = await takePending(user);
  if (!pending || ![...pending].every((id) => [parsed.data.activityA, parsed.data.activityB].includes(id))) return context.json({ error: 'That comparison was not offered.' }, 409);
  await addComparison(user, parsed.data);
  return context.json({ accepted: true });
});
app.get('/v1/profile', async (context) => {
  const user = context.get('user') as RosterUser, comparisons = await getComparisons(user);
  if (!isComplete(activities, comparisons)) return context.json({ error: 'Finish the preference game first.' }, 409);
  const { attributeScores } = rankUser(destinations, activities, comparisons);
  return context.json({ attributes: attributeScores });
});
app.get('/v1/atlas', async (context) => {
  const user = context.get('user') as RosterUser, comparisons = await getComparisons(user);
  if (!isComplete(activities, comparisons)) return context.json({ error: 'Finish the preference game first.' }, 409);
  return context.json({ destinations: destinations.map(toAtlasDestination) });
});
app.get('/v1/group-status', async (context) => context.json({ revealOpen: await isRevealOpen(), members: (await Promise.all(ROSTER.map(async (user) => ({ user, complete: isComplete(activities, await getComparisons(user)) })))) }));
app.post('/v1/reveal', async (context) => {
  const user = context.get('user') as RosterUser;
  if (user !== 'dan') return context.json({ error: 'Only the trip organizer can open the reveal.' }, 403);
  if (!isComplete(activities, await getComparisons(user))) return context.json({ error: 'Finish your preference game before opening the reveal.' }, 409);
  const all = await getAllComparisons();
  if (!ROSTER.every((member) => isComplete(activities, all[member]))) return context.json({ error: 'Wait for the whole crew to finish before opening the reveal.' }, 409);
  await openReveal();
  return context.json({ revealOpen: true });
});
app.get('/v1/results/me', async (context) => {
  const user = context.get('user') as RosterUser, comparisons = await getComparisons(user);
  if (!isComplete(activities, comparisons)) return context.json({ error: 'Finish the preference game first.' }, 409);
  if (!await isRevealOpen()) return context.json({ error: 'The group reveal is still closed.' }, 423);
  const ranking = rankUser(destinations, activities, comparisons);
  const results = destinations.map((destination) => ({ ...destination, preferenceScore: ranking.destinationScores[destination.id] })).sort((a, b) => b.preferenceScore - a.preferenceScore).slice(0, 5);
  return context.json({ results });
});
app.get('/v1/results/group', async (context) => {
  if (!await isRevealOpen()) return context.json({ error: 'The group reveal is still closed.' }, 423);
  const all = await getAllComparisons();
  if (!ROSTER.every((user) => isComplete(activities, all[user]))) return context.json({ error: 'The whole crew has not finished yet.' }, 423);
  const individual = ROSTER.map((user) => ({ user, ranking: rankUser(destinations, activities, all[user]) }));
  const group = groupRankings(destinations, individual.map(({ ranking }) => normalizeDestinationScores(ranking.destinationScores)));
  const destination = (id: string) => destinations.find((item) => item.id === id)!;
  return context.json({
    group: group.slice(0, 5).map((item, index) => ({ rank: index + 1, ...item, name: destination(item.id).name, country: destination(item.id).country, imageUrl: destination(item.id).gallery[0].path })),
    members: individual.map(({ user, ranking }) => ({ user, topThree: Object.entries(ranking.destinationScores).sort(([, a], [, b]) => b - a).slice(0, 3).map(([id, score], index) => ({ rank: index + 1, id, name: destination(id).name, country: destination(id).country, imageUrl: destination(id).gallery[0].path, preferenceScore: score })) }))
  });
});
