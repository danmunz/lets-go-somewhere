import { ATTRIBUTE_KEYS, type Activity, type AttributeKey, type Destination } from '@lgs/shared';

export const EVALUATION_BUDGETS = [24, 28, 32, 36, 40] as const;
export const EVALUATION_RUNS_PER_SCENARIO = 200;
export const EVALUATION_SEED_SCHEDULE = Array.from({ length: EVALUATION_RUNS_PER_SCENARIO }, (_, index) => 10_000 + index) as readonly number[];

export type FixtureScenarioId =
  | 'clear-attribute-preference'
  | 'vivid-activity-residual'
  | 'fifth-sixth-boundary'
  | 'indifferent-traveler'
  | 'consensus-group'
  | 'polarizing-group'
  | 'noisy-replay';

export type FixtureExpectation = Readonly<{
  expectedConfidence: 'clear-shape' | 'close-call';
  expectedGroupConsensus?: 'broad-consensus' | 'polarized';
  expectedGroupWinner?: string;
  fifthSixthMargin?: 'clear' | 'narrow';
  notes: string;
}>;

export type FixtureScenario = Readonly<{
  id: FixtureScenarioId;
  label: string;
  userCount: 1 | 5;
  profiles: readonly FixtureProfile[];
  expectation: FixtureExpectation;
}>;

type FixtureProfile = Readonly<{
  id: string;
  weights: Readonly<Partial<Record<AttributeKey, number>>>;
  destinationOffset?: Readonly<Record<string, number>>;
  vividResidual?: number;
  outcomeNoiseScale?: number;
}>;

export type SyntheticUserTruth = Readonly<{
  id: string;
  activityUtilities: Readonly<Record<string, number>>;
  destinationUtilities: Readonly<Record<string, number>>;
}>;

export type SyntheticFixtureRun = Readonly<{
  scenario: FixtureScenario;
  seed: number;
  users: readonly SyntheticUserTruth[];
  /** The destination containing the intentionally vivid but shrinkable card. */
  vividDestinationId?: string;
  vividActivityId?: string;
  probabilityFirstWins: (userId: string, activityA: string, activityB: string) => number;
  winnerForPair: (userId: string, activityA: string, activityB: string, comparisonOrdinal: number) => string;
}>;

const activeProfile: FixtureProfile = {
  id: 'traveler-1',
  weights: { adventure: 1.3, nature: 1.1, novelty: 0.8, physicalIntensity: 0.7, urban: -0.35 },
};

const cultureProfile: FixtureProfile = {
  id: 'traveler-2',
  weights: { culture: 1.25, history: 1.0, food: 0.7, urban: 0.25, physicalIntensity: -0.2 },
};

const comfortProfile: FixtureProfile = {
  id: 'traveler-3',
  weights: { food: 0.9, urban: 0.8, culture: 0.45, physicalIntensity: -1.05, adventure: -0.65 },
};

const natureProfile: FixtureProfile = {
  id: 'traveler-4',
  weights: { nature: 1.4, adventure: 0.65, novelty: 0.35, urban: -0.8 },
};

const balancedProfile: FixtureProfile = {
  id: 'traveler-5',
  weights: { nature: 0.35, culture: 0.35, food: 0.35, novelty: 0.35 },
};

/**
 * Fixed fixture definitions, deliberately independent of the production model.
 * The evaluator supplies the checked-in seed data and runs every definition over
 * EVALUATION_SEED_SCHEDULE before a configuration may be promoted.
 */
export const SYNTHETIC_SCENARIOS: readonly FixtureScenario[] = [
  {
    id: 'clear-attribute-preference',
    label: 'Strong attribute-driven preference',
    userCount: 1,
    profiles: [activeProfile],
    expectation: { expectedConfidence: 'clear-shape', fifthSixthMargin: 'clear', notes: 'A coherent active/nature preference should recover a stable top five.' },
  },
  {
    id: 'vivid-activity-residual',
    label: 'Vivid residual versus portfolio',
    userCount: 1,
    profiles: [{ ...cultureProfile, vividResidual: 3.25 }],
    expectation: { expectedConfidence: 'clear-shape', notes: 'One unusually attractive card must not incorrectly dominate its destination portfolio.' },
  },
  {
    id: 'fifth-sixth-boundary',
    label: 'Fifth/sixth boundary',
    userCount: 1,
    profiles: [{ ...balancedProfile, destinationOffset: {} }],
    expectation: { expectedConfidence: 'close-call', fifthSixthMargin: 'narrow', notes: 'Near-boundary destinations exercise uncertainty and bounded stopping.' },
  },
  {
    id: 'indifferent-traveler',
    label: 'Broad indifference',
    userCount: 1,
    profiles: [{ id: 'traveler-1', weights: {}, outcomeNoiseScale: 0.03 }],
    expectation: { expectedConfidence: 'close-call', fifthSixthMargin: 'narrow', notes: 'A flat preference surface should reach the maximum with honest close-call copy.' },
  },
  {
    id: 'consensus-group',
    label: 'Five-person consensus',
    userCount: 5,
    profiles: [activeProfile, { ...activeProfile, id: 'traveler-2', weights: { ...activeProfile.weights, culture: 0.25 } }, { ...activeProfile, id: 'traveler-3', weights: { ...activeProfile.weights, food: 0.2 } }, { ...activeProfile, id: 'traveler-4', weights: { ...activeProfile.weights, history: 0.2 } }, { ...activeProfile, id: 'traveler-5', weights: { ...activeProfile.weights, novelty: 1.0 } }],
    expectation: { expectedConfidence: 'clear-shape', expectedGroupConsensus: 'broad-consensus', notes: 'Similar preferences should produce a low-dispersion group leader.' },
  },
  {
    id: 'polarizing-group',
    label: 'High-mean polarizing group',
    userCount: 5,
    profiles: [activeProfile, natureProfile, cultureProfile, comfortProfile, balancedProfile],
    expectation: { expectedConfidence: 'close-call', expectedGroupConsensus: 'polarized', notes: 'A group with opposed tastes validates the polarization penalty and consensus label.' },
  },
  {
    id: 'noisy-replay',
    label: 'Seeded noisy replay',
    userCount: 1,
    profiles: [{ ...activeProfile, outcomeNoiseScale: 0.7 }],
    expectation: { expectedConfidence: 'close-call', notes: 'Seeded stochastic outcomes exercise deterministic replay and calibration.' },
  },
] as const;

