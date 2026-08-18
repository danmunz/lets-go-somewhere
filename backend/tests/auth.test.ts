import { afterEach, describe, expect, it, vi } from 'vitest';

const verifyIdToken = vi.hoisted(() => vi.fn());
vi.mock('firebase-admin/app', () => ({ getApps: () => [{}], initializeApp: vi.fn() }));
vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({ verifyIdToken }) }));

import { authenticate } from '../src/auth.js';
import { app } from '../src/app.js';

afterEach(() => vi.unstubAllEnvs());

describe('authentication runtime guard', () => {
  it('accepts a demo header only after an explicit local opt-in', async () => {
    vi.stubEnv('K_SERVICE', '');
    vi.stubEnv('LGS_TEST_MODE', 'demo');
    expect(await authenticate(undefined, 'dan')).toBe('dan');
  });

  it('rejects a demo header whenever Cloud Run is present, even with a test flag', async () => {
    vi.stubEnv('K_SERVICE', 'lgs-api');
    vi.stubEnv('LGS_TEST_MODE', 'demo');
    expect(await authenticate(undefined, 'dan')).toBeUndefined();
  });

  it('turns invalid Firebase verification into the existing recoverable 401 without exposing Firebase details', async () => {
    vi.stubEnv('K_SERVICE', '');
    vi.stubEnv('LGS_TEST_MODE', '');
    verifyIdToken.mockRejectedValueOnce(new Error('auth/id-token-expired: internal Firebase detail'));

    const response = await app.request('/v1/session', { headers: { Authorization: 'Bearer expired-token' } });
    expect(response.status).toBe(401);
    const payload = await response.json() as { error: string };
    expect(payload).toEqual({ error: 'Sign in with an approved roster account.' });
    expect(JSON.stringify(payload)).not.toContain('Firebase');
  });
});
