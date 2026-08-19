import {
  transparentGroupResultsResponseSchema,
  groupStatusSchema,
  personalResultsResponseSchema,
  profileResponseSchema,
  type Activity,
  type Comparison,
  type Destination,
  type FinalDecision,
  type GroupStatus,
  type PersonalResultsResponse,
  type ProfileResponse,
  type ResultSnapshotCreation,
  type RosterUser,
} from '@lgs/shared';
import { SHORTLIST_MODEL_VERSION, SHORTLIST_POLICY_VERSION, shortlistModelConfig } from '../model/config.js';
import { buildDestinationExplanation, buildPreferenceProfile } from '../model/profile.js';
import { createInputDigest, getSeedVersion } from '../model/snapshot.js';
import { analyzeShortlist, isShortlistComplete } from '../model/shortlist.js';
import { buildTransparentSocialBallot } from '../results/social-ballot.js';
import { ROSTER, type RevealSnapshotInput, type StoredRevealSnapshot } from '../store.js';

/**
 * OT-12's bridge from the deployed deterministic ranker to the final public
 * contracts. OT-20 replaces these calculations with posterior summaries; the
 * serializers themselves stay deliberately explicit to prevent a ranking or
 * persistence field from accidentally crossing an API boundary.
 */
export function buildProfileResponse(activities: readonly Activity[], comparisons: readonly Comparison[], user: RosterUser): ProfileResponse {
  const shortlist = analyzeShortlist(activities, comparisons, user);
  return profileResponseSchema.parse({
    profile: buildPreferenceProfile(shortlist.fit, `${user}:profile`),
    modelVersion: SHORTLIST_MODEL_VERSION,
  });
}

export function buildGroupStatusResponse(
  states: readonly { user: RosterUser; complete: boolean; updatedAt?: string; completedAt?: string }[],
): GroupStatus {
  const stamps = states
    .flatMap((state) => [state.completedAt, state.updatedAt])
    .filter((stamp): stamp is string => typeof stamp === 'string')
    .map((stamp) => Date.parse(stamp))
    .filter(Number.isFinite);
  const latest = stamps.length === 0 ? 0 : Math.max(...stamps);
  return groupStatusSchema.parse({
    revealOpen: false,
    allComplete: states.every((state) => state.complete),
    members: states.map(({ user, complete }) => ({ user, complete })),
    // The field represents update ordering, not trip preference timing.
    updatedAt: new Date(Math.floor(latest / 1000) * 1000).toISOString(),
  });
}

export function withRevealState(status: GroupStatus, revealOpen: boolean): GroupStatus {
  return groupStatusSchema.parse({ ...status, revealOpen });
}

export function buildPersonalResultsResponse(
  user: RosterUser,
  snapshot: StoredRevealSnapshot,
  destinations: readonly Destination[],
): PersonalResultsResponse {
  if (snapshot.schemaVersion !== 2) throw new Error('This legacy reveal must be read through its legacy result path.');
  const summary = snapshot.users[user].personalResults;
  const destinationsById = new Map(destinations.map((destination) => [destination.id, destination]));
  return personalResultsResponseSchema.parse({
    snapshotId: snapshot.snapshotId,
    modelVersion: snapshot.modelVersion,
    profile: snapshot.users[user].profile,
    results: summary.topFive.map((result) => {
      const destination = destinationForResult(result.id, destinationsById);
      return {
      rank: result.rank,
      id: result.id,
      name: destination.name,
      country: destination.country,
      imageUrl: destination.gallery[0]!.path,
      explanation: result.explanation,
      context: {
        novemberWeather: destination.novemberWeather,
        travelFriction: destination.travelFriction,
      },
      };
    }),
  });
}

type CompletedRosterInput = Readonly<{
  user: RosterUser;
  comparisons: readonly Comparison[];
}>;

