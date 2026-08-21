# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Tightened the one-trip release procedure: Cloud Run deployment now names the
  source, project, and region explicitly; production's count-only preflight is
  required both before and after deploy; reset is documented only for confirmed
  untouched pre-start debris, never as a smoke-test cleanup mechanism.

- Reconciled the one-trip runbook with ADR 0003: the old hierarchical model remains historical rejection evidence, while the bounded verification gate belongs to `bayes-attribute-shortlist-v1` and its fixed 32-choice policy.

- Made the completed caller’s personal top five available privately before the group reveal, while preserving the embargo on every other traveler’s result and the group ballot.
- Reframed the post-completion profile as a plain-language `Your trip rhythm`, added durable post-completion navigation, and redesigned the atlas around its full unranked candidate set, keyboard-visible map selection, and a credited photo lightbox.
- Replaced the one-trip production ranking path with `bayes-attribute-shortlist-v1`: exactly 32 adaptive, destination-blind comparisons over the eight canonical activity attributes.
- Reframed individual results as a personal trip shortlist and removed public confidence, interval, fit-strength, and early-completion language.
- Recorded the policy version in new immutable social-reveal snapshots; the transparent 5/4/3/2/1 group tally is unchanged.
- Superseded the complex hierarchical-model promotion gate with bounded fixed-shortlist verification while retaining its completed audit as historical evidence.

### Added

- A required first-run “How it works” trip briefing between verified character selection and the first anonymous comparison, plus a global contextual help return path. It explains Dan’s fixed 24-trip curation, the 32-choice Bayesian shortlist process, private personal results, and the sealed social reveal without exposing live destination or ranking data.

- Initial product documentation, implementation scaffold, and destination/activity seed data.
- Production design-system tokens, component contracts, guidance, and approved product logo.
- Local TypeScript workspace, shared schemas, seed validation, deterministic V1 ranking engine, presentation-safe API, destination-blind frontend flow, tests, and CI quality workflow.
- A completion-gated, unranked destination atlas API contract for the pre-reveal exploration moment.
- V3 editorial travel presentation: character-led onboarding, destination-photo comparisons, a real atlas map, gallery credits, and motion-safe loading and transition states.
- V4 retro-adventure refinement: unboxed interactive roster art, activity-matched opaque imagery, live completion progress, a full-bleed map-first atlas, and a character-led group verdict.
- Firestore-backed comparison, pending-pair, and reveal persistence, plus a completion-gated snapshot-backed transparent social-ballot API.
- A consolidated traveler-art library: current roster cutouts remain at `assets/images/`, with legacy variants retained under `assets/images/old/`.
- An unreleased one-trip journey: destination-free profile, atlas-to-waiting flow, snapshot-backed personal and group results, immutable post-reveal decisions, explicit state recovery, and hardened atlas/media fallbacks.
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
