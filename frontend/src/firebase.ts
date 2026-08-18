import { initializeApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, type User } from 'firebase/auth';

const app = initializeApp({ apiKey: 'AIzaSyCygEZODClxTMg1B39W-5x-LAKvb-LgQgI', authDomain: 'lets-go-somewhere-3549f.firebaseapp.com', projectId: 'lets-go-somewhere-3549f', storageBucket: 'lets-go-somewhere-3549f.firebasestorage.app', messagingSenderId: '55259513439', appId: '1:55259513439:web:da38d491afa179d41d51ea' });
export const signInWithGoogle = async () => (await signInWithPopup(getAuth(app), new GoogleAuthProvider())).user.getIdToken();

/**
 * Firebase restores a persisted Google session asynchronously. The app uses
 * this only to resume a roster member who deliberately selected a character
 * before refresh; it never guesses a roster identity from an email locally.
 */
export const getRestoredGoogleToken = () => new Promise<string | undefined>((resolve) => {
  const auth = getAuth(app);
  let unsubscribe: () => void = () => {};
  unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
    unsubscribe();
    resolve(user ? await user.getIdToken() : undefined);
  });
});
