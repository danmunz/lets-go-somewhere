import { describe, expect, it } from 'vitest';
import { authEmulatorRehearsalEnabled, rehearsalEmailFor } from './firebaseRehearsal.js';

describe('local Auth Emulator rehearsal guard', () => {
  it('requires both development mode and an explicit opt-in', () => {
    expect(authEmulatorRehearsalEnabled({ DEV: false, VITE_LGS_AUTH_EMULATOR: '1' })).toBe(false);
    expect(authEmulatorRehearsalEnabled({ DEV: true })).toBe(false);
    expect(authEmulatorRehearsalEnabled({ DEV: true, VITE_LGS_AUTH_EMULATOR: '1' })).toBe(true);
  });

  it('uses only disposable non-roster identity addresses', () => {
    expect(rehearsalEmailFor('dan')).toBe('dan@rehearsal.invalid');
  });
});
