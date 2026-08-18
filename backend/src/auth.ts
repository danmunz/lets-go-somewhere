import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { ROSTER, type RosterUser } from './store.js';

type RosterEmails = Partial<Record<RosterUser, string | string[]>>;
const configuredRoster = (): RosterEmails => JSON.parse(process.env.ROSTER_EMAILS ?? '{}') as RosterEmails;

export async function authenticate(authorization: string | undefined, demoUser: string | undefined): Promise<RosterUser | undefined> {
  if (process.env.NODE_ENV !== 'production') return ROSTER.find((user) => user === demoUser);
  if (!authorization?.startsWith('Bearer ')) return undefined;
  if (!getApps().length) initializeApp();
  const decoded = await getAuth().verifyIdToken(authorization.slice(7));
  const email = decoded.email?.toLowerCase();
  if (!email) return undefined;
  return ROSTER.find((user) => {
    const approved = configuredRoster()[user];
    return (Array.isArray(approved) ? approved : [approved]).some((candidate) => candidate?.toLowerCase() === email);
  });
}
