# One-trip implementation task board

**Source:** [one-trip implementation specification](one-trip-implementation-spec.md) and [one-trip roadmap](roadmap.md).  
**Release condition:** Every task in this board is required before the one real five-person run. This is not a feature backlog; no task may be silently moved to a later product version.

## Delivery conventions

- **Branches:** One task per branch, named `one-trip/<task-id>-<short-name>`. Merge only after the listed checks pass. A task may add incomplete code behind an internal, server-owned capability boundary, but must not change production selection/results until `OT-19` passes the promotion gate.
- **Ownership seams:** `shared/src/index.ts`, `backend/src/store.ts`, `backend/src/app.ts`, and `frontend/src/main.tsx` each have one designated task owner in a wave. Other tasks add new modules/components or tests around those seams; they do not edit the owner file concurrently.
- **Public-data boundary:** Comparison DTOs remain `id`, `title`, `description`, and opaque `/media/cards/*.webp` paths only. Tests in every relevant task must prove that destination and inference details do not cross the blind-play boundary.
- **Documentation truth:** Documentation updates describe work as shipped only in the task that verifies it. Until then, `docs/one-trip-implementation-spec.md` remains the approved target, not an implementation claim.

## Task summary

| Area | Tasks | Primary delivery owner |
| --- | ---: | --- |
| Design and frontend journey | 6 | Frontend/design stream |
| Shared contracts, persistence, and APIs | 8 | Backend/platform stream |
| Inference and promotion | 6 | Model stream |
| Rehearsal, QA, and release | 6 | Quality/release stream |
| **Total** | **26** | Three coordinated streams |

## Tasks in dependency order

### OT-01 — Design the completed-traveler and post-reveal journey

- **Type:** Design
- **Complexity:** Medium
- **Scope/files:** `docs/one-trip-ux-handoff.md` (new); reference `docs/one-trip-implementation-spec.md`, `docs/ux.md`, `docs/design-system.md`, `design-system/`.
- **Dependencies:** None.
- **Can run in parallel with:** OT-02, OT-03, OT-04.
- **Description:** Produce the implementation-ready layout and interaction handoff for profile, waiting lobby, personal-results panel, explanatory verdict additions, and final-decision confirmation. Define desktop/mobile hierarchy, semantic control names, loading/error/423 states, map fallback route, focus order, reduced-motion equivalents, and the no-result-leakage boundary. The handoff must preserve the existing character art and verdict visual language rather than introduce a platform dashboard.
- **Acceptance/test/doc requirements:** Contains component inventory, states, copy, 20px desktop text/44px target requirements, and exact purpose of each `aria-live` region. It explicitly makes the profile screen precede first atlas entry and keeps all result UI post-gate. The handoff is reviewed before OT-11/OT-12 begin.
- **Branch strategy:** Documentation-only branch; it becomes the frontend implementation contract.

### OT-02 — Define one-trip runtime schemas and safe DTOs

- **Type:** Implementation + Testing
- **Complexity:** High
- **Scope/files:** `shared/src/index.ts`, `shared/src/one-trip.ts` (new, if preferred), `shared/package.json`; shared schema tests (new).
- **Dependencies:** None.
- **Can run in parallel with:** OT-01, OT-03, OT-04.
- **Description:** Add Zod schemas and inferred public types for roster users, progress/completion, profile, group status, personal/group result responses, confidence, snapshots, finalist ranks, final decisions, and typed API errors. Keep public comparison schemas narrowly destination-blind; create serializers/guards that make accidental field spread testable.
- **Acceptance/test/doc requirements:** Invalid payloads fail at runtime; `finalDecisionSchema` accepts a non-empty ID or `need-more-research` only; exported comparison type cannot contain destination/credit/model fields. Add positive/negative schema tests and a redaction regression test. Update `docs/architecture.md` only to identify the new shared boundary, without calling any UI shipped.
- **Branch strategy:** Own `shared/src/index.ts` for its wave. Keep additions backward compatible with current deployed DTOs until OT-20 switches routes.

