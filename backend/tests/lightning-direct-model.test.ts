import { describe, expect, it } from 'vitest';
import {
  LIGHTNING_BALANCED_COMPARISONS,
  LIGHTNING_CORE_COMPARISONS,
  LIGHTNING_MAX_COMPARISONS,
  LIGHTNING_EVIDENCE_DRAW_COUNT,
  buildLightningWorkingOrder,
  buildLightningRanking,
  fitDirectDestinationBradleyTerry,
  initialLightningSchedule,
  pairKey,
  selectNextLightningPair,
  shouldCompleteLightningRound,
  tallyLightningBorda,
  tallyLightningWorkingOrderBorda,
  type DirectComparison,
  type DirectDestination,
  type LightningRanking,
} from '../src/lightning/direct-model.js';

const destinations: DirectDestination[] = Array.from({ length: 24 }, (_, index) => ({ id: `place-${String(index + 1).padStart(2, '0')}` }));

function pickWinner(left: DirectDestination, right: DirectDestination): string {
  return left.id.localeCompare(right.id) < 0 ? left.id : right.id;
}

function advance(count: number): DirectComparison[] {
  const comparisons: DirectComparison[] = [];
  for (let ordinal = 0; ordinal < count; ordinal += 1) {
    const pair = selectNextLightningPair(destinations, comparisons, 'test-seed');
    if (!pair) throw new Error(`Expected pair ${ordinal + 1}.`);
    comparisons.push({ destinationA: pair[0].id, destinationB: pair[1].id, winner: pickWinner(pair[0], pair[1]) });
  }
  return comparisons;
}

describe('Lightning direct-destination model', () => {
  it('builds three fair, non-repeating circle rounds', () => {
    const schedule = initialLightningSchedule(destinations);
    expect(schedule).toHaveLength(LIGHTNING_BALANCED_COMPARISONS);
    expect(new Set(schedule.map(([left, right]) => pairKey(left, right))).size).toBe(LIGHTNING_BALANCED_COMPARISONS);
    const counts = new Map(destinations.map(({ id }) => [id, 0]));
    for (const [left, right] of schedule) {
      counts.set(left, counts.get(left)! + 1);
      counts.set(right, counts.get(right)! + 1);
    }
    expect([...counts.values()]).toEqual(Array.from({ length: 24 }, () => 3));
  });

  it('keeps first 48 comparisons unique and gives every place four appearances', () => {
    const comparisons = advance(LIGHTNING_CORE_COMPARISONS);
    expect(new Set(comparisons.map((comparison) => pairKey(comparison.destinationA, comparison.destinationB))).size).toBe(LIGHTNING_CORE_COMPARISONS);
    const counts = new Map(destinations.map(({ id }) => [id, 0]));
    for (const comparison of comparisons) {
      counts.set(comparison.destinationA, counts.get(comparison.destinationA)! + 1);
      counts.set(comparison.destinationB, counts.get(comparison.destinationB)! + 1);
    }
    expect([...counts.values()]).toEqual(Array.from({ length: 24 }, () => 4));
  });

  it('fits a deterministic direct ranking without activity attributes or residuals', () => {
    const comparisons = advance(24);
    const first = fitDirectDestinationBradleyTerry(destinations, comparisons);
    const second = fitDirectDestinationBradleyTerry([...destinations].reverse(), comparisons);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.destinationIds).toHaveLength(24);
    expect(first.parameters).toEqual(second.parameters);
    expect(first.parameters[0]).toBeGreaterThan(first.parameters.at(-1)!);
  });

  it('stops no later than the configured 60-question ceiling and creates complete tiers', () => {
    const comparisons = advance(LIGHTNING_MAX_COMPARISONS);
    expect(shouldCompleteLightningRound(destinations, comparisons, 'test-seed')).toBe(true);
    expect(selectNextLightningPair(destinations, comparisons, 'test-seed')).toBeUndefined();
    const fit = fitDirectDestinationBradleyTerry(destinations, comparisons);
    expect(fit.ok).toBe(true);
    if (!fit.ok) return;
    const ranking = buildLightningRanking(fit, 'test-seed');
    expect(ranking.tiers.flatMap((tier) => tier.destinationIds)).toHaveLength(24);
    expect(new Set(ranking.tiers.flatMap((tier) => tier.destinationIds)).size).toBe(24);
  });

  it('derives a deterministic 4,096-draw working order without turning uncertainty into a 24-way tie', () => {
    const comparisons = advance(LIGHTNING_MAX_COMPARISONS);
    const fit = fitDirectDestinationBradleyTerry(destinations, comparisons);
    expect(fit.ok).toBe(true);
    if (!fit.ok) return;
    const first = buildLightningWorkingOrder(fit, 'test-seed');
    const second = buildLightningWorkingOrder(fit, 'test-seed');
    expect(first).toEqual(second);
    expect(first.workingOrder).toHaveLength(24);
    expect(new Set(first.workingOrder).size).toBe(24);
    expect(first.privateEvidence).toHaveLength(24);
    expect(first.privateEvidence.every((entry, index) => entry.workingRank === index + 1 && entry.destinationId === first.workingOrder[index])).toBe(true);
    expect(first.privateEvidence.every((entry) => entry.topFivePercent >= 0 && entry.topFivePercent <= 100 && entry.rankRange.low <= entry.rankRange.high)).toBe(true);
    expect(LIGHTNING_EVIDENCE_DRAW_COUNT).toBe(4096);
  });
});

