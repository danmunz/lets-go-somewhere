# ADR 0001: Permit comparison photography and a post-completion atlas

**Status:** Accepted — 2026-08-18

## Context

Let's Go Somewhere reduces destination-brand bias by withholding explicit geographic and outcome information while a traveler makes activity choices. Earlier product drafts treated all imagery as incompatible with that goal and delayed every named destination surface until the group reveal.

That made comparison cards feel abstract and gave a completed traveler little to explore while the rest of the group finished.

## Decision

- Comparison cards may use locally hosted, activity-specific editorial photography as a deliberately accepted soft geographic cue.
- During comparison, API responses may contain only activity ID, title, description, and opaque local image path. They must not contain a destination name, country, flag, airport code, coordinate, map data, score, rank, or photo-credit metadata.
- Once a traveler has completed their own comparisons, they may browse an unranked named atlas with destination context, real map placement, galleries, and photo credits.
- Personal and group ranking, scores, preference explanations, and another traveler's choices remain sealed until every fixed-roster participant completes and Dan opens the reveal gate.

## Consequences

Photography can make an activity more legible and enjoyable, but it can also create geographic-recognition bias. That bias is accepted intentionally; explicit destination branding and results remain protected by the API contracts and completion/reveal gates.

The atlas is a discovery surface, not a recommendation surface. Its UI must not imply that a selected map pin, gallery item, or list position reflects any person's preference.
