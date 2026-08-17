# V1 implementation review

## Summary

- Files reviewed: workspace, shared contracts, backend ranking/API, frontend flow, CI, and documentation.
- Checks: seed validation, six deterministic unit/API tests, strict type checking, production build, diff whitespace check, and browser smoke test.
- Specification alignment: local V1 passes the destination-blind comparison, backend-owned ranking, profile, embargo, organizer reveal, and individual top-five requirements.

## Resolved during review

- `BUG-001` — Shared package builds before seed and test execution, avoiding an invalid workspace entry-point failure.
- `BUG-002` — Invalid JSON comparison bodies return a validation response instead of a server error.
- `SEC-001` — The local roster adapter is rejected under `NODE_ENV=production`; production authentication requires Firebase.
- `A11Y-001` — The document declares its language, viewport, semantic buttons, labelled progress, focus styling, and reduced-motion support.

## Accepted deployment blocker

Firebase/Auth configuration, Firestore persistence, Cloud Run/Firebase Hosting provisioning, and Google-account roster assignments require credentials and account decisions not present in the repository. They are tracked as `TASK-008` in [tasks.md](tasks.md).