function ranking(ids: readonly string[], tiers: readonly (readonly string[])[]): LightningRanking {
  let position = 1;
  return {
    destinationIds: ids,
    tiers: tiers.map((destinationIds) => {
      const tier = { startRank: position, endRank: position + destinationIds.length - 1, destinationIds };
      position += destinationIds.length;
      return tier;
    }),
  };
}

describe('Lightning transparent Borda tally', () => {
  it('uses 24..1 points and splits positional values across personal shared tiers', () => {
    const ids = destinations.map(({ id }) => id);
    const first = ranking(ids, [[ids[0]!], [ids[1]!, ids[2]!], ...ids.slice(3).map((id) => [id])]);
    const second = ranking(ids, [[ids[1]!], [ids[0]!], ...ids.slice(2).map((id) => [id])]);
    const rows = tallyLightningBorda(ids, [first, second]);
    const rowOne = rows.find((row) => row.destinationId === ids[0])!;
    const rowTwo = rows.find((row) => row.destinationId === ids[1])!;
    expect(rowOne.points).toBe(24 + 23);
    expect(rowTwo.points).toBe((23 + 22) / 2 + 24);
    expect(rowOne.firstPlaceVotes).toBe(1);
    expect(rowTwo.firstPlaceVotes).toBe(1);
  });

  it('keeps an unresolved group tie as a visible shared rank', () => {
    const ids = destinations.map(({ id }) => id);
    const first = ranking(ids, [ids.map((id) => id)]);
    const second = ranking(ids, [ids.map((id) => id)]);
    const rows = tallyLightningBorda(ids, [first, second]);
    expect(rows).toHaveLength(24);
    expect(rows.every((row) => row.startRank === 1 && row.endRank === 24)).toBe(true);
  });

  it('uses every exact working-order position for 24..1 Borda points', () => {
    const ids = destinations.map(({ id }) => id);
    const orders = ids.map((_, offset) => [...ids.slice(offset), ...ids.slice(0, offset)]);
    const rows = tallyLightningWorkingOrderBorda(ids, orders);
    expect(rows).toHaveLength(24);
    expect(rows.every((row) => row.points === 300)).toBe(true);
    expect(rows.every((row) => row.startRank === 1 && row.endRank === 24)).toBe(true);
  });
});
