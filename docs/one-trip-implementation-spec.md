# One-trip implementation specification

**Status:** Approved implementation plan  
**Scope:** All remaining work in Sprints 1–3 of [the one-trip roadmap](roadmap.md).  
**Release bar:** This is the required implementation for the one real five-person trip decision. It is not a pilot, product platform, or V2 staging plan.

## 1. Outcome and non-negotiable boundaries

Let’s Go Somewhere must take each fixed-roster traveler from their last blind comparison through a credible individual recognition beat, an unranked atlas and social waiting state, a group verdict, and one final, recorded group decision. Before the real run, the existing deterministic Elo/coverage implementation must be replaced as the production default with a regularized hierarchical Bradley–Terry model, calibrated uncertainty, information-gain pair selection, and confidence-aware bounded stopping.

The current product boundary remains in force:

- During comparisons, return only an activity ID, title, description, and opaque local image path. Destination names, countries, flags, coordinates, maps, ranks, scores, source credits, and destination IDs must never cross that API boundary.
- Activity photography is an accepted soft cue. It must match the activity and have no visible credit or location metadata until the completion-gated atlas.
- After a traveler completes, they may view the named but unranked atlas. Their own result, all other travelers’ outcomes, and all group outcomes remain sealed until every roster member completes and Dan opens the reveal.
- The group reveal exposes group top five and each person’s top three only. It never exposes activity-by-activity choices or comparison history.
- The final decision is a post-reveal social input. It never changes blind choices, the model, or the group ranking.
- The fixed roster is `dan`, `james`, `john`, `matt`, and `peter`. There are no invitations, groups, organizer console, content editor, practical-score engine, live logistics integration, or multi-trip support.

## 2. Delivery order

Implement in this order; no task is complete merely because its API returns data.

1. Harden persistence and shared contracts needed by every later task.
2. Implement the Sprint 1 API/UI journey using the current deterministic model only as a temporary development backend.
3. Implement and evaluate the Sprint 2 model. Switch every selection/result path to it only after the evaluation gate passes.
4. Add emulator and authenticated browser rehearsal coverage, then perform the manual one-trip rehearsal and write the operator runbook.

The release gate is all Sprint 1 and Sprint 2 acceptance criteria plus Sprint 3 rehearsal evidence. There is no partial release for the real trip.

## 3. Shared contract and persistence foundation

### 3.1 Required shared schemas

Add runtime Zod schemas and inferred TypeScript types in `shared/src/`. Keep API response builders in the backend; the frontend may only consume the safe public types.

```ts
type RosterUser = 'dan' | 'james' | 'john' | 'matt' | 'peter';

type Progress = {
  comparisons: number;
  minimum: 24;
  maximum: 40;
  estimatedCompletion: number; // UI-only lower-bound progress; never a confidence claim
  phase: 'explore' | 'discriminate' | 'checking-boundary';
};

type CompletionState = {
  complete: boolean;
  reason?: 'stable-top-five' | 'maximum-reached' | 'portfolio-exhausted';
  confidenceLabel?: 'clear-shape' | 'close-call';
};

type ProfileDimension = {
  key: AttributeKey;
  label: string;
  strength: 'strong' | 'present' | 'open';
  direction: 'drawn-to' | 'less-drawn-to';
};

type PreferenceProfile = {
  headline: string;
  synthesis: string;
  dimensions: ProfileDimension[]; // 3–5 only; destination-free
  confidenceLabel: 'clear-shape' | 'still-emerging';
};

type GroupStatus = {
  revealOpen: boolean;
  allComplete: boolean;
  members: Array<{ user: RosterUser; complete: boolean }>;
  updatedAt: string;
};

type ResultConfidence = {
  label: 'clear-favorite' | 'close-call';
  summary: string; // human language only; no posterior values
};

type PersonalResult = {
  rank: number;
  id: string;
  name: string;
  country: string;
  imageUrl: string;
  fitLabel: 'strong-match' | 'contender' | 'close-call';
  interval: { low: number; high: number }; // model scale, not a percentage
  explanation: {
    themes: string[]; // 2–4 labels derived from attributes
    matchedActivityCount: number;
    encounteredActivityCount: number;
  };
  context: { novemberWeather: string; travelFriction: number };
};

type GroupFinalist = {
  rank: number;
  id: string;
  name: string;
  country: string;
  imageUrl: string;
  groupScore: number; // presentation scale, never described as probability
  interval: { low: number; high: number };
  consensus: 'broad-consensus' | 'mixed' | 'polarized';
  context: { novemberWeather: string; travelFriction: number };
};

type FinalistRank = { user: RosterUser; rank: number | '6+' };

type FinalDecisionChoice = string | 'need-more-research';
type FinalDecision = {
  user: RosterUser;
  choice: FinalDecisionChoice;
  createdAt: string;
};
```

