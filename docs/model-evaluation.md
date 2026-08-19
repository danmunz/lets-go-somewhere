# OT-19 model evaluation report

**Status: FAIL — DO NOT PROMOTE.** The production ranking remains
`elo-coverage-v1`; `bt-hierarchical-laplace-v1` and `information-gain-v1` are
offline-only.

## Completed run: initial v1 candidate

- Command: `npm run evaluate:model`
- Node: `v22.20.0`
- Generated: `2026-08-18T18:25:18.848Z`
- Seed version: `e6ab43b564dcab83eb94a7a1cb6184e7ce72d2b293e53daf557f3fa18fb6a39f`
- Matrix: 7 scenarios × 200 deterministic seeds (`10000`–`10199`) × budgets
  24/28/32/36/40 = 35 completed rows and 15,000 attempted candidate fits.
- Candidate configuration: model `bt-hierarchical-laplace-v1`, selector
  `information-gain-v1`, prior SDs `1.25 / 0.45 / 0.20`, maximum 16 Newton
  iterations, tolerance `1e-7`, 90% interval, and jitter `1e-9`.
- Evaluator draw count: 32; production draw count: 512. This mismatch is an
  explicit hard failure, not an approximation that may be promoted.

The complete, exact success/total counts for every fixture and budget are in
[`model-evaluation-results.json`](model-evaluation-results.json). The evaluator
ran all required scenarios, seeds, and budgets; it did not treat a partial run
as evidence.

## Exact observed outcome

Successes:

- pair uniqueness: `true`;
- cross-destination comparisons: `true`;
- deterministic replay schedule: `true`;
- no baseline-to-candidate top-five regression triggered the promotion guard;
- candidate top-five exact-set recovery: `1013 / 14008` successful fits;
- candidate 90% interval containment: `324914 / 336192` destination checks;
- false-clear rate: `0 / 7481` close-call denominator checks.

Hard failures:

1. `992 / 15000` candidate fits failed to converge.
2. Interval coverage is above the required 85–95% band in 30 fixture/budget
   rows (all five budgets for clear-attribute, vivid-residual, indifferent,
   consensus-group, polarizing-group, and noisy-replay fixtures).
3. The candidate produced `0 / 14008` `stable-top-five` stops; the baseline
   recorded `3000 / 15000` stable-stop observations.
4. The frozen 24-question replay schedule did not meet destination coverage.
5. The evaluator used 32, not production 512, posterior draws.
6. Full information-gain policy replay and public comparison-payload redaction
   are not certified by this runner.

The candidate therefore cannot affect comparison selection, completion,
persisted snapshots, individual results, group results, or reveal copy. See
[ADR 0003](adr/0003-one-trip-ranking-model.md).

## v2 compact calibration attempt — still not promoted

The v1 failure revealed a structural mismatch: it allocated one residual
coefficient to every one of the 120 seeded activities even though a round
contains only 24–40 comparisons. The replacement candidate is
`bt-hierarchical-laplace-v2-compact`. It retains the same three effect levels:
eight standardized attribute effects, destination random effects, and explicit
activity residual effects for every activity a traveler has encountered. It
marginalizes the remaining exchangeable, zero-mean activity residuals into
portfolio posterior draws instead of estimating weakly identified coefficients
that have no observations.

Its tighter synthetic-only priors are beta/destination/activity SD
`0.80 / 0.15 / 0.08`; Newton uses 48 iterations, `1e-6` tolerance, and a
scale-aware roundoff check. The latter accepts only an objective loss within 64
machine epsilons of the current objective; it does not accept a material
non-ascent step.

The preceding one-seed smoke evaluation was followed by the full fixed matrix:
7 scenarios × 200 seeds × 5 budgets, **15,000 fits** and **512 posterior draws
per fit**. The compact model recorded **0 fit failures**, **339,119 / 360,000
(94.20%)** aggregate 90%-interval containment, **2,339 / 15,000 (15.59%)**
exact top-five recovery, **0 / 15,000** stable-top-five stops, and **0 / 8,000**
false-clear classifications. The full machine-readable v2 result is the
current [`model-evaluation-results.json`](model-evaluation-results.json).