/** Builds a versioned, immutable social-ballot snapshot from fixed 32-choice shortlists. */
export function buildShortlistRevealSnapshot(
  users: readonly CompletedRosterInput[],
  destinations: readonly Destination[],
  activities: readonly Activity[],
): RevealSnapshotInput {
  const rankings = users.map(({ user, comparisons }) => {
    if (!isShortlistComplete(comparisons)) throw new Error('Every traveler must complete the fixed 32-choice shortlist before reveal.');
    return { user, comparisons, shortlist: analyzeShortlist(activities, comparisons, user) };
  });
  const destinationsById = new Map(destinations.map((destination) => [destination.id, destination]));
  const persistedUsers = Object.fromEntries(rankings.map(({ user, comparisons, shortlist }) => {
    const profile = buildPreferenceProfile(shortlist.fit, `${user}:profile`);
    const ordered = shortlist.analysis.ranking.map(({ id }) => id);
    return [user, {
      topFive: ordered.slice(0, 5),
      profileThemes: profile.dimensions.map((dimension) => dimension.label),
      profile,
      personalResults: {
        topFive: ordered.slice(0, 5).map((id, index) => {
          const destination = destinationForResult(id, destinationsById);
          return {
            rank: index + 1,
            id,
            explanation: buildDestinationExplanation({
              fit: shortlist.fit,
              destinationId: destination.id,
              encounteredActivityIds: comparisons.flatMap((comparison) => [comparison.activityA, comparison.activityB]),
              seed: `${user}:explanation:${destination.id}`,
              config: shortlistModelConfig,
            }),
          };
        }),
      },
    }];
  })) as ResultSnapshotCreation['users'];

  const ballot = buildTransparentSocialBallot({
    ballots: Object.fromEntries(ROSTER.map((user) => [user, persistedUsers[user].topFive])) as Record<RosterUser, string[]>,
    profileThemes: Object.fromEntries(ROSTER.map((user) => [user, persistedUsers[user].profileThemes])) as Record<RosterUser, string[]>,
    destinationNames: Object.fromEntries(destinations.map((destination) => [destination.id, destination.name])),
  });

  return {
    schemaVersion: 2,
    modelVersion: SHORTLIST_MODEL_VERSION,
    policyVersion: SHORTLIST_POLICY_VERSION,
    seedVersion: getSeedVersion(),
    inputDigest: createInputDigest(Object.fromEntries(users.map(({ user, comparisons }) => [user, comparisons]))),
    users: persistedUsers,
    group: ballot,
  };
}

function destinationForResult(id: string, destinationsById: ReadonlyMap<string, Destination>): Destination {
  const destination = destinationsById.get(id);
  if (!destination) throw new Error(`Result snapshot references unknown destination ${id}.`);
  return destination;
}

function publicDecision(decision: FinalDecision): FinalDecision {
  return {
    user: decision.user,
    choice: decision.choice,
    createdAt: decision.createdAt,
  };
}

/** Maps only the immutable snapshot plus public seed context into the verdict DTO. */
export function buildGroupResultsResponse(
  snapshot: StoredRevealSnapshot,
  destinations: readonly Destination[],
  decisions: readonly FinalDecision[],
): import('@lgs/shared').TransparentGroupResultsResponse {
  if (snapshot.schemaVersion !== 2) throw new Error('This legacy reveal must be read through its legacy result path.');
  const destinationsById = new Map(destinations.map((destination) => [destination.id, destination]));
  return transparentGroupResultsResponseSchema.parse({
    snapshotId: snapshot.snapshotId,
    modelVersion: snapshot.modelVersion,
    displayMode: snapshot.group.displayMode,
    group: snapshot.group.finalists.map((finalist) => {
      const destination = destinationForResult(finalist.id, destinationsById);
      return {
        ...finalist,
        name: destination.name,
        country: destination.country,
        imageUrl: destination.gallery[0]!.path,
        context: {
          novemberWeather: destination.novemberWeather,
          travelFriction: destination.travelFriction,
        },
      };
    }),
    members: ROSTER.map((user) => ({
      user,
      topFive: snapshot.users[user].topFive.map((id, index) => {
        const destination = destinationForResult(id, destinationsById);
        return { rank: index + 1, id, name: destination.name, imageUrl: destination.gallery[0]!.path };
      }),
    })),
    finalistRanks: snapshot.group.finalistRanks,
    insights: snapshot.group.insights,
    decisions: decisions.map(publicDecision),
  });
}

export function buildFinalDecisionResponse(
  decision: FinalDecision | undefined,
  decisions: readonly FinalDecision[],
) {
  return {
    decision: decision ? publicDecision(decision) : null,
    decisions: decisions.map(publicDecision),
  };
}