`PersonalResult.interval` and `GroupFinalist.interval` are needed by rendering and tests, but the UI must not label them "probability", "percent chance", or a precision claim. API contracts may instead omit interval values from compact list responses and provide only confidence labels; do not invent a second client-side calculation.

### 3.2 Firestore layout

Keep raw choices as the source of truth. Cached models and result snapshots are disposable and must always be derivable from the same seed version and raw choices.

```text
lgsV4Users/{rosterUser}
  comparisons: StoredComparison[]
  pending: PendingComparison | null
  revision: number
  completedAt?: ISO-8601
  updatedAt: ISO-8601

lgsV4State/reveal
  open: boolean
  openedAt?: ISO-8601
  snapshotId?: string

lgsV4ResultSnapshots/{snapshotId}
  schemaVersion: 1
  modelVersion: 'bt-hierarchical-laplace-v1'
  seedVersion: SHA-256 seed digest
  inputDigest: SHA-256 canonical ordered comparisons digest
  createdAt: ISO-8601
  users: Record<RosterUser, PersistedUserModelSummary + immutable personal top-five presentation summary>
  group: PersistedGroupModelSummary

lgsV4FinalDecisions/{rosterUser}
  choice: destinationId | 'need-more-research'
  snapshotId: string
  createdAt: ISO-8601
```

`StoredComparison` extends the current validated comparison with server-generated metadata only:

```ts
type StoredComparison = Comparison & {
  ordinal: number;       // 1-based, append-only order
  createdAt: string;     // generated server-side
  selectorVersion: string;
};

type PendingComparison = {
  activityA: string;
  activityB: string;
  issuedAt: string;
  revision: number;
  selectorVersion: string;
};
```

Do not trust client timestamps, model versions, progress, or a final-decision user identity. Firestore is browser-denied; only the Cloud Run API accesses it.

### 3.3 Migration and atomicity

1. Introduce readers that accept legacy comparisons without metadata. Their persisted order is their array order; synthesize `ordinal` and an `unknown-legacy` timestamp for replay only.
2. On the next successful append for a user, write the canonical `StoredComparison[]`, `revision`, and `updatedAt` in one transaction. Do not rewrite a completed user’s raw choices outside the controlled reset procedure.
3. Replace the current `takePending()` then `addComparison()` sequence with a single `claimPendingAndAppendComparison(user, body)` Firestore transaction. It must:
   - read the user document;
   - require a non-expired pending pair with both submitted activity IDs, the same `revision`, and no existing completion;
   - append exactly one server-stamped comparison;
   - clear `pending`, increment `revision`, and set `updatedAt` atomically;
   - return 409 for duplicate, stale, unoffered, or post-completion submissions.
4. For a local/test adapter, reproduce the same revision and single-claim behavior; never leave test-only races untested just because memory is simpler.
5. Create a snapshot in a Firestore transaction when Dan opens the reveal. If `reveal.snapshotId` already exists, return the existing snapshot; never recalculate/reorder a visible group result.
6. Final decisions use `create()` on `lgsV4FinalDecisions/{user}` (or an equivalent transaction that requires document absence). A repeat submission returns 409 with the existing decision, not an update.

### 3.4 Seed/model identity

`seedVersion` is a SHA-256 digest of canonical JSON for `destinations.json`, `activities.json`, and `activity-media.json`, using stable key ordering. `inputDigest` is a SHA-256 digest of each roster user’s ordered stored comparisons. `modelVersion` and `selectorVersion` are constants in the ranking package.

The first accepted comparison binds `seedVersion` to that user in the same transaction. Before issuing or accepting another comparison, completion/profile/atlas access, opening the reveal, or returning results, the API compares that persisted digest with the current seed. A mismatch returns non-revealing `503 seed-version-mismatch` without mutation. If the seed digest differs before any real participant begins, invalidate local/emulator state with the controlled reset. If it differs after a participant begins, stop the release and restore the original seed; do not silently mix content versions. Once the reveal snapshot exists, neither seed nor raw comparisons may change. Personal and group post-reveal responses are serialized from that immutable snapshot; they never rerun ranking from live comparisons.

## 4. Sprint 1 — Complete the human story

### ONE-01: Destination-free preference profile

#### API

Replace the current raw `/v1/profile` attribute response with:

```json
{
  "profile": {
    "headline": "Apparently, this is your kind of trip.",
    "synthesis": "You consistently leaned toward active, distinctive experiences with a sense of place.",
    "dimensions": [
      { "key": "adventure", "label": "Adventure", "strength": "strong", "direction": "drawn-to" },
      { "key": "history", "label": "Old places", "strength": "present", "direction": "drawn-to" }
    ],
    "confidenceLabel": "clear-shape"
  },
  "modelVersion": "bt-hierarchical-laplace-v1"
}
```

Requirements:

