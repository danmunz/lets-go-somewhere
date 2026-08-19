import { describe, expect, it } from 'vitest';
import { ROSTER_USERS, transparentGroupResultsResponseSchema, transparentResultSnapshotSchema } from '@lgs/shared';
import { buildTransparentSocialBallot, type SocialBallotInput } from '../../src/results/social-ballot.js';

const users = ROSTER_USERS;

function namesFor(ballots: SocialBallotInput['ballots']): Record<string, string> {
  return Object.fromEntries([...new Set(users.flatMap((user) => ballots[user]))].map((id) => [id, id.toUpperCase()]));
}

function input(
  ballots: SocialBallotInput['ballots'],
  profileThemes: SocialBallotInput['profileThemes'] = {
    dan: ['Adventure'], james: ['Adventure'], john: ['Beach time'], matt: ['Beach time'], peter: ['Culture'],
  },
): SocialBallotInput {
  return { ballots, profileThemes, destinationNames: namesFor(ballots) };
}

const broadBallots = {
  dan: ['a', 'b', 'c', 'd', 'e'],
  james: ['a', 'c', 'b', 'd', 'f'],
  john: ['a', 'b', 'd', 'e', 'f'],
  matt: ['b', 'a', 'c', 'e', 'f'],
  peter: ['c', 'a', 'b', 'd', 'e'],
} as const;