### OT-03 — Add canonical seed and raw-input identity utilities

- **Type:** Implementation + Testing
- **Complexity:** Medium
- **Scope/files:** `backend/src/model/snapshot.ts` (new), `backend/src/model/config.ts` (new), `backend/tests/snapshot.test.ts` (new), `seed/{destinations,activities,activity-media}.json` read path only.
- **Dependencies:** None.
- **Can run in parallel with:** OT-01, OT-02, OT-04.
- **Description:** Implement stable-key canonical JSON hashing, `seedVersion`, ordered comparison `inputDigest`, and version constants. Validate that all three canonical seed files participate in the digest and that comparison metadata order affects the input digest predictably.
- **Acceptance/test/doc requirements:** Digest is stable across object key order, changes for any source content/input-order change, and has no dependency on timestamps other than the stored ordered comparison sequence. Add deterministic tests. Record configuration/version naming in source comments; ADR is completed in OT-19.
- **Branch strategy:** New model module only; do not edit store/app files.

### OT-04 — Establish deterministic simulation fixtures and evaluation rubric

- **Type:** Design + Testing
- **Complexity:** High
- **Scope/files:** `backend/tests/model/fixtures.ts` (new), `backend/tests/model/evaluation-rubric.test.ts` (new), `docs/model-evaluation.md` (new, initial rubric only).
- **Dependencies:** None.
- **Can run in parallel with:** OT-01, OT-02, OT-03.
- **Description:** Encode the fixed synthetic-ground-truth fixture definitions, metrics, seed schedule, and promotion thresholds from specification §5.7 before model implementation. Include clear preference, vivid residual, fifth/sixth boundary, indifference, consensus, polarizing group, and noisy/replay cases.
- **Acceptance/test/doc requirements:** Fixtures are deterministic, represent at least 200 seeds per scenario when used by the evaluator, and the report template names every required metric/threshold. Tests make fixture generation reproducible. The document must say results are pending, not passed.
- **Branch strategy:** New test/docs files only; no ranking integration.

### OT-05 — Add versioned stored-comparison and pending-pair persistence types

- **Type:** Implementation + Testing
- **Complexity:** Medium
- **Scope/files:** `backend/src/store.ts`, `backend/tests/store.test.ts` (new or expanded), `shared/src/*` only through OT-02 exports.
- **Dependencies:** OT-02, OT-03.
- **Can run in parallel with:** OT-06, OT-07, OT-08.
- **Description:** Introduce legacy-compatible readers for `StoredComparison`, `PendingComparison`, revision, and completion metadata. Preserve legacy array order by synthesizing ordinal/legacy timestamp strictly for replay. Add controlled seed-version state inspection without applying reset behavior yet.
- **Acceptance/test/doc requirements:** Legacy records read successfully; new normalized records validate; ordered metadata is server-owned; completed choices are not rewritten. Tests cover conversion and invalid persisted data. Update Firestore layout documentation only once merged.
- **Branch strategy:** Own `backend/src/store.ts` until OT-07 completes; avoid `app.ts` changes.

### OT-06 — Implement transactional pending-claim comparison append

- **Type:** Implementation + Testing
- **Complexity:** High
- **Scope/files:** `backend/src/store.ts`, local/test adapter files, `backend/tests/store.test.ts`, Firestore repository tests (new).
- **Dependencies:** OT-05.
- **Can run in parallel with:** OT-07, OT-08.
- **Description:** Replace split pending consumption/append behavior with `claimPendingAndAppendComparison(user, body)` in a Firestore transaction and behaviorally equivalent local/test adapter. Require current unexpired issued pair, matching revision, offered activity IDs, and unfinished user; atomically append one server-stamped record, clear pending, increment revision, and update timestamp.
- **Acceptance/test/doc requirements:** Duplicate, stale, modified, unoffered, expired, and post-completion attempts return typed conflict without mutation; two concurrent requests yield exactly one accepted append. Unit tests must exercise the local adapter race and Firestore transaction behavior where available. Document new revision semantics in architecture after test completion.
- **Branch strategy:** Retain sole ownership of `store.ts`; OT-20 later adapts HTTP status mapping in `app.ts`.

