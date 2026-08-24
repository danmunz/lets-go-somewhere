# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added

- Added a Lightning working-order evidence model: deterministic 4,096-draw private top-five/rank-range checks, 75% clear-break markers, exact-rank group Borda results, and qualitative group-only bands. A guarded local preview can read completed production Lightning data into an ignored local file without calling application routes or writing Firestore.
- Added a local, isolated Lightning Round follow-up for a completed original trip: 24 researched direct-destination briefs, a Bayesian Bradley–Terry 48-core/up-to-12-tie-breaker policy, private full rankings, a second-envelope group gate, and a transparent 24-to-1 Borda result board with the five expandable full lists. It uses separate content sealing and Firestore collections.
- Refined the local Lightning Round into a denser direct-choice experience: an enlarged, free-standing round-two cast; more compact responsive cards; a caller-only “X beat Y” decision trail; a departure-board completion view; and a sortable five-person group-rank table. The trail remains private until its owner’s list is available and is never included in the group snapshot.
- Added a required, private Lightning Round veto step after each direct ranking. Travelers may save zero to four immutable advisory vetoes; they stay sealed until the second envelope, render as clear veto markers in personal and group results, and never change the Bayesian ranking, Borda tally, or group ordering.

### Verified

- Completed the Lightning Round pre-deployment gate locally: canonical seed/mood validation, 166 fast tests, strict type checking, production build, and an eight-test Auth/Firestore Emulator suite including a persisted five-identity original-plus-Lightning rehearsal. Fixture review covered the Lightning flow at desktop and 390px mobile widths. No production project or production trip data was used.
- Released commit `c1a39bb` to Cloud Run revision `lgs-api-00013-hsh` and Firebase Hosting. The public health route and Hosting URL passed; original first-round data and its opened snapshot were left unchanged.
- Released commit `23f83e6` to Cloud Run revision `lgs-api-00014-5sb` and Firebase Hosting. The public health route and Hosting URL passed; this UI-only follow-up did not inspect, reset, or modify either round’s Firestore data.
- Released commit `60eb326` to Cloud Run revision `lgs-api-00015-92r` and Firebase Hosting. The public health route, Hosting URL, sealed Lightning waiting view, and a submitted caller-only Lightning list all rendered correctly against production data. No envelope, reset, or participant-data write was invoked.

### Changed

- Made Lightning’s shared evidence bands scannable as two distinct sets of named destination chips per person. Hovering or keyboard-focusing a place now highlights that same place across every person’s bands, without exposing private numerical evidence.
- Hardened Lightning Round comparison cards on phone-sized screens: each card now uses a bounded, media-first stack so Safari cannot stretch its image beneath the destination details.
- Split post-completion navigation into explicit Round 1 and Lightning contexts. Lightning now keeps direct choices and the required veto save focused behind a compact status header, then exposes its own menu and help screen after vetoes are saved; the original results remain available through a round switcher rather than being mixed into every Lightning page.
- Fixed the count-only operator preflight so fixed-32 completion is derived from saved choices, matching the participant-facing completion status instead of relying on retired timestamp metadata.
- Replaced scattered post-completion links with one phase-aware navigator: a sticky desktop bar and accessible mobile menu sheet expose only available screens, keep sealed group results out of navigation, and retain contextual help during blind play.
- Completed a platform-wide layout, typography, plain-language, and interaction polish pass. The post-completion journey now consistently uses “What you liked,” “Your top five,” “All 24 places,” “Who’s finished,” and “How the group voted,” while retaining the existing privacy gates and ranking behavior.
- Added 40 optimized, evidence-linked traveler mood portraits for post-completion preference explanations. They reinforce what each person liked on profile, personal-result, and post-reveal views while remaining absent from blind comparison, atlas, and waiting screens.
- Removed the retired “Champion a place” interaction from the reveal. The app no longer records a post-reveal vote or decision; it ends with the transparent group results and a prompt for the five travelers to talk it through together. Retired decision records, if any, are left untouched and ignored.

### Earlier pre-release work

- Released the verified one-trip experience to Cloud Run revision
  `lgs-api-00007-nfn` and Firebase Hosting after a final empty, count-only
  production preflight. No real trip was started during release verification.

- Expanded the content-management guide with the released briefing, fixed-round
  progress, durable navigation, private-shortlist, atlas, and reset boundaries.

- Rewrote all 120 blind activity descriptions with concise, destination-safe
  sensory and cultural detail so each choice better conveys the specific
  experience at stake.

- Published the activity-content update to Cloud Run revision
  `lgs-api-00008-4np`; its post-deploy health check and count-only production
  preflight passed with no trip data started.

- Fixed the trip-briefing help return so it clears `#how-it-works`; refreshing
  after returning to a choice no longer reopens the briefing.

- Tightened the one-trip release procedure: Cloud Run deployment now names the
  source, project, and region explicitly; production's count-only preflight is
  required both before and after deploy; reset is documented only for confirmed
  untouched pre-start debris, never as a smoke-test cleanup mechanism.

- Documented the safe Application Default Credentials recovery path for the
  count-only production preflight, including explicit project scoping without
  changing deployment configuration or trip data.

- Reconciled the one-trip runbook with ADR 0003: the old hierarchical model remains historical rejection evidence, while the bounded verification gate belongs to `bayes-attribute-shortlist-v1` and its fixed 32-choice policy.