- Require the caller’s own completion. Do not require group completion or reveal.
- Return no destination, country, activity ID/title, image, score, rank, coordinate, gallery, credit, or comparison evidence.
- Generate labels from a maintained `AttributeKey → copy` table. A synthesis may mention combinations such as "active" and "distinctive" but may not imply a named place.
- Select at most five dimensions by posterior mean magnitude, excluding a dimension whose 90% credible interval crosses a configured near-zero band. If fewer than three clear dimensions remain, use two strongest dimensions plus the honest copy `"Your mix is still taking shape."`
- Keep the copy deterministic for the same analysis and version. No LLM/API generation.

#### UI

Insert screen `profile` after a completed comparison and before first atlas entry. It is a 1–2 second intentional transition, not a blocking fake calculation.

- Heading: “Okay. We know your type.” or the returned headline.
- Render 3–5 large, accessible dimension bars/tiles. The visual strength is a categorical UI state, not a numeric score.
- Render synthesis and two actions: primary “Open the trip atlas” and secondary “See the crew’s progress.”
- Include `aria-live="polite"` completion confirmation. Under `prefers-reduced-motion`, replace entrance choreography with an immediate static state.
- Desktop visible text remains 20px minimum; touch/click targets remain 44px minimum.

### ONE-02: Five-traveler waiting lobby

#### API

Replace the minimal group-status payload with the `GroupStatus` contract above. `updatedAt` is the latest completion/update timestamp rounded to seconds; it is not a preference signal.

`GET /v1/group-status` is legal for any authenticated roster member at any time. It returns only roster ID and boolean completion. It must not expose count of comparisons, model progress, destination results, or anyone else’s profile.

#### UI

Create a `waiting` screen reachable from the profile and atlas. It has a five-character traveler roster using the approved cutout art only.

- Completed: full-color art, check badge, “Ready.”
- Not complete: dim but legible art, “Still choosing.” Never label someone “not started” versus “in progress”; that distinction is unnecessary surveillance and is not present in the contract.
- Refresh button always triggers a fetch. Poll only while this route is visible and document has focus, every 20 seconds with 10% deterministic per-client jitter. Stop polling on hidden/unmount and after `revealOpen`.
- When a completion transition is observed, show one non-blocking toast: “Matt is ready. 4 of 5 travelers set.” Do not fabricate a live event when the page first loads.
- Before all finish: show a copy-to-clipboard nudge text only; do not send email/SMS or expose an invite system. The text contains no destination/result data.
- After all finish: Dan sees “Open the group reveal”; other travelers see “The crew is ready—Dan opens the envelope.” If `revealOpen` becomes true, show “See the verdict.”
- Preserve atlas navigation. The atlas remains explicitly unranked: copy must say “Every place is still in play.”

### ONE-03: Personal results and explanation primitives

#### API

`GET /v1/results/me` requires the caller’s completion and an open reveal snapshot. It returns only that caller’s own five results, profile summary, model version, and confidence.

```json
{
  "snapshotId": "2026-08-18T...",
  "modelVersion": "bt-hierarchical-laplace-v1",
  "confidence": {
    "label": "close-call",
    "summary": "Your first few contenders were genuinely close."
  },
  "profile": { "...": "same safe profile contract" },
  "results": [
    {
      "rank": 1,
      "id": "antigua",
      "name": "Antigua",
      "country": "Guatemala",
      "imageUrl": "/media/destinations/antigua-01.webp",
      "fitLabel": "strong-match",
      "interval": { "low": 0.64, "high": 0.92 },
      "explanation": {
        "themes": ["mountain days", "old places", "distinctive experiences"],
        "matchedActivityCount": 4,
        "encounteredActivityCount": 6
      },
      "context": { "novemberWeather": "...", "travelFriction": 3 }
    }
  ]
}
```

Allowed only after reveal: destination labels, photos, general weather, travel-effort context, the caller’s own top five, and destination-level explanation counts. Prohibited even after reveal: another person’s raw choices, a per-comparison win/loss list, opponent labels, private photo credit catalog, and model parameter values.

Explanation primitive rules:

- `themes` come from the highest positive attribute contributions to that destination’s portfolio, joined with the user posterior; use a controlled copy map.
- `matchedActivityCount` is the number of encountered activities from that destination with posterior expected utility above the user’s observed-activity median. It is explanation evidence, not a user-visible “wins” score.
- Omit a theme if its model contribution is uncertain or its text would identify a previously unseen raw activity.
- `interval` is used internally to determine `fitLabel`; display a qualitative explanation such as “clear match” or “close among contenders,” never its raw endpoints by default.

#### UI

Add a “My take” panel/tab available on the post-gate verdict and a stable direct route/state after refresh.

- Sequentially reveal ranks 5 → 1 only on first entry. Respect reduced motion by rendering the complete ordered list.
- Each card contains name/country, photo, 2–4 reasons, labelled November/weather and travel-effort context, and a “Why it rose” expandable region.
- “Why it rose” explains themes and counts in plain language. It must not show a percentage, raw utility, comparison history, or imply causal certainty.
- The person may move between their personal results and group verdict without losing an already selected final decision.

### ONE-04: Group verdict explanation

#### API

