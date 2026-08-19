# ADR 0003: Do not promote the one-trip ranking candidate

**Status:** Accepted — Not promoted, 2026-08-18

## Context

The one-trip roadmap requires hierarchical Bradley–Terry inference, credible
intervals, information-gain pair selection, and confidence-aware stopping only
after the fixed OT-19 synthetic evaluation gate passes. The five real travelers
will not repeat the game for model calibration.

## Decision

The completed 7-scenario × 200-seed × 5-budget OT-19 run returned
`do-not-promote`. Keep `elo-coverage-v1` as the only production ranking and
selection path. Do not persist or display candidate confidence, posterior,
selection, or snapshot data for the real trip.

## Evidence: initial v1 candidate

The machine-readable result is
[`../model-evaluation-results.json`](../model-evaluation-results.json); the
human report is [`../model-evaluation.md`](../model-evaluation.md). The run
found 992 fit failures, over-wide interval coverage in 30 rows, no candidate
stable-top-five completions, a failed 24-question coverage guard, missing full
information-gain/redaction certification, and a 32-versus-512 posterior-draw
mismatch. Each is a fail-closed promotion blocker.

## Consequences

Advanced inference remains a required roadmap objective but cannot replace the
deterministic game until a versioned candidate clears the entire gate at its
production draw count. A future attempt must rerun every fixed seed, scenario,
and budget and record a new explicit decision.

## Follow-up: compact v2 candidate

`bt-hierarchical-laplace-v2-compact` is an offline-only replacement candidate.
It estimates activity residuals only for cards actually encountered in a round
and integrates unencountered exchangeable residuals into destination-draw
uncertainty. This reduces the sparse-round parameter dimension without
removing attribute, destination, or activity effects. Its completed 15,000-fit
fixed-schedule run used the production 512 posterior draws and had zero fit
failures with 94.20% aggregate interval containment. It nevertheless produced
zero stable-top-five stops; per-row coverage missed the 85–95% band; the frozen
coverage selector failed the question-24 guard; and it cannot certify the
information-gain policy or HTTP redaction. It does not change this ADR's
decision: the candidate is not promoted. The next valid experiment is a full
deterministic information-gain-policy replay, not lower thresholds or a claim
that aggregate calibration alone is sufficient.

## Method grounding

The model family and its active top-k evaluation logic are grounded in
[the individual preference-model method note](../model-method-research.md).
That note records the external literature basis for the conventional
Bradley–Terry, boundary-information, coverage, and calibrated-stopping design;
it does not change this ADR's **not promoted** decision.

## Full-policy evidence harness

The repository now has a resumable, artifact-backed adaptive-policy runner.
It uses the exact candidate fit, information-gain selection, 512-draw
posterior analysis, and stopping functions, and it checks the strict full
comparison DTO serialization for redaction. A one-trajectory smoke run and a
deterministic replay passed pair, coverage, and DTO-redaction guardrails, but
the full 200-seed, 3,000-trajectory audit has not been completed. Its measured
minimum sequential cost is about 2.4 CPU-hours at 24 answers, with the real
24–40 evaluation costing more. This infrastructure reduces operational risk;
it supplies no new passing calibration/stopping evidence and does not amend
the **do-not-promote** decision.
