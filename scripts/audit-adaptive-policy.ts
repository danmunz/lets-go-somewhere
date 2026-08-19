/**
 * Resumable, deterministic full-policy evidence runner.
 *
 * This script intentionally calls the candidate's real fit, selector,
 * posterior, and stopping functions. It is not a faster substitute for the
 * server path and it cannot promote a model by itself. Its artifacts are
 * ignored local evidence so a long 200-seed run can be split across machines
 * or resumed after interruption without silently mixing configurations.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { dirname, resolve } from 'node:path';
import { activitySchema, BLIND_ACTIVITY_FORBIDDEN_FIELDS, destinationSchema, nextComparisonResponseSchema, toSafeActivity, type Activity, type Comparison } from '@lgs/shared';
import { analyzeIndividualDestinationPosterior, rankDestinationDraw } from '../backend/src/model/aggregate.js';
import { modelConfig, SELECTOR_VERSION } from '../backend/src/model/config.js';
import { fitHierarchicalBradleyTerry } from '../backend/src/model/fit.js';
import { createSeedVersion } from '../backend/src/model/snapshot.js';
import { selectInformationGainPair } from '../backend/src/model/selection.js';
import { evaluateStopping, MAXIMUM_COMPARISONS, MINIMUM_COMPARISONS } from '../backend/src/model/stopping.js';
import { EVALUATION_SEED_SCHEDULE, SYNTHETIC_SCENARIOS, createSyntheticFixtureRun, type FixtureScenarioId, type SyntheticUserTruth } from '../backend/tests/model/fixtures.js';

const root = process.cwd();
const ARTIFACT_SCHEMA_VERSION = 1;
const list = (value: string | undefined) => value?.split(',').map((item) => item.trim()).filter(Boolean);
const requestedSeeds = list(process.env.LGS_MODEL_POLICY_SEEDS)?.map(Number) ?? [...EVALUATION_SEED_SCHEDULE];
const scenarioIds = new Set(list(process.env.LGS_MODEL_POLICY_SCENARIOS) ?? SYNTHETIC_SCENARIOS.map((scenario) => scenario.id));
const maximum = Number(process.env.LGS_MODEL_POLICY_MAX ?? MAXIMUM_COMPARISONS);
const outputDirectory = resolve(root, process.env.LGS_MODEL_POLICY_OUTPUT ?? '.agents/local/model-policy');
const force = process.env.LGS_MODEL_POLICY_FORCE === '1';
const verifyDeterminism = process.env.LGS_MODEL_POLICY_VERIFY_DETERMINISM === '1';
const summarizeOnly = process.env.LGS_MODEL_POLICY_SUMMARIZE === '1';

if (!Number.isInteger(maximum) || maximum < MINIMUM_COMPARISONS || maximum > MAXIMUM_COMPARISONS || requestedSeeds.some((seed) => !Number.isInteger(seed))) {
  throw new Error(`Use integer seeds and a ${MINIMUM_COMPARISONS}–${MAXIMUM_COMPARISONS} policy maximum.`);
}
if (scenarioIds.size === 0 || [...scenarioIds].some((id) => !SYNTHETIC_SCENARIOS.some((scenario) => scenario.id === id))) {
  throw new Error('Use only known synthetic scenario IDs.');
}

function parsePartition(value: string | undefined): Readonly<{ index: number; count: number }> {
  if (!value) return { index: 0, count: 1 };
  const match = /^(\d+)\/(\d+)$/.exec(value);
  if (!match) throw new Error('LGS_MODEL_POLICY_PARTITION must be zero-based INDEX/COUNT, for example 0/4.');
  const index = Number(match[1]);
  const count = Number(match[2]);
  if (!Number.isInteger(index) || !Number.isInteger(count) || count < 1 || index < 0 || index >= count) throw new Error('LGS_MODEL_POLICY_PARTITION is out of range.');
  return { index, count };
}

const partition = parsePartition(process.env.LGS_MODEL_POLICY_PARTITION);

function loadSeed(): Readonly<{ activities: Activity[]; destinations: Destination[]; seedVersion: string }> {
  const read = (name: string) => JSON.parse(readFileSync(resolve(root, 'seed', name), 'utf8')) as unknown;
  const content = {
    'destinations.json': read('destinations.json'),
    'activities.json': read('activities.json'),
    'activity-media.json': read('activity-media.json'),
  };
  return {
    activities: activitySchema.array().parse(content['activities.json']),
    destinations: destinationSchema.array().parse(content['destinations.json']),
    seedVersion: createSeedVersion(content),
  };
}

const seed = loadSeed();
const activityById = new Map(seed.activities.map((activity) => [activity.id, activity]));

type Guardrails = Readonly<{
  uniquePairs: boolean;
  crossDestinationPairs: boolean;
  destinationCoverageAt24: boolean;
}>;

type Artifact = Readonly<{
  schemaVersion: number;
  input: Readonly<{
    seedVersion: string;
    modelVersion: string;
    selectorVersion: string;
    posteriorDrawCount: number;
    minimum: number;
    maximum: number;
    scenarioId: FixtureScenarioId;
    seed: number;
    userId: string;
  }>;
  comparisons: readonly Comparison[];
  guardrails: Guardrails;
  fitFailures: number;
  final: Readonly<{
    topFiveExact: boolean;
    fifthSixthCorrect: boolean;
    intervalCoverage: Readonly<{ successes: number; total: number }>;
    confidenceLabel: 'clear-shape' | 'close-call';
    completion?: Readonly<{ ordinal: number; reason: string; confidenceLabel: string }>;
  }>;
  timingMs: number;
}>;

type WorkItem = Readonly<{ scenarioId: FixtureScenarioId; seed: number; userId: string }>;

function artifactPath(item: WorkItem): string {
  return resolve(outputDirectory, 'trajectories', `${item.scenarioId}--${item.seed}--${item.userId}.json`);
}

function expectedArtifactInput(item: WorkItem): Artifact['input'] {
  return {
    seedVersion: seed.seedVersion,
    modelVersion: modelConfig.modelVersion,
    selectorVersion: SELECTOR_VERSION,
    posteriorDrawCount: modelConfig.posteriorDrawCount,
    minimum: MINIMUM_COMPARISONS,
    maximum,
    scenarioId: item.scenarioId,
    seed: item.seed,
    userId: item.userId,
  };
}

function artifactMatches(value: unknown, item: WorkItem): value is Artifact {
  if (!value || typeof value !== 'object') return false;
  const artifact = value as Partial<Artifact>;
  return artifact.schemaVersion === ARTIFACT_SCHEMA_VERSION
    && JSON.stringify(artifact.input) === JSON.stringify(expectedArtifactInput(item))
    && Array.isArray(artifact.comparisons)
    && typeof artifact.timingMs === 'number';
}

function readArtifact(item: WorkItem): Artifact | undefined {
  const path = artifactPath(item);
  if (!existsSync(path)) return undefined;
  const value = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  if (!artifactMatches(value, item)) throw new Error(`Refusing incompatible artifact: ${path}`);
  return value;
}

function writeArtifact(item: WorkItem, artifact: Artifact): void {
  const path = artifactPath(item);
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(artifact, null, 2)}\n`);
  renameSync(temporary, path);
}

function canonicalPairId(comparison: Comparison): string {
  return [comparison.activityA, comparison.activityB].sort().join(':');
}

function coverageAt24(comparisons: readonly Comparison[]): boolean {
  if (comparisons.length < MINIMUM_COMPARISONS) return false;
  const appearances = new Map(seed.destinations.map((destination) => [destination.id, 0]));
  for (const comparison of comparisons.slice(0, MINIMUM_COMPARISONS)) {
    for (const activityId of [comparison.activityA, comparison.activityB]) {
      const activity = activityById.get(activityId);
      if (!activity) return false;
      appearances.set(activity.destinationId, appearances.get(activity.destinationId)! + 1);
    }
  }
  return [...appearances.values()].every((count) => count >= 2);
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id) => right.includes(id));
}

function runTrajectory(item: WorkItem, user: SyntheticUserTruth): Artifact {
  const started = performance.now();
  const fixture = createSyntheticFixtureRun(item.scenarioId, item.seed, seed.destinations, seed.activities);
  const comparisons: Comparison[] = [];
  let fitFailures = 0;
  let final: Artifact['final'] | undefined;

  for (let ordinal = 1; ordinal <= maximum; ordinal += 1) {
    const fit = fitHierarchicalBradleyTerry(seed.activities, comparisons);
    if (!fit.ok) { fitFailures += 1; break; }
    const pair = selectInformationGainPair({
      activities: seed.activities,
      comparisons,
      fit,
      seed: `${item.scenarioId}:${item.seed}:${item.userId}:${ordinal}`,
    });
    if (!pair) break;
    comparisons.push({
      activityA: pair[0].id,
      activityB: pair[1].id,
      winner: fixture.winnerForPair(item.userId, pair[0].id, pair[1].id, ordinal),
    });
    if (comparisons.length < MINIMUM_COMPARISONS) continue;

    // This is deliberately the exact production 512-draw analysis and the
    // exact bounded stopping implementation, not the selector's 64-draw
    // boundary-scoring optimization.
    const postAnswerFit = fitHierarchicalBradleyTerry(seed.activities, comparisons);
    if (!postAnswerFit.ok) { fitFailures += 1; break; }
    const analysis = analyzeIndividualDestinationPosterior(postAnswerFit, `${item.scenarioId}:${item.seed}:${item.userId}:${comparisons.length}`);
    const truth = rankDestinationDraw(user.destinationUtilities);
    const intervalCoverage = seed.destinations.reduce((metric, destination) => {
      const interval = analysis.summaries.get(destination.id)!.interval;
      return {
        successes: metric.successes + Number(user.destinationUtilities[destination.id]! >= interval.low && user.destinationUtilities[destination.id]! <= interval.high),
        total: metric.total + 1,
      };
    }, { successes: 0, total: 0 });
    const stopping = evaluateStopping({ activities: seed.activities, comparisons, analysis });
    final = {
      topFiveExact: sameSet(analysis.topFiveIds, truth.slice(0, 5).map((entry) => entry.id)),
      fifthSixthCorrect: analysis.ranking.findIndex((entry) => entry.id === truth[4]!.id) < analysis.ranking.findIndex((entry) => entry.id === truth[5]!.id),
      intervalCoverage,
      confidenceLabel: analysis.confidenceLabel,
      ...(stopping.complete && stopping.completion ? { completion: { ordinal: comparisons.length, reason: stopping.completion.reason, confidenceLabel: stopping.completion.confidenceLabel } } : {}),
    };
    if (stopping.complete) break;
  }

  const pairIds = comparisons.map(canonicalPairId);
  return {
    schemaVersion: ARTIFACT_SCHEMA_VERSION,
    input: expectedArtifactInput(item),
    comparisons,
    guardrails: {
      uniquePairs: new Set(pairIds).size === pairIds.length,
      crossDestinationPairs: comparisons.every((comparison) => activityById.get(comparison.activityA)?.destinationId !== activityById.get(comparison.activityB)?.destinationId),
      destinationCoverageAt24: coverageAt24(comparisons),
    },
    fitFailures,
    final: final ?? {
      topFiveExact: false,
      fifthSixthCorrect: false,
      intervalCoverage: { successes: 0, total: 0 },
      confidenceLabel: 'close-call',
    },
    timingMs: performance.now() - started,
  };
}

function walkObject(value: unknown, forbidden: readonly string[]): string[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap((item) => walkObject(item, forbidden));
  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => [
    ...(forbidden.includes(key) ? [key] : []),
    ...walkObject(nested, forbidden),
  ]);
}

/** Exercises the actual comparison serializer plus the full strict response DTO. */
function auditComparisonDto(): Readonly<{ passed: boolean; activityCount: number; dtoCount: number; forbiddenKeys: readonly string[] }> {
  const forbidden = [...BLIND_ACTIVITY_FORBIDDEN_FIELDS];
  const found = new Set<string>();
  let dtoCount = 0;
  for (let index = 0; index < seed.activities.length; index += 2) {
    const first = seed.activities[index]!;
    const second = seed.activities[(index + 1) % seed.activities.length]!;
    const response = nextComparisonResponseSchema.parse({
      complete: false,
      progress: { comparisons: 0, minimum: MINIMUM_COMPARISONS, maximum: MAXIMUM_COMPARISONS, estimatedCompletion: 0, phase: 'explore' },
      activityA: toSafeActivity(first),
      activityB: toSafeActivity(second),
    });
    walkObject(response, forbidden).forEach((key) => found.add(key));
    dtoCount += 1;
  }
  return { passed: found.size === 0, activityCount: seed.activities.length, dtoCount, forbiddenKeys: [...found].sort() };
}

