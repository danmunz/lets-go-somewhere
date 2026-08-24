import { Hono, type Context } from 'hono';
import { comparisonSchema, lightningComparisonSubmissionSchema, lightningGroupResultsSchema, lightningGroupStatusSchema, lightningNextComparisonResponseSchema, lightningPersonalResultsSchema, lightningStatusSchema, lightningVetoSubmissionResponseSchema, lightningVetoSubmissionSchema, nextComparisonResponseSchema, toAtlasDestination, toSafeActivity } from '@lgs/shared';
import {
  activities,
  assertRevealSnapshotSeedVersionCompatible,
  assertSeedVersionCompatible,
  claimPendingAndAppendComparison,
  createOrGetRevealSnapshot,
  destinations,
  getAllComparisons,
  getComparisons,
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
  buildGroupResultsResponse,
  buildGroupStatusResponse,
  buildCurrentPersonalResultsResponse,
  buildPersonalResultsResponse,
  buildProfileResponse,
  withRevealState,
} from './dto/one-trip.js';
import {
  LIGHTNING_CORE_COMPARISONS,
  LIGHTNING_MAX_COMPARISONS,
  buildLightningRanking,
  fitDirectDestinationBradleyTerry,
  selectNextLightningPair,
  shouldCompleteLightningRound,
  tallyLightningBorda,
} from './lightning/direct-model.js';
import {
  claimLightningComparison,
  createOrGetLightningRevealSnapshot,
  ensureLightningRound,
  getAllLightningStates,
  getLightningRevealSnapshot,
  getLightningState,
  issueLightningPending,
  lightningContentVersion,
  lightningDestinationById,
  lightningDestinations,
  submitLightningVetoes,
} from './lightning/store.js';

