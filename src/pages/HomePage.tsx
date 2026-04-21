import { useCallback, useEffect, useMemo, useState } from 'react'
import { useUser } from '../context/UserContext'
import { LoggedTopBar } from '../components/LoggedTopBar'
import { isEnigmeVisibleOnHome } from '../lib/dates'
import {
  countGuessesForEnigme,
  ensureUserProfileForName,
  findGuess,
  getOrCreateUserId,
  loadEnigmes,
  readUserId,
  upsertGuess,
} from '../lib/store'
import { getCurrentWeeknumber } from '../lib/week'

const DATA_EVENT = 'guess-my-name:data'

export function HomePage() {
  const { name } = useUser()
  const userid = readUserId() ?? getOrCreateUserId()

  /** Recalcul périodique pour que la semaine ISO suive le calendrier (onglet ouvert plusieurs jours). */
  const [calendarTick, setCalendarTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setCalendarTick((n) => n + 1), 60_000)
    const onVis = () => {
      if (document.visibilityState === 'visible') setCalendarTick((n) => n + 1)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  const weeknumber = useMemo(
    () => getCurrentWeeknumber(),
    [calendarTick],
  )

  const [enigmes, setEnigmes] = useState(loadEnigmes)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savedHint, setSavedHint] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setEnigmes(loadEnigmes())
  }, [])

  useEffect(() => {
    const onData = () => refresh()
    window.addEventListener(DATA_EVENT, onData)
    return () => window.removeEventListener(DATA_EVENT, onData)
  }, [refresh])

  useEffect(() => {
    if (!name) return
    void ensureUserProfileForName(name)
  }, [name])

  const visibles = useMemo(
    () =>
      enigmes
        .filter((e) => isEnigmeVisibleOnHome(e.date))
        .sort((a, b) => {
          if (a.date < b.date) return 1
          if (a.date > b.date) return -1
          return a.enigmeid.localeCompare(b.enigmeid)
        }),
    [enigmes],
  )

  /** Énigme la plus récente parmi celles déjà « apparues » (date la plus récente). */
  const latestVisibleEnigmeId = visibles[0]?.enigmeid

  const [enigmeCounts, setEnigmeCounts] = useState<Record<string, number>>({})
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const next: Record<string, number> = {}
      for (const e of visibles) {
        try {
          next[e.enigmeid] = await countGuessesForEnigme(e.enigmeid)
        } catch {
          next[e.enigmeid] = 0
        }
      }
      if (!cancelled) setEnigmeCounts(next)
    })()
    return () => {
      cancelled = true
    }
  }, [visibles])

  const isGuessLocked = useCallback(
    (enigmeid: string): boolean => {
      if (!latestVisibleEnigmeId || enigmeid === latestVisibleEnigmeId) return false
      const g = findGuess(userid, weeknumber, enigmeid)
      return (g?.guess ?? '').trim() !== ''
    },
    [latestVisibleEnigmeId, userid, weeknumber],
  )

  useEffect(() => {
    const next: Record<string, string> = {}
    for (const e of visibles) {
      const g = findGuess(userid, weeknumber, e.enigmeid)
      next[e.enigmeid] = g?.guess ?? ''
    }
    setDrafts(next)
  }, [visibles, userid, weeknumber])

  const setDraft = (enigmeid: string, text: string) => {
    if (isGuessLocked(enigmeid)) return
    setDrafts((d) => ({ ...d, [enigmeid]: text }))
    setSavedHint(null)
  }

  const saveGuess = (enigmeid: string) => {
    if (isGuessLocked(enigmeid)) return
    const text = drafts[enigmeid] ?? ''
    const weekAtSave = getCurrentWeeknumber()
    upsertGuess({
      userid,
      weeknumber: weekAtSave,
      enigmeid,
      guess: text,
      userName: name ?? '',
    })
    setCalendarTick((n) => n + 1)
    if (enigmeid === latestVisibleEnigmeId) {
      setSavedHint(
        'Proposition enregistrée ! Vous pouvez la modifier jusqu’à l’apparition de la prochaine énigme.',
      )
    } else {
      setSavedHint('Proposition enregistrée.')
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
      })
    })
  }

  return (
    <div className="layout">
      <LoggedTopBar />

      <main className="main-content">
        {savedHint ? (
          <p className="ok-hint ok-hint-top" role="status">
            {savedHint}
          </p>
        ) : null}

        <section className="panel">
          <h2>Énigmes disponibles</h2>
          <p className="panel-intro">
            <strong>Une nouvelle énigme est disponible chaque Vendredi !</strong>
          </p>

          {visibles.length === 0 ? (
            <p className="empty-state">
              Aucune énigme pour l’instant. Ajoutez-en depuis l’administration.
            </p>
          ) : (
            <ul className="enigme-list">
              {visibles.map((e) => {
                const locked = isGuessLocked(e.enigmeid)
                const isLatest = e.enigmeid === latestVisibleEnigmeId
                const count = enigmeCounts[e.enigmeid] ?? 0
                const countLabel = `NB propositions : ${count}`
                return (
                  <li key={e.enigmeid} className="enigme-card">
                    <div className="enigme-card-head">
                      <h3 className="enigme-title-with-stats">
                        <span className="enigme-libelle">{e.libelle}</span>
                          <span
                            className="enigme-player-count"
                            aria-label={`Nombre de propositions enregistrées : ${count}`}
                          >
                            {' '}
                            ({countLabel})
                          </span>
                      </h3>
                      <time dateTime={e.date}>{e.date}</time>
                    </div>
                    {e.imageDataUrl ? (
                      <img
                        src={e.imageDataUrl}
                        alt=""
                        className="enigme-img"
                      />
                    ) : e.nomFichier ? (
                      <p className="file-hint">Fichier : {e.nomFichier}</p>
                    ) : null}
                    <p className="enigme-message">{e.message}</p>

                    <div
                      className={`guess-block${locked ? ' guess-block-locked' : ''}`}
                    >
                      <label htmlFor={`guess-${e.enigmeid}`}>
                        {locked
                          ? 'Proposition enregistrée — modification possible uniquement sur l’énigme la plus récente.'
                          : isLatest
                            ? 'Votre proposition (modifiable jusqu’à la prochaine énigme)'
                            : 'Votre proposition'}
                      </label>
                      <textarea
                        id={`guess-${e.enigmeid}`}
                        rows={3}
                        readOnly={locked}
                        value={drafts[e.enigmeid] ?? ''}
                        onChange={(ev) => setDraft(e.enigmeid, ev.target.value)}
                        placeholder="Votre réponse ou indice pour cette semaine…"
                      />
                      <button
                        type="button"
                        className="primary narrow"
                        disabled={locked}
                        onClick={() => saveGuess(e.enigmeid)}
                      >
                        Enregistrer
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
