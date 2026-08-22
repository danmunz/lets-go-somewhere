import { readFile } from 'node:fs/promises';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProfileScreen } from './screens/ProfileScreen.js';
import { createVerdictFixture } from './screens/verdictFixtures.js';
import { VerdictScreen } from './screens/VerdictScreen.js';

const profile = {
  headline: 'What you liked', synthesis: 'Example', dimensions: [
    { key: 'adventure' as const, label: 'Big adventures', strength: 'strong' as const, direction: 'drawn-to' as const },
    { key: 'food' as const, label: 'Local food', strength: 'present' as const, direction: 'drawn-to' as const },
  ],
};

describe('mood companion usage', () => {
  it('uses only the current traveler’s portraits on the personal profile', () => {
    const markup = renderToStaticMarkup(<ProfileScreen profile={profile} traveler="dan" onOpenMyResults={() => undefined} />);
    expect(markup).toContain('/moods/dan/adventure.webp');
    expect(markup).toContain('/moods/dan/food.webp');
    expect(markup).not.toContain('/moods/james/');
  });

  it('adds people’s safe post-reveal moods to the group view', () => {
    const markup = renderToStaticMarkup(<VerdictScreen results={createVerdictFixture('shared-shortlist', 'two-camps')} currentUser="dan" travelerName={(user) => user} avatarFor={() => '/avatar.png'} onOpenMyResults={() => undefined} />);
    expect(markup).toContain('They liked');
    expect(markup).toContain('/moods/dan/');
    expect(markup).toContain('/moods/james/');
  });

  it('keeps blind choice cards free of mood portraits', async () => {
    const main = await readFile(new URL('./main.tsx', import.meta.url), 'utf8');
    const comparison = main.slice(main.indexOf("if (screen !== 'comparison')"));
    expect(comparison).not.toContain('MoodPortrait');
  });
});