### OT-07 — Implement immutable reveal snapshots and final-decision repository

- **Type:** Implementation + Testing
- **Complexity:** High
- **Scope/files:** `backend/src/store.ts`, `backend/src/model/snapshot.ts`, `backend/tests/store.test.ts`, repository tests.
- **Dependencies:** OT-05, OT-03.
- **Can run in parallel with:** OT-06, OT-08.
- **Description:** Add Firestore transaction-backed reveal snapshot creation/read and immutable `lgsV4FinalDecisions` create/read operations. Snapshot creation must return the same snapshot when already open; final decision creation must require absence and return existing decision on repeat. Persist only model summary data specified by the contract, never raw covariance.
- **Acceptance/test/doc requirements:** Reopen/restart never recalculates/reorders a visible snapshot; decision repetition is 409-with-existing-state; no decision persists before snapshot. Tests prove document paths, immutability, and restart reads. Add a short architecture note after tests pass.
- **Branch strategy:** Coordinate with OT-06 as sequential commits on the `store.ts` owner branch; do not edit route handlers.

### OT-08 — Add Firebase Emulator Suite and isolated test configuration

- **Type:** Infrastructure + Testing
- **Complexity:** Medium
- **Scope/files:** `firebase.json`, `package.json`, `.env.example`, test setup/config files (new), `docs/deployment.md`.
- **Dependencies:** OT-02.
- **Can run in parallel with:** OT-05, OT-06, OT-07.
- **Description:** Configure isolated Firestore/Auth Emulator Suite commands and a positive explicit test-environment flag. Ensure test/demo identity behavior is never selected by `NODE_ENV` alone and production `K_SERVICE` always rejects `X-Demo-User`.
- **Acceptance/test/doc requirements:** Emulator command uses no production credentials/project data; local API can target emulators deterministically; production configuration rejects demo header. Add a smoke test for config selection and document setup/teardown. Full emulator cases are implemented in OT-23.
- **Branch strategy:** Infrastructure-only files; do not alter app/store code beyond test configuration injection points.

### OT-09 — Build numerical primitives, features, and deterministic fitting core

- **Type:** Implementation + Testing
- **Complexity:** High
- **Scope/files:** `backend/src/model/{config,features,linear-algebra,prng,fit,posterior}.ts` (new), `backend/tests/model/{linear-algebra,features,fit,posterior}.test.ts` (new).
- **Dependencies:** OT-03, OT-04.
- **Can run in parallel with:** OT-05 through OT-08, OT-10.
- **Description:** Implement centered/scaled eight-attribute design matrix; fixed parameter order; deterministic PRNG/normal sampler; Cholesky solve; damped Newton/IRLS MAP fit; covariance/draw helpers; diagnostics and typed non-convergence/covariance failure. Use specified priors/config as provisional values only.
- **Acceptance/test/doc requirements:** Repeated identical inputs produce byte-for-byte equivalent summaries/draw seeds; matrix/Cholesky operations have known-answer tests; fit recovers direction on synthetic fixtures; singular/covariance failure follows documented safe failure. No framework or public-route imports.
- **Branch strategy:** Model-only modules. This stream owns the files under `backend/src/model/` until OT-19; other model tasks add separate modules after coordination.

### OT-10 — Build aggregation, safe profile copy, and explanation primitives

