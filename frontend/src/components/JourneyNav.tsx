export type JourneyDestination = 'profile' | 'shortlist' | 'atlas' | 'waiting' | 'verdict';

type Props = {
  active: JourneyDestination;
  revealOpen: boolean;
  onNavigate: (destination: JourneyDestination) => void;
};

const preRevealItems: readonly [JourneyDestination, string][] = [
  ['profile', 'What I liked'],
  ['shortlist', 'My top five'],
  ['atlas', 'Trip atlas'],
  ['waiting', 'Who’s finished'],
];

/** Stable post-completion navigation. Server gates remain the authority. */
export function JourneyNav({ active, revealOpen, onNavigate }: Props) {
  const items = revealOpen
    ? ([['verdict', 'Group reveal'], ...preRevealItems] as const)
    : preRevealItems;
  return <nav className="journey-nav" aria-label="Your trip journey">
    {items.map(([destination, label]) => <button key={destination} type="button" onClick={() => onNavigate(destination)} aria-current={active === destination ? 'page' : undefined}>{label}</button>)}
  </nav>;
}
