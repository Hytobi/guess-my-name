import type { PageConfig } from '../types'
import { useFirebaseBackend } from './dataMode'
import {
  getPageSnapshot,
  isPageEnabled as isPageEnabledRemote,
  loadPageOnceRemote,
  PAGE_RESULTAT,
  setPageEnabledRemote,
  startPagesSync,
} from './pageStoreFirebase'
import * as L from './pageStoreLocal'

export { PAGE_RESULTAT }

function ensureRemote(): void {
  if (!useFirebaseBackend()) return
  startPagesSync()
}

export function isPageEnabled(name: string): boolean {
  ensureRemote()
  return useFirebaseBackend()
    ? isPageEnabledRemote(name)
    : L.isPageEnabledLocal(name)
}

export function getPageConfig(name: string): PageConfig {
  ensureRemote()
  const key = name.trim()
  if (useFirebaseBackend()) {
    return getPageSnapshot(key) ?? { name: key, enabled: false }
  }
  return L.getPageLocal(key)
}

export async function setPageEnabled(
  name: string,
  enabled: boolean,
): Promise<void> {
  if (useFirebaseBackend()) {
    ensureRemote()
    await setPageEnabledRemote(name, enabled)
    return
  }
  L.setPageEnabledLocal(name, enabled)
}

export function startPageConfigSync(): void {
  ensureRemote()
}

/** Joueurs : `page/resultat.enabled`. Admins (hors aperçu joueur) : toujours. */
export function canAccessResultatPage(
  pageEnabled: boolean,
  isAdminVerified: boolean,
  viewAsPlayer: boolean,
): boolean {
  return pageEnabled || (isAdminVerified && !viewAsPlayer)
}

export async function ensurePageLoaded(name: string): Promise<PageConfig> {
  const key = name.trim()
  if (useFirebaseBackend()) {
    try {
      ensureRemote()
      return await loadPageOnceRemote(key)
    } catch (err) {
      console.error('[Guess my name] lecture page Firestore:', err)
      return { name: key, enabled: false }
    }
  }
  return L.getPageLocal(key)
}
