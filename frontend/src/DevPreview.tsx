import { useState } from 'react';
import NumberFlow from '@number-flow/react';
import type { AtlasDestination, PersonalResultsResponse, PreferenceProfile, RosterUser } from '@lgs/shared';
import logoUrl from '../../design-system/assets/logo.png';
import danAvatar from '../../assets/images/dan_cutout.png';
import jamesAvatar from '../../assets/images/james_cutout.png';
import johnAvatar from '../../assets/images/john_cutout.png';
import mattAvatar from '../../assets/images/matt_cutout.png';
import peterAvatar from '../../assets/images/peter_cutout.png';
import { AtlasMap } from './AtlasMap.js';
import { MediaImage, TravelEffortKey } from './components/index.js';
import { MyResultsScreen, ProfileScreen, VerdictScreen, WaitingScreen } from './screens/index.js';
import { createVerdictFixture, fixtureTravelerNames } from './screens/verdictFixtures.js';

type PreviewPage = 'comparison' | 'profile' | 'atlas' | 'waiting' | 'ready' | 'verdict' | 'shortlist';
const pages: readonly [PreviewPage, string][] = [
  ['comparison', 'Choice cards'], ['profile', 'Profile'], ['atlas', 'Atlas'], ['waiting', 'Waiting'], ['ready', 'All five'], ['verdict', 'Reveal'], ['shortlist', 'My shortlist'],
];
const avatarByUser: Record<RosterUser, string> = { dan: danAvatar, james: jamesAvatar, john: johnAvatar, matt: mattAvatar, peter: peterAvatar };
const profile: PreferenceProfile = {
  headline: 'Your trip rhythm is taking shape.',
  synthesis: 'You kept gravitating toward big landscapes, local texture, and a little surprise.',
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
    explanation: { themes: ['big adventures', 'local texture'], matchedActivityCount: 5, encounteredActivityCount: 16 }, context: place.context,
  })),
};

function PreviewAtlas() {
  const [activeId, setActiveId] = useState(atlasDestinations[0]!.id);
  const active = atlasDestinations.find((destination) => destination.id === activeId)!;
  return <main className="atlas-page screen-enter"><header className="atlas-toolbar"><img src={logoUrl} alt="Let's Go Somewhere" className="topbar-logo" /><div><p className="eyebrow">Preview atlas</p><b>Every place is still in play.</b></div></header><section className="atlas-map-stage"><AtlasMap destinations={atlasDestinations} activeId={activeId} onSelect={setActiveId} /><aside className="atlas-drawer"><p className="eyebrow">Now exploring</p><h1>{active.name}</h1><p className="country">{active.country}</p><p>{active.tagline}</p><div className="atlas-facts"><div><span>November</span><b>{active.novemberWeather}</b></div><div><span>Travel effort</span><b>{active.travelFriction}/5</b><small>1 = easy route · 5 = big expedition</small></div></div><MediaImage src={active.gallery[0]!.path} alt={active.gallery[0]!.alt} fallbackLabel="Photo unavailable" /></aside></section><section className="atlas-list atlas-list--v4">{atlasDestinations.map((destination) => <button key={destination.id} onClick={() => setActiveId(destination.id)} aria-pressed={activeId === destination.id}><MediaImage src={destination.gallery[0]!.path} alt="" fallbackLabel="Photo unavailable" /><b>{destination.name}</b><small>{destination.country}</small></button>)}</section><TravelEffortKey /></main>;
}

function PreviewComparison() {
  return <main className="game-shell screen-enter"><header className="game-topbar"><img src={logoUrl} alt="Let's Go Somewhere" className="topbar-logo" /><div className="turn-meta"><img className="avatar-art" src={danAvatar} alt="" />Dan’s turn</div></header><section className="game-heading"><p className="eyebrow">Preview choice card</p><div className="game-title-row"><h1>Which calls to you?</h1><span><NumberFlow value={17} /> answered</span></div><div className="game-progress"><i style={{ width: '53%' }} /></div><p className="progress-message">You’re on a roll. <b>17 of 32 choices</b></p></section><section className="choice-stage"><button className="choice-card choice-card--0"><i className="choice-photo" style={{ backgroundImage: 'url(/media/cards/001.webp)' }} /><i className="choice-photo-wash" /><span className="choice-pick">I’d rather… ↗</span><span className="choice-copy"><strong>Wake before sunrise for a ridge-line hike</strong><small>Follow a quiet trail until the horizon turns gold.</small></span></button><button className="choice-card choice-card--1"><i className="choice-photo" style={{ backgroundImage: 'url(/media/cards/002.webp)' }} /><i className="choice-photo-wash" /><span className="choice-pick">I’d rather… ↗</span><span className="choice-copy"><strong>Spend the afternoon in a tiny market</strong><small>Try whatever looks great and let the streets set the pace.</small></span></button></section><div className="or-divider"><span />OR<span /></div></main>;
}

/** Development-only visual journey navigator. It never calls the API or stores a choice. */
export function DevPreview() {
  const [page, setPage] = useState<PreviewPage>('comparison');
  const body = page === 'comparison' ? <PreviewComparison />
    : page === 'profile' ? <ProfileScreen profile={profile} onOpenAtlas={() => setPage('atlas')} onOpenWaiting={() => setPage('waiting')} />
      : page === 'atlas' ? <PreviewAtlas />
        : page === 'waiting' || page === 'ready' ? <WaitingScreen status={{ revealOpen: false, allComplete: page === 'ready', updatedAt: '2026-08-19T00:00:00.000Z', members: ['dan', 'james', 'john', 'matt', 'peter'].map((user, index) => ({ user: user as RosterUser, complete: page === 'ready' || index < 3 })) }} user="dan" travelerName={(user) => fixtureTravelerNames[user]} onRefresh={() => undefined} onBackToAtlas={() => setPage('atlas')} onOpenReveal={() => setPage('verdict')} />
          : page === 'verdict' ? <VerdictScreen results={verdict} currentUser="dan" travelerName={(user) => fixtureTravelerNames[user]} avatarFor={(user) => avatarByUser[user]} onOpenMyResults={() => setPage('shortlist')} onRecordDecision={async (choice) => ({ user: 'dan', choice, createdAt: '2026-08-19T00:00:00.000Z' })} />
            : <MyResultsScreen results={myResults} onBackToVerdict={() => setPage('verdict')} />;
  return <><nav aria-label="Local preview screens" style={{ position: 'fixed', zIndex: 100, top: 12, right: 12, display: 'flex', flexWrap: 'wrap', gap: 6, maxWidth: 560, padding: 8, borderRadius: 12, background: '#1f1b16eB', boxShadow: '0 4px 18px #0006' }}>{pages.map(([id, label]) => <button key={id} onClick={() => setPage(id)} aria-pressed={page === id} style={{ fontSize: 14, minHeight: 36, padding: '6px 10px', border: '1px solid #f3e9dd', borderRadius: 7, color: '#1f1b16', background: page === id ? '#f9bd45' : '#f3e9dd' }}>{label}</button>)}</nav>{body}</>;
}
