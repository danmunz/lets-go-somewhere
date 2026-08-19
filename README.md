# Let's Go Somewhere

**Let's Go Somewhere** is a destination-blind group-trip preference game. Participants make quick choices between specific experiences; the app then reveals which destinations best match their preferences and where the group has the strongest overlap.

The V1 use case is one fixed five-person trip in November 2026 (Dan, John, Matt, Peter, and James). Support for self-serve trip creation, multiple groups, and other trip types is deliberately post-MVP.

## Status

The app is a TypeScript workspace with a destination-blind React flow, activity-specific editorial media, Firestore-backed roster persistence, Google authentication, seed validation, tests, and CI checks. The local one-trip checkpoint also includes a plain-language profile, a caller-only private top five after completion, waiting, immutable social-ballot snapshots, all five post-reveal personal top fives, and immutable final decisions. A finished traveler must keep their private shortlist to themselves until the group reveal; every other person's shortlist and the group tally remain sealed until Dan opens it.

Production preview: <https://lets-go-somewhere-3549f.web.app>. For shipped scope and the remaining one-trip release boundary, see [implementation status](docs/implementation-status.md).

## Repository map

- `docs/` — product, UX, architecture, origin context, and design guidance.
- `seed/` — canonical initial destination and activity content.
- `design-system/` — production visual tokens, CSS contracts, local fonts, and approved logo.
- `assets/` — supplied traveler artwork; approved only for the roster, progress, waiting, and celebratory UI.
- `frontend/` — deployed React/Vite client.
- `backend/` — deployed TypeScript/Cloud Run API and ranking engine.
- `shared/` — shared runtime schemas, safe presentation contracts, and constants.
- `scripts/` — seed validation and operational helpers.

## Start here

- [Product specification](docs/spec.md)
- [User journey map](docs/ux.md)
- [Architecture overview](docs/architecture.md)
- [Project origins and constraints](docs/project-origins-background.md)
- [Documentation index](docs/README.md)
- [Design system](docs/design-system.md)
- [Implementation status](docs/implementation-status.md)
- [Content management guide](docs/content-management.md)
- [Model evaluation report](docs/model-evaluation.md)

## Seed data

`seed/destinations.json` contains the 24 initial destinations and practical trip metadata. `seed/activities.json` contains 120 destination-blind activity cards (five for each destination), each scored across the eight product attributes.

Treat these files as product content: activity wording must preserve destination blindness, and every activity must reference a valid destination and include all eight attributes with integer scores from 0 to 5.

## Implementation order

1. `npm install`
2. `npm run validate:seed && npm test && npm run typecheck && npm run build`
3. For a local demo, run `LGS_TEST_MODE=demo PORT=8788 npm run dev -w backend`, then `LGS_API_ORIGIN=http://127.0.0.1:8788 npm run dev -w frontend` in another terminal. The demo adapter is local-only and is rejected on Cloud Run.

For a no-data visual walkthrough, open `http://127.0.0.1:5173/?fixture=trip-preview`. Its screen picker previews choice cards, profile, atlas, partial/all-five waiting states, reveal, and a personal shortlist without calling the API or recording choices. It is excluded from production builds.

Production uses Firebase Google sign-in and Firestore-backed responses; local development may use the explicitly non-production identity adapter. See [docs/deployment.md](docs/deployment.md) for the deployed environment and release checks.

See [AGENTS.md](AGENTS.md) for contribution standards.
