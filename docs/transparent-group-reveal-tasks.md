# Transparent group reveal delivery board

**Source:** [transparent group reveal specification](transparent-group-reveal-spec.md).  
**Release condition:** This board replaces the old normalized/polarization group
summary before the one real trip. Individual inference, calibration, and
adaptive-policy release gates remain unchanged.

## Delivery rules

- **One social ballot:** each completed traveler's personal ranks one through
  five contribute `5, 4, 3, 2, 1`; every other rank contributes zero. The
  server creates and stores the tally once. Clients only render it.
- **Published order:** total points, then first-place votes, then distinct
  top-five supporters. A remaining tie has a shared displayed rank. Keep the
  stored shortlist at five by stable destination ID at a tied fifth boundary;
  do not describe either tied entry as ahead.
- **Snapshot migration:** introduce a strict `schemaVersion: 2` social-ballot
  snapshot. Readers retain the existing v1 schema solely so an already-open
  snapshot remains immutable/readable; new result routes must not reinterpret
  or overwrite it. Before deploying this contract, the operator checks for an
  open v1 reveal. If one exists, preserve it through the legacy reader/route
  until the one-trip reset procedure is run; do not create a v2 response by
  recalculating its group result. The real-trip release must start with no
  open v1 snapshot and all newly opened reveals are v2.
- **Privacy:** comparison routes remain destination-blind. Post-gate results
  may show names, context, cover photos, ranks, points, roster users, and
  final decisions, but never raw activity choices, model utilities,
  normalized scores, intervals, posterior diagnostics, or media credits.
- **Ownership seams:** the backend-contract lane owns `shared/src/index.ts`;
  the persistence lane owns `backend/src/store.ts`; the route/DTO lane owns
  `backend/src/dto/one-trip.ts` and `backend/src/app.ts`; the frontend lane
  owns verdict components/styles. No parallel task edits another lane's seam
  without the owner's handoff.

## Dependency map

```text
TGR-01 contract + v1/v2 reader ─┬─ TGR-03 immutable snapshot builder/repository ─ TGR-04 routes/DTOs ─ TGR-06 frontend integration
TGR-02 tally + insight engine ──┘                                                        └───────────── TGR-05 backend tests
TGR-06 frontend integration ─────────────────────────────────────────────────────────────────────────── TGR-07 visual/accessibility review
TGR-04 + TGR-05 + TGR-07 ────────────────────────────────────────────────────────────────────────────── TGR-08 docs, changelog, release check
```

## Tasks

### TGR-01 — Version the social-ballot contracts and snapshot reader

- **Lane:** Backend contract/persistence. **Dependencies:** none. **Parallel:** TGR-02.
- Replace public group DTOs with the approved `GroupFinalist`, `GroupInsight`,
  `GroupDisplayMode`, full member top-five, and finalist-rank-matrix contracts.
  The group response has exactly five enriched finalists, uses
  `outside-top-five` (not `6+`), and has no confidence, normalized-score,
  interval, consensus, or diagnostic fields.
- Define a discriminated v1/v2 persisted snapshot reader. Only v2 is valid
  for creation. A v1 snapshot stays read-only and is surfaced through a
  deliberately versioned legacy path/status until reset; neither Firestore nor
  the in-memory adapter may mutate it in place. Update final-decision
  membership validation to accept the v2 stored finalists.
- **Tests/acceptance:** strict positive/negative Zod tests; v2 rejects all old
  group fields; v1 parses only as legacy; malformed/mixed versions fail;
  final-decision value validation remains server-side.
- **Commit:** `feat(results): version transparent group ballot contracts`.

### TGR-02 — Implement pure tally, display-mode, and evidence-bound insight engine

- **Lane:** Backend contract/persistence. **Dependencies:** none. **Parallel:** TGR-01.
- Add a deterministic pure module that consumes five ordered personal top
  fives plus controlled profile themes and produces the stored ballot:
  finalists, points, first-place votes, supporter lists, displayed ranks,
  rank matrix, display mode, and at most three controlled-template insights.
- Implement exactly the approved primary-state precedence: unresolved first
  tie/near tie, broad leader, no consensus, near tie, shared shortlist. Add
  wild card, two camps, shared/strong shared, split, shared-theme, and
  contrasting-theme overlays only when their stated evidence predicates pass.
  Insight selection follows the approved cap/order and stable tiebreaks.
- **Tests/acceptance:** fixed examples for 5/4/3/2/1, lower-rank zero,
  first-place/supporter tiebreaks, shared ranks, stable fifth-boundary IDs,
  unanimous, all-different/no-consensus, wild-card, two-camp, split,
  broad-leader, and exact-tie groups. Assert every template's named users,
  destinations, and themes are recoverable from its input; unsupported claims
  are absent.
- **Commit:** `feat(results): add transparent tally and social insights`.

### TGR-03 — Create immutable v2 snapshots from completed personal rankings

- **Lane:** Backend contract/persistence. **Dependencies:** TGR-01, TGR-02.
- Update the baseline snapshot builder and reveal repository so Dan's existing
  all-complete/open-gate transaction creates exactly one v2 ballot with each
  roster member's full top five and profile themes. Persist tally facts,
  display mode, ordered insights, and final-decision-eligible five IDs in the
  snapshot; do not persist raw comparisons or any group utility.
