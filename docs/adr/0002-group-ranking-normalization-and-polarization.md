# ADR 0002: Aggregate normalized preferences with a polarization penalty

> **Superseded by [ADR 0004](0004-transparent-top-five-group-tally.md).** This
> historical decision is not the public group-reveal contract. The approved
> reveal uses the transparent `5/4/3/2/1` personal-top-five tally and makes no
> normalized group-utility, polarization-penalty, or group-confidence claim.

> **Status: Superseded by ADR 0004.** Retained only as historical context for
> snapshots created before the approved transparent social-ballot reveal.

**Status:** Accepted — 2026-08-18

## Context

The fixed five-person trip needs a group destination order that does not let a traveler with more decisive or more widely spread raw scores dominate the result. The group should also distinguish broad agreement from a destination that produces strongly split individual responses.

## Decision

For each destination, calculate the group score from individually normalized destination preferences, then subtract `0.25 ×` the standard deviation of those normalized values.

```text
group score = mean(normalized individual destination scores)
              − 0.25 × standard deviation(normalized individual destination scores)
```

The backend owns this calculation. The post-gate social reveal may show the group top five and each traveler's top three, but it never shows activity-by-activity selections.

## Consequences

This favors destinations with high shared appeal over equally liked but divisive alternatives. The factor is a product decision, not a claim of statistical certainty. Sprint 4 in the delivery roadmap will test the stopping rule and ranking behavior with replay/simulation fixtures before any model replacement; versioned results must keep the current V1 calculation reproducible.
