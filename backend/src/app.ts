import { Hono, type Context } from 'hono';
import { comparisonSchema, finalDecisionRequestSchema, nextComparisonResponseSchema, toAtlasDestination, toSafeActivity } from '@lgs/shared';
import {
  activities,
  assertRevealSnapshotSeedVersionCompatible,
  assertSeedVersionCompatible,
  claimPendingAndAppendComparison,
  createFinalDecision,
  createOrGetRevealSnapshot,
  destinations,
  getAllComparisons,
  getAllFinalDecisions,
  getComparisons,
  getFinalDecision,
  getRevealSnapshot,
  getStoredUserState,
  isRevealOpen,
  ROSTER,
  setPending,
  StoreConflictError,
  StoreDataError,
  SeedVersionMismatchError,
  type RosterUser,
} from './store.js';
import { isShortlistComplete, shortlistProgress, selectShortlistPair } from './model/shortlist.js';
import { authenticate } from './auth.js';
import {
  buildShortlistRevealSnapshot,
  buildFinalDecisionResponse,
  buildGroupResultsResponse,
  buildGroupStatusResponse,
  buildCurrentPersonalResultsResponse,
  buildPersonalResultsResponse,
  buildProfileResponse,
  withRevealState,
} from './dto/one-trip.js';

export const app = new Hono<{ Variables: { user: RosterUser } }>();
app.onError((error, context) => {
  // Persisted snapshot or decision corruption must fail closed without
  // returning schema internals, document IDs, or comparison information.
  if (error instanceof StoreDataError) {
    return context.json({ code: 'temporarily-unavailable', error: 'This trip data is temporarily unavailable. Ask the organizer for help.' }, 503);
  }
  return context.json({ code: 'temporarily-unavailable', error: 'The trip is temporarily unavailable. Please try again shortly.' }, 503);
});
app.get('/health', (context) => context.json({ ok: true }));
app.use('*', async (context, next) => {
  const user = await authenticate(context.req.header('Authorization'), context.req.header('X-Demo-User'));
  if (!user) return context.json({ error: 'Sign in with an approved roster account.' }, 401);
  context.set('user', user);
  await next();
});
const seedVersionMismatchResponse = (context: Context) =>
  context.json({ code: 'seed-version-mismatch', error: 'This trip’s content changed. Ask the organizer to restore the original version.' }, 503);