describe('transparent social ballot', () => {
  it('uses only top-five ranks as the 5/4/3/2/1 ballot and gives lower ranks zero', () => {
    const ballot = buildTransparentSocialBallot(input(broadBallots));
    expect(ballot.finalists[0]).toMatchObject({ id: 'a', points: 23, firstPlaceVotes: 3, topFiveSupporters: users });
    expect(ballot.finalistRanks.find((row) => row.destinationId === 'a')!.ranks).toEqual([
      { user: 'dan', rank: 1 }, { user: 'james', rank: 1 }, { user: 'john', rank: 1 }, { user: 'matt', rank: 2 }, { user: 'peter', rank: 2 },
    ]);
    // A finalist receives no points from a traveler who ranked it lower than
    // fifth; the matrix preserves that as an explicit non-rank.
    expect(ballot.finalistRanks.find((row) => row.destinationId === 'c')!.ranks).toContainEqual({ user: 'john', rank: 'outside-top-five' });
  });

  it('orders equal point totals by first-place votes, then supporters, and shares a rank only after published tiebreaks', () => {
    const firstVoteBreak = buildTransparentSocialBallot(input({
      dan: ['a', 'b', 'dan-3', 'dan-4', 'dan-5'],
      james: ['a', 'b', 'james-3', 'james-4', 'james-5'],
      john: ['b', 'a', 'john-3', 'john-4', 'john-5'],
      matt: ['matt-1', 'matt-2', 'b', 'matt-4', 'a'],
      peter: ['peter-1', 'peter-2', 'peter-3', 'peter-4', 'a'],
    }));
    expect(firstVoteBreak.finalists.slice(0, 2).map((finalist) => [finalist.id, finalist.points, finalist.firstPlaceVotes])).toEqual([
      ['a', 16, 2], ['b', 16, 1],
    ]);

    const exactTie = buildTransparentSocialBallot(input({
      dan: ['a', 'b', 'dan-3', 'dan-4', 'dan-5'],
      james: ['b', 'a', 'james-3', 'james-4', 'james-5'],
      john: ['john-1', 'john-2', 'a', 'b', 'john-5'],
      matt: ['matt-1', 'matt-2', 'b', 'a', 'matt-5'],
      peter: ['peter-1', 'peter-2', 'peter-3', 'peter-4', 'peter-5'],
    }));
    expect(exactTie.finalists.slice(0, 2).map((finalist) => ({ id: finalist.id, rank: finalist.rank, points: finalist.points, first: finalist.firstPlaceVotes, supporters: finalist.topFiveSupporters.length }))).toEqual([
      { id: 'a', rank: 1, points: 14, first: 1, supporters: 4 },
      { id: 'b', rank: 1, points: 14, first: 1, supporters: 4 },
    ]);
    expect(exactTie.displayMode).toBe('shared-shortlist');
  });

  it('uses a stable lexical ID cutoff when a fifth-boundary tiebreak remains unresolved', () => {
    const ballot = buildTransparentSocialBallot(input({
      dan: ['a', 'b', 'c', 'd', 'f'], james: ['a', 'b', 'c', 'd', 'g'], john: ['a', 'b', 'c', 'd', 'f'], matt: ['a', 'b', 'c', 'd', 'g'], peter: ['a', 'b', 'c', 'd', 'e'],
    }));
    expect(ballot.finalists).toHaveLength(5);
    expect(ballot.finalists.map((finalist) => finalist.id)).toEqual(['a', 'b', 'c', 'd', 'f']);
  });

  it('selects each primary display mode without changing the tally', () => {
    expect(buildTransparentSocialBallot(input(broadBallots)).displayMode).toBe('broad-leader');
    expect(buildTransparentSocialBallot(input({
      dan: ['a', 'dan-2', 'dan-3', 'dan-4', 'dan-5'], james: ['a', 'james-2', 'james-3', 'james-4', 'james-5'],
      john: ['john-1', 'john-2', 'john-3', 'john-4', 'a'], matt: ['b', 'matt-2', 'matt-3', 'matt-4', 'matt-5'], peter: ['b', 'peter-2', 'peter-3', 'peter-4', 'peter-5'],
    })).displayMode).toBe('near-tie');
    const noConsensus = {
      dan: ['dan-1', 'b', 'dan-3', 'dan-4', 'dan-5'], james: ['james-1', 'b', 'james-3', 'james-4', 'james-5'],
      john: ['john-1', 'john-2', 'john-3', 'john-4', 'john-5'], matt: ['matt-1', 'matt-2', 'matt-3', 'matt-4', 'matt-5'], peter: ['peter-1', 'peter-2', 'peter-3', 'peter-4', 'peter-5'],
    } as const;
    expect(buildTransparentSocialBallot(input(noConsensus)).displayMode).toBe('no-consensus');
  });

  it('emits only supported, ordered social insights and caps them at three', () => {
    const ballot = buildTransparentSocialBallot(input({
      dan: ['a', 'solo-dan', 'split', 'camp-one', 'd'],
      james: ['a', 'split', 'camp-one', 'b', 'd'],
      john: ['a', 'camp-one', 'split', 'b', 'd'],
      matt: ['camp-two', 'split', 'b', 'c', 'e'],
      peter: ['camp-two', 'b', 'c', 'd', 'e'],
    }, {
      dan: ['Adventure'], james: ['Adventure'], john: ['Adventure'], matt: ['Beach time'], peter: ['Beach time'],
    }));
    expect(ballot.insights.map((insight) => insight.kind)).toEqual([
      'strong-shared-destination', 'split-destination', 'two-camps',
    ]);
    for (const insight of ballot.insights) {
      expect(insight.body).not.toMatch(/activity|comparison|score|posterior/i);
      for (const user of insight.users) expect(users).toContain(user);
      for (const id of insight.destinationIds ?? []) expect(namesFor({
        dan: ['a', 'solo-dan', 'split', 'camp-one', 'd'], james: ['a', 'split', 'camp-one', 'b', 'd'], john: ['a', 'camp-one', 'split', 'b', 'd'], matt: ['camp-two', 'split', 'b', 'c', 'e'], peter: ['camp-two', 'b', 'c', 'd', 'e'],
      })[id]).toBeTruthy();
    }
  });

  it('recognizes a single-person #1 as a wild card and does not invent unsupported insight copy', () => {
    const ballot = buildTransparentSocialBallot(input({
      dan: ['solo', 'a', 'b', 'c', 'd'], james: ['a', 'b', 'c', 'd', 'e'], john: ['a', 'b', 'c', 'd', 'e'], matt: ['a', 'b', 'c', 'd', 'e'], peter: ['a', 'b', 'c', 'd', 'e'],
    }));
    const wild = ballot.insights.find((insight) => insight.kind === 'wild-card');
    expect(wild).toMatchObject({ users: ['dan'], destinationIds: ['solo'] });
    expect(wild!.body).toContain('SOLO');
  });

  it('keeps v1 legacy reading separate from v2-only snapshot creation and rejects mixed/old v2 fields', () => {
    const v2 = {
      schemaVersion: 2,
      modelVersion: 'elo-coverage-v1',
      seedVersion: 'a'.repeat(64),
      inputDigest: 'b'.repeat(64),
      createdAt: '2026-08-18T12:00:00.000Z',
      users: Object.fromEntries(users.map((user) => [user, {
        topFive: broadBallots[user], profileThemes: ['Adventure'],
        profile: { headline: 'A travel shape', synthesis: 'A clear travel shape.', dimensions: [
          { key: 'adventure', label: 'Adventure', strength: 'strong', direction: 'drawn-to' },
          { key: 'nature', label: 'Nature', strength: 'present', direction: 'drawn-to' },
        ], confidenceLabel: 'clear-shape' },
        personalResults: { confidence: { label: 'close-call', summary: 'Close choices.' }, topFive: broadBallots[user].map((id, index) => ({
          rank: index + 1, id, fitLabel: index === 0 ? 'strong-match' : 'contender', interval: { low: 0, high: 1 },
          explanation: { themes: ['Adventure', 'Nature'], matchedActivityCount: 1, encounteredActivityCount: 1 },
        })) },
      }])),
      group: buildTransparentSocialBallot(input(broadBallots)),
    };
    expect(transparentResultSnapshotSchema.parse(v2).schemaVersion).toBe(2);
    expect(transparentResultSnapshotSchema.safeParse({ ...v2, group: { ...v2.group, confidence: {} } }).success).toBe(false);
    expect(transparentResultSnapshotSchema.safeParse({ ...v2, schemaVersion: 1 }).success).toBe(false);
  });

  it('parses a complete enriched public ballot and rejects unknown public fields', () => {
    const social = buildTransparentSocialBallot(input(broadBallots));
    const response = {
      snapshotId: 'snapshot-1',
      modelVersion: 'elo-coverage-v1',
      displayMode: social.displayMode,
      group: social.finalists.map((finalist) => ({
        ...finalist,
        name: finalist.id.toUpperCase(), country: 'Testland', imageUrl: `/media/destinations/${finalist.id}/cover.webp`,
        context: { novemberWeather: 'Warm', travelFriction: 2 },
      })),
      members: users.map((user) => ({
        user,
        topFive: broadBallots[user].map((id, index) => ({ rank: index + 1, id, name: id.toUpperCase(), imageUrl: `/media/destinations/${id}/cover.webp` })),
      })),
      finalistRanks: social.finalistRanks,
      insights: social.insights,
      decisions: [],
    };
    expect(transparentGroupResultsResponseSchema.parse(response).group[0]!.name).toBe('A');
    expect(transparentGroupResultsResponseSchema.safeParse({ ...response, hiddenUtility: 1 }).success).toBe(false);
  });
});
