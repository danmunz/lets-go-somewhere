import { describe, expect, it } from 'vitest';
import type { Activity, Comparison } from '@lgs/shared';
import { ATTRIBUTE_KEYS } from '@lgs/shared';
import { createDesignMatrix } from '../../src/model/features.js';
import type { FitSuccess } from '../../src/model/fit.js';
import { cholesky, createMatrix } from '../../src/model/linear-algebra.js';
import {
  eligibleInformationGainPairs,
  scoreInformationGainPairs,
  selectInformationGainPair,
} from '../../src/model/selection.js';

function activity(id: string, destinationId: string, adventure: number): Activity {
  return {
    id, destinationId, title: id, description: `${id} description`, imageUrl: '/media/cards/example.webp',
    attributes: Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, key === 'adventure' ? adventure : 2])) as Activity['attributes'],
  };
}

const activities = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'].flatMap((destinationId, destinationIndex) => [
  activity(`${destinationId}-one`, destinationId, destinationIndex % 6),
  activity(`${destinationId}-two`, destinationId, (destinationIndex + 2) % 6),
  activity(`${destinationId}-three`, destinationId, (destinationIndex + 4) % 6),
]);

function fittedModel(input: readonly Activity[] = activities): FitSuccess {
  const design = createDesignMatrix(input);
  const precision = createMatrix(design.parameterCount);
  for (let index = 0; index < precision.length; index += 1) precision[index]![index] = 12;
  return {
    ok: true,
    design,
    parameters: Array.from({ length: design.parameterCount }, () => 0),
    precision,
    precisionCholesky: cholesky(precision),
    diagnostics: { converged: true, iterations: 1, lastUpdate: 0, logPosterior: 0, usedDiagonalJitter: false, comparisonCount: 0 },
  };
}

const comparison = (activityA: string, activityB: string, winner = activityA): Comparison => ({ activityA, activityB, winner });

