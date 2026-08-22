import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { JourneyNav } from './components/JourneyNav.js';
import { canDisplayJourneyDestination, journeyDestinationForScreen, journeyDestinationFromHash, journeyHashFor, journeyItems } from './journeyNavigation.js';

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
});
