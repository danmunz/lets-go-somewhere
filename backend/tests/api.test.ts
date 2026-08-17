import { describe, expect, it } from 'vitest';
import { app } from '../src/app.js';

describe('API boundary', () => {
  it('does not require an identity for health checks', async () => expect((await app.request('/health')).status).toBe(200));
  it('returns a destination-blind comparison only to an approved roster user', async () => { const response = await app.request('/v1/comparison/next', { headers: { 'X-Demo-User': 'dan' } }); const payload = await response.json(); expect(response.status).toBe(200); expect(payload.activityA.destinationId).toBeUndefined(); expect(payload.activityA.country).toBeUndefined(); });
  it('rejects a malformed comparison body', async () => { const response = await app.request('/v1/comparisons', { method: 'POST', headers: { 'X-Demo-User': 'dan', 'content-type': 'application/json' }, body: '{' }); expect(response.status).toBe(400); });
});
