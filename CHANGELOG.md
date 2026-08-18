# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial product documentation, implementation scaffold, and destination/activity seed data.
- Production design-system tokens, component contracts, guidance, and approved product logo.
- Local TypeScript workspace, shared schemas, seed validation, deterministic V1 ranking engine, presentation-safe API, destination-blind frontend flow, tests, and CI quality workflow.
- A completion-gated, unranked destination atlas API contract for the pre-reveal exploration moment.
- V3 editorial travel presentation: character-led onboarding, destination-photo comparisons, a real atlas map, gallery credits, and motion-safe loading and transition states.
- V4 retro-adventure refinement: unboxed interactive roster art, activity-matched opaque imagery, live completion progress, a full-bleed map-first atlas, and a character-led group verdict.
- Firestore-backed comparison, pending-pair, and reveal persistence, plus a completion-gated social-results API with normalized preference scores and a consensus penalty.
- A consolidated traveler-art library: current roster cutouts remain at `assets/images/`, with legacy variants retained under `assets/images/old/`.
- An unreleased one-trip journey: destination-free profile, atlas-to-waiting flow, snapshot-backed personal and group results, immutable post-reveal decisions, explicit state recovery, and hardened atlas/media fallbacks.
- A local Firebase Auth/Firestore emulator configuration, transactional pending-pair submission, seed-version binding, and immutable reveal snapshots.
- An offline, regularized preference-model candidate with posterior uncertainty, information-gain selection, confidence-aware stopping, deterministic fixtures, and a fail-closed promotion report.
- A repeatable Auth/Firestore Emulator transaction suite that verifies atomic concurrent submissions and stale-offer protection against the real repository adapter.
- A deterministic adaptive-policy audit runner that exercises information-gain selection on generated trajectories instead of only a frozen baseline schedule.

### Changed

- Clarified the fixed five-person V1 scope, Google-authenticated roster, group reveal embargo, destination-blind activity-photo cards, and display-only practical context.
- Aligned documentation precedence, design-system references, and seed/schema examples for implementation.
- Updated the reveal embargo: completed participants may explore named candidate destinations and general trip context, while every personal and group outcome remains hidden until the group reveal.
- Tightened the final reveal so it opens only after the whole five-person roster finishes; it exposes each participant's top three rather than raw choices.
- Reconciled deployment, delivery, implementation, and review documents with the shipped Firebase/Cloud Run/Firestore release; documented the remaining one-trip completion gaps separately from platform work that is out of scope.
- Marked the advanced-model candidate as unreleased: its first synthetic 200-seed promotion evaluation did not meet the predeclared evidence gate, so production remains on the existing verified ranking until recalibration succeeds.
- Moved the isolated Firestore Emulator to port 8081 to avoid the local service that occupies 8080, and made the emulator test runner architecture-explicit on Apple Silicon.
