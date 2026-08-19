import {
  OneTripOperatorError,
  createFirestoreOneTripOperatorRepository,
  formatPreflightReport,
  inspectOneTrip,
  parsePreflightArgs,
  reportIsEmpty,
} from '../backend/src/one-trip-operator.js';

async function main(): Promise<void> {
  const { projectId } = parsePreflightArgs(process.argv.slice(2));
  // State the target before the repository makes its first Firestore read.
  console.log(JSON.stringify({ targetProject: projectId, phase: 'inspection' }));
  const report = await inspectOneTrip(createFirestoreOneTripOperatorRepository(), projectId);
  console.log(formatPreflightReport(report));
  if (!reportIsEmpty(report)) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof OneTripOperatorError ? error.message : 'One-trip preflight could not complete safely.');
  process.exitCode = 1;
});
