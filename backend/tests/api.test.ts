import { describe, expect, it } from 'vitest';
import { app } from '../src/app.js';

describe('API boundary', () => {
  it('does not require an identity for health checks', async () => expect((await app.request('/health')).status).toBe(200));
  it('returns a destination-blind comparison only to an approved roster user', async () => {
    const response = await app.request('/v1/comparison/next', { headers: { 'X-Demo-User': 'dan' } });
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.activityA.imageUrl).toMatch(/^\/media\/cards\/[^/]+\.webp$/);
    for (const forbidden of ['destinationId', 'name', 'country', 'coordinates', 'gallery', 'photographerName', 'photographerUrl', 'sourceUrl', 'score', 'rank']) {
      expect(payload.activityA[forbidden]).toBeUndefined();
    }
  });
  it('rejects a malformed comparison body', async () => { const response = await app.request('/v1/comparisons', { method: 'POST', headers: { 'X-Demo-User': 'dan', 'content-type': 'application/json' }, body: '{' }); expect(response.status).toBe(400); });
  it('keeps the named destination atlas locked until a participant finishes', async () => {
    const response = await app.request('/v1/atlas', { headers: { 'X-Demo-User': 'james' } });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'Finish the preference game first.' });
  });
  it('returns map and credited-gallery data only after completion', async () => {
    const headers = { 'X-Demo-User': 'matt', 'content-type': 'application/json' };
    for (let index = 0; index < 40; index += 1) {
      const next = await app.request('/v1/comparison/next', { headers });
      const payload = await next.json();
      if (payload.complete) break;
      const response = await app.request('/v1/comparisons', { method: 'POST', headers, body: JSON.stringify({ activityA: payload.activityA.id, activityB: payload.activityB.id, winner: payload.activityA.id }) });
      expect(response.status).toBe(200);
    }
    const response = await app.request('/v1/atlas', { headers });
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.destinations).toHaveLength(24);
    expect(payload.destinations[0]).toMatchObject({ coordinates: { longitude: expect.any(Number), latitude: expect.any(Number) } });
    expect(payload.destinations[0].gallery).toHaveLength(3);
    expect(payload.destinations[0].gallery[0]).toMatchObject({ path: expect.stringMatching(/^\/media\/cards\/[^/]+\.webp$/), photographerName: expect.any(String), photographerUrl: expect.stringMatching(/^https:\/\//), sourceUrl: expect.stringMatching(/^https:\/\/unsplash\.com\/photos\//) });
    expect(payload.destinations[0]).not.toHaveProperty('preferenceScore');
  });
});
