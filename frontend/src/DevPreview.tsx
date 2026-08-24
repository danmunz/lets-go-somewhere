import { useState } from 'react';
import NumberFlow from '@number-flow/react';
import { LIGHTNING_MODEL_VERSION, ROSTER_USERS, type AtlasDestination, type LightningDestinationBrief, type LightningGroupResults, type LightningGroupStatus, type LightningPersonalResults, type PersonalResultsResponse, type PreferenceProfile, type RosterUser } from '@lgs/shared';
import logoUrl from '../../design-system/assets/logo.png';
import lightningBriefSeed from '../../seed/lightning-round/destination-briefs.json';
import danAvatar from '../../assets/images/dan_cutout.png';
import jamesAvatar from '../../assets/images/james_cutout.png';
import johnAvatar from '../../assets/images/john_cutout.png';
import mattAvatar from '../../assets/images/matt_cutout.png';
import peterAvatar from '../../assets/images/peter_cutout.png';
import { AtlasExplorer } from './AtlasExplorer.js';
import { JourneyNav } from './components/JourneyNav.js';
import { journeyDestinationForScreen } from './journeyNavigation.js';
import type { AppScreen } from './types.js';
import { HowItWorksScreen, LightningComparisonScreen, LightningIntroScreen, LightningPersonalResultsScreen, LightningVerdictScreen, LightningVetoScreen, LightningWaitingScreen, MyResultsScreen, ProfileScreen, VerdictScreen, WaitingScreen } from './screens/index.js';
import { createVerdictFixture, fixtureTravelerNames } from './screens/verdictFixtures.js';

type PreviewPage = 'how-it-works' | 'comparison' | 'profile' | 'atlas' | 'waiting' | 'ready' | 'verdict' | 'shortlist' | 'lightning-intro' | 'lightning-cards' | 'lightning-list' | 'lightning-veto' | 'lightning-waiting' | 'lightning-reveal';
const pages: readonly [PreviewPage, string][] = [
  ['how-it-works', 'How it works'], ['comparison', 'Choice cards'], ['profile', 'What I liked'], ['atlas', 'All 24 places'], ['waiting', 'Who’s finished'], ['ready', 'All five'], ['verdict', 'Reveal'], ['shortlist', 'My top five'],
  ['lightning-intro', 'Round two - intro'], ['lightning-cards', 'Round two - cards'], ['lightning-list', 'Round two - my full list'], ['lightning-veto', 'Round two - vetoes'], ['lightning-waiting', 'Round two - who’s finished'], ['lightning-reveal', 'Round two - reveal'],
];
const avatarByUser: Record<RosterUser, string> = { dan: danAvatar, james: jamesAvatar, john: johnAvatar, matt: mattAvatar, peter: peterAvatar };
const profile: PreferenceProfile = {
  headline: 'What your choices had in common.',
  synthesis: 'You often picked big landscapes, local texture, and a little surprise.',
  dimensions: [
    { key: 'adventure', label: 'Big adventures', strength: 'strong', direction: 'drawn-to' },
    { key: 'culture', label: 'Local texture', strength: 'strong', direction: 'drawn-to' },
    { key: 'nature', label: 'Wild scenery', strength: 'present', direction: 'drawn-to' },
  ],
};
const verdict = createVerdictFixture('shared-shortlist', 'split');
const atlasDestinations: AtlasDestination[] = verdict.group.map((place, index) => ({
  id: place.id,
  name: place.name,
  country: place.country,
  tagline: ['A city of color, food, and mountain air.', 'Volcano views with a lively old town.', 'A green island for long, cinematic days.', 'A bright collision of ritual and modernity.', 'A northern edge made for the outdoors.'][index]!,
  novemberWeather: place.context.novemberWeather,
  travelFriction: place.context.travelFriction,
  coordinates: (() => { const [longitude, latitude] = [[-96.72, 17.07], [-90.51, 14.63], [-16.96, 32.76], [135.77, 35.68], [13.6, 68.2]][index]!; return { longitude, latitude }; })(),
  gallery: [0, 1, 2].map((offset) => ({ path: `/media/cards/${String(index * 3 + offset + 1).padStart(3, '0')}.webp`, sourceUrl: 'https://unsplash.com', alt: `Editorial travel view for ${place.name}`, photographerName: 'Preview photo', photographerUrl: 'https://unsplash.com' })),
}));
const myResults: PersonalResultsResponse = {
  snapshotId: 'local-preview', modelVersion: 'preview-only', profile,
  results: verdict.group.map((place) => ({
    rank: place.rank, id: place.id, name: place.name, country: place.country, imageUrl: place.imageUrl,
    explanation: { themes: ['big adventures', 'local texture'], moodKeys: ['adventure', 'culture'], matchedActivityCount: 5, encounteredActivityCount: 16 }, context: place.context,
  })),
};
const highlightTitles = ['A good day could include', 'Another good day', 'Leave room for'] as const;
const lightningDestinations: LightningDestinationBrief[] = lightningBriefSeed.map((destination) => ({
  id: destination.id,
  name: destination.name,
  country: destination.country,
  imageUrl: destination.photoPath,
  pitch: destination.shortPitch,
  highlights: destination.highlights.map((detail, index) => ({ title: highlightTitles[index]!, detail })),
  weather: destination.weather,
  travel: { effort: destination.travel.effort, summary: destination.travel.description, fares: destination.airfare, fareNote: destination.airfare.qualifier },
  caveat: destination.caveat,
  researchedAt: destination.researchedAt,
  sources: destination.sources.map((source) => ({ label: source.title, url: source.url })),
}));
const lightningPlaces = [lightningDestinations[0]!, lightningDestinations[2]!] as const;
const lightningTiers = lightningDestinations.map((destination, index) => ({ rankStart: index + 1, rankEnd: index + 1, destinationIds: [destination.id] }));
const lightningResults: LightningPersonalResults = {
  modelVersion: LIGHTNING_MODEL_VERSION,
  contentVersion: 'local-preview',
  tiers: lightningTiers,
  destinations: lightningDestinations,
  comparisonTrail: Array.from({ length: 48 }, (_, index) => {
    const destinationA = lightningDestinations[index % lightningDestinations.length]!;
    const destinationB = lightningDestinations[(index * 7 + 5) % lightningDestinations.length]!;
    return { order: index + 1, winnerId: destinationA.id, loserId: destinationB.id, phase: 'core' as const };
  }),
  vetoes: { submitted: false, destinationIds: [] },
};
const lightningStatus: LightningGroupStatus = { revealOpen: false, allComplete: false, updatedAt: '2026-08-23T00:00:00.000Z', members: ROSTER_USERS.map((user, index) => ({ user, complete: index < 3 })) };
const lightningGroupResults: LightningGroupResults = {
  snapshotId: 'local-lightning-preview', modelVersion: LIGHTNING_MODEL_VERSION, contentVersion: 'local-preview', destinations: lightningDestinations,
  group: lightningDestinations.map((destination, index) => ({ rankStart: index + 1, rankEnd: index + 1, destinationId: destination.id, bordaHalfPoints: (24 - index) * 10, firstPlaceVotes: index === 0 ? 3 : index === 1 ? 1 : 0, supporters: ROSTER_USERS.slice(0, Math.max(1, 5 - Math.floor(index / 5))), vetoedBy: destination.id === lightningDestinations[3]?.id ? ['james', 'matt'] : destination.id === lightningDestinations[6]?.id ? ['john'] : [] })),
  members: ROSTER_USERS.map((user, offset) => ({ user, tiers: lightningDestinations.map((destination, index) => ({ rankStart: index + 1, rankEnd: index + 1, destinationIds: [lightningDestinations[(index + offset) % lightningDestinations.length]!.id] })), vetoedDestinationIds: user === 'james' ? [lightningDestinations[3]!.id] : user === 'matt' ? [lightningDestinations[3]!.id] : user === 'john' ? [lightningDestinations[6]!.id] : [] })),
};

