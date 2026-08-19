import type { GroupDisplayMode, GroupInsight, RosterUser, TransparentGroupResultsResponse } from '@lgs/shared';

export const fixtureTravelers: readonly RosterUser[] = ['dan', 'james', 'john', 'matt', 'peter'];
export const fixtureTravelerNames: Record<RosterUser, string> = { dan: 'Dan', james: 'James', john: 'John', matt: 'Matt', peter: 'Peter' };

const placeNames = ['Oaxaca', 'Antigua', 'Madeira', 'Kyoto', 'Lofoten'];

const finalist = (index: number) => ({
  rank: index + 1,
  id: `fixture-place-${index + 1}`,
  name: placeNames[index]!,
  country: ['Mexico', 'Guatemala', 'Portugal', 'Japan', 'Norway'][index]!,
  imageUrl: `/media/cards/${String(index * 3 + 1).padStart(3, '0')}.webp`,
  points: 21 - index * 3,
  firstPlaceVotes: index === 0 ? 3 : index === 1 ? 1 : 0,
  topFiveSupporters: fixtureTravelers.slice(0, Math.max(1, 5 - index)),
  context: { novemberWeather: ['Warm days, cool nights', 'Sunny and mild', 'Soft and green', 'Crisp and clear', 'Brisk coastal light'][index]!, travelFriction: index + 1 },
});

const baseFixture = (): TransparentGroupResultsResponse => {
  const group = Array.from({ length: 5 }, (_, index) => finalist(index));
  return {
    snapshotId: 'fixture-transparent-ballot',
    modelVersion: 'fixture-only',
    displayMode: 'shared-shortlist',
    group,
    members: fixtureTravelers.map((user, userIndex) => ({
      user,
      topFive: group.map((place, placeIndex) => {
        const offset = (placeIndex + userIndex) % group.length;
        const destination = group[offset]!;
        return { rank: placeIndex + 1, id: destination.id, name: destination.name, imageUrl: destination.imageUrl };
      }),
    })),
    finalistRanks: group.map((place, placeIndex) => ({
      destinationId: place.id,
      ranks: fixtureTravelers.map((user, userIndex) => ({ user, rank: userIndex === 4 && placeIndex === 4 ? 'outside-top-five' as const : ((placeIndex + userIndex) % 5) + 1 })),
    })),
    insights: [],
    decisions: [],
  };
};

const overlays: Record<'wild-card' | 'two-camps' | 'split', GroupInsight> = {
  'wild-card': { kind: 'wild-card', title: 'James’s wild card', body: 'Kyoto is James’s #1 even though it did not rise to the crew shortlist’s top slot.', destinationIds: ['fixture-place-4'], users: ['james'] },
  'two-camps': { kind: 'two-camps', title: 'Two trip moods emerged', body: 'Dan and Matt leaned toward high-energy days while Peter and James preferred a slower reset.', users: ['dan', 'matt', 'peter', 'james'] },
  split: { kind: 'split-destination', title: 'A lively split', body: 'Dan and James put Oaxaca in their top five; three travelers did not.', destinationIds: ['fixture-place-1'], users: ['dan', 'james'] },
};

/**
 * Deterministic post-gate data for screenshot and component QA. This is
 * imported only by the local Vite fixture route; it never calls the API.
 */
export function createVerdictFixture(mode: GroupDisplayMode = 'shared-shortlist', overlay?: keyof typeof overlays): TransparentGroupResultsResponse {
  const result = baseFixture();
  result.displayMode = mode;
  if (mode === 'broad-leader') {
    result.group[0] = { ...result.group[0]!, points: 24, firstPlaceVotes: 4, topFiveSupporters: [...fixtureTravelers] };
  }
  if (mode === 'near-tie') {
    result.group[0] = { ...result.group[0]!, rank: 1, points: 18, firstPlaceVotes: 2, topFiveSupporters: fixtureTravelers.slice(0, 4) };
    result.group[1] = { ...result.group[1]!, rank: 1, points: 18, firstPlaceVotes: 2, topFiveSupporters: fixtureTravelers.slice(1) };
    result.group.slice(2).forEach((place, index) => { result.group[index + 2] = { ...place, rank: index + 3 }; });
  }
  if (mode === 'no-consensus') {
    result.group.forEach((place, index) => { result.group[index] = { ...place, points: 5, firstPlaceVotes: 1, topFiveSupporters: [fixtureTravelers[index]!] }; });
  }
  if (overlay) result.insights = [overlays[overlay]];
  return result;
}

export const verdictFixtureModes = ['broad-leader', 'near-tie', 'no-consensus', 'shared-shortlist'] as const;