- **Type:** Implementation + Testing
- **Complexity:** High
- **Scope/files:** `backend/src/model/{aggregate,profile}.ts` (new), `backend/tests/model/{aggregate,profile}.test.ts` (new), controlled copy constants.
- **Dependencies:** OT-02, OT-04, OT-09.
- **Can run in parallel with:** OT-06 through OT-08, OT-11.
- **Description:** Convert posterior activity utilities into equal-weighted destination draws, normalized group draws with polarization penalty, intervals, qualitative confidence/fit/consensus labels, destination-free profile dimensions, and safe explanation data. Implement controlled attribute/theme copy and the specified uncertainty exclusions.
- **Acceptance/test/doc requirements:** Groups use independent deterministic user sub-seeds, zero-range behavior is warned, lexical ties are stable, no raw parameter values enter public builders, and profile is destination-free. Tests cover all label thresholds, explanation counts/theme omissions, polarized fixture, and accessible fallback profile copy.
- **Branch strategy:** New model modules only; route DTO construction remains OT-20.

### OT-11 — Implement information-gain selection and bounded stopping

- **Type:** Implementation + Testing
- **Complexity:** High
- **Scope/files:** `backend/src/model/{selection,stopping,baseline}.ts` (new), `backend/tests/model/{selection,stopping,baseline}.test.ts` (new).
- **Dependencies:** OT-04, OT-09, OT-10.
- **Can run in parallel with:** OT-12, OT-13, OT-14.
- **Description:** Freeze existing ranking as `elo-coverage-v1` baseline for replay only. Implement eligible-pair exclusions, coverage safety, deterministic normalized information-gain scoring, fatigue/diversity rules, lexical tie break, progress phases, posterior-based confidence-aware 24–40 stopping, and typed `portfolio-exhausted` result.
- **Acceptance/test/doc requirements:** Tests prove pair uniqueness/same-destination/exposure rules, coverage obligation, selector determinism, no public selection rationale, 24 minimum/40 maximum, stable boundary completion, and close-call maximum fallback. Baseline has no production selector export path.
- **Branch strategy:** Model-only files; production routing is deferred to OT-20.

### OT-12 — Implement profile, group-status, and personal-results APIs

- **Type:** Implementation + Testing
- **Complexity:** High
- **Scope/files:** `backend/src/app.ts`, route/DTO helper modules (new), `backend/tests/api.test.ts`, new route tests.
- **Dependencies:** OT-02, OT-05, OT-10.
- **Can run in parallel with:** OT-11, OT-13, OT-14.
- **Description:** Replace raw profile response; extend group status; implement safe personal results gated by completion and reveal. Use current analysis adapter only until OT-20 promotion, but route DTOs must already use exact shared contracts and failure statuses. Result builders must be intentional maps, not object spreads.
- **Acceptance/test/doc requirements:** Profile returns 403/409 appropriately and never destination/activity evidence; status only has roster completion booleans/rounded update time; `/results/me` returns caller-only data after gate and maps 423 to a predictable contract. Regression tests enumerate forbidden fields on every blind response and forbidden raw choices in post-gate personal response.
- **Branch strategy:** Own `backend/src/app.ts` for this wave. OT-15/OT-20 layer later route changes sequentially.

### OT-13 — Design-token-aligned frontend state/component scaffold

- **Type:** Implementation
- **Complexity:** Medium
- **Scope/files:** `frontend/src/{api.ts,types.ts,components/*,screens/*}` (new), `frontend/src/main.tsx` only as an approved import seam, `frontend/src/app.css` only component class scaffolding.
- **Dependencies:** OT-01, OT-02.
- **Can run in parallel with:** OT-11, OT-12, OT-14.
- **Description:** Extract a small app shell/API client and semantic screen components without changing current production flow. Define focused components for profile, waiting, results, verdict additions, decision dialog, loading/error, and stable session bootstrap. Map API 409/423 states centrally; never calculate ranks/results client-side.
- **Acceptance/test/doc requirements:** Existing welcome/character/comparison/atlas/verdict behavior remains buildable; public client types are imported from shared; semantic screen controls have stable names/test IDs only where required. Add component-level unit tests for route-state/error mapping. The implementation follows OT-01 handoff.
- **Branch strategy:** The frontend stream owns new component files. Avoid broad `main.tsx` rewrite until OT-18.

### OT-14 — Build profile and waiting-lobby frontend screens

