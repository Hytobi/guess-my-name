import {
  collection,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  setDoc,
  type Unsubscribe,
  type DocumentData,
} from 'firebase/firestore'
import type { PageConfig } from '../types'
import { firebaseApp } from './firebase'
import { notifyDataChanged } from './storeEvents'

export const PAGE_RESULTAT = 'resultat'

let db = getFirestore(firebaseApp)
const pagesCache = new Map<string, PageConfig>()
let unsubPages: Unsubscribe | null = null

function pageFromDoc(id: string, raw: DocumentData): PageConfig {
  return {
    name: String(raw.name ?? id).trim() || id,
    enabled: Boolean(raw.enabled),
  }
}

export function startPagesSync(): void {
  if (unsubPages) return
  unsubPages = onSnapshot(
    collection(db, 'page'),
    (snap) => {
      pagesCache.clear()
      snap.docs.forEach((d) => {
        pagesCache.set(d.id, pageFromDoc(d.id, d.data()))
      })
      notifyDataChanged()
    },
    (err) => {
      console.error('[Guess my name] Firestore page:', err)
    },
  )
}

export function getPageSnapshot(name: string): PageConfig | undefined {
  const key = name.trim()
  return pagesCache.get(key)
}

export function isPageEnabled(name: string): boolean {
  return getPageSnapshot(name)?.enabled ?? false
}

export async function setPageEnabledRemote(
  name: string,
  enabled: boolean,
): Promise<void> {
  const key = name.trim()
  if (!key) return
  const entry: PageConfig = { name: key, enabled }
  pagesCache.set(key, entry)
  notifyDataChanged()
  await setDoc(
    doc(db, 'page', key),
    { name: key, enabled },
    { merge: true },
  )
  notifyDataChanged()
}

export async function loadPageOnceRemote(name: string): Promise<PageConfig> {
  const key = name.trim()
  const ref = doc(db, 'page', key)
  const snap = await getDoc(ref)
  if (snap.exists()) {
    const entry = pageFromDoc(snap.id, snap.data())
    pagesCache.set(key, entry)
    notifyDataChanged()
    return entry
  }
  const fallback: PageConfig = { name: key, enabled: false }
  pagesCache.set(key, fallback)
  return fallback
}