function workItems(): WorkItem[] {
  return SYNTHETIC_SCENARIOS
    .filter((scenario) => scenarioIds.has(scenario.id))
    .flatMap((scenario) => requestedSeeds.flatMap((seedNumber) => {
      const fixture = createSyntheticFixtureRun(scenario.id, seedNumber, seed.destinations, seed.activities);
      return fixture.users.map((user) => ({ scenarioId: scenario.id, seed: seedNumber, userId: user.id }));
    }))
    .sort((left, right) => left.scenarioId.localeCompare(right.scenarioId) || left.seed - right.seed || left.userId.localeCompare(right.userId));
}

function percentile(values: readonly number[], fraction: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))]!;
}

function summarize(items: readonly WorkItem[], dtoRedaction: ReturnType<typeof auditComparisonDto>) {
  const artifacts = items.map(readArtifact);
  const completed = artifacts.filter((artifact): artifact is Artifact => artifact !== undefined);
  const guardrails = {
    uniquePairs: completed.every((artifact) => artifact.guardrails.uniquePairs),
    crossDestinationPairs: completed.every((artifact) => artifact.guardrails.crossDestinationPairs),
    destinationCoverageAt24: completed.every((artifact) => artifact.guardrails.destinationCoverageAt24),
  };
  const stableStops = completed.filter((artifact) => artifact.final.completion?.reason === 'stable-top-five');
  const expectedClear = completed.filter((artifact) => SYNTHETIC_SCENARIOS.find((scenario) => scenario.id === artifact.input.scenarioId)?.expectation.expectedConfidence === 'clear-shape');
  const expectedClose = completed.filter((artifact) => SYNTHETIC_SCENARIOS.find((scenario) => scenario.id === artifact.input.scenarioId)?.expectation.expectedConfidence === 'close-call');
  const coverage = completed.reduce((metric, artifact) => ({ successes: metric.successes + artifact.final.intervalCoverage.successes, total: metric.total + artifact.final.intervalCoverage.total }), { successes: 0, total: 0 });
  return {
    schemaVersion: ARTIFACT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    complete: completed.length === items.length,
    input: {
      seedVersion: seed.seedVersion,
      modelVersion: modelConfig.modelVersion,
      selectorVersion: SELECTOR_VERSION,
      posteriorDrawCount: modelConfig.posteriorDrawCount,
      minimum: MINIMUM_COMPARISONS,
      maximum,
      scenarios: [...scenarioIds].sort(),
      seeds: { count: requestedSeeds.length, first: requestedSeeds[0], last: requestedSeeds.at(-1) },
    },
    work: { expectedTrajectories: items.length, completedTrajectories: completed.length, missingTrajectories: items.length - completed.length, partition },
    guardrails,
    dtoRedaction,
    metrics: {
      fitFailures: completed.reduce((total, artifact) => total + artifact.fitFailures, 0),
      topFiveExact: { successes: completed.filter((artifact) => artifact.final.topFiveExact).length, total: completed.length },
      fifthSixthCorrect: { successes: completed.filter((artifact) => artifact.final.fifthSixthCorrect).length, total: completed.length },
      intervalCoverage: { ...coverage, value: coverage.total === 0 ? null : coverage.successes / coverage.total },
      stableStops: {
        total: stableStops.length,
        expectedClear: { successes: stableStops.filter((artifact) => expectedClear.includes(artifact)).length, total: expectedClear.length },
        unexpectedClose: { successes: stableStops.filter((artifact) => expectedClose.includes(artifact)).length, total: expectedClose.length },
      },
      timingMs: {
        mean: completed.length === 0 ? null : completed.reduce((total, artifact) => total + artifact.timingMs, 0) / completed.length,
        p95: percentile(completed.map((artifact) => artifact.timingMs), 0.95),
        total: completed.reduce((total, artifact) => total + artifact.timingMs, 0),
      },
    },
    promotion: {
      decision: 'do-not-promote',
      reasons: [
        ...(completed.length === items.length ? [] : ['adaptive-policy-artifacts-incomplete']),
        ...(!guardrails.uniquePairs ? ['duplicate-pair-observed'] : []),
        ...(!guardrails.crossDestinationPairs ? ['same-destination-pair-observed'] : []),
        ...(!guardrails.destinationCoverageAt24 ? ['question-24-coverage-failed'] : []),
        ...(!dtoRedaction.passed ? ['comparison-dto-redaction-failed'] : []),
        'policy-audit-is-evidence-only-until-ADR-0003-records-all-predeclared-thresholds',
      ],
    },
  };
}

