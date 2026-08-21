# V1 experience design

## Current implementation status

Landing, character selection, required how-it-works briefing, comparison, completion-gated atlas, group verdict, preference profile, waiting status, personal results, and immutable final-decision surfaces are released for this one trip. The transparent-verdict fixture and visual/accessibility review, fixed-shortlist verification, authenticated five-identity rehearsal, focused literal-browser flow, disposable cloud smoke, deployment, and final empty production preflight have passed. See [implementation status](implementation-status.md). The comparison counter truthfully communicates the fixed `N of 32 choices` commitment.

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
- Progress has an accessible label and the truthful fixed `N of 32 choices` total.
- Do not rely on color or motion to distinguish any essential state.