- Repeated opens, process restarts, seed changes, and later model changes
  return the original v2 snapshot unchanged. A current v1 open snapshot takes
  the explicit legacy path from TGR-01 rather than being rewritten.
- **Tests/acceptance:** memory and Firestore-emulator transaction tests prove
  one winner under racing opens, reload identity, no v1 rewrite, all five
  ballots captured, and final-decision membership against stored IDs.
- **Commit:** `feat(results): persist immutable social ballot snapshots`.

### TGR-04 — Serialize and gate the new group-results API

- **Lane:** Backend route/DTO. **Dependencies:** TGR-01, TGR-03.
- Make `GET /v1/results/group` map only v2 snapshot facts plus permitted seed
  presentation data (name, country, cover image, weather, travel effort) and
  decisions. Keep the existing all-complete + organizer-open gate. Return the
  documented locked response before gate and the explicit legacy state for an
  open v1 snapshot; never fall back to live rank calculation.
- Update final-decision routes to use stored v2 finalists and preserve
  idempotent conflict/reload behavior.
- **Tests/acceptance:** schema-parse all responses; locked, unauthorized,
  v1-legacy, v2, decision, and repeated-open cases; recursive forbidden-field
  assertions for comparisons, activity IDs, model scores, intervals,
  posterior fields, credit metadata, and old normalized group fields.
- **Commit:** `feat(api): serve snapshot-backed social group reveal`.

### TGR-05 — Review backend behavior and release migration safety

- **Lane:** Review/test. **Dependencies:** TGR-02, TGR-03, TGR-04.
- Independently inspect tally ordering, template evidence, schema-version
  handling, Firestore transaction behavior, and public redaction. Exercise
  the five required preference-shape fixtures against the actual API.
- Record any blocker in the code-review document; do not approve if the v1
  migration can silently recompute a public reveal or if a route leaks model
  or activity detail.
- **Tests/acceptance:** `npm test`, strict typecheck, and the isolated
  Firestore emulator suite pass; review has no unresolved correctness/privacy
  finding.
- **Commit:** `test(results): cover social ballot reveal states` (and a
  separate `docs(review): ...` commit only if review notes change).

### TGR-06 — Recompose the verdict as a transparent social reveal

- **Lane:** Frontend UI. **Dependencies:** TGR-01 contract fixture; integrate
  after TGR-04. **Parallel:** TGR-05 after its API fixture is stable.
- Replace the winner/confidence/polarization presentation with: an
  always-visible "How points work" key; image-led five-place crew scoreboard
  with points, first-place counts, and supporter avatars; full image-led top
  five card for every traveler; accessible rank matrix; up to three
  evidence-backed insight cards; and the existing immutable final discussion
  choice.
- Render display modes exactly as stored: broad leader uses “clear shared
  pull”; near tie gives two leaders equal visual weight and says “dead heat”
  for shared first; no-consensus leads with all five #1 choices and calls the
  tally a conversation starter; shared-shortlist is neutral. Wild cards and
  two camps are celebratory overlays, not ordering changes.
- Keep every #1 visible even without support. Make points/ranks textual, table
  headers/caption present, cutouts named in text, keyboard selection/focus
  obvious, and reduced-motion content immediately available.
- **Tests/acceptance:** component fixtures for all display modes, shared rank,
  wild card, two camps, and no consensus; no old field/copy use; decision
  choices contain only stored finalists plus `need-more-research`.
- **Commit:** `feat(verdict): present transparent crew ballot`.

### TGR-07 — Visual, accessibility, and browser review

- **Lane:** Review/test. **Dependencies:** TGR-06.
- Capture desktop and mobile evidence for broad leader, near tie/dead heat,
  no consensus, and split/wild-card combinations. Verify the points key is
  visible without a tooltip, scoreboard/matrix remain readable, sequential
  effects never block content, and focus/reduced-motion behavior is clear.
- Run an authenticated five-identity browser rehearsal through gate opening,
  reveal reload, individual results, and final decision; include a stale-tab
  reload after another identity's decision.
- **Tests/acceptance:** no desktop visible copy below the design system floor;
  44px controls; no color-only evidence; named post-gate detail only;
  screenshot review has no unresolved critical issue.
- **Commit:** `test(verdict): verify social reveal accessibility`.

### TGR-08 — Reconcile documentation, changelog, and release checklist

- **Lane:** Review/release. **Dependencies:** TGR-05, TGR-07.
- Update the spec, UX, architecture, runbook, implementation status, content
  guide, roadmap, ADR/context where relevant, and `CHANGELOG.md` to describe
  only verified v2 behavior. Remove claims that the public group reveal uses
  confidence, normalized utility, consensus/polarization labels, or activity
  vote disclosure.
- Add the operator's pre-deploy v1-snapshot check and controlled-reset
  instruction. Mark the social reveal complete only after the new API,
  emulator, browser, and visual gates pass; keep advanced individual-model
  promotion separately blocked until its own evidence passes.
- **Tests/acceptance:** documentation links resolve; no contradictory old
  group-result claim remains; release checklist names the v1-open-snapshot
  condition and the individual-model gate.
- **Commit:** `docs(results): document transparent group reveal release`.
