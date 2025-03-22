import { initializeApp } from "firebase/app";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDq7K5hW57NNnpcVRp9JTta0Ln22RXJuS8",
    authDomain: "squadron-tracker-1151.firebaseapp.com",
    projectId: "squadron-tracker-1151",
    storageBucket: "squadron-tracker-1151.firebasestorage.app",
    messagingSenderId: "179784073335",
    appId: "1:179784073335:web:c035d4853d7e94d808c672"
  };
  
export const app=initializeApp(firebaseConfig);