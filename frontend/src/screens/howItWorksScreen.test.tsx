import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HOW_IT_WORKS_HASH, howItWorksBackLabel, needsHowItWorksBriefing } from '../howItWorks.js';
import { HowItWorksScreen } from './HowItWorksScreen.js';

const travelers = [
  { id: 'dan', name: 'Dan', image: '/dan.png' },
  { id: 'james', name: 'James', image: '/james.png' },
  { id: 'john', name: 'John', image: '/john.png' },
  { id: 'matt', name: 'Matt', image: '/matt.png' },
  { id: 'peter', name: 'Peter', image: '/peter.png' },
];

describe('pre-game how-it-works briefing', () => {
  it('explains the fixed social process without live destination or result data', () => {
    const markup = renderToStaticMarkup(<HowItWorksScreen travelers={travelers} required backLabel="Back to character selection" onBack={() => undefined} onStartChoices={() => undefined} />);
    expect(markup).toContain('Dan picked 24 trips');
    expect(markup).toContain('You make A-or-B choices');
    expect(markup).toContain('The algorithm learns');
    expect(markup).toContain('THE GAME NOTICES');
    expect(markup).toContain('FIVE PRIVATE TOP FIVES');
    expect(markup).toContain('See how the group voted');
    expect(markup).toContain('Start my 32 choices');
    expect(markup).not.toContain('Oaxaca');
    expect(markup).not.toContain('Mexico');
    expect(markup).not.toContain('confidence');
    expect(markup).not.toContain('Your private top five is ready');
  });

  it('requires the briefing only before the first saved choice', () => {
    expect(needsHowItWorksBriefing(0)).toBe(true);
    expect(needsHowItWorksBriefing(1)).toBe(false);
    expect(needsHowItWorksBriefing(32)).toBe(false);
    expect(HOW_IT_WORKS_HASH).toBe('#how-it-works');
    expect(howItWorksBackLabel('atlas')).toBe('Back to the trip atlas');
  });
});
