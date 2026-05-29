import type { Explication } from '../types'
import { notifyDataChanged } from './storeEvents'

const KEY = 'guess-my-name:explications'

function loadAll(): Explication[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as Explication[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function saveAll(list: Explication[]): void {
  localStorage.setItem(KEY, JSON.stringify(list))
  notifyDataChanged()
}

export function loadExplicationsLocal(): Explication[] {
  return loadAll()
}

export function getExplicationByEnigmeIdLocal(
  enigmeid: string,
): Explication | undefined {
  const id = enigmeid.trim()
  return loadAll().find((e) => e.enigmeid === id)
}

export function saveExplicationLocal(
  enigmeid: string,
  explication: string,
): void {
  const id = enigmeid.trim()
  if (!id) return
  const all = loadAll().filter((e) => e.enigmeid !== id)
  all.push({
    enigmeid: id,
    explication: explication.trim(),
    updatedAtMs: Date.now(),
  })
  saveAll(all)
}

export function deleteExplicationLocal(enigmeid: string): void {
  const id = enigmeid.trim()
  saveAll(loadAll().filter((e) => e.enigmeid !== id))
}
