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

1. Run `npm run validate:seed`, `npm test`, `npm run typecheck`, and `npm run build`.
2. Deploy backend changes to the `lgs-api` Cloud Run service in `us-east4`; keep `ROSTER_EMAILS` and Firebase configuration out of source control.
3. Deploy `frontend/dist` to Firebase Hosting with `firebase deploy --only hosting --project lets-go-somewhere-3549f`.
4. Smoke-test a production sign-in, one comparison, completion-gated atlas access, and the group-reveal authorization behavior.

## Operational notes

- Cloud Run supplies `K_SERVICE`; its presence forces the Firestore repository so a production restart cannot fall back to process memory.
- The local `X-Demo-User` adapter is intentionally rejected in production.
- Firebase Hosting rewrites `/v1/**` to the `lgs-api` Cloud Run service; no browser client has direct Firestore access.