- **Type:** Implementation + Testing
- **Complexity:** High
- **Scope/files:** `frontend/src/screens/{ProfileScreen,WaitingScreen}.tsx` (new), scoped styles, frontend tests (new).
- **Dependencies:** OT-01, OT-12, OT-13.
- **Can run in parallel with:** OT-11, OT-15, OT-16.
- **Description:** Implement profile-before-atlas and five-traveler waiting UI exactly to the handoff. Add focus-aware 20-second polling with deterministic jitter; explicit refresh; transition-only completion toast; Dan/non-Dan reveal messaging; copy-to-clipboard nudge; atlas return path; reduced-motion behavior.
- **Acceptance/test/doc requirements:** Profile uses 3–5 categorical tiles, controlled profile copy, polite completion announcement, and 20px/44px requirements. Lobby exposes completion only, stops polling when hidden/unmounted/reveal opens, never toasts on initial load, and leaves atlas explicitly unranked. Tests use mocked contracts/timers/visibility/focus.
- **Branch strategy:** New screens/styles only. Do not integrate into `main.tsx` until OT-18.

### OT-15 — Extend group verdict API and add immutable final-decision APIs

- **Type:** Implementation + Testing
- **Complexity:** High
- **Scope/files:** `backend/src/app.ts`, route/DTO helper modules, `backend/tests/api.test.ts`, `backend/tests/final-decision.test.ts` (new).
- **Dependencies:** OT-02, OT-07, OT-10, OT-12.
- **Can run in parallel with:** OT-14, OT-16.
- **Description:** Extend group results from immutable snapshot only with five finalists, confidence, controlled insights, top-three, group-finalist rank matrix, and existing decisions. Add authenticated `GET/POST /v1/final-decision`, with membership validation against snapshot and repeat-as-confirmation behavior.
- **Acceptance/test/doc requirements:** All five result rows are stable from snapshot; only post-reveal finalist rank/top-three/decision data is exposed; decision ID validation and immutable 409 payload tested; no raw comparison history/covariance leaks. Add 423/error tests and update API documentation after validation.
- **Branch strategy:** Sequential follow-on to OT-12 on the `app.ts` owner branch.

### OT-16 — Build verdict explanation, personal-results, and final-decision UI

- **Type:** Implementation + Testing
- **Complexity:** High
- **Scope/files:** `frontend/src/screens/{VerdictScreen,MyResultsScreen}.tsx`, `frontend/src/components/{FinalistMatrix,FinalistDrawer,FinalDecisionDialog}.tsx` (new), scoped styles, frontend tests.
- **Dependencies:** OT-01, OT-13, OT-15.
- **Can run in parallel with:** OT-14, OT-17.
- **Description:** Add post-gate “My take,” sequential-or-static results, qualitative why-it-rose copy, confidence key, crew-read matrix, consensus drawer/context key, and immutable decision interaction. Preserve cutout art and cinematic verdict; avoid dashboard language and numerical certainty.
- **Acceptance/test/doc requirements:** Results cannot render before gate; reduced motion renders ordered content without auto progression; matrix only displays #1–#5/6+; travel effort has required neutral key; decision requires confirmation, locks after success/409/reload, and displays post-reveal roster decision summary. Tests cover keyboard, focus, state retention, copy, and no raw-choice display.
- **Branch strategy:** New screen/components/styles only; integration in OT-18.

### OT-17 — Add frontend fallbacks and visual accessibility coverage

- **Type:** Testing + Implementation
- **Complexity:** Medium
- **Scope/files:** frontend fallback components/styles, `frontend/src/AtlasMap.tsx`, frontend tests, visual-QA fixtures.
- **Dependencies:** OT-01, OT-13.
- **Can run in parallel with:** OT-14, OT-16.
- **Description:** Harden map/tile/WebGL, image, loading, retry, and 423 results-to-waiting fallbacks in the component architecture. Add testable `prefers-reduced-motion`, keyboard/focus, desktop font-floor, and mobile target-size checks to the existing visual QA workflow.
- **Acceptance/test/doc requirements:** Map failure leaves named gallery/list usable with attribution/fallback explanation; image failure has non-jarring fallback; direct pre-reveal result attempt routes to waiting; no blind card shows credit/character art. Capture initial desktop/mobile evidence for later OT-24 review.
- **Branch strategy:** Avoid `main.tsx` integration; coordinate any `AtlasMap.tsx` change with frontend stream owner.