Extend `GET /v1/results/group` to read only the immutable reveal snapshot. It returns:

```ts
type GroupResultsResponse = {
  snapshotId: string;
  modelVersion: string;
  confidence: ResultConfidence;
  group: GroupFinalist[]; // exactly five, stable ordered
  members: Array<{
    user: RosterUser;
    topThree: Array<{ rank: 1 | 2 | 3; id: string; name: string; imageUrl: string }>;
  }>;
  finalistRanks: Array<{
    destinationId: string; // one of group top five only
    ranks: FinalistRank[]; // rank 1–5, otherwise 6+
  }>;
  insights: Array<{
    kind: 'consensus' | 'close-call' | 'polarization';
    title: string;
    body: string;
  }>;
  decisions: FinalDecision[];
};
```

Interpretation rules:

- `clear-favorite`: posterior probability group rank 1 is at least 0.75 **and** posterior probability it outranks the runner-up is at least 0.85.
- `close-call`: either condition fails. The UI says the group has a “close call,” not that it lacks a winner.
- Per-finalist consensus is based on normalized per-user posterior score dispersion and worst ordinal rank across posterior draws. Tune the exact threshold only through the fixed simulation rubric. Values must be tested and documented in the model ADR; do not tune against a real user’s results.
- Provide only one insight per kind and only if it meets its documented threshold. Never generate awards, dark horses, or claims unsupported by the stored model.

#### UI

The existing verdict becomes an explanatory social scene, not a dashboard.

- Keep winning destination photography, top-five progressive reveal, and traveler cutouts.
- Add a compact “How to read this” key:
  - “Broad consensus: the destination works across the crew.”
  - “Mixed: a good fit, with more variation.”
  - “Close call: the model sees finalists that are genuinely near each other.”
- Add a top-five “crew read” matrix. Rows are the five finalists; columns are the five traveler cutouts; cells show `#1`–`#5` or `6+`. It is post-reveal only and must not expose raw card choices.
- Add a finalist detail drawer with cover photo, group label, weather, and travel-effort key (“1 = easier journey; 5 = bigger expedition; neither is a recommendation”). Do not add airfare, live travel time, a practical score, or an auto-book CTA.
- Avoid a claim such as “without leaving anyone behind” unless the computed consensus criterion passes. Use the returned insight copy instead.
- Reduced-motion mode shows the complete ordered result immediately and removes auto-advancing/rotating scenes.

### ONE-05: Immutable post-reveal final decision

#### API

Add these endpoints:

```text
POST /v1/final-decision
GET  /v1/final-decision
```

Request:

```json
{ "choice": "<one destinationId from group top five>|need-more-research" }
```

Rules:

- Require open reveal and immutable snapshot.
- Require `choice` to be a group top-five ID from that snapshot or the literal `need-more-research`.
- Derive user from authentication; do not accept it in the body.
- Create once only. A duplicate returns 409 with `{ error, decision }`; the UI treats that response as confirmation rather than an editable error.
- `GET` returns the caller’s own decision and a post-reveal roster summary of all decisions. It must not reveal any raw comparisons.

#### UI

Place the final decision after the group top five, with copy such as:

> “Now that you know the places: what should the crew investigate next?”

Render the five group finalist cards and a sixth `Need more research` option. All are equal-weight buttons. Selection requires an explicit confirmation dialog explaining that it records a discussion stance and does not rerank anything. On success:

- Lock the choice locally and after reload.
- Show the character roster with each person’s selected destination/“research” once they have submitted.
- Do not permit editing, undo, or a second vote. The only change mechanism is the documented whole-study controlled reset before the actual trip begins.

## 5. Sprint 2 — Required uncertainty-aware inference

### 5.1 Model decision

Implement `bt-hierarchical-laplace-v1`: a regularized hierarchical Bradley–Terry logistic model fit independently for each traveler. It is a Bayesian MAP fit with a Laplace (Gaussian) posterior approximation. This is intentionally chosen over MCMC, a Python service, or a generic machine-learning dependency because it is deterministic, reviewable, fast for 120 activities/24–40 responses, and feasible to replay exactly in the existing TypeScript backend.

For activity `i` at destination `d(i)`, define centered and scaled eight-attribute feature vector `x_i` and user-specific latent utility:

```text
u_i = β · x_i + δ_d(i) + ε_i

β_k ~ Normal(0, σβ²)                  attribute effects
δ_d ~ Normal(0, σdestination²)         destination effects
ε_i ~ Normal(0, σactivity²)            activity residuals within destination

P(i beats j) = logistic(u_i - u_j)
```

`ε_i` is nested within its destination through the additive destination term and stronger shrinkage. It supplies an activity-specific effect without allowing a vivid individual card to dominate a destination portfolio. `δ`, `ε`, and `β` all have zero-centered priors; centering feature columns and using no global intercept resolves the arbitrary global utility offset.

Default hyperparameters are configuration values, not magic literals scattered through selection code:

