import { useEffect, useRef } from 'react';
import type { PreferenceProfile, RosterUser } from '@lgs/shared';
import { MoodPortrait } from '../components/MoodPortrait.js';

type Props = {
  profile: PreferenceProfile;
  traveler: RosterUser;
  onOpenMyResults: () => void;
  revealOpen?: boolean;
  /** Set only for a deliberate route change; automatic entry must not steal focus. */
  focusHeading?: number;
};

const cardEyebrow = (index: number, strength: PreferenceProfile['dimensions'][number]['strength']) => {
  if (index === 0) return 'A strong pull';
  if (index === 1) return 'Another strong pull';
  return strength === 'present' ? 'Part of your mix' : 'A smaller signal';
};
const cardSummary = (label: string, direction: PreferenceProfile['dimensions'][number]['direction'], index: number) => {
  if (direction === 'less-drawn-to') return `${label} came up less often in the experiences you chose.`;
  if (index === 0) return `${label} kept showing up in the choices you went for.`;
  if (index === 1) return `You kept coming back to experiences with ${label.toLowerCase()}.`;
  return `When it appeared, ${label.toLowerCase()} usually worked for you.`;
};
/** Destination-free screen; it accepts only the safe shared profile contract. */
export function ProfileScreen({ profile, traveler, onOpenMyResults, revealOpen = false, focusHeading }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (focusHeading) headingRef.current?.focus();
  }, [focusHeading]);

  return (
    <main className="one-trip-screen profile-screen screen-enter" aria-labelledby="profile-title">
      <section className="profile-screen__intro">
      <p className="eyebrow">What you liked</p>
      <h1 id="profile-title" ref={headingRef} tabIndex={-1}>What your choices had in common.</h1>
      <p className="lede">Based on your 32 head-to-head choices, these cards show the kinds of experiences you chose most often.</p>
      </section>
      <aside className={`private-shortlist-status ${revealOpen ? 'private-shortlist-status--revealed' : ''}`} aria-label="Your personal top five status">
        <span className="private-shortlist-status__icon" aria-hidden="true">{revealOpen ? '✦' : '⌁'}</span>
        <div className="private-shortlist-status__copy">
          <p className="eyebrow">{revealOpen ? 'The group reveal is open' : 'Your top five is ready'}</p>
          <p><strong>{revealOpen ? 'Your picks are now part of the group conversation.' : 'You can see your picks now.'}</strong> {revealOpen ? 'See how the group voted and everyone’s top five.' : 'Keep them private until everyone has finished.'}</p>
        </div>
        <button className="lgs-button lgs-button--secondary" onClick={onOpenMyResults}>See my top five</button>
      </aside>
      <ul className="profile-tiles">
        {profile.dimensions.map((dimension, index) => <li key={dimension.key} className={`profile-tile profile-tile--${dimension.strength} profile-tile--accent-${index % 4} ${index < 2 ? 'profile-tile--lead' : ''}`}>
          <div className="profile-tile__heading">
            {index >= 2 && <MoodPortrait traveler={traveler} dimension={dimension.key} decorative className="profile-tile__mood" />}
            <div><p className="profile-tile__state">{cardEyebrow(index, dimension.strength)}</p><strong>{dimension.label}</strong></div>
          </div>
          <p className="profile-tile__summary">{cardSummary(dimension.label, dimension.direction, index)}</p>
          {index < 2 && <div className="profile-tile__portrait-frame" aria-hidden="true">
            <MoodPortrait traveler={traveler} dimension={dimension.key} size="lead" decorative />
          </div>}
        </li>)}
      </ul>
      <p className="screen-reader-status" role="status" aria-live="polite">Your preference profile is ready.</p>
    </main>
  );
}
