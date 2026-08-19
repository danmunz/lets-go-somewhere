import { execFileSync } from 'node:child_process';
import { getSeedVersion } from '../backend/src/model/snapshot.js';
import {
  OneTripOperatorError,
  createFirestoreOneTripOperatorRepository,
  formatPreflightReport,
  parseResetArgs,
  resetUntouchedOneTrip,
} from '../backend/src/one-trip-operator.js';

function currentCommit(): string {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return 'unknown'; }
}

async function main(): Promise<void> {
  const { projectId, exportRef } = parseResetArgs(process.argv.slice(2));
  console.log(JSON.stringify({ targetProject: projectId, phase: 'guarded-reset-inspection' }));
  const report = await resetUntouchedOneTrip(createFirestoreOneTripOperatorRepository(), projectId, exportRef);
  console.log(JSON.stringify({ receipt: 'one-trip-reset', targetProject: projectId, commit: currentCommit(), seedDigest: getSeedVersion(), utc: new Date().toISOString(), exportRef, postReset: JSON.parse(formatPreflightReport(report)) }));
}

main().catch((error: unknown) => {
  console.error(error instanceof OneTripOperatorError ? error.message : 'One-trip reset could not complete safely.');
  process.exitCode = 1;
});
