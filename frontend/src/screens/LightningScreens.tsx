import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import NumberFlow from "@number-flow/react";
import type {
  AttributeKey,
  LightningComparisonTrailEntry,
  LightningDestinationBrief,
  LightningGroupResultsResponse,
  LightningGroupStatus,
  LightningPersonalResults,
  LightningProgress,
  RosterUser,
} from "@lgs/shared";
import { MediaImage } from "../components/MediaImage.js";
import { MoodPortrait } from "../components/MoodPortrait.js";

const introMoods: readonly { traveler: RosterUser; dimension: AttributeKey }[] =
  [
    { traveler: "dan", dimension: "adventure" },
    { traveler: "james", dimension: "food" },
    { traveler: "john", dimension: "culture" },
    { traveler: "matt", dimension: "nature" },
    { traveler: "peter", dimension: "novelty" },
  ];
const nameFor = (user: RosterUser) => user[0]!.toUpperCase() + user.slice(1);
const tierLabel = (start: number, end: number) =>
  start === end ? `#${start}` : `#${start}–${end} · too close to separate`;
type DisplayTier = Readonly<{
  rankStart: number;
  rankEnd: number;
  destinationIds: readonly string[];
}>;
type WorkingOrderLike = Readonly<{
  workingOrder: readonly string[];
  clearBreaksAfter: readonly number[];
  topFiveGroups: {
    likelyTopFive: readonly string[];
    possibleTopFive: readonly string[];
    unlikelyTopFive: readonly string[];
  };
}>;
type PrivateEvidence = Readonly<{
  destinationId: string;
  workingRank: number;
  topFivePercent: number;
  rankRange: { low: number; high: number };
}>;
type PersonalWorkingOrder = WorkingOrderLike &
  Readonly<{ privateEvidence: readonly PrivateEvidence[] }>;

function hasWorkingOrder(value: unknown): value is WorkingOrderLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "workingOrder" in value &&
    Array.isArray((value as { workingOrder?: unknown }).workingOrder)
  );
}

function personalDisplayTiers(
  results: LightningPersonalResults,
): readonly DisplayTier[] {
  if (hasWorkingOrder((results as { ranking?: unknown }).ranking)) {
    return (results as { ranking: WorkingOrderLike }).ranking.workingOrder.map(
      (id, index) => ({
        rankStart: index + 1,
        rankEnd: index + 1,
        destinationIds: [id],
      }),
    );
  }
  return (results as unknown as { tiers: readonly DisplayTier[] }).tiers;
}

function personalRanking(
  results: LightningPersonalResults,
): WorkingOrderLike | undefined {
  const ranking = (results as { ranking?: unknown }).ranking;
  return hasWorkingOrder(ranking) ? ranking : undefined;
}

function personalEvidence(
  results: LightningPersonalResults,
): readonly PrivateEvidence[] {
  const ranking = (results as { ranking?: unknown }).ranking;
  if (
    !hasWorkingOrder(ranking) ||
    !Array.isArray((ranking as { privateEvidence?: unknown }).privateEvidence)
  )
    return [];
  return (ranking as PersonalWorkingOrder).privateEvidence;
}

function memberDisplayTiers(member: unknown): readonly DisplayTier[] {
  if (
    typeof member === "object" &&
    member !== null &&
    hasWorkingOrder(member)
  ) {
    return (member as WorkingOrderLike).workingOrder.map((id, index) => ({
      rankStart: index + 1,
      rankEnd: index + 1,
      destinationIds: [id],
    }));
  }
  if (
    typeof member === "object" &&
    member !== null &&
    Array.isArray((member as { tiers?: unknown }).tiers)
  )
    return (member as { tiers: readonly DisplayTier[] }).tiers;
  return [];
}

function rankLabel(start: number, end: number, exact: boolean): string {
  return exact ? `#${start}` : tierLabel(start, end);
}

