/**
 * Deterministic OT-19 model-evaluation runner.
 *
 * This is deliberately a release-gate tool, not production ranking code. It
 * evaluates a frozen, coverage-safe replay schedule so the existing baseline
 * and candidate receive exactly the same synthetic observations. The candidate
 * selector is audited separately by its focused tests; it is not certified by
 * this fixed-schedule experiment, and the report therefore fails closed for
 * promotion until a full policy replay is practical.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Activity, Comparison, Destination } from '@lgs/shared';
import { activitySchema, destinationSchema } from '@lgs/shared';
import { aggregateGroupDestinationDraws, analyzeDestinationDraws, rankDestinationDraw } from '../backend/src/model/aggregate.js';
import { replayBaselineRanking, replayBaselineShouldStop } from '../backend/src/model/baseline.js';
import { modelConfig } from '../backend/src/model/config.js';
import { utilityDesignRow } from '../backend/src/model/features.js';
import { fitHierarchicalBradleyTerry } from '../backend/src/model/fit.js';
import { dot } from '../backend/src/model/linear-algebra.js';
import { drawPosteriorParameters } from '../backend/src/model/posterior.js';
import { createSeedVersion } from '../backend/src/model/snapshot.js';
import { evaluateStopping } from '../backend/src/model/stopping.js';
import { groupRankings, normalizeDestinationScores, selectNextPair } from '../backend/src/ranking.js';
import {
  EVALUATION_BUDGETS,
  EVALUATION_SEED_SCHEDULE,
  SYNTHETIC_SCENARIOS,
  createSyntheticFixtureRun,
  type FixtureScenario,
  type SyntheticUserTruth,
} from '../backend/tests/model/fixtures.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const reportPath = resolve(root, 'docs/model-evaluation-results.json');

/**
 * A bounded evaluator-only draw count keeps all 7 × 200 fixtures replayable on
 * a developer laptop. It must equal modelConfig.posteriorDrawCount before the
 * candidate can be promoted. The resulting mismatch is a deliberate hard
 * failure recorded in the report, not a hidden approximation.
 */
export const EVALUATION_POSTERIOR_DRAW_COUNT = 32;

type Rate = Readonly<{ successes: number; total: number; value: number | null }>;
type IndividualMetrics = Readonly<{
  topFiveExact: Rate;
  fifthSixthCorrect: Rate;
  rankOneCorrect: Rate;
}>;
type CandidateMetrics = IndividualMetrics & Readonly<{
  intervalCoverage: Rate;
  clearShape: Rate;
  falseClear: Rate;
  stableAtBudget: Rate;
  fitFailures: number;
}>;
type GroupMetrics = Readonly<{
  winnerCorrect: Rate;
  consensusCorrect: Rate;
}>;
type Guardrails = Readonly<{
  uniquePairs: boolean;
  crossDestinationPairs: boolean;
  destinationCoverageAt24: boolean;
  deterministicSchedule: boolean;
  candidateSelectorPolicyCertified: false;
  comparisonPayloadRedactionAuditedByThisRunner: false;
}>;
type Row = Readonly<{
  scenario: string;
  budget: number;
  observations: number;
  baseline: IndividualMetrics & Readonly<{ stableAtBudget: Rate }>;
  candidate: CandidateMetrics;
  group?: Readonly<{ baseline: GroupMetrics; candidate: GroupMetrics }>;
}>;

type WorkItem = Readonly<{ scenarioId: FixtureScenario['id']; budget: number }>;

type MutableRate = { successes: number; total: number };
type MutableIndividual = { topFiveExact: MutableRate; fifthSixthCorrect: MutableRate; rankOneCorrect: MutableRate };
type MutableCandidate = MutableIndividual & { intervalCoverage: MutableRate; clearShape: MutableRate; falseClear: MutableRate; stableAtBudget: MutableRate; fitFailures: number };
type MutableGroup = { winnerCorrect: MutableRate; consensusCorrect: MutableRate };

function rate(): MutableRate { return { successes: 0, total: 0 }; }
function individual(): MutableIndividual { return { topFiveExact: rate(), fifthSixthCorrect: rate(), rankOneCorrect: rate() }; }
function candidate(): MutableCandidate {
  return { ...individual(), intervalCoverage: rate(), clearShape: rate(), falseClear: rate(), stableAtBudget: rate(), fitFailures: 0 };
}
function group(): MutableGroup { return { winnerCorrect: rate(), consensusCorrect: rate() }; }
function add(metric: MutableRate, passed: boolean): void { metric.total += 1; if (passed) metric.successes += 1; }
function freezeRate(metric: MutableRate): Rate { return { ...metric, value: metric.total === 0 ? null : metric.successes / metric.total }; }
function freezeIndividual(metrics: MutableIndividual): IndividualMetrics {
  return {
    topFiveExact: freezeRate(metrics.topFiveExact),
    fifthSixthCorrect: freezeRate(metrics.fifthSixthCorrect),
    rankOneCorrect: freezeRate(metrics.rankOneCorrect),
  };
}

