import type { AppScreen } from './types.js';

/** Post-completion destinations only. The server remains the final authority. */
export type JourneyDestination = 'profile' | 'shortlist' | 'atlas' | 'waiting' | 'verdict';

export type JourneyNavigationItem = {
  destination: JourneyDestination;
  label: string;
  description: string;
  hash: string;
};

const itemByDestination: Record<JourneyDestination, JourneyNavigationItem> = {
  profile: {
    destination: 'profile',
    label: 'What I liked',
    description: 'Your choices, in plain English',
    hash: '#rhythm',
  },
  shortlist: {
    destination: 'shortlist',
    label: 'My top five',
    description: 'Private until everyone is done',
    hash: '#shortlist',
  },
  atlas: {
    destination: 'atlas',
    label: 'All 24 places',
    description: 'Browse every place in the running',
    hash: '#atlas',
  },
  waiting: {
    destination: 'waiting',
    label: 'Who’s finished',
    description: 'See who is ready',
    hash: '#crew',
  },
  verdict: {
    destination: 'verdict',
    label: 'How the group voted',
    description: 'Everyone’s top fives and the tally',
    hash: '#reveal',
  },
};

const sealedDestinations: readonly JourneyDestination[] = ['profile', 'shortlist', 'atlas', 'waiting'];

export const journeyItem = (destination: JourneyDestination) => itemByDestination[destination];

export const journeyItems = (revealOpen: boolean): readonly JourneyNavigationItem[] => {
  const destinations: readonly JourneyDestination[] = revealOpen ? ['verdict', ...sealedDestinations] : sealedDestinations;
  return destinations.map((destination) => journeyItem(destination));
};

export const journeyHashFor = (destination: JourneyDestination) => journeyItem(destination).hash;

export const journeyDestinationFromHash = (hash: string): JourneyDestination | undefined => (
  Object.values(itemByDestination).find((item) => item.hash === hash)?.destination
);

export const journeyDestinationForScreen = (screen: AppScreen): JourneyDestination | undefined => {
  if (screen === 'profile') return 'profile';
  if (screen === 'my-results') return 'shortlist';
  if (screen === 'atlas') return 'atlas';
  if (screen === 'waiting') return 'waiting';
  if (screen === 'verdict') return 'verdict';
  return undefined;
};

export const isPostCompletionScreen = (screen: AppScreen) => Boolean(journeyDestinationForScreen(screen));

/**
 * This is only a client-side presentation guard. A requested reveal is still
 * verified by the group-results endpoint so a freshly opened envelope works
 * even before a background status refresh completes.
 */
export const canDisplayJourneyDestination = (destination: JourneyDestination, revealOpen: boolean) => (
  destination !== 'verdict' || revealOpen
);
