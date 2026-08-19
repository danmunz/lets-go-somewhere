# One-trip implementation code review

**Review scope:** the one-trip implementation checkpoint against `docs/one-trip-implementation-spec.md`, `docs/one-trip-tasks.md`, and the destination-blind boundary. The reviewed changes are committed in `91dc81c`.
**Reviewed:** 2026-08-18  
**Original verdict:** **Not release-ready.** The findings below were the must-fix correctness and authentication issues found in this review. They were resolved and regression-tested in the same change set on 2026-08-18. The later Firestore Emulator persistence proof and fixture-based verdict QA are also complete; fixed-shortlist verification and the unrun five-identity browser rehearsal remain release gates.

## Must-fix findings

### BUG-001 — A seed change can silently mix a live journey with different content and results

**Priority:** Must-Fix  
**Category:** Correctness / result integrity  
**Resolution:** Resolved — first append now atomically binds the canonical seed digest; all one-trip routes and reveal checks fail closed with a non-revealing 503 if a started journey or snapshot no longer matches it.  
**Files:** `backend/src/store.ts:331-340`, `backend/src/store.ts:428-481`, `backend/src/app.ts:43-75`

`inspectSeedVersionState()` computes the required comparison between the live seed digest and the persisted digest, but no write assigns `seedVersion` and no route calls the inspection/guard. `claimPendingAndAppendComparison()` therefore accepts another answer after `destinations.json`, `activities.json`, or `activity-media.json` changes. `/v1/comparison/next` also continues issuing a new pair from the changed seed.

This violates specification §3.4: once a participant has begun, the release must stop rather than silently mix seed versions. It can produce a result that cannot be replayed from the stored choices and snapshot digest.

**Required fix:** On the first successful comparison append, persist `getSeedVersion()` in the same transaction. Before issuing, claiming, completing, profiling, atlas access, reveal, or returning results for a user with comparisons, compare the persisted and current digests. Return a typed, non-revealing `503`/`seed-version-mismatch` state without mutating data when they differ. Add tests for first-write binding, mid-journey mismatch rejection, and post-reveal mismatch handling.

### BUG-002 — Personal results are recalculated from mutable live data after reveal instead of the immutable reveal snapshot

**Priority:** Must-Fix  
**Category:** Correctness / reveal immutability  
**Resolution:** Resolved — reveal snapshots persist personal rank/order, confidence, interval, profile, and safe explanation inputs; personal results now serialize that immutable data and share the group snapshot/model identity.  
**Files:** `backend/src/app.ts:130-134`, `backend/src/dto/one-trip.ts:125-155`, `backend/src/store.ts:527-559`

`GET /v1/results/me` verifies that a snapshot exists, then discards it and calls `buildPersonalResultsResponse()` with the current seed and raw comparisons. That builder runs `rankUser()` again and returns a synthetic `baseline-...` snapshot ID. In contrast, group results read `lgsV4ResultSnapshots/{snapshotId}`.

Consequently the same opened envelope can show a group verdict from one immutable snapshot and a personal top five from a later seed/model implementation. This violates the requirement that post-reveal results use the immutable snapshot and makes the displayed `snapshotId` misleading.

**Required fix:** Persist all personal-result rendering inputs in the reveal snapshot (including rank/order, fit/confidence labels, safe explanation primitives, and intervals) when it is created. Make `/v1/results/me` fetch that snapshot and serialize only the caller's stored summary plus current non-ranking destination presentation data after the seed-version guard passes. Its returned `snapshotId` and `modelVersion` must exactly match `/v1/results/group`. Add a regression test that attempts a seed/model change after reveal and proves both group and personal results remain stable.

### SEC-001 — Invalid or expired Firebase tokens turn into 500s, preventing the UI's re-authentication recovery path

**Priority:** Must-Fix  
**Category:** Authentication / availability  
**Resolution:** Resolved — Firebase verification failures return an unauthenticated result, allowing the existing middleware/client 401 re-authentication path without exposing Firebase details.  
**Files:** `backend/src/auth.ts:9-19`, `backend/src/app.ts:36-40`, `frontend/src/api.ts:60-68`

`authenticate()` lets `getAuth().verifyIdToken()` reject. The middleware does not catch that exception, so an expired, malformed, revoked, or otherwise invalid bearer token becomes an unhandled server error instead of `401`. The client only clears its saved traveler and returns to Google sign-in for a `401`, so a normal expired session is rendered as an unrecoverable generic error.