function PreviewAtlas({ onOpenWaiting }: { onOpenWaiting: () => void }) {
  return <AtlasExplorer destinations={atlasDestinations} user="dan" travelerName={(user) => fixtureTravelerNames[user]} avatarSrc={danAvatar} onOpenWaiting={onOpenWaiting} />;
}

function PreviewComparison() {
  return <main className="game-shell screen-enter"><header className="game-topbar"><img src={logoUrl} alt="Let's Go Somewhere" className="topbar-logo" /><div className="turn-meta"><img className="avatar-art" src={danAvatar} alt="" />Dan’s turn</div></header><section className="game-heading"><p className="eyebrow">Preview choice card</p><div className="game-title-row"><h1>Which sounds better?</h1><span><NumberFlow value={17} /> picked</span></div><div className="game-progress"><i style={{ width: '53%' }} /></div><p className="progress-message">You’re on a roll. <b>17 of 32 choices</b></p></section><section className="choice-stage"><button className="choice-card choice-card--0"><i className="choice-photo" style={{ backgroundImage: 'url(/media/cards/001.webp)' }} /><i className="choice-photo-wash" /><span className="choice-pick">I’d rather… ↗</span><span className="choice-copy"><strong>Wake before sunrise for a ridge-line hike</strong><small>Follow a quiet trail until the horizon turns gold.</small></span></button><button className="choice-card choice-card--1"><i className="choice-photo" style={{ backgroundImage: 'url(/media/cards/002.webp)' }} /><i className="choice-photo-wash" /><span className="choice-pick">I’d rather… ↗</span><span className="choice-copy"><strong>Spend the afternoon in a tiny market</strong><small>Try whatever looks great and let the streets set the pace.</small></span></button></section><div className="or-divider"><span />OR<span /></div></main>;
}

