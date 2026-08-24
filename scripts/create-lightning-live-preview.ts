/**
 * Generates a local visual-QA fixture from the completed Lightning Round.
 *
 * This is intentionally read-only with respect to Firestore. It does not call
 * ensureLightningRound(), reveal creation, reset tooling, or any HTTP route.
 * Its only write is the ignored frontend/public/__local JSON file on this Mac.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  LIGHTNING_WORKING_ORDER_RESULT_VERSION,
  lightningGroupResultsResponseSchema,
  lightningPersonalResultsSchema,
  type LightningGroupResultsResponse,
  type LightningPersonalResults,
  type RosterUser,
} from '@lgs/shared';
import { ROSTER } from '../backend/src/store.js';
import { buildLightningWorkingOrder, fitDirectDestinationBradleyTerry, tallyLightningWorkingOrderBorda } from '../backend/src/lightning/direct-model.js';
import { getAllLightningStates, lightningContentVersion, lightningDestinations } from '../backend/src/lightning/store.js';

const requiredFlag = '--read-live-lightning-data';
const outputPath = resolve(process.cwd(), 'frontend/public/__local/lightning-live-preview.json');

function assertReadOnlyInvocation() {
  if (!process.argv.includes(requiredFlag)) {
    throw new Error(`Refusing to read live data without ${requiredFlag}.`);
  }
  if (process.env.NODE_ENV !== 'production' || !process.env.GOOGLE_CLOUD_PROJECT) {
    throw new Error('Set NODE_ENV=production and GOOGLE_CLOUD_PROJECT before reading the deployed Firestore project.');
  }
}

function toComparisons(state: Awaited<ReturnType<typeof getAllLightningStates>>[RosterUser]) {
  return state.comparisons.map(({ destinationA, destinationB, winner }) => ({ destinationA, destinationB, winner }));
}

function buildPersonal(user: RosterUser, state: Awaited<ReturnType<typeof getAllLightningStates>>[RosterUser]): LightningPersonalResults {
  const fit = fitDirectDestinationBradleyTerry(lightningDestinations, toComparisons(state));
  if (!fit.ok) throw new Error(`The local read-only fit failed for ${user}: ${fit.message}`);
  const ranking = buildLightningWorkingOrder(fit, `${lightningContentVersion}:${user}`);
  return lightningPersonalResultsSchema.parse({
    resultVersion: LIGHTNING_WORKING_ORDER_RESULT_VERSION,
    modelVersion: 'bayes-direct-destination-v1',
    contentVersion: lightningContentVersion,
    ranking,
    destinations: lightningDestinations,
    comparisonTrail: state.comparisons.map((comparison) => ({
      order: comparison.ordinal,
      winnerId: comparison.winner,
      loserId: comparison.winner === comparison.destinationA ? comparison.destinationB : comparison.destinationA,
      phase: comparison.ordinal <= 48 ? 'core' : 'tie-breakers',
    })),
    vetoes: { submitted: Boolean(state.vetoSubmittedAt), destinationIds: state.vetoedDestinationIds ?? [] },
  });
}

function buildGroup(personalByUser: Record<RosterUser, LightningPersonalResults>): LightningGroupResultsResponse {
  const rows = tallyLightningWorkingOrderBorda(
    lightningDestinations.map(({ id }) => id),
    ROSTER.map((user) => personalByUser[user].ranking.workingOrder),
  );
  return lightningGroupResultsResponseSchema.parse({
    snapshotId: 'local-live-preview-not-a-snapshot',
    resultVersion: LIGHTNING_WORKING_ORDER_RESULT_VERSION,
    modelVersion: 'bayes-direct-destination-v1',
    contentVersion: lightningContentVersion,
    group: rows.map((row) => ({
      rankStart: row.startRank,
      rankEnd: row.endRank,
      destinationId: row.destinationId,
      bordaPoints: row.points,
      firstPlaceVotes: row.firstPlaceVotes,
      topFiveSupport: row.topFiveSupport,
      supporters: ROSTER.filter((user) => personalByUser[user].ranking.workingOrder.slice(0, 5).includes(row.destinationId)),
      vetoedBy: ROSTER.filter((user) => personalByUser[user].vetoes.destinationIds.includes(row.destinationId)),
    })),
    members: ROSTER.map((user) => ({
      user,
      workingOrder: personalByUser[user].ranking.workingOrder,
      clearBreaksAfter: personalByUser[user].ranking.clearBreaksAfter,
      topFiveGroups: personalByUser[user].ranking.topFiveGroups,
      vetoedDestinationIds: personalByUser[user].vetoes.destinationIds,
    })),
    destinations: lightningDestinations,
  });
}

async function main() {
  assertReadOnlyInvocation();
  const states = await getAllLightningStates();
  const personalByUser = Object.fromEntries(ROSTER.map((user) => [user, buildPersonal(user, states[user])])) as Record<RosterUser, LightningPersonalResults>;
  const payload = {
    generatedAt: new Date().toISOString(),
    source: 'local read-only production Lightning Round preview',
    personalByUser,
    group: buildGroup(personalByUser),
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  process.stdout.write(`Wrote ignored local Lightning preview: ${outputPath}\n`);
}

void main();
