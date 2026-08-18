# Persistent project context

## Current state

- The repository was initialized on 2026-08-17.
- Product, UX, architecture, and origin documentation are available under `docs/`.
- Seed content contains 24 destinations and 120 destination-blind activities.
- The TypeScript workspace, CI checks, Cloud Run API, Firebase Hosting frontend, Google roster authentication, and Firestore persistence are implemented and deployed.
- `design-system/` is now the visual source of truth; it contains tokens, base styles, component contracts, and the product logo.
- `X-Demo-User` remains a local/test-only adapter and is rejected in production. Cloud Run detects its `K_SERVICE` runtime and persists each roster member's comparisons, outstanding pair, and reveal gate in Firestore (`lgsV4Users`, `lgsV4State/reveal`) so restarts cannot erase a trip.
- Firebase project `lets-go-somewhere-3549f`, web app `lets-go-somewhere-web`, and Firestore Native in `us-east4` are provisioned. The production frontend is `https://lets-go-somewhere-3549f.web.app`; the Cloud Run API is `lgs-api`.

## Key guardrails

- Destination blindness is the central product requirement during comparisons, with one accepted tradeoff: destination photography may be used as a soft visual cue. Names, countries, flags, airport codes, maps, scores, ranks, and photo-credit metadata remain hidden while playing. Once a participant completes the game, they may browse an unranked named destination atlas with general context, real map placement, and credited photography; personal and group outcomes remain embargoed until the result reveal.
- The ranking engine belongs in `backend/`; shared contracts belong in `shared/`.
- Group results are revealed only after all five fixed roster members finish and Dan opens the gate. The ranking is the mean of individually normalized destination scores minus a 0.25 standard-deviation polarization penalty. The social reveal shows only each member's top three, never activity-by-activity choices.
- `seed/activity-media.json` is the private credit catalog for opaque comparison-card paths. Comparison responses contain no destination, coordinate, score, rank, or credit field; destination names, maps, galleries, and credits are exposed only in the completion-gated atlas and post-gate reveal.
- `assets/` contains supplied traveler artwork approved only for roster, progress, waiting, and celebratory UI. Never use it in destination-blind activity cards; the logo and all visual tokens live in `design-system/`.
