# Implementation status

Last reconciled: 2026-08-20 (local browser and release-readiness checkpoint).

This is the operational status companion to the product specification. It records what is shipped without weakening the product requirements in [spec.md](spec.md) or the intended journey in [ux.md](ux.md).

## Shipped V1 foundation

- Fixed five-person November 2026 trip, Google-authenticated roster, Firebase Hosting, Cloud Run API, and Firestore persistence.
- 24 seeded destinations and 120 validated activity comparisons, with a backend-owned fixed 32-choice Bayesian attribute shortlist and adaptive pair selection.
- Destination-safe comparison responses: activity ID, title, description, and opaque local image path only.
- Completion-gated atlas with named destinations, coordinates, real MapLibre map, galleries, and Unsplash credits; a completed caller may also see only their own private top five before reveal. Other travelers’ results and all group result data remain sealed.
- Dan-controlled group reveal after every roster member is complete, with an
  immutable v2 public top-five points scoreboard, each member's post-reveal
  top five, stored social insights, and one snapshot-bound final decision.
- Responsive character-select, comparison, atlas, and result surfaces with keyboard focus and reduced-motion behavior.
- A required, destination-safe first-run briefing between verified character selection and the first comparison. It uses a plain-language five-step explanation of Dan’s fixed 24-trip curation, the fixed 32-choice game, private personal shortlists, and the sealed group reveal; the persistent help control returns to the prior screen.

## Intentional V3/V4 product decisions

Destination photography is permitted during comparisons as a deliberately accepted soft geographic cue. The experience still withholds destination names, countries, flags, airport codes, maps, ranks, scores, coordinates, and credit metadata during play. Photography, mapping, and credits become available only in the completion-gated atlas.

The group reveal is intentionally a transparent social ballot: each person's
inferred ranks one through five contribute `5, 4, 3, 2, 1` points, lower ranks
contribute zero, and published ties remain ties if first-place and top-five
count tiebreaks cannot resolve them. It exposes no raw activity-by-activity
choices, normalized utilities, polarization penalties, or group confidence
claims.

## Implemented but unreleased one-trip work

The local build now includes a plain-language destination-free profile, immediate caller-only private shortlist, completion-only waiting lobby, durable post-completion navigation, snapshot-backed group result view, qualitative result explanations, group-finalist matrix, and one immutable post-reveal final decision. The transparent group result is the stored `5/4/3/2/1` ballot—not a normalized group score—and v2 snapshots are cross-field validated before they are served. An independent audit also closed the legacy-final-decision and stale-decision-read gaps in `fbae847`. The guarded count-only preflight/reset tooling in `4ce95f0` is unit-tested locally; its production read-only preflight was run successfully and returned an empty, closed trip state. A disposable Cloud Run/Firebase/Firestore project also passed health, Hosting routing, disposable approved-account authentication, one Firestore-backed destination-blind comparison, response redaction, and count-only state inspection before it was deletion-requested. These changes remain unreleased while the literal browser rehearsal and deploy gates are open.

## Remaining one-trip release gates

These are product gaps, not documentation changes to make the requirements disappear.

1. **Fixed-shortlist verification — passed locally:** `npm run verify:fixed-shortlist` records deterministic fixed-32 replay, representative clear/close/noisy/divergent fit, pair safety, coverage through question 24, every eligible final-eight boundary selection, comparison redaction, and v2 snapshot stability for `bayes-attribute-shortlist-v1`. The completed complex-model audit remains historical evidence, not this model's gate; see [model evaluation](model-evaluation.md) and ADR 0003.
2. **Rehearsal — automated path passed; browser evidence in progress:** The isolated Auth/Firestore Emulator verifies configuration, concurrent/stale pending claims, racing immutable reveal creation, persisted snapshot reload, immutable final-decision conflicts, redacted v2-result serialization, and five disposable authenticated identities through mismatch recovery, resume/duplicate handling, all five exact 32-choice rounds, completion gates, Dan-only reveal, immutable snapshot parity, and stale-tab final-decision behavior. A literal browser pass has verified the character roster, required briefing, first destination-blind choice, contextual help return, and desktop/mobile atlas fallback. The remaining browser record is the complete five-identity visual traversal.
3. **Release verification:** Fixture-based desktop/mobile visual and accessibility review is complete locally, the first count-only production preflight returned `empty: true`, and a limited disposable cloud smoke passed. The smoke verified live health, Hosting-to-Cloud Run routing, disposable approved-account authentication, one Firestore-backed blind comparison, response redaction, and count-only state inspection; its exact temporary project is deletion-requested. Complete the five-identity browser record and remaining behavioral-smoke coverage, deploy Cloud Run/Firebase Hosting, and require a second empty production preflight. Production must never be used for a test journey because the guarded reset intentionally refuses started state.

## Required one-trip inference work

The release candidate is a deliberately small Bayesian attribute model: it learns from the eight canonical attributes, asks every traveler exactly 32 adaptive questions, and produces a personal trip shortlist. Posterior sampling is internal to selection; the public experience never claims certainty or a mathematically optimal group winner. The older Elo and hierarchical paths remain offline references only. See the [one-trip delivery roadmap](roadmap.md).

## Explicitly out of scope

Multi-trip administration, organizer roles, invitations, content-editing UI, live airfare/travel-time providers, practical ranking, public sharing/export, comparison-history products, and platform-scale operational tooling are not needed for this fixed trip. Editorial activity imagery and restrained motion are already shipped.

## Release checks

Run `npm run validate:seed`, `npm test`, `npm run typecheck`, and `npm run build` before a release. The hosted frontend is [lets-go-somewhere-3549f.web.app](https://lets-go-somewhere-3549f.web.app); production persistence is used whenever Cloud Run provides `K_SERVICE`. This is not yet ready for the real run and no real trip has started.
