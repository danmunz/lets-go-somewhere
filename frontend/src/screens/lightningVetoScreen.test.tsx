import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LIGHTNING_MODEL_VERSION, LIGHTNING_WORKING_ORDER_RESULT_VERSION, type LightningDestinationBrief, type LightningGroupResultsResponse, type LightningPersonalResults, type RosterUser } from '@lgs/shared';
import { LightningPersonalResultsScreen, LightningVerdictScreen, LightningVetoScreen } from './LightningScreens.js';

const users: readonly RosterUser[] = ['dan', 'james', 'john', 'matt', 'peter'];
const destinations: LightningDestinationBrief[] = Array.from({ length: 24 }, (_, index) => ({
  id: `place-${index + 1}`,
  name: `Place ${index + 1}`,
  country: 'Exampleland',
  imageUrl: `/media/lightning/${index + 1}.webp`,
  pitch: 'A concrete trip option.',
  highlights: [{ title: 'A good day', detail: 'A specific thing to do.' }],
  weather: { typicalHighF: 72, typicalLowF: 55, note: 'Mild weather.' },
  travel: { effort: 2, summary: 'One easy flight.', fares: { dc: 400, nyc: 420, sfo: 580 }, fareNote: 'Planning estimate.' },
  caveat: 'Book ahead.',
  researchedAt: '2026-08-23',
  sources: [],
}));
const tiers = destinations.map((destination, index) => ({ rankStart: index + 1, rankEnd: index + 1, destinationIds: [destination.id] }));
const baseResults: LightningPersonalResults = {
  resultVersion: LIGHTNING_WORKING_ORDER_RESULT_VERSION,
  modelVersion: LIGHTNING_MODEL_VERSION,
  contentVersion: 'test',
  destinations,
  ranking: { workingOrder: destinations.map((destination) => destination.id), clearBreaksAfter: [5, 10], topFiveGroups: { likelyTopFive: destinations.slice(0, 5).map((destination) => destination.id), possibleTopFive: destinations.slice(5, 8).map((destination) => destination.id), unlikelyTopFive: destinations.slice(8).map((destination) => destination.id) }, privateEvidence: destinations.map((destination, index) => ({ destinationId: destination.id, workingRank: index + 1, topFivePercent: index < 5 ? 70 : 10, rankRange: { low: Math.max(1, index), high: Math.min(24, index + 3) } })) },
  comparisonTrail: [],
  vetoes: { submitted: false, destinationIds: [] },
};
const vetoIds = [destinations[21]!.id, destinations[22]!.id];
const groupResults: LightningGroupResultsResponse = {
  snapshotId: 'snapshot',
  resultVersion: LIGHTNING_WORKING_ORDER_RESULT_VERSION,
  modelVersion: LIGHTNING_MODEL_VERSION,
  contentVersion: 'test',
  destinations,
  group: destinations.map((destination, index) => ({
    rankStart: index + 1,
    rankEnd: index + 1,
    destinationId: destination.id,
    bordaPoints: 24 - index,
    firstPlaceVotes: 0,
    topFiveSupport: index < 5 ? 1 : 0,
    supporters: ['dan'],
    vetoedBy: destination.id === destinations[22]!.id ? ['james', 'matt'] : [],
  })),
  members: users.map((user) => ({
    user,
    workingOrder: destinations.map((destination, index) => destinations[(index + users.indexOf(user)) % destinations.length]!.id),
    clearBreaksAfter: baseResults.ranking.clearBreaksAfter,
    topFiveGroups: baseResults.ranking.topFiveGroups,
    vetoedDestinationIds: user === 'james' || user === 'matt' ? [destinations[22]!.id] : [],
  })),
};

describe('Lightning Round veto presentation', () => {
  it('presents a reverse-ranked, optional veto screen with a four-place limit', () => {
    const markup = renderToStaticMarkup(<LightningVetoScreen results={baseResults} onSubmit={async () => true} />);
    expect(markup).toContain('Any places you would <em>rule out?</em>');
    expect(markup).toContain('aria-label="0"');
    expect(markup).toContain('Your list, lowest to highest.');
    expect(markup.indexOf('#24')).toBeLessThan(markup.indexOf('#1'));
    expect(markup).toContain('Continue with no vetoes');
    expect(markup).toContain('Veto this place');
  });

  it('adds saved personal vetoes without changing the ordered list', () => {
    const markup = renderToStaticMarkup(<LightningPersonalResultsScreen results={{ ...baseResults, vetoes: { submitted: true, destinationIds: vetoIds } }} onOpenWaiting={() => undefined} onOpenVeto={() => undefined} />);
    expect(markup).toContain('Your list and vetoes are saved.');
    expect(markup).toContain('Places you would rule out.');
    expect(markup).toContain('× Place 22');
    expect(markup).toContain('× Vetoed');
    expect(markup).toContain('All 24 places, in your order.');
    expect(markup).toContain('How sure is this?');
    expect(markup).toContain('Chance of top five');
    expect(markup).toContain('Clearer break below');
  });

  it('uses red X veto cells and group warnings without changing the published tally', () => {
    const markup = renderToStaticMarkup(<LightningVerdictScreen results={groupResults} />);
    expect(markup).toContain('× But James and Matt vetoed');
    expect(markup).toContain('A red X means that traveler vetoed the place.');
    expect(markup).toContain('aria-label="James vetoed Place 23"');
    expect(markup).toContain('24 points');
    expect(markup).toContain('More often near the top');
    expect(markup).toContain('Hover or focus a place to find it across every list.');
    expect(markup).toContain('data-destination-id="place-1"');
    expect(markup).not.toContain('topFivePercent');
  });
});
