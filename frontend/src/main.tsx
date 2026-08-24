import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import NumberFlow from '@number-flow/react';
import { MeshGradient } from '@paper-design/shaders-react';
import { createRoot } from 'react-dom/client';
import type { AtlasDestination, GroupStatus, LightningGroupResults, LightningGroupStatus, LightningNextComparisonResponse, LightningPersonalResults, LightningStatus, NextComparisonResponse, PreferenceProfile, RosterUser, TransparentGroupResultsResponse } from '@lgs/shared';
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
import { AppStateNotice, CompletedTransition, JourneyNav, MediaImage, TravelEffortKey } from './components/index.js';
import { getRestoredGoogleToken, signInWithEmulatorRehearsalUser, signInWithGoogle, usesAuthEmulatorRehearsal } from './firebase.js';
import { HowItWorksButton, HowItWorksScreen, LightningComparisonScreen, LightningIntroScreen, LightningPersonalResultsScreen, LightningVerdictScreen, LightningVetoScreen, LightningWaitingScreen, MyResultsScreen, ProfileScreen, VerdictScreen, WaitingScreen } from './screens/index.js';
import { HOW_IT_WORKS_HASH, canOpenHowItWorksHelp, howItWorksBackLabel, needsHowItWorksBriefing } from './howItWorks.js';
import { createVerdictFixture, fixtureTravelerNames } from './screens/verdictFixtures.js';
import { DevPreview } from './DevPreview.js';
import { canDisplayJourneyDestination, journeyDestinationForScreen, journeyDestinationFromHash, journeyHashFor, type JourneyDestination } from './journeyNavigation.js';
import type { AppScreen } from './types.js';
import './app.css';

type Traveler = { id: RosterUser; name: string; role: string; image: string; accent: string };
const travelers: readonly Traveler[] = [
  { id: 'dan', name: 'Dan', role: '', image: danAvatar, accent: 'amber' },
  { id: 'james', name: 'James', role: '', image: jamesAvatar, accent: 'terra' },
  { id: 'john', name: 'John', role: '', image: johnAvatar, accent: 'blue' },
  { id: 'matt', name: 'Matt', role: '', image: mattAvatar, accent: 'olive' },
  { id: 'peter', name: 'Peter', role: '', image: peterAvatar, accent: 'violet' },
];
const rosterKey = 'lgs-selected-traveler';
const travelerById = (id: RosterUser) => travelers.find((traveler) => traveler.id === id)!;
const travelerName = (id: RosterUser) => travelerById(id).name;
const progressMessage = (count: number) => count < 8 ? 'Start with your first instinct.' : count < 18 ? 'You’re on a roll.' : count < 28 ? 'Almost there — just a few quick picks left.' : 'Final picks. Your top five is almost ready.';

function Ambient() { return <div className="ambient-field" aria-hidden="true"><MeshGradient colors={['#d4924d', '#4b7eb2', '#c04f3d', '#6d8c4a']} distortion={.7} swirl={.25} speed={.12} style={{ width: '100%', height: '100%' }} /></div>; }
function Avatar({ id, large = false, className = '' }: { id: RosterUser; large?: boolean; className?: string }) { return <img className={`avatar-art ${large ? 'avatar-art--large' : ''} ${className}`} src={travelerById(id).image} alt="" />; }
function storedTraveler(): RosterUser | undefined { const value = typeof window === 'undefined' ? null : window.localStorage.getItem(rosterKey); return travelers.some((traveler) => traveler.id === value) ? value as RosterUser : undefined; }

function AtlasScreen({ destinations, user, onOpenWaiting, focusHeading }: { destinations: AtlasDestination[]; user: RosterUser; onOpenWaiting: () => void; focusHeading?: number }) {
  return <AtlasExplorer destinations={destinations} user={user} travelerName={travelerName} avatarSrc={travelerById(user).image} onOpenWaiting={onOpenWaiting} focusHeading={focusHeading} />;
}

