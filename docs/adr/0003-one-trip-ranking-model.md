# ADR 0003: Use a fixed-round Bayesian attribute shortlist for the one trip

**Status:** Accepted — release candidate, 2026-08-19

## Context

The original one-trip candidate, `bt-hierarchical-laplace-v2-compact`, was
evaluated because the group will play only once. Its completed 3,000-trajectory
adaptive-policy audit had no fit failures and preserved the comparison
redaction contract, but it did not produce a useful stopping signal: only 47
trajectories stopped, coverage was 84.38%, and its top-five recovery was not a
reasonable basis for presenting a statistically certified result.

That is a problem with the product framing as much as the model. Five friends
do not need a hidden optimizer to declare a winner. They need an interesting
blind-discovery game, a useful personal conversation starter, and a transparent
way to talk through the group’s preferences.

## Decision

The release candidate is `bayes-attribute-shortlist-v1` with policy
`fixed-32-boundary-v1`.

- Each traveler answers exactly 32 destination-blind comparisons.
- The model is Bayesian logistic preference learning over the eight canonical
  activity attributes only. It does not fit destination or activity residuals.
- Questions 1–24 preserve two appearances per destination and never repeat an
  exact activity pair. Questions 25–32 use posterior sampling privately to
  favor eligible comparisons near the current personal fifth/sixth boundary.
- The model produces a personal **trip shortlist**, not a certified true
  ranking. The participant sees no posterior probabilities, intervals,
  confidence labels, fit labels, or early-completion claims.
- After reveal, the five shortlists feed the existing transparent 5/4/3/2/1
  social ballot. That ballot is a discussion surface, not a mathematical group
  winner.

New immutable v2 reveal snapshots stamp the model version, policy version,
canonical seed digest, input digest, controlled profile themes, and personal
top fives. Ordered comparisons remain in the protected per-user journey state;
the snapshot seals their canonical digest and never exposes their raw choices.

## Verification requirement

This decision deliberately supersedes the old promotion requirement; it does
not waive verification. Before release, the fixed shortlist must demonstrate:

1. deterministic replay of the exact 32-question sequence and resulting
   personal shortlist;
2. zero fit failures on clear, close, noisy, and divergent fixtures;
3. no duplicate or same-destination pairs, plus two appearances per destination
   by question 24;
4. boundary-oriented selection in questions 25–32 whenever an eligible pair
   exists;
5. strict comparison redaction and immutable snapshot/reload stability.

The five-identity rehearsal, visual/accessibility review, disposable-environment
smoke test, and empty production preflight remain separate release gates.

## Historical evidence

`bt-hierarchical-laplace-v1`, `bt-hierarchical-laplace-v2-compact`, the
confidence-aware 24–40 stopping rule, and their evaluation harness remain in
the repository as offline research/reference code. The completed complex-model
audit is recorded in [model evaluation](../model-evaluation.md). It is honest
evidence that the rejected candidate was unsuitable for this release; it is no
longer a deployment blocker for the intentionally smaller shortlist model.