```ts
const modelConfig = {
  modelVersion: 'bt-hierarchical-laplace-v1',
  betaPriorSd: 1.25,
  destinationPriorSd: 0.45,
  activityResidualPriorSd: 0.20,
  maxNewtonIterations: 16,
  convergenceTolerance: 1e-7,
  posteriorDrawCount: 512,
  credibleInterval: 0.90,
};
```

These defaults are provisional until the deterministic simulation gate selects them. Commit the selected values and simulation results in a model ADR before enabling production selection; changing any value requires a new model version.

### 5.2 TypeScript implementation structure

Create backend-only modules with no framework dependencies:

```text
backend/src/model/
  config.ts              # versions and selected hyperparameters
  features.ts            # canonical activity/design matrix, centering/scaling
  linear-algebra.ts      # tested dense matrix + Cholesky solve primitives
  prng.ts                # seeded deterministic PRNG and normal sampler
  fit.ts                 # MAP Newton/IRLS fit and convergence diagnostics
  posterior.ts           # covariance, posterior draws, credible summaries
  aggregate.ts           # destination and group draws
  profile.ts             # safe controlled-copy profile/explanation builders
  selection.ts           # information-gain selection
  stopping.ts            # bounded confidence-aware completion
  snapshot.ts            # seed/input digests and Firestore-safe summaries
  baseline.ts            # frozen existing ranking for replay comparison only
```

Parameter vector order is fixed and serialized in code:

```text
[ β_adventure … β_physicalIntensity | δ_destination[24] | ε_activity[120] ]
```

With 152 parameters, a dense `152 × 152` precision matrix is small enough for a Cloud Run request. Fit with damped Newton/IRLS:

1. Build sparse signed row `z = feature(activityA) - feature(activityB)` for each stored comparison and target `y = 1` if A won, otherwise 0.
2. For each iteration, calculate `p = logistic(z · θ)`, gradient `Σ z(y-p) - Λθ`, and positive precision `H = Σ p(1-p) zzᵀ + Λ`.
3. Solve `H Δ = gradient` with Cholesky; use deterministic step halving if penalized log posterior falls.
4. Stop when the max parameter update is under tolerance or after 16 iterations. If Cholesky is non-positive definite after a tiny documented diagonal jitter, return a typed fit failure and use the previous valid analysis only for a still-active session; never fabricate a confident result.
5. At convergence, posterior covariance is `H⁻¹`. Do not explicitly invert for every operation: use Cholesky solves. Construct a full covariance only when serializing a test/debug fixture, never in public responses.

The model must be deterministic for the same activity ordering, comparisons, config, and seed. Use a small seeded PRNG (for example Mulberry32 plus a deterministic Box–Muller normal sampler) rather than `Math.random()`.

### 5.3 Destination, individual, and group outcomes

Destination utility is the equal-weighted mean of all activity utilities in its seeded portfolio:

```text
U_d = mean(u_i for every seeded activity i in destination d)
```

This prevents a destination with more cards or one flashy card from gaining an unearned advantage. For each posterior draw, calculate all `U_d`, then rank. Compute the user’s model-scale destination interval from the 5th/95th percentiles of its draw values.

For a group draw:

1. Draw one posterior parameter vector for every completed user with a deterministic independent sub-seed (`snapshotSeed:user`).
2. Calculate each user’s `U_d` and min–max normalize across the same 24 destinations in that draw. If range is numerically zero, use all `0.5` values and record a model warning.
3. Calculate `meanPreference`, population standard deviation `polarization`, and `groupScore = meanPreference - 0.25 × polarization`.
4. Rank the 24 group scores, preserving lexical destination-ID tiebreaking only for exact numeric ties.

Store summary draws/quantiles needed for results, not raw parameter covariance, in result snapshots. The immutable snapshot must include selected top five, each user top five/top three, top-five membership probability, rank-one probability, rank-five boundary probability, group intervals, consensus labels, profile facts, and a non-sensitive diagnostics object (`converged`, iterations, warnings, draw count).

### 5.4 Calibrated uncertainty and copy

Use posterior draws for user-facing confidence categories:

- Individual `clear-shape`: the current top-five set appears in at least 80% of posterior draws and the fifth-versus-sixth score margin is positive in at least 85%.
- Individual `close-call`: otherwise, including a forced maximum stop.
- Group `clear-favorite`: criteria defined in ONE-04 above.
- Group `close-call`: otherwise.

The UI only shows controlled language:

| Model condition | Allowed interface copy |
| --- | --- |
| clear-shape | “The shape of your trip came through clearly.” |
| individual close-call | “A few contenders were honestly close.” |
| clear-favorite | “The crew has a clear front-runner.” |
| group close-call | “The top of the list is a real close call.” |

Never expose posterior means, standard deviations, credible percentages, or false precision such as “93% certain.” Technical diagnostics are available only in test output and controlled operator logs with no sensitive raw-choice payload.

### 5.5 Information-gain pair selection

