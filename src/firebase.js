import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Config pública de Firebase (la seguridad real está en las reglas de Firestore)
const app = initializeApp({
  apiKey: 'AIzaSyDGfWj0TKSKPqQmtmVvAjaRwcSRP8ThHVQ',
  authDomain: 'unalspa.firebaseapp.com',
  projectId: 'unalspa',
  storageBucket: 'unalspa.firebasestorage.app',
  messagingSenderId: '262261060132',
  appId: '1:262261060132:web:21116990b8a1fda92c1eb1'
});
export const auth = getAuth(app);
export const db = getFirestore(app);
export const provider = new GoogleAuthProvider();
