# V1 implementation specification

**Reconciliation note (2026-08-21):** this historical implementation specification predates the released fixed-32 shortlist. Production now runs `bayes-attribute-shortlist-v1`, not the advanced candidate described in older sections below. The profile, waiting, snapshot-backed results, immutable final decision, transactional persistence, seed-version binding, emulator configuration, release rehearsal, and deployment are complete; see [implementation status](implementation-status.md) and [the content-management guide](content-management.md).

## Scope

Deliver a runnable TypeScript monorepo for the fixed 2026 five-person trip. It must preserve destination blindness until the group reveal gate, keep ranking authoritative in the backend, derive results only from the eight canonical activity attributes, and use the checked-in seed content.

## Decisions

- React/Vite is the presentation layer; Hono is the local HTTP API.
- `shared` owns Zod schemas and public presentation-safe contracts.
- `backend` owns ranking, destination aggregation, attributes, pair selection, and stopping rules. The released production model is the fixed-32 Bayesian attribute shortlist; older Elo and hierarchical implementations are offline reference code.
- The checked-in seed data is loaded by the backend only. Comparison payloads omit destination metadata.
- Local development uses an explicitly non-production `X-Demo-User` roster adapter. Production requests verify Firebase ID tokens and match their verified email against the `ROSTER_EMAILS` deployment variable.

## Acceptance criteria

1. `npm test`, `npm run typecheck`, and `npm run build` pass from the root.
2. Seed data validates and every public comparison response is destination-blind.
3. A user can start, select activity cards, see approximate progress, reach a profile after the stopping rule, and see the waiting gate.
4. Ranking, pair selection, stopping, and API validation have deterministic tests.
5. The UI imports the checked-in design-system foundations and is responsive, keyboard operable, and reduced-motion safe.

## Current implementation status

The Firebase project, Google sign-in, approved roster mapping, Cloud Run API, Firebase Hosting, and Firestore-backed comparison persistence are implemented and deployed. The local adapter remains available only for development and deterministic tests.

Acceptance criteria 1, 2, 3, 4, and 5 are implemented in the local one-trip checkpoint. The advanced inference, uncertainty, and information-gain upgrade is also required before the actual group run; its current candidates remain fail-closed after OT-19 evaluation. See [implementation status](implementation-status.md) for the release boundary.
