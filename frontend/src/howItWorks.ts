import type { AppScreen } from './types.js';

export const HOW_IT_WORKS_HASH = '#how-it-works';

/** The briefing is deliberately required only until the first real choice is saved. */
export function needsHowItWorksBriefing(comparisons: number): boolean {
  return comparisons === 0;
}

/**
 * The briefing is a post-sign-in aid, never an onboarding shortcut. The required
 * first-round briefing remains reachable after account confirmation; the floating
 * help control begins only once the traveler is in their journey.
 */
export function canOpenHowItWorksHelp(screen: AppScreen, hasSignedInTraveler: boolean): boolean {
  return hasSignedInTraveler && (screen === 'comparison' || screen === 'completed-transition');
}

export function howItWorksBackLabel(screen: AppScreen): string {
  const labels: Partial<Record<AppScreen, string>> = {
    welcome: 'welcome',
    character: 'character selection',
    comparison: 'your choices',
    profile: 'what you liked',
    atlas: 'all 24 places',
    waiting: 'who’s finished',
    verdict: 'how the group voted',
    'my-results': 'your top five',
  };
  return `Back to ${labels[screen] ?? 'your journey'}`;
}
