import { describe, expect, it } from 'vitest';
import { ApiError, createApiClient, routeIntentForApiError } from './api.js';

describe('one-trip API state mapping', () => {
  it('routes sealed results to the waiting room without trying to render them', () => {
    expect(routeIntentForApiError(new ApiError(423, 'The envelope is sealed.', {}), 'group-results')).toBe('show-waiting');
    expect(routeIntentForApiError(new ApiError(423, 'The envelope is sealed.', {}), 'personal-results')).toBe('show-waiting');
  });

  it('returns an incomplete traveler to the blind game for completion-gated content', () => {
    expect(routeIntentForApiError(new ApiError(409, 'Finish first.', {}), 'atlas')).toBe('return-to-comparison');
  });

  it('treats an immutable repeat decision as an already-recorded state', () => {
    expect(routeIntentForApiError(new ApiError(409, 'Already recorded.', {}), 'final-decision')).toBe('use-recorded-decision');
  });

  it('keeps authorization failures distinct from ordinary retryable errors', () => {
    expect(routeIntentForApiError(new ApiError(401, 'Sign in.', {}), 'profile')).toBe('show-sign-in');
    expect(routeIntentForApiError(new ApiError(403, 'No access.', {}), 'profile')).toBe('show-access-error');
  });

  it('uses the authenticated session route before resuming a character and submits only a blind comparison shape', async () => {
    const calls: Array<{ path: string; init?: RequestInit }> = [];
    const client = createApiClient({ user: 'dan', token: 'test-token' }, async (path, init) => {
      calls.push({ path: String(path), init });
      const response = String(path).endsWith('/v1/session')
        ? { user: 'dan', roster: ['dan', 'james', 'john', 'matt', 'peter'] }
        : { accepted: true };
      return new Response(JSON.stringify(response), { headers: { 'content-type': 'application/json' } });
    });

    await expect(client.getSession()).resolves.toMatchObject({ user: 'dan' });
    await expect(client.submitComparison({ activityA: 'a-1', activityB: 'b-1', winner: 'a-1' })).resolves.toEqual({ accepted: true });

    expect(calls.map((call) => call.path)).toEqual(['/v1/session', '/v1/comparisons']);
    expect(calls[0]?.init?.headers && new Headers(calls[0].init.headers).get('Authorization')).toBe('Bearer test-token');
    expect(calls[1]?.init?.body).toBe(JSON.stringify({ activityA: 'a-1', activityB: 'b-1', winner: 'a-1' }));
  });

  it('keeps the pre-decision response nullable instead of mistaking it for a malformed saved decision', async () => {
    const client = createApiClient({ user: 'dan' }, async () => new Response(JSON.stringify({ decision: null, decisions: [] }), {
      headers: { 'content-type': 'application/json' },
    }));

    await expect(client.getFinalDecision()).resolves.toEqual({ decision: null, decisions: [] });
  });
});
