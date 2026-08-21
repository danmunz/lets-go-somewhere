# V1 baseline implementation review — historical

This was the original local implementation review. Its former Firebase/Auth/Firestore deployment blocker is resolved and the document is retained as a baseline rather than a statement of current release status. The current one-trip code review is [one-trip-code-review.md](one-trip-code-review.md); its must-fix findings are resolved. The released model is the fixed-32 Bayesian shortlist, and the authenticated rehearsal is complete.

## Resolved during review

- `BUG-001` — Shared package builds before seed and test execution, avoiding an invalid workspace entry-point failure.
- `BUG-002` — Invalid JSON comparison bodies return a validation response instead of a server error.
- `SEC-001` — The local roster adapter is rejected under `NODE_ENV=production`; production authentication requires Firebase.
- `A11Y-001` — The document declares its language, viewport, semantic buttons, labelled progress, focus styling, and reduced-motion support.

## Current release validation

The deployed app includes Firebase Google authentication, Firestore-backed comparison and reveal persistence, Cloud Run, Firebase Hosting, activity-specific editorial media, a completion-gated map atlas, caller-only private shortlists, and a group-results API. The fixed-32 shortlist verification, authenticated five-identity Emulator rehearsal, focused literal-browser flow, disposable-environment smoke, visual/accessibility review, and final production preflight have passed.

Use [implementation status](implementation-status.md) for the current gaps and release boundary.
