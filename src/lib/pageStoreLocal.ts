import type { PageConfig } from '../types'
import { notifyDataChanged } from './storeEvents'

const KEY = 'guess-my-name:pages'

function loadMap(): Record<string, PageConfig> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const o = JSON.parse(raw) as Record<string, PageConfig>
    return o && typeof o === 'object' ? o : {}
  } catch {
    return {}
  }
}

function saveMap(map: Record<string, PageConfig>): void {
  localStorage.setItem(KEY, JSON.stringify(map))
  notifyDataChanged()
}

export function getPageLocal(name: string): PageConfig {
  const key = name.trim()
  return loadMap()[key] ?? { name: key, enabled: false }
}

export function isPageEnabledLocal(name: string): boolean {
  return getPageLocal(name).enabled
}

export function setPageEnabledLocal(name: string, enabled: boolean): void {
  const key = name.trim()
  const map = loadMap()
  map[key] = { name: key, enabled }
  saveMap(map)
}
