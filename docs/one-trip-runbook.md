# One-trip operator runbook

**Status:** partially rehearsed. The isolated Auth/Firestore Emulator transaction suite passes locally; the five-person browser rehearsal and final release verification remain gates. This document contains procedures, not evidence that the full release has passed.

## Before touching the real trip

1. Confirm the intended commit, seed digest, model decision, and deployment identifiers in [implementation status](implementation-status.md).
2. Run `npm run validate:seed`, `npm test`, `npm run typecheck`, and `npm run build`.
3. Run `npm run audit:model-policy` and the full model evaluation, then confirm that the advanced model ADR is **PROMOTED**. If ADR 0003 says **DO NOT PROMOTE**, stop: the hosted app is not ready for the real one-shot decision.
4. Use only approved Google accounts from the private deployment configuration. Never put roster emails, tokens, service-account JSON, or `ROSTER_EMAILS` values in this repository.
5. Record the exact seed digest and deployed commit in the private trip notes, not in source control.

## Local emulator rehearsal

With a JDK 11+ available, run:

```sh
npm run emulators:start
# in another terminal
npm run test:emulator
```

The emulator uses the isolated project ID `lgs-emulator-test`, Auth on port 9099, Firestore on port 8081, and the Emulator UI on port 4000. The non-default Firestore port avoids clashing with the local service commonly occupying 8080. `PATH="/opt/homebrew/opt/openjdk/bin:$PATH" npm run test:emulator` passed on 2026-08-19 with seven tests: explicit emulator routing, concurrent and stale pending claims, racing reveal creation, immutable snapshot reload, immutable final-decision conflict, and redacted v2-result serialization from a Firestore-backed snapshot. The intentional racing transactions may log Firestore lock-retry warnings; the test passes only after the repository returns one identical stored snapshot/decision. Do not point these commands at the production project. The separate five-identity browser rehearsal remains required.

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

## Deploying a verified release

Only after fixed-shortlist verification, emulator/E2E, visual QA, and independent review pass:

```sh
npm run validate:seed
npm test
npm run typecheck
npm run build
gcloud run deploy lgs-api --region us-east4
firebase deploy --only hosting --project lets-go-somewhere-3549f
```

Use the repository's existing deployment configuration and keep secrets in the configured service environment. Smoke-test sign-in, one comparison, resume, completion-gated atlas access, and reveal authorization. Do not expose or log tokens or roster configuration.

## Reset and recovery

Before anyone starts, run the dedicated count-only preflight against an explicitly selected project. It uses Application Default Credentials and refuses to inspect when the credential-selected project differs from the command target. It never prints document bodies, comparisons, addresses, or tokens.

```sh
npm run preflight:one-trip -- --project lets-go-somewhere-3549f
```

It exits successfully only when the reveal is `closed` and there are zero started users, completed users, snapshots, and decisions. `open-v1`, `missing-snapshot`, and `invalid` are hard stops. In particular, preserve an `open-v1` snapshot read-only; do not manufacture a v2 replacement or reset it without an explicit group decision.

The guarded reset is only for untouched, disposable preflight debris. Generate and retain a private export reference outside the repository, then run the exact command below. The `private:` reference is included in the count-only receipt, so use an opaque locally generated value rather than a document ID, email address, or secret.

```sh
export LGS_EXPORT_REF="private:$(openssl rand -hex 16)"
npm run reset:one-trip -- --project lets-go-somewhere-3549f --confirm-trip-reset --export-ref "$LGS_EXPORT_REF"
```

The reset re-runs preflight before deletion, refuses after any started traveler or opened/missing/invalid reveal, deletes only documents in `lgsV4Users`, `lgsV4State/reveal`, `lgsV4ResultSnapshots`, and `lgsV4FinalDecisions`, then re-runs preflight and succeeds only on the empty state. Store its receipt (project, commit, seed digest, UTC time, export reference, and count-only post-reset state) in private trip notes. Never reset a live trip to fix content, rerun a model, or recover a user without an explicit group decision. A seed-version mismatch is intentionally fail-closed: restore the original checked-in seed rather than mutating the live journey.

After reveal, snapshots and final decisions are immutable. Do not delete or rewrite them as a content operation. For an incident, preserve the snapshot ID, seed digest, model version, request timestamp, and safe error code, then stop and investigate using the deployment/run logs.