function ids(values: readonly { id: string }[], count: number): string[] {
  return values.slice(0, count).map((entry) => entry.id);
}
function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id) => right.includes(id));
}
function trueRanking(user: SyntheticUserTruth): ReturnType<typeof rankDestinationDraw> {
  return rankDestinationDraw(user.destinationUtilities);
}
function updateIndividual(
  metrics: MutableIndividual,
  ranking: readonly { id: string }[],
  truth: readonly { id: string }[],
): void {
  add(metrics.topFiveExact, sameSet(ids(ranking, 5), ids(truth, 5)));
  add(metrics.fifthSixthCorrect, ranking.findIndex((entry) => entry.id === truth[4]?.id) < ranking.findIndex((entry) => entry.id === truth[5]?.id));
  add(metrics.rankOneCorrect, ranking[0]?.id === truth[0]?.id);
}

function seedContent() {
  const read = (name: string) => JSON.parse(readFileSync(resolve(root, 'seed', name), 'utf8')) as unknown;
  return { 'destinations.json': read('destinations.json'), 'activities.json': read('activities.json'), 'activity-media.json': read('activity-media.json') };
}

function loadSeed(): { destinations: Destination[]; activities: Activity[]; seedVersion: string } {
  const content = seedContent();
  return {
    destinations: destinationSchema.array().parse(content['destinations.json']),
    activities: activitySchema.array().parse(content['activities.json']),
    seedVersion: createSeedVersion(content),
  };
}

/**
 * The production analysis derives a destination score by averaging its activity
 * utilities for every posterior parameter draw. That is a linear operation, so
 * this evaluator-only helper precomputes the same portfolio direction once and
 * takes one dot product per destination/draw. It does not approximate a draw,
 * alter priors, or change the candidate model; it merely removes repeated row
 * allocation from a 7,000-fixture release gate.
 */
function evaluationDestinationDirections(fit: Extract<ReturnType<typeof fitHierarchicalBradleyTerry>, { ok: true }>): ReadonlyMap<string, readonly number[]> {
  const directions = new Map<string, number[]>();
  for (const destinationId of fit.design.destinationIds) {
    const portfolio = fit.design.activities.filter((activity) => activity.destinationId === destinationId);
    const direction = Array.from({ length: fit.parameters.length }, () => 0);
    for (const activity of portfolio) {
      const row = utilityDesignRow(fit.design, activity.id);
      for (let index = 0; index < direction.length; index += 1) direction[index]! += row[index]! / portfolio.length;
    }
    directions.set(destinationId, direction);
  }
  return directions;
}

function analyzeEvaluationPosterior(
  fit: Extract<ReturnType<typeof fitHierarchicalBradleyTerry>, { ok: true }>,
  seed: string,
) {
  const directions = evaluationDestinationDirections(fit);
  const draws = drawPosteriorParameters(fit, EVALUATION_POSTERIOR_DRAW_COUNT, seed).map((parameters) =>
    Object.fromEntries([...directions.entries()].map(([destinationId, direction]) => [destinationId, dot(direction, parameters)])));
  return analyzeDestinationDraws(draws);
}

/** The legacy chooser depends only on exposure, so this schedule is stable. */
export function fixedReplaySchedule(activities: Activity[], count = 40): Comparison[] {
  const comparisons: Comparison[] = [];
  for (let ordinal = 0; ordinal < count; ordinal += 1) {
    const pair = selectNextPair(activities, comparisons);
    if (!pair) throw new Error(`Baseline schedule exhausted at question ${ordinal + 1}.`);
    comparisons.push({ activityA: pair[0].id, activityB: pair[1].id, winner: pair[0].id });
  }
  return comparisons;
}

function outcomes(schedule: readonly Comparison[], run: ReturnType<typeof createSyntheticFixtureRun>, user: SyntheticUserTruth): Comparison[] {
  return schedule.map((pair, index) => ({
    activityA: pair.activityA,
    activityB: pair.activityB,
    winner: run.winnerForPair(user.id, pair.activityA, pair.activityB, index + 1),
  }));
}

