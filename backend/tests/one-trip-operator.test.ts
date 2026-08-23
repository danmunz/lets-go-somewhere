import { describe, expect, it } from 'vitest';
import { buildTransparentSocialBallot } from '../src/results/social-ballot.js';
import {
  OneTripOperatorError,
  formatPreflightReport,
  inspectOneTrip,
  parsePreflightArgs,
  parseResetArgs,
  reportIsEmpty,
  resetUntouchedOneTrip,
  type OneTripCollection,
  type OneTripOperatorRepository,
  type OperatorDocument,
} from '../src/one-trip-operator.js';

const project = 'lets-go-somewhere-3549f';
const now = '2026-08-19T12:00:00.000Z';
const topFive = ['antigua', 'oaxaca', 'quito', 'cuzco', 'medellin'];
const profile = {
  headline: 'Apparently, this is your kind of trip.',
  synthesis: 'You consistently leaned toward active, distinctive experiences.',
  dimensions: [
    { key: 'adventure' as const, label: 'Adventure', strength: 'strong' as const, direction: 'drawn-to' as const },
    { key: 'nature' as const, label: 'Wild places', strength: 'present' as const, direction: 'drawn-to' as const },
  ],
  confidenceLabel: 'clear-shape' as const,
};

function validSnapshot() {
  const user = {
    topFive,
    profileThemes: ['Adventure'],
    profile,
    personalResults: {
      confidence: { label: 'clear-favorite' as const, summary: 'A clear favorite.' },
      topFive: topFive.map((id, index) => ({
        rank: index + 1,
        id,
        fitLabel: index === 0 ? 'strong-match' as const : 'contender' as const,
        interval: { low: 0.1, high: 0.9 },
        explanation: { themes: ['Adventure', 'Wild places'], matchedActivityCount: 1, encounteredActivityCount: 1 },
      })),
    },
  };
  return {
    schemaVersion: 2 as const,
    modelVersion: 'test-model',
    seedVersion: 'a'.repeat(64),
    inputDigest: 'b'.repeat(64),
    createdAt: now,
    users: { dan: user, james: user, john: user, matt: user, peter: user },
    group: buildTransparentSocialBallot({
      ballots: { dan: topFive, james: topFive, john: topFive, matt: topFive, peter: topFive },
      profileThemes: { dan: ['Adventure'], james: ['Adventure'], john: ['Adventure'], matt: ['Adventure'], peter: ['Adventure'] },
      destinationNames: Object.fromEntries(topFive.map((id) => [id, id])),
    }),
  };
}

class FakeRepository implements OneTripOperatorRepository {
  readonly documents = new Map<OneTripCollection, Map<string, unknown>>([
    ['lgsV4Users', new Map()], ['lgsV4State', new Map()], ['lgsV4ResultSnapshots', new Map()],
  ]);
  readonly deleted: Array<{ collection: OneTripCollection; id: string }> = [];
  constructor(private readonly selected = project) {}
  async selectedProjectId() { return this.selected; }
  async list(collection: Exclude<OneTripCollection, 'lgsV4State'>): Promise<readonly OperatorDocument[]> {
    return [...this.documents.get(collection)!.entries()].map(([id, data]) => ({ id, data }));
  }
  async getReveal(): Promise<OperatorDocument | undefined> {
    const data = this.documents.get('lgsV4State')!.get('reveal');
    return data === undefined ? undefined : { id: 'reveal', data };
  }
  async delete(collection: OneTripCollection, id: string): Promise<void> {
    this.deleted.push({ collection, id });
    this.documents.get(collection)!.delete(id);
  }
}