export const app = new Hono<{ Variables: { user: RosterUser } }>();
app.onError((error, context) => {
  // Persisted snapshot or decision corruption must fail closed without
  // returning schema internals, document IDs, or comparison information.
  if (error instanceof StoreDataError) {
    return context.json({ code: 'temporarily-unavailable', error: 'This trip data is temporarily unavailable. Ask the organizer for help.' }, 503);
  }
  if (error instanceof StoreConflictError) {
    return context.json({ code: 'conflict', error: error.message }, 409);
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
  return context.json(buildGroupResultsResponse(snapshot, destinations));
});

// ────────────────────────────────────────────────────────────────────────────
// Lightning Round — a completely separate, named-destination second exercise.
// Nothing below reads or writes original comparisons, user documents, or the
// original immutable envelope except the opening gate in ensureLightningRound.
const lightningDirectDestinations = lightningDestinations.map(({ id }) => ({ id }));
const lightningSeedFor = (user: RosterUser) => `${lightningContentVersion}:${user}`;
const lightningProgress = (comparisons: number) => ({
  comparisons,
  core: 48 as const,
  maximum: 60 as const,
  phase: comparisons >= LIGHTNING_CORE_COMPARISONS ? 'tie-breakers' as const : 'core' as const,
});
const toDirectComparisons = (comparisons: Awaited<ReturnType<typeof getLightningState>>['comparisons']) => comparisons.map(({ destinationA, destinationB, winner }) => ({ destinationA, destinationB, winner }));
const lightningComplete = (user: RosterUser, comparisons: Awaited<ReturnType<typeof getLightningState>>['comparisons']) =>
  shouldCompleteLightningRound(lightningDirectDestinations, toDirectComparisons(comparisons), lightningSeedFor(user));
const lightningRankingComplete = (user: RosterUser, state: Awaited<ReturnType<typeof getLightningState>>) =>
  Boolean(state.completedAt) || lightningComplete(user, state.comparisons);
const lightningParticipationComplete = (user: RosterUser, state: Awaited<ReturnType<typeof getLightningState>>) =>
  lightningRankingComplete(user, state) && Boolean(state.vetoSubmittedAt);

app.get('/v1/lightning-round/status', async (context) => {
  const user = context.get('user') as RosterUser;
  await ensureLightningRound();
  const state = await getLightningState(user);
  const snapshot = await getLightningRevealSnapshot();
  const rankingComplete = lightningRankingComplete(user, state);
  const vetoSubmitted = Boolean(state.vetoSubmittedAt);
  return context.json(lightningStatusSchema.parse({
    available: true,
    rankingComplete,
    vetoSubmitted,
    // An already-open legacy second envelope predates vetoes. Its historical
    // result remains readable without pretending that veto choices existed.
    complete: rankingComplete && (vetoSubmitted || Boolean(snapshot)),
    revealOpen: Boolean(snapshot),
    progress: lightningProgress(state.comparisons.length),
  }));
});
app.get('/v1/lightning-round/comparison/next', async (context) => {
  const user = context.get('user') as RosterUser;
  await ensureLightningRound();
  const state = await getLightningState(user);
  const comparisons = toDirectComparisons(state.comparisons);
  if (lightningRankingComplete(user, state)) {
    return context.json(lightningNextComparisonResponseSchema.parse({ complete: true, progress: lightningProgress(comparisons.length) }));
  }
  const pair = selectNextLightningPair(lightningDirectDestinations, comparisons, lightningSeedFor(user));
  if (!pair) return context.json(lightningNextComparisonResponseSchema.parse({ complete: true, progress: lightningProgress(comparisons.length) }));
  await issueLightningPending(user, [pair[0].id, pair[1].id]);
  const refreshed = await getLightningState(user);
  return context.json(lightningNextComparisonResponseSchema.parse({ complete: false, progress: lightningProgress(comparisons.length), revision: refreshed.revision, destinationA: lightningDestinationById.get(pair[0].id), destinationB: lightningDestinationById.get(pair[1].id) }));
});
app.post('/v1/lightning-round/comparisons', async (context) => {
  const user = context.get('user') as RosterUser;
  let body: unknown;
  try { body = await context.req.json(); } catch { return context.json({ error: 'Comparison body must be JSON.' }, 400); }
  const parsed = lightningComparisonSubmissionSchema.safeParse(body);
  if (!parsed.success) return context.json({ error: 'Invalid direct comparison.' }, 400);
  const { revision, ...comparison } = parsed.data;
  const state = await getLightningState(user);
  if (lightningRankingComplete(user, state)) return context.json({ code: 'conflict', error: 'Your direct destination ranking is already complete.' }, 409);
  const completeAfter = shouldCompleteLightningRound(lightningDirectDestinations, [...toDirectComparisons(state.comparisons), comparison], lightningSeedFor(user));
  try { await claimLightningComparison(user, { ...comparison, revision }, completeAfter); }
  catch (error) { if (error instanceof StoreConflictError) return context.json({ code: 'conflict', error: error.message }, 409); throw error; }
  return context.json({ accepted: true });
});
app.post('/v1/lightning-round/vetoes', async (context) => {
  const user = context.get('user') as RosterUser;
  let body: unknown;
  try { body = await context.req.json(); } catch { return context.json({ error: 'Veto choices must be JSON.' }, 400); }
  const parsed = lightningVetoSubmissionSchema.safeParse(body);
  if (!parsed.success) return context.json({ error: 'Choose up to four different places to veto.', details: parsed.error.flatten() }, 400);
  if (parsed.data.destinationIds.some((id) => !lightningDestinationById.has(id))) {
    return context.json({ error: 'A veto must name one of the 24 Lightning Round places.' }, 400);
  }
  await ensureLightningRound();
  const state = await getLightningState(user);
  const rankingComplete = lightningRankingComplete(user, state);
  if (!rankingComplete) return context.json({ code: 'completion-required', error: 'Finish your direct destination choices before choosing vetoes.' }, 409);
  try {
    const destinationIds = await submitLightningVetoes(user, parsed.data.destinationIds, rankingComplete);
    return context.json(lightningVetoSubmissionResponseSchema.parse({ accepted: true, vetoes: { submitted: true, destinationIds } }));
  } catch (error) {
    if (error instanceof StoreConflictError) return context.json({ code: 'conflict', error: error.message }, 409);
    throw error;
  }
});
app.get('/v1/lightning-round/results/me', async (context) => {
  const user = context.get('user') as RosterUser; await ensureLightningRound(); const state = await getLightningState(user);
  if (!lightningRankingComplete(user, state)) return context.json({ code: 'completion-required', error: 'Finish your direct destination choices first.' }, 409);
  const fit = fitDirectDestinationBradleyTerry(lightningDirectDestinations, toDirectComparisons(state.comparisons));
  if (!fit.ok) throw new StoreDataError('The Lightning Round could not prepare this personal list.');
  return context.json(lightningPersonalResultsSchema.parse({
    modelVersion: 'bayes-direct-destination-v1', contentVersion: lightningContentVersion,
    tiers: buildLightningRanking(fit, lightningSeedFor(user)).tiers.map((tier) => ({ rankStart: tier.startRank, rankEnd: tier.endRank, destinationIds: tier.destinationIds })),
    destinations: lightningDestinations,
    // This is caller-only and allowed because Lightning happens after the first
    // envelope: the UI can honestly show how this traveler's direct list formed.
    comparisonTrail: state.comparisons.map((comparison) => ({
      order: comparison.ordinal,
      winnerId: comparison.winner,
      loserId: comparison.winner === comparison.destinationA ? comparison.destinationB : comparison.destinationA,
      phase: comparison.ordinal <= LIGHTNING_CORE_COMPARISONS ? 'core' as const : 'tie-breakers' as const,
    })),
    vetoes: { submitted: Boolean(state.vetoSubmittedAt), destinationIds: state.vetoedDestinationIds ?? [] },
  }));
});
app.get('/v1/lightning-round/group-status', async (context) => {
  await ensureLightningRound(); const all = await getAllLightningStates(); const snapshot = await getLightningRevealSnapshot();
  const members = ROSTER.map((user) => ({
    user,
    complete: Boolean(snapshot)
      ? lightningRankingComplete(user, all[user])
      : lightningParticipationComplete(user, all[user]),
  }));
  return context.json(lightningGroupStatusSchema.parse({ revealOpen: Boolean(snapshot), allComplete: members.every((member) => member.complete), members, updatedAt: new Date().toISOString() }));
});
app.post('/v1/lightning-round/reveal', async (context) => {
  const user = context.get('user') as RosterUser;
  if (user !== 'dan') return context.json({ error: 'Only Dan can open the second envelope.' }, 403);
  await ensureLightningRound(); const all = await getAllLightningStates();
  if (!ROSTER.every((member) => lightningParticipationComplete(member, all[member]))) return context.json({ error: 'Wait for the whole crew to finish their rankings and submit their vetoes.' }, 409);
  const snapshot = await createOrGetLightningRevealSnapshot(() => {
    const rankings = ROSTER.map((member) => {
      const fit = fitDirectDestinationBradleyTerry(lightningDirectDestinations, toDirectComparisons(all[member].comparisons));
      if (!fit.ok) throw new StoreDataError(`Could not prepare ${member}'s Lightning list.`);
      return { user: member, ranking: buildLightningRanking(fit, lightningSeedFor(member)) };
    });
    const rows = tallyLightningBorda(lightningDirectDestinations.map(({ id }) => id), rankings.map(({ ranking }) => ranking));
    const supportersFor = (id: string) => rankings.filter(({ ranking }) => ranking.tiers.some((tier) => tier.destinationIds.includes(id) && tier.startRank <= 5)).map(({ user }) => user);
    return lightningGroupResultsSchema.parse({
      snapshotId: 'pending',
      modelVersion: 'bayes-direct-destination-v1',
      contentVersion: lightningContentVersion,
      group: rows.map((row) => ({
        rankStart: row.startRank,
        rankEnd: row.endRank,
        destinationId: row.destinationId,
        bordaHalfPoints: Math.round(row.points * 2),
        firstPlaceVotes: row.firstPlaceVotes,
        supporters: supportersFor(row.destinationId),
        vetoedBy: ROSTER.filter((member) => all[member].vetoedDestinationIds?.includes(row.destinationId)),
      })),
      members: rankings.map(({ user, ranking }) => ({
        user,
        tiers: ranking.tiers.map((tier) => ({ rankStart: tier.startRank, rankEnd: tier.endRank, destinationIds: tier.destinationIds })),
        vetoedDestinationIds: all[user].vetoedDestinationIds ?? [],
      })),
      destinations: lightningDestinations,
    });
  });
  return context.json({ revealOpen: true, snapshotId: snapshot.snapshotId });
});
app.get('/v1/lightning-round/results/group', async (context) => {
  await ensureLightningRound(); const snapshot = await getLightningRevealSnapshot();
  if (!snapshot) return context.json({ code: 'reveal-locked', error: 'The second envelope is still sealed.' }, 423);
  return context.json(snapshot);
});