### OT-18 — Integrate the human journey into a stable session bootstrap

- **Type:** Implementation + Testing
- **Complexity:** High
- **Scope/files:** `frontend/src/main.tsx`, `frontend/src/app.css`, app-shell/API client integration tests.
- **Dependencies:** OT-12, OT-14, OT-15, OT-16, OT-17.
- **Can run in parallel with:** OT-11, OT-19 preparation only.
- **Description:** Make one app-state/router seam choose welcome/character/comparison/profile/atlas/waiting/verdict/my-results/decision state after refresh using server session/status—not transient component memory. Wire API errors into intentional states and preserve current blind comparison experience.
- **Acceptance/test/doc requirements:** A completed traveler follows profile → atlas/waiting; post-gate result returns to stable personal/group views; no direct URL/state bypass exposes sealed data; auth mismatch/resume behavior remains intact. Add integration tests for all state transitions and build/typecheck. Implement only after design/child components have passed review.
- **Branch strategy:** Sole owner of `frontend/src/main.tsx` and broad shared CSS integration; merge after all frontend component branches.

### OT-19 — Run model simulations, select configuration, and record promotion ADR

- **Type:** Testing + Documentation
- **Complexity:** High
- **Scope/files:** `backend/tests/model/evaluation.test.ts` (new), `scripts/evaluate-model.ts` (new), `docs/model-evaluation.md`, `docs/adr/0003-one-trip-ranking-model.md` (new), model config.
- **Dependencies:** OT-03, OT-04, OT-09, OT-10, OT-11.
- **Can run in parallel with:** OT-18.
- **Description:** Run fixed 200-seed fixtures at the required budgets, compare frozen baseline and advanced model, tune only against fixtures, and record configuration, thresholds, hashes, exact command, and every promotion metric. Fail closed if any promotion threshold misses.
- **Acceptance/test/doc requirements:** Repeated evaluator runs are deterministic; evaluation report records all seven required outcomes; ADR includes selected hyperparameters/thresholds/model and selector versions; the task produces a machine-verifiable pass/fail artifact. No real roster data is used.
- **Branch strategy:** Own model configuration/version changes; production routing remains unchanged until pass is reviewed.

### OT-20 — Promote the advanced model across selection, completion, and snapshots

- **Type:** Implementation + Testing
- **Complexity:** High
- **Scope/files:** `backend/src/{app.ts,ranking.ts}`, `backend/src/model/*`, `backend/src/store.ts` integration points, API/ranking/integration tests.
- **Dependencies:** OT-06, OT-07, OT-11, OT-12, OT-15, OT-19.
- **Can run in parallel with:** OT-21, OT-22.
- **Description:** After OT-19’s documented pass, atomically replace production analysis/selector/stopping/result paths with `bt-hierarchical-laplace-v1`. Persist selector/model/seed/input versions, progress phase, completion reason/confidence, and immutable summaries in snapshots. Keep the old engine accessible solely via the baseline test import.
- **Acceptance/test/doc requirements:** Production cannot select baseline via config; every route uses safe DTO builders backed by advanced analysis; model fit failure is generic retryable 503; no stale result follows accepted answer; no raw covariance persisted/public. Test legacy migration, version fields, full comparison-to-snapshot lifecycle, and production-baseline exclusion.
- **Branch strategy:** Sequential integration task with a designated backend integrator; it is the only task permitted to edit ranking/app/store model wiring together.

### OT-21 — Complete Firestore emulator transaction and release-gate tests

