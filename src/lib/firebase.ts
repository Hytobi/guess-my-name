import { initializeApp, type FirebaseOptions } from 'firebase/app'
import { getAnalytics, isSupported } from 'firebase/analytics'

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
if (measurementId) {
  firebaseConfig.measurementId = measurementId
}

export const firebaseApp = initializeApp(firebaseConfig)

/** Analytics uniquement si supporté (navigateur). */
export async function initFirebaseAnalytics() {
  if (!(await isSupported())) return null
  return getAnalytics(firebaseApp)
}