`GET /v1/comparison/next` recomputes the active user analysis after every accepted choice. It returns a pair only after server-side selection and persists it as the sole pending pair.

Hard exclusions:

- exact activity pair already answered;
- same-destination pair;
- any activity shown in the immediately preceding two comparisons, unless no valid pair remains;
- any activity shown more than twice before every destination has two appearances;
- pair that would violate completion or pending-pair guards.

Coverage is a safety constraint, not merely a score. Until each destination has two appearances, eligible pairs must contain a destination with fewer than two appearances whenever one exists. Within the eligible set, score candidates:

```text
selection score =
  0.45 × normalized boundary-variance reduction
+ 0.25 × normalized predictive entropy
+ 0.20 × normalized coverage need
+ 0.10 × normalized attribute/diversity novelty
- fatigue penalty
```

Definitions:

- Predictive entropy is binary entropy of posterior predictive `P(A beats B)`; near 50/50 is useful but not sufficient.
- Boundary-variance reduction targets the current uncertain user top-five boundary. Let `q` be the gradient of `U_(5) - U_(6)`, `Σ` posterior covariance, `z` pair design row, and `w = p(1-p)`. Approximate one-observation covariance with Sherman–Morrison:

```text
Σ' = Σ - (Σ z zᵀ Σ) / (1 / w + zᵀ Σ z)
reduction = qᵀΣq - qᵀΣ'q
```

  Use the expected top-five boundary from the current posterior draws. If candidate rank identities change across draws, average this reduction across the highest-mass 64 draws using deterministic sub-sampling.
- Coverage need is the capped sum of the two destinations’ missing appearances, plus an activity-level underexposure term.
- Diversity novelty measures attribute distance from the last four displayed activity vectors and destination-pair novelty. It prevents all late questions from becoming semantically identical.
- Fatigue penalty grows for an activity’s second appearance and is prohibitive for a third before the maximum, except the fallback case.

Normalize terms across eligible candidates per request. Break exact ties by the lexicographically sorted activity-ID pair. Persist `selectorVersion` with the issued pair. The response remains destination-blind and must not include a reason a pair was selected.

### 5.6 Confidence-aware bounded stopping

Keep the user-facing envelope honest: **24 minimum · up to 40**. Replace the heuristic completion function with:

```text
if comparisons < 24: continue
if comparisons >= 40: complete(reason = maximum-reached)
if any destination appearances < 2: continue
if P(current top-five set remains the top-five set) < 0.80: continue
if P(U_(5) > U_(6)) < 0.85: continue
complete(reason = stable-top-five)
```

`P(current top-five set remains the top-five set)` is the fraction of 512 deterministic posterior draws whose top-five membership exactly matches the posterior-mean top-five. At maximum, `confidenceLabel` is `close-call` unless both stability conditions happen to pass. `portfolio-exhausted` is allowed only if no valid unseen eligible pair remains after explicit test coverage; it must produce `close-call` and be logged for operator review.

`progress.estimatedCompletion` is `min(comparisons / 24, 1)` until the minimum and then must advance monotonically but cautiously toward 1 based on the current stability score. It is visual pacing, not a guarantee that the next question finishes. The existing copy remains bounded and honest; never promise a fixed total.

### 5.7 Baseline, simulation, and promotion gate

Retain the existing Elo/coverage implementation in `model/baseline.ts`, freeze it, and give it version `elo-coverage-v1`. It may be used only in deterministic simulation/replay tests, never as the production selection/result path after promotion.

Create deterministic synthetic fixture generators covering at least:

1. Strong attribute-driven preference with a clear top five.
2. One vivid activity residual that conflicts with a destination’s portfolio, validating shrinkage.
3. Two destinations straddling fifth/sixth place.
4. Broadly indifferent traveler, validating honest maximum/close-call behavior.
5. Five-person group with broad consensus.
6. Five-person group with a high-mean but polarizing destination.
7. Seeded outcome noise/replay so calibration is not evaluated on only noiseless choices.

For each fixture, generate at least 200 seeded preference runs and compare baseline with advanced model at the same 24/28/32/36/40 comparison budgets. Record in `docs/model-evaluation.md`:

- top-five exact-set recovery;
- fifth/sixth boundary accuracy;
- rank-one recovery;
- mean questions to stable stop;
- forced-maximum rate;
- 90% interval coverage (truth contained in interval);
- calibration/Brier score for reported clear-shape and clear-favorite categories;
- group winner and consensus-label accuracy.

Promotion requirements:

- advanced model improves or matches baseline top-five recovery at each comparable budget and improves it at the selected stopping policy;
- advanced model’s mean questions to stable top-five is no greater than baseline by more than one question;
- empirical 90% interval coverage is between 85% and 95% on held-out synthetic seeds;
- `clear-shape` false-clear rate is at most 10%;
- no fixture violates destination coverage, pair uniqueness, deterministic replay, or public-data redaction;
- selected hyperparameters, thresholds, data digest, and exact test command are recorded in an ADR (`0003-one-trip-ranking-model.md`).

