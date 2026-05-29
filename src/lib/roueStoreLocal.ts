import type { ParametrageRoue } from '../types'
import { defaultParametrageRoue } from './roueDefaults'
import { notifyDataChanged } from './storeEvents'

const KEY_ROUE = 'guess-my-name:parametrage-roue'

function safeParse(raw: string | null): ParametrageRoue | null {
  if (!raw) return null
  try {
    const o = JSON.parse(raw) as ParametrageRoue
    if (!o || !Array.isArray(o.segments) || o.segments.length < 2) return null
    return o
  } catch {
    return null
  }
}

export function loadRoueLocal(): ParametrageRoue {
  const parsed = safeParse(localStorage.getItem(KEY_ROUE))
  return parsed ?? defaultParametrageRoue()
}

export function saveRoueLocal(config: ParametrageRoue): void {
  const next = { ...config, updatedAtMs: Date.now() }
  localStorage.setItem(KEY_ROUE, JSON.stringify(next))
  notifyDataChanged()
}
