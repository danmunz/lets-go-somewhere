import type { PersonalResultsResponse } from '@lgs/shared';
import { MediaImage } from '../components/MediaImage.js';
import { TravelEffortKey } from '../components/TravelEffortKey.js';

type Props = { results: PersonalResultsResponse; onBackToVerdict: () => void };

/** Post-gate-only presentation; it has no ranking or explanation calculation. */
export function MyResultsScreen({ results, onBackToVerdict }: Props) {
  return (
    <main className="one-trip-screen my-results-screen" aria-labelledby="my-take-title">
      <p className="eyebrow">My trip shortlist</p>
      <h1 id="my-take-title">The places that fit your calls.</h1>
      <p className="lede">This is a conversation starter drawn from the choices you made—not a final verdict. It opens only after the group envelope.</p>
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
      <button className="lgs-button lgs-button--secondary" onClick={onBackToVerdict}>Back to the verdict</button>
    </main>
  );
}