If the gate fails, tune only using synthetic fixtures, bump `modelVersion`, rerun all simulations, and do not use the app for the real run.

## 6. Sprint 3 — Rehearsal, resilience, and operation

### 6.1 Firestore emulator tests

Add Firebase Emulator Suite configuration and scripts that run isolated Firestore/Auth emulator tests. Production credentials and project data must never be used by tests.

Required emulator cases:

1. Approved roster identity maps to exactly one traveler; unapproved identity is rejected.
2. Comparison append survives API process/repository recreation and has preserved ordinal/revision.
3. Two concurrent submissions for a pending pair yield exactly one accepted record.
4. A stale pair, modified pair, repeat request, and post-completion request each return 409 and do not mutate comparisons.
5. Pending pair expires or is superseded safely; a fresh next request produces one current pair.
6. A completed user can read profile/atlas but cannot read results before reveal.
7. Reveal requires all five completed users and Dan; it atomically writes/retains one snapshot.
8. Result snapshot is stable after a repository/API restart.
9. Final decision accepts only snapshot finalists/research, is immutable, and is visible post-reveal only.
10. Advanced model selection, completion, confidence labels, and group aggregation use the snapshot model version; public routes do not fall back to baseline.

Use an explicit test environment flag rather than `NODE_ENV !== 'production'` alone for demo headers. `X-Demo-User` remains local/test-only and is rejected whenever `K_SERVICE` is present.

### 6.2 Authenticated browser rehearsal

Add a browser E2E suite using Firebase Auth Emulator identities mapped to the five roster email aliases. The frontend gets a test-only explicit auth-emulator configuration; no production build can activate it. Drive five isolated browser contexts through:

1. Character selection and assigned-account mismatch handling.
2. Resume after refresh mid-round; no duplicate submission; accurate bounded progress.
3. Dynamic completion after at least 24 and at most 40 answers.
4. Destination-free profile, named unranked atlas, map/list/drawer synchronization, and working map/image fallback.
5. Waiting lobby poll/explicit refresh, completion-only roster state, and organizer/non-organizer reveal controls.
6. Open reveal, immutable group snapshot, personal results, group matrix, confidence copy, and final decision locking.
7. Keyboard-only flow, focus visibility, reduced-motion mode, desktop 20px visible text floor, mobile 44px controls, and no comparison-page explicit destination leakage.

Use stable semantic selectors (`data-testid` only where semantic role/name is insufficient). Capture desktop and mobile screenshots of each critical route and review them with the existing visual QA/browser harness workflow. Do not automate real Google OAuth or use a real roster account for tests.

### 6.3 Automated content, redaction, and map checks

Extend seed validation/tests to require:

- exactly 24 destination records, each with valid coordinates, exactly three galleries, accessible alt text, and valid credit metadata;
- exactly 120 activities, all with one valid local card image and existing destination reference;
- comparison serializers reject destination ID/name/country/coordinates/gallery/credit/source/score/rank/model diagnostics;
- atlas/reveal serializers are allowed to include only their documented data;
- every MapLibre destination has a rendered marker after initial `fitBounds`, and selecting marker/list/filmstrip synchronizes active state;
- a WebGL/tile failure renders the functional gallery/list fallback and visible attribution/fallback explanation;
- no comparison card renders character art or photo credits.

### 6.4 Operator runbook

Create `docs/one-trip-runbook.md` with exactly these operations, written for Dan without requiring infrastructure knowledge:

1. Preflight: verify seed digest, roster-email Cloud Run config, Firebase sign-in, and deployed build/version.
2. Emulator rehearsal: run the scripted five-person test command and record its pass output.
3. Production smoke test before participants start: one approved sign-in and a single comparison only in a deliberately reset preflight state; then reset before the real run.
4. Safe Firestore export: export `lgsV4Users`, `lgsV4State`, `lgsV4ResultSnapshots`, and `lgsV4FinalDecisions` to a dated, access-controlled GCS export path. Never paste data into a public issue or repository.
5. Controlled reset **only before anyone starts**: verify no participant has begun, export first, delete only the named one-trip collection/documents, redeploy only if required, and verify empty group status. Never reset a live real run without an explicit group decision.
6. Recovery: if a participant refreshes, tell them to sign in as the same person; if a request fails, retry after reload; if Cloud Run restarts, verify persisted state; if the map fails, use the atlas list; if reveal fails, verify all five completion indicators and Dan’s authenticated identity.
7. Reveal: verify all five ready, export state, have Dan open exactly once, and confirm snapshot ID/decision screen.

No monitoring stack, backups beyond this export, generic admin UI, or live support process is in scope.

## 7. Implementation checklist by package

### `shared/`

- Add safe Zod request/response schemas for profile/status/results/final decision.
- Add `finalDecisionSchema` that permits only a non-empty ID or literal `need-more-research`; backend validates membership against snapshot.
- Preserve `toSafeActivity` as the only comparison serializer and add a redaction unit test that fails on any newly added Activity field.

