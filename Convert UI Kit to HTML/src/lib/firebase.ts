// Firebase SDK initialization
// Config is loaded from the Flask backend so we don't need to hardcode secrets in the frontend.

import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

let authInstance: ReturnType<typeof getAuth> | null = null;
let googleProviderInstance: GoogleAuthProvider | null = null;

export async function initFirebase() {
  if (authInstance) return { auth: authInstance, googleProvider: googleProviderInstance! };

  // Fetch config from Flask backend
  const res = await fetch("/api/firebase_config");
  if (!res.ok) throw new Error("Failed to load Firebase config");
  const config = await res.json();

  const app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
  authInstance = getAuth(app);
  googleProviderInstance = new GoogleAuthProvider();

  return { auth: authInstance, googleProvider: googleProviderInstance };
}

export function getFirebaseAuth() {
  return authInstance;
}