app.use('/v1/*', async (context, next) => {
  try {
    await assertSeedVersionCompatible(context.get('user'));
    await next();
  } catch (error) {
    if (error instanceof SeedVersionMismatchError) return seedVersionMismatchResponse(context);
    throw error;
  }
});
app.get('/v1/session', (context) => context.json({ user: context.get('user'), roster: ROSTER }));
app.get('/v1/comparison/next', async (context) => {
  const user = context.get('user') as RosterUser, comparisons = await getComparisons(user);
  if (isShortlistComplete(comparisons)) {
    return context.json(nextComparisonResponseSchema.parse({
      complete: true,
      completion: {
        complete: true,
        reason: 'fixed-round-complete',
      },
    }));
  }
  const pair = selectShortlistPair(activities, comparisons, user);
  if (!pair) {
    return context.json(nextComparisonResponseSchema.parse({
      complete: true,
      completion: { complete: true, reason: 'fixed-round-complete' },
    }));
  }
  await setPending(user, [pair[0].id, pair[1].id]);
  return context.json(nextComparisonResponseSchema.parse({
    complete: false,
    progress: shortlistProgress(comparisons.length),
    activityA: toSafeActivity(pair[0]),
    activityB: toSafeActivity(pair[1]),
  }));
});
app.post('/v1/comparisons', async (context) => {
  const user = context.get('user') as RosterUser;
  let body: unknown;
  try { body = await context.req.json(); } catch { return context.json({ error: 'Comparison body must be JSON.' }, 400); }
  const parsed = comparisonSchema.safeParse(body);
  if (!parsed.success) return context.json({ error: 'Invalid comparison.', details: parsed.error.flatten() }, 400);
  const state = await getStoredUserState(user);
  if (isShortlistComplete(state.comparisons)) return context.json({ code: 'conflict', error: 'This round is already complete.' }, 409);
  try {
    // The store transaction rechecks this revision and the exact offered pair,
    // so a stale tab can never clear another tab's pending comparison.
    await claimPendingAndAppendComparison(user, { ...parsed.data, revision: state.revision });
  } catch (error) {
    if (error instanceof StoreConflictError) return context.json({ code: 'conflict', error: error.message }, 409);
    throw error;
  }
  return context.json({ accepted: true });
});
app.get('/v1/profile', async (context) => {
  const user = context.get('user') as RosterUser, comparisons = await getComparisons(user);
  if (!isShortlistComplete(comparisons)) return context.json({ code: 'completion-required', error: 'Finish the preference game first.' }, 409);
  return context.json(buildProfileResponse(activities, comparisons, user));
});
app.get('/v1/atlas', async (context) => {
  const user = context.get('user') as RosterUser, comparisons = await getComparisons(user);
  if (!isShortlistComplete(comparisons)) return context.json({ error: 'Finish the preference game first.' }, 409);
  return context.json({ destinations: destinations.map(toAtlasDestination) });
});
app.get('/v1/group-status', async (context) => {
  const members = await Promise.all(ROSTER.map(async (user) => {
    const state = await getStoredUserState(user);
    return {
      user,
      complete: isShortlistComplete(state.comparisons),
      ...(state.updatedAt ? { updatedAt: state.updatedAt } : {}),
      ...(state.completedAt ? { completedAt: state.completedAt } : {}),
    };
  }));
  return context.json(withRevealState(buildGroupStatusResponse(members), await isRevealOpen()));
});
app.post('/v1/reveal', async (context) => {
  const user = context.get('user') as RosterUser;
  if (user !== 'dan') return context.json({ error: 'Only the trip organizer can open the reveal.' }, 403);
  await Promise.all(ROSTER.map((member) => assertSeedVersionCompatible(member)));
  if (!isShortlistComplete(await getComparisons(user))) return context.json({ error: 'Finish your preference game before opening the reveal.' }, 409);
  const all = await getAllComparisons();
  if (!ROSTER.every((member) => isShortlistComplete(all[member]))) return context.json({ error: 'Wait for the whole crew to finish before opening the reveal.' }, 409);
  const snapshot = await createOrGetRevealSnapshot(buildShortlistRevealSnapshot(
    ROSTER.map((member) => ({ user: member, comparisons: all[member] })),
    destinations,
    activities,
  ));
  return context.json({ revealOpen: true, snapshotId: snapshot.snapshotId });
});
app.get('/v1/results/me', async (context) => {
  const user = context.get('user') as RosterUser, comparisons = await getComparisons(user);
  if (!isShortlistComplete(comparisons)) return context.json({ code: 'completion-required', error: 'Finish the preference game first.' }, 409);
  // A completed traveler can inspect only their own model-generated shortlist.
  // The shared ballot, other travelers' shortlists, and social insights remain
  // locked until Dan opens the immutable reveal snapshot.
  if (!await isRevealOpen()) {
    return context.json(buildCurrentPersonalResultsResponse(user, comparisons, destinations, activities));
  }
  const snapshot = await getRevealSnapshot();
  if (!snapshot) return context.json({ code: 'reveal-locked', error: 'The group reveal is still closed.' }, 423);
  assertRevealSnapshotSeedVersionCompatible(snapshot);
  if (snapshot.schemaVersion === 1) {
    return context.json({ code: 'temporarily-unavailable', error: 'This legacy reveal remains read-only until the trip reset.' }, 503);
  }
  return context.json(buildPersonalResultsResponse(user, snapshot, destinations));
});
app.get('/v1/results/group', async (context) => {
  const snapshot = await getRevealSnapshot();
  if (!snapshot) return context.json({ code: 'reveal-locked', error: 'The group reveal is still closed.' }, 423);
  assertRevealSnapshotSeedVersionCompatible(snapshot);
  if (snapshot.schemaVersion === 1) {
    return context.json({ code: 'temporarily-unavailable', error: 'This legacy reveal remains read-only until the trip reset.' }, 503);
  }
  return context.json(buildGroupResultsResponse(snapshot, destinations, await getAllFinalDecisions()));
});

app.get('/v1/final-decision', async (context) => {
  const snapshot = await getRevealSnapshot();
  if (!snapshot) return context.json({ code: 'reveal-locked', error: 'The group reveal is still closed.' }, 423);
  assertRevealSnapshotSeedVersionCompatible(snapshot);
  if (snapshot.schemaVersion === 1) {
    return context.json({ code: 'temporarily-unavailable', error: 'This legacy reveal remains read-only until the trip reset.' }, 503);
  }
  const user = context.get('user') as RosterUser;
  return context.json(buildFinalDecisionResponse(await getFinalDecision(user), await getAllFinalDecisions()));
});

app.post('/v1/final-decision', async (context) => {
  let body: unknown;
  try { body = await context.req.json(); } catch { return context.json({ code: 'invalid-request', error: 'Final decision body must be JSON.' }, 400); }
  const parsed = finalDecisionRequestSchema.safeParse(body);
  if (!parsed.success) return context.json({ code: 'invalid-request', error: 'Choose a finalist or need-more-research.' }, 400);
  const snapshot = await getRevealSnapshot();
  if (!snapshot) return context.json({ code: 'reveal-locked', error: 'The group reveal is still closed.' }, 423);
  assertRevealSnapshotSeedVersionCompatible(snapshot);
  if (snapshot.schemaVersion === 1) {
    return context.json({ code: 'temporarily-unavailable', error: 'This legacy reveal remains read-only until the trip reset.' }, 503);
  }
  const user = context.get('user') as RosterUser;
  try {
    const decision = await createFinalDecision(user, parsed.data.choice);
    return context.json(buildFinalDecisionResponse(decision, await getAllFinalDecisions()), 201);
  } catch (error) {
    if (error instanceof StoreConflictError) {
      if (error.code === 'reveal-snapshot-missing') {
        return context.json({ code: 'reveal-locked', error: error.message }, 423);
      }
      if (error.code === 'final-decision-exists' && error.existingDecision) {
        return context.json({
          code: 'conflict',
          error: error.message,
          decision: {
            user: error.existingDecision.user,
            choice: error.existingDecision.choice,
            createdAt: error.existingDecision.createdAt,
          },
        }, 409);
      }
    }
    if (error instanceof StoreDataError) return context.json({ code: 'invalid-request', error: error.message }, 400);
    throw error;
  }
});
