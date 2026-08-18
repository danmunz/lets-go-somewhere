import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { ROSTER, type RosterUser } from './store.js';
import { allowsDemoIdentity } from './runtime.js';

type RosterEmails = Partial<Record<RosterUser, string | string[]>>;
const configuredRoster = (): RosterEmails => JSON.parse(process.env.ROSTER_EMAILS ?? '{}') as RosterEmails;

export async function authenticate(authorization: string | undefined, demoUser: string | undefined): Promise<RosterUser | undefined> {
  if (allowsDemoIdentity()) return ROSTER.find((user) => user === demoUser);
  if (!authorization?.startsWith('Bearer ')) return undefined;
  if (!getApps().length) initializeApp();
  let decoded: Awaited<ReturnType<ReturnType<typeof getAuth>['verifyIdToken']>>;
  try {
    decoded = await getAuth().verifyIdToken(authorization.slice(7));
  } catch {
    // Firebase intentionally exposes detailed verification failures. They are
    // useful in server logs, but an expired/malformed token is only a normal
    // re-authentication state for the traveler.
    return undefined;
  }
  const email = decoded.email?.toLowerCase();
  if (!email) return undefined;
  return ROSTER.find((user) => {
    const approved = configuredRoster()[user];
    return (Array.isArray(approved) ? approved : [approved]).some((candidate) => candidate?.toLowerCase() === email);
  });
}
