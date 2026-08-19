import {
  ATTRIBUTE_KEYS,
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
  type ResultConfidence,
  type RosterUser,
} from '@lgs/shared';
import { BASELINE_MODEL_VERSION } from '../model/config.js';
import { buildPreferenceProfileFromAttributes, safeExplanationThemes } from '../model/profile.js';
import { createInputDigest, getSeedVersion } from '../model/snapshot.js';
import { rankUser, type Ranking } from '../ranking.js';
import { buildTransparentSocialBallot } from '../results/social-ballot.js';
import { ROSTER, type RevealSnapshotInput, type StoredRevealSnapshot } from '../store.js';

/**
 * OT-12's bridge from the deployed deterministic ranker to the final public
 * contracts. OT-20 replaces these calculations with posterior summaries; the
 * serializers themselves stay deliberately explicit to prevent a ranking or
 * persistence field from accidentally crossing an API boundary.
 */
function baselineProfile(ranking: Ranking): ProfileResponse['profile'] {
  const absoluteMaximum = Math.max(1, ...ATTRIBUTE_KEYS.map((key) => Math.abs(ranking.attributeScores[key] ?? 0)));
  return buildPreferenceProfileFromAttributes(ATTRIBUTE_KEYS.map((key) => {
    const score = ranking.attributeScores[key] ?? 0;
    return {
      key,
      expectedContribution: score / absoluteMaximum,
      // This is categorical interim evidence only. OT-20 supplies posterior
      // probabilities; no value from this adapter is exposed to the traveler.
      positiveProbability: score > 0 ? 0.9 : score < 0 ? 0.1 : 0.5,
    };
  }));
}

function roundedInterval(score: number, allScores: readonly number[], comparisonCount: number) {
  const span = Math.max(1, Math.max(...allScores) - Math.min(...allScores));
  const provisionalSpread = span / Math.sqrt(Math.max(1, comparisonCount));
  return { low: score - provisionalSpread, high: score + provisionalSpread };
}

function interimConfidence(sortedScores: readonly number[]): ResultConfidence {
  const [first = 0, second = 0] = sortedScores;
  const span = Math.max(1, Math.max(...sortedScores) - Math.min(...sortedScores));
  if (first - second > span * 0.12) {
    return { label: 'clear-favorite', summary: 'Your first few places separated clearly from the pack.' };
  }
  return { label: 'close-call', summary: 'Your top places are genuinely close together.' };
}

function encounteredActivityIds(comparisons: readonly Comparison[]): string[] {
  return [...new Set(comparisons.flatMap((comparison) => [comparison.activityA, comparison.activityB]))];
}

function baselineExplanation(
  destination: Destination,
  activities: readonly Activity[],
  ranking: Ranking,
  comparisons: readonly Comparison[],
) {
  const portfolio = activities.filter((activity) => activity.destinationId === destination.id);
  const positiveScale = Math.max(1, ...ATTRIBUTE_KEYS.map((key) => Math.abs(ranking.attributeScores[key] ?? 0)));
  const themes = safeExplanationThemes(ATTRIBUTE_KEYS.map((key) => {
    const averageAttribute = portfolio.reduce((total, activity) => total + activity.attributes[key], 0) / Math.max(1, portfolio.length) / 5;
    const contribution = ((ranking.attributeScores[key] ?? 0) / positiveScale) * averageAttribute;
    return {
      key,
      expectedContribution: contribution,
      positiveProbability: contribution > 0 ? 0.9 : contribution < 0 ? 0.1 : 0.5,
    };
  }));
  const encountered = new Set(encounteredActivityIds(comparisons));
  const encounteredPortfolio = portfolio.filter((activity) => encountered.has(activity.id));
  const observedScores = [...encountered]
    .map((id) => ranking.activityScores[id])
    .filter((score): score is number => typeof score === 'number')
    .sort((left, right) => left - right);
  const midpoint = observedScores.length === 0 ? Number.POSITIVE_INFINITY : observedScores[Math.floor(observedScores.length / 2)]!;
  return {
    themes,
    matchedActivityCount: encounteredPortfolio.filter((activity) => (ranking.activityScores[activity.id] ?? Number.NEGATIVE_INFINITY) > midpoint).length,
    encounteredActivityCount: encounteredPortfolio.length,
  };
}

export function buildProfileResponse(ranking: Ranking): ProfileResponse {
  return profileResponseSchema.parse({
    profile: baselineProfile(ranking),
    modelVersion: BASELINE_MODEL_VERSION,
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
    confidence: summary.confidence,
    profile: snapshot.users[user].profile,
    results: summary.topFive.map((result) => {
      const destination = destinationForResult(result.id, destinationsById);
      return {
      rank: result.rank,
      id: result.id,
      name: destination.name,
      country: destination.country,
      imageUrl: destination.gallery[0]!.path,
      fitLabel: result.fitLabel,
      interval: result.interval,
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

function orderedDestinationScores(ranking: Ranking): Array<{ id: string; score: number }> {
  return Object.entries(ranking.destinationScores)
    .map(([id, score]) => ({ id, score }))
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
}

/**
 * OT-15's compatibility adapter persists the current deterministic result in
 * the final snapshot shape. It is intentionally conservative about uncertainty:
 * the baseline's point estimates never claim a clear posterior favorite. OT-20
 * replaces this builder with the model's posterior summaries, while the public
 * snapshot reader remains unchanged.
 */
export function buildBaselineRevealSnapshot(
  users: readonly CompletedRosterInput[],
  destinations: readonly Destination[],
  activities: readonly Activity[],
): RevealSnapshotInput {
  const rankings = users.map(({ user, comparisons }) => ({
    user,
    comparisons,
    ranking: rankUser([...destinations], [...activities], [...comparisons]),
  }));
  const persistedUsers = Object.fromEntries(rankings.map(({ user, comparisons, ranking }) => {
    const ordered = orderedDestinationScores(ranking);
    const allScores = ordered.map((entry) => entry.score);
    const confidence = interimConfidence(allScores);
    return [user, {
      topFive: ordered.slice(0, 5).map(({ id }) => id),
      profileThemes: baselineProfile(ranking).dimensions.map((dimension) => dimension.label),
      profile: baselineProfile(ranking),
      personalResults: {
        confidence,
        topFive: ordered.slice(0, 5).map(({ id, score }, index) => {
          const destination = destinationForResult(id, new Map(destinations.map((destination) => [destination.id, destination])));
          return {
            rank: index + 1,
            id,
            fitLabel: index === 0 ? 'strong-match' : index < 3 ? 'contender' : 'close-call',
            interval: roundedInterval(score, allScores, comparisons.length),
            explanation: baselineExplanation(destination, activities, ranking, comparisons),
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
    modelVersion: BASELINE_MODEL_VERSION,
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
