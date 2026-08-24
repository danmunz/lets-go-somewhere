import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LIGHTNING_MODEL_VERSION, type LightningDestinationBrief, type LightningGroupResults, type LightningPersonalResults, type RosterUser } from '@lgs/shared';
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
  modelVersion: LIGHTNING_MODEL_VERSION,
  contentVersion: 'test',
  destinations,
  tiers,
  comparisonTrail: [],
  vetoes: { submitted: false, destinationIds: [] },
};
const vetoIds = [destinations[21]!.id, destinations[22]!.id];
const groupResults: LightningGroupResults = {
  snapshotId: 'snapshot',
  modelVersion: LIGHTNING_MODEL_VERSION,
  contentVersion: 'test',
  destinations,
  group: destinations.map((destination, index) => ({
    rankStart: index + 1,
    rankEnd: index + 1,
    destinationId: destination.id,
    bordaHalfPoints: (24 - index) * 2,
    firstPlaceVotes: 0,
    supporters: ['dan'],
    vetoedBy: destination.id === destinations[22]!.id ? ['james', 'matt'] : [],
  })),
  members: users.map((user) => ({
    user,
    tiers,
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
  });

  it('uses red X veto cells and group warnings without changing the published tally', () => {
    const markup = renderToStaticMarkup(<LightningVerdictScreen results={groupResults} />);
    expect(markup).toContain('× But James and Matt vetoed');
    expect(markup).toContain('A red X means that traveler vetoed the place.');
    expect(markup).toContain('aria-label="James vetoed Place 23"');
    expect(markup).toContain('24 points');
  });
});
