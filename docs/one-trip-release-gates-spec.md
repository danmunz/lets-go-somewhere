# One-trip release gates

**Status:** Released 2026-08-21. Fixed-shortlist verification, authenticated five-identity API rehearsal, focused literal-browser flow, disposable cloud smoke, deployment, and final production preflight passed. No real trip has started.

Completed evidence: the independent v2 social-ballot audit/fail-closed fixes
(`fbae847`), guarded preflight/reset implementation and focused tests
(`4ce95f0`), the active-top-k method research handoff (`95ea81c`), the
seven-case Firestore Emulator persistence proof (`a785de3`), and the
fixture-based desktop/mobile visual and accessibility review (`3f101e4`,
`06551f8`). `1d2c084` supplies historical complex-model audit tooling. The
release candidate is now the fixed 32-question Bayesian attribute shortlist.
Its bounded verification passed in `271867d`; authenticated API rehearsal
passed in `f205caa`. A temporary Cloud Run/Firebase/Firestore project verified
live health, Hosting routing, approved disposable-account authentication, one
Firestore-backed blind comparison, and redaction before deletion was requested.
The literal browser record covers one disposable traveler end-to-end; the five-person state transition is verified by the authenticated API Emulator rehearsal. This is recorded as the actual evidence boundary, not a claim of five concurrent visual-browser contexts.

This specification records the release criteria and evidence for the transparent
social ballot. Future changes must satisfy the same destination-blindness,
snapshot, and preflight rules before release.

## Release rule

The real five-person trip may start only when every gate below has recorded
evidence against one immutable commit, canonical seed digest, and selected
model version:

1. Social-ballot integrity, API redaction, emulator, browser, and visual QA
   pass.
2. `bayes-attribute-shortlist-v1` passes its deterministic fixed-32 replay,
   representative-fit, coverage, boundary-selection, redaction, and
   snapshot-stability checks documented in ADR 0003.
3. A production preflight confirms there is no open v1 reveal and the trip
   state is empty after the controlled reset.
4. Cloud Run and Hosting deploy successfully after an empty count-only
   production preflight. Any behavioral smoke test uses a separately
   provisioned disposable Firebase/GCP environment, because the guarded
   production reset correctly refuses a journey once a comparison has started.

Failure of any gate is a release stop. It must be recorded as a failure, not
worked around by changing copy, thresholds, snapshot data, or the real trip
state.

## Social-ballot verification

### Backend and persistence

- Add focused tests that load deliberately malformed v2 snapshots and confirm
  the repository rejects them before either personal or group result DTO is
  built. Cover mismatched finalist IDs, rank matrix entries, member top fives,
  points, first-place counts, supporter sets, displayed ranks, display mode,
  and insight evidence/order.
- Test a valid v2 snapshot through repeated reads and repeated organizer-open
  requests; the same snapshot ID and stored facts must return after a restart
  or changed live ranking implementation. Never recalculate an opened reveal.
- Test final-decision membership against only the five stored finalists plus
  `need-more-research`, one immutable decision per roster member, and the
  stale/repeat conflict response.
- Test legacy behavior with a persisted `schemaVersion: 1` snapshot: result
  routes must return the existing safe `temporarily-unavailable` response,
  must not write a v2 replacement, and must not calculate a live group result.
- Test public responses recursively for absence of comparison/activity data,
  model utilities, posterior/interval data, normalized scores, legacy
  consensus or polarization labels, coordinates, and media-credit metadata.
- Exercise broad leader, near/shared first tie, default shared shortlist,
  no-consensus, all-different, wild-card, two-camp, and split-destination
  fixtures through the real v2 result route. Assert the published 5/4/3/2/1
  tally and display facts are exactly those persisted in the snapshot.

### Frontend and visual review

- Add component fixtures for every stored display mode and overlay. Verify
  that shared rank leaders receive equal visual hierarchy, no-consensus shows
  all five personal #1 picks without a winner claim, and a wild card remains
  visible on its traveler's card.
- Verify the always-visible 5/4/3/2/1 key, image-led five-place scoreboard,
  supporter-avatar text equivalents, all five personal top fives, and the
  finalist matrix. Matrix cells must say `Outside top five`, never `6+`.
- Test keyboard opening/closing of destination details and final-decision
  confirmation, focus return, 44px controls, and reduced motion. Sequential
  decoration must not delay readable result content or a decision.
- Capture desktop and mobile screenshots for broad leader, shared first tie,
  no consensus, and a split/wild-card combination. Review for the 20px desktop
  text floor, contrast, non-color rank/point evidence, imagery fallback, and
  destination names only after the reveal gate.

## Preflight and controlled reset

Implement a dedicated operator-only script, separate from the public API,
with a read-only mode and an explicitly destructive reset mode. It uses
Application Default Credentials or the configured private deployment service
identity; it accepts no credentials, roster addresses, or project secrets on
the command line and must never print document bodies, raw comparisons, or
tokens.

