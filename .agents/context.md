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
- Group results are revealed only after all five fixed roster members finish and Dan opens the gate. Each person's inferred ranks one through five contribute `5, 4, 3, 2, 1` points, respectively; lower ranks contribute zero. Ties resolve by first-place votes, then top-five appearances, then remain shared. The social reveal shows all five personal top fives and evidence-backed overlap/divergence notes, never activity-by-activity choices or normalized group utilities.
- `seed/activity-media.json` is the private credit catalog for opaque comparison-card paths. Comparison responses contain no destination, coordinate, score, rank, or credit field; destination names, maps, galleries, and credits are exposed only in the completion-gated atlas and post-gate reveal.
- `assets/` contains supplied traveler artwork approved only for roster, progress, waiting, and celebratory UI. Never use it in destination-blind activity cards; the logo and all visual tokens live in `design-system/`.

## 2026-08-19 one-trip release checkpoint

- Commit `91dc81c` contains the local profile, waiting lobby, snapshot-backed personal/group results, immutable final decisions, seed-version sealing, emulator configuration, and hardened frontend recovery/fallbacks. It is not yet a production release.
- The advanced model candidates remain offline-only. The compact candidate (`bt-hierarchical-laplace-v2-compact`) completed 15,000 fixed-schedule fits with 512 draws and 94.20% aggregate interval coverage, but had zero stable-top-five stops and did not certify the adaptive information-gain policy or payload redaction. `1d2c084` adds a faithful, resumable 3,000-trajectory full-policy evidence harness; its one-trajectory smoke and deterministic replay pass, but the multi-hour complete audit has not run. Keep production on `elo-coverage-v1` until that full policy replay passes and ADR 0003 is promoted.
- The independent transparent-social-ballot audit (`fbae847`), guarded count-only preflight/reset implementation (`4ce95f0`), seven-case Firestore Emulator persistence proof (`a785de3`), and fixture-based desktop/mobile visual/accessibility review (`3f101e4`, `06551f8`) have passed locally. They do not replace the five-identity browser rehearsal or advanced-model promotion gate.
- The operator procedure is documented in `docs/one-trip-runbook.md`. The reset refuses any started journey, so behavioral smoke testing must use a separately provisioned disposable Firebase/GCP environment; production preflight is count-only and must remain empty until the real trip starts.
- Content editors should use `docs/content-management.md`; there is no live content-editing UI for this fixed trip.
