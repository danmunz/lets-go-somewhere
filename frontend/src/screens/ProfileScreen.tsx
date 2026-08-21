import { useEffect, useRef } from 'react';
import type { PreferenceProfile } from '@lgs/shared';

type Props = {
  profile: PreferenceProfile;
  onOpenAtlas: () => void;
  onOpenWaiting: () => void;
  onOpenMyResults: () => void;
  revealOpen?: boolean;
  /** Set only for a deliberate route change; automatic entry must not steal focus. */
  focusHeading?: boolean;
};

const strengthCopy = { strong: 'You often picked', present: 'You also picked', open: 'Also in the mix' } as const;
const directionCopy = {
  'drawn-to': (label: string) => `When a choice included ${label}, you tended to choose it.`,
  'less-drawn-to': (label: string) => `Choices centered on ${label} came up less often in your picks.`,
} as const;
const dimensionIcon = {
  adventure: '↟', nature: '⌁', culture: '◈', food: '✦', history: '⌛', urban: '▦', novelty: '✧', physicalIntensity: '↗',
} as const;

/** Destination-free screen; it accepts only the safe shared profile contract. */
export function ProfileScreen({ profile, onOpenAtlas, onOpenWaiting, onOpenMyResults, revealOpen = false, focusHeading = false }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (focusHeading) headingRef.current?.focus();
  }, [focusHeading]);

  return (
    <main className="one-trip-screen profile-screen screen-enter" aria-labelledby="profile-title">
      <section className="profile-screen__intro">
      <p className="eyebrow">What you liked</p>
      <h1 id="profile-title" ref={headingRef} tabIndex={-1}>What your choices had in common.</h1>
      <p className="lede">You picked between 32 anonymous travel experiences. These cards show the kinds of moments you chose most often—not a final answer about where to go.</p>
      </section>
      <ol className="profile-explainer" aria-label="How this page works"><li><b>1</b>You picked experiences</li><li><b>2</b>We noticed what kept coming up</li><li><b>3</b>Your top five is ready</li></ol>
      <aside className={`private-shortlist-status ${revealOpen ? 'private-shortlist-status--revealed' : ''}`} aria-label="Your personal shortlist status">
        <p className="eyebrow">{revealOpen ? 'The envelope is open' : 'Your private top five is ready'}</p>
        <strong>{revealOpen ? 'Your top five is now part of the group conversation.' : 'You can see your own top five now.'}</strong>
        <span>{revealOpen ? 'You can now see how the group voted and everyone’s top five.' : 'Please keep it private for now. Everyone else’s picks stay hidden until all five people finish and Dan opens the envelope.'}</span>
        <button className="lgs-button lgs-button--secondary" onClick={onOpenMyResults}>See my top five</button>
      </aside>
      <ul className="profile-tiles">
        {profile.dimensions.map((dimension, index) => <li key={dimension.key} className={`profile-tile profile-tile--${dimension.strength} profile-tile--accent-${index % 4}`}>
          <p className="profile-tile__state">{strengthCopy[dimension.strength]}</p>
          <strong><i className="profile-tile__icon" aria-hidden="true">{dimensionIcon[dimension.key]}</i>{dimension.label}</strong>
          <span>{directionCopy[dimension.direction](dimension.label)}</span>
        </li>)}
      </ul>
      <div className="one-trip-actions">
        <button className="lgs-button lgs-button--primary" onClick={onOpenAtlas}>Open the trip atlas</button>
        <button className="lgs-button lgs-button--secondary" onClick={onOpenWaiting}>See who’s finished</button>
      </div>
      <p className="screen-reader-status" role="status" aria-live="polite">Your preference profile is ready.</p>
    </main>
  );
}
