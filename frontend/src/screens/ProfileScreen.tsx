import { useEffect, useRef } from 'react';
import type { PreferenceProfile } from '@lgs/shared';

type Props = {
  profile: PreferenceProfile;
  onOpenAtlas: () => void;
  onOpenWaiting: () => void;
  /** Set only for a deliberate route change; automatic entry must not steal focus. */
  focusHeading?: boolean;
};

const strengthCopy = { strong: 'Strong pull', present: 'Present', open: 'Still open' } as const;
const directionCopy = {
  'drawn-to': (label: string) => `${label} kept pulling you in.`,
  'less-drawn-to': (label: string) => `${label} was less often your first instinct.`,
} as const;

/** Destination-free screen; it accepts only the safe shared profile contract. */
export function ProfileScreen({ profile, onOpenAtlas, onOpenWaiting, focusHeading = false }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (focusHeading) headingRef.current?.focus();
  }, [focusHeading]);

  return (
    <main className="one-trip-screen profile-screen screen-enter" aria-labelledby="profile-title">
      <section className="profile-screen__intro">
        <p className="eyebrow">Your trip shape</p>
        <h1 id="profile-title" ref={headingRef} tabIndex={-1}>{profile.headline}</h1>
        <p className="lede">{profile.synthesis}</p>
        <p className="profile-screen__confidence">
          {profile.confidenceLabel === 'clear-shape'
            ? 'A clear trip shape is coming through.'
            : 'Your trip shape is still taking form — that’s useful too.'}
        </p>
      </section>
      <ul className="profile-tiles">
        {profile.dimensions.map((dimension, index) => <li key={dimension.key} className={`profile-tile profile-tile--${dimension.strength} profile-tile--accent-${index % 4}`}>
          <p className="profile-tile__state">{strengthCopy[dimension.strength]}</p>
          <strong>{dimension.label} — {dimension.direction === 'drawn-to' ? 'drawn to' : 'less drawn to'}</strong>
          <span>{directionCopy[dimension.direction](dimension.label)}</span>
          <i aria-hidden="true" />
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
