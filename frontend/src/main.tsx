import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import NumberFlow from '@number-flow/react';
import { MeshGradient } from '@paper-design/shaders-react';
import { createRoot } from 'react-dom/client';
import type { AtlasDestination, FinalDecision, FinalDecisionChoice, GroupStatus, NextComparisonResponse, PreferenceProfile, RosterUser, TransparentGroupResultsResponse } from '@lgs/shared';
import '../../design-system/base.css';
import '../../design-system/components.css';
import logoUrl from '../../design-system/assets/logo.png';
import danAvatar from '../../assets/images/dan_cutout.png';
import jamesAvatar from '../../assets/images/james_cutout.png';
import johnAvatar from '../../assets/images/john_cutout.png';
import mattAvatar from '../../assets/images/matt_cutout.png';
import peterAvatar from '../../assets/images/peter_cutout.png';
import { AtlasExplorer } from './AtlasExplorer.js';
import { ApiError, createApiClient, routeIntentForApiError, type ApiAuthentication, type OneTripApiClient } from './api.js';
import { AppStateNotice, CompletedTransition, JourneyNav, MediaImage, TravelEffortKey, type JourneyDestination } from './components/index.js';
import { getRestoredGoogleToken, signInWithEmulatorRehearsalUser, signInWithGoogle, usesAuthEmulatorRehearsal } from './firebase.js';
import { HowItWorksButton, HowItWorksScreen, MyResultsScreen, ProfileScreen, VerdictScreen, WaitingScreen } from './screens/index.js';
import { HOW_IT_WORKS_HASH, howItWorksBackLabel, needsHowItWorksBriefing } from './howItWorks.js';
import { createVerdictFixture, fixtureTravelerNames } from './screens/verdictFixtures.js';
import { DevPreview } from './DevPreview.js';
import type { AppScreen } from './types.js';
import './app.css';

type Traveler = { id: RosterUser; name: string; role: string; image: string; accent: string };
const travelers: readonly Traveler[] = [
  { id: 'dan', name: 'Dan', role: 'Trip wrangler', image: danAvatar, accent: 'amber' },
  { id: 'james', name: 'James', role: 'Curiosity engine', image: jamesAvatar, accent: 'terra' },
  { id: 'john', name: 'John', role: 'Good-times scout', image: johnAvatar, accent: 'blue' },
  { id: 'matt', name: 'Matt', role: 'Trail negotiator', image: mattAvatar, accent: 'olive' },
  { id: 'peter', name: 'Peter', role: 'Wildcard energy', image: peterAvatar, accent: 'violet' },
];
const rosterKey = 'lgs-selected-traveler';
const travelerById = (id: RosterUser) => travelers.find((traveler) => traveler.id === id)!;
const travelerName = (id: RosterUser) => travelerById(id).name;
const progressMessage = (count: number) => count < 8 ? 'Start with your first instinct.' : count < 18 ? 'You’re on a roll.' : count < 28 ? 'Almost there — just a few quick picks left.' : 'Final picks. Your top five is almost ready.';
const journeyHash: Record<JourneyDestination, string> = { profile: 'rhythm', shortlist: 'shortlist', atlas: 'atlas', waiting: 'crew', verdict: 'reveal' };
const journeyDestinationFromHash = (): JourneyDestination | undefined => (Object.entries(journeyHash).find(([, hash]) => `#${hash}` === window.location.hash)?.[0] as JourneyDestination | undefined);
const activeJourneyDestination = (screen: AppScreen): JourneyDestination | undefined => {
  if (screen === 'profile') return 'profile';
  if (screen === 'my-results') return 'shortlist';
  if (screen === 'atlas') return 'atlas';
  if (screen === 'waiting') return 'waiting';
  if (screen === 'verdict') return 'verdict';
  return undefined;
};

function Ambient() { return <div className="ambient-field" aria-hidden="true"><MeshGradient colors={['#d4924d', '#4b7eb2', '#c04f3d', '#6d8c4a']} distortion={.7} swirl={.25} speed={.12} style={{ width: '100%', height: '100%' }} /></div>; }
function Avatar({ id, large = false, className = '' }: { id: RosterUser; large?: boolean; className?: string }) { return <img className={`avatar-art ${large ? 'avatar-art--large' : ''} ${className}`} src={travelerById(id).image} alt="" />; }
function storedTraveler(): RosterUser | undefined { const value = typeof window === 'undefined' ? null : window.localStorage.getItem(rosterKey); return travelers.some((traveler) => traveler.id === value) ? value as RosterUser : undefined; }

