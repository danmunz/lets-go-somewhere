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

## Evidence

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
