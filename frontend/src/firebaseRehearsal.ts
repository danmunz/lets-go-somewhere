/**
 * The browser rehearsal has a deliberately positive opt-in. `DEV` keeps this
 * unavailable in the production bundle even if someone accidentally supplies
 * a VITE variable during deployment.
 */
export type FirebaseRehearsalEnvironment = {
  DEV: boolean;
  VITE_LGS_AUTH_EMULATOR?: string;
};

export function authEmulatorRehearsalEnabled(environment: FirebaseRehearsalEnvironment): boolean {
  return environment.DEV && environment.VITE_LGS_AUTH_EMULATOR === '1';
}

export const rehearsalEmailFor = (user: string) => `${user}@rehearsal.invalid`;
export const REHEARSAL_PASSWORD = 'rehearsal-password';
