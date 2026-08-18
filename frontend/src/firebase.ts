import { initializeApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth, signInWithPopup } from 'firebase/auth';

const app = initializeApp({ apiKey: 'AIzaSyCygEZODClxTMg1B39W-5x-LAKvb-LgQgI', authDomain: 'lets-go-somewhere-3549f.firebaseapp.com', projectId: 'lets-go-somewhere-3549f', storageBucket: 'lets-go-somewhere-3549f.firebasestorage.app', messagingSenderId: '55259513439', appId: '1:55259513439:web:da38d491afa179d41d51ea' });
export const signInWithGoogle = async () => (await signInWithPopup(getAuth(app), new GoogleAuthProvider())).user.getIdToken();