### Read-only preflight

`npm run preflight:one-trip -- --project lets-go-somewhere-3549f` must:

- require an explicit project ID, verify the credential-selected project
  matches it, and print that target before inspecting it;
- inspect only `lgsV4Users`, `lgsV4State/reveal`, `lgsV4ResultSnapshots`, and
  `lgsV4FinalDecisions`;
- report counts only: started users, completed users, snapshots, decisions;
- report reveal state as `closed`, `open-v1`, `open-v2`, `missing-snapshot`, or
  `invalid`; validate any referenced snapshot with the persisted reader;
- exit nonzero for `open-v1`, `missing-snapshot`, or `invalid`, and exit zero
  only when the state is empty/closed and contains no started users, snapshots,
  or decisions.

The preflight output is the required v1 migration evidence. An `open-v1`
result is a hard stop: preserve the legacy snapshot read-only, do not deploy a
route that reinterprets it, and obtain a group decision before resetting that
trip.

### Controlled reset

`npm run reset:one-trip -- --project lets-go-somewhere-3549f --confirm-trip-reset --export-ref <private-reference>`
is permitted only before the real trip begins. It must require all four
arguments exactly, re-run the read-only inspection, and refuse to run without
the locally generated export reference. It deletes only the named one-trip
documents in the four collections above, never a collection root, unrelated
Firestore data, deployment configuration, or source files.

After deletion it re-runs preflight and exits successfully only for the empty
state. It emits a count-only receipt with project ID, commit, seed digest,
UTC time, export reference, and post-reset status; the operator stores that
receipt in private trip notes, outside the repository. No reset is permitted
after a real participant starts or after Dan opens a real reveal.

## Five-identity rehearsal and evidence

Run the verified commit against the isolated Auth/Firestore Emulator with five
test identities mapped to Dan, John, Matt, Peter, and James. Do not use Google
OAuth or a real roster account. Record browser, viewport, commit, seed digest,
model version, timestamps, and pass/fail screenshots outside Git.

The rehearsal must prove:

- selection/account mismatch is recoverable; each identity can resume an
  unexpired pending pair after refresh; stale and duplicate submissions do
  not append twice;
- progress truthfully advances from `0 of 32 choices` through `32 of 32
  choices`; completion reaches profile, atlas, and waiting
  without leaking personal or group ranks;
- the atlas works with map/list synchronization and remains usable under its
  documented map/image fallback;
- only Dan can open the envelope after all five identities complete; the
  locked route exposes no result data before then;
- all five identities receive the same immutable snapshot ID after reveal;
  the social ballot, personal results, and final-decision choices agree with
  it; a stale tab reload observes another user's already-recorded decision;
- the visual/accessibility checks above pass in desktop and mobile contexts.

Extend the Emulator suite to cover concurrent reveal opening, restart/reload
snapshot stability, and final-decision persistence in addition to its current
pending-pair transaction cases. Run `npm run validate:seed`, `npm test`,
`npm run typecheck`, `npm run build`, and `npm run test:emulator` before
recording rehearsal success.

## Fixed-shortlist verification, deployment, and smoke test

The model owner must record deterministic fixed-32 replays and representative
clear, close, noisy, and divergent fixture results. The evidence must confirm
zero fit failures, two appearances per destination by question 24, final-eight
boundary selection when eligible, pair safety, strict comparison redaction,
and stable persisted shortlists. Record exact commands, fixtures, seed digest,
and pass/fail result in `docs/model-evaluation.md` and ADR 0003. No rule or
fixture may be changed merely to convert a failure into a pass. Until that
bounded verification passes, no real-trip deployment occurs.

Once all gates are recorded as passed:

1. Run read-only preflight and archive its count-only receipt.
2. If and only if that preflight shows closed, untouched pre-start debris,
   obtain the required private export reference, perform the guarded reset,
   and rerun preflight to require the empty result. A started user, completed
   user, or opened/missing/invalid reveal is a hard stop, not resettable
   release debris.
3. Run the behavioral smoke test in the separately provisioned disposable
   Firebase/GCP environment: health, approved-account authentication, one
   destination-blind comparison, refresh/resume, completion-gated atlas, and
   organizer reveal authorization. Record only safe evidence; do not use a
   real roster account or production documents.
4. Verify the existing service's `ROSTER_EMAILS` environment-variable name
   without logging its value. Deploy the exact verified commit from source to
   Cloud Run `lgs-api` with explicit project `lets-go-somewhere-3549f` and
   region `us-east4`, without flags that replace environment variables,
   service identity, or IAM; then deploy Firebase Hosting for
   `lets-go-somewhere-3549f`.
5. Rerun production's count-only preflight and require the empty result before
   sharing the production URL with the five friends. Do not submit a
   comparison in production before the real trip begins.

Update the runbook, implementation status, deployment documentation,
changelog, and persistent context only with the commands and evidence that
actually passed. The final release note must distinguish **ready for the real
run** from actually starting the trip.
