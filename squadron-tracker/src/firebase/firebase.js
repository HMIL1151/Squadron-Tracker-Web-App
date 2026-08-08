import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

//api info found at https://console.firebase.google.com/u/0/project/squadron-tracker-1151/settings/general/web:ZWExYTE0MjMtMmM2NS00MGRiLWE4ZTgtZjY2OWY2ZjAzOWRk

// Firebase configuration from environment variables
const firebaseConfig = {
    apiKey: import.meta.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: import.meta.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.REACT_APP_FIREBASE_APP_ID
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();