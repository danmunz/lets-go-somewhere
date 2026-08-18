# One-trip delivery roadmap

Revised with the Scrum Team on 2026-08-18. This is a plan to make one fixed five-person trip decision excellent and trustworthy. It is not a platform roadmap, and there is no assumed later V2 release to catch work that matters to this group.

Current checkpoint: the participant journey, durable persistence, snapshot-backed reveal, and local UI are implemented and committed as `91dc81c`. The advanced model work is present offline but has not passed the fixed simulation gate; the hosted app therefore remains a V1 beta on the deterministic foundation. The remaining roadmap is release validation and model promotion work, not a request to build a future platform.

## Sprint 0 — Documentation and release truth

**Status: complete.** The reconciliation commit records the production Firebase/Cloud Run/Firestore setup, the accepted comparison-photography and post-completion-atlas tradeoff, the group-ranking rule, and the implementation gaps that remain.

## Sprint 1 — Complete the human story

**Goal:** make the journey feel complete from a person's final choice through the group's final call.

| Task | Work | Acceptance criteria |
| --- | --- | --- |
| ONE-01 | Build the destination-free preference-profile beat from `/v1/profile`. | A completed traveler sees an evidence-grounded description of their tastes before entering the atlas. |
| ONE-02 | Build the five-character waiting lobby from `/v1/group-status`; use polling and explicit refresh, not realtime infrastructure. | It conveys completion-only roster state without leaking preferences. |
| ONE-03 | Build personal post-gate results and concise explanation primitives from `/v1/results/me`. | A traveler can understand their own top results without seeing anyone else's raw choices. |
| ONE-04 | Enrich the verdict with a consensus/polarization key, finalist context, and a safe group-finalist rank view. | The social result explains what agreement and a close call mean, including under reduced motion. |
| ONE-05 | Add one immutable post-reveal group decision: choose a finalist or `need-more-research`. | It never alters the blind ranking, exposes no activity-by-activity choices, and gives the group a clear next conversation. |

Existing seeded weather, travel effort, and any available rough logistics appear only as labelled finalist context. There is no separate practical score or live airfare integration.

## Sprint 2 — Make the inference worthy of one use

**Goal:** replace the provisional heuristic with a validated, uncertainty-aware preference model before the friends play for real.

| Task | Work | Acceptance criteria |
| --- | --- | --- |
| MODEL-01 | Write the model ADR, fixed evaluation rubric, and versioned result snapshot contract. | Every result records the seed and ranking-model version needed for reproducibility. |
| MODEL-02 | Implement a hierarchical or regularized Bradley–Terry model with activity, destination, and attribute effects. | Individual and group results use calibrated posterior preference estimates rather than only raw Elo-style scores. |
| MODEL-03 | Calculate uncertainty/credible intervals for destination outcomes and the group-finalist boundary. | The API and UI can distinguish a clear favorite from a genuinely close call without pretending to know more than the data supports. |
| MODEL-04 | Replace the coverage-only pair selector with an information-gain policy that balances uncertainty, destination coverage, diversity, and fatigue. | Later questions are measurably diagnostic, not merely unobserved. |
| MODEL-05 | Replace the fixed heuristic stopping rule with a confidence-aware, bounded rule. | The round still has humane safeguards, but ends when the finalist boundary is stable rather than at an arbitrary exposure count. |
| MODEL-06 | Run deterministic replay/simulation tests over representative synthetic preference profiles. | The upgraded model must improve finalist stability at equal or fewer choices; retain the current model as a reproducible baseline, not the production default. |

The user experience remains legible: the progress counter remains bounded, the app can ask a few additional discriminating questions when needed, and post-reveal language may say “clear favorite” or “close call.” It must not expose raw posterior math or turn the game into a statistics lesson.

## Sprint 3 — Rehearse and safeguard the actual trip

**Goal:** prove this single run survives ordinary failures and is usable by every friend.

- Firestore-emulator coverage for roster mapping, persistence across restart, pending-pair atomicity, duplicate/stale submissions, advanced-model result calculation, and reveal authorization.
- Authenticated browser E2E rehearsal across five test identities: resume, dynamic stopping, atlas gate, waiting lobby, organizer reveal, personal results, and final gut check.
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

The current deployment remains a **V1 beta**. It is ready for the actual one-shot decision only when all three sprints pass: a complete emotional/social flow, uncertainty-aware and information-gain-driven ranking, and a five-person rehearsal with recovery guidance.
