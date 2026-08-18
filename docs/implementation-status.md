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

## Remaining V1 completion work

These are product gaps, not documentation changes to make the requirements disappear.

1. **Preference-profile surface:** `/v1/profile` is available after completion, but the frontend does not yet present the intended human-readable profile beat before the atlas.
2. **Waiting/group-status surface:** `/v1/group-status` exists, but the frontend does not yet have the dedicated roster-completion/waiting experience described in the journey map.
3. **Reveal explanation and final discussion:** the verdict gives a useful short list and top threes, but not yet the full “why this ranked” explanation or post-reveal final gut-check input specified by the journey.
4. **Production confidence:** the current test suite covers ranking and API behavior in the local adapter. Add Firestore-emulator and authenticated multi-roster end-to-end coverage before relying on the app for the actual trip decision.

## Deliberate V2 backlog

Not yet built: hierarchical modeling, confidence intervals, stronger information-gain selection, practical-versus-pure ranking, fresh airfare integration, self-serve trip administration, multi-trip support, sharing, comparison-history visualization, and richer explanation/analytics tooling. The proposed sequencing is in the [delivery roadmap](roadmap.md).

Editorial activity imagery and restrained motion were pulled forward from the original V2 concept. They are shipped product decisions, not evidence that the V2 scoring and administration roadmap is complete.

## Release checks

Run `npm run validate:seed`, `npm test`, `npm run typecheck`, and `npm run build` before a release. The hosted frontend is [lets-go-somewhere-3549f.web.app](https://lets-go-somewhere-3549f.web.app); production persistence is used whenever Cloud Run provides `K_SERVICE`.
