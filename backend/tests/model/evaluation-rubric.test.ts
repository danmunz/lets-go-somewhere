import { describe, expect, it } from 'vitest';
import { activities, destinations } from '../../src/store.js';
import {
  EVALUATION_BUDGETS,
  EVALUATION_RUNS_PER_SCENARIO,
  EVALUATION_SEED_SCHEDULE,
  SYNTHETIC_SCENARIOS,
  createSyntheticFixtureRun,
} from './fixtures.js';

describe('synthetic model-evaluation fixtures', () => {
  it('defines all required scenarios, budgets, and a 200-seed deterministic schedule', () => {
    expect(SYNTHETIC_SCENARIOS.map((scenario) => scenario.id)).toEqual([
      'clear-attribute-preference',
      'vivid-activity-residual',
      'fifth-sixth-boundary',
      'indifferent-traveler',
      'consensus-group',
      'polarizing-group',
      'noisy-replay',
    ]);
    expect(EVALUATION_BUDGETS).toEqual([24, 28, 32, 36, 40]);
    expect(EVALUATION_RUNS_PER_SCENARIO).toBe(200);
    expect(EVALUATION_SEED_SCHEDULE).toHaveLength(200);
    expect(new Set(EVALUATION_SEED_SCHEDULE).size).toBe(200);
  });

  it('replays the same truth and choices for an identical scenario and seed', () => {
    const first = createSyntheticFixtureRun('noisy-replay', EVALUATION_SEED_SCHEDULE[0]!, destinations, activities);
    const replay = createSyntheticFixtureRun('noisy-replay', EVALUATION_SEED_SCHEDULE[0]!, destinations, activities);
    expect(replay.users).toEqual(first.users);
    const [activityA, activityB] = activities;
    expect(replay.probabilityFirstWins('traveler-1', activityA!.id, activityB!.id)).toBe(first.probabilityFirstWins('traveler-1', activityA!.id, activityB!.id));
    expect(replay.winnerForPair('traveler-1', activityA!.id, activityB!.id, 7)).toBe(first.winnerForPair('traveler-1', activityA!.id, activityB!.id, 7));
  });

  it('varies seeded noisy truth while retaining the designated residual and group structures', () => {
    const first = createSyntheticFixtureRun('noisy-replay', EVALUATION_SEED_SCHEDULE[0]!, destinations, activities);
    const second = createSyntheticFixtureRun('noisy-replay', EVALUATION_SEED_SCHEDULE[1]!, destinations, activities);
    expect(second.users[0]!.activityUtilities).not.toEqual(first.users[0]!.activityUtilities);

    const vivid = createSyntheticFixtureRun('vivid-activity-residual', EVALUATION_SEED_SCHEDULE[0]!, destinations, activities);
    expect(vivid.vividActivityId).toBe(activities[0]!.id);
    expect(vivid.vividDestinationId).toBe(activities[0]!.destinationId);
    expect(vivid.users).toHaveLength(1);
    expect(createSyntheticFixtureRun('consensus-group', 10_000, destinations, activities).users).toHaveLength(5);
    expect(createSyntheticFixtureRun('polarizing-group', 10_000, destinations, activities).scenario.expectation.expectedGroupConsensus).toBe('polarized');
  });
});
