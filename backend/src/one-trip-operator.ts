import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { GoogleAuth } from 'google-auth-library';
import { resultSnapshotReaderSchema } from '@lgs/shared';
import { isShortlistComplete } from './model/shortlist.js';
import { readStoredUserState } from './store.js';

/** The only Firestore collections an operator command is ever allowed to see. */
export const ONE_TRIP_COLLECTIONS = [
  'lgsV4Users',
  'lgsV4State',
  'lgsV4ResultSnapshots',
] as const;

export type OneTripCollection = (typeof ONE_TRIP_COLLECTIONS)[number];
export type OperatorDocument = Readonly<{ id: string; data: unknown }>;

/** A narrow seam makes the destructive surface auditable and unit-testable. */
export interface OneTripOperatorRepository {
  selectedProjectId(): Promise<string | undefined>;
  list(collection: Exclude<OneTripCollection, 'lgsV4State'>): Promise<readonly OperatorDocument[]>;
  getReveal(): Promise<OperatorDocument | undefined>;
  delete(collection: OneTripCollection, id: string): Promise<void>;
}

export type RevealPreflightState = 'closed' | 'open-v1' | 'open-v2' | 'missing-snapshot' | 'invalid';
export type OneTripPreflightReport = Readonly<{
  projectId: string;
  startedUsers: number;
  completedUsers: number;
  snapshots: number;
  reveal: RevealPreflightState;
}>;