function AtlasScreen({ destinations, user, onOpenWaiting, onOpenProfile }: { destinations: AtlasDestination[]; user: RosterUser; onOpenWaiting: () => void; onOpenProfile: () => void }) {
  return <AtlasExplorer destinations={destinations} user={user} travelerName={travelerName} avatarSrc={travelerById(user).image} onOpenWaiting={onOpenWaiting} onOpenProfile={onOpenProfile} />;
}

function App() {
  const [screen, setScreen] = useState<AppScreen>('welcome');
  const [howItWorksReturn, setHowItWorksReturn] = useState<AppScreen>('welcome');
  const [howItWorksRequired, setHowItWorksRequired] = useState(false);
  const [user, setUser] = useState<RosterUser>(); const [token, setToken] = useState<string>(); const [selected, setSelected] = useState<RosterUser>(); const [spinning, setSpinning] = useState<RosterUser>();
  const [next, setNext] = useState<NextComparisonResponse>(); const [profile, setProfile] = useState<PreferenceProfile>(); const [atlas, setAtlas] = useState<AtlasDestination[]>([]); const [status, setStatus] = useState<GroupStatus>(); const [results, setResults] = useState<TransparentGroupResultsResponse>(); const [myResults, setMyResults] = useState<Awaited<ReturnType<OneTripApiClient['getPersonalResults']>>>();
  const [picked, setPicked] = useState(''); const [toast, setToast] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [booting, setBooting] = useState(true); const bootstrapOnce = useRef(false); const handledJourneyHash = useRef(''); const screenRef = useRef<AppScreen>('welcome'); const howItWorksReturnRef = useRef<AppScreen>('welcome');
  const api = useMemo(() => user ? createApiClient({ user, token }) : undefined, [token, user]);
  const setJourneyHash = useCallback((destination: JourneyDestination, replace = false) => {
    const hash = `#${journeyHash[destination]}`;
    if (window.location.hash === hash) return;
    handledJourneyHash.current = hash;
    window.history[replace ? 'replaceState' : 'pushState'](null, '', hash);
  }, []);

  const handleRouteError = useCallback(async (reason: unknown, source: Parameters<typeof routeIntentForApiError>[1]) => {
    const message = reason instanceof Error ? reason.message : 'We lost the trail for a moment. Please try again.';
    if (!(reason instanceof ApiError)) { setError(message); return; }
    const intent = routeIntentForApiError(reason, source);
    if (intent === 'return-to-comparison') { setError('Your choices are still in progress. Returning you to the game.'); setScreen('comparison'); }
    else if (intent === 'show-waiting') { setError('The envelope is still sealed. You can see who has finished.'); setScreen('waiting'); }
    else if (intent === 'show-sign-in') { window.localStorage.removeItem(rosterKey); setUser(undefined); setToken(undefined); setScreen('character'); setError('Please sign in again with the account that belongs to your traveler.'); }
    else if (intent === 'show-access-error') { setScreen('character'); setError('That Google account is not on this trip roster. Choose the traveler that matches your account.'); }
    else setError(message);
  }, []);
  const loadProfile = useCallback(async (client: OneTripApiClient, updateHash = true) => { try { const response = await client.getProfile(); setProfile(response.profile); setScreen('profile'); if (updateHash) setJourneyHash('profile', true); } catch (reason) { await handleRouteError(reason, 'profile'); } }, [handleRouteError, setJourneyHash]);
  const loadComparison = useCallback(async (client: OneTripApiClient) => { try { const response = await client.getNextComparison(); setNext(response); setScreen(response.complete ? 'completed-transition' : 'comparison'); } catch (reason) { await handleRouteError(reason, 'comparison'); } }, [handleRouteError]);
  const enterJourney = useCallback(async (authentication: ApiAuthentication) => {
    const client = createApiClient(authentication); setBusy(true); setError('');
    try { const session = await client.getSession(); if (session.user !== authentication.user) throw new Error(`That Google account belongs to ${travelerName(session.user)}. Choose that traveler to continue.`); setUser(session.user); setToken(authentication.token); window.localStorage.setItem(rosterKey, session.user); const comparison = await client.getNextComparison(); setNext(comparison); if (comparison.complete) { setScreen('completed-transition'); const profileResponse = await client.getProfile(); setProfile(profileResponse.profile); setScreen('profile'); } else if (needsHowItWorksBriefing(comparison.progress.comparisons)) { setHowItWorksReturn('character'); howItWorksReturnRef.current = 'character'; setHowItWorksRequired(true); window.history.replaceState(null, '', HOW_IT_WORKS_HASH); setScreen('how-it-works'); } else setScreen('comparison'); }
    catch (reason) { window.localStorage.removeItem(rosterKey); setError(reason instanceof Error ? reason.message : 'We couldn’t resume your trip.'); setScreen('character'); }
    finally { setBusy(false); setBooting(false); }
  }, []);
  useEffect(() => { if (bootstrapOnce.current) return; bootstrapOnce.current = true; const rosterUser = storedTraveler(); if (!rosterUser) { setBooting(false); return; } void (async () => { const restoredToken = import.meta.env.PROD ? await getRestoredGoogleToken() : undefined; if (import.meta.env.PROD && !restoredToken) { window.localStorage.removeItem(rosterKey); setBooting(false); return; } await enterJourney({ user: rosterUser, token: restoredToken }); })(); }, [enterJourney]);
  useEffect(() => { if (screen === 'completed-transition' && api && !profile && !busy) void loadProfile(api); }, [api, busy, loadProfile, profile, screen]);
  useEffect(() => { screenRef.current = screen; }, [screen]);

  const signIn = async () => {
    if (!selected) return;
    try {
      const token = usesAuthEmulatorRehearsal()
        ? await signInWithEmulatorRehearsalUser(selected)
        : import.meta.env.PROD ? await signInWithGoogle() : undefined;
      await enterJourney({ user: selected, token });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Google sign-in failed.'); setBusy(false); }
  };
  const choose = async (winner: string) => { if (!api || !next || next.complete || picked) return; setPicked(winner); setError(''); try { await api.submitComparison({ activityA: next.activityA.id, activityB: next.activityB.id, winner }); window.setTimeout(() => { setPicked(''); void loadComparison(api); }, 180); } catch (reason) { setPicked(''); await handleRouteError(reason, 'comparison'); } };
  const openAtlas = async (updateHash = true) => { if (!api) return; setBusy(true); setError(''); try { const response = await api.getAtlas(); setAtlas(response.destinations); setScreen('atlas'); if (updateHash) setJourneyHash('atlas'); } catch (reason) { await handleRouteError(reason, 'atlas'); } finally { setBusy(false); } };
  const refreshStatus = useCallback(async () => { if (!api) return; try { const response = await api.getGroupStatus(); setStatus(response); return response; } catch (reason) { await handleRouteError(reason, 'group-status'); throw reason; } }, [api, handleRouteError]);
  const openWaiting = async (updateHash = true) => { const refreshed = await refreshStatus(); if (refreshed) { setScreen('waiting'); if (updateHash) setJourneyHash('waiting'); } };
  const openVerdict = async (updateHash = true) => { if (!api) return; setBusy(true); setError(''); try { setResults(await api.getGroupResults()); setScreen('verdict'); if (updateHash) setJourneyHash('verdict'); } catch (reason) { await handleRouteError(reason, 'group-results'); await refreshStatus().catch(() => undefined); } finally { setBusy(false); } };
  const reveal = async () => { if (!api) return; setBusy(true); setError(''); try { await api.openReveal(); await openVerdict(); } catch (reason) { await handleRouteError(reason, 'group-status'); await refreshStatus().catch(() => undefined); } finally { setBusy(false); } };
  const openMyResults = async (updateHash = true) => { if (!api) return; setBusy(true); setError(''); try { setMyResults(await api.getPersonalResults()); setScreen('my-results'); if (updateHash) setJourneyHash('shortlist'); } catch (reason) { await handleRouteError(reason, 'personal-results'); await refreshStatus().catch(() => undefined); } finally { setBusy(false); } };
  const navigateJourney = useCallback((destination: JourneyDestination, updateHash = true) => {
    if (destination === 'profile') {
      if (profile) { setScreen('profile'); if (updateHash) setJourneyHash('profile'); }
      else if (api) void loadProfile(api, updateHash);
      return;
    }
    if (destination === 'shortlist') { void openMyResults(updateHash); return; }
    if (destination === 'atlas') { void openAtlas(updateHash); return; }
    if (destination === 'waiting') { void openWaiting(updateHash); return; }
    void openVerdict(updateHash);
  }, [api, loadProfile, openAtlas, openMyResults, openVerdict, openWaiting, profile, setJourneyHash]);
  const openHowItWorks = useCallback((origin = screenRef.current) => {
    howItWorksReturnRef.current = origin;
    setHowItWorksReturn(origin);
    setHowItWorksRequired(false);
    window.history.pushState({ lgsHowItWorks: true }, '', HOW_IT_WORKS_HASH);
    setScreen('how-it-works');
  }, []);
  const closeHowItWorks = useCallback(() => {
    const destination = howItWorksReturnRef.current;
    if (howItWorksRequired) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      setScreen(destination);
    } else if (window.location.hash === HOW_IT_WORKS_HASH && window.history.state?.lgsHowItWorks) window.history.back();
    else { window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`); setScreen(destination); }
  }, [howItWorksRequired]);
  const startChoices = useCallback(() => {
    setHowItWorksRequired(false);
    if (window.location.hash === HOW_IT_WORKS_HASH) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    setScreen('comparison');
  }, []);
  useEffect(() => {
    const resolveHowItWorksHash = () => {
      if (window.location.hash === HOW_IT_WORKS_HASH && screenRef.current !== 'how-it-works') {
        howItWorksReturnRef.current = screenRef.current;
        setHowItWorksReturn(screenRef.current);
        setHowItWorksRequired(false);
        setScreen('how-it-works');
      } else if (window.location.hash !== HOW_IT_WORKS_HASH && screenRef.current === 'how-it-works') {
        setScreen(howItWorksReturnRef.current);
      }
    };
    resolveHowItWorksHash();
    window.addEventListener('popstate', resolveHowItWorksHash);
    window.addEventListener('hashchange', resolveHowItWorksHash);
    return () => { window.removeEventListener('popstate', resolveHowItWorksHash); window.removeEventListener('hashchange', resolveHowItWorksHash); };
  }, []);
  useEffect(() => {
    if (!api || !profile) return;
    const restoreFromHash = () => {
      if (window.location.hash === handledJourneyHash.current) return;
      handledJourneyHash.current = window.location.hash;
      const destination = journeyDestinationFromHash();
      if (destination) navigateJourney(destination, false);
    };
    restoreFromHash();
    window.addEventListener('popstate', restoreFromHash);
    window.addEventListener('hashchange', restoreFromHash);
    return () => { window.removeEventListener('popstate', restoreFromHash); window.removeEventListener('hashchange', restoreFromHash); };
  }, [api, navigateJourney, profile]);
  const saveFinalDecision = async (choice: FinalDecisionChoice): Promise<FinalDecision> => { if (!api) throw new Error('Sign in again before saving your next step.'); try { const response = await api.recordFinalDecision(choice); if (!response.decision) throw new Error('The saved decision was missing from the response.'); return response.decision; } catch (reason) { if (reason instanceof ApiError && routeIntentForApiError(reason, 'final-decision') === 'use-recorded-decision') { const existing = await api.getFinalDecision(); if (existing.decision) return existing.decision; } throw reason; } };
  const selectTraveler = (id: RosterUser) => { if (spinning) return; setSelected(id); setSpinning(id); setToast(`${travelerName(id)} is ready to roll.`); window.setTimeout(() => setSpinning(undefined), 750); window.setTimeout(() => setToast(''), 1800); };
  const notice = error ? <div className="app-notice-overlay"><AppStateNotice tone="error" title="A quick detour">{error}</AppStateNotice></div> : null;
  const currentJourney = activeJourneyDestination(screen);
  const journeyNav = user && profile && currentJourney
    ? <JourneyNav active={currentJourney} revealOpen={Boolean(results || status?.revealOpen)} onNavigate={(destination) => navigateJourney(destination)} />
    : null;
  const help = screen !== 'how-it-works' ? <HowItWorksButton onClick={() => openHowItWorks()} /> : null;
  if (booting) return <main className="one-trip-screen"><AppStateNotice tone="loading" title="Finding your saved route">Checking whether your traveler has an unfinished journey.</AppStateNotice></main>;
  if (screen === 'welcome') return <><main className="welcome-shell screen-enter"><Ambient /><section className="welcome"><img src={logoUrl} alt="Let's Go Somewhere" className="logo" /><p className="eyebrow">Five friends. One real decision.</p><h1>Let the trip<br /><em>take shape.</em></h1><p className="lede">A game for deciding where your group should go. Pick the experiences you like more; the place names stay hidden while you play.</p><div className="how-it-works"><span><b>01</b> Pick your traveler</span><span><b>02</b> Pick your favorites</span><span><b>03</b> Explore all 24 places</span></div><button className="lgs-button lgs-button--primary welcome-cta" onClick={() => setScreen('character')}>Meet everyone →</button></section>{notice}</main>{help}</>;
  if (screen === 'character') return <><main className="character-shell character-shell--spin screen-enter"><header className="topbar"><button className="back-button" onClick={() => setScreen('welcome')} aria-label="Back to welcome">←</button><img src={logoUrl} alt="Let's Go Somewhere" className="topbar-logo" /><span className="character-step">Step 1 of 2</span></header><section className="character-selection" aria-labelledby="character-title"><div className="character-intro"><p className="eyebrow">Choose your traveler</p><h1 id="character-title">Who’s picking<br />the favorites?</h1><p className="lede">Say hello, then choose the traveler that matches your Google account.</p></div><div className="roster-heading"><span>Meet everyone</span><b>{selected ? 'Traveler selected' : 'Pick one to begin'}</b></div><div className="traveler-roster" role="group" aria-label="Choose your traveler">{travelers.map((traveler) => <button key={traveler.id} className={`traveler traveler--${traveler.accent} ${selected === traveler.id ? 'traveler--selected' : ''} ${spinning === traveler.id ? 'traveler--spinning' : ''}`} onClick={() => selectTraveler(traveler.id)} aria-pressed={selected === traveler.id} disabled={Boolean(spinning) && spinning !== traveler.id}><span className="traveler-stage"><i className="traveler-shadow" /><Avatar id={traveler.id} large className="traveler-figure" /></span><span className="traveler-label"><strong>{traveler.name}</strong><small>{traveler.role}</small></span><span className="traveler-check" aria-hidden="true">✓</span></button>)}</div><p className="selection-toast" role="status" aria-live="polite">{toast ? `✦ ${toast}` : 'Choose your traveler to continue.'}</p></section><footer className="character-action"><span>{selected ? `${travelerName(selected)} selected` : 'Your traveler appears again when the group sees the results.'}</span><button className="lgs-button lgs-button--primary" disabled={!selected || Boolean(spinning) || busy} onClick={() => void signIn()}>{busy ? 'Checking your account…' : selected ? `Continue as ${travelerName(selected)}` : 'Choose your traveler'} →</button></footer>{notice}</main>{help}</>;
  if (screen === 'how-it-works') return <HowItWorksScreen travelers={travelers} required={howItWorksRequired} backLabel={howItWorksRequired ? 'Back to character selection' : howItWorksBackLabel(howItWorksReturn)} onBack={closeHowItWorks} onStartChoices={howItWorksRequired ? startChoices : undefined} />;
  if (screen === 'completed-transition') return <><main className="one-trip-screen"><CompletedTransition complete={Boolean(profile)} />{busy && <p className="topo-loader">Getting your top five ready…</p>}{notice}</main>{help}</>;
  if (screen === 'profile' && profile) return <>{journeyNav}<ProfileScreen profile={profile} onOpenAtlas={() => void openAtlas()} onOpenWaiting={() => void openWaiting()} onOpenMyResults={() => void openMyResults()} revealOpen={Boolean(results || status?.revealOpen)} focusHeading />{notice}{help}</>;
  if (screen === 'atlas' && user) return <>{journeyNav}<AtlasScreen destinations={atlas} user={user} onOpenWaiting={() => void openWaiting()} onOpenProfile={() => navigateJourney('profile')} />{notice}{help}</>;
  if (screen === 'waiting' && status && user) return <>{journeyNav}<WaitingScreen status={status} user={user} travelerName={travelerName} onRefresh={refreshStatus} onBackToAtlas={() => void openAtlas()} onOpenReveal={() => void reveal()} onOpenVerdict={() => void openVerdict()} focusHeading />{notice}{help}</>;
  if (screen === 'verdict' && results && user) return <>{journeyNav}<VerdictScreen results={results} currentUser={user} travelerName={travelerName} avatarFor={(id) => travelerById(id).image} onOpenMyResults={() => void openMyResults()} onRecordDecision={saveFinalDecision} />{notice}{help}</>;
  if (screen === 'my-results' && myResults) return <>{journeyNav}<MyResultsScreen results={myResults} onBack={() => navigateJourney(results ? 'verdict' : 'profile')} backLabel={results ? 'Back to the group reveal' : 'Back to what I liked'} />{notice}{help}</>;
  if (screen !== 'comparison') return <><main className="one-trip-screen"><AppStateNotice tone={error ? 'error' : 'loading'} title={error ? 'That route needs a moment' : 'Preparing your route'}>{error || 'Loading the right place in your trip.'}</AppStateNotice></main>{help}</>;
  const activities = next && !next.complete ? [next.activityA, next.activityB] : [];
  const progress = next && !next.complete ? next.progress : { comparisons: 0, minimum: 32, maximum: 32, estimatedCompletion: 0 };
  return <><main className="game-shell screen-enter"><header className="game-topbar"><img src={logoUrl} alt="Let's Go Somewhere" className="topbar-logo" />{user && <div className="turn-meta"><Avatar id={user} />{travelerName(user)}’s turn</div>}</header><section className="game-heading"><p className="eyebrow">Trust your first instinct</p><div className="game-title-row"><h1>Which sounds better?</h1><span><NumberFlow value={progress.comparisons} /> picked</span></div><div className="game-progress"><i style={{ width: `${progress.estimatedCompletion * 100}%` }} /></div><p className="progress-message">{progressMessage(progress.comparisons)} <b><NumberFlow value={progress.comparisons} /> of <NumberFlow value={progress.maximum} /> choices</b></p></section>{busy && !activities.length ? <p className="topo-loader">Finding your next choice…</p> : <section className="choice-stage">{activities.map((activity, index) => <button key={activity.id} className={`choice-card choice-card--${index} ${picked === activity.id ? 'choice-card--picked' : ''}`} onClick={() => void choose(activity.id)} disabled={Boolean(picked)}><i className="choice-photo" style={{ backgroundImage: `url(${activity.imageUrl})` }} /><i className="choice-photo-wash" /><span className="choice-pick">I’d rather… ↗</span><span className="choice-copy"><strong>{activity.title}</strong><small>{activity.description}</small></span></button>)}</section>}<div className="or-divider"><span />OR<span /></div>{notice}</main>{help}</>;
}

const fixtureMode = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('fixture') : null;
const fixtureOverlay = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('overlay') : null;
const fixtureAvatar = (id: RosterUser) => travelerById(id).image;

// Local visual-QA route only. It uses deterministic, post-gate fixture data
// and is excluded from production behavior by the Vite DEV guard above.
const root = createRoot(document.getElementById('root')!);
if (fixtureMode === 'trip-preview') {
  root.render(<DevPreview />);
} else if (fixtureMode === 'transparent-reveal') {
  const displayMode = fixtureOverlay === 'near-tie' ? 'near-tie' : fixtureOverlay === 'no-consensus' ? 'no-consensus' : fixtureOverlay === 'broad-leader' ? 'broad-leader' : 'shared-shortlist';
  const socialOverlay = fixtureOverlay === 'wild-card' || fixtureOverlay === 'two-camps' || fixtureOverlay === 'split' ? fixtureOverlay : undefined;
  root.render(<VerdictScreen results={createVerdictFixture(displayMode, socialOverlay)} currentUser="dan" travelerName={(id) => fixtureTravelerNames[id]} avatarFor={fixtureAvatar} onOpenMyResults={() => undefined} onRecordDecision={async (choice) => ({ user: 'dan', choice, createdAt: '2026-08-19T00:00:00.000Z' })} />);
} else {
  root.render(<App />);
}