function LightningEvidenceBand({
  destinationIds,
  title,
  description,
  tone,
  destinations,
  activeDestinationId,
  onActivate,
  onDeactivate,
}: {
  destinationIds: readonly string[];
  title: string;
  description: string;
  tone: "likely" | "possible";
  destinations: ReadonlyMap<string, LightningDestinationBrief>;
  activeDestinationId: string | null;
  onActivate: (destinationId: string) => void;
  onDeactivate: () => void;
}) {
  const places = destinationIds
    .map((id) => destinations.get(id))
    .filter((destination): destination is LightningDestinationBrief => Boolean(destination));

  return (
    <section className={`lightning-evidence-band lightning-evidence-band--${tone}`}>
      <div className="lightning-evidence-band__heading">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {places.length > 0 ? (
        <div className="lightning-evidence-band__places">
          {places.map((destination) => {
            const isActive = activeDestinationId === destination.id;
            return (
              <button
                key={destination.id}
                type="button"
                className={isActive ? "is-active" : ""}
                data-destination-id={destination.id}
                aria-label={`Show ${destination.name} across all five lists`}
                onMouseEnter={() => onActivate(destination.id)}
                onFocus={() => onActivate(destination.id)}
                onMouseLeave={onDeactivate}
                onBlur={onDeactivate}
                onClick={() => onActivate(destination.id)}
              >
                {destination.name}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="lightning-evidence-band__empty">No places in this band.</p>
      )}
    </section>
  );
}
const vetoSummary = (users: readonly RosterUser[]) => {
  const names = users.map(nameFor);
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} vetoed`;
  if (names.length === 2) return `${names[0]} and ${names[1]} vetoed`;
  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)} vetoed`;
};

export function LightningIntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <main className="lightning-intro screen-enter">
      <section className="lightning-intro__hero">
        <p className="eyebrow">ROUND TWO</p>
        <h1>
          Choose the places
          <br />
          <em>directly.</em>
        </h1>
        <p>
          This time, every card tells you exactly where you could go and what it
          would take to get there. Pick the place you would rather make the trip
          for.
        </p>
        <div
          className="lightning-intro__moods"
          aria-label="The five travelers are back for one more round"
        >
          <p>The crew is back at the map table.</p>
          <div className="lightning-intro__mood-cast">
            {introMoods.map(({ traveler, dimension }) => (
              <div
                className="lightning-intro__mood"
                key={`${traveler}-${dimension}`}
              >
                <MoodPortrait
                  traveler={traveler}
                  dimension={dimension}
                  size="card"
                  decorative
                />
              </div>
            ))}
          </div>
        </div>
        <button className="lgs-button lgs-button--primary" onClick={onStart}>
          Start the Lightning Round →
        </button>
      </section>
      <ol className="lightning-intro__steps">
        <li>
          <b>24 places</b>
          <span>
            Names, weather, activities, flights, and the honest catch are all on
            the cards.
          </span>
        </li>
        <li>
          <b>48 core choices</b>
          <span>
            Every place gets a fair look. Close calls can add up to 12
            tie-breakers.
          </span>
        </li>
        <li>
          <b>One more envelope</b>
          <span>
            You can see your own full list when you finish. The group list stays
            sealed until everyone is done.
          </span>
        </li>
      </ol>
    </main>
  );
}

export function LightningHowItWorksScreen({
  backLabel,
  onBack,
}: {
  backLabel: string;
  onBack: () => void;
}) {
  return (
    <main className="lightning-help screen-enter">
      <header className="lightning-help__hero">
        <p className="eyebrow">ABOUT THE LIGHTNING ROUND</p>
        <h1>
          Real places. <em>Your honest picks.</em>
        </h1>
        <p>
          This is the follow-up round: you are comparing the actual 24 places,
          with enough practical detail to make a real choice.
        </p>
      </header>
      <ol className="lightning-help__steps">
        <li>
          <b>1</b>
          <div>
            <strong>Everyone sees the same places.</strong>
            <span>
              Names, photos, weather, travel effort, activities, and the honest
              catch are all on the cards.
            </span>
          </div>
        </li>
        <li>
          <b>2</b>
          <div>
            <strong>Every place gets a fair look.</strong>
            <span>
              You will make 48 core choices. If a few places are still too close
              to separate, the app may ask up to 12 extra close calls.
            </span>
          </div>
        </li>
        <li>
          <b>3</b>
          <div>
            <strong>Your list and vetoes stay private.</strong>
            <span>
              After your list is ready, you can flag up to four places you would
              not take. That does not change the points or your ranking.
            </span>
          </div>
        </li>
        <li>
          <b>4</b>
          <div>
            <strong>The second envelope opens for everyone.</strong>
            <span>
              Once all five people are ready, you will see everyone’s full
              rankings, the transparent point tally, and any vetoes.
            </span>
          </div>
        </li>
      </ol>
      <button
        className="lgs-button lgs-button--secondary lightning-help__back"
        type="button"
        onClick={onBack}
      >
        ← {backLabel}
      </button>
    </main>
  );
}

function Detail({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="lightning-card__detail">
      <span aria-hidden="true">{icon}</span>
      <div>
        <b>{title}</b>
        {children}
      </div>
    </div>
  );
}

export function LightningComparisonScreen({
  progress,
  destinations,
  selected,
  onChoose,
}: {
  progress: LightningProgress;
  destinations: readonly [LightningDestinationBrief, LightningDestinationBrief];
  selected?: string;
  onChoose: (id: string) => void;
}) {
  const tieBreak = progress.phase === "tie-breakers";
  return (
    <main className="lightning-game screen-enter">
      <header className="lightning-game__header">
        <p className="eyebrow">LIGHTNING ROUND</p>
        <div>
          <strong>
            <NumberFlow value={progress.comparisons} /> choices made
          </strong>
          <span>
            {tieBreak
              ? "Close-call tie-breakers"
              : `${48 - progress.comparisons} core choices left`}
          </span>
        </div>
      </header>
      <section className="lightning-game__heading">
        <h1>Which trip?</h1>
        {tieBreak && (
          <p>
            These are close calls. A few extra picks help sort out places that
            are still hard to separate.
          </p>
        )}
        <div className="lightning-game__progress">
          <i
            style={{
              width: `${Math.min(100, (progress.comparisons / progress.core) * 100)}%`,
            }}
          />
        </div>
        <small>
          {progress.comparisons} of{" "}
          {tieBreak ? progress.maximum : progress.core} choices
        </small>
      </section>
      <section
        className="lightning-choices"
        aria-label="Choose one destination"
      >
        {destinations.flatMap((destination, index) => [
          <article
            key={destination.id}
            className={`lightning-card ${selected === destination.id ? "lightning-card--selected" : ""}`}
          >
            <MediaImage
              src={destination.imageUrl}
              alt=""
              fallbackLabel="Destination photo unavailable"
            />
            <div className="lightning-card__title">
              <p>{destination.country}</p>
              <h2>{destination.name}</h2>
              <span>{destination.pitch}</span>
            </div>
            <ul className="lightning-card__highlights">
              {destination.highlights.map((highlight) => (
                <li key={highlight.title}>
                  <strong>{highlight.title}</strong>
                  <span>{highlight.detail}</span>
                </li>
              ))}
            </ul>
            <div className="lightning-card__facts">
              <Detail
                icon="☀"
                title={`${destination.weather.typicalHighF}° / ${destination.weather.typicalLowF}° in November`}
              >
                <p>{destination.weather.note}</p>
              </Detail>
              <Detail
                icon="✈"
                title={`Travel effort ${destination.travel.effort} of 5`}
              >
                <p>{destination.travel.summary}</p>
              </Detail>
              <Detail
                icon="$"
                title={`Typical round trip: DC $${destination.travel.fares.dc} · NYC $${destination.travel.fares.nyc} · SF $${destination.travel.fares.sfo}`}
              >
                <p>{destination.travel.fareNote}</p>
              </Detail>
              <Detail icon="!" title="Worth knowing">
                <p>{destination.caveat}</p>
              </Detail>
            </div>
            <button
              className="lightning-card__choose"
              disabled={Boolean(selected)}
              onClick={() => onChoose(destination.id)}
            >
              <span>I’d rather go to</span>
              {destination.name} <b>→</b>
            </button>
          </article>,
          index === 0 ? (
            <div key="or" className="lightning-choices__or" aria-hidden="true">
              <span />
              OR
              <span />
            </div>
          ) : null,
        ])}
      </section>
    </main>
  );
}

function LightningComparisonTrail({
  trail,
  destinations,
}: {
  trail: readonly LightningComparisonTrailEntry[];
  destinations: ReadonlyMap<string, LightningDestinationBrief>;
}) {
  const stages = useMemo(
    () =>
      Array.from({ length: Math.ceil(trail.length / 8) }, (_, index) =>
        trail.slice(index * 8, index * 8 + 8),
      ),
    [trail],
  );
  return (
    <section
      className="lightning-trail"
      aria-labelledby="lightning-trail-title"
    >
      <div className="lightning-trail__heading">
        <div>
          <p className="eyebrow">HOW YOUR LIST TOOK SHAPE</p>
          <h2 id="lightning-trail-title">Your decision trail</h2>
        </div>
        <p>
          Every mark is one direct pick. The winner is on the left; this is a
          record of your choices, not an elimination bracket.
        </p>
      </div>
      <div className="lightning-trail__scroll">
        <div className="lightning-trail__stages">
          {stages.map((stage, index) => (
            <section
              className="lightning-trail__stage"
              key={stage[0]?.order ?? index}
            >
              <h3>
                {stage[0]?.phase === "tie-breakers"
                  ? "Close calls"
                  : `Choices ${stage[0]?.order}–${stage.at(-1)?.order}`}
              </h3>
              <ol>
                {stage.map((entry) => (
                  <li key={entry.order}>
                    <span className="lightning-trail__order">
                      {entry.order}
                    </span>
                    <b>{destinations.get(entry.winnerId)?.name}</b>
                    <span className="lightning-trail__beat">beat</span>
                    <span>{destinations.get(entry.loserId)?.name}</span>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LightningPersonalResultsScreen({
  results,
  onOpenWaiting,
  onOpenVeto,
}: {
  results: LightningPersonalResults;
  onOpenWaiting: () => void;
  onOpenVeto: () => void;
}) {
  const byId = new Map(
    results.destinations.map((destination) => [destination.id, destination]),
  );
  const ranking = personalRanking(results);
  const displayTiers = personalDisplayTiers(results);
  const topFive = displayTiers
    .flatMap((tier) => tier.destinationIds.map((id) => ({ id, tier })))
    .slice(0, 5);
  const vetoed = new Set(results.vetoes.destinationIds);
  const vetoedPlaces = results.vetoes.destinationIds
    .map((id) => byId.get(id))
    .filter((destination): destination is LightningDestinationBrief =>
      Boolean(destination),
    );
  const evidenceById = new Map(
    personalEvidence(results).map(
      (entry) => [entry.destinationId, entry] as const,
    ),
  );
  return (
    <main className="lightning-results screen-enter">
      <header>
        <p className="eyebrow">YOUR LIGHTNING ROUND</p>
        <h1>{ranking ? "Your current order." : "Your full list is ready."}</h1>
        <p>
          {ranking
            ? "Your choices point to this order. Nearby places can still be close; the details below show where the evidence is firmer."
            : "These are the named trips you picked from, in order. When two places were still too close to call, they share a tier."}
        </p>
      </header>
      <aside
        className={
          results.vetoes.submitted
            ? "lightning-results__saved-status"
            : "lightning-results__veto-prompt"
        }
      >
        <div>
          {!results.vetoes.submitted && (
            <p className="eyebrow">ONE MORE STEP</p>
          )}
          <strong>
            {results.vetoes.submitted
              ? "Your list and vetoes are saved."
              : "Before the envelope: any places you would rule out?"}
          </strong>
          <span>
            {results.vetoes.submitted
              ? "Everyone can see their own list. The group’s results stay sealed until all five finish."
              : "You can flag up to four trips you would not take. Leaving it blank is completely fine."}
          </span>
        </div>
        {results.vetoes.submitted ? (
          <button
            className="lgs-button lgs-button--secondary"
            onClick={onOpenWaiting}
          >
            See who’s finished
          </button>
        ) : (
          <button
            className="lgs-button lgs-button--primary"
            onClick={onOpenVeto}
          >
            Choose places I would rule out
          </button>
        )}
      </aside>
      {results.vetoes.submitted && vetoedPlaces.length > 0 && (
        <section
          className="lightning-results__veto-summary"
          aria-labelledby="lightning-veto-summary-title"
        >
          <div>
            <p className="eyebrow">YOUR VETOES</p>
            <h2 id="lightning-veto-summary-title">
              Places you would rule out.
            </h2>
          </div>
          <div>
            {vetoedPlaces.map((destination) => (
              <span key={destination.id}>× {destination.name}</span>
            ))}
          </div>
        </section>
      )}
      <section
        className="lightning-results__top"
        aria-labelledby="lightning-top-title"
      >
        <div>
          <p className="eyebrow">
            {ranking ? "THE TOP OF YOUR CURRENT ORDER" : "THE TOP OF YOUR LIST"}
          </p>
          <h2 id="lightning-top-title">Five places you kept choosing.</h2>
        </div>
        <div>
          {topFive.map(({ id, tier }) => {
            const destination = byId.get(id)!;
            const isVetoed = vetoed.has(id);
            const evidence = evidenceById.get(id);
            return (
              <article key={id} className={isVetoed ? "is-vetoed" : ""}>
                <MediaImage
                  src={destination.imageUrl}
                  alt=""
                  fallbackLabel="Photo unavailable"
                />
                <span>
                  {rankLabel(tier.rankStart, tier.rankEnd, Boolean(ranking))}
                </span>
                <strong>{destination.name}</strong>
                <small>
                  {isVetoed
                    ? "× Vetoed"
                    : evidence
                      ? `${evidence.topFivePercent}% chance of top five`
                      : destination.country}
                </small>
              </article>
            );
          })}
        </div>
      </section>
      {ranking && (
        <details className="lightning-results__evidence">
          <summary>How sure is this?</summary>
          <p>
            This is a working order, not a promise. The app replays the
            uncertainty in your 60 choices to show how often each place lands
            near the top.
          </p>
          <div
            role="table"
            aria-label="Private evidence for your Lightning Round order"
          >
            <div role="row">
              <b>Place</b>
              <b>Current spot</b>
              <b>Chance of top five</b>
              <b>Plausible range</b>
            </div>
            {ranking.workingOrder.map((id) => {
              const evidence = evidenceById.get(id)!;
              return (
                <div role="row" key={id}>
                  <span>{byId.get(id)?.name}</span>
                  <span>#{evidence.workingRank}</span>
                  <span>{evidence.topFivePercent}%</span>
                  <span>
                    #{evidence.rankRange.low}–#{evidence.rankRange.high}
                  </span>
                </div>
              );
            })}
          </div>
        </details>
      )}
      <LightningComparisonTrail
        trail={results.comparisonTrail}
        destinations={byId}
      />
      <section
        className="lightning-results__ranking"
        aria-labelledby="lightning-ranking-title"
      >
        <div>
          <p className="eyebrow">THE FULL LIST</p>
          <h2 id="lightning-ranking-title">All 24 places, in your order.</h2>
        </div>
        <ol>
          {displayTiers.map((tier) => {
            const hasClearBreak =
              Boolean(ranking?.clearBreaksAfter.includes(tier.rankEnd)) &&
              tier.rankEnd < 24;
            return (
              <li
                key={`${tier.rankStart}-${tier.rankEnd}`}
                className={
                  hasClearBreak ? "lightning-results__clear-break" : ""
                }
              >
                <p>
                  {rankLabel(tier.rankStart, tier.rankEnd, Boolean(ranking))}
                </p>
                <div>
                  {tier.destinationIds.map((id) => {
                    const destination = byId.get(id)!;
                    const isVetoed = vetoed.has(id);
                    return (
                      <article key={id} className={isVetoed ? "is-vetoed" : ""}>
                        <MediaImage
                          src={destination.imageUrl}
                          alt=""
                          fallbackLabel="Photo unavailable"
                        />
                        <strong>{destination.name}</strong>
                        <span>{destination.country}</span>
                        {isVetoed && (
                          <small className="lightning-veto-mark">
                            × Vetoed
                          </small>
                        )}
                      </article>
                    );
                  })}
                </div>
                {hasClearBreak && (
                  <small className="lightning-results__break-label">
                    Clearer break below
                  </small>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}

export function LightningVetoScreen({
  results,
  onSubmit,
}: {
  results: LightningPersonalResults;
  onSubmit: (destinationIds: readonly string[]) => Promise<boolean>;
}) {
  const byId = useMemo(
    () =>
      new Map(
        results.destinations.map((destination) => [
          destination.id,
          destination,
        ]),
      ),
    [results.destinations],
  );
  const ranking = personalRanking(results);
  const displayTiers = personalDisplayTiers(results);
  const [selected, setSelected] = useState<readonly string[]>(
    results.vetoes.destinationIds,
  );
  const [submitting, setSubmitting] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const limitReached = selected.length >= 4;
  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length < 4
          ? [...current, id]
          : current,
    );
  const submitLabel =
    selected.length === 0
      ? "Continue with no vetoes"
      : `Save ${selected.length} veto${selected.length === 1 ? "" : "es"}`;
  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(selected);
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <main className="lightning-veto screen-enter">
      <header className="lightning-veto__hero">
        <p className="eyebrow">YOUR DIRECT LIST</p>
        <h1 tabIndex={-1} ref={heading}>
          Any places you would <em>rule out?</em>
        </h1>
        <p>
          Pick up to four trips you would not take. A veto does not change the
          points. It lets the group know a place is a clear no for you.
        </p>
      </header>
      <div className="lightning-veto__layout">
        <aside className="lightning-veto__summary">
          <p className="eyebrow">YOUR CALL</p>
          <strong>
            <NumberFlow value={selected.length} /> of 4
          </strong>
          <span>vetoes selected</span>
          <p>
            You can leave this blank. Toggle any choice until you are ready to
            save it.
          </p>
          <button
            className="lgs-button lgs-button--primary"
            disabled={submitting}
            onClick={() => void submit()}
          >
            {submitting ? "Saving…" : submitLabel}
          </button>
        </aside>
        <section
          className="lightning-veto__ranking"
          aria-labelledby="lightning-veto-list-title"
        >
          <div>
            <p className="eyebrow">STARTING AT THE BOTTOM</p>
            <h2 id="lightning-veto-list-title">
              Your list, lowest to highest.
            </h2>
            <p>
              These are still your real rankings. Mark only the trips you would
              absolutely rule out.
            </p>
          </div>
          <ol>
            {[...displayTiers].reverse().map((tier) => (
              <li key={`${tier.rankStart}-${tier.rankEnd}`}>
                <p>
                  {rankLabel(tier.rankStart, tier.rankEnd, Boolean(ranking))}
                </p>
                <div>
                  {[...tier.destinationIds].reverse().map((id) => {
                    const destination = byId.get(id)!;
                    const isSelected = selected.includes(id);
                    return (
                      <article
                        key={id}
                        className={isSelected ? "is-vetoed" : ""}
                      >
                        <MediaImage
                          src={destination.imageUrl}
                          alt=""
                          fallbackLabel="Photo unavailable"
                        />
                        <div>
                          <strong>{destination.name}</strong>
                          <span>{destination.country}</span>
                        </div>
                        <button
                          type="button"
                          aria-pressed={isSelected}
                          disabled={!isSelected && limitReached}
                          onClick={() => toggle(id)}
                        >
                          <b aria-hidden="true">×</b>
                          <span>
                            {isSelected
                              ? "Vetoed"
                              : limitReached
                                ? "Limit reached"
                                : "Veto this place"}
                          </span>
                        </button>
                      </article>
                    );
                  })}
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}

export function LightningWaitingScreen({
  status,
  user,
  onRefresh,
  onReveal,
  onOpenResults,
}: {
  status: LightningGroupStatus;
  user: RosterUser;
  onRefresh: () => void;
  onReveal: () => void;
  onOpenResults: () => void;
}) {
  const completeCount = status.members.filter(
    (member) => member.complete,
  ).length;
  return (
    <main className="lightning-waiting screen-enter">
      <section className="lightning-waiting__hero">
        <div>
          <p className="eyebrow">SECOND ENVELOPE</p>
          <h1>
            {status.revealOpen
              ? "The direct votes are open."
              : status.allComplete
                ? "Everyone is ready."
                : "Who’s finished?"}
          </h1>
          <p>
            {status.revealOpen
              ? "See the group’s full direct ranking and the practical details behind every place."
              : "Your list is saved. The group result stays closed until everybody has made their choices."}
          </p>
        </div>
        <div className="lightning-waiting__count">
          <NumberFlow value={completeCount} />
          <span>
            of 5<br />
            ready
          </span>
        </div>
      </section>
      <section
        className="lightning-waiting__board"
        aria-label="Lightning Round completion status"
      >
        <p>The departure board</p>
        <ul>
          {status.members.map((member) => (
            <li
              key={member.user}
              className={member.complete ? "is-complete" : ""}
            >
              <span className="lightning-waiting__person">
                {member.user === user ? "You" : nameFor(member.user)}
              </span>
              <b>{member.complete ? "List saved" : "Still choosing"}</b>
              <i aria-hidden="true">{member.complete ? "✓" : "…"}</i>
            </li>
          ))}
        </ul>
      </section>
      <div className="lightning-waiting__actions">
        {status.revealOpen ? (
          <button
            className="lgs-button lgs-button--primary"
            onClick={onOpenResults}
          >
            See the group’s direct ranking
          </button>
        ) : status.allComplete && user === "dan" ? (
          <button className="lgs-button lgs-button--primary" onClick={onReveal}>
            Open the second envelope
          </button>
        ) : (
          <button
            className="lgs-button lgs-button--secondary"
            onClick={onRefresh}
          >
            Check again
          </button>
        )}
      </div>
    </main>
  );
}

type SortKey = "group" | RosterUser;
function isWorkingOrderGroupResults(
  results: LightningGroupResultsResponse,
): results is Extract<
  LightningGroupResultsResponse,
  { resultVersion: "working-order-borda-v2" }
> {
  return (
    "resultVersion" in results &&
    results.resultVersion === "working-order-borda-v2"
  );
}
function memberRankMap(results: LightningGroupResultsResponse) {
  return Object.fromEntries(
    results.members.map((member) => [
      member.user,
      new Map(
        memberDisplayTiers(member).flatMap((tier) =>
          tier.destinationIds.map((id) => [id, tier] as const),
        ),
      ),
    ]),
  ) as unknown as Record<
    RosterUser,
    Map<string, { rankStart: number; rankEnd: number }>
  >;
}
function memberVetoMap(results: LightningGroupResultsResponse) {
  return Object.fromEntries(
    results.members.map((member) => [
      member.user,
      new Set(member.vetoedDestinationIds),
    ]),
  ) as unknown as Record<RosterUser, Set<string>>;
}

export function LightningVerdictScreen({
  results,
}: {
  results: LightningGroupResultsResponse;
}) {
  const byId = new Map(
    results.destinations.map((destination) => [destination.id, destination]),
  );
  const evidenceVersion = isWorkingOrderGroupResults(results);
  const [active, setActive] = useState(results.group[0]?.destinationId ?? "");
  const [sortBy, setSortBy] = useState<SortKey>("group");
  const [activeEvidenceId, setActiveEvidenceId] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const ranks = useMemo(() => memberRankMap(results), [results]);
  const vetoes = useMemo(() => memberVetoMap(results), [results]);
  const selected = byId.get(active);
  const activeEvidenceDestination = activeEvidenceId
    ? byId.get(activeEvidenceId)
    : undefined;
  const sortedRows = useMemo(
    () =>
      [...results.group].sort((left, right) => {
        if (sortBy === "group")
          return (
            left.rankStart - right.rankStart ||
            left.rankEnd - right.rankEnd ||
            left.destinationId.localeCompare(right.destinationId)
          );
        const leftVetoed = vetoes[sortBy].has(left.destinationId);
        const rightVetoed = vetoes[sortBy].has(right.destinationId);
        if (leftVetoed !== rightVetoed) return leftVetoed ? 1 : -1;
        const leftRank = ranks[sortBy].get(left.destinationId)?.rankStart ?? 25;
        const rightRank =
          ranks[sortBy].get(right.destinationId)?.rankStart ?? 25;
        return (
          leftRank - rightRank ||
          left.rankStart - right.rankStart ||
          left.destinationId.localeCompare(right.destinationId)
        );
      }),
    [ranks, results.group, sortBy, vetoes],
  );
  const groupLeaderMargin =
    evidenceVersion && results.group.length > 1
      ? results.group[0]!.bordaPoints - results.group[1]!.bordaPoints
      : undefined;
  useEffect(() => heading.current?.focus(), []);
  return (
    <main className="lightning-verdict screen-enter">
      <section className="lightning-verdict__hero">
        <p className="eyebrow">SECOND ENVELOPE OPEN</p>
        <h1 tabIndex={-1} ref={heading}>
          Here’s how the group ranked <em>all 24 places.</em>
        </h1>
        <p>
          {evidenceVersion
            ? "Each person’s current order became a transparent tally: #1 earns 24 points, #24 earns 1. It is a practical starting point for the conversation—not an automatic decision."
            : "Each person’s full list became a transparent tally: #1 earns 24 points, #24 earns 1. Shared tiers split those positions evenly."}
        </p>
        {groupLeaderMargin !== undefined && (
          <p className="lightning-verdict__open-field">
            {groupLeaderMargin <= 3
              ? `Open field: the top two places are only ${groupLeaderMargin} point${groupLeaderMargin === 1 ? "" : "s"} apart.`
              : "The group has a current front-runner, but every person’s list is still visible below."}
          </p>
        )}
      </section>
      <section className="lightning-verdict__board">
        <div className="lightning-verdict__places">
          {results.group.map((row) => {
            const destination = byId.get(row.destinationId)!;
            const points =
              "bordaPoints" in row ? row.bordaPoints : row.bordaHalfPoints / 2;
            const support =
              "topFiveSupport" in row
                ? row.topFiveSupport
                : row.supporters.length;
            return (
              <button
                key={row.destinationId}
                type="button"
                className={active === row.destinationId ? "is-active" : ""}
                onClick={() => setActive(row.destinationId)}
              >
                <span className="lightning-verdict__place-rank">
                  {rankLabel(row.rankStart, row.rankEnd, evidenceVersion)}
                </span>
                <strong>{destination.name}</strong>
                <span className="lightning-verdict__place-score">
                  <b>{points} points</b>
                  <em>
                    {row.firstPlaceVotes} first-place vote
                    {row.firstPlaceVotes === 1 ? "" : "s"} · {support} top-five
                  </em>
                </span>
                {row.vetoedBy.length > 0 && (
                  <span className="lightning-verdict__place-veto">
                    × But {vetoSummary(row.vetoedBy)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <article className="lightning-verdict__detail">
          {selected && (
            <>
              <MediaImage
                src={selected.imageUrl}
                alt=""
                fallbackLabel="Photo unavailable"
              />
              <p>{selected.country}</p>
              <h2>{selected.name}</h2>
              <span>{selected.pitch}</span>
              {results.group.find((row) => row.destinationId === selected.id)
                ?.vetoedBy.length ? (
                <p className="lightning-verdict__veto-detail">
                  × But{" "}
                  {vetoSummary(
                    results.group.find(
                      (row) => row.destinationId === selected.id,
                    )!.vetoedBy,
                  )}
                </p>
              ) : null}
              <h3>Three days could include</h3>
              <ul>
                {selected.highlights.map((highlight) => (
                  <li key={highlight.title}>
                    <b>{highlight.title}</b> {highlight.detail}
                  </li>
                ))}
              </ul>
              <div>
                <b>
                  {selected.weather.typicalHighF}° /{" "}
                  {selected.weather.typicalLowF}°
                </b>
                <span>{selected.weather.note}</span>
              </div>
              <div>
                <b>Travel effort {selected.travel.effort} of 5</b>
                <span>{selected.travel.summary}</span>
              </div>
              <p className="lightning-verdict__caveat">
                Worth knowing: {selected.caveat}
              </p>
            </>
          )}
        </article>
      </section>
      {evidenceVersion && (
        <section
          className={`lightning-verdict__evidence${activeEvidenceId ? " is-comparing" : ""}`}
          aria-labelledby="lightning-evidence-title"
        >
          <p className="eyebrow">WHAT EACH PERSON’S LIST SAYS</p>
          <h2 id="lightning-evidence-title">
            Where each person’s top five looks firm—or still open.
          </h2>
          <p className="lightning-verdict__evidence-intro">
            Each column is one person. The two labeled bands are separate
            tiers: places more often near their top five, then places still
            close enough to move up. Hover or focus a place to find it across
            every list.
          </p>
          <p className="lightning-verdict__evidence-status" aria-live="polite">
            {activeEvidenceDestination
              ? `Showing ${activeEvidenceDestination.name} across all five lists.`
              : "Choose a place to compare it across the group."}
          </p>
          <div>
            {results.members.map((member) => (
              <article
                key={member.user}
                onMouseLeave={() => setActiveEvidenceId(null)}
              >
                <strong>{nameFor(member.user)}</strong>
                <LightningEvidenceBand
                  destinationIds={member.topFiveGroups.likelyTopFive}
                  title="More often near the top"
                  description="A likely top-five band"
                  tone="likely"
                  destinations={byId}
                  activeDestinationId={activeEvidenceId}
                  onActivate={setActiveEvidenceId}
                  onDeactivate={() => setActiveEvidenceId(null)}
                />
                <LightningEvidenceBand
                  destinationIds={member.topFiveGroups.possibleTopFive}
                  title="Could still move up"
                  description="Close enough to stay in play"
                  tone="possible"
                  destinations={byId}
                  activeDestinationId={activeEvidenceId}
                  onActivate={setActiveEvidenceId}
                  onDeactivate={() => setActiveEvidenceId(null)}
                />
              </article>
            ))}
          </div>
        </section>
      )}
      <section
        className="lightning-verdict__matrix"
        aria-labelledby="lightning-matrix-title"
      >
        <div className="lightning-verdict__matrix-heading">
          <div>
            <p className="eyebrow">EVERYONE’S DIRECT LISTS</p>
            <h2 id="lightning-matrix-title">See what each person chose.</h2>
            <p>
              Choose a name to sort the places by that person’s list. Vetoed
              places move to the bottom of that person’s view.
            </p>
          </div>
          {selected && (
            <aside>
              <span>Selected place</span>
              <strong>{selected.name}</strong>
              <div>
                {results.members.map((member) => {
                  const rank = ranks[member.user].get(selected.id);
                  const vetoed = vetoes[member.user].has(selected.id);
                  return (
                    <span key={member.user}>
                      {nameFor(member.user)}{" "}
                      <b className={vetoed ? "lightning-veto-text" : ""}>
                        {vetoed
                          ? "× Vetoed"
                          : rankLabel(
                              rank?.rankStart ?? 24,
                              rank?.rankEnd ?? 24,
                              evidenceVersion,
                            )}
                      </b>
                    </span>
                  );
                })}
              </div>
            </aside>
          )}
        </div>
        <div className="lightning-rank-table__scroll">
          <table className="lightning-rank-table">
            <caption>
              Each column is a person’s direct list. A red X means that traveler
              vetoed the place.
            </caption>
            <thead>
              <tr>
                <th scope="col">
                  <button
                    aria-pressed={sortBy === "group"}
                    onClick={() => setSortBy("group")}
                  >
                    Group order
                  </button>
                </th>
                <th scope="col">Place</th>
                {results.members.map((member) => (
                  <th key={member.user} scope="col">
                    <button
                      aria-pressed={sortBy === member.user}
                      onClick={() => setSortBy(member.user)}
                    >
                      Sort by {nameFor(member.user)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => {
                const destination = byId.get(row.destinationId)!;
                return (
                  <tr
                    key={row.destinationId}
                    className={
                      active === row.destinationId ? "is-selected" : ""
                    }
                  >
                    <td>
                      {rankLabel(row.rankStart, row.rankEnd, evidenceVersion)}
                    </td>
                    <th scope="row">
                      <button onClick={() => setActive(row.destinationId)}>
                        {destination.name}
                        <small>{destination.country}</small>
                      </button>
                    </th>
                    {results.members.map((member) => {
                      const rank = ranks[member.user].get(row.destinationId)!;
                      const vetoed = vetoes[member.user].has(row.destinationId);
                      return (
                        <td
                          key={member.user}
                          className={vetoed ? "is-vetoed" : ""}
                        >
                          {vetoed ? (
                            <span
                              className="lightning-veto-text"
                              aria-label={`${nameFor(member.user)} vetoed ${destination.name}`}
                            >
                              × Vetoed
                            </span>
                          ) : (
                            rankLabel(
                              rank.rankStart,
                              rank.rankEnd,
                              evidenceVersion,
                            )
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <p className="lightning-verdict__closing">
        You’ve seen every list and the practical tradeoffs. Now talk it through
        and choose together.
      </p>
    </main>
  );
}
