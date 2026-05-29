import {
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  setDoc,
  type Unsubscribe,
  type DocumentData,
} from 'firebase/firestore'
import type { ParametrageRoue, RoueCheatPhase1, RoueCheatPhase2, RoueSegment } from '../types'
import { firebaseApp } from './firebase'
import {
  defaultParametrageRoue,
  normalizeSegmentColor,
  ROUE_CONFIG_DOC_ID,
} from './roueDefaults'
import { notifyDataChanged } from './storeEvents'

let db = getFirestore(firebaseApp)
let roueCache: ParametrageRoue = defaultParametrageRoue()
let unsubRoue: Unsubscribe | null = null

function segmentFromRaw(raw: unknown): RoueSegment | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = String(o.id ?? '').trim()
  const label = String(o.label ?? '').trim()
  const backgroundColor = normalizeSegmentColor(
    String(o.backgroundColor ?? '#888888'),
  )
  if (!id || !label) return null
  return { id, label, backgroundColor }
}

function phase1FromRaw(raw: unknown): RoueCheatPhase1 {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    durationMs: Math.max(500, Number(o.durationMs ?? 5000)),
    stopSegmentIndex: Math.max(0, Number(o.stopSegmentIndex ?? 0)),
  }
}

function phase2FromRaw(raw: unknown): RoueCheatPhase2 {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    pauseBeforeSpinMs: Math.max(0, Number(o.pauseBeforeSpinMs ?? 2000)),
    spinDurationMs: Math.max(500, Number(o.spinDurationMs ?? 5000)),
    stopSegmentIndex: Math.max(0, Number(o.stopSegmentIndex ?? 0)),
  }
}

function parametrageFromDoc(id: string, raw: DocumentData): ParametrageRoue {
  const segmentsRaw = Array.isArray(raw.segments) ? raw.segments : []
  const segments = segmentsRaw
    .map(segmentFromRaw)
    .filter((s): s is RoueSegment => s !== null)
  const base = defaultParametrageRoue()
  return {
    id,
    segments: segments.length >= 2 ? segments : base.segments,
    cheatModeEnabled: Boolean(raw.cheatModeEnabled),
    phase1: phase1FromRaw(raw.phase1),
    phase2: phase2FromRaw(raw.phase2),
    updatedAtMs:
      typeof raw.updatedAtMs === 'number' ? raw.updatedAtMs : undefined,
  }
}

function parametrageToData(c: ParametrageRoue): Record<string, unknown> {
  return {
    segments: c.segments.map((s) => ({
      id: s.id,
      label: s.label,
      backgroundColor: s.backgroundColor,
    })),
    cheatModeEnabled: c.cheatModeEnabled,
    phase1: {
      durationMs: c.phase1.durationMs,
      stopSegmentIndex: c.phase1.stopSegmentIndex,
    },
    phase2: {
      pauseBeforeSpinMs: c.phase2.pauseBeforeSpinMs,
      spinDurationMs: c.phase2.spinDurationMs,
      stopSegmentIndex: c.phase2.stopSegmentIndex,
    },
    updatedAtMs: c.updatedAtMs ?? Date.now(),
  }
}

export function startRoueSync(): void {
  if (unsubRoue) return
  const ref = doc(db, 'parametrage_roue', ROUE_CONFIG_DOC_ID)
  unsubRoue = onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        roueCache = parametrageFromDoc(snap.id, snap.data())
      } else {
        roueCache = defaultParametrageRoue()
      }
      notifyDataChanged()
    },
    (err) => {
      console.error('[Guess my name] Firestore parametrage_roue:', err)
    },
  )
}

export function getRoueSnapshot(): ParametrageRoue {
  return {
    ...roueCache,
    segments: roueCache.segments.map((s) => ({ ...s })),
    phase1: { ...roueCache.phase1 },
    phase2: { ...roueCache.phase2 },
  }
}

export async function loadRoueOnceRemote(): Promise<ParametrageRoue> {
  const ref = doc(db, 'parametrage_roue', ROUE_CONFIG_DOC_ID)
  const snap = await getDoc(ref)
  if (snap.exists()) {
    roueCache = parametrageFromDoc(snap.id, snap.data())
  } else {
    roueCache = defaultParametrageRoue()
  }
  notifyDataChanged()
  return getRoueSnapshot()
}

export async function saveRoueRemote(config: ParametrageRoue): Promise<void> {
  const next: ParametrageRoue = {
    ...config,
    id: ROUE_CONFIG_DOC_ID,
    updatedAtMs: Date.now(),
  }
  roueCache = next
  notifyDataChanged()
  const ref = doc(db, 'parametrage_roue', ROUE_CONFIG_DOC_ID)
  await setDoc(ref, parametrageToData(next), { merge: true })
  notifyDataChanged()
}
