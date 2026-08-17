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
- `assets/` contains supplied design-reference material, including personal imagery. Do not move it into runtime UI without explicit approval.
