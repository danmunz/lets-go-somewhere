import type { AppScreen } from './types.js';

export const HOW_IT_WORKS_HASH = '#how-it-works';

/** The briefing is deliberately required only until the first real choice is saved. */
export function needsHowItWorksBriefing(comparisons: number): boolean {
  return comparisons === 0;
}

export function howItWorksBackLabel(screen: AppScreen): string {
  const labels: Partial<Record<AppScreen, string>> = {
    welcome: 'welcome',
    character: 'character selection',
    comparison: 'your choices',
    profile: 'what you liked',
    atlas: 'the trip atlas',
    waiting: 'who’s finished',
    verdict: 'the group reveal',
    'my-results': 'your top five',
  };
  return `Back to ${labels[screen] ?? 'your journey'}`;
}
