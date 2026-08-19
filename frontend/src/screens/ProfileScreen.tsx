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

const strengthCopy = { strong: 'You often chose', present: 'Also came through', open: 'Part of your mix' } as const;
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
        <p className="eyebrow">Your trip rhythm</p>
        <h1 id="profile-title" ref={headingRef} tabIndex={-1}>Here’s what your choices suggest you enjoy.</h1>
        <p className="lede">Across 32 anonymous experience matchups, these themes appeared most often in the options you picked. They describe the kinds of days that appeal to you—not a final destination verdict.</p>
      </section>
      <ol className="profile-explainer" aria-label="How this page works"><li><b>1</b>You picked experiences</li><li><b>2</b>We noticed recurring themes</li><li><b>3</b>Your top five is ready to explore</li></ol>
      <aside className={`private-shortlist-status ${revealOpen ? 'private-shortlist-status--revealed' : ''}`} aria-label="Your personal shortlist status">
        <p className="eyebrow">{revealOpen ? 'The envelope is open' : 'Your private trip shortlist is ready'}</p>
        <strong>{revealOpen ? 'Your top five is now part of the crew conversation.' : 'You can explore your own top five now.'}</strong>
        <span>{revealOpen ? 'The group ballot and everyone’s rankings are available in the group reveal.' : 'Keep it to yourself for now—the group ballot and everyone else’s rankings stay sealed until the crew finishes and Dan opens the reveal.'}</span>
        <button className="lgs-button lgs-button--secondary" onClick={onOpenMyResults}>{revealOpen ? 'See my top five' : 'Explore my private shortlist'}</button>
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
        <button className="lgs-button lgs-button--secondary" onClick={onOpenWaiting}>See the crew’s progress</button>
      </div>
      <p className="screen-reader-status" role="status" aria-live="polite">Your preference profile is ready.</p>
    </main>
  );
}
