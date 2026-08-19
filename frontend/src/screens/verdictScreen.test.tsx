import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PersonalResultsResponse, RosterUser, TransparentGroupResultsResponse } from '@lgs/shared';
import { MyResultsScreen } from './MyResultsScreen.js';
import { VerdictScreen } from './VerdictScreen.js';

const users: RosterUser[] = ['dan', 'james', 'john', 'matt', 'peter'];
const names: Record<RosterUser, string> = { dan: 'Dan', james: 'James', john: 'John', matt: 'Matt', peter: 'Peter' };
const place = (index: number) => ({ rank: index + 1, id: `place-${index + 1}`, name: `Place ${index + 1}`, country: 'Exampleland', imageUrl: `/media/destinations/place-${index + 1}.webp`, points: 15 - index, firstPlaceVotes: index === 0 ? 2 : 0, topFiveSupporters: users.slice(0, Math.max(1, 5 - index)), context: { novemberWeather: 'Mild and bright', travelFriction: index + 1 } });
const group = Array.from({ length: 5 }, (_, index) => place(index));
const resultFixture: TransparentGroupResultsResponse = {
  snapshotId: 'snapshot-test', modelVersion: 'baseline-test', displayMode: 'shared-shortlist', group,
  members: users.map((user) => ({ user, topFive: group.map((item, index) => ({ rank: index + 1, id: item.id, name: item.name, imageUrl: item.imageUrl })) })),
  finalistRanks: group.map((item, index) => ({ destinationId: item.id, ranks: users.map((user, userIndex) => ({ user, rank: userIndex === 4 && index === 4 ? 'outside-top-five' as const : index + 1 })) })),
  insights: [{ kind: 'split-destination', title: 'A lively split', body: 'Dan and James placed Place 1 in their top five; three travelers did not.', destinationIds: ['place-1'], users: ['dan', 'james'] }],
  decisions: [{ user: 'dan', choice: 'place-1', createdAt: '2026-08-18T12:00:00.000Z' }],
};
const personalFixture: PersonalResultsResponse = { snapshotId: 'snapshot-test', modelVersion: 'baseline-test', confidence: { label: 'clear-favorite', summary: 'Your first place has a clear pull.' }, profile: { headline: 'A curious route', synthesis: 'Example', confidenceLabel: 'clear-shape', dimensions: [] }, results: group.map((item, index) => ({ ...item, fitLabel: index === 0 ? 'strong-match' as const : 'contender' as const, interval: { low: .4, high: .8 }, explanation: { themes: ['nature', 'novelty'], matchedActivityCount: 3, encounteredActivityCount: 7 } })) };
const renderVerdict = (results = resultFixture) => renderToStaticMarkup(<VerdictScreen results={results} currentUser="dan" travelerName={(user) => names[user]} avatarFor={() => '/assets/traveler.png'} onOpenMyResults={() => undefined} onRecordDecision={async () => resultFixture.decisions[0]!} />);

describe('transparent social reveal', () => {
  it('shows the published key, five personal maps, matrix language, and immutable next step', () => {
    const markup = renderVerdict();
    expect(markup).toContain('How the crew ballot works');
    expect(markup).toContain('Outside top five');
    expect(markup).toContain('Everyone’s top five.');
    expect(markup).toContain('Locked in: champion Place 1.');
    expect(markup).toContain('This one stays put, even after a refresh.');
    expect(markup).not.toContain('Group fit'); expect(markup).not.toContain('6+'); expect(markup).not.toContain('normalized');
  });

  it('renders no-consensus as five first instincts without crowning an arithmetic leader', () => {
    const markup = renderVerdict({ ...resultFixture, displayMode: 'no-consensus' });
    expect(markup).toContain('No automatic consensus—this is a true group decision.');
    expect(markup).toContain('Dan’s #1'); expect(markup).toContain('Peter’s #1');
    expect(markup).not.toContain('The crew has a clear shared pull');
  });

  it('gives an exact shared first equal language', () => {
    const tied = resultFixture.group.map((item, index) => ({ ...item, rank: index < 2 ? 1 : index }));
    const markup = renderVerdict({ ...resultFixture, displayMode: 'near-tie', group: tied });
    expect(markup).toContain('A dead heat.'); expect(markup).toContain('#1 · tied');
  });

  it('renders personal results with post-gate place imagery and concise, non-raw-choice explanation', () => {
    const markup = renderToStaticMarkup(<MyResultsScreen results={personalFixture} onBackToVerdict={() => undefined} />);
    expect(markup).toContain('A view from Place 1'); expect(markup).toContain('Why it rose'); expect(markup).not.toContain('activity-by-activity');
  });
});
