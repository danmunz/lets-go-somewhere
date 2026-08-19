# Implementation status

Last reconciled: 2026-08-19 (transparent social-ballot release-gate checkpoint).

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

## Intentional V3/V4 product decisions

Destination photography is permitted during comparisons as a deliberately accepted soft geographic cue. The experience still withholds destination names, countries, flags, airport codes, maps, ranks, scores, coordinates, and credit metadata during play. Photography, mapping, and credits become available only in the completion-gated atlas.

The group reveal is intentionally a transparent social ballot: each person's
inferred ranks one through five contribute `5, 4, 3, 2, 1` points, lower ranks
contribute zero, and published ties remain ties if first-place and top-five
count tiebreaks cannot resolve them. It exposes no raw activity-by-activity
choices, normalized utilities, polarization penalties, or group confidence
claims.

## Implemented but unreleased one-trip work

The local build now includes a plain-language destination-free profile, immediate caller-only private shortlist, completion-only waiting lobby, durable post-completion navigation, snapshot-backed group result view, qualitative result explanations, group-finalist matrix, and one immutable post-reveal final decision. The transparent group result is the stored `5/4/3/2/1` ballot—not a normalized group score—and v2 snapshots are cross-field validated before they are served. An independent audit also closed the legacy-final-decision and stale-decision-read gaps in `fbae847`. The guarded count-only preflight/reset tooling in `4ce95f0` is unit-tested locally; it has not been run against production. These changes remain unreleased while the fixed-shortlist verification and rehearsal gates below are open.

## Remaining one-trip release gates

These are product gaps, not documentation changes to make the requirements disappear.

1. **Fixed-shortlist verification:** `bayes-attribute-shortlist-v1` is wired locally. Record deterministic 32-round replay, representative fit, coverage, boundary-selection, redaction, and snapshot-stability evidence before release. The completed complex-model audit remains historical evidence, not this model's gate; see [model evaluation](model-evaluation.md) and ADR 0003.
2. **Rehearsal:** The isolated Auth/Firestore Emulator now verifies configuration, concurrent/stale pending claims, racing immutable reveal creation, persisted snapshot reload, immutable final-decision conflicts, and redacted v2-result serialization. The remaining five-identity browser flow must be recorded against the fixed-shortlist release candidate.
3. **Release verification:** The fixture-based desktop/mobile visual and accessibility review is complete locally. Complete the five-identity browser rehearsal before release. Production preflight must remain count-only and empty; any behavioral smoke test that starts a journey belongs in a separately provisioned disposable Firebase/GCP environment because the guarded production reset intentionally refuses started state.

## Required one-trip inference work

The release candidate is a deliberately small Bayesian attribute model: it learns from the eight canonical attributes, asks every traveler exactly 32 adaptive questions, and produces a personal trip shortlist. Posterior sampling is internal to selection; the public experience never claims certainty or a mathematically optimal group winner. The older Elo and hierarchical paths remain offline references only. See the [one-trip delivery roadmap](roadmap.md).

## Explicitly out of scope

Multi-trip administration, organizer roles, invitations, content-editing UI, live airfare/travel-time providers, practical ranking, public sharing/export, comparison-history products, and platform-scale operational tooling are not needed for this fixed trip. Editorial activity imagery and restrained motion are already shipped.

## Release checks

Run `npm run validate:seed`, `npm test`, `npm run typecheck`, and `npm run build` before a release. The hosted frontend is [lets-go-somewhere-3549f.web.app](https://lets-go-somewhere-3549f.web.app); production persistence is used whenever Cloud Run provides `K_SERVICE`. This is not yet ready for the real run and no real trip has started.
