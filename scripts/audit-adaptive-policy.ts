/** Deterministic trajectory audit for the information-gain selector. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { activitySchema, destinationSchema, type Activity, type Comparison } from '@lgs/shared';
import { fitHierarchicalBradleyTerry } from '../backend/src/model/fit.js';
import { selectInformationGainPair } from '../backend/src/model/selection.js';
import { EVALUATION_SEED_SCHEDULE, SYNTHETIC_SCENARIOS, createSyntheticFixtureRun, type FixtureScenarioId, type SyntheticUserTruth } from '../backend/tests/model/fixtures.js';

const root = process.cwd();
const list = (value: string | undefined) => value?.split(',').map((item) => item.trim()).filter(Boolean);
const seeds = list(process.env.LGS_MODEL_POLICY_SEEDS)?.map(Number) ?? [...EVALUATION_SEED_SCHEDULE];
const scenarioIds = new Set(list(process.env.LGS_MODEL_POLICY_SCENARIOS) ?? SYNTHETIC_SCENARIOS.map((scenario) => scenario.id));
const maximum = Number(process.env.LGS_MODEL_POLICY_MAX ?? 40);
if (!Number.isInteger(maximum) || maximum < 24 || maximum > 40 || seeds.some((seed) => !Number.isInteger(seed))) throw new Error('Use integer seeds and a 24–40 policy maximum.');

const activities = activitySchema.array().parse(JSON.parse(readFileSync(resolve(root, 'seed/activities.json'), 'utf8'))) as Activity[];
const destinations = destinationSchema.array().parse(JSON.parse(readFileSync(resolve(root, 'seed/destinations.json'), 'utf8')));
const activityById = new Map(activities.map((activity) => [activity.id, activity]));

type Audit = { trajectories: number; fitFailures: number; exhausted: number; deterministic: boolean; uniquePairs: boolean; crossDestinationPairs: boolean; coverageAt24: boolean };
const audit: Audit = { trajectories: 0, fitFailures: 0, exhausted: 0, deterministic: true, uniquePairs: true, crossDestinationPairs: true, coverageAt24: true };

function trajectory(scenarioId: FixtureScenarioId, seed: number, user: SyntheticUserTruth): Comparison[] | undefined {
  const fixture = createSyntheticFixtureRun(scenarioId, seed, destinations, activities);
  const comparisons: Comparison[] = [];
  for (let ordinal = 1; ordinal <= maximum; ordinal += 1) {
    const fit = fitHierarchicalBradleyTerry(activities, comparisons);
    if (!fit.ok) return undefined;
    const pair = selectInformationGainPair({ activities, comparisons, fit, seed: `${scenarioId}:${seed}:${user.id}:${ordinal}` });
    if (!pair) break;
    comparisons.push({ activityA: pair[0].id, activityB: pair[1].id, winner: fixture.winnerForPair(user.id, pair[0].id, pair[1].id, ordinal) });
  }
  return comparisons;
}

for (const scenario of SYNTHETIC_SCENARIOS.filter((item) => scenarioIds.has(item.id))) {
  for (const seed of seeds) {
    const fixture = createSyntheticFixtureRun(scenario.id, seed, destinations, activities);
    for (const user of fixture.users) {
      const first = trajectory(scenario.id, seed, user);
      if (!first) { audit.fitFailures += 1; continue; }
      const second = trajectory(scenario.id, seed, user);
      audit.deterministic &&= JSON.stringify(first) === JSON.stringify(second);
      audit.trajectories += 1;
      audit.exhausted += Number(first.length < maximum);
      const pairs = first.map((comparison) => [comparison.activityA, comparison.activityB].sort().join(':'));
      audit.uniquePairs &&= new Set(pairs).size === pairs.length;
      audit.crossDestinationPairs &&= first.every((comparison) => activityById.get(comparison.activityA)?.destinationId !== activityById.get(comparison.activityB)?.destinationId);
      const coverage = new Map(destinations.map((destination) => [destination.id, 0]));
      first.slice(0, 24).forEach((comparison) => [comparison.activityA, comparison.activityB].forEach((id) => {
        const activity = activityById.get(id); if (activity) coverage.set(activity.destinationId, coverage.get(activity.destinationId)! + 1);
      }));
      audit.coverageAt24 &&= first.length >= 24 && [...coverage.values()].every((count) => count >= 2);
    }
  }
}

console.log(JSON.stringify({ policy: 'information-gain-v1', seeds: seeds.length, scenarios: [...scenarioIds].sort(), maximum, ...audit }, null, 2));
