import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

/**
 * Firebase Web app for the cashraja-prod project. These values are public by
 * design (safe to ship in client code) — access is restricted by Firebase
 * Authorized Domains + backend ID-token verification, not by hiding the key.
 */
const firebaseConfig = {
  apiKey: 'AIzaSyBIyEizgC-NB2r9LHKv8JFYx_czUzD8I10',
  authDomain: 'cashraja-prod.firebaseapp.com',
  projectId: 'cashraja-prod',
  storageBucket: 'cashraja-prod.firebasestorage.app',
  messagingSenderId: '60588979841',
  appId: '1:60588979841:web:8515fceb3b0dbe11afff80',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