/** Development-only visual journey navigator. It never calls the API or stores a choice. */
export function DevPreview({ initialPage = 'comparison' }: { initialPage?: PreviewPage }) {
  const [page, setPage] = useState<PreviewPage>(initialPage);
  const [helpReturn, setHelpReturn] = useState<PreviewPage>(initialPage);
  const [briefingRequired, setBriefingRequired] = useState(false);
  const [previewVetoes, setPreviewVetoes] = useState<readonly string[] | undefined>();
  const previewLightningResults: LightningPersonalResults = { ...lightningResults, vetoes: { submitted: previewVetoes !== undefined, destinationIds: [...(previewVetoes ?? [])] } };
  const openHelp = () => { setHelpReturn(page); setBriefingRequired(false); setPage('how-it-works'); };
  const openRequiredBriefing = () => { setBriefingRequired(true); setPage('how-it-works'); };
  const helpReturnLabel = pages.find(([id]) => id === helpReturn)?.[1].toLowerCase() ?? 'your choices';
  const body = page === 'how-it-works' ? <HowItWorksScreen travelers={Object.entries(avatarByUser).map(([id, image]) => ({ id, name: fixtureTravelerNames[id as RosterUser], image }))} required={briefingRequired} backLabel={briefingRequired ? 'Back to character selection' : `Back to ${helpReturnLabel}`} onBack={() => setPage(briefingRequired ? 'comparison' : helpReturn)} onStartChoices={briefingRequired ? () => setPage('comparison') : undefined} />
    : page === 'lightning-intro' ? <LightningIntroScreen onStart={() => setPage('lightning-cards')} />
    : page === 'lightning-cards' ? <LightningComparisonScreen progress={{ comparisons: 39, core: 48, maximum: 60, phase: 'core' }} destinations={lightningPlaces} onChoose={() => undefined} />
    : page === 'lightning-list' ? <LightningPersonalResultsScreen results={previewLightningResults} onOpenWaiting={() => setPage('lightning-waiting')} onOpenVeto={() => setPage('lightning-veto')} />
    : page === 'lightning-veto' ? <LightningVetoScreen results={previewLightningResults} onSubmit={async (destinationIds) => { setPreviewVetoes(destinationIds); setPage('lightning-list'); return true; }} />
    : page === 'lightning-waiting' ? <LightningWaitingScreen status={lightningStatus} user="dan" onRefresh={() => undefined} onReveal={() => setPage('lightning-reveal')} onOpenResults={() => setPage('lightning-reveal')} />
    : page === 'lightning-reveal' ? <LightningVerdictScreen results={lightningGroupResults} />
    : page === 'comparison' ? <PreviewComparison />
    : page === 'profile' ? <ProfileScreen profile={profile} traveler="dan" onOpenMyResults={() => setPage('shortlist')} />
      : page === 'atlas' ? <PreviewAtlas onOpenWaiting={() => setPage('waiting')} />
        : page === 'waiting' || page === 'ready' ? <WaitingScreen status={{ revealOpen: false, allComplete: page === 'ready', updatedAt: '2026-08-19T00:00:00.000Z', members: ['dan', 'james', 'john', 'matt', 'peter'].map((user, index) => ({ user: user as RosterUser, complete: page === 'ready' || index < 3 })) }} user="dan" travelerName={(user) => fixtureTravelerNames[user]} onRefresh={() => undefined} onOpenReveal={() => setPage('verdict')} />
          : page === 'verdict' ? <VerdictScreen results={verdict} currentUser="dan" travelerName={(user) => fixtureTravelerNames[user]} avatarFor={(user) => avatarByUser[user]} onOpenMyResults={() => setPage('shortlist')} />
            : <MyResultsScreen results={myResults} traveler="dan" />;
  const screen: AppScreen = page === 'profile' ? 'profile' : page === 'atlas' ? 'atlas' : page === 'waiting' || page === 'ready' ? 'waiting' : page === 'verdict' ? 'verdict' : page === 'shortlist' ? 'my-results' : 'comparison';
  const active = journeyDestinationForScreen(screen);
  const revealOpen = page === 'verdict';
  const navigation = active ? <JourneyNav active={active} revealOpen={revealOpen} revealSeen={page === 'verdict'} onNavigate={(destination) => setPage(destination === 'profile' ? 'profile' : destination === 'shortlist' ? 'shortlist' : destination === 'atlas' ? 'atlas' : destination === 'waiting' ? 'waiting' : 'verdict')} onOpenHowItWorks={openHelp} /> : null;
  return <>{navigation}{body}<details className="dev-preview-controls"><summary>Local preview screens</summary><div>{pages.map(([id, label]) => <button key={id} onClick={() => id === 'how-it-works' ? openRequiredBriefing() : setPage(id)} aria-pressed={page === id}>{label}</button>)}</div></details></>;
}
