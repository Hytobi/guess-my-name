import type { ParametrageRoue, RoueSegment } from '../types'

/** Palette pour garantir des fonds distincts entre les parts de la roue. */
export const ROUE_SEGMENT_COLORS = [
  '#e74c3c',
  '#3498db',
  '#2ecc71',
  '#f39c12',
  '#9b59b6',
  '#1abc9c',
  '#e67e22',
  '#16a085',
  '#c0392b',
  '#2980b9',
  '#8e44ad',
  '#27ae60',
] as const

export const ROUE_CONFIG_DOC_ID = 'default'

/** Normalise une couleur pour l’aperçu admin et la roue (format #rrggbb). */
export function normalizeSegmentColor(input: string): string {
  const t = input.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(t)) {
    const h = t.slice(1)
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase()
  }
  return '#888888'
}

export function nextRoueSegmentColor(used: string[]): string {
  const set = new Set(used.map((c) => c.toLowerCase()))
  const free = ROUE_SEGMENT_COLORS.find((c) => !set.has(c.toLowerCase()))
  if (free) return free
  const i = used.length % ROUE_SEGMENT_COLORS.length
  return ROUE_SEGMENT_COLORS[i]
}

export function createEmptySegment(usedColors: string[]): RoueSegment {
  return {
    id: crypto.randomUUID(),
    label: 'Nouveau',
    backgroundColor: nextRoueSegmentColor(usedColors),
  }
}

export function defaultParametrageRoue(): ParametrageRoue {
  const s1 = createEmptySegment([])
  const s2 = createEmptySegment([s1.backgroundColor])
  const s3 = createEmptySegment([s1.backgroundColor, s2.backgroundColor])
  return {
    id: ROUE_CONFIG_DOC_ID,
    segments: [
      { ...s1, label: 'Lot 1' },
      { ...s2, label: 'Lot 2' },
      { ...s3, label: 'Lot 3' },
    ],
    cheatModeEnabled: false,
    phase1: { durationMs: 5000, stopSegmentIndex: 0 },
    phase2: { pauseBeforeSpinMs: 2000, spinDurationMs: 5000, stopSegmentIndex: 1 },
    updatedAtMs: Date.now(),
  }
}
