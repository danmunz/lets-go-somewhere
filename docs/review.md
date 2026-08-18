# V1 baseline implementation review — historical

This was the original local implementation review. Its former Firebase/Auth/Firestore deployment blocker is resolved and the document is retained as a baseline rather than a statement of current release status.

## Resolved during review

- `BUG-001` — Shared package builds before seed and test execution, avoiding an invalid workspace entry-point failure.
- `BUG-002` — Invalid JSON comparison bodies return a validation response instead of a server error.
- `SEC-001` — The local roster adapter is rejected under `NODE_ENV=production`; production authentication requires Firebase.
- `A11Y-001` — The document declares its language, viewport, semantic buttons, labelled progress, focus styling, and reduced-motion support.

## Current release validation

The deployed app now includes Firebase Google authentication, Firestore-backed comparison and reveal persistence, Cloud Run, Firebase Hosting, activity-specific editorial media, a completion-gated map atlas, and a group-results API. The current automated suite covers deterministic ranking and API boundaries in the local adapter; Firestore-emulator and authenticated multi-roster end-to-end coverage remain hardening work.

Use [implementation status](implementation-status.md) for the current gaps and release boundary.