export function getSyntheticScenario(id: FixtureScenarioId): FixtureScenario {
  const scenario = SYNTHETIC_SCENARIOS.find((item) => item.id === id);
  if (!scenario) throw new Error(`Unknown synthetic scenario: ${id}`);
  return scenario;
}

function unitInterval(seed: string): number {
  // FNV-1a gives a small, platform-stable hash for test-fixture randomness.
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 0x1_0000_0000;
}

function centeredAttribute(value: number): number {
  return (value - 2.5) / 2.5;
}

function profileUtility(profile: FixtureProfile, activity: Activity): number {
  return ATTRIBUTE_KEYS.reduce((total, key) => total + centeredAttribute(activity.attributes[key]) * (profile.weights[key] ?? 0), 0)
    + (profile.destinationOffset?.[activity.destinationId] ?? 0);
}

function scenarioOffsets(scenario: FixtureScenario, destinations: readonly Destination[]): Readonly<Record<string, number>> {
  const offsets = Object.fromEntries(destinations.map((destination) => [destination.id, 0]));
  if (scenario.id === 'fifth-sixth-boundary') {
    // The evaluator derives its expected top five from truth; the tiny sixth-place
    // separation deliberately makes this an uncertainty-sensitive fixture.
    destinations.slice(0, 5).forEach((destination, index) => { offsets[destination.id] = 1.2 - index * 0.12; });
    if (destinations[5]) offsets[destinations[5].id] = offsets[destinations[4]!.id] - 0.025;
  }
  if (scenario.id === 'vivid-activity-residual' && destinations[0]) offsets[destinations[0].id] = -0.7;
  if (scenario.id === 'polarizing-group' && destinations[0]) offsets[destinations[0].id] = 0.65;
  return offsets;
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

export function createSyntheticFixtureRun(
  scenarioId: FixtureScenarioId,
  seed: number,
  destinations: readonly Destination[],
  activities: readonly Activity[],
): SyntheticFixtureRun {
  const scenario = getSyntheticScenario(scenarioId);
  if (destinations.length < 6 || activities.length === 0) throw new Error('Synthetic fixtures require at least six destinations and one activity.');
  const offsets = scenarioOffsets(scenario, destinations);
  const vividActivityId = scenario.id === 'vivid-activity-residual' ? activities[0]!.id : undefined;
  const vividDestinationId = vividActivityId ? activities[0]!.destinationId : undefined;
  const profileById = new Map(scenario.profiles.map((profile) => [profile.id, profile]));
  const users = scenario.profiles.map((profile) => {
    const activityUtilities = Object.fromEntries(activities.map((activity) => {
      const residual = activity.id === vividActivityId ? profile.vividResidual ?? 0 : 0;
      const seededNoise = (unitInterval(`${scenario.id}:${seed}:${profile.id}:${activity.id}:utility`) - 0.5) * (profile.outcomeNoiseScale ?? 0);
      return [activity.id, profileUtility(profile, activity) + offsets[activity.destinationId]! + residual + seededNoise];
    }));
    const destinationUtilities = Object.fromEntries(destinations.map((destination) => {
      const portfolio = activities.filter((activity) => activity.destinationId === destination.id);
      return [destination.id, portfolio.reduce((total, activity) => total + activityUtilities[activity.id]!, 0) / portfolio.length];
    }));
    return { id: profile.id, activityUtilities, destinationUtilities };
  });
  const utilitiesByUser = new Map(users.map((user) => [user.id, user.activityUtilities]));

  const probabilityFirstWins = (userId: string, activityA: string, activityB: string) => {
    const utility = utilitiesByUser.get(userId);
    if (!utility || utility[activityA] === undefined || utility[activityB] === undefined) throw new Error('Synthetic comparison referenced an unknown user or activity.');
    return sigmoid(utility[activityA]! - utility[activityB]!);
  };
  return {
    scenario,
    seed,
    users,
    vividActivityId,
    vividDestinationId,
    probabilityFirstWins,
    winnerForPair: (userId, activityA, activityB, comparisonOrdinal) => {
      const profile = profileById.get(userId);
      if (!profile) throw new Error(`Synthetic comparison referenced an unknown user: ${userId}`);
      const probability = probabilityFirstWins(userId, activityA, activityB);
      const random = unitInterval(`${scenario.id}:${seed}:${userId}:${activityA}:${activityB}:${comparisonOrdinal}:outcome`);
      return random < probability ? activityA : activityB;
    },
  };
}
