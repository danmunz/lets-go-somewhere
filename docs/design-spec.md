# V1 experience design

## Screens

- Landing: a short destination-blind promise, 28–35 choice expectation, and local development identity selector.
- Comparison: an approximate progress bar and two equal-weight full-card buttons. Cards use no image, location, map, flag, airport code, airfare, or destination label.
- Profile: category signals are shown after completion, but named destinations remain hidden.
- Waiting: roster completion status and a clear reveal embargo message. Character art is intentionally not used in activity cards.

## Responsive layout

Use a single narrow column on small screens. Comparison cards become a two-column grid from 760px. Keep each choice at least 240px high, with equal width and the same visual treatment.

## Accessibility

- Whole activity cards are semantic buttons with an accessible selection label.
- Use the supplied design-system focus indicator and `prefers-reduced-motion` behavior.
- Progress has an accessible label and no exact question total.
- Do not rely on color or motion to distinguish any essential state.
