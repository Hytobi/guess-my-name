import * as XLSX from 'xlsx'
import type { Enigme, GuessListEntry } from '../types'
import { formatWeeknumber, getWeeknumberFromIsoDate } from './week'

function formatUpdatedAt(ms?: number): string {
  if (ms == null || !Number.isFinite(ms)) return ''
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('fr-FR')
}

function fileNameStamp(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`
}

/** Exporte les propositions affichées (filtres appliqués) en fichier .xlsx. */
export function exportPropositionsExcel(
  guesses: GuessListEntry[],
  enigmeById: Map<string, Enigme>,
): void {
  const rows = guesses.map((g) => {
    const en = enigmeById.get(g.enigmeid)
    const weekFromEnigmeDate =
      en?.date != null ? getWeeknumberFromIsoDate(en.date) : null
    return {
      'Semaine (libellé)':
        weekFromEnigmeDate != null
          ? formatWeeknumber(weekFromEnigmeDate)
          : '',
      'Semaine ISO': weekFromEnigmeDate ?? '',
      'Date énigme': en?.date ?? '',
      Joueur: g.userName?.trim() || '',
      Identifiant: g.userid,
      Énigme: en?.libelle ?? '(énigme inconnue ou supprimée)',
      Proposition: g.guess,
      'Mise à jour': formatUpdatedAt(g.updatedAtMs),
    }
  })

  const sheet = XLSX.utils.json_to_sheet(rows)
  sheet['!cols'] = [
    { wch: 18 },
    { wch: 12 },
    { wch: 12 },
    { wch: 22 },
    { wch: 36 },
    { wch: 28 },
    { wch: 32 },
    { wch: 20 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Propositions')
  XLSX.writeFile(workbook, `propositions_${fileNameStamp()}.xlsx`)
}
