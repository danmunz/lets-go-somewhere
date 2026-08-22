import { useEffect, useRef } from 'react';
import type { PersonalResultsResponse, RosterUser } from '@lgs/shared';
import { MediaImage } from '../components/MediaImage.js';
import { MoodPortrait } from '../components/MoodPortrait.js';
import { TravelEffortKey } from '../components/TravelEffortKey.js';
import { moodKeyFromTheme, moodLabel } from '../moods.js';

type Props = { results: PersonalResultsResponse; traveler: RosterUser; focusHeading?: number };

/** Caller-only shortlist; it never contains another traveler or the group ballot. */
export function MyResultsScreen({ results, traveler, focusHeading }: Props) {
  const revealed = Boolean(results.snapshotId);
  const topMoods = results.profile.dimensions.slice(0, 2);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusHeading) headingRef.current?.focus();
  }, [focusHeading]);
  return (
    <main className="one-trip-screen my-results-screen" aria-labelledby="my-take-title">
      <p className="eyebrow">{revealed ? 'Your top five' : 'Your private top five'}</p>
      <h1 id="my-take-title" ref={headingRef} tabIndex={-1}>Five places that match what you picked.</h1>
      <p className="lede">These are the places that best match the experiences you chose. They are a starting point for the conversation, not the final decision.</p>
      {!revealed && <p className="my-results-screen__privacy-note">These are yours to see, but please keep them private for now. The group’s results and everyone else’s top five stay hidden until Dan opens the envelope.</p>}
      <section className="my-results-moods" aria-label="What you liked most">
        <div><p className="eyebrow">What you liked</p><strong>{topMoods.map((dimension) => dimension.label).join(' and ')}</strong></div>
        <div>{topMoods.map((dimension) => <span key={dimension.key}><MoodPortrait traveler={traveler} dimension={dimension.key} decorative /><i>{dimension.label}</i></span>)}</div>
      </section>
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
              <div className="personal-result-card__moods" aria-label="Preference themes this place connects to">
                {(result.explanation.moodKeys ?? result.explanation.themes.map(moodKeyFromTheme).filter((key): key is NonNullable<typeof key> => Boolean(key)).slice(0, 2)).map((dimension) => <span key={dimension}><MoodPortrait traveler={traveler} dimension={dimension} decorative /><i>{moodLabel[dimension]}</i></span>)}
              </div>
            </details>
          </div>
        </article>)}
      </section>
      <TravelEffortKey />
    </main>
  );
}