export class OneTripOperatorError extends Error {
  constructor(public readonly code: 'arguments' | 'project-mismatch' | 'invalid-state' | 'reset-refused', message: string) {
    super(message);
    this.name = 'OneTripOperatorError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRevealState(value: unknown): Readonly<{ open: boolean; snapshotId?: string }> | undefined {
  if (!isRecord(value)) return undefined;
  if (value.open !== undefined && typeof value.open !== 'boolean') return undefined;
  if (value.snapshotId !== undefined && (typeof value.snapshotId !== 'string' || value.snapshotId.length === 0)) return undefined;
  return { open: value.open ?? false, ...(typeof value.snapshotId === 'string' ? { snapshotId: value.snapshotId } : {}) };
}

function safeProjectId(value: string): string {
  if (!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(value)) {
    throw new OneTripOperatorError('arguments', 'A valid explicit Google Cloud project ID is required.');
  }
  return value;
}

export type ParsedPreflightArgs = Readonly<{ projectId: string }>;
export type ParsedResetArgs = ParsedPreflightArgs & Readonly<{ exportRef: string }>;

function readFlag(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

/** Reject unknown, repeated, and partial flags rather than guessing operator intent. */
export function parsePreflightArgs(args: readonly string[]): ParsedPreflightArgs {
  if (args.length !== 2 || args[0] !== '--project') {
    throw new OneTripOperatorError('arguments', 'Usage: npm run preflight:one-trip -- --project <project-id>');
  }
  return { projectId: safeProjectId(readFlag(args, '--project') ?? '') };
}

export function parseResetArgs(args: readonly string[]): ParsedResetArgs {
  const project = readFlag(args, '--project');
  const exportRef = readFlag(args, '--export-ref');
  const exact = args.length === 5 && args[0] === '--project' && args[2] === '--confirm-trip-reset' && args[3] === '--export-ref';
  if (!exact || !project || !exportRef || !/^private:[A-Za-z0-9._:-]{8,}$/.test(exportRef)) {
    throw new OneTripOperatorError('arguments', 'Usage: npm run reset:one-trip -- --project <project-id> --confirm-trip-reset --export-ref private:<locally-generated-reference>');
  }
  return { projectId: safeProjectId(project), exportRef };
}

async function assertProject(repository: OneTripOperatorRepository, projectId: string): Promise<void> {
  const selected = await repository.selectedProjectId();
  if (!selected || selected !== projectId) {
    throw new OneTripOperatorError('project-mismatch', 'Credential-selected project does not match the explicit target project.');
  }
}

/** Inspects only the one-trip documents and returns count-only facts. */
export async function inspectOneTrip(repository: OneTripOperatorRepository, projectId: string): Promise<OneTripPreflightReport> {
  await assertProject(repository, projectId);
  const [users, snapshots, revealDocument] = await Promise.all([
    repository.list('lgsV4Users'),
    repository.list('lgsV4ResultSnapshots'),
    repository.getReveal(),
  ]);

  let startedUsers = 0;
  let completedUsers = 0;
  try {
    for (const user of users) {
      const state = readStoredUserState(user.data);
      if (state.comparisons.length > 0 || state.pending !== null || state.completedAt) startedUsers += 1;
      // Fixed-32 completion is derived from the append-only comparison log.
      // `completedAt` is legacy metadata and is not written by the current
      // shortlist flow, so it must not be the source of truth for operators.
      if (isShortlistComplete(state.comparisons)) completedUsers += 1;
    }
  } catch {
    return { projectId, startedUsers, completedUsers, snapshots: snapshots.length, reveal: 'invalid' };
  }

  const snapshotById = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  const parsedSnapshots = new Map(snapshots.map((snapshot) => [snapshot.id, resultSnapshotReaderSchema.safeParse(snapshot.data)]));
  const reveal = revealDocument ? parseRevealState(revealDocument.data) : { open: false };
  let revealState: RevealPreflightState;
  if (!reveal) revealState = 'invalid';
  else if (!reveal.open && reveal.snapshotId) revealState = 'invalid';
  else if (!reveal.open) revealState = 'closed';
  else if (!reveal.snapshotId) revealState = 'open-v1';
  else if (!snapshotById.has(reveal.snapshotId)) revealState = 'missing-snapshot';
  else {
    const parsed = parsedSnapshots.get(reveal.snapshotId)!;
    revealState = !parsed.success ? 'invalid' : parsed.data.schemaVersion === 1 ? 'open-v1' : 'open-v2';
  }
  if (revealState !== 'invalid' && [...parsedSnapshots.values()].some((snapshot) => !snapshot.success)) revealState = 'invalid';
  return { projectId, startedUsers, completedUsers, snapshots: snapshots.length, reveal: revealState };
}

export function reportIsEmpty(report: OneTripPreflightReport): boolean {
  return report.reveal === 'closed' && report.startedUsers === 0 && report.completedUsers === 0 && report.snapshots === 0;
}

/** Count-only serializable output. Keep this contract free of document IDs/data. */
export function formatPreflightReport(report: OneTripPreflightReport): string {
  return JSON.stringify({ targetProject: report.projectId, startedUsers: report.startedUsers, completedUsers: report.completedUsers, snapshots: report.snapshots, reveal: report.reveal, empty: reportIsEmpty(report) });
}

/** Never erase a started journey or an opened/legacy reveal, confirmation notwithstanding. */
export async function resetUntouchedOneTrip(repository: OneTripOperatorRepository, projectId: string, exportRef: string): Promise<OneTripPreflightReport> {
  if (!/^private:[A-Za-z0-9._:-]{8,}$/.test(exportRef)) {
    throw new OneTripOperatorError('arguments', 'A locally generated private export reference is required.');
  }
  const before = await inspectOneTrip(repository, projectId);
  if (before.startedUsers > 0 || before.completedUsers > 0 || before.reveal !== 'closed') {
    throw new OneTripOperatorError('reset-refused', 'Refusing to reset a started journey or any opened, missing, or invalid reveal.');
  }
  const [users, snapshots, reveal] = await Promise.all([
    repository.list('lgsV4Users'), repository.list('lgsV4ResultSnapshots'), repository.getReveal(),
  ]);
  await Promise.all([
    ...users.map((document) => repository.delete('lgsV4Users', document.id)),
    ...snapshots.map((document) => repository.delete('lgsV4ResultSnapshots', document.id)),
    ...(reveal ? [repository.delete('lgsV4State', 'reveal')] : []),
  ]);
  const after = await inspectOneTrip(repository, projectId);
  if (!reportIsEmpty(after)) throw new OneTripOperatorError('invalid-state', 'Reset did not produce an empty one-trip preflight state.');
  return after;
}

class FirestoreOneTripOperatorRepository implements OneTripOperatorRepository {
  private readonly database = getFirestore();

  async selectedProjectId(): Promise<string | undefined> {
    const configured = getApp().options.projectId;
    return configured ?? new GoogleAuth().getProjectId().catch(() => undefined);
  }

  async list(collection: Exclude<OneTripCollection, 'lgsV4State'>): Promise<readonly OperatorDocument[]> {
    const snapshot = await this.database.collection(collection).get();
    return snapshot.docs.map((document) => ({ id: document.id, data: document.data() }));
  }

  async getReveal(): Promise<OperatorDocument | undefined> {
    const document = await this.database.collection('lgsV4State').doc('reveal').get();
    return document.exists ? { id: document.id, data: document.data() } : undefined;
  }

  async delete(collection: OneTripCollection, id: string): Promise<void> {
    if (collection === 'lgsV4State' && id !== 'reveal') throw new OneTripOperatorError('invalid-state', 'Only the one-trip reveal state document may be deleted.');
    await this.database.collection(collection).doc(id).delete();
  }
}

export function createFirestoreOneTripOperatorRepository(): OneTripOperatorRepository {
  if (!getApps().length) initializeApp();
  return new FirestoreOneTripOperatorRepository();
}
