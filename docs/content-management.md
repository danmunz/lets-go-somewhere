# Content management guide

This repository is the content source of truth for the fixed five-person trip. There is intentionally no organizer/content-editing UI: make a reviewed, version-controlled change, validate it, and deploy a new build. Never edit live Firestore trip state to change copy or seed content.

## Where content lives

| Content | File or directory | What to edit |
| --- | --- | --- |
| Destination names, countries, taglines, practical context, coordinates, galleries | `seed/destinations.json` | One destination record. Keep `id` stable; update `gallery`, coordinates, weather, travel effort, and editorial copy together. |
| Blind comparison titles, descriptions, and eight preference attributes | `seed/activities.json` | One activity record. Keep `id` and `destinationId` stable. Do not put a place name, country, flag, airport code, or explicit location clue in the title or description. |
| Activity-card image credits and alt text | `seed/activity-media.json` | The private credit catalog keyed by activity ID. `sourceUrl`, photographer, profile URL, and alt text stay out of comparison API responses. |
| Public optimized activity-card images | `frontend/public/media/cards/` | The local opaque image path referenced by `activities.json`. Do not add credit text or destination IDs to filenames. |
| Public destination gallery images | `frontend/public/media/destinations/` (or the current gallery path recorded in the destination seed) | Three local optimized images per destination. Keep the seed path, alt text, and credit metadata synchronized. |
| Roster names, roles, accents, and traveler art mapping | `frontend/src/main.tsx` and `frontend/src/app.css` | The fixed roster presentation only. Account authorization remains backend-owned. |
| Welcome, character-select, comparison, atlas, waiting, and reveal copy | `frontend/src/main.tsx` | The route-level screen composition and most user-facing microcopy live here. Keep state-dependent copy destination-safe before completion/reveal. |
| Profile synthesis and controlled explanation language | `backend/src/model/profile.ts` | `ATTRIBUTE_COPY`, profile headlines, themes, and evidence labels. This is server-owned and must remain destination-free. |
| API errors and gate copy | `backend/src/app.ts`, `backend/src/dto/one-trip.ts`, `frontend/src/api.ts` | Change the server-safe error contract and client recovery intent together; add a focused test. |
| Profile, waiting, results, verdict, and decision copy | `frontend/src/screens/` and `frontend/src/components/` | Screen-specific post-completion and post-reveal language. Raw activity choices must never be rendered here. |
| Typography, colors, spacing, cards, map, roster, and motion styling | `design-system/` and `frontend/src/app.css` | Use design tokens and existing component classes before adding a one-off rule. Respect reduced motion and 44px touch targets. |
| Logo, roster art, and approved non-destination illustrations | `design-system/assets/` and `assets/images/` | Replace only with approved transparent artwork. Traveler art never belongs in destination-blind activity cards. |
| Model labels, progress phases, and confidence copy | `backend/src/model/stopping.ts`, `backend/src/model/profile.ts`, and `frontend/src/main.tsx` | Change the model contract and UI copy together; do not imply certainty the model has not earned. |

## Common edits

### Change an activity card

1. Edit the matching record in `seed/activities.json`.
2. If the image changes, update its opaque `imageUrl` and the matching private record in `seed/activity-media.json`.
3. Put the optimized local image in `frontend/public/media/cards/`.
4. Check that the wording describes an experience rather than advertising a destination. Geographic recognition is an accepted soft cue, but explicit names and metadata are not.
5. Run `npm run validate:seed`, `npm test`, and `npm run build`.

### Change a destination or atlas gallery

1. Edit the destination record in `seed/destinations.json`.
2. Preserve exact longitude/latitude and the three-image gallery contract.
3. Keep photographer and source URLs in the destination gallery metadata; they are displayed only in the completion-gated atlas/reveal.
4. Verify the map/list/drawer selection still works and that every image has useful alt text.
5. Run seed validation and the atlas/frontend tests before deploying.

### Change screen copy or microcopy

Most route copy is colocated in `frontend/src/main.tsx`. The comparison progress milestones are the `progressMessage` function near the top of that file. Profile and waiting copy are in `frontend/src/screens/ProfileScreen.tsx` and `WaitingScreen.tsx`; verdict and final-decision copy are in `VerdictScreen.tsx`, `VerdictAdditions.tsx`, and `FinalDecisionDialog.tsx`. Update the relevant focused test when copy is asserted exactly.

### Change model/explanation copy

Do not edit model output in the browser. Update controlled server copy in `backend/src/model/profile.ts` or the typed DTO builders, then test that the response contains no destination IDs, names, scores, ranks, covariance, or raw activity history before the relevant gate.

## Destination-blind content rules

Before a participant completes the comparison round, cards may contain an activity-matched photograph as an intentionally accepted soft cue. They must not expose destination names, countries, flags, airport codes, map UI, coordinates, scores, ranks, or photographer/source credits. Comparison DTOs should contain only the activity ID, title, description, and opaque local image path.

After completion, the atlas may show named destinations, real map placement, galleries, practical context, and credits. Personal and group outcomes remain sealed until Dan opens the reveal. After reveal, show the approved five-place `5/4/3/2/1` points tally, every member's full personal top five, stored evidence-backed social insights, finalist context, and the immutable final decision; never display raw activity-by-activity votes, normalized group utilities, or group confidence claims.

## Content validation and release workflow

Use this sequence for a content change:

```sh
npm run validate:seed
npm test
npm run typecheck
npm run build
git diff --check
```

Seed validation checks the 24 destinations, 120 activities, destination references, integer attributes, local media paths, three-image galleries, coordinates, alt text, and private credit metadata. Tests cover destination-blind serializers, gate behavior, ranking determinism, and frontend fallbacks. The production deployment and one-trip reset/reveal procedure are in [deployment.md](deployment.md) and the [one-trip runbook](one-trip-runbook.md) once that release gate is completed.

## What is not editable through content files

The roster, authentication mapping, Firestore persistence, ranking model, stopping policy, reveal gate, and final-decision rules are application behavior. Changes belong in backend/shared/frontend code with tests and an architecture or ADR update when the contract changes. Do not use seed edits to change those behaviors, and do not change a live trip's seed after the first participant starts: the persisted seed digest will intentionally seal the journey on mismatch.