- **Type:** Testing
- **Complexity:** High
- **Scope/files:** emulator test suite/new test helpers, `backend/tests/*`, package scripts, test documentation.
- **Dependencies:** OT-08, OT-20.
- **Can run in parallel with:** OT-22, OT-23.
- **Description:** Implement the ten required emulator scenarios: identity mapping, restart persistence, atomic/race append, stale guards, pending expiry, completion gates, Dan/all-five reveal, snapshot stability, immutable final decision, and advanced-model/no-baseline assurance.
- **Acceptance/test/doc requirements:** Test suite uses only emulator resources, creates isolated state per run, demonstrates exact 409/423 response behavior, and retains no production project connection. Capture a concise command/result in the runbook draft.
- **Branch strategy:** Test-only except isolated scripts/config; coordinate package-script changes with OT-08 owner.

### OT-22 — Build five-identity authenticated browser rehearsal suite

- **Type:** Testing
- **Complexity:** High
- **Scope/files:** E2E test directory/config (new), frontend test-auth configuration, package scripts, screenshot output ignored by git, browser harness/visual QA instructions.
- **Dependencies:** OT-08, OT-18, OT-20.
- **Can run in parallel with:** OT-21, OT-23.
- **Description:** Use Firebase Auth Emulator aliases in five isolated contexts to exercise roster selection/mismatch, mid-round refresh, bounded dynamic stop, profile/atlas/map fallback, waiting/reveal roles, immutable snapshot/results/decision, and keyboard/reduced-motion/mobile/redaction journeys.
- **Acceptance/test/doc requirements:** No real Google OAuth/roster account is used; test-only emulator configuration cannot activate in a production build; critical routes have desktop and mobile screenshots; semantic selectors are preferred. Record rehearsal result and discovered accessibility fixes.
- **Branch strategy:** New E2E/config files; changes to app test setup are reviewed with frontend integrator.

### OT-23 — Add automated seed, media, redaction, and map synchronization checks

- **Type:** Testing
- **Complexity:** Medium
- **Scope/files:** `scripts/validate-seed.ts`, shared/backend tests, frontend map tests, media validation utilities (new).
- **Dependencies:** OT-02, OT-17, OT-20.
- **Can run in parallel with:** OT-21, OT-22.
- **Description:** Extend validation for 24 destinations/three galleries/coordinates/credits/alts and 120 locally imaged activities. Assert documented serializers on comparison/atlas/reveal endpoints and map marker/list/filmstrip selection/resize/fallback behavior.
- **Acceptance/test/doc requirements:** Fails for every prohibited comparison field, invalid media path/credit/alt/count, unrendered marker, and desynchronized UI state. Includes explicit test that comparison cards cannot render traveler art/credits. Integrate into standard validation command.
- **Branch strategy:** Test/validation files only; do not refactor production UI beyond test hooks approved by OT-18 owner.

### OT-24 — Write and rehearse the one-trip operator runbook

- **Type:** Documentation + Operations
- **Complexity:** Medium
- **Scope/files:** `docs/one-trip-runbook.md` (new), `docs/deployment.md`, `docs/implementation-status.md`.
- **Dependencies:** OT-08, OT-20, OT-21, OT-22, OT-23.
- **Can run in parallel with:** OT-25.
- **Description:** Write the Dan-oriented, infrastructure-light procedures: production count-only preflight digest/roster/auth/deploy check; emulator rehearsal; behavioral smoke in a separately provisioned disposable Firebase/GCP environment; access-controlled Firestore export; reset only before start; recovery; and one-time reveal verification. Production reset is not smoke cleanup because it refuses any started journey. Record evidence without committing user data.
- **Acceptance/test/doc requirements:** Includes exactly the operations in spec §6.4; no credentials/data are documented; explicitly forbids live-run reset; test command/output locations and expected snapshot verification are clear. Status docs mark only evidenced work complete.
- **Branch strategy:** Docs-only except recorded operational command validation; never manipulate a real run while authoring.

