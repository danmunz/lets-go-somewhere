# AGENTS.md — Let's Go Somewhere Development Guidelines

These standards apply to every contributor working on **Let's Go Somewhere**.

## Product boundary

This is a destination-blind preference game, not a destination-ranking survey. Before the reveal, do not expose destination names, countries, flags, airport codes, airfare, maps, or overt destination labels. Authentic cultural and environmental detail is allowed: the product reduces destination-brand bias rather than guaranteeing geographic anonymity.

When documents appear to conflict, use this precedence order:

- [Product specification](docs/spec.md) defines product behavior and data requirements.
- [User journey map](docs/ux.md) defines the required interaction and screen behavior within that product boundary.
- [Architecture overview](docs/architecture.md) defines technical boundaries and data ownership.
- [`design-system/`](design-system/) defines visual implementation rules.
- [Project origins](docs/project-origins-background.md) is background and intent, not a competing implementation specification.

`seed/` is the canonical current content set; shared runtime schemas must express the field names used there and in the product specification.

## Repository conventions

- `frontend/` owns presentation and client interaction; it must not own canonical ranking logic.
- `backend/` owns authorization, persistence orchestration, ranking, and result calculation.
- `shared/` owns cross-boundary types, runtime schemas, and constants.
- `seed/` is version-controlled canonical development content. Keep `destinations.json` and `activities.json` valid and synchronized.
- `assets/` contains traveler artwork approved for roster, progress, waiting, and celebratory UI; never place it in destination-blind activity cards. [`design-system/`](design-system/) is the visual source of truth for production tokens and component contracts.

## Seed-data rules

- Each activity must reference an existing `destinationId`.
- Every activity needs exactly these integer attributes, each between 0 and 5: `adventure`, `nature`, `culture`, `food`, `history`, `urban`, `novelty`, and `physicalIntensity`.
- Keep 5–8 activities per active destination.
- Activity titles and descriptions must be comparable in energy and specificity; do not write one destination as an advertisement and another as an encyclopedia entry.

## Engineering standards

- Use TypeScript with strict type checking for new implementation code.
- Validate external and persisted input at boundaries; shared schemas should be usable by both frontend and backend.
- Add focused tests with every ranking, scoring, pair-selection, or authorization change. Ranking tests must be deterministic.
- Do not silence type errors or lint failures without a concise, local justification.
- Never commit credentials, Firebase service-account files, or local environment files.
- Remove debug code and temporary artifacts before committing.

## Git and documentation

- Keep commits focused and use Conventional Commits, such as `feat(ranking): add adaptive pair selection` or `docs(architecture): clarify Firestore schema`.
- Do not claim implementation work is complete until relevant tests or checks have run successfully.
- Keep [README.md](README.md), `docs/`, and [CHANGELOG.md](CHANGELOG.md) current whenever their subject changes.
- Follow [`design-system/README.md`](design-system/README.md) for visual work. Use semantic tokens, preserve equal visual weight between comparison options, and respect reduced-motion preferences.
- Record non-obvious implementation discoveries or accepted decisions in [`.agents/context.md`](.agents/context.md). Put substantial architectural decisions in `docs/adr/`.

## Before beginning work

Read `.agents/context.md` and the relevant source-of-truth document above. If a requested change conflicts with the destination-blind experience or the documented architecture, flag the conflict before implementing it.
