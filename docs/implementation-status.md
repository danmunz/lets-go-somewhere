# Implementation status

Last reconciled: 2026-08-24 (Lightning Round deployed).

This is the operational status companion to the product specification. It records what is shipped without weakening the product requirements in [spec.md](spec.md) or the intended journey in [ux.md](ux.md).

## Shipped V1 foundation

- Fixed five-person November 2026 trip, Google-authenticated roster, Firebase Hosting, Cloud Run API, and Firestore persistence.
- 24 seeded destinations and 120 validated activity comparisons, with a backend-owned fixed 32-choice Bayesian attribute shortlist and adaptive pair selection.
- Destination-safe comparison responses: activity ID, title, description, and opaque local image path only.
- Completion-gated atlas with named destinations, coordinates, real MapLibre map, galleries, and Unsplash credits; a completed caller may also see only their own private top five before reveal. Other travelers’ results and all group result data remain sealed.
- Dan-controlled group reveal after every roster member is complete, with an
  immutable v2 public top-five points scoreboard, each member's post-reveal
  top five and stored social insights.
- Responsive character-select, comparison, atlas, and result surfaces with keyboard focus and reduced-motion behavior.
- A required, destination-safe first-run briefing between verified character selection and the first comparison. It uses a plain-language five-step explanation of Dan’s fixed 24-trip curation, the fixed 32-choice game, private personal shortlists, and the sealed group reveal; the contextual help control returns to the prior screen.

## Intentional V3/V4 product decisions

Destination photography is permitted during comparisons as a deliberately accepted soft geographic cue. The experience still withholds destination names, countries, flags, airport codes, maps, ranks, scores, coordinates, and credit metadata during play. Photography, mapping, and credits become available only in the completion-gated atlas.

The group reveal is intentionally a transparent social ballot: each person's
inferred ranks one through five contribute `5, 4, 3, 2, 1` points, lower ranks
contribute zero, and published ties remain ties if first-place and top-five
count tiebreaks cannot resolve them. It exposes no raw activity-by-activity
choices, normalized utilities, polarization penalties, or group confidence
claims.

## Lightning Round

The original group reveal is complete and remains immutable. A separate direct-destination Lightning Round is deployed for the group’s follow-up decision: 24 researched destination briefs, 48 fair-coverage comparisons plus at most 12 deterministic tie-breakers, Bayesian direct-destination tiering, compact direct-choice cards, private full rankings with a caller-only decision trail, a required zero-to-four advisory-veto step, a departure-board waiting state, second-envelope gating, and a transparent 24-to-1 Borda group board with a sortable five-person rank table. A saved veto tells the group that its owner would not take that trip; it does not alter model ranks, Borda points, or group order. Lightning now has a phase-aware navigator of its own: focused progress while choices or vetoes remain, then a dedicated menu after the veto save; Round 1 remains one explicit switch away instead of being mixed into Lightning links. It uses isolated content versioning and `lgsV4Lightning*` Firestore collections, so it cannot change original comparisons or their snapshot. This candidate passed static validation, fast tests, a real Auth/Firestore Emulator five-identity rehearsal, and local desktop/mobile visual review on 2026-08-24 before deployment.

### Lightning Round verification and deployment — passed (2026-08-24)

- `npm run validate:seed`, `npm run validate:lightning-seed`, and `npm run validate:moods` all passed.
- The fast suite passed with 166 tests and eight intentionally skipped Emulator-only checks. `npm run typecheck`, `npm run build`, and `git diff --check` passed.
- `npm run test:emulator`, with only the local Java/Firebase emulators, passed all eight tests. Its five-identity rehearsal drove both the original fixed-32 round and the persisted Lightning Round through real API routes, resume-safe direct comparisons, zero-to-four veto submissions, Dan-only second-envelope opening, immutable reload parity, and post-reveal mutation rejection.
- Fixture-based browser review covered desktop and 390px mobile Lightning introduction, direct cards, private ranking/veto selection, waiting board, and group reveal. Development fixture controls are excluded from production builds.
- Commit `23f83e6` was deployed to Cloud Run revision `lgs-api-00014-5sb` and Firebase Hosting. The service routes 100% of traffic to that revision; its public health endpoint and the Hosting URL both returned successfully. This UI-only navigation/mobile-layout follow-up did not inspect, reset, or modify either round’s Firestore data.