describe('one-trip operator preflight', () => {
  it('requires exact project and reset guards', () => {
    expect(parsePreflightArgs(['--project', project])).toEqual({ projectId: project });
    expect(() => parsePreflightArgs(['--project', project, '--extra'])).toThrow(OneTripOperatorError);
    expect(parseResetArgs(['--project', project, '--confirm-trip-reset', '--export-ref', 'private:7b4e4c19'])).toEqual({ projectId: project, exportRef: 'private:7b4e4c19' });
    expect(() => parseResetArgs(['--project', project, '--export-ref', 'private:7b4e4c19'])).toThrow(OneTripOperatorError);
    expect(() => parseResetArgs(['--project', project, '--confirm-trip-reset', '--export-ref', 'exported'])).toThrow(OneTripOperatorError);
  });

  it('reports only count-safe empty state and rejects credential project mismatch', async () => {
    const repository = new FakeRepository();
    const report = await inspectOneTrip(repository, project);
    expect(report).toMatchObject({ reveal: 'closed', startedUsers: 0, completedUsers: 0, snapshots: 0 });
    expect(reportIsEmpty(report)).toBe(true);
    expect(formatPreflightReport(report)).not.toContain('lgsV4');
    await expect(inspectOneTrip(new FakeRepository('another-project'), project)).rejects.toMatchObject({ code: 'project-mismatch' });
  });

  it('counts a current fixed-32 traveler as completed without legacy timestamp metadata', async () => {
    const repository = new FakeRepository();
    repository.documents.get('lgsV4Users')!.set('dan', {
      comparisons: Array.from({ length: 32 }, () => ({ activityA: 'a', activityB: 'b', winner: 'a' })),
    });
    await expect(inspectOneTrip(repository, project)).resolves.toMatchObject({
      startedUsers: 1,
      completedUsers: 1,
      reveal: 'closed',
    });
  });

  it.each([
    ['legacy open state', { open: true }, new Map(), 'open-v1'],
    ['missing snapshot', { open: true, snapshotId: 'missing' }, new Map(), 'missing-snapshot'],
    ['invalid snapshot', { open: true, snapshotId: 'bad' }, new Map([['bad', { schemaVersion: 2 }]]), 'invalid'],
  ])('classifies %s without printing document bodies', async (_label, reveal, snapshots, expected) => {
    const repository = new FakeRepository();
    repository.documents.get('lgsV4State')!.set('reveal', reveal);
    repository.documents.set('lgsV4ResultSnapshots', snapshots);
    await expect(inspectOneTrip(repository, project)).resolves.toMatchObject({ reveal: expected });
  });

  it('validates a referenced v2 snapshot and detects malformed unreferenced snapshots', async () => {
    const repository = new FakeRepository();
    repository.documents.get('lgsV4State')!.set('reveal', { open: true, snapshotId: 'valid' });
    repository.documents.get('lgsV4ResultSnapshots')!.set('valid', validSnapshot());
    await expect(inspectOneTrip(repository, project)).resolves.toMatchObject({ reveal: 'open-v2', snapshots: 1 });
    repository.documents.get('lgsV4ResultSnapshots')!.set('unrelated', { schemaVersion: 2 });
    await expect(inspectOneTrip(repository, project)).resolves.toMatchObject({ reveal: 'invalid', snapshots: 2 });
  });

  it('refuses a reset after any started traveler or opened reveal', async () => {
    const started = new FakeRepository();
    started.documents.get('lgsV4Users')!.set('dan', { comparisons: [{ activityA: 'a', activityB: 'b', winner: 'a' }] });
    await expect(resetUntouchedOneTrip(started, project, 'private:7b4e4c19')).rejects.toMatchObject({ code: 'reset-refused' });
    expect(started.deleted).toEqual([]);

    const opened = new FakeRepository();
    opened.documents.get('lgsV4State')!.set('reveal', { open: true });
    await expect(resetUntouchedOneTrip(opened, project, 'private:7b4e4c19')).rejects.toMatchObject({ code: 'reset-refused' });
    expect(opened.deleted).toEqual([]);
  });

  it('deletes only named one-trip documents and proves the post-reset empty state', async () => {
    const repository = new FakeRepository();
    repository.documents.get('lgsV4Users')!.set('unused', {});
    repository.documents.get('lgsV4ResultSnapshots')!.set('orphan', validSnapshot());
    repository.documents.get('lgsV4State')!.set('reveal', { open: false });
    const report = await resetUntouchedOneTrip(repository, project, 'private:7b4e4c19');
    expect(reportIsEmpty(report)).toBe(true);
    expect(repository.deleted).toEqual(expect.arrayContaining([
      { collection: 'lgsV4Users', id: 'unused' },
      { collection: 'lgsV4ResultSnapshots', id: 'orphan' },
      { collection: 'lgsV4State', id: 'reveal' },
    ]));
    expect(repository.deleted.every(({ collection, id }) => collection !== 'lgsV4State' || id === 'reveal')).toBe(true);
  });
});