describe('information-gain pair selection', () => {
  it('excludes answered, same-destination, recently seen, and overexposed pairs while coverage is incomplete', () => {
    const comparisons = [
      comparison('alpha-one', 'bravo-one'),
      comparison('alpha-one', 'charlie-one'),
      comparison('delta-one', 'echo-one'),
    ];
    const candidates = eligibleInformationGainPairs(activities, comparisons);
    expect(candidates).not.toHaveLength(0);
    const undercovered = new Set(['bravo', 'charlie', 'delta', 'echo', 'foxtrot']);
    for (const [first, second] of candidates) {
      expect(first.destinationId).not.toBe(second.destinationId);
      expect([first.id, second.id].sort().join(':')).not.toBe('alpha-one:bravo-one');
      // Every pair must satisfy the safety obligation by touching a portfolio
      // with fewer than two appearances. alpha-one is also prohibited from a
      // third showing before that coverage is complete.
      expect([first.destinationId, second.destinationId].some((destinationId) => undercovered.has(destinationId))).toBe(true);
      expect(first.id).not.toBe('alpha-one');
      expect(second.id).not.toBe('alpha-one');
    }
  });

  it('relaxes the immediate-history cooling rule only when it is the last available constraint', () => {
    const tiny = [
      activity('alpha-one', 'alpha', 1),
      activity('bravo-one', 'bravo', 5),
      activity('charlie-one', 'charlie', 3),
    ];
    const candidates = eligibleInformationGainPairs(tiny, [comparison('alpha-one', 'bravo-one')]);
    // Both remaining legal pairs necessarily revisit one of the immediately
    // displayed cards, so cooling is relaxed rather than ending the round.
    expect(candidates.map(([first, second]) => `${first.id}:${second.id}`)).toEqual([
      'alpha-one:charlie-one',
      'bravo-one:charlie-one',
    ]);
  });

  it('is deterministic, lexically stable on tied metrics, and does not expose a rationale on the issued pair', () => {
    const input = { activities, comparisons: [] as Comparison[], fit: fittedModel(), seed: 'selection-replay' };
    const first = selectInformationGainPair(input);
    const replay = selectInformationGainPair(input);
    expect(replay).toEqual(first);
    expect(first).toBeDefined();
    expect(first && Object.hasOwn(first, 'reason')).toBe(false);
    const scores = scoreInformationGainPairs(input);
    expect(scores[0]?.score).toBeGreaterThanOrEqual(scores.at(-1)?.score ?? -Infinity);
    expect(scores.map((entry) => `${entry.pair[0].id}:${entry.pair[1].id}`)).toEqual(
      [...scores].sort((left, right) => right.score - left.score || `${left.pair[0].id}:${left.pair[1].id}`.localeCompare(`${right.pair[0].id}:${right.pair[1].id}`))
        .map((entry) => `${entry.pair[0].id}:${entry.pair[1].id}`),
    );
  });

  it('uses posterior-predictive entropy rather than a plug-in MAP probability', () => {
    const onePerDestination = activities.filter((item) => item.id.endsWith('-one'));
    const design = createDesignMatrix(onePerDestination);
    const parameters = Array.from({ length: design.parameterCount }, () => 0);
    // Both pairs have exactly the same MAP log-odds. The charlie/delta
    // residuals are deliberately uncertain, so posterior prediction moves
    // closer to a fair comparison and earns higher entropy.
    parameters[8 + design.destinationIds.length + design.activityIndexById.get('alpha-one')!] = 0.4;
    parameters[8 + design.destinationIds.length + design.activityIndexById.get('charlie-one')!] = 0.4;
    const precision = createMatrix(design.parameterCount);
    for (let index = 0; index < precision.length; index += 1) precision[index]![index] = 100;
    precision[8 + design.destinationIds.length + design.activityIndexById.get('charlie-one')!][8 + design.destinationIds.length + design.activityIndexById.get('charlie-one')!] = 0.05;
    precision[8 + design.destinationIds.length + design.activityIndexById.get('delta-one')!][8 + design.destinationIds.length + design.activityIndexById.get('delta-one')!] = 0.05;
    const fit: FitSuccess = {
      ok: true, design, parameters, precision, precisionCholesky: cholesky(precision),
      diagnostics: { converged: true, iterations: 1, lastUpdate: 0, logPosterior: 0, usedDiagonalJitter: false, comparisonCount: 0 },
    };
    const scores = scoreInformationGainPairs({ activities: onePerDestination, comparisons: [], fit, seed: 'predictive' });
    const metric = (first: string, second: string) => scores.find((entry) =>
      [entry.pair[0].id, entry.pair[1].id].sort().join(':') === [first, second].sort().join(':'))!;
    expect(metric('alpha-one', 'bravo-one').predictiveEntropy).toBeLessThan(metric('charlie-one', 'delta-one').predictiveEntropy);
  });

  it('keeps third appearances as an explicit exhaustion fallback after coverage completes', () => {
    const covered = [
      comparison('alpha-one', 'bravo-one'),
      comparison('alpha-one', 'charlie-one'),
      comparison('delta-one', 'echo-one'),
      comparison('foxtrot-one', 'bravo-two'),
      comparison('charlie-two', 'delta-two'),
      comparison('echo-two', 'foxtrot-two'),
    ];
    const primary = eligibleInformationGainPairs(activities, covered);
    expect(primary).not.toHaveLength(0);
    expect(primary.every(([first, second]) => first.id !== 'alpha-one' && second.id !== 'alpha-one')).toBe(true);

    const tiny = activities.filter((item) => item.id.endsWith('-one'));
    const exhausted = [
      comparison('alpha-one', 'bravo-one'),
      comparison('alpha-one', 'charlie-one'),
      comparison('bravo-one', 'delta-one'),
      comparison('charlie-one', 'echo-one'),
      comparison('delta-one', 'foxtrot-one'),
      comparison('echo-one', 'foxtrot-one'),
    ];
    const fallback = eligibleInformationGainPairs(tiny, exhausted);
    expect(fallback).not.toHaveLength(0);
    expect(fallback.every(([first, second]) =>
      exhausted.flatMap((entry) => [entry.activityA, entry.activityB]).includes(first.id)
      && exhausted.flatMap((entry) => [entry.activityA, entry.activityB]).includes(second.id))).toBe(true);
  });
});