function App() {
  const [screen, setScreen] = useState<AppScreen>('welcome');
  const [howItWorksReturn, setHowItWorksReturn] = useState<AppScreen>('welcome');
  const [howItWorksRequired, setHowItWorksRequired] = useState(false);
  const [user, setUser] = useState<RosterUser>(); const [token, setToken] = useState<string>(); const [selected, setSelected] = useState<RosterUser>(); const [spinning, setSpinning] = useState<RosterUser>();
  const [next, setNext] = useState<NextComparisonResponse>(); const [profile, setProfile] = useState<PreferenceProfile>(); const [atlas, setAtlas] = useState<AtlasDestination[]>([]); const [status, setStatus] = useState<GroupStatus>(); const [results, setResults] = useState<TransparentGroupResultsResponse>(); const [myResults, setMyResults] = useState<Awaited<ReturnType<OneTripApiClient['getPersonalResults']>>>();
  const [lightningNext, setLightningNext] = useState<LightningNextComparisonResponse>(); const [lightningStatus, setLightningStatus] = useState<LightningStatus>(); const [lightningPersonal, setLightningPersonal] = useState<LightningPersonalResults>(); const [lightningGroupStatus, setLightningGroupStatus] = useState<LightningGroupStatus>(); const [lightningGroupResults, setLightningGroupResults] = useState<LightningGroupResults>(); const [lightningPicked, setLightningPicked] = useState('');
  const [picked, setPicked] = useState(''); const [toast, setToast] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [booting, setBooting] = useState(true); const [revealSeen, setRevealSeen] = useState(false); const [journeyFocus, setJourneyFocus] = useState<{ destination: JourneyDestination; token: number }>(); const bootstrapOnce = useRef(false); const handledJourneyHash = useRef(''); const screenRef = useRef<AppScreen>('welcome'); const howItWorksReturnRef = useRef<AppScreen>('welcome'); const signedInTravelerRef = useRef<RosterUser | undefined>(undefined);
  const api = useMemo(() => user ? createApiClient({ user, token }) : undefined, [token, user]);
  const setJourneyHash = useCallback((destination: JourneyDestination, replace = false) => {
    const hash = journeyHashFor(destination);
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
    try { const session = await client.getSession(); if (session.user !== authentication.user) throw new Error(`That Google account belongs to ${travelerName(session.user)}. Choose that traveler to continue.`); setUser(session.user); setToken(authentication.token); window.localStorage.setItem(rosterKey, session.user); const comparison = await client.getNextComparison(); setNext(comparison); if (comparison.complete) { setScreen('completed-transition'); const profileResponse = await client.getProfile(); setProfile(profileResponse.profile); setScreen('profile'); } else if (needsHowItWorksBriefing(comparison.progress.comparisons)) { setHowItWorksReturn('character'); howItWorksReturnRef.current = 'character'; setHowItWorksRequired(true); window.history.replaceState(null, '', HOW_IT_WORKS_HASH); setScreen('how-it-works'); } else { window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`); setScreen('comparison'); } }
    catch (reason) { window.localStorage.removeItem(rosterKey); setError(reason instanceof Error ? reason.message : 'We couldn’t resume your trip.'); setScreen('character'); }
    finally { setBusy(false); setBooting(false); }
  }, []);
  useEffect(() => { if (bootstrapOnce.current) return; bootstrapOnce.current = true; const rosterUser = storedTraveler(); if (!rosterUser) { setBooting(false); return; } void (async () => { const restoredToken = import.meta.env.PROD ? await getRestoredGoogleToken() : undefined; if (import.meta.env.PROD && !restoredToken) { window.localStorage.removeItem(rosterKey); setBooting(false); return; } await enterJourney({ user: rosterUser, token: restoredToken }); })(); }, [enterJourney]);
  useEffect(() => { if (screen === 'completed-transition' && api && !profile && !busy) void loadProfile(api); }, [api, busy, loadProfile, profile, screen]);
  useEffect(() => { screenRef.current = screen; }, [screen]);
  useEffect(() => { signedInTravelerRef.current = user; }, [user]);

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
  const refreshStatus = useCallback(async (redirectOnError = true) => { if (!api) return; try { const response = await api.getGroupStatus(); setStatus(response); return response; } catch (reason) { if (redirectOnError) await handleRouteError(reason, 'group-status'); throw reason; } }, [api, handleRouteError]);
  useEffect(() => {
    if (api && profile) void refreshStatus(false).catch(() => undefined);
  }, [api, profile, refreshStatus]);
  const openWaiting = async (updateHash = true) => { const refreshed = await refreshStatus(); if (refreshed) { setScreen('waiting'); if (updateHash) setJourneyHash('waiting'); } };
  const openVerdict = async (updateHash = true) => { if (!api) return; setBusy(true); setError(''); try { setResults(await api.getGroupResults()); setScreen('verdict'); if (updateHash) setJourneyHash('verdict'); } catch (reason) { const intent = reason instanceof ApiError ? routeIntentForApiError(reason, 'group-results') : undefined; await handleRouteError(reason, 'group-results'); if (intent === 'show-waiting') setJourneyHash('waiting', true); await refreshStatus().catch(() => undefined); } finally { setBusy(false); } };
  const reveal = async () => { if (!api) return; setBusy(true); setError(''); try { await api.openReveal(); await openVerdict(); } catch (reason) { await handleRouteError(reason, 'group-status'); await refreshStatus().catch(() => undefined); } finally { setBusy(false); } };
  const openMyResults = async (updateHash = true) => { if (!api) return; setBusy(true); setError(''); try { setMyResults(await api.getPersonalResults()); setScreen('my-results'); if (updateHash) setJourneyHash('shortlist'); } catch (reason) { await handleRouteError(reason, 'personal-results'); await refreshStatus().catch(() => undefined); } finally { setBusy(false); } };
  const openLightning = async () => {
    if (!api) return; setBusy(true); setError('');
    try { const round = await api.getLightningStatus(); setLightningStatus(round); if (round.revealOpen) { setLightningGroupResults(await api.getLightningGroupResults()); setScreen('lightning-verdict'); } else if (round.rankingComplete) { setLightningPersonal(await api.getLightningPersonalResults()); setScreen('lightning-results'); } else if (round.progress.comparisons > 0) { const nextRound = await api.getNextLightningComparison(); setLightningNext(nextRound); setScreen(nextRound.complete ? 'lightning-results' : 'lightning-comparison'); } else setScreen('lightning-intro'); }
    catch (reason) { await handleRouteError(reason, 'lightning'); } finally { setBusy(false); }
  };
  const loadLightningComparison = async () => { if (!api) return; setBusy(true); try { const response = await api.getNextLightningComparison(); setLightningNext(response); if (response.complete) { setLightningPersonal(await api.getLightningPersonalResults()); setScreen('lightning-results'); } else setScreen('lightning-comparison'); } catch (reason) { await handleRouteError(reason, 'lightning'); } finally { setBusy(false); } };
  const chooseLightning = async (winner: string) => { if (!api || !lightningNext || lightningNext.complete || lightningPicked) return; setLightningPicked(winner); setError(''); try { await api.submitLightningComparison({ destinationA: lightningNext.destinationA.id, destinationB: lightningNext.destinationB.id, winner, revision: lightningNext.revision }); window.setTimeout(() => { setLightningPicked(''); void loadLightningComparison(); }, 170); } catch (reason) { setLightningPicked(''); await handleRouteError(reason, 'lightning'); } };
  const submitLightningVetoes = async (destinationIds: readonly string[]) => {
    if (!api) return false;
    setBusy(true); setError('');
    try {
      const response = await api.submitLightningVetoes(destinationIds);
      setLightningPersonal((current) => current ? { ...current, vetoes: response.vetoes } : current);
      setLightningStatus(await api.getLightningStatus());
      setScreen('lightning-results');
      return true;
    } catch (reason) {
      await handleRouteError(reason, 'lightning');
      return false;
    } finally { setBusy(false); }
  };
  const refreshLightningStatus = async () => { if (!api) return; try { const response = await api.getLightningGroupStatus(); setLightningGroupStatus(response); return response; } catch (reason) { await handleRouteError(reason, 'lightning'); return undefined; } };
  const openLightningWaiting = async () => { const state = await refreshLightningStatus(); if (state) setScreen('lightning-waiting'); };
  const revealLightning = async () => { if (!api) return; setBusy(true); try { await api.openLightningReveal(); setLightningGroupResults(await api.getLightningGroupResults()); setScreen('lightning-verdict'); } catch (reason) { await handleRouteError(reason, 'lightning'); } finally { setBusy(false); } };
  const openLightningVerdict = async () => { if (!api) return; setBusy(true); try { setLightningGroupResults(await api.getLightningGroupResults()); setScreen('lightning-verdict'); } catch (reason) { await handleRouteError(reason, 'lightning'); } finally { setBusy(false); } };
  const navigateJourney = useCallback((destination: JourneyDestination, updateHash = true) => {
    if (updateHash) setJourneyFocus((previous) => ({ destination, token: (previous?.token ?? 0) + 1 }));
    if (destination === 'profile') {
      if (profile) { setScreen('profile'); if (updateHash) setJourneyHash('profile'); }
      else if (api) void loadProfile(api, updateHash);
      return;
    }
    if (destination === 'shortlist') { void openMyResults(updateHash); return; }
    if (destination === 'atlas') { void openAtlas(updateHash); return; }
    if (destination === 'waiting') { void openWaiting(updateHash); return; }
    if (status && !canDisplayJourneyDestination(destination, Boolean(results || status.revealOpen))) {
      setError('The group results are still sealed. You can see who’s finished here.');
      void openWaiting(updateHash);
      return;
    }
    void openVerdict(updateHash);
  }, [api, loadProfile, openAtlas, openMyResults, openVerdict, openWaiting, profile, results, setJourneyHash, status?.revealOpen]);
  const openHowItWorks = useCallback((origin = screenRef.current) => {
    if (!user) return;
    howItWorksReturnRef.current = origin;
    setHowItWorksReturn(origin);
    setHowItWorksRequired(false);
    window.history.pushState({ lgsHowItWorks: true }, '', HOW_IT_WORKS_HASH);
    setScreen('how-it-works');
  }, [user]);
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
        if (!signedInTravelerRef.current) {
          window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
          return;
        }
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
      if (window.location.hash === HOW_IT_WORKS_HASH) return;
      const destination = journeyDestinationFromHash(window.location.hash);
      if (destination) {
        navigateJourney(destination, false);
        return;
      }
      setJourneyHash('profile', true);
      navigateJourney('profile', false);
    };
    restoreFromHash();
    window.addEventListener('popstate', restoreFromHash);
    window.addEventListener('hashchange', restoreFromHash);
    return () => { window.removeEventListener('popstate', restoreFromHash); window.removeEventListener('hashchange', restoreFromHash); };
  }, [api, navigateJourney, profile, setJourneyHash]);
  const selectTraveler = (id: RosterUser) => { if (spinning) return; setSelected(id); setSpinning(id); setToast(`${travelerName(id)} is ready to roll.`); window.setTimeout(() => setSpinning(undefined), 750); window.setTimeout(() => setToast(''), 1800); };
  const notice = error ? <div className="app-notice-overlay"><AppStateNotice tone="error" title="A quick detour">{error}</AppStateNotice></div> : null;
  useEffect(() => {
    if (screen === 'verdict') setRevealSeen(true);
  }, [screen]);
  const currentJourney = journeyDestinationForScreen(screen);
  const journeyNav = user && profile && currentJourney
    ? <JourneyNav active={currentJourney} revealOpen={Boolean(results || status?.revealOpen)} revealSeen={revealSeen} onNavigate={(destination) => navigateJourney(destination)} onOpenHowItWorks={() => openHowItWorks()} />
    : null;
  const help = !journeyNav && canOpenHowItWorksHelp(screen, Boolean(user)) ? <HowItWorksButton onClick={() => openHowItWorks()} /> : null;
  if (booting) return <main className="one-trip-screen"><AppStateNotice tone="loading" title="Finding your saved route">Checking whether your traveler has an unfinished journey.</AppStateNotice></main>;
  if (screen === 'welcome') return <><main className="welcome-shell screen-enter"><Ambient /><section className="welcome"><img src={logoUrl} alt="Let's Go Somewhere" className="logo" /><p className="eyebrow">Hey guys,</p><h1>Let's<em> go</em><br />somewhere.</h1><p className="lede">A this-or-that game for deciding where our group should go. Pick the experiences you like more and find out where everyone wants to go.</p><div className="how-it-works"><span><b>01</b> Pick your favorites</span><span><b>02</b> Explore all 24 places</span><span><b>03</b> Reveal the group's choices</span></div><button className="lgs-button lgs-button--primary welcome-cta" onClick={() => setScreen('character')}>Get started →</button></section>{notice}</main>{help}</>;
  if (screen === 'character') return <><main className="character-shell character-shell--spin screen-enter"><header className="topbar"><button className="back-button" onClick={() => setScreen('welcome')} aria-label="Back to welcome">←</button><img src={logoUrl} alt="Let's Go Somewhere" className="topbar-logo" /><span className="character-step">Step 1 of 2</span></header><section className="character-selection" aria-labelledby="character-title"><div className="character-intro"><p className="eyebrow">FIRST,</p><h1 id="character-title">CHOOSE YOUR TRAVELER</h1></div><div className="roster-heading"><span>Meet everyone</span><b>{selected ? 'Traveler selected' : 'Pick one to begin'}</b></div><div className="traveler-roster" role="group" aria-label="Choose your traveler">{travelers.map((traveler) => <button key={traveler.id} className={`traveler traveler--${traveler.accent} ${selected === traveler.id ? 'traveler--selected' : ''} ${spinning === traveler.id ? 'traveler--spinning' : ''}`} onClick={() => selectTraveler(traveler.id)} aria-pressed={selected === traveler.id} disabled={Boolean(spinning) && spinning !== traveler.id}><span className="traveler-stage"><i className="traveler-shadow" /><Avatar id={traveler.id} large className="traveler-figure" /></span><span className="traveler-label"><strong>{traveler.name}</strong><small>{traveler.role}</small></span><span className="traveler-check" aria-hidden="true">✓</span></button>)}</div></section><footer className="character-action"><span>{selected ? `${travelerName(selected)} selected` : 'You’ll be asked to log in with gmail next.'}</span><button className="lgs-button lgs-button--primary" disabled={!selected || Boolean(spinning) || busy} onClick={() => void signIn()}>{busy ? 'Checking your account…' : selected ? `Continue as ${travelerName(selected)} →` : 'Choose your traveler'}</button></footer>{notice}</main>{help}</>;
  if (screen === 'how-it-works') return <HowItWorksScreen travelers={travelers} required={howItWorksRequired} backLabel={howItWorksRequired ? 'Back to character selection' : howItWorksBackLabel(howItWorksReturn)} onBack={closeHowItWorks} onStartChoices={howItWorksRequired ? startChoices : undefined} />;
  if (screen === 'completed-transition') return <><main className="one-trip-screen"><CompletedTransition complete={Boolean(profile)} traveler={user} profile={profile} />{busy && <p className="topo-loader">Getting your top five ready…</p>}{notice}</main>{help}</>;
  if (screen === 'profile' && profile && user) return <>{journeyNav}<ProfileScreen profile={profile} traveler={user} onOpenMyResults={() => void openMyResults()} revealOpen={Boolean(results || status?.revealOpen)} focusHeading={journeyFocus?.destination === 'profile' ? journeyFocus.token : undefined} />{notice}{help}</>;
  if (screen === 'atlas' && user) return <>{journeyNav}<AtlasScreen destinations={atlas} user={user} onOpenWaiting={() => void openWaiting()} focusHeading={journeyFocus?.destination === 'atlas' ? journeyFocus.token : undefined} />{notice}{help}</>;
  if (screen === 'waiting' && status && user) return <>{journeyNav}<WaitingScreen status={status} user={user} travelerName={travelerName} onRefresh={() => refreshStatus()} onOpenReveal={() => void reveal()} onOpenVerdict={() => void openVerdict()} focusHeading={journeyFocus?.destination === 'waiting' ? journeyFocus.token : undefined} />{notice}{help}</>;
  if (screen === 'verdict' && results && user) return <>{journeyNav}<VerdictScreen results={results} currentUser={user} travelerName={travelerName} avatarFor={(id) => travelerById(id).image} onOpenMyResults={() => void openMyResults()} onOpenLightning={() => void openLightning()} focusHeading={journeyFocus?.destination === 'verdict' ? journeyFocus.token : undefined} />{notice}{help}</>;
  if (screen === 'my-results' && myResults && user) return <>{journeyNav}<MyResultsScreen results={myResults} traveler={user} focusHeading={journeyFocus?.destination === 'shortlist' ? journeyFocus.token : undefined} />{notice}{help}</>;
  if (screen === 'lightning-intro') return <><LightningIntroScreen onStart={() => void loadLightningComparison()} />{notice}</>;
  if (screen === 'lightning-comparison' && lightningNext && !lightningNext.complete) return <><LightningComparisonScreen progress={lightningNext.progress} destinations={[lightningNext.destinationA, lightningNext.destinationB]} selected={lightningPicked} onChoose={(winner) => void chooseLightning(winner)} />{notice}</>;
  if (screen === 'lightning-results' && lightningPersonal) return <><LightningPersonalResultsScreen results={lightningPersonal} onOpenWaiting={() => void openLightningWaiting()} onOpenVeto={() => setScreen('lightning-veto')} />{notice}</>;
  if (screen === 'lightning-veto' && lightningPersonal) return <><LightningVetoScreen results={lightningPersonal} onSubmit={submitLightningVetoes} />{notice}</>;
  if (screen === 'lightning-waiting' && lightningGroupStatus && user) return <><LightningWaitingScreen status={lightningGroupStatus} user={user} onRefresh={() => void refreshLightningStatus()} onReveal={() => void revealLightning()} onOpenResults={() => void openLightningVerdict()} />{notice}</>;
  if (screen === 'lightning-verdict' && lightningGroupResults) return <><LightningVerdictScreen results={lightningGroupResults} />{notice}</>;
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
if (fixtureMode === 'trip-preview' || fixtureMode === 'lightning-round') {
  root.render(<DevPreview initialPage={fixtureMode === 'lightning-round' ? 'lightning-intro' : 'comparison'} />);
} else if (fixtureMode === 'transparent-reveal') {
  const displayMode = fixtureOverlay === 'near-tie' ? 'near-tie' : fixtureOverlay === 'no-consensus' ? 'no-consensus' : fixtureOverlay === 'broad-leader' ? 'broad-leader' : 'shared-shortlist';
  const socialOverlay = fixtureOverlay === 'wild-card' || fixtureOverlay === 'two-camps' || fixtureOverlay === 'split' ? fixtureOverlay : undefined;
  root.render(<VerdictScreen results={createVerdictFixture(displayMode, socialOverlay)} currentUser="dan" travelerName={(id) => fixtureTravelerNames[id]} avatarFor={fixtureAvatar} onOpenMyResults={() => undefined} />);
} else {
  root.render(<App />);
}
