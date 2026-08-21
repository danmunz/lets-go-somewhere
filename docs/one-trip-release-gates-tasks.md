# One-trip release-gates task board

**Source:** [one-trip release-gates specification](one-trip-release-gates-spec.md) at commit `194123f`.

**Status:** partially complete. RG-01 passed in `fbae847`; RG-02 passed
fixture-based visual/accessibility review in `3f101e4` and `06551f8`; RG-03
passed in `4ce95f0`; RG-04 passed in `a785de3`; and the complex-model audit is
recorded historically in `1d2c084`. ADR 0003 supersedes its promotion gate with
fixed-shortlist verification. RG-07 documentation reconciliation is current as
of 2026-08-20; RG-05 five-identity rehearsal, RG-06 fixed-shortlist evidence,
and RG-08 controlled release remain open. This board is an execution order,
not release approval.
**Hard stop:** deployment and the real five-person trip remain blocked until every required evidence task below passes against one immutable commit, seed digest, and selected model version. A failed task is recorded as failed; its thresholds, snapshot facts, and real-trip state must not be changed to make it pass.

## Delivery rules

- The transparent social ballot is already implemented through `2a809bf`; this board verifies it independently rather than reimplementing or recalculating it.
- The fixed 32-question Bayesian attribute shortlist is the release candidate. Its bounded verification is a hard gate; the complex hierarchical audit remains read-only historical evidence.
- Browser and Firestore evidence uses isolated emulator identities only. No real Google OAuth account, roster address, or real-trip document belongs in tests or Git.
- Release evidence is stored in private trip notes, outside the repository. Docs in Git may state commands, commit IDs, seed digests, aggregate pass/fail state, and safe receipts only.

## Dependency map

```text
RG-01 backend/API audit ─────────────┐
RG-02 frontend fixtures/a11y ────────┼─ RG-05 five-identity rehearsal ─┐
RG-03 preflight/reset tooling ───────┤                                 ├─ RG-07 docs/status reconciliation ─ RG-08 release
RG-04 emulator persistence proof ────┘                                 │
RG-06 fixed-shortlist verification ─────────────────────────────────────┘
```

`RG-01` through `RG-04` may begin in parallel. `RG-06` is independent of the social-ballot lanes. `RG-08` is blocked by every preceding task.

## Tasks

### RG-01 — Independent social-ballot backend and API audit

**Recorded outcome:** Passed locally in `fbae847`; see
[one-trip code review](one-trip-code-review.md). This does not pass the
browser, model, or deployment gates.

- **Type:** Review + Testing
- **Complexity:** High
- **Dependencies:** None
- **Can run in parallel with:** RG-02, RG-03, RG-04, RG-06
- **Description:** An engineer who did not author the reveal migration inspects the persisted v2 reader, DTOs, routes, tally, insight engine, and final-decision path. Add or strengthen black-box API tests for malformed snapshots, immutable repeated reads/open requests, v1 safe failure, stored-finalist membership, recursive redaction, and all required preference shapes.
- **Acceptance criteria:** Valid v2 snapshots are served only from stored facts; malformed or cross-field-inconsistent snapshots fail safely before either personal or group DTO construction; no route recalculates a reveal; v1 stays read-only and `temporarily-unavailable`; public responses contain none of the forbidden comparison/model/credit/location fields; all standard tests pass.
- **Testing requirements:** Focused repository and route tests for every malformed field class named in the release spec, plus broad leader, shared-first, shortlist, no-consensus/all-different, wild-card, camp, and split fixtures.
- **Documentation requirements:** Add only confirmed findings to `docs/one-trip-code-review.md`; record unresolved blockers explicitly.
- **Branch strategy:** Test/review branch; production changes only as a focused follow-up bug fix with a separate commit.

### RG-02 — Frontend social-reveal fixtures and accessibility coverage

- **Type:** Design + Testing
- **Complexity:** High
- **Dependencies:** None
- **Can run in parallel with:** RG-01, RG-03, RG-04, RG-06
- **Description:** Create deterministic client fixtures for every stored display mode and social overlay. Exercise the transparent verdict using fixture data, not live Firestore, and verify the points key, equal ties, score table, personal top fives, rank matrix, insight cards, photo fallback, and immutable decision controls.
- **Acceptance criteria:** Broad leader, shared-first/dead heat, shared shortlist, no-consensus, wild-card, two-camp, and split states render without legacy normalized/confidence/polarization copy; no-consensus shows all five #1 picks; shared rank leaders receive equal hierarchy; matrix uses `Outside top five`; keyboard focus and reduced-motion behavior are clear; final choice is limited to stored finalists plus research.
- **Testing requirements:** Component tests for keyboard details/confirmation, focus restoration, reduced motion, image failure, 44px controls, and prohibited legacy-field rendering. Capture desktop and mobile fixture screenshots for the four release-spec states.
- **Documentation requirements:** Update the visual review record only after screenshots are reviewed; do not call it passed before RG-05.
- **Branch strategy:** Frontend test/fixture branch; preserve production component contracts and use semantic selectors rather than layout-only selectors.

