import { initializeApp } from 'firebase/app';
import { GoogleAuthProvider, connectAuthEmulator, createUserWithEmailAndPassword, getAuth, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, type User } from 'firebase/auth';
import type { RosterUser } from '@lgs/shared';
import { authEmulatorRehearsalEnabled, rehearsalEmailFor, REHEARSAL_PASSWORD } from './firebaseRehearsal.js';

const rehearsalEnabled = authEmulatorRehearsalEnabled(import.meta.env);
const emulatorProjectId = import.meta.env.VITE_LGS_EMULATOR_PROJECT_ID ?? 'lgs-emulator-test';
const app = initializeApp({
  apiKey: 'AIzaSyCygEZODClxTMg1B39W-5x-LAKvb-LgQgI',
  authDomain: 'lets-go-somewhere-3549f.firebaseapp.com',
  projectId: rehearsalEnabled ? emulatorProjectId : 'lets-go-somewhere-3549f',
  storageBucket: 'lets-go-somewhere-3549f.firebasestorage.app',
  messagingSenderId: '55259513439',
  appId: '1:55259513439:web:da38d491afa179d41d51ea',
});
const auth = getAuth(app);

if (rehearsalEnabled) {
  const emulatorHost = import.meta.env.VITE_LGS_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
  connectAuthEmulator(auth, `http://${emulatorHost}`, { disableWarnings: true });
}

export const usesAuthEmulatorRehearsal = () => rehearsalEnabled;
export const signInWithGoogle = async () => (await signInWithPopup(auth, new GoogleAuthProvider())).user.getIdToken();

/**
 * Browser-harness-only sign-in: it may create only the five `.invalid`
 * accounts in the locally selected Auth Emulator. It is impossible to call
 * when Vite is building or serving a production bundle.
 */
export const signInWithEmulatorRehearsalUser = async (user: RosterUser) => {
  if (!rehearsalEnabled) throw new Error('The local rehearsal sign-in is unavailable outside development.');
  const email = rehearsalEmailFor(user);
  try {
    return (await signInWithEmailAndPassword(auth, email, REHEARSAL_PASSWORD)).user.getIdToken();
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
    if (code !== 'auth/user-not-found') throw error;
    return (await createUserWithEmailAndPassword(auth, email, REHEARSAL_PASSWORD)).user.getIdToken();
  }
};

/**
 * Firebase restores a persisted Google session asynchronously. The app uses
 * this only to resume a roster member who deliberately selected a character
 * before refresh; it never guesses a roster identity from an email locally.
 */
export const getRestoredGoogleToken = () => new Promise<string | undefined>((resolve) => {
  let unsubscribe: () => void = () => {};
  unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
    unsubscribe();
    resolve(user ? await user.getIdToken() : undefined);
  });
});
