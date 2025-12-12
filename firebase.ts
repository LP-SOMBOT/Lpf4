import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

// REPLACE WITH YOUR FIREBASE CONFIGURATION
const firebaseConfig = {
  apiKey: "AIzaSyCXt3G4mGZE4sNf1DwVIaQYPAxsJ7smKlo",
  authDomain: "lp-f4-fcb08.firebaseapp.com",
  databaseURL: "https://lp-f4-fcb08-default-rtdb.firebaseio.com",
  projectId: "lp-f4-fcb08",
  storageBucket: "lp-f4-fcb08.firebasestorage.app",
  messagingSenderId: "603327699524",
  appId: "1:603327699524:web:76512d16b9779ffdce7a11"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);