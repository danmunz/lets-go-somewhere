import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { JourneyNav, LightningFocusHeader, LightningNav } from './components/JourneyNav.js';
import { canDisplayJourneyDestination, journeyDestinationForScreen, journeyDestinationFromHash, journeyHashFor, journeyItems, lightningDestinationFromHash, lightningHashFor, lightningItems, lightningNavigationDestinationForScreen } from './journeyNavigation.js';

describe('post-completion navigation policy', () => {
  it('keeps the group result sealed until the envelope is open', () => {
    expect(journeyItems(false).map((item) => item.label)).toEqual(['What I liked', 'My top five', 'All 24 places', 'Who’s finished']);
    expect(journeyItems(true).map((item) => item.label)).toEqual(['How the group voted', 'What I liked', 'My top five', 'All 24 places', 'Who’s finished']);
    expect(canDisplayJourneyDestination('verdict', false)).toBe(false);
    expect(canDisplayJourneyDestination('verdict', true)).toBe(true);
  });

  it('has one canonical hash and active destination for each finished screen', () => {
    expect(journeyHashFor('profile')).toBe('#rhythm');
    expect(journeyDestinationFromHash('#shortlist')).toBe('shortlist');
    expect(journeyDestinationFromHash('#unknown')).toBeUndefined();
    expect(journeyDestinationForScreen('atlas')).toBe('atlas');
    expect(journeyDestinationForScreen('comparison')).toBeUndefined();
  });

  it('renders desktop and mobile controls with the same allowed destinations', () => {
    const markup = renderToStaticMarkup(<JourneyNav active="atlas" revealOpen={false} onNavigate={() => undefined} onOpenHowItWorks={() => undefined} />);
    expect(markup).toContain('What I liked');
    expect(markup).toContain('All 24 places');
    expect(markup).toContain('How it works');
    expect(markup).toContain('aria-current="page"');
    expect(markup).not.toContain('How the group voted');
  });

  it('keeps Lightning destinations separate and reveals its group result only after the second envelope opens', () => {
    expect(lightningItems(false).map((item) => item.label)).toEqual(['My full list', 'Who’s ready']);
    expect(lightningItems(true).map((item) => item.label)).toEqual(['How everyone ranked', 'My full list', 'Who’s ready']);
    expect(lightningHashFor('entry')).toBe('#lightning');
    expect(lightningDestinationFromHash('#lightning-veto')).toBe('veto');
    expect(lightningNavigationDestinationForScreen('lightning-verdict')).toBe('verdict');
    expect(lightningNavigationDestinationForScreen('lightning-veto')).toBeUndefined();
  });

  it('renders a dedicated Lightning navigator and focused choice header without original destination links', () => {
    const nav = renderToStaticMarkup(<LightningNav active="waiting" revealOpen={false} onNavigate={() => undefined} onOpenRoundOne={() => undefined} onOpenLightning={() => undefined} onOpenHelp={() => undefined} />);
    const focus = renderToStaticMarkup(<LightningFocusHeader status="18 of 48 choices" onOpenRoundOne={() => undefined} />);
    expect(nav).toContain('Lightning Round');
    expect(nav).toContain('Round 1');
    expect(nav).toContain('My full list');
    expect(nav).not.toContain('What I liked');
    expect(focus).toContain('18 of 48 choices');
    expect(focus).toContain('Round 1 results');
    expect(focus).not.toContain('Menu');
  });
});
