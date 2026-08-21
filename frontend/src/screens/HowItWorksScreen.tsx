import { useEffect, useRef, type CSSProperties } from 'react';

export type BriefingTraveler = {
  id: string;
  name: string;
  image: string;
};

type HowItWorksScreenProps = {
  travelers: readonly BriefingTraveler[];
  required?: boolean;
  backLabel: string;
  onBack: () => void;
  onStartChoices?: () => void;
};

function ChoiceGlyphs() {
  return <div className="briefing-choice-glyphs" aria-hidden="true">
    <span><i>↗</i><b>Wild day out</b></span>
    <em>or</em>
    <span><i>✦</i><b>Slow local day</b></span>
  </div>;
}

function TasteGlyphs() {
  return <div className="briefing-taste-glyphs" aria-hidden="true">
    {['Adventure', 'Nature', 'Culture', 'Food', 'History', 'City', 'Newness', 'Movement'].map((label, index) => <span key={label} style={{ '--ingredient-index': index } as CSSProperties}>{label}</span>)}
    <i>your<br />taste</i>
  </div>;
}

function RouteGlyphs() {
  return <div className="briefing-route-glyphs" aria-label="32 choices: 24 fair-look choices, followed by 8 top-five choices">
    <div><b>24</b><span>fair-look<br />choices</span></div>
    <i aria-hidden="true">→</i>
    <div><b>8</b><span>top-five<br />choices</span></div>
  </div>;
}

export function HowItWorksButton({ onClick }: { onClick: () => void }) {
  return <button className="how-it-works-help-button" type="button" onClick={onClick} aria-label="How it works">
    <span aria-hidden="true">?</span><b>How it works</b>
  </button>;
}

/**
 * A static, destination-safe explanation of the game. It intentionally never
 * receives API data, candidates, scores, or a player's actual result.
 */
export function HowItWorksScreen({ travelers, required = false, backLabel, onBack, onStartChoices }: HowItWorksScreenProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);

  return <main className="how-it-works-screen" aria-labelledby="how-it-works-title">
    <header className="briefing-topbar">
      <button className="briefing-back" type="button" onClick={onBack}>← <span>{backLabel}</span></button>
      <p className="eyebrow">Trip briefing · before you begin</p>
      <span className="briefing-topbar__seal" aria-hidden="true">32</span>
    </header>

    <section className="briefing-intro">
      <p className="eyebrow">How this trip game works</p>
      <h1 id="how-it-works-title" ref={headingRef} tabIndex={-1}>Pick what sounds fun.<br /><em>See what the group likes.</em></h1>
      <p>There are no wrong answers and no place names while you play. Just pick the experiences you like more.</p>
    </section>

    <ol className="briefing-path">
      <li className="briefing-step briefing-step--curation">
        <span className="briefing-step__number">01</span>
        <div className="briefing-step__visual briefing-step__visual--curation" aria-label="24 sealed, unnamed trip cards">
          <i className="briefing-map-pin">⌖</i>
          <div>{Array.from({ length: 24 }, (_, index) => <span key={index} />)}</div>
          <b>24 possible trips</b>
        </div>
        <div className="briefing-step__copy"><p className="eyebrow">Dan set the table</p><h2>Dan picked 24 possible trips</h2><p>Before the game started, Dan chose 24 places that could work for this group—thinking about your shared interests, budget, travel time, and the kind of trip you might actually take.</p></div>
      </li>
      <li className="briefing-step briefing-step--choices">
        <span className="briefing-step__number">02</span>
        <ChoiceGlyphs />
        <div className="briefing-step__copy"><p className="eyebrow">Go with your gut</p><h2>You pick your favorites</h2><p>You’ll see two travel experiences at a time and pick the one you’d rather do. Go with your first instinct—neither answer is better.</p></div>
      </li>
      <li className="briefing-step briefing-step--taste">
        <span className="briefing-step__number">03</span>
        <TasteGlyphs />
        <div className="briefing-step__copy"><p className="eyebrow">What happens behind the scenes</p><h2>We notice what you like</h2><p>As you pick, the game notices patterns: big adventures, local food, old places, time outside, city energy, and more.</p><p className="briefing-step__math"><b>A small learning model</b> updates after every choice. It looks for patterns in what you enjoy; it does not choose the trip for you.</p></div>
      </li>
      <li className="briefing-step briefing-step--ranking">
        <span className="briefing-step__number">04</span>
        <RouteGlyphs />
        <div className="briefing-step__copy"><p className="eyebrow">A fair look at every option</p><h2>Your top five takes shape</h2><p>You’ll make 32 choices. The first 24 give every possible trip a fair look. The last eight help sort out the places closest to your personal top five.</p><p className="briefing-step__note">After your round, you can see your own private top five. Keep it to yourself until everyone else finishes.</p></div>
      </li>
      <li className="briefing-step briefing-step--reveal">
        <span className="briefing-step__number">05</span>
        <div className="briefing-reveal-glyph" aria-hidden="true">
          <div className="briefing-private-lists">{travelers.map((traveler, index) => <span key={traveler.id} style={{ '--list-accent': index } as CSSProperties}><i>{index + 1}</i></span>)}</div>
          <div className="briefing-envelope"><span>✉</span><b>open when<br />all five finish</b></div>
          <div className="briefing-points-board">{[5, 4, 3, 2, 1].map((points) => <span key={points}>{points}</span>)}</div>
        </div>
        <div className="briefing-step__copy"><p className="eyebrow">The envelope opens last</p><h2>See how the group voted</h2><p>Once all five people finish, Dan opens the envelope. You’ll see everybody’s top five, where the group agrees, where it splits, and a simple 5/4/3/2/1 tally to guide the conversation.</p><p className="briefing-step__closing">The app helps everyone discover what they like. The five of you choose the trip.</p></div>
      </li>
    </ol>

    {onStartChoices && <footer className="briefing-action"><div><b>Your places stay secret while you play.</b><span>You can always come back here from the ? button.</span></div><button className="lgs-button lgs-button--primary" type="button" onClick={onStartChoices}>Start my 32 choices →</button></footer>}
    {!required && <p className="briefing-help-note">This is a guide to the game. Your place in the journey is waiting right where you left it.</p>}
  </main>;
}
