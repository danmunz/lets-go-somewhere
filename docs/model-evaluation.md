# OT-19 model evaluation report

**Status: FAIL — DO NOT PROMOTE.** The production ranking remains
`elo-coverage-v1`; `bt-hierarchical-laplace-v1` and `information-gain-v1` are
offline-only.

## Completed run

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
