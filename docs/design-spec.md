# V1 experience design

## Current implementation status

Landing, character selection, comparison, completion-gated atlas, group verdict, preference profile, waiting status, personal results, and immutable final-decision surfaces are implemented in the committed one-trip checkpoint. The transparent-verdict fixture and visual/accessibility review are complete locally; the advanced-model promotion, five-identity browser rehearsal, and deployment gates remain open. See [implementation status](implementation-status.md). The comparison counter truthfully communicates the 24-answer minimum and 40-answer maximum rather than an exact fixed total.

## Screens

- Landing: a short visual explanation of the destination-blind game and a clear time expectation, followed by character selection before Google sign-in.
- Comparison: an approximate progress bar with encouraging milestone copy and two equal-weight full-card buttons. Cards may use destination photography as an intentionally accepted soft cue, but never a location, map, flag, airport code, airfare, destination label, score/rank signal, or photo credit.
- Profile: category signals lead into an unranked destination atlas; ranks and response evidence remain hidden until the group gate.
- Waiting: roster completion status and a clear reveal embargo message. Character art is intentionally not used in activity cards.

## Responsive layout

Use a single narrow column on small screens. Comparison cards become a two-column grid from 760px. Keep each choice at least 240px high, with equal width and the same visual treatment.

## Accessibility

- Whole activity cards are semantic buttons with an accessible selection label.
- Use the supplied design-system focus indicator and `prefers-reduced-motion` behavior.
- Progress has an accessible label and no exact question total.
- Do not rely on color or motion to distinguish any essential state.
