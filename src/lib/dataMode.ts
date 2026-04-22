/**
 * Données métier : Firestore en build production, localStorage en développement.
 * Forcer Firestore en local : `VITE_USE_FIREBASE=true`
 * Forcer localStorage en preview prod : `VITE_USE_FIREBASE=false`
 */
export function useFirebaseBackend(): boolean {
  const v = import.meta.env.VITE_USE_FIREBASE
  if (v === 'true') return true
  if (v === 'false') return false

  // On n’active Firebase que si la config minimale est présente.
  // Sinon, en prod déployée on peut se retrouver avec une app "vide"
  // si les variables d’env ne sont pas injectées au build.
  const hasFirebaseConfig = Boolean(
    import.meta.env.VITE_FIREBASE_PROJECT_ID &&
      import.meta.env.VITE_FIREBASE_API_KEY &&
      import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  )

  // Par défaut : Firestore si configuré, sinon localStorage.
  // (En prod, cela évite une page vide si Firebase n’est pas configuré.)
  return hasFirebaseConfig
}