function expectedGroupWinner(users: readonly SyntheticUserTruth[]): string {
  const normalized = users.map((user) => normalizeDestinationScores({ ...user.destinationUtilities }));
  const destinationIds = Object.keys(normalized[0] ?? {}).sort((left, right) => left.localeCompare(right));
  const scores = Object.fromEntries(destinationIds.map((id) => {
    const values = normalized.map((entry) => entry[id]!);
    const mean = values.reduce((total, value) => total + value, 0) / values.length;
    const sd = Math.sqrt(values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length);
    return [id, mean - 0.25 * sd];
  }));
  return rankDestinationDraw(scores)[0]!.id;
}

function auditSchedule(schedule: readonly Comparison[], activities: readonly Activity[]): Guardrails {
  const activityById = new Map(activities.map((activity) => [activity.id, activity]));
  const pairIds = schedule.map((comparison) => [comparison.activityA, comparison.activityB].sort().join(':'));
  const crossDestinationPairs = schedule.every((comparison) => activityById.get(comparison.activityA)?.destinationId !== activityById.get(comparison.activityB)?.destinationId);
  const appearances = new Map([...new Set(activities.map((activity) => activity.destinationId))].map((id) => [id, 0]));
  for (const comparison of schedule.slice(0, 24)) {
    for (const activityId of [comparison.activityA, comparison.activityB]) {
      const activity = activityById.get(activityId);
      if (activity) appearances.set(activity.destinationId, appearances.get(activity.destinationId)! + 1);
    }
  }
  const replay = fixedReplaySchedule(activities, schedule.length);
  return {
    uniquePairs: new Set(pairIds).size === pairIds.length,
    crossDestinationPairs,
    destinationCoverageAt24: [...appearances.values()].every((count) => count >= 2),
    deterministicSchedule: JSON.stringify(replay) === JSON.stringify(schedule),
    candidateSelectorPolicyCertified: false,
    comparisonPayloadRedactionAuditedByThisRunner: false,
  };
}

function promotionFailures(rows: readonly Row[], guardrails: Guardrails): string[] {
  const failures: string[] = [];
  if (EVALUATION_POSTERIOR_DRAW_COUNT !== modelConfig.posteriorDrawCount) {
    failures.push(`evaluation-draw-count-${EVALUATION_POSTERIOR_DRAW_COUNT}-does-not-match-production-${modelConfig.posteriorDrawCount}`);
  }
  if (!guardrails.candidateSelectorPolicyCertified) failures.push('information-gain-policy-not-certified-on-full-200-seed-replay');
  if (!guardrails.comparisonPayloadRedactionAuditedByThisRunner) failures.push('comparison-payload-redaction-not-a-responsibility-of-model-evaluator');
  if (!Object.values(guardrails).filter((value) => typeof value === 'boolean').every(Boolean)) failures.push('one-or-more-guardrails-failed');
  for (const row of rows) {
    const baseline = row.baseline.topFiveExact.value;
    const candidateMetric = row.candidate.topFiveExact.value;
    if (baseline !== null && candidateMetric !== null && candidateMetric < baseline) failures.push(`top-five-regression:${row.scenario}:${row.budget}`);
    const coverage = row.candidate.intervalCoverage.value;
    if (coverage !== null && (coverage < 0.85 || coverage > 0.95)) failures.push(`interval-coverage-outside-85-95:${row.scenario}:${row.budget}`);
    const falseClear = row.candidate.falseClear.value;
    if (falseClear !== null && falseClear > 0.1) failures.push(`false-clear-over-10-percent:${row.scenario}:${row.budget}`);
    if (row.candidate.fitFailures > 0) failures.push(`fit-failures:${row.scenario}:${row.budget}:${row.candidate.fitFailures}`);
  }
  return [...new Set(failures)].sort((left, right) => left.localeCompare(right));
}

