# Implementation status

Last reconciled: 2026-08-19 (transparent social-ballot release-gate checkpoint).

This is the operational status companion to the product specification. It records what is shipped without weakening the product requirements in [spec.md](spec.md) or the intended journey in [ux.md](ux.md).

## Shipped V1 foundation

- Fixed five-person November 2026 trip, Google-authenticated roster, Firebase Hosting, Cloud Run API, and Firestore persistence.
- 24 seeded destinations and 120 validated activity comparisons, with backend-owned deterministic scoring, pair selection, and 24–40 comparison stopping rules.
- Destination-safe comparison responses: activity ID, title, description, and opaque local image path only.
- Completion-gated atlas with named destinations, coordinates, real MapLibre map, galleries, and Unsplash credits; no personal or group result data before reveal.
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

The local build now includes the destination-free profile, completion-only waiting lobby, snapshot-backed personal and group result views, qualitative result explanations, group-finalist matrix, and one immutable post-reveal final decision. The transparent group result is the stored `5/4/3/2/1` ballot—not a normalized group score—and v2 snapshots are cross-field validated before they are served. An independent audit also closed the legacy-final-decision and stale-decision-read gaps in `fbae847`. The guarded count-only preflight/reset tooling in `4ce95f0` is unit-tested locally; it has not been run against production. These changes remain unreleased while the model and rehearsal gates below are open.

## Remaining one-trip release gates

These are product gaps, not documentation changes to make the requirements disappear.

1. **Model promotion:** both the original `bt-hierarchical-laplace-v1` candidate and the compact `bt-hierarchical-laplace-v2-compact` candidate have failed closed. The v2 candidate converged on all 15,000 fits and achieved 94.20% aggregate 90% interval coverage, but produced 0 stable-top-five stops and did not certify the adaptive information-gain policy or comparison redaction in the evaluator. A dedicated adaptive-policy audit command now exists; its one-seed, 24-question smoke run passed determinism, unique/cross-destination pairing, and the two-appearances-per-destination checkpoint after a coverage-policy correction. This is not full 200-seed promotion evidence. Production remains on the deterministic ranking path; see [model evaluation](model-evaluation.md) and ADR 0003.
2. **Rehearsal:** The isolated Auth/Firestore Emulator now runs on this machine and verifies configuration, concurrent/stale pending claims, racing immutable reveal creation, persisted snapshot reload, immutable final-decision conflicts, and redacted v2-result serialization (seven tests, 2026-08-19). The remaining five-identity browser flow must be recorded against the selected promoted model.
3. **Release verification:** The fixture-based desktop/mobile visual and accessibility review is complete locally. Complete the five-identity browser rehearsal against a promoted model before release. The independent social-ballot audit and Emulator persistence proof do not replace that gate. Production preflight must remain count-only and empty; any behavioral smoke test that starts a journey belongs in a separately provisioned disposable Firebase/GCP environment because the guarded production reset intentionally refuses started state.

## Required one-trip inference work

The current deterministic Elo-style model, coverage heuristic, and 24–40 stopping rule are a shipped development foundation, not the final model for the friends' actual one-shot decision. The hierarchical/regularized Bradley–Terry implementation, posterior intervals, information-gain selector, confidence-aware stopping logic, and deterministic evaluator now exist offline, but promotion is blocked by the documented evidence failures. This work remains in scope precisely because the group will not be asked to repeat the exercise. See the [one-trip delivery roadmap](roadmap.md).

## Explicitly out of scope

Multi-trip administration, organizer roles, invitations, content-editing UI, live airfare/travel-time providers, practical ranking, public sharing/export, comparison-history products, and platform-scale operational tooling are not needed for this fixed trip. Editorial activity imagery and restrained motion are already shipped.

## Release checks

Run `npm run validate:seed`, `npm test`, `npm run typecheck`, and `npm run build` before a release. The hosted frontend is [lets-go-somewhere-3549f.web.app](https://lets-go-somewhere-3549f.web.app); production persistence is used whenever Cloud Run provides `K_SERVICE`. This is not yet ready for the real run and no real trip has started.
