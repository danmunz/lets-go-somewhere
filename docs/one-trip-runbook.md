# One-trip operator runbook

**Status:** partially rehearsed. The isolated Auth/Firestore Emulator transaction suite and authenticated five-identity API rehearsal pass locally; a literal browser pass has covered roster, briefing, one blind comparison, help return, and desktop/mobile atlas fallback. A disposable Cloud Run/Firebase/Firestore project also passed health, Hosting routing, disposable approved-account authentication, one Firestore-backed blind comparison, response redaction, and count-only state inspection before being deletion-requested. The complete five-identity visual record, remaining behavioral-smoke coverage, deployment, and second production preflight remain gates. This document contains procedures, not evidence that the full release has passed.

## Before touching the real trip

1. Confirm the intended commit, seed digest, model decision, and deployment identifiers in [implementation status](implementation-status.md).
2. Run `npm run validate:seed`, `npm test`, `npm run typecheck`, and `npm run build`.
3. Confirm ADR 0003 names `bayes-attribute-shortlist-v1` with `fixed-32-boundary-v1` as the release candidate. The old hierarchical audit is historical rejection evidence only; do **not** wait for it to be promoted. Instead, record the bounded fixed-shortlist checks: deterministic 32-round replay, zero representative-fixture fit failures, coverage by question 24, final-eight boundary selection when eligible, DTO redaction, and persisted-shortlist stability.
4. Use only approved Google accounts from the private deployment configuration. Never put roster emails, tokens, service-account JSON, or `ROSTER_EMAILS` values in this repository.
5. Record the exact seed digest and deployed commit in the private trip notes, not in source control.

## Local emulator rehearsal

With a JDK 11+ available, run:

```sh
npm run emulators:start
# in another terminal
npm run test:emulator
```

The emulator uses the isolated project ID `lgs-emulator-test`, Auth on port 9099, Firestore on port 8081, and the Emulator UI on port 4000. The non-default Firestore port avoids clashing with the local service commonly occupying 8080. `PATH="/opt/homebrew/opt/openjdk/bin:$PATH" npm run test:emulator` now runs eight checks: explicit emulator routing; concurrent and stale pending claims; racing immutable reveal creation; immutable snapshot reload; immutable final-decision conflict; redacted v2-result serialization; and the authenticated five-identity route rehearsal. The latter creates only disposable `@rehearsal.invalid` Auth Emulator accounts and verifies mismatch recovery, refresh/resume, duplicate rejection, all five fixed 32-choice rounds, completion gates, organizer-only reveal, snapshot parity, and stale-tab decision safety through the real API. The intentional racing transactions may log Firestore lock-retry warnings; the test passes only after the repository returns one identical stored snapshot/decision. Do not point these commands at the production project. Literal browser screenshots remain required.

## Browser rehearsal

Use five isolated Auth Emulator identities mapped to Dan, John, Matt, Peter, and James. Do not automate real Google OAuth or use a real roster account. Verify:

- character/account mismatch is clear and recoverable;
- refresh during a round resumes the current unexpired pair;
- stale and duplicate submissions do not append twice;
- progress truthfully reads `N of 32 choices` and the selected model is `bayes-attribute-shortlist-v1`;
- completion reaches profile, atlas, and completion-only waiting states;
- map failure leaves the named destination list/gallery usable;
- Dan can open the reveal only after all five are complete;
- personal/group results use the same immutable snapshot ID;
- final decision accepts a finalist or `need-more-research` once and rejects mutation afterward;
- keyboard focus, reduced motion, desktop, mobile, photo fallback, and destination-blind comparison redaction all remain correct.

Capture screenshots outside the repository and record the browser, viewport, commit, seed digest, and pass/fail notes in the private rehearsal record.

### Browser-only Auth Emulator switch

The frontend has a deliberately development-only browser rehearsal route. With
the API already pointed at the isolated Auth and Firestore emulators and given
the matching disposable roster aliases, serve Vite with
`VITE_LGS_AUTH_EMULATOR=1`, `VITE_LGS_EMULATOR_PROJECT_ID=lgs-emulator-test`,
and `VITE_LGS_AUTH_EMULATOR_HOST=127.0.0.1:9099`. The character-selection
continue button then signs in only the matching disposable `.invalid` account;
it never invokes Google OAuth. The switch requires both Vite development mode
and an explicit `=1`, so it cannot enable in a production build. Do not set it
in Hosting or Cloud Run configuration.

## Deploying a verified release

Only after fixed-shortlist verification, the five-identity browser rehearsal,
visual QA, and independent review pass. The release manager must use the exact
candidate commit that produced those records; do not rebuild from an uncommitted
worktree or substitute a later commit.