**Required fix:** Catch Firebase token-verification failures inside `authenticate()` and return `undefined` (optionally log a non-sensitive reason server-side). The middleware will then return the existing `401` DTO and the client can follow its tested sign-in recovery path. Add API tests for malformed/expired-token rejection and verify no Firebase error detail reaches the response.

## Checks run

- `npm test` — 101 passed, 1 emulator-only test skipped in the normal demo run.
- `npm run typecheck` — passed.
- `npm run build` — passed; Vite reports a non-blocking large-chunk warning.
- `git diff --check` — passed.

## Release-readiness assessment

**Code-review findings resolved; release remains blocked.** The expanded Firestore Emulator proof and fixture-based visual QA are complete; run the five-identity browser rehearsal required by OT-22 through OT-26. The documented model-evaluation report is independently **FAIL — DO NOT PROMOTE**; it remains a hard release gate because the required advanced ranking has not yet cleared its synthetic evidence threshold.

## RG-02 transparent-reveal frontend QA — 2026-08-19

**Scope:** deterministic, post-gate fixture rendering only; no Firestore,
Google OAuth, real roster account, or production deployment was used.

- Added fixture coverage for broad leader, shared-first/dead heat,
  no-consensus, shared shortlist, and wild-card/two-camp/split overlays. The
  rendered contract keeps the 5/4/3/2/1 key, five personal top fives, the
  `Outside top five` matrix label, and only stored-finalist plus
  `need-more-research` decision choices. Legacy normalized, polarization,
  confidence, and interval copy is absent.
- Browser-harness review at 1703×822 and 390×844 found a real mobile defect:
  the retained `screen-enter` transform made a fixed finalist drawer
  page-relative. It was corrected so the detail sheet remains in the
  viewport after the entrance ends. The review also reduced the verdict hero
  scale and restored the required 20px desktop floor for visible verdict
  labels.
- Verified locally through the isolated Vite fixture route: no-consensus,
  near-tie, fallback image, drawer open/close, final-decision dialog focus,
  and reduced-motion (`animation-name: none`) states. Focus lands on “Not
  yet” when the native confirmation dialog opens. An image load failure shows
  the non-crediting “Photo unavailable” fallback.
- Checks: focused `verdictScreen.test.tsx` (13 passing), `npm run typecheck`,
  and `npm run build` passed. The normal Vite large-chunk warning remains
  non-blocking and unchanged in nature.

This is an RG-02 evidence record, **not** a release approval. The
five-identity rehearsal and fixed-shortlist verification remain separate gates;
the independent API audit, operator guard, and Emulator persistence proof have
their own completed local evidence.

## Transparent social-ballot audit — 2026-08-19

**Review scope:** RG-01 against the persisted v2 snapshot reader, social tally,
result DTOs, result routes, and final-decision repository. This review was
performed independently of the social-ballot implementation.

### Confirmed findings

#### BUG-004 — Legacy reveals could accept a new final decision

**Priority:** Must-Fix
**Resolution:** Resolved in the RG-01 audit change set.
**Files:** `backend/src/app.ts`, `backend/tests/release-audit.test.ts`

The legacy safe-fail policy covered personal and group result routes, but not
the final-decision GET/POST routes. A valid persisted v1 reveal could therefore
create a new discussion decision despite the documented read-only migration
policy. Both endpoints now perform the snapshot seed/version check and return
the same non-revealing `temporarily-unavailable` response for v1 without
writing a decision.

#### BUG-005 — A persisted decision was not bound on read to the open snapshot

**Priority:** Must-Fix
**Resolution:** Resolved in the RG-01 audit change set.
**Files:** `backend/src/store.ts`, `backend/src/app.ts`, `backend/tests/release-audit.test.ts`

Although decision creation used the current snapshot's finalist list, a
corrupted or stale `lgsV4FinalDecisions/{user}` document could later be read
without confirming its `snapshotId` or choice still matched the open reveal.
Repository reads and repeat-write conflict checks now validate both facts. Any
inconsistency fails closed through a non-revealing 503 route response.

### Evidence

- Focused audit suite: `npm test -- --run backend/tests/release-audit.test.ts backend/tests/store.test.ts backend/tests/final-decision.test.ts backend/tests/results/social-ballot.test.ts` — **33 tests passed**.
- `npm run typecheck` — passed.
- `git diff --check` — passed.

The audit confirms that malformed v2 tallies, stale final decisions, and valid
v1 final-decision attempts fail safely. The preflight/reset guard, Firestore
emulator persistence proof, browser rehearsal, and individual-model promotion
remain separate unfinished release gates; this audit does not authorize a
deployment.
