import type { PersonalResultsResponse } from '@lgs/shared';
import { MediaImage } from '../components/MediaImage.js';
import { TravelEffortKey } from '../components/TravelEffortKey.js';

type Props = { results: PersonalResultsResponse; onBack: () => void; backLabel: string };

/** Caller-only shortlist; it never contains another traveler or the group ballot. */
export function MyResultsScreen({ results, onBack, backLabel }: Props) {
  const revealed = Boolean(results.snapshotId);
  return (
    <main className="one-trip-screen my-results-screen" aria-labelledby="my-take-title">
      <p className="eyebrow">{revealed ? 'My trip shortlist' : 'Your private trip shortlist'}</p>
      <h1 id="my-take-title">The places that fit your calls.</h1>
      <p className="lede">These are the five places most aligned with the experiences you chose. Use them as a conversation starter, not a final verdict.</p>
      {!revealed && <p className="my-results-screen__privacy-note">This is yours alone for now. The crew ballot and everyone else’s top five stay sealed until Dan opens the group reveal.</p>}
      <section className="personal-results-grid" aria-label="Your top five places">
        {results.results.map((result) => <article className="personal-result-card" key={result.id}>
          <MediaImage src={result.imageUrl} alt={`A view from ${result.name}`} fallbackLabel="Photo unavailable" />
          <div className="personal-result-card__body">
            <p className="eyebrow">#{result.rank} on your shortlist</p>
            <h2>{result.name}, {result.country}</h2>
            <p>{result.context.novemberWeather} · Travel effort {result.context.travelFriction}/5</p>
            <details>
              <summary>Why it rose</summary>
              <p>Your calls repeatedly lined up with <strong>{result.explanation.themes.join(', ')}</strong> across {result.explanation.encounteredActivityCount} moments you encountered.</p>
            </details>
          </div>
        </article>)}
      </section>
      <TravelEffortKey />
      <button className="lgs-button lgs-button--secondary" onClick={onBack}>{backLabel}</button>
    </main>
  );
}
