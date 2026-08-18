# One-trip implementation code review

**Review scope:** uncommitted one-trip implementation against `docs/one-trip-implementation-spec.md`, `docs/one-trip-tasks.md`, and the destination-blind boundary.  
**Reviewed:** 2026-08-18  
**Original verdict:** **Not release-ready.** The findings below were the must-fix correctness and authentication issues found in this review. They were resolved and regression-tested in the same change set on 2026-08-18. The separately documented advanced-model promotion failure and unrun emulator rehearsal remain release gates.

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

**Code-review findings resolved; release remains blocked.** Run the emulator and five-identity rehearsal gates required by OT-21 through OT-26. The documented model-evaluation report is independently **FAIL — DO NOT PROMOTE**; it remains a hard release gate because the required advanced ranking has not yet cleared its synthetic evidence threshold.
