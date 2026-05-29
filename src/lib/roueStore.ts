import type { ParametrageRoue } from '../types'
import { useFirebaseBackend } from './dataMode'
import {
  getRoueSnapshot,
  loadRoueOnceRemote,
  saveRoueRemote,
  startRoueSync,
} from './roueStoreFirebase'
import * as L from './roueStoreLocal'

function ensureRemote(): void {
  if (!useFirebaseBackend()) return
  startRoueSync()
}

export function loadRoueConfig(): ParametrageRoue {
  ensureRemote()
  return useFirebaseBackend() ? getRoueSnapshot() : L.loadRoueLocal()
}

export async function saveRoueConfig(config: ParametrageRoue): Promise<void> {
  if (useFirebaseBackend()) {
    ensureRemote()
    await saveRoueRemote(config)
    return
  }
  L.saveRoueLocal(config)
}

export async function reloadRoueConfig(): Promise<ParametrageRoue> {
  if (useFirebaseBackend()) {
    ensureRemote()
    return loadRoueOnceRemote()
  }
  return L.loadRoueLocal()
}

export function startRoueConfigSync(): void {
  ensureRemote()
}