The production build still reports one non-blocking initial JavaScript bundle warning (about 418 kB gzip), driven primarily by MapLibre and ambient visual dependencies. It is a performance optimization opportunity, not a functional or release-gate failure; the warning is retained rather than suppressed.

## Released one-trip experience

The released build includes a plain-language destination-free **What you liked** summary, immediate caller-only **Your top five**, a completion-only **Who’s finished** page, a phase-aware post-completion navigator, snapshot-backed group reveal, qualitative result explanations, and a group-finalist matrix. The navigator is absent during onboarding, briefing, and blind comparison; it renders only safe destinations and adds **How the group voted** only after Dan opens the reveal. **How the group voted** is the stored `5/4/3/2/1` tally—not a normalized group score—and v2 snapshots are cross-field validated before they are served. The guarded count-only preflight/reset tooling in `4ce95f0` is unit-tested locally. A disposable Cloud Run/Firebase/Firestore project passed health, Hosting routing, disposable approved-account authentication, one Firestore-backed destination-blind comparison, response redaction, and count-only state inspection before it was deletion-requested.

The post-choice presentation also has a typed **mood companion** system: every traveler has eight optimized local portrait crops, one for each existing preference dimension. Portraits appear only with safe, evidence-linked profile/result/reveal explanations and never in the blind game, atlas destination details, or waiting state.

The original one-trip release was deployed on 2026-08-22 as Cloud Run revision `lgs-api-00009-x8r` and Firebase Hosting version `ab1c50b7b1550cc8`. The current production release is commit `23f83e6`, deployed on 2026-08-24 as Cloud Run revision `lgs-api-00014-5sb` and Firebase Hosting. The API health route and public Hosting route returned successfully. The original trip has now started and its reveal is open, so the historical empty-state preflight does not apply to this isolated Lightning follow-up deployment.

## Release evidence

1. **Fixed-shortlist verification — passed locally:** `npm test -- --run backend/tests/model/shortlist-release-evidence.test.ts` records deterministic fixed-32 replay, representative clear/close/noisy/divergent fit, pair safety, coverage through question 24, every eligible final-eight boundary selection, comparison redaction, and v2 snapshot stability for `bayes-attribute-shortlist-v1`. The completed complex-model audit remains historical evidence, not this model's gate; see [model evaluation](model-evaluation.md) and ADR 0003.
2. **Rehearsal — passed:** The isolated Auth/Firestore Emulator verifies configuration, concurrent/stale pending claims, racing immutable reveal creation, persisted snapshot reload, redacted v2-result serialization, and five disposable authenticated identities through mismatch recovery, resume/duplicate handling, all five exact 32-choice rounds, completion gates, Dan-only reveal, and immutable snapshot parity. A literal browser pass independently verified character selection, local authentication, the required briefing, all 32 choices for one disposable traveler, profile, private top five, atlas/map/list synchronization, photo viewer, and who-finished gate. The five-person browser state was exercised through the authenticated API emulator rehearsal, not five separate visual-browser contexts.
3. **Production verification — passed:** Fixture-based desktop/mobile visual and accessibility review is complete locally. The limited disposable cloud smoke passed and the temporary project is deletion-requested. Firebase Hosting and the current Cloud Run revision `lgs-api-00008-4np` were deployed successfully. Health and public-route checks passed, and the final count-only production preflight returned `empty: true` with zero started or completed travelers and snapshots. Production must never be used for a test journey because the guarded reset intentionally refuses started state.

## Required one-trip inference work

The release candidate is a deliberately small Bayesian attribute model: it learns from the eight canonical attributes, asks every traveler exactly 32 adaptive questions, and produces a personal trip shortlist. Posterior sampling is internal to selection; the public experience never claims certainty or a mathematically optimal group winner. The older Elo and hierarchical paths remain offline references only. See the [one-trip delivery roadmap](roadmap.md).

## Explicitly out of scope

Multi-trip administration, organizer roles, invitations, content-editing UI, live airfare/travel-time providers, practical ranking, public sharing/export, comparison-history products, and platform-scale operational tooling are not needed for this fixed trip. Editorial activity imagery and restrained motion are already shipped.

## Release checks

Run `npm run validate:seed`, `npm test`, `npm run typecheck`, and `npm run build` before a release. The hosted frontend is [lets-go-somewhere-3549f.web.app](https://lets-go-somewhere-3549f.web.app); production persistence is used whenever Cloud Run provides `K_SERVICE`. This is ready for the real run. No real trip has started.