function evaluateRow(work: WorkItem): Row {
  const { activities, destinations } = loadSeed();
  const schedule = fixedReplaySchedule(activities);
  const scenario = SYNTHETIC_SCENARIOS.find((entry) => entry.id === work.scenarioId);
  if (!scenario) throw new Error(`Evaluation work referenced unknown scenario: ${work.scenarioId}`);
  const baselineMetrics = { ...individual(), stableAtBudget: rate() };
  const candidateMetrics = candidate();
  const baselineGroup = scenario.userCount === 5 ? group() : undefined;
  const candidateGroup = scenario.userCount === 5 ? group() : undefined;

  for (const seed of EVALUATION_SEED_SCHEDULE) {
        const fixture = createSyntheticFixtureRun(scenario.id, seed, destinations, activities);
        const userFits: Array<{ user: string; analysis: ReturnType<typeof analyzeEvaluationPosterior> }> = [];
        const baselineScores: Record<string, number>[] = [];
        for (const user of fixture.users) {
          const truth = trueRanking(user);
          const comparisons = outcomes(schedule.slice(0, work.budget), fixture, user);
          const baseline = replayBaselineRanking(destinations, activities, comparisons);
          const baselineRanking = rankDestinationDraw(baseline.destinationScores);
          updateIndividual(baselineMetrics, baselineRanking, truth);
          add(baselineMetrics.stableAtBudget, replayBaselineShouldStop(activities, comparisons));
          baselineScores.push(normalizeDestinationScores(baseline.destinationScores));

          const fit = fitHierarchicalBradleyTerry(activities, comparisons);
          if (!fit.ok) {
            candidateMetrics.fitFailures += 1;
            continue;
          }
          const analysis = analyzeEvaluationPosterior(fit, `${scenario.id}:${seed}:${user.id}:${work.budget}`);
          updateIndividual(candidateMetrics, analysis.ranking, truth);
          for (const destination of destinations) {
            const interval = analysis.summaries.get(destination.id)!.interval;
            add(candidateMetrics.intervalCoverage, user.destinationUtilities[destination.id]! >= interval.low && user.destinationUtilities[destination.id]! <= interval.high);
          }
          const expectedClear = scenario.expectation.expectedConfidence === 'clear-shape';
          const reportedClear = analysis.confidenceLabel === 'clear-shape';
          add(candidateMetrics.clearShape, reportedClear === expectedClear);
          if (!expectedClear) add(candidateMetrics.falseClear, reportedClear);
          const stop = evaluateStopping({ activities, comparisons, analysis, hasEligiblePair: true });
          add(candidateMetrics.stableAtBudget, stop.complete && stop.completion?.reason === 'stable-top-five');
          userFits.push({ user: user.id, analysis });
        }
        if (scenario.userCount === 5 && baselineGroup && candidateGroup) {
          const winner = expectedGroupWinner(fixture.users);
          const baselineGroupRanking = groupRankings(destinations, baselineScores);
          add(baselineGroup.winnerCorrect, baselineGroupRanking[0]?.id === winner);
          // The baseline has no posterior consensus classification, so its
          // absence is explicit rather than invented as a label.
          add(baselineGroup.consensusCorrect, false);
          if (userFits.length === fixture.users.length) {
            const analysis = aggregateGroupDestinationDraws(userFits.map(({ user, analysis: individualAnalysis }) => ({ user, draws: individualAnalysis.draws })));
            add(candidateGroup.winnerCorrect, analysis.ranking[0]?.id === winner);
            const expectedConsensus = scenario.expectation.expectedGroupConsensus;
            add(candidateGroup.consensusCorrect, expectedConsensus !== undefined && analysis.summaries.get(analysis.ranking[0]!.id)?.consensus === expectedConsensus);
          }
        }
  }
  return {
    scenario: scenario.id,
    budget: work.budget,
    observations: EVALUATION_SEED_SCHEDULE.length * scenario.userCount,
    baseline: { ...freezeIndividual(baselineMetrics), stableAtBudget: freezeRate(baselineMetrics.stableAtBudget) },
    candidate: {
      ...freezeIndividual(candidateMetrics),
      intervalCoverage: freezeRate(candidateMetrics.intervalCoverage),
      clearShape: freezeRate(candidateMetrics.clearShape),
      falseClear: freezeRate(candidateMetrics.falseClear),
      stableAtBudget: freezeRate(candidateMetrics.stableAtBudget),
      fitFailures: candidateMetrics.fitFailures,
    },
    ...(baselineGroup && candidateGroup ? {
      group: {
        baseline: { winnerCorrect: freezeRate(baselineGroup.winnerCorrect), consensusCorrect: freezeRate(baselineGroup.consensusCorrect) },
        candidate: { winnerCorrect: freezeRate(candidateGroup.winnerCorrect), consensusCorrect: freezeRate(candidateGroup.consensusCorrect) },
      },
    } : {}),
  };
}

function workItems(): WorkItem[] {
  return SYNTHETIC_SCENARIOS.flatMap((scenario) => EVALUATION_BUDGETS.map((budget) => ({ scenarioId: scenario.id, budget })));
}

