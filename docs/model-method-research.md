# Individual preference-model method note

**Status:** Research grounding for the release gate. It does **not** promote a
model or relax any test threshold.

## The problem we actually have

Each traveler supplies 24–40 noisy binary choices between activity cards. The
system needs a defensible personal top five from 24 destinations while asking
as few tiring, repetitive questions as possible. The later social reveal does
not aggregate posterior utilities: it uses the separately documented,
transparent `5/4/3/2/1` ballot. This note is only about learning one person's
private ranking before that reveal.

This is a standard **active top-k ranking from pairwise comparisons** problem,
not a new mathematical problem. The correct engineering response is to use a
small, conventional model and make its stopping decision prove itself on
held-out synthetic trajectories.

## Chosen method family

The release candidate remains a regularized Bradley–Terry logistic model with
Laplace posterior approximation:

- activity-card utility is explained first by the eight canonical attributes;
- small destination and encountered-card residual effects allow real content
  to depart from those broad tastes without pretending sparse answers identify
  every card independently;
- posterior draws turn those utility estimates into a distribution of each
  destination's equal-weighted activity portfolio;
- selection prioritizes expected reduction in uncertainty at the current
  fifth/sixth destination boundary, subject to the non-negotiable coverage,
  novelty, fatigue, cross-destination, and no-duplicate-pair guards; and
- stopping is only allowed after the 24-answer floor when the top-five set and
  fifth/sixth boundary are both stable across the production posterior draws.

This is deliberately narrower than a general recommender system. It avoids a
MCMC service, embeddings trained on other people, or a black-box model that
cannot be deterministically replayed for the one real group.

## Why this is conventional

- Heckel, Shah, Ramchandran, and Wainwright describe active top-k ranking as a
  sequential pairwise-comparison problem and use confidence-driven decisions
  to decide what to ask and when to stop. Their result also warns that a
  parametric model alone is not a license to skip evidence. [Active Ranking
  from Pairwise Comparisons](https://arxiv.org/abs/1606.08842)
- Li et al. use a Bradley–Terry preference model with expected information
  gain to select pairwise questions, combining information seeking with graph
  coverage. That maps directly to this app's boundary-information score plus
  its coverage guard. [Hybrid-MST](https://proceedings.neurips.cc/paper_files/paper/2018/hash/8b6a80c3cf2cbd5f967063618dc54f39-Abstract.html)
- Most recently, active preference-learning work explicitly separates
  epistemic uncertainty (what more questions can resolve) from response noise
  (what no amount of questioning removes) in a Bradley–Terry/logistic setup.
  That is why flat or near-boundary preferences must honestly run to the cap
  instead of being forced into a false "clear" finish. [Active preference
  learning for ordering items](https://proceedings.neurips.cc/paper_files/paper/2024/file/8443219a991f068c34d9491ad68ffa94-Paper-Conference.pdf)

## What the evidence must establish

The model is still offline-only. Promotion requires one reproducible,
full-policy 200-seed evaluation at the production 512-draw configuration that
checks all of the following without tuning thresholds after observing results:

1. Each adaptive trajectory is deterministic, has no duplicate activity pair,
   remains cross-destination, and reaches two appearances for every
   destination by question 24.
2. The generated top five and its fifth/sixth boundary are accurate and
   calibrated for clear, residual-heavy, near-boundary, indifferent, noisy,
   consensus, and heterogeneous preference shapes.
3. "Stable top five" fires for genuinely clear cases and does not fire for
   near-boundary or indifferent cases; the latter may correctly stop only at
   the bounded maximum with close-call language.
4. The actual comparison DTO remains destination-blind even though activity
   photography is intentionally allowed as a soft cue.
5. The candidate is fast enough for the server path; a slow evaluator is not
   evidence that a production request may time out.

The exact thresholds, fixtures, recorded failures, and promotion decision live
in [model evaluation](model-evaluation.md) and
[ADR 0003](adr/0003-one-trip-ranking-model.md). Until that ADR explicitly says
**PROMOTED**, the real trip must not use the app.

## Current engineering implication

The next valid implementation step is a performance-conscious, full-policy
evaluator that reuses deterministic fit/draw work where doing so does not
change the production algorithm, then evaluates the same posterior and
stopping code used in production. It is **not** to lower the stable-boundary
threshold, call a maximum-reached round a stable one, or replace the model
with opaque trial-and-error tuning.
