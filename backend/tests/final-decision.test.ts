import { beforeEach, describe, expect, it } from 'vitest';
import { groupResultsResponseSchema } from '@lgs/shared';
import { app } from '../src/app.js';
import { __storeTest } from '../src/store.js';

const headersFor = (user: string) => ({ 'X-Demo-User': user, 'content-type': 'application/json' });

async function complete(user: string) {
  const headers = headersFor(user);
  for (let index = 0; index <= 40; index += 1) {
    const next = await app.request('/v1/comparison/next', { headers });
    const payload = await next.json() as { complete: boolean; activityA?: { id: string }; activityB?: { id: string } };
    if (payload.complete) return;
    const response = await app.request('/v1/comparisons', {
      method: 'POST',
      headers,
      body: JSON.stringify({ activityA: payload.activityA!.id, activityB: payload.activityB!.id, winner: payload.activityA!.id }),
    });
    expect(response.status).toBe(200);
  }
  throw new Error(`${user} did not complete within the bounded game.`);
}

async function openReveal() {
  for (const user of ['dan', 'james', 'john', 'matt', 'peter']) await complete(user);
  const response = await app.request('/v1/reveal', { method: 'POST', headers: headersFor('dan') });
  expect(response.status).toBe(200);
}

describe('immutable post-reveal final decisions', () => {
  beforeEach(() => __storeTest.clearMemory());

  it('keeps final decisions and group results sealed before the immutable snapshot opens', async () => {
    const group = await app.request('/v1/results/group', { headers: headersFor('dan') });
    expect(group.status).toBe(423);
    expect(await group.json()).toEqual({ code: 'reveal-locked', error: 'The group reveal is still closed.' });

    const decision = await app.request('/v1/final-decision', { headers: headersFor('dan') });
    expect(decision.status).toBe(423);
    expect(await decision.json()).toEqual({ code: 'reveal-locked', error: 'The group reveal is still closed.' });
  });

  it('accepts only immutable snapshot finalists or research, and confirms repeats with the existing decision', async () => {
    await openReveal();
    const before = groupResultsResponseSchema.parse(await (await app.request('/v1/results/group', { headers: headersFor('dan') })).json());
    const finalist = before.group[0]!.id;

    const invalid = await app.request('/v1/final-decision', {
      method: 'POST', headers: headersFor('dan'), body: JSON.stringify({ choice: 'not-a-snapshot-finalist' }),
    });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ code: 'invalid-request' });

    const created = await app.request('/v1/final-decision', {
      method: 'POST', headers: headersFor('dan'), body: JSON.stringify({ choice: finalist }),
    });
    expect(created.status).toBe(201);
    const createdPayload = await created.json() as { decision: { user: string; choice: string }; decisions: unknown[] };
    expect(createdPayload.decision).toMatchObject({ user: 'dan', choice: finalist });
    expect(createdPayload.decisions).toHaveLength(1);

    const repeat = await app.request('/v1/final-decision', {
      method: 'POST', headers: headersFor('dan'), body: JSON.stringify({ choice: 'need-more-research' }),
    });
    expect(repeat.status).toBe(409);
    expect(await repeat.json()).toMatchObject({
      code: 'conflict',
      decision: { user: 'dan', choice: finalist },
    });

    const research = await app.request('/v1/final-decision', {
      method: 'POST', headers: headersFor('james'), body: JSON.stringify({ choice: 'need-more-research' }),
    });
    expect(research.status).toBe(201);
    expect(await research.json()).toMatchObject({
      decision: { user: 'james', choice: 'need-more-research' },
    });

    const read = await app.request('/v1/final-decision', { headers: headersFor('dan') });
    expect(read.status).toBe(200);
    expect(await read.json()).toMatchObject({
      decision: { user: 'dan', choice: finalist },
      decisions: expect.arrayContaining([
        expect.objectContaining({ user: 'dan', choice: finalist }),
        expect.objectContaining({ user: 'james', choice: 'need-more-research' }),
      ]),
    });

    const after = groupResultsResponseSchema.parse(await (await app.request('/v1/results/group', { headers: headersFor('james') })).json());
    expect(after.group).toEqual(before.group);
    expect(after.members).toEqual(before.members);
    expect(after.finalistRanks).toEqual(before.finalistRanks);
    expect(after.decisions).toEqual(expect.arrayContaining([
      expect.objectContaining({ user: 'dan', choice: finalist }),
      expect.objectContaining({ user: 'james', choice: 'need-more-research' }),
    ]));
    const raw = JSON.stringify(after);
    for (const forbidden of ['activityA', 'activityB', 'winner', 'comparisons', 'covariance', 'destinationScores', 'attributeScores']) {
      expect(raw).not.toContain(`\"${forbidden}\"`);
    }
  });
});