function workWeight(work: WorkItem): number {
  return SYNTHETIC_SCENARIOS.find((scenario) => scenario.id === work.scenarioId)?.userCount ?? 1;
}

/** Balances group-heavy fixture rows without splitting their fixed 200-seed schedule. */
function partitionWork(items: readonly WorkItem[], workers: number): WorkItem[][] {
  const partitions = Array.from({ length: workers }, () => [] as WorkItem[]);
  const loads = Array.from({ length: workers }, () => 0);
  for (const item of [...items].sort((left, right) => workWeight(right) - workWeight(left) || left.scenarioId.localeCompare(right.scenarioId) || left.budget - right.budget)) {
    const index = loads.indexOf(Math.min(...loads));
    partitions[index]!.push(item);
    loads[index]! += workWeight(item);
  }
  return partitions.filter((partition) => partition.length > 0);
}

function createReport(rows: readonly Row[]): Record<string, unknown> {
  const { activities, seedVersion } = loadSeed();
  const schedule = fixedReplaySchedule(activities);
  const guardrails = auditSchedule(schedule, activities);
  const orderedRows = [...rows].sort((left, right) => {
    const scenarioOrder = SYNTHETIC_SCENARIOS.findIndex((scenario) => scenario.id === left.scenario) - SYNTHETIC_SCENARIOS.findIndex((scenario) => scenario.id === right.scenario);
    return scenarioOrder || left.budget - right.budget;
  });
  const failures = promotionFailures(orderedRows, guardrails);
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    deterministicInputs: { seedSchedule: { first: EVALUATION_SEED_SCHEDULE[0], last: EVALUATION_SEED_SCHEDULE.at(-1), count: EVALUATION_SEED_SCHEDULE.length }, budgets: EVALUATION_BUDGETS, seedVersion },
    configuration: { ...modelConfig, evaluationPosteriorDrawCount: EVALUATION_POSTERIOR_DRAW_COUNT },
    comparisonPolicy: 'frozen-elo-coverage-v1-replay-schedule',
    guardrails,
    rows: orderedRows,
    promotion: { decision: failures.length === 0 ? 'promote' : 'do-not-promote', failures },
  };
}

function runWorkerWork(): void {
  const rawWork = process.env.LGS_MODEL_EVALUATION_WORK;
  if (!rawWork) throw new Error('Evaluation worker missing LGS_MODEL_EVALUATION_WORK.');
  const work = JSON.parse(rawWork) as WorkItem[];
  process.stdout.write(JSON.stringify(work.map(evaluateRow)));
}

function runChild(work: readonly WorkItem[]): Promise<Row[]> {
  return new Promise((resolveChild, rejectChild) => {
    // `tsx` installs its loader through execArgv. Reuse that invocation rather
    // than launching bare Node, which would try to resolve our TypeScript
    // source imports as emitted `.js` files.
    const child = spawn(process.execPath, [...process.execArgv, process.argv[1]!], {
      cwd: root,
      env: { ...process.env, LGS_MODEL_EVALUATION_WORKER: '1', LGS_MODEL_EVALUATION_WORK: JSON.stringify(work) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    let error = '';
    child.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { error += chunk.toString(); });
    child.once('error', rejectChild);
    child.once('close', (code) => {
      if (code !== 0) {
        rejectChild(new Error(`Evaluation worker exited ${code}: ${error || output}`));
        return;
      }
      try {
        resolveChild(JSON.parse(output) as Row[]);
      } catch (parseError) {
        rejectChild(new Error(`Evaluation worker returned invalid JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}\n${output}\n${error}`));
      }
    });
  });
}

export async function runEvaluation(): Promise<Record<string, unknown>> {
  const requestedWorkers = Number(process.env.LGS_MODEL_EVAL_WORKERS ?? Math.min(4, availableParallelism()));
  const workers = Number.isInteger(requestedWorkers) && requestedWorkers > 0 ? Math.min(requestedWorkers, workItems().length) : 1;
  const partitions = partitionWork(workItems(), workers);
  const rows = (await Promise.all(partitions.map(runChild))).flat();
  return createReport(rows);
}

async function main(): Promise<void> {
  if (process.env.LGS_MODEL_EVALUATION_WORKER === '1') {
    runWorkerWork();
  } else {
    const report = await runEvaluation();
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    const promotion = report.promotion as { decision: string; failures: string[] };
    console.log(`Model evaluation: ${promotion.decision}`);
    console.log(`Report: ${reportPath}`);
    console.log(`Failures: ${promotion.failures.join(', ') || 'none'}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main();
}