First, record production's **read-only** count-only preflight. It must be empty
before any deployment. This command does not start a trip or alter data:

```sh
npm run preflight:one-trip -- --project lets-go-somewhere-3549f
```

Also verify the deployed service still has the expected environment-variable
*name* without printing its value. The output must include `ROSTER_EMAILS`.

```sh
gcloud run services describe lgs-api \
  --project lets-go-somewhere-3549f \
  --region us-east4 \
  --format='value(spec.template.spec.containers[0].env.name)'
```

Then build and deploy from the repository root:

```sh
npm run validate:seed
npm test
npm run typecheck
npm run build
gcloud run deploy lgs-api \
  --source . \
  --project lets-go-somewhere-3549f \
  --region us-east4
firebase deploy --only hosting --project lets-go-somewhere-3549f
npm run preflight:one-trip -- --project lets-go-somewhere-3549f
```

`gcloud run deploy --source .` updates the source image while retaining the
existing service configuration unless a configuration flag is supplied. Do not
add `--set-env-vars`, `--clear-env-vars`, `--service-account`, IAM flags, or a
different project/region to this command during this one-trip release. Keep
secrets in the configured service environment. Run behavioral smoke only in
the separately provisioned disposable Firebase/GCP environment; production
stays untouched apart from empty, count-only preflight. Do not expose or log
tokens or roster configuration.

The 2026-08-20 disposable smoke used an explicitly temporary labelled project
with a project-scoped USD 4 alert budget. It verified live health, Hosting
routing, disposable approved-account authentication, one Firestore-backed blind
comparison, comparison redaction, and count-only state inspection, then the
entire temporary project was deletion-requested. Treat that as plumbing
evidence only: it does not replace the remaining five-identity browser record
or broader behavioral-smoke checks.

The final preflight must again report `empty: true`. Record only its count-safe
receipt, the deployed revision, Hosting release timestamp, commit, and seed
digest in private trip notes. If either preflight is nonempty or invalid, stop:
do not use the reset command as a release cleanup shortcut.

## Reset and recovery

Before anyone starts, run the dedicated count-only preflight against an explicitly selected project. It uses Application Default Credentials and refuses to inspect when the credential-selected project differs from the command target. It never prints document bodies, comparisons, addresses, or tokens.

If the preflight reports that Application Default Credentials are unavailable or
that their selected project differs from the target, set them up explicitly for
this project before retrying:

```sh
gcloud auth application-default login --project lets-go-somewhere-3549f
```

This opens Google's consent flow for the operator's account; it does not change
Cloud Run, Firebase Hosting, Firestore data, or the saved default project for
the regular `gcloud` CLI. Re-run the count-only command below afterwards.

```sh
npm run preflight:one-trip -- --project lets-go-somewhere-3549f
```

It exits successfully only when the reveal is `closed` and there are zero started users, completed users, snapshots, and decisions. `open-v1`, `missing-snapshot`, and `invalid` are hard stops. In particular, preserve an `open-v1` snapshot read-only; do not manufacture a v2 replacement or reset it without an explicit group decision.

The guarded reset is only for confirmed untouched pre-start debris, never for a
smoke test or a real trip. If the preflight has any started user, completed user,
opened/missing/invalid reveal, stop and obtain a group decision rather than
trying a reset. Only when the preflight is `closed` with zero started and
completed users may an operator choose to clear pre-start documents. Generate
and retain a private export reference outside the repository, then run the
exact command below. The `private:` reference is included in the count-only
receipt, so use an opaque locally generated value rather than a document ID,
email address, or secret.

```sh
export LGS_EXPORT_REF="private:$(openssl rand -hex 16)"
npm run reset:one-trip -- --project lets-go-somewhere-3549f --confirm-trip-reset --export-ref "$LGS_EXPORT_REF"
```

The reset re-runs preflight before deletion, refuses after any started traveler or opened/missing/invalid reveal, deletes only documents in `lgsV4Users`, `lgsV4State/reveal`, `lgsV4ResultSnapshots`, and `lgsV4FinalDecisions`, then re-runs preflight and succeeds only on the empty state. Store its receipt (project, commit, seed digest, UTC time, export reference, and count-only post-reset state) in private trip notes. Never reset a live trip to fix content, rerun a model, or recover a user without an explicit group decision. A seed-version mismatch is intentionally fail-closed: restore the original checked-in seed rather than mutating the live journey.

After reveal, snapshots and final decisions are immutable. Do not delete or rewrite them as a content operation. For an incident, preserve the snapshot ID, seed digest, model version, request timestamp, and safe error code, then stop and investigate using the deployment/run logs.
