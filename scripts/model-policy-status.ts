/**
 * Read-only progress report for the resumable adaptive-policy evidence audit.
 * It deliberately inspects only local, ignored artifacts and never starts,
 * resumes, or changes an audit worker.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { EVALUATION_SEED_SCHEDULE, SYNTHETIC_SCENARIOS } from '../backend/tests/model/fixtures.js';

const root = process.cwd();
const outputDirectory = resolve(root, process.env.LGS_MODEL_POLICY_OUTPUT ?? '.agents/local/model-policy');
const trajectoryDirectory = resolve(outputDirectory, 'trajectories');

type Progress = Readonly<{ completed: number; expected: number }>;

const expectedByScenario = new Map(
  SYNTHETIC_SCENARIOS.map((scenario) => [scenario.id, EVALUATION_SEED_SCHEDULE.length * scenario.userCount]),
);
const completedByScenario = new Map(SYNTHETIC_SCENARIOS.map((scenario) => [scenario.id, 0]));

if (!existsSync(trajectoryDirectory)) {
  console.log(`No adaptive-policy artifacts yet at ${trajectoryDirectory}.`);
  process.exit(0);
}

const artifacts = readdirSync(trajectoryDirectory).filter((name) => name.endsWith('.json'));
let newestTimestamp = 0;
for (const artifact of artifacts) {
  const scenario = SYNTHETIC_SCENARIOS.find((item) => artifact.startsWith(`${item.id}--`));
  if (!scenario) continue;
  completedByScenario.set(scenario.id, completedByScenario.get(scenario.id)! + 1);
  newestTimestamp = Math.max(newestTimestamp, statSync(resolve(trajectoryDirectory, artifact)).mtimeMs);
}

const totals = [...expectedByScenario.entries()].reduce<Progress>(
  (progress, [id, expected]) => ({ completed: progress.completed + completedByScenario.get(id)!, expected: progress.expected + expected }),
  { completed: 0, expected: 0 },
);
const percent = totals.expected === 0 ? 0 : (totals.completed / totals.expected) * 100;

console.log(`Adaptive-policy audit: ${totals.completed}/${totals.expected} trajectories (${percent.toFixed(1)}%)`);
for (const scenario of SYNTHETIC_SCENARIOS) {
  const completed = completedByScenario.get(scenario.id)!;
  const expected = expectedByScenario.get(scenario.id)!;
  console.log(`  ${scenario.id}: ${completed}/${expected}`);
}
if (newestTimestamp > 0) {
  console.log(`Latest artifact: ${new Date(newestTimestamp).toLocaleString()}`);
}
console.log(`Artifacts: ${trajectoryDirectory}`);