It remains a **do-not-promote** result. Although the aggregate coverage falls
inside the 85–95% band, the gate is per fixture/budget: vivid residual and
indifferent rows remain over-wide (97.88–99.67%), while fifth/sixth boundary
rows after question 24 are under-wide (82.44–83.83%). The frozen
`elo-coverage-v1` schedule still misses the two-appearances-per-destination
guard at question 24, yields no stable stops, and cannot certify the intended
information-gain policy or HTTP payload redaction. The smallest valid next
change is therefore not a threshold adjustment or further prior tuning: add a
deterministic full-policy replay that issues each next comparison through the
information-gain selector, verifies its coverage contract, and evaluates the
same posterior/draw path used for results. Only then is it meaningful to
calibrate any remaining fixture-specific interval mismatch. The production
ranking remains `elo-coverage-v1`.

## Adaptive-policy audit command

`npm run audit:model-policy` refits and selects every comparison from the
candidate information-gain policy rather than replaying the frozen baseline
schedule. It defaults to the full 200-seed fixture set and checks determinism,
pair uniqueness, cross-destination pairing, and the two-appearances-per-
destination rule at question 24. For a bounded smoke run, use:

```sh
LGS_MODEL_POLICY_SEEDS=10000 LGS_MODEL_POLICY_SCENARIOS=clear-attribute-preference LGS_MODEL_POLICY_MAX=24 npm run audit:model-policy
```

The command is a diagnostic prerequisite, not a promotion mechanism. Its
results must still be paired with calibrated posterior recovery and comparison
payload-redaction checks before ADR 0003 can change.

## Full-policy evidence harness (not yet a completed audit)

The adaptive-policy command now runs the same candidate components that a
future production route would use: a fresh hierarchical fit before each
information-gain choice, the selector's real hard coverage/exposure guards,
the production **512-draw** portfolio posterior after every answer from 24
onward, and the bounded stopping function. It also constructs strict full
comparison response DTOs through `toSafeActivity` for all 120 activities and
asserts recursively that none of the destination, map, rank, model, or credit
keys cross that boundary.

It writes one JSON artifact per synthetic trajectory below the ignored
`.agents/local/model-policy/` directory. Every artifact contains the seed
digest, candidate/selector versions, draw count, min/max bounds, scenario,
seed, traveler, ordered comparisons, stopping output, guardrails, and elapsed
time. A resume refuses any artifact whose input fingerprint differs, so a
configuration or seed-content change cannot be accidentally combined with an
older run.

The full 200-seed audit consists of 3,000 trajectories (the seven fixtures
contain fifteen synthetic travelers per seed). It can be partitioned without
changing its deterministic work ordering. For example, use the same artifact
directory for four non-overlapping workers:

```sh
LGS_MODEL_POLICY_PARTITION=0/4 npm run audit:model-policy
LGS_MODEL_POLICY_PARTITION=1/4 npm run audit:model-policy
LGS_MODEL_POLICY_PARTITION=2/4 npm run audit:model-policy
LGS_MODEL_POLICY_PARTITION=3/4 npm run audit:model-policy
LGS_MODEL_POLICY_SUMMARIZE=1 npm run audit:model-policy
```

Rerunning a completed partition is a safe resume. A separate deterministic
replay compares regenerated comparisons, stopping facts, and guardrails with
the saved artifacts:

```sh
LGS_MODEL_POLICY_PARTITION=0/4 LGS_MODEL_POLICY_VERIFY_DETERMINISM=1 npm run audit:model-policy
```

### Measured smoke evidence

On 2026-08-19, this bounded command completed one clear-preference trajectory
at the production draw count:

```sh
LGS_MODEL_POLICY_SEEDS=10000 \
LGS_MODEL_POLICY_SCENARIOS=clear-attribute-preference \
LGS_MODEL_POLICY_MAX=24 \
LGS_MODEL_POLICY_OUTPUT=.agents/local/model-policy-smoke \
npm run audit:model-policy
```

It took 2,875.9 ms and passed unique-pair, cross-destination, question-24
coverage, and all-120-activity DTO-redaction checks. A deterministic replay
with `LGS_MODEL_POLICY_VERIFY_DETERMINISM=1` matched the stored comparisons,
stopping facts, and guardrails. It did not produce a stable-top-five stop at
the 24-answer floor. This is useful harness evidence only: it is **not** a
full-policy pass, a calibration result, or a promotion decision.

The measured 2.876 seconds is only a lower bound: 3,000 such 24-question
trajectories take about 2.4 sequential CPU-hours before the required
determinism replay, while 24–40 trajectories perform additional 512-draw
posterior/stopping evaluations and will take longer. The complete partitioned
run, per-fixture calibration review, required stable-stop behavior, and ADR
decision remain hard blockers. No thresholds, priors, or production routes
changed as part of this harness work.
