# Delivery roadmap

Proposed by the Scrum Team on 2026-08-18. This roadmap is sequenced from the deployed V1 beta; it is not a commitment to build every V2 item before the five-person trip runs.

## Sprint 0 — Documentation and release truth

**Goal:** make the written contract match the live product without papering over gaps.

- Reconcile README, deployment, delivery, review, implementation, architecture, product, and UX documents.
- Add release, rollback, and reset guidance without committing identities or credentials.
- Record the comparison-photo and atlas-before-group-reveal decisions as accepted product tradeoffs.

**Done when:** no document describes deployed packages as future, production persistence as in-memory, Google authentication as unconfigured, or photos/maps as V2-only. This sprint is complete with the reconciliation commit that accompanies this document.

## Sprint 1 — Individual payoff

**Goal:** complete the participant's personal reveal story before the social result.

| Task | Work | Acceptance criteria |
| --- | --- | --- |
| V1-01 | Design and build the destination-free preference-profile screen from `/v1/profile`. | A completed participant sees a clear, evidence-grounded profile before the atlas. |
| V1-02 | Define the post-gate individual-result contract from `/v1/results/me`. | Top five and explanation primitives are never available before the reveal gate. |
| V1-03 | Build a personal top-five/results surface and re-entry from atlas/verdict. | A user can understand their own result without seeing another person's raw choices. |
| V1-04 | Add deterministic explanation primitives: strong attributes, supporting activities, and close calls. | UI language does not overstate model confidence or fabricate rationale. |

V1-01 can run in parallel with V1-02. V1-03 depends on V1-02; V1-04 informs V1-03.

## Sprint 2 — Waiting and shared decision

**Goal:** turn the reveal gate into a useful, privacy-safe social moment.

| Task | Work | Acceptance criteria |
| --- | --- | --- |
| V1-05 | Build the five-character waiting lobby on `/v1/group-status`. | Completion-only status updates without leaking partial preferences. |
| V1-06 | Persist an immutable post-reveal gut check: a finalist or `need-more-research`. | It never changes the blind ranking and is unavailable before reveal. |
| V1-07 | Build finalists/gut-check UI. | Submitted choices are visible only after the gate. |
| V1-08 | Enrich the verdict with a consensus/polarization legend and group-finalist rank view. | The social result remains understandable with reduced motion. |
| V1-09 | Show seeded weather, travel effort, and available approximate logistics beside revealed finalists. | No practical composite score is implied or fed back into ranking. |

V1-05 and V1-06 may run in parallel. V1-07 depends on V1-06; V1-08 and V1-09 depend on Sprint 1 result contracts.

## Sprint 3 — V1.1 reliability, accessibility, and operations

**Goal:** make a real five-person run repeatable and observable.

- Firestore-emulator coverage for roster mapping, persistence across restart, pending-pair atomicity, duplicate/stale submissions, group aggregation, and reveal authorization.
- Authenticated browser E2E flow across five test identities: resume, 24/28/40 thresholds, atlas gate, waiting, organizer reveal, results, and gut check.
- Automated media/redaction/pin tests: 120 activity assets, 24 three-photo galleries, credits/alts, safe comparison payloads, map/list synchronization.
- Structured logs, health checks, error alerting, backup/export policy, rollback procedure, and a low-risk test-study reset runbook.
- Accessibility/performance review for focus order, live regions, map fallback, image fallback, visual regression, mobile layout, and WebGL/bundle budgets.

## Sprint 4 — V1.1 ranking calibration

**Goal:** validate the current stopping rule before adding model complexity.

- Add versioned study/result snapshots and privacy-reviewed aggregate event metrics.
- Build deterministic replay/simulation fixtures to compare the existing coverage heuristic with a stable-top-five rule.
- Change the stopping rule only if simulations demonstrate material instability; retain the current model as the default until that threshold is met.
- Review card wording, media correspondence, recognition bias, and exposure distribution after a pilot.

## Sprint 5 — V2 preference model and explainability

**Goal:** add validated uncertainty-aware ranking only after Sprint 4.

- Model ADR and offline evaluation rubric with the V1 model kept behind a version flag.
- Hierarchical or regularized Bradley–Terry prototype with destination uncertainty/confidence intervals.
- Information-gain pair selector balancing uncertainty, coverage, diversity, fatigue, and fairness.
- Explanation renderer tied strictly to recorded model evidence.

**Gate:** simulations must show improvement at equal or fewer choices; V1 results remain reproducible.

## Sprint 6 — V2 practical decision layer and sharing

**Goal:** help the group decide after blind discovery without mutating the pure-preference result.

- Dates/origins/practical-data contract; cached airfare/travel-time provider with source, timestamp, and failure states.
- Separate practical lens and finalist head-to-head; never silently merge it with pure preference.
- Post-gate destination detail, itinerary research links, and consent-aware sharing/export.

## Sprint 7 — V2 multi-trip organizer platform

**Goal:** generalize safely beyond one fixed study.

- Immutable study snapshot, groups/roles, authorization, and migration plan.
- Organizer content/media curation, validation preview, invitations, and no-edit-after-first-response guard.
- Trip dashboard, audit log, completion metrics, archival/export, multi-trip selector, rules/index/load testing.

This is a product/security rewrite, not a small feature. It must follow a successful fixed-roster pilot.

## Critical path and recommendation

`Sprint 0 → Sprint 1 → Sprint 2 → Sprint 3 → pilot → Sprint 4 → V2 model/practical/admin work`

Call the current deployment **V1.0 beta**. Call V1 complete after Sprints 1–3; do not begin V2 modeling or multi-trip administration before the intended five-person flow has been exercised end to end.
