// firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import type { FirebaseApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyB1p-Sq0QHX2gkbIVI0-WHRidWARF1zgno",
  authDomain: "spp-app-shiningsun.firebaseapp.com",
  projectId: "spp-app-shiningsun",
  storageBucket: "spp-app-shiningsun.firebasestorage.app",
  messagingSenderId: "1091755506046",
  appId: "1:1091755506046:web:6af2e105d4dc62b60cdb2f",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// ✅ secondary auth buat bikin user TANPA logout superadmin
let secondaryApp: FirebaseApp | null = null;

export function getSecondaryAuth() {
  if (!secondaryApp) secondaryApp = initializeApp(firebaseConfig, "SECONDARY");
  return getAuth(secondaryApp);
}
