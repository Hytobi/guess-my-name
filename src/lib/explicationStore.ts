import type { Explication } from '../types'
import { useFirebaseBackend } from './dataMode'
import {
  getExplicationByEnigmeId as getRemote,
  getExplicationsSnapshot,
  saveExplicationRemote,
  startExplicationsSync,
} from './explicationStoreFirebase'
import * as L from './explicationStoreLocal'

function ensureRemote(): void {
  if (!useFirebaseBackend()) return
  startExplicationsSync()
}

export function loadExplications(): Explication[] {
  ensureRemote()
  return useFirebaseBackend() ? getExplicationsSnapshot() : L.loadExplicationsLocal()
}

export function getExplicationByEnigmeId(
  enigmeid: string,
): Explication | undefined {
  ensureRemote()
  return useFirebaseBackend()
    ? getRemote(enigmeid)
    : L.getExplicationByEnigmeIdLocal(enigmeid)
}

export async function saveExplication(
  enigmeid: string,
  explication: string,
): Promise<void> {
  if (useFirebaseBackend()) {
    ensureRemote()
    await saveExplicationRemote(enigmeid, explication)
    return
  }
  L.saveExplicationLocal(enigmeid, explication)
}

export function startExplicationConfigSync(): void {
  ensureRemote()
}
