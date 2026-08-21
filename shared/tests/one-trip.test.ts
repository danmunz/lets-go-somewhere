import { describe, expect, it } from 'vitest';
import {
  BLIND_ACTIVITY_FORBIDDEN_FIELDS,
  groupStatusSchema,
  nextComparisonResponseSchema,
  preferenceProfileSchema,
  safeActivitySchema,
  toSafeActivity,
  type Activity,
} from '../src/index.js';

const activity: Activity = {
  id: 'oaxaca-ruins',
  destinationId: 'oaxaca',
  title: 'Walk through a hilltop city built two thousand years ago',
  description: 'Spend a morning among monumental plazas, carved stones, and expansive valley views.',
  imageUrl: '/media/cards/003.webp',
  attributes: {
    adventure: 1,
    nature: 2,
    culture: 5,
    food: 0,
    history: 5,
    urban: 1,
    novelty: 4,
    physicalIntensity: 2,
  },
};

describe('one-trip shared contracts', () => {
  it('validates target progress and rejects impossible completion details', () => {
    expect(
      nextComparisonResponseSchema.safeParse({
        complete: false,
        progress: { comparisons: 24, minimum: 32, maximum: 32, estimatedCompletion: .75, phase: 'checking-boundary' },
        activityA: toSafeActivity(activity),
        activityB: { ...toSafeActivity(activity), id: 'other-activity' },
      }).success,
    ).toBe(true);

    expect(
      nextComparisonResponseSchema.safeParse({
        complete: false,
        progress: { comparisons: 5, minimum: 23, maximum: 40, estimatedCompletion: 0.2, phase: 'explore' },
        activityA: toSafeActivity(activity),
        activityB: { ...toSafeActivity(activity), id: 'other-activity' },
      }).success,
    ).toBe(false);
  });

  it('keeps comparison activities destination-blind even when the source activity has private fields', () => {
    const safe = toSafeActivity(activity);
    expect(safe).toEqual({
      id: activity.id,
      title: activity.title,
      description: activity.description,
      imageUrl: activity.imageUrl,
    });

    for (const field of BLIND_ACTIVITY_FORBIDDEN_FIELDS) {
      expect(safe).not.toHaveProperty(field);
      expect(safeActivitySchema.safeParse({ ...safe, [field]: 'private' }).success).toBe(false);
    }
  });

  it('rejects private location and credit fields on a full blind-comparison response', () => {
    const safe = toSafeActivity(activity);
    expect(
      nextComparisonResponseSchema.safeParse({
        complete: false,
          progress: { comparisons: 0, minimum: 32, maximum: 32, estimatedCompletion: 0, phase: 'explore' },
        activityA: { ...safe, destinationId: activity.destinationId },
        activityB: { ...safe, id: 'other-activity' },
      }).success,
    ).toBe(false);
  });

  it('enforces the fixed roster and honest completion state in group status', () => {
    const members = ['dan', 'james', 'john', 'matt', 'peter'].map((user) => ({ user, complete: true }));
    expect(
      groupStatusSchema.safeParse({
        revealOpen: false,
        allComplete: true,
        members,
        updatedAt: '2026-08-18T12:00:00.000Z',
      }).success,
    ).toBe(true);
    expect(
      groupStatusSchema.safeParse({
        revealOpen: false,
        allComplete: true,
        members: [...members.slice(0, 4), { user: 'dan', complete: true }],
        updatedAt: '2026-08-18T12:00:00.000Z',
      }).success,
    ).toBe(false);
  });

  it('allows the documented two-dimension profile fallback but no sparse profile', () => {
    const dimension = { key: 'adventure', label: 'Adventure', strength: 'strong', direction: 'drawn-to' } as const;
    expect(
      preferenceProfileSchema.safeParse({
        headline: 'Apparently, this is your kind of trip.',
        synthesis: 'Your mix is still taking shape.',
        dimensions: [dimension, { ...dimension, key: 'history', label: 'Old places' }],
        confidenceLabel: 'still-emerging',
      }).success,
    ).toBe(true);
    expect(
      preferenceProfileSchema.safeParse({
        headline: 'Too little data',
        synthesis: 'One dimension is not a profile.',
        dimensions: [dimension],
        confidenceLabel: 'still-emerging',
      }).success,
    ).toBe(false);
  });
});
