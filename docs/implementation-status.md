# Implementation status

Last reconciled: 2026-08-18.

This is the operational status companion to the product specification. It records what is shipped without weakening the product requirements in [spec.md](spec.md) or the intended journey in [ux.md](ux.md).

## Shipped V1 foundation

- Fixed five-person November 2026 trip, Google-authenticated roster, Firebase Hosting, Cloud Run API, and Firestore persistence.
- 24 seeded destinations and 120 validated activity comparisons, with backend-owned deterministic scoring, pair selection, and 24–40 comparison stopping rules.
- Destination-safe comparison responses: activity ID, title, description, and opaque local image path only.
- Completion-gated atlas with named destinations, coordinates, real MapLibre map, galleries, and Unsplash credits; no personal or group result data before reveal.
- Dan-controlled group reveal after every roster member is complete, with group top five and each member's post-reveal top three.
- Responsive character-select, comparison, atlas, and result surfaces with keyboard focus and reduced-motion behavior.

## Intentional V3/V4 product decisions

Destination photography is permitted during comparisons as a deliberately accepted soft geographic cue. The experience still withholds destination names, countries, flags, airport codes, maps, ranks, scores, coordinates, and credit metadata during play. Photography, mapping, and credits become available only in the completion-gated atlas.

The current reveal exposes group top five and each traveler's top three, never raw activity-by-activity choices. Group order is derived from normalized individual destination scores minus the documented polarization penalty.

## Implemented but unreleased one-trip work

The local build now includes the destination-free profile, completion-only waiting lobby, snapshot-backed personal and group result views, qualitative result explanations, group-finalist matrix, and one immutable post-reveal final decision. It also adds versioned comparison persistence, atomic pending-pair claims, seed binding, immutable reveal snapshots, and explicit Firebase Emulator configuration. These changes remain unreleased while the model and rehearsal gates below are open.

## Remaining one-trip release gates

These are product gaps, not documentation changes to make the requirements disappear.

1. **Model promotion:** the first `bt-hierarchical-laplace-v1` evaluation failed closed. It has not replaced the deterministic production ranking path; see [model evaluation](model-evaluation.md) and ADR 0003. Calibration must pass the fixed synthetic gate before promotion.
2. **Rehearsal:** Firestore Emulator configuration and local configuration tests exist, but this machine lacks the Java JDK required to run the Firestore Emulator. Install it, run the emulator transaction suite and the five-identity browser rehearsal, then record the evidence in the one-trip runbook.
3. **Release verification:** complete the visual/manual quality gate, independent post-fix review, Cloud Run/Firebase deployment, preflight export/reset rehearsal, and production smoke test only after the preceding gates pass.

## Required one-trip inference work

The current deterministic Elo-style model, coverage heuristic, and 24–40 stopping rule are a shipped foundation, not the final model for the friends' actual one-shot decision. Before that run, implement hierarchical or regularized Bradley–Terry inference, credible uncertainty intervals, information-gain pair selection, a confidence-aware bounded stopping rule, versioned result snapshots, and deterministic simulation/replay validation. This work remains in scope precisely because the group will not be asked to repeat the exercise. See the [one-trip delivery roadmap](roadmap.md).

## Explicitly out of scope

Multi-trip administration, organizer roles, invitations, content-editing UI, live airfare/travel-time providers, practical ranking, public sharing/export, comparison-history products, and platform-scale operational tooling are not needed for this fixed trip. Editorial activity imagery and restrained motion are already shipped.

## Release checks

Run `npm run validate:seed`, `npm test`, `npm run typecheck`, and `npm run build` before a release. The hosted frontend is [lets-go-somewhere-3549f.web.app](https://lets-go-somewhere-3549f.web.app); production persistence is used whenever Cloud Run provides `K_SERVICE`.