function userFor(item: WorkItem): SyntheticUserTruth {
  const fixture = createSyntheticFixtureRun(item.scenarioId, item.seed, seed.destinations, seed.activities);
  const user = fixture.users.find((candidate) => candidate.id === item.userId);
  if (!user) throw new Error(`Synthetic work item references unknown user ${item.userId}.`);
  return user;
}

function main(): void {
  const items = workItems();
  const selected = items.filter((_, index) => index % partition.count === partition.index);
  mkdirSync(outputDirectory, { recursive: true });
  const dtoRedaction = auditComparisonDto();
  if (!summarizeOnly) {
    for (const item of selected) {
      const existing = !force ? readArtifact(item) : undefined;
      if (existing && !verifyDeterminism) continue;
      const artifact = runTrajectory(item, userFor(item));
      if (existing && verifyDeterminism) {
        if (JSON.stringify(existing.comparisons) !== JSON.stringify(artifact.comparisons) || JSON.stringify(existing.final) !== JSON.stringify(artifact.final) || JSON.stringify(existing.guardrails) !== JSON.stringify(artifact.guardrails)) {
          throw new Error(`Determinism replay failed for ${artifactPath(item)}.`);
        }
      } else {
        writeArtifact(item, artifact);
      }
    }
  }
  const report = summarize(items, dtoRedaction);
  if (partition.index === 0) writeFileSync(resolve(outputDirectory, 'summary.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main();
