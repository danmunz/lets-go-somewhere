import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { GroupResultsResponse, PersonalResultsResponse, RosterUser } from '@lgs/shared';
import { MyResultsScreen } from './MyResultsScreen.js';
import { VerdictScreen } from './VerdictScreen.js';

const users: RosterUser[] = ['dan', 'james', 'john', 'matt', 'peter'];
const names: Record<RosterUser, string> = { dan: 'Dan', james: 'James', john: 'John', matt: 'Matt', peter: 'Peter' };
const place = (index: number) => ({
  rank: index + 1,
  id: `place-${index + 1}`,
  name: `Place ${index + 1}`,
  country: 'Exampleland',
  imageUrl: `/media/destinations/place-${index + 1}.webp`,
  groupScore: 0.7 - index / 100,
  interval: { low: .4, high: .8 },
  consensus: index === 0 ? 'broad-consensus' as const : 'mixed' as const,
  context: { novemberWeather: 'Mild and bright', travelFriction: index + 1 },
});
const group = Array.from({ length: 5 }, (_, index) => place(index));
const resultFixture: GroupResultsResponse = {
  snapshotId: 'snapshot-test',
  modelVersion: 'baseline-test',
  confidence: { label: 'close-call', summary: 'The top of the list is a genuine close call.' },
  group,
  members: users.map((user) => ({ user, topThree: group.slice(0, 3).map((item, index) => ({ rank: index + 1 as 1 | 2 | 3, id: item.id, name: item.name, imageUrl: item.imageUrl })) })),
  finalistRanks: group.map((item, index) => ({
    destinationId: item.id,
    ranks: users.map((user, userIndex) => ({ user, rank: userIndex === 4 && index === 4 ? '6+' as const : (index + 1) as 1 | 2 | 3 | 4 | 5 })),
  })),
  insights: [{ kind: 'close-call', title: 'Close call', body: 'A real decision deserves a real conversation.' }],
  decisions: [{ user: 'dan', choice: 'place-1', createdAt: '2026-08-18T12:00:00.000Z' }],
};
const personalFixture: PersonalResultsResponse = {
  snapshotId: 'snapshot-test',
  modelVersion: 'baseline-test',
  confidence: { label: 'clear-favorite', summary: 'Your first place has a clear pull.' },
  profile: { headline: 'A curious route', synthesis: 'Example', confidenceLabel: 'clear-shape', dimensions: [] },
  results: group.map((item, index) => ({
    ...item,
    fitLabel: index === 0 ? 'strong-match' as const : 'contender' as const,
    explanation: { themes: ['nature', 'novelty'], matchedActivityCount: 3, encounteredActivityCount: 7 },
  })),
};

describe('post-gate verdict compositions', () => {
  it('renders qualitative confidence, the #1–#5/6+ finalist matrix, and an immutable saved decision', () => {
    const markup = renderToStaticMarkup(<VerdictScreen
      results={resultFixture}
      currentUser="dan"
      travelerName={(user) => names[user]}
      avatarFor={() => '/assets/traveler.png'}
      onOpenMyResults={() => undefined}
      onRecordDecision={async () => resultFixture.decisions[0]!}
    />);

    expect(markup).toContain('The top of the list is a genuine close call.');
    expect(markup).toContain('6+');
    expect(markup).toContain('Locked in: Place 1.');
    expect(markup).toContain('This one stays put, even after a refresh.');
    expect(markup).not.toContain('Group fit');
  });

  it('renders personal results with post-gate place imagery and concise, non-raw-choice explanation', () => {
    const markup = renderToStaticMarkup(<MyResultsScreen results={personalFixture} onBackToVerdict={() => undefined} />);

    expect(markup).toContain('A view from Place 1');
    expect(markup).toContain('Why it rose');
    expect(markup).toContain('Travel effort 1/5');
    expect(markup).not.toContain('activity-by-activity');
  });
});
