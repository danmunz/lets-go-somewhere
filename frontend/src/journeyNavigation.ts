import type { AppScreen } from './types.js';

/** Post-completion destinations only. The server remains the final authority. */
export type JourneyDestination = 'profile' | 'shortlist' | 'atlas' | 'waiting' | 'verdict';
export type LightningDestination = 'entry' | 'list' | 'veto' | 'waiting' | 'verdict' | 'help';
export type LightningNavigationDestination = Exclude<LightningDestination, 'entry' | 'veto' | 'help'>;

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

const lightningItemByDestination: Record<LightningNavigationDestination, {
  destination: LightningNavigationDestination;
  label: string;
  description: string;
  hash: string;
}> = {
  list: {
    destination: 'list',
    label: 'My full list',
    description: 'Your complete direct ranking and vetoes',
    hash: '#lightning-list',
  },
  waiting: {
    destination: 'waiting',
    label: 'Who’s ready',
    description: 'See who has finished this round',
    hash: '#lightning-ready',
  },
  verdict: {
    destination: 'verdict',
    label: 'How everyone ranked',
    description: 'Everyone’s places, votes, and vetoes',
    hash: '#lightning-reveal',
  },
};

const lightningHashByDestination: Record<LightningDestination, string> = {
  entry: '#lightning',
  list: '#lightning-list',
  veto: '#lightning-veto',
  waiting: '#lightning-ready',
  verdict: '#lightning-reveal',
  help: '#lightning-help',
};

export const lightningItem = (destination: LightningNavigationDestination) => lightningItemByDestination[destination];

/** The full Lightning menu appears only once the required veto save is complete. */
export const lightningItems = (revealOpen: boolean) => {
  const destinations: readonly LightningNavigationDestination[] = revealOpen
    ? ['verdict', 'list', 'waiting']
    : ['list', 'waiting'];
  return destinations.map((destination) => lightningItem(destination));
};

export const lightningHashFor = (destination: LightningDestination) => lightningHashByDestination[destination];

export const lightningDestinationFromHash = (hash: string): LightningDestination | undefined => (
  (Object.entries(lightningHashByDestination) as [LightningDestination, string][])
    .find(([, candidate]) => candidate === hash)?.[0]
);

export const lightningNavigationDestinationForScreen = (screen: AppScreen): LightningNavigationDestination | undefined => {
  if (screen === 'lightning-results') return 'list';
  if (screen === 'lightning-waiting') return 'waiting';
  if (screen === 'lightning-verdict') return 'verdict';
  return undefined;
};

export const lightningIsFocusScreen = (screen: AppScreen) => (
  screen === 'lightning-intro' || screen === 'lightning-comparison' || screen === 'lightning-veto'
);

/**
 * This is only a client-side presentation guard. A requested reveal is still
 * verified by the group-results endpoint so a freshly opened envelope works
 * even before a background status refresh completes.
 */
export const canDisplayJourneyDestination = (destination: JourneyDestination, revealOpen: boolean) => (
  destination !== 'verdict' || revealOpen
);
