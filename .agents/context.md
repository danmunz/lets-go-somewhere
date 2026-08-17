# Persistent project context

## Current state

- The repository was initialized on 2026-08-17.
- Product, UX, architecture, and origin documentation are available under `docs/`.
- Seed content contains 24 destinations and 120 destination-blind activities.
- Implementation scaffolding exists, but no application packages, Firebase project configuration, CI workflows, or runtime code have been created.
- `design-system/` is now the visual source of truth; it contains tokens, base styles, component contracts, and the product logo.

## Key guardrails

- Destination blindness is the central product requirement until the result reveal.
- The ranking engine belongs in `backend/`; shared contracts belong in `shared/`.
- `assets/` contains supplied traveler artwork approved only for roster, progress, waiting, and celebratory UI. Never use it in destination-blind activity cards; the logo and all visual tokens live in `design-system/`.