### RG-03 — Implement and test the operator preflight/reset guard

**Recorded outcome:** Passed focused implementation tests in `4ce95f0`. No
production preflight or reset has been run.

- **Type:** Infrastructure + Testing
- **Complexity:** High
- **Dependencies:** None
- **Can run in parallel with:** RG-01, RG-02, RG-04, RG-06
- **Description:** Implement the dedicated operator-only scripts required by the release spec: count-only read-only preflight and explicitly guarded controlled reset. The scripts must use ADC/deployment identity, bind to an explicitly supplied project, inspect only the four one-trip collections, validate referenced snapshots through the persisted reader, and never print document bodies.
- **Acceptance criteria:** Preflight reports the required counts and one allowed reveal state; it exits nonzero for open v1, missing snapshot, invalid state, or nonempty real-trip state. Reset requires exact project, confirmation, and private export-reference arguments; deletes only named one-trip documents; emits a count-only receipt; and re-runs preflight to prove empty state. It refuses after any real-trip start.
- **Testing requirements:** Mock/isolated emulator tests for project mismatch, all reveal-state classifications, missing/invalid snapshots, missing guards, exact deletion scope, post-reset empty status, and output redaction.
- **Documentation requirements:** Add exact safe commands and receipt handling to the runbook when tests pass.
- **Branch strategy:** Separate operations branch; no command may target production during automated tests.

### RG-04 — Extend Firestore Emulator release-proof suite

**Recorded outcome:** Passed locally in `a785de3` with seven isolated Emulator
tests. The five-identity browser rehearsal remains a separate gate.

- **Type:** Testing
- **Complexity:** High
- **Dependencies:** RG-01
- **Can run in parallel with:** RG-02, RG-03, RG-06
- **Description:** Extend the isolated emulator suite beyond pending-pair races to test concurrent organizer reveal creation, restart/reload snapshot identity, final-decision persistence, stale decision conflict, and v2 result redaction against the actual persistence adapter.
- **Acceptance criteria:** Every test uses isolated Auth/Firestore Emulator state; racing opens store one identical snapshot; reload after store reconstruction returns the same snapshot facts; one final decision per identity persists; stale writes do not mutate it; and tests never initialize the production project.
- **Testing requirements:** Run the full emulator command with the documented JDK path plus standard seed, unit, typecheck, and build commands.
- **Documentation requirements:** Add only the passed command and summary result to the runbook/status.
- **Branch strategy:** Test-only branch, except minimal emulator harness/config wiring required for isolation.

### RG-05 — Run and record the five-identity browser rehearsal

- **Type:** Quality Gate
- **Complexity:** High
- **Dependencies:** RG-02, RG-03, RG-04, RG-06
- **Can run in parallel with:** None; it integrates the verified release candidate.
- **Description:** Build the minimal Auth Emulator rehearsal harness, then run the complete journey as Dan, John, Matt, Peter, and James in isolated browser contexts. Record evidence outside Git for mismatch recovery, refresh/resume, stale/duplicate answers, truthful fixed-32 progress, profile/atlas/waiting gates, map/image fallback, organizer-only reveal, snapshot agreement, stale-tab final decision, desktop/mobile, keyboard, reduced motion, and pre-reveal redaction.
- **Acceptance criteria:** Every scenario passes on one exact commit/seed/model tuple; all five users receive the same immutable snapshot ID after opening; no destinations or result data leak before the appropriate gate; no real OAuth or roster account is used; screenshots and timestamps exist in the private record.
- **Testing requirements:** Before recording success, run seed validation, unit tests, typecheck, build, and the emulator suite. Any failed visual/accessibility check returns to RG-01/RG-02/RG-04 as appropriate.
- **Documentation requirements:** Add the private evidence reference and a factual pass/fail outcome to the runbook/status; do not commit screenshots or identities.
- **Branch strategy:** Harness/test configuration branch followed by a clean release-candidate run; disable all test auth in production builds.

### RG-06 — Fixed-32 Bayesian shortlist verification

