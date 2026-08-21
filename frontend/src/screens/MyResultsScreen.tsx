import type { PersonalResultsResponse } from '@lgs/shared';
import { MediaImage } from '../components/MediaImage.js';
import { TravelEffortKey } from '../components/TravelEffortKey.js';

type Props = { results: PersonalResultsResponse; onBack: () => void; backLabel: string };

/** Caller-only shortlist; it never contains another traveler or the group ballot. */
export function MyResultsScreen({ results, onBack, backLabel }: Props) {
  const revealed = Boolean(results.snapshotId);
  return (
    <main className="one-trip-screen my-results-screen" aria-labelledby="my-take-title">
      <p className="eyebrow">{revealed ? 'Your top five' : 'Your private top five'}</p>
      <h1 id="my-take-title">Five places that match what you picked.</h1>
      <p className="lede">These are the places that best match the experiences you chose. They are a starting point for the conversation, not the final decision.</p>
      {!revealed && <p className="my-results-screen__privacy-note">These are yours to see, but please keep them private for now. The group’s results and everyone else’s top five stay hidden until Dan opens the envelope.</p>}
      <section className="personal-results-grid" aria-label="Your top five places">
        {results.results.map((result) => <article className="personal-result-card" key={result.id}>
          <MediaImage src={result.imageUrl} alt={`A view from ${result.name}`} fallbackLabel="Photo unavailable" />
          <div className="personal-result-card__body">
            <p className="eyebrow">#{result.rank} on your top five</p>
            <h2>{result.name}, {result.country}</h2>
            <p>{result.context.novemberWeather} · Travel effort {result.context.travelFriction}/5</p>
            <details>
              <summary>Why it fits</summary>
              <p>You often chose experiences with <strong>{result.explanation.themes.join(', ')}</strong> when they appeared in {result.explanation.encounteredActivityCount} of your choices.</p>
            </details>
          </div>
        </article>)}
      </section>
      <TravelEffortKey />
      <button className="lgs-button lgs-button--secondary" onClick={onBack}>{backLabel}</button>
    </main>
  );
}
