import { useEffect, useMemo, useState } from 'react';
import type { FinalDecision, FinalDecisionChoice, GroupResultsResponse, RosterUser } from '@lgs/shared';
import { FinalDecisionDialog } from '../components/FinalDecisionDialog.js';
import { FinalistDrawer } from '../components/FinalistDrawer.js';
import { FinalistMatrix } from '../components/FinalistMatrix.js';
import { MediaImage } from '../components/MediaImage.js';
import { TravelEffortKey } from '../components/TravelEffortKey.js';
import { VerdictExplainer } from '../components/VerdictExplainer.js';

type Props = {
  results: GroupResultsResponse;
  currentUser: RosterUser;
  travelerName: (user: RosterUser) => string;
  avatarFor: (user: RosterUser) => string;
  onOpenMyResults: () => void;
  onRecordDecision: (choice: FinalDecisionChoice) => Promise<FinalDecision>;
};

const decisionLabel = (choice: FinalDecisionChoice, finalists: GroupResultsResponse['group']) =>
  choice === 'need-more-research' ? 'need more research' : finalists.find((finalist) => finalist.id === choice)?.name ?? 'this finalist';

/**
 * The post-gate reveal composition. It accepts no comparison data and keeps
 * numerical model outputs deliberately out of the social decision moment.
 */
export function VerdictScreen({ results, currentUser, travelerName, avatarFor, onOpenMyResults, onRecordDecision }: Props) {
  const [activeId, setActiveId] = useState('');
  const [pendingChoice, setPendingChoice] = useState<FinalDecisionChoice | null>(null);
  const [recordedDecision, setRecordedDecision] = useState<FinalDecision | undefined>(() => results.decisions.find((decision) => decision.user === currentUser));
  const [isSaving, setIsSaving] = useState(false);
  const [decisionError, setDecisionError] = useState('');
  const activeFinalist = useMemo(() => results.group.find((finalist) => finalist.id === activeId), [activeId, results.group]);
  const winner = results.group[0];

  // A refreshed result response is the source of truth for an immutable
  // decision made in another tab or returned after a retry.
  useEffect(() => {
    setRecordedDecision(results.decisions.find((decision) => decision.user === currentUser));
  }, [currentUser, results.decisions]);

  if (!winner) return null;

  const requestDecision = (choice: FinalDecisionChoice) => {
    if (recordedDecision) return;
    setDecisionError('');
    setPendingChoice(choice);
  };
  const confirmDecision = async () => {
    if (!pendingChoice || recordedDecision) return;
    setIsSaving(true);
    setDecisionError('');
    try {
      setRecordedDecision(await onRecordDecision(pendingChoice));
      setPendingChoice(null);
    } catch {
      setDecisionError('We couldn’t save that next step. Your choice has not been recorded; try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="verdict-screen screen-enter" aria-labelledby="verdict-title">
      <section className="verdict-screen__hero">
        <MediaImage className="verdict-screen__hero-image" src={winner.imageUrl} alt={`A view from ${winner.name}`} fallbackLabel="Finalist photo unavailable" />
        <div className="verdict-screen__hero-copy">
          <p className="eyebrow">The envelope is open</p>
          <h1 id="verdict-title">The crew’s first place: <em>{winner.name}.</em></h1>
          <p>{winner.country} rose to the top of the group’s shared map. The rest of the short list is still worth your attention.</p>
          <div className="verdict-screen__hero-actions">
            <button className="lgs-button lgs-button--primary" onClick={() => setActiveId(winner.id)}>Explore the winner</button>
            <button className="lgs-button lgs-button--secondary" onClick={onOpenMyResults}>See my own results</button>
          </div>
        </div>
      </section>

      <section className="verdict-screen__content">
        <VerdictExplainer confidence={results.confidence} />
        {results.insights.length > 0 && <ul className="verdict-insights" aria-label="Crew result notes">
          {results.insights.map((insight) => <li key={insight.kind}><strong>{insight.title}</strong><span>{insight.body}</span></li>)}
        </ul>}

        <section className="verdict-finalists" aria-labelledby="finalists-title">
          <div>
            <p className="eyebrow">The short list</p>
            <h2 id="finalists-title">Five possible adventures.</h2>
          </div>
          <div className="verdict-finalists__list">
            {results.group.map((finalist) => <button key={finalist.id} className={activeId === finalist.id ? 'is-active' : undefined} onClick={() => setActiveId(finalist.id)}>
              <MediaImage src={finalist.imageUrl} alt="" fallbackLabel="Photo unavailable" />
              <span>#{finalist.rank}</span><strong>{finalist.name}</strong><small>{finalist.consensus === 'broad-consensus' ? 'Broad crew fit' : finalist.consensus === 'mixed' ? 'Mixed crew read' : 'Conversation starter'}</small>
            </button>)}
          </div>
        </section>

        <FinalistMatrix finalists={results.group} ranks={results.finalistRanks} travelerName={travelerName} currentUser={currentUser} onSelect={setActiveId} />
        <section className="verdict-roster" aria-labelledby="verdict-roster-title">
          <p className="eyebrow">The party’s picks</p>
          <h2 id="verdict-roster-title">Everyone’s top three.</h2>
          <div>
            {results.members.map((member) => <article key={member.user}>
              <img src={avatarFor(member.user)} alt="" />
              <h3>{travelerName(member.user)}{member.user === currentUser ? ' · you' : ''}</h3>
              <ol>{member.topThree.map((place) => <li key={place.id}><span>#{place.rank}</span><MediaImage src={place.imageUrl} alt="" fallbackLabel="Photo unavailable" /><strong>{place.name}</strong></li>)}</ol>
            </article>)}
          </div>
        </section>

        <section className="final-decision-panel" aria-labelledby="next-step-title">
          <div>
            <p className="eyebrow">One last call</p>
            <h2 id="next-step-title">What should the crew explore next?</h2>
            <p>Choose one finalist to champion, or flag that you need more research. This is a conversation starter—not a rerank.</p>
            <TravelEffortKey />
          </div>
          {recordedDecision
            ? <div className="final-decision-panel__saved" role="status"><strong>Locked in: {decisionLabel(recordedDecision.choice, results.group)}.</strong><span>Saved after the reveal. This one stays put, even after a refresh.</span></div>
            : <div className="final-decision-panel__choices">
              {results.group.map((finalist) => <button key={finalist.id} className="lgs-button lgs-button--secondary" onClick={() => requestDecision(finalist.id)}>Explore {finalist.name}</button>)}
              <button className="lgs-button lgs-button--ghost" onClick={() => requestDecision('need-more-research')}>Need more research</button>
            </div>}
        </section>
      </section>

      <FinalistDrawer finalist={activeFinalist} onClose={() => setActiveId('')} onChoose={requestDecision} decisionRecorded={Boolean(recordedDecision)} />
      <FinalDecisionDialog
        open={pendingChoice !== null}
        choiceLabel={pendingChoice ? decisionLabel(pendingChoice, results.group) : ''}
        isSaving={isSaving}
        error={decisionError}
        onCancel={() => { if (!isSaving) { setPendingChoice(null); setDecisionError(''); } }}
        onConfirm={() => void confirmDecision()}
      />
    </main>
  );
}