- **Type:** Research + Testing + Documentation
- **Complexity:** High
- **Dependencies:** None
- **Can run in parallel with:** RG-01, RG-02, RG-03, RG-04
- **Description:** Verify the selected Bayesian attribute-only model through deterministic 32-question replays and representative clear, close, noisy, and divergent fixtures. Assert two appearances per destination by question 24, final-eight boundary selection whenever eligible, no duplicate/same-destination pairs, strict comparison redaction, and snapshot/reload stability.
- **Acceptance criteria:** The evidence records exact commands, commit, seed digest, fixture definitions, and reproducible pass/fail artifacts. No fixture or rule change is made merely to convert a failure. A failed verification blocks RG-05/RG-08.
- **Testing requirements:** Deterministic replays; zero representative fit failures; fixed-32 completion; pair uniqueness/coverage/boundary assertions; redaction and immutable snapshot checks.
- **Documentation requirements:** Update `docs/model-evaluation.md` and ADR 0003 with method choice and exact evidence.
- **Branch strategy:** Single backend/test integration branch; no production route may select the old baseline.

### RG-07 — Reconcile release documentation and evidence status

- **Type:** Documentation + Review
- **Complexity:** Medium
- **Dependencies:** RG-01, RG-02, RG-03, RG-04, RG-05, RG-06
- **Can run in parallel with:** RG-08 preparation only
- **Description:** Reconcile status documents to the evidence that actually passed: release gates, runbook, implementation status, architecture, content guide, changelog, persistent context, and relevant ADRs. Verify terminology consistently describes individual-model inference plus a transparent group tally.
- **Acceptance criteria:** No document claims an unrun rehearsal or incomplete shortlist verification has passed; docs distinguish “ready for real run” from “trip started”; the v1 read-only/open-v1 stop and controlled reset sequence are discoverable; links resolve and no old normalized/polarization public-reveal claim remains.
- **Testing requirements:** Link/checklist review and a repository search for contradictory public-group-result wording.
- **Documentation requirements:** This task owns the final factual reconciliation and CHANGELOG entry.
- **Branch strategy:** Docs-only, one atomic commit after the evidence bundle is complete.

### RG-08 — Controlled preflight, deploy, smoke, and final reset

- **Type:** Deployment
- **Complexity:** High
- **Dependencies:** RG-07 and recorded pass evidence for every prior release gate
- **Can run in parallel with:** None
- **Description:** The release manager runs and archives production's read-only, count-only preflight, then runs the behavioral smoke suite in a separately provisioned disposable Firebase/GCP environment. Only after that smoke evidence passes, deploy the exact verified commit to Cloud Run `lgs-api` in `us-east4` and Firebase Hosting, then require a final empty production preflight before sharing the URL. The guarded production reset is not a smoke cleanup tool: it refuses any started journey.
- **Acceptance criteria:** Production preflight confirms no open v1 reveal and empty state both before and after deployment; the separate disposable environment proves health, approved-account auth, one blind comparison, refresh/resume, completion-gated atlas, and organizer reveal authorization; deploy succeeds. Any failure stops release and preserves evidence/state for investigation.
- **Testing requirements:** Run the full verified command sequence immediately before deploy and record only count-safe receipts and deployment identifiers.
- **Documentation requirements:** Mark release status only after final preflight; record the deploy commit/version and explicitly say whether the real trip has started.
- **Branch strategy:** Release-manager-only operation. No unrelated code changes; rollback uses the documented previous deploy, never a destructive repository reset.

## Parallel execution groups

| Wave | Work | Merge / evidence gate |
| --- | --- | --- |
| A | RG-01, RG-02, RG-03, RG-06 | Independent test fixtures, operator guard, and model evidence have isolated owners. |
| B | RG-04 after backend audit handoff | Emulator persistence proof is green. |
| C | RG-06 fixed-shortlist verification | The fixed 32-question release candidate is verified. |
| D | RG-05 after RG-02, RG-03, RG-04, and RG-06 | Five-identity evidence passes on one commit/seed/model tuple. |
| E | RG-07 | Docs describe only recorded evidence. |
| F | RG-08 | Deployment remains blocked until all prior gates pass. |

## Critical path

`RG-06 → RG-05 → RG-07 → RG-08`

The social-ballot evidence path is also mandatory:

`RG-01 → RG-04`, plus `RG-02` and `RG-03`, then `RG-05 → RG-07 → RG-08`.

Neither path can be waived. In particular, a visually successful social reveal does not authorize deployment while the fixed-shortlist verification is incomplete.
