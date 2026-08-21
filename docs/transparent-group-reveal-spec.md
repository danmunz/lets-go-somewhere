# Transparent group reveal specification

**Status:** Approved implementation handoff.
**Authority:** This refines the approved top-five ballot in [the one-trip implementation specification](one-trip-implementation-spec.md); it does not change the individual preference-model release gate.

## Outcome

The individual model infers each traveler's ordered destination list from blind comparisons. After Dan opens the gate, the group reveal turns only those five personal top fives into a readable social ballot. It does not normalize utility scales, calculate a group posterior, subtract disagreement, or name an objective winner.

For each destination, personal rank `1..5` contributes `5, 4, 3, 2, 1` points; all other ranks contribute zero. Order the published shortlist by total points, then first-place votes, then distinct top-five supporters. When all three tie, show the same displayed rank. The immutable snapshot stores the computed result; clients must never recompute it.

## Snapshot and API contract

Replace the old normalized-score group summary with a snapshot group ballot:

```ts
type GroupFinalist = {
  rank: number; // shared when all published tiebreaks tie
  id: string;
  points: number;
  firstPlaceVotes: number;
  topFiveSupporters: RosterUser[];
};

type GroupInsight = {
  kind: 'shared-destination' | 'strong-shared-destination' | 'split-destination'
    | 'shared-theme' | 'contrasting-themes' | 'two-camps' | 'wild-card';
  title: string;
  body: string;
  destinationIds?: string[];
  users: RosterUser[];
};

type GroupDisplayMode = 'broad-leader' | 'near-tie' | 'no-consensus' | 'shared-shortlist';
```

`GET /v1/results/group` returns the immutable snapshot ID/model version, `displayMode`, exactly five ordered `group` entries enriched with name, country, cover image, and existing travel context; all five members' complete `topFive`; the five-by-five finalist rank matrix (`1..5` or `outside-top-five`); and ordered insights. It contains no `groupScore`, interval, normalized utility, consensus label, posterior draw, activity comparison, credit data, or final-vote data.

The snapshot persists rank-only ballot input for every roster member, per-finalist tally fields and supporter set, displayed ranks, selected display mode, and insights. It is created once in the existing reveal transaction. A repeat open or later model/seed deployment returns the original snapshot.

The published group remains exactly five entries. If the fifth boundary remains tied after all three published tiebreaks, include the tied destinations in the stored five in stable destination-ID order **but give them the same displayed rank and never describe one as ahead of the other**. The group talks through these five places together; the app does not collect a later vote.

## Reveal composition and preference-shape states

Always render: an always-visible `How points work` key; an image-led five-place crew scoreboard; each traveler's avatar and full top five; and a rank matrix that shows the evidence behind every group finalist. Opening copy changes presentation only—never points or ordering.

| State | Deterministic condition | Opening and emphasis |
| --- | --- | --- |
| Broad leader | First finalist has at least 3 top-five supporters **and** leads second by at least 3 points. | “The crew has a clear shared pull.” Lead with its photo, points, supporter avatars, and the fact that it appears in at least three shortlists. Other finalists remain visible. |
| Near tie | No broad leader, no no-consensus state, and no high-overlap shared shortlist; first/second differ by at most 2 points after tally ordering. | “The crew has a real shortlist.” Present the two leaders at equal visual weight. |
| No consensus | No destination appears in 3 or more personal top fives. | “No automatic consensus—this is a true group decision.” Lead with all five personal #1 choices and the crew scoreboard; do not call the points leader the answer. |
| Shared shortlist | Two leading destinations each have at least 3 top-five supporters and are within 2 points; this includes an unresolved shared first-place tie. Otherwise, it is the default state. | For the high-overlap case, say “A dead heat” for an unresolved tie or “Here’s where the crew is leaning” for a close shared pull; show the leaders at equal visual weight. In the default case, show the ordered shortlist and underlying ranks. |
| Wild card | A personal #1 destination has exactly one top-five supporter. This is an additional insight, not a display mode. | On that traveler's card, add “`<Name>`’s personal wild card.” Keep it celebratory and visible even if it is not a group finalist; do not inflate its tally or call it a group recommendation. |
| Two camps | Select the highest-ranked pair of finalists with disjoint supporter sets, at least 2 supporters each, and at least 4 distinct supporters in their union. Break candidate-pair selection by larger combined points, then lexical IDs. | Add “Two trip moods emerged.” Show the two destinations side-by-side with their supporter avatars. This is an overlay insight; it does not change the primary display mode. |
| Split destination | A destination has at least 2 top-five supporters and at least 2 travelers outside its top five. | Add “A conversation starter.” State the supporters and the outside-top-five count or named placements; never call disagreement a penalty, failure, or polarization. |

State precedence is: broad leader, then no consensus, then high-overlap shared shortlist (including an unresolved shared first-place tie), then near tie, then the default shared shortlist. Two camps, wild cards, shared destinations, and split destinations may accompany any primary state. At most three insight cards are shown, selected in this order: strong shared destination, split destination, two camps, wild card, shared destination, shared theme, contrasting themes. Within a kind, choose the strongest supporting count, then group order.

Generated copy must be controlled templates with injected names/destinations, not an LLM. Every claim must be recoverable from stored ranks or profile themes:

- Shared destination: two or more top-five supporters; strong shared: three or more.
- Shared/contrasting theme: use only existing controlled profile theme labels; require two or more travelers for each cited group.
- A place outside every other top five may be a wild card only for its #1 traveler.
- Omit a claim if no condition passes. Never infer why somebody chose an activity.

## Privacy, accessibility, and interaction

The whole response is reveal-gated: all five roster members must be complete and Dan must open the envelope. Before that, results endpoints return the existing lock response. After it opens, named destinations, cover photos, weather, and travel effort are allowed; raw comparisons, individual model parameters, posteriors, source-photo credits, and any user data beyond the fixed roster remain private.

All rankings and points are text equivalents, not color-only. Tables retain headers and an accessible caption. Traveler cutouts have names in text. In reduced-motion mode, render the full result without sequential auto-reveals; motion may decorate but never delay reading, choosing a finalist, or opening a personal card.

## Acceptance tests

- Unit-test tally values, lower-rank zero points, two published tiebreaks, shared display ranks, and stable cutoff ordering.
- Test every display-mode condition plus unanimous, all-different, single-person wild-card, two-camp, split-destination, and exact-tie fixtures.
- Test that no-consensus suppresses a winner claim even if a points leader exists.
- Test insight templates only emit statements supported by stored ranks/themes, respect the ordering/cap, and never disclose raw activity choices.
- Test snapshot creation/reload immutability and API validation/redaction; no old normalized group fields may cross the public contract.
- Browser-test the locked route, every crew scoreboard/matrix state, keyboard navigation, reduced motion, and the discussion closing after a shared rank.
