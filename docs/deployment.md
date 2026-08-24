# Production deployment

## Current environment

- Firebase project: `lets-go-somewhere-3549f`
- Firebase web app: `lets-go-somewhere-web`
- Firestore Native database: `us-east4`
- Cloud Run API: `https://lgs-api-je2llsn3xa-uk.a.run.app`
- Firebase Hosting: <https://lets-go-somewhere-3549f.web.app>
- Firestore rules: browser access is denied; the API is the only data boundary.

Google sign-in is enabled. The deployed Cloud Run service verifies Firebase ID tokens, maps approved verified Google accounts through its `ROSTER_EMAILS` configuration, and persists comparison state plus the reveal gate in Firestore. Never commit identity mappings, Firebase Admin credentials, or deployment secrets.

## Release procedure

The release candidate was deployed on 2026-08-22 as Cloud Run revision
`lgs-api-00009-x8r` and Firebase Hosting version `ab1c50b7b1550cc8`. Both
the pre-deployment and post-deployment count-only preflights were empty, so no
real trip state was created. Follow the hard gates in [the one-trip release
specification](one-trip-release-gates-spec.md) and [operator
runbook](one-trip-runbook.md) for every later change; this summary is not a
license to use production for testing.

1. Run `npm run validate:seed`, `npm test`, `npm run typecheck`, and `npm run build` on the exact candidate commit.
2. Run production's count-only preflight and require it to be empty. Do not use production documents for behavioral smoke testing.
3. Run the sign-in, comparison, resume, atlas, and organizer-reveal smoke suite in a separately provisioned disposable Firebase/GCP environment. A comparison starts a journey, and the guarded production reset intentionally refuses such state.
4. Only after every release gate has recorded a pass, verify that the existing Cloud Run service exposes the `ROSTER_EMAILS` environment-variable name (never its value), then deploy the exact repository source to `lgs-api` with `--source . --project lets-go-somewhere-3549f --region us-east4`. Do not pass flags that replace environment variables, service identity, or IAM. Keep `ROSTER_EMAILS` and Firebase configuration out of source control.
5. Deploy `frontend/dist` to Firebase Hosting with `firebase deploy --only hosting --project lets-go-somewhere-3549f`.
6. Re-run production's count-only preflight and require it to remain empty before sharing the URL with the five travelers.

The full copy-paste-safe command sequence and the rules for handling an
unexpected nonempty preflight are in the [one-trip operator
runbook](one-trip-runbook.md). A nonempty production preflight is a release
stop; do not use the reset command as routine deployment cleanup.

## 2026-08-24 Lightning Round follow-up release

Commit `c1a39bb` deployed the direct-destination Lightning Round to Cloud Run
revision `lgs-api-00013-hsh` and Firebase Hosting. The public API health route
and Hosting URL both returned successfully, with 100% of Cloud Run traffic on
that revision.

Commit `23f83e6` then deployed the verified round-aware navigation revision and
an iPhone Safari comparison-card layout fix to Cloud Run revision
`lgs-api-00014-5sb` and Firebase Hosting. The public API health route and
Hosting URL returned successfully. This was a service/static-client deployment
only: no participant endpoint, preflight, reset, or Firestore write was run.

The original group had already completed its first round and opened its
immutable reveal. Therefore, the historical count-only preflight was not
rerun: it is correctly nonempty and must never be reset. The follow-up stores
only in its isolated `lgsV4Lightning*` collections and does not read, rewrite,
or reset the original journey documents.

## Operational notes

- Cloud Run supplies `K_SERVICE`; its presence forces the Firestore repository so a production restart cannot fall back to process memory.
- The local `X-Demo-User` adapter requires `LGS_TEST_MODE=demo`; `NODE_ENV` alone never enables it. It is always rejected whenever `K_SERVICE` is present, even if a test flag is set accidentally.
- Firebase Hosting rewrites `/v1/**` to the `lgs-api` Cloud Run service; no browser client has direct Firestore access.

## Firebase Emulator Suite

The Emulator Suite has a deliberately isolated project ID, `lgs-emulator-test`; it never uses the default production Firebase project or its data. Firestore Emulator Suite requires a local Java runtime (JDK 11 or newer) in addition to the Firebase CLI.

1. To inspect locally isolated Auth and Firestore, run `npm run emulators:start`. The Emulator UI opens on port 4000, with Auth on 9099 and Firestore on 8081. The non-default Firestore port avoids clashing with the local service commonly occupying 8080.
2. To verify the isolated repository, run `npm run test:emulator`. It invokes `firebase emulators:exec --project lgs-emulator-test`, starts only the local Auth/Firestore emulators, checks the positive `LGS_TEST_MODE=emulator` selection, and exercises atomic concurrent and stale-offer writes against Firestore before tearing the processes down.
3. The normal unit/API suite uses the explicitly selected in-memory demo adapter through `npm test` (`LGS_TEST_MODE=demo`). It cannot access Firestore or a real roster account.

`LGS_TEST_MODE` accepts only `demo` or `emulator`. Do not add it to Cloud Run, Firebase Hosting, or a production environment file. Broader authenticated emulator coverage and the five-browser rehearsal remain separate release tasks.
