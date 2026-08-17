# V1 implementation specification

## Scope

Deliver a runnable TypeScript monorepo for the fixed 2026 five-person trip. It must preserve destination blindness until the group reveal gate, keep ranking authoritative in the backend, derive results only from the eight canonical activity attributes, and use the checked-in seed content.

## Decisions

- React/Vite is the presentation layer; Hono is the local HTTP API.
- `shared` owns Zod schemas and public presentation-safe contracts.
- `backend` owns deterministic V1 Elo-style activity scoring, equal-weight destination aggregation, attributes, pair selection, and stopping rules.
- The checked-in seed data is loaded by the backend only. Comparison payloads omit destination metadata.
- The absence of Firebase configuration and approved account mapping means local development uses an explicitly non-production `X-Demo-User` roster adapter. Production requests must be authenticated by a Firebase verifier before deployment.

## Acceptance criteria

1. `npm test`, `npm run typecheck`, and `npm run build` pass from the root.
2. Seed data validates and every public comparison response is destination-blind.
3. A user can start, select activity cards, see approximate progress, reach a profile after the stopping rule, and see the waiting gate.
4. Ranking, pair selection, stopping, and API validation have deterministic tests.
5. The UI imports the checked-in design-system foundations and is responsive, keyboard operable, and reduced-motion safe.

## Deferred handoff

Firebase Auth, Firestore persistence, Cloud Run/Firebase Hosting configuration, release secrets, and the approved Google email-to-roster mapping remain deployment tasks because the required project identifiers and identities are not present in this repository.
