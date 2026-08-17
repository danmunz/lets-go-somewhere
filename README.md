# Let's Go Somewhere

**Let's Go Somewhere** is a destination-blind group-trip preference game. Participants make quick choices between specific experiences; the app then reveals which destinations best match their preferences and where the group has the strongest overlap.

The first use case is a five-person trip in November 2026, but the product is designed to support many groups and trip types.

## Status

The repository is prepared for implementation. Product documentation and version-controlled seed content are complete; the frontend, backend, Firebase configuration, and CI workflows have not been implemented yet.

## Repository map

- `docs/` — product, UX, architecture, origin context, and architecture decisions.
- `seed/` — canonical initial destination and activity content.
- `assets/` — design-reference assets supplied during discovery; not production UI assets by default.
- `frontend/` — future React/Vite client.
- `backend/` — future TypeScript API and ranking engine.
- `shared/` — future shared types, schemas, and constants.
- `scripts/` — future operational scripts, including Firestore seeding.

## Start here

- [Product specification](docs/spec.md)
- [User journey map](docs/ux.md)
- [Architecture overview](docs/architecture.md)
- [Project origins and constraints](docs/project-origins-background.md)
- [Documentation index](docs/README.md)
- [Design system](docs/design-system.md)

## Seed data

`seed/destinations.json` contains the 24 initial destinations and practical trip metadata. `seed/activities.json` contains 120 destination-blind activity cards (five for each destination), each scored across the eight product attributes.

Treat these files as product content: activity wording must preserve destination blindness, and every activity must reference a valid destination and include all eight attributes with integer scores from 0 to 5.

## Implementation order

1. Establish the TypeScript workspace and shared schemas.
2. Implement and test the ranking engine against the seed data.
3. Build the destination-blind comparison flow.
4. Add Firebase authentication, persistence, and group results.

See [AGENTS.md](AGENTS.md) for contribution standards.
