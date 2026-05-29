import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  setDoc,
  type Unsubscribe,
  type DocumentData,
} from 'firebase/firestore'
import type { Explication } from '../types'
import { firebaseApp } from './firebase'
import { notifyDataChanged } from './storeEvents'

let db = getFirestore(firebaseApp)
let explicationsCache: Explication[] = []
let unsubExplications: Unsubscribe | null = null

function explicationFromDoc(id: string, raw: DocumentData): Explication | null {
  const enigmeid = String(raw.enigmeid ?? id).trim()
  const explication = String(raw.explication ?? '').trim()
  if (!enigmeid) return null
  return {
    enigmeid,
    explication,
    updatedAtMs:
      typeof raw.updatedAtMs === 'number' ? raw.updatedAtMs : undefined,
  }
}

export function startExplicationsSync(): void {
  if (unsubExplications) return
  unsubExplications = onSnapshot(
    collection(db, 'explications'),
    (snap) => {
      explicationsCache = snap.docs
        .map((d) => explicationFromDoc(d.id, d.data()))
        .filter((e): e is Explication => e !== null)
      notifyDataChanged()
    },
    (err) => {
      console.error('[Guess my name] Firestore explications:', err)
    },
  )
}

export function getExplicationsSnapshot(): Explication[] {
  return explicationsCache.map((e) => ({ ...e }))
}

export function getExplicationByEnigmeId(enigmeid: string): Explication | undefined {
  const id = enigmeid.trim()
  return explicationsCache.find((e) => e.enigmeid === id)
}

export async function saveExplicationRemote(
  enigmeid: string,
  explication: string,
): Promise<void> {
  const id = enigmeid.trim()
  if (!id) return
  const entry: Explication = {
    enigmeid: id,
    explication: explication.trim(),
    updatedAtMs: Date.now(),
  }
  const idx = explicationsCache.findIndex((e) => e.enigmeid === id)
  if (idx >= 0) explicationsCache[idx] = entry
  else explicationsCache.push(entry)
  notifyDataChanged()
  await setDoc(doc(db, 'explications', id), {
    enigmeid: id,
    explication: entry.explication,
    updatedAtMs: entry.updatedAtMs,
  })
  notifyDataChanged()
}

export async function deleteExplicationRemote(enigmeid: string): Promise<void> {
  const id = enigmeid.trim()
  if (!id) return
  explicationsCache = explicationsCache.filter((e) => e.enigmeid !== id)
  notifyDataChanged()
  await deleteDoc(doc(db, 'explications', id))
  notifyDataChanged()
}