- Made the completed caller’s personal top five available privately before the group reveal, while preserving the embargo on every other traveler’s result and the group ballot.
- Reframed the post-completion profile as a plain-language `Your trip rhythm`, added durable post-completion navigation, and redesigned the atlas around its full unranked candidate set, keyboard-visible map selection, and a credited photo lightbox.
- Replaced the one-trip production ranking path with `bayes-attribute-shortlist-v1`: exactly 32 adaptive, destination-blind comparisons over the eight canonical activity attributes.
- Reframed individual results as a personal trip shortlist and removed public confidence, interval, fit-strength, and early-completion language.
- Recorded the policy version in new immutable social-reveal snapshots; the transparent 5/4/3/2/1 group tally is unchanged.
- Superseded the complex hierarchical-model promotion gate with bounded fixed-shortlist verification while retaining its completed audit as historical evidence.

### Added

- Ran and tore down a labelled disposable Cloud Run/Firebase/Firestore smoke
  environment. It verified live health, Hosting routing, disposable
  approved-account authentication, one Firestore-backed destination-blind
  comparison, response redaction, and count-only state inspection without
  touching the real-trip project.

- An isolated five-identity Auth/Firestore Emulator rehearsal that drives the
  real API through all five fixed 32-choice journeys, protected reveal,
  immutable snapshot parity. The local
  browser rehearsal can now use disposable `.invalid` Auth Emulator accounts
  behind an explicit development-only switch; production remains Google OAuth
  only.

- A required first-run “How it works” trip briefing between verified character selection and the first anonymous comparison, plus a global contextual help return path. It explains Dan’s fixed 24-trip curation, the 32-choice Bayesian shortlist process, private personal results, and the sealed social reveal without exposing live destination or ranking data.

- Initial product documentation, implementation scaffold, and destination/activity seed data.
- Production design-system tokens, component contracts, guidance, and approved product logo.
- Local TypeScript workspace, shared schemas, seed validation, deterministic V1 ranking engine, presentation-safe API, destination-blind frontend flow, tests, and CI quality workflow.
- A completion-gated, unranked destination atlas API contract for the pre-reveal exploration moment.
- V3 editorial travel presentation: character-led onboarding, destination-photo comparisons, a real atlas map, gallery credits, and motion-safe loading and transition states.
- V4 retro-adventure refinement: unboxed interactive roster art, activity-matched opaque imagery, live completion progress, a full-bleed map-first atlas, and a character-led group verdict.
- Firestore-backed comparison, pending-pair, and reveal persistence, plus a completion-gated snapshot-backed transparent social-ballot API.
- A consolidated traveler-art library: current roster cutouts remain at `assets/images/`, with legacy variants retained under `assets/images/old/`.
- The released one-trip journey: destination-free profile, atlas-to-waiting flow, snapshot-backed personal and group results, explicit state recovery, and hardened atlas/media fallbacks.
- A local Firebase Auth/Firestore emulator configuration, transactional pending-pair submission, seed-version binding, and immutable reveal snapshots.
- An offline, regularized preference-model candidate with posterior uncertainty, information-gain selection, confidence-aware stopping, deterministic fixtures, and a fail-closed promotion report.
- A repeatable Auth/Firestore Emulator transaction suite that verifies atomic concurrent submissions and stale-offer protection against the real repository adapter.
- A deterministic adaptive-policy audit runner that exercises information-gain selection on generated trajectories instead of only a frozen baseline schedule.
- A resumable, input-fingerprinted full-policy evidence harness for the complex candidate. Its completed audit is retained as historical rejection evidence, not a release gate for the fixed-round shortlist.

### Changed

- Replaced the normalized-score/polarization group recommendation with the approved transparent `5/4/3/2/1` top-five points tally, including visible tie handling and social overlap/divergence presentation rules.
- Clarified the fixed five-person V1 scope, Google-authenticated roster, group reveal embargo, destination-blind activity-photo cards, and display-only practical context.
- Aligned documentation precedence, design-system references, and seed/schema examples for implementation.
- Updated the reveal embargo: completed participants may explore named candidate destinations and general trip context, while every personal and group outcome remains hidden until the group reveal.
- Tightened the final reveal so it opens only after the whole five-person roster finishes; it exposes each participant's full inferred top five rather than raw choices.
- Added immutable v2 social-ballot snapshot validation, stale-decision fail-closed handling, and a guarded count-only one-trip preflight/reset operator tool. These are locally tested safeguards, not a completed production preflight, browser rehearsal, or deployment approval.
- Reconciled deployment, delivery, implementation, and review documents with the shipped Firebase/Cloud Run/Firestore release; documented the remaining one-trip completion gaps separately from platform work that is out of scope.
- Marked the advanced-model candidate as unreleased after its audit did not support a certified-ranking claim; ADR 0003 now selects the smaller fixed-round shortlist release path instead of pursuing recalibration.
- Moved the isolated Firestore Emulator to port 8081 to avoid the local service that occupies 8080, and made the emulator test runner architecture-explicit on Apple Silicon.

## 2026-08-22 — One-trip release

- Deployed the verified one-trip release to Cloud Run revision `lgs-api-00009-x8r` and Firebase Hosting version `ab1c50b7b1550cc8`.
- Confirmed API health, public Hosting delivery, and an empty count-only production preflight both before and after deployment.
