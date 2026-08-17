# Design System

The visual source of truth is [`../design-system/README.md`](../design-system/README.md). The system is dark-first, warm, and game-like: deep brown-black surfaces, amber primary actions, olive completion states, and expressive travel-character art.

## Implementation rules

- Import `design-system/base.css` once at the frontend entry point; use `design-system/components.css` for shared component contracts.
- Use the supplied logo from `design-system/assets/logo.png`. Traveler illustrations remain in `assets/images/`.
- Fonts are bundled in `design-system/assets/fonts/` and loaded locally through `@font-face`; do not add a Google Fonts request.
- Activity comparisons must remain visually symmetric and destination-blind. V1 has no activity photography or destination imagery.
- Respect `prefers-reduced-motion`; never convey essential state through motion alone.
- Use semantic tokens rather than literal colors, pixels, or one-off shadows in application code.

## Component inventory

Button, Card, Activity Card, Avatar, Badge, Progress Bar, Toast, and Input are defined as implementation contracts in the design-system package. New components should extend those foundations rather than introduce competing visual patterns.

## Related documents

- [UX journey map](ux.md) defines where each component appears.
- [Product specification](spec.md) defines destination-blind constraints.
- [Architecture overview](architecture.md) identifies the frontend integration point.
