import { parseLocalDay } from './dates'

/** Numéro de semaine ISO (1–53) et année ISO. */
export function getIsoWeekParts(d: Date): { year: number; week: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  )
  return { year: date.getUTCFullYear(), week: weekNo }
}

/** Valeur stockée dans `guessList.weeknumber` : année×100 + semaine (ex. 202615). */
export function getCurrentWeeknumber(): number {
  const { year, week } = getIsoWeekParts(new Date())
  return year * 100 + week
}

/** Semaine ISO (année×100+semaine) du jour `date` d’une énigme (`YYYY-MM-DD`). */
export function getWeeknumberFromIsoDate(isoDay: string): number | null {
  const d = parseLocalDay(isoDay)
  if (!d) return null
  const { year, week } = getIsoWeekParts(d)
  return year * 100 + week
}

export function formatWeeknumber(n: number): string {
  const year = Math.floor(n / 100)
  const week = n % 100
  return `Semaine ${week} · ${year}`
}
