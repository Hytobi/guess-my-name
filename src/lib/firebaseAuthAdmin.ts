import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { firebaseApp } from './firebase'
import { useFirebaseBackend } from './dataMode'

function auth() {
  return getAuth(firebaseApp)
}

/**
 * Après validation du mot de passe admin applicatif : connexion Firebase pour les
 * opérations Storage (si variables d’environnement présentes).
 * @returns true si une session Firebase admin est active, false si ignoré (dev local ou env manquant).
 */
export async function signInFirebaseAdminAfterGate(): Promise<boolean> {
  if (!useFirebaseBackend()) return false
  const email = import.meta.env.VITE_FIREBASE_ADMIN_EMAIL?.trim()
  const password = import.meta.env.VITE_FIREBASE_ADMIN_PASSWORD
  if (!email || !password) {
    console.warn(
      '[Firebase] VITE_FIREBASE_ADMIN_EMAIL / VITE_FIREBASE_ADMIN_PASSWORD absents : écriture Storage désactivée pour cette session.',
    )
    return false
  }
  await signInWithEmailAndPassword(auth(), email, password)
  return true
}

export async function signOutFirebaseAdmin(): Promise<void> {
  if (!useFirebaseBackend()) return
  try {
    await signOut(auth())
  } catch {
    /* ignore */
  }
}