### `backend/`

- Replace current ranking module usage with an interface such as `analyzeUser()` / `selectNextPair()` / `shouldComplete()` owned by `backend/src/model/`.
- Retain frozen baseline only under a clearly named test/replay import.
- Implement canonical seed and raw-input digest utilities.
- Implement transactional store operations, snapshot repository, final-decision repository, and emulator adapters.
- Gate every post-completion endpoint exactly as specified; build response DTOs intentionally rather than spreading destination/model objects.
- Log only event type, roster ID, model version, duration, comparison count, and typed error code. Never log token, email, raw comparison text, destination choice while blind, or Firestore document dump.

### `frontend/`

- Split the current monolithic screen union into small route/state components while retaining one simple app shell; React Router is optional and not required.
- Add `profile`, `waiting`, and `my-results` states. Preserve direct return after refresh through a session/status bootstrap rather than relying solely on component memory.
- Add a public API client that maps documented 409/423 errors into purposeful UI states; it must never infer result data client-side.
- Integrate group explanation/matrix/final decision into the existing verdict style and traveler artwork system.
- Use CSS and existing motion conventions; all motion must have a reduced-motion static alternative and never block answering or reveal navigation.

### `docs/`

- Add the model ADR, evaluation report, runbook, and a concise update to implementation status when each sprint actually passes.
- Do not change the product/UX source-of-truth documents to mark unimplemented work as shipped.

## 8. Error states and edge cases

| Situation | Required behavior |
| --- | --- |
| Model fit does not converge | Return a retryable 503 for next-pair/profile with generic copy; log typed diagnostic. Do not select from stale analysis after an accepted new answer. |
| Numerical covariance issue | Apply only documented diagonal jitter once; if still invalid, fail safely and block completion rather than claim confidence. |
| Maximum 40 reached | Complete with `maximum-reached`; UI says the top is a close call if stability was not met. |
| Browser reload mid-answer | Pending pair is reissued only if current and unexpired; submitted response is atomic/idempotent. |
| Atlas/map failure | Show complete named list/gallery fallback; no preference outcome information appears. |
| User hits result URL before reveal | 423 mapped to waiting screen; never render an empty results shell. |
| Dan opens twice | Return same reveal/snapshot state; no recalculation or second animation is required. |
| Another user submits final decision twice | Return existing immutable decision as confirmation. |
| Non-finalist ID submitted | 400/409 with no mutation; client refreshes group snapshot. |
| Seed digest mismatch | Block release/run and require controlled reset before any user begins. |
| One traveler never finishes | Waiting lobby remains usable and the group gate stays closed; no workaround early reveal exists. |

## 9. Complete acceptance criteria

The one-trip release is complete only when all statements are true:

1. A completed traveler experiences profile → atlas/waiting → group reveal → personal results → immutable final decision without an unexplained dead end.
2. The waiting room reveals only completion status for the five supplied traveler characters and works via polling/explicit refresh without realtime services.
3. Personal and group explanation copy is evidence-grounded, controlled, and never exposes raw pairwise choices or false numerical certainty.
4. Every result seen after reveal comes from one immutable Firestore snapshot with recorded seed/model/input versions.
5. The production ranking and selection paths use `bt-hierarchical-laplace-v1`, posterior uncertainty, information gain, and confidence-aware 24–40 stopping. The frozen heuristic cannot be selected by configuration in production.
6. The deterministic simulation gate passes and its report/ADR records the chosen configuration and reproducible command.
7. Firestore emulator and five-identity authenticated browser rehearsal pass, including restart, duplicate/stale request, reveal, final-decision, atlas fallback, redaction, keyboard, mobile, and reduced-motion cases.
8. All seed, unit, integration, typecheck, production build, visual QA, and documentation checks pass before deployment.
9. A one-trip runbook has been rehearsed with a Firestore export and controlled preflight reset.
10. No out-of-scope platform capability has been introduced to satisfy any of the above.

## 10. Accepted assumptions

- A Laplace-approximated regularized hierarchical Bradley–Terry model is sufficient for this fixed data size and provides the required posterior uncertainty without an MCMC dependency. It is a substantive inference upgrade, not a cosmetic confidence label.
- Synthetic ground truth is appropriate for calibration because the real five travelers should not have to repeat the exercise. Fixture generation and thresholds must be committed and reproducible.
- The 24–40 comparison envelope remains a product accessibility constraint. Model uncertainty may influence the finish between those bounds but may not exceed them.
- “How each person voted” means their post-reveal top three and rank on group finalists, plus their one final decision. It never means their raw activity selections.
- Weather and travel effort are curated destination context, not a practical recommendation model. No live airfare data is required or permitted for this release.
- Firestore’s existing `lgsV4*` names are retained to avoid an unnecessary production migration. Their schema is extended transactionally and documented here.
