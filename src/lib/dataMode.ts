/**
 * Données métier : Firestore en build production, localStorage en développement.
 * Forcer Firestore en local : `VITE_USE_FIREBASE=true`
 * Forcer localStorage en preview prod : `VITE_USE_FIREBASE=false`
 */
export function useFirebaseBackend(): boolean {
  const v = import.meta.env.VITE_USE_FIREBASE
  if (v === 'true') return true
  if (v === 'false') return false
  return import.meta.env.PROD
}
