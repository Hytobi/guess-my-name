/** Parse une date `YYYY-MM-DD` en jour local minuit. */
export function parseLocalDay(isoDay: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDay.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const dt = new Date(y, mo - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d)
    return null
  return dt
}

/** Début du jour courant (local). */
export function startOfToday(): Date {
  const t = new Date()
  return new Date(t.getFullYear(), t.getMonth(), t.getDate())
}

/**
 * Énigmes affichées sur l’accueil : jour du champ `date` strictement avant le jour courant (local).
 */
export function isEnigmeVisibleOnHome(isoDay: string): boolean {
  const enigmeDay = parseLocalDay(isoDay)
  if (!enigmeDay) return false
  return enigmeDay.getTime() < startOfToday().getTime()
}

export function todayIsoDay(): string {
  const t = new Date()
  const y = t.getFullYear()
  const m = String(t.getMonth() + 1).padStart(2, '0')
  const d = String(t.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
