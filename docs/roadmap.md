# One-trip delivery roadmap

Revised with the Scrum Team on 2026-08-18. This is a plan to make one fixed five-person trip decision excellent and trustworthy. It is not a platform roadmap, and there is no assumed later V2 release to catch work that matters to this group.

Current checkpoint: the participant journey, durable persistence, snapshot-backed reveal, and local UI are implemented. The complex hierarchical candidate was audited and rejected for this one-shot product decision. The release candidate is `bayes-attribute-shortlist-v1`: a fixed 32-choice Bayesian attribute shortlist whose output feeds the transparent social ballot. The remaining roadmap is bounded shortlist verification and release rehearsal, not a request to build a future platform.

## Sprint 0 — Documentation and release truth

**Status: complete.** The reconciliation records the production Firebase/Cloud
Run/Firestore setup, the accepted comparison-photography and post-completion
atlas tradeoff, and the approved transparent group-tally rule.

## Sprint 1 — Complete the human story

**Goal:** make the journey feel complete from a person's final choice through the group's final call.

| Task | Work | Acceptance criteria |
| --- | --- | --- |
| ONE-01 | Build the destination-free preference-profile beat from `/v1/profile`. | A completed traveler sees an evidence-grounded description of their tastes before entering the atlas. |
| ONE-02 | Build the five-character waiting lobby from `/v1/group-status`; use polling and explicit refresh, not realtime infrastructure. | It conveys completion-only roster state without leaking preferences. |
| ONE-03 | Build personal post-gate results and concise explanation primitives from `/v1/results/me`. | A traveler can understand their own top results without seeing anyone else's raw choices. |
| ONE-04 | Replace normalized group scoring with the approved 5/4/3/2/1 top-five tally, full personal top-fives, and evidence-backed overlap/divergence views. | The score rule, ranks, ties, camps, wild cards, and no-consensus state are visible without raw activity choices or hidden group math. |
| ONE-05 | Add one immutable post-reveal group decision: choose a finalist or `need-more-research`. | It never alters the blind ranking, exposes no activity-by-activity choices, and gives the group a clear next conversation. |

Existing seeded weather, travel effort, and any available rough logistics appear only as labelled finalist context. There is no separate practical score or live airfare integration.

## Sprint 2 — Make the inference worthy of one use

**Goal:** replace the provisional heuristic with a bounded, intelligible Bayesian shortlist before the friends play for real.

| Task | Work | Acceptance criteria |
| --- | --- | --- |
| MODEL-01 | Write the model ADR, fixed evaluation rubric, and versioned result snapshot contract. | Every result records the seed and ranking-model version needed for reproducibility. |
| MODEL-02 | Implement Bayesian logistic fitting over the eight canonical attributes only. | Each traveler receives a useful personal shortlist without unidentifiable destination/activity residuals. |
| MODEL-03 | Use private posterior draws for final-eight boundary-oriented pair selection. | Later questions focus on useful personal #5/#6 distinctions without exposing posterior math. |
| MODEL-04 | Replace the coverage-only pair selector with an information-gain policy that balances uncertainty, destination coverage, diversity, and fatigue. | Later questions are measurably diagnostic, not merely unobserved. |
| MODEL-05 | Commit every traveler to exactly 32 questions. | The round is predictable and never implies an opaque certainty threshold. |
| MODEL-06 | Run deterministic replay/fixture tests over representative preference shapes. | The shortlist path must remain deterministic, coverage-safe, redacted, and stable after persistence/reload. |

The user experience remains legible: every traveler sees `N of 32 choices`, then observational profile language and a post-reveal trip shortlist. It must not expose raw posterior math, confidence labels, or turn the game into a statistics lesson.

## Sprint 3 — Rehearse and safeguard the actual trip

**Goal:** prove this single run survives ordinary failures and is usable by every friend.

- Firestore-emulator coverage for roster mapping, persistence across restart, pending-pair atomicity, duplicate/stale submissions, advanced-model result calculation, and reveal authorization.
- Authenticated browser E2E rehearsal across five test identities: resume, fixed 32-round completion, atlas gate, waiting lobby, organizer reveal, personal results, and final gut check.
- Automated redaction/media/map checks: 120 activity assets, 24 three-photo galleries, credits/alts, safe comparison payloads, and map/list synchronization.
- One concise operator runbook: deploy, smoke test, export the Firestore state, recover from a failed test run, and perform a controlled reset before any participant starts.
- Focus, keyboard, mobile, reduced-motion, map-fallback, and image-fallback review. Address the existing bundle/WebGL risks only where they affect this one run.

## Explicitly out of scope

The following are consciously not being deferred to a product roadmap; they are unnecessary for this trip:

- multiple trips, self-serve organizers, invitations, roles, content-editing UI, audits, and a generalized admin dashboard;
- live airfare/travel-time providers, caching, or a second practical ranking;
- sharing/export products, comparison-history visualizations, and public result pages;
- monitoring/alerting or operational infrastructure beyond the small, documented one-trip runbook.

## Finish line

`Sprint 1 → Sprint 2 → Sprint 3 → play the real trip`

The production release is ready for the actual one-shot decision: the emotional/social flow, fixed-round Bayesian shortlist verification, and five-identity authenticated rehearsal are complete. No real trip has started; preserve the documented preflight and snapshot safeguards when it does.
