# ADR 0004: Use a transparent top-five tally for the group reveal

## Status

Accepted — 2026-08-18

## Decision

Keep the individual adaptive preference model responsible for learning each
traveler's destination order. At the reveal, turn each inferred top five into
the same visible ballot: ranks one through five receive `5, 4, 3, 2, 1` points
and all lower ranks receive zero. Order destinations by total points; break
ties by first-place votes, then top-five appearances, and retain any remaining
tie as a shared rank.

The immutable snapshot also stores the five personal top fives, supporter
membership, and only evidence-backed overlap/divergence observations. It never
stores or exposes raw activity choices as a social voting record.

## Consequences

The reveal can honestly show broad support, near ties, personal wild cards,
two camps, and no-consensus outcomes without a hidden penalty or synthetic
group utility. It will not claim a group-level posterior confidence interval.
Individual Bayesian uncertainty and information-gain work remain required for
the one-shot preference-elicitation experience and its stopping decision.