### OT-25 — Execute visual, accessibility, and manual five-person rehearsal gate

- **Type:** Quality Gate
- **Complexity:** High
- **Scope/files:** `docs/review.md`, `docs/implementation-status.md`, visual screenshot artifacts outside git or linked secure location.
- **Dependencies:** OT-18, OT-20, OT-21, OT-22, OT-23, OT-24.
- **Can run in parallel with:** OT-26 preparation.
- **Description:** Run seed validation, unit/integration/emulator/E2E tests, typecheck, production build, visual QA/browser-harness inspection, and manual five-identity rehearsal. Verify all ten final acceptance statements rather than relying on test count alone.
- **Acceptance/test/doc requirements:** Evidence covers comparison redaction, profile/waiting/result gates, snapshot immutability, model promotion, visibility/focus/reduced motion/mobile/map/image fallback, decision lock, export/reset rehearsal, and no platform features. Any failure returns to its owning task; no release approval is recorded until resolved.
- **Branch strategy:** No feature changes except narrowly documented QA fixes submitted as follow-up tasks; review report is an auditable release checklist.

### OT-26 — Perform final code review, release, and production smoke test

- **Type:** Code Review + Deployment
- **Complexity:** Medium
- **Scope/files:** final PR/commit series, `CHANGELOG.md`, `README.md`, `docs/{implementation-status,deployment,review}.md`, Cloud Run/Firebase deployment configuration as needed.
- **Dependencies:** OT-24, OT-25.
- **Can run in parallel with:** None.
- **Description:** Conduct independent code review of boundary, transaction, model, and client changes; resolve findings; run the full quality command sequence; deploy Cloud Run then Firebase Hosting; execute a reset-state approved-account smoke test; export/re-reset the preflight state; and publish the final docs status.
- **Acceptance/test/doc requirements:** Review confirms no credentials/debug artifacts, no baseline production path, correct Firestore rules/API-only access, and no out-of-scope platform capability. Deployment smoke proves health, auth, one blind comparison, resume, and reset guard. Final documentation distinguishes “ready for real run” from any later operational action and includes commit/deploy identifiers.
- **Branch strategy:** Release manager only. No unrelated changes after OT-25 approval; rollback uses the documented previous deploy, not a destructive repository reset.

## Parallel execution waves (three-agent-safe)

| Wave | Backend/platform stream | Model stream | Frontend/design stream | Merge gate |
| --- | --- | --- | --- | --- |
| 0 — Contracts and design | OT-02 | OT-03 + OT-04 | OT-01 | Shared schemas and design handoff approved |
| 1 — Durable foundations | OT-05 → OT-06 → OT-07; OT-08 | OT-09 → OT-10 | OT-13 | No concurrent owner-file edits; store changes serial |
| 2 — Feature modules | OT-12 → OT-15 | OT-11 | OT-14 → OT-16 → OT-17 | Route contracts, components, and model unit tests pass |
| 3 — Integration and promotion | OT-20 preparation/review | OT-19 | OT-18 | Simulation gate passes before advanced model promotion |
| 4 — Promotion and proof | OT-20 | OT-21 | OT-22 + OT-23 | Advanced model is sole production path; emulator/E2E are green |
| 5 — Rehearsal and release | support OT-24/OT-25 | support OT-25 | support OT-25 | Runbook rehearsal and final acceptance evidence complete |
| 6 — Ship | OT-26 | review support | review support | Independent review, deploy, smoke/reset completed |

## Critical path

`OT-02 → OT-05 → OT-06/OT-07 → OT-12 → OT-15 → OT-18 → OT-25 → OT-26`

The model path is an equally hard release gate:

`OT-03 + OT-04 → OT-09 → OT-10 → OT-11 → OT-19 → OT-20 → OT-21/OT-22/OT-23 → OT-25 → OT-26`

No user-flow task permits a real run while the model path is incomplete. The current deterministic implementation may support development only until OT-20 is promoted after OT-19’s simulation evidence.
