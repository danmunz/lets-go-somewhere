import type { PreferenceProfile, RosterUser } from '@lgs/shared';
import { MoodPortrait } from './MoodPortrait.js';

type Props = { complete?: boolean; traveler?: RosterUser; profile?: PreferenceProfile };

/**
 * An intentional bridge after the final blind choice. It does not claim that
 * a calculation is happening and does not delay a later action.
 */
export function CompletedTransition({ complete = false, traveler, profile }: Props) {
  return (
    <section className="completed-transition" role="status" aria-live="polite" aria-atomic="true">
      <p className="eyebrow">Choices complete</p>
      <h1>{complete ? 'Your choices are in.' : 'Putting your choices together…'}</h1>
      {complete && traveler && profile && <div className="completed-transition__moods" aria-label="The things you liked most">
        {profile.dimensions.slice(0, 2).map((dimension) => <span key={dimension.key}><MoodPortrait traveler={traveler} dimension={dimension.key} decorative /><i>{dimension.label}</i></span>)}
      </div>}
    </section>
  );
}
