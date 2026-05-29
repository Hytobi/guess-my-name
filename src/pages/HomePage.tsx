import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { LoggedTopBar } from '../components/LoggedTopBar'
import { useDispatch, useSelector } from 'react-redux'
import {
  countGuessesForEnigme,
  ensureUserProfileForName,
  findUserGuessForEnigme,
  loadEnigmes,
  enableAdminEnigmesSync,
  forceSyncHomeEnigmesForToday,
  reloadPlayerDataNow,
  syncHomeEnigmesForToday,
  upsertGuess,
} from '../lib/store'
import { setViewAsPlayer } from '../state/adminSlice'
import type { RootState } from '../state/store'
import { getCurrentWeeknumber } from '../lib/week'
import { useFirebaseBackend } from '../lib/dataMode'
import {
  canAccessResultatPage,
  isPageEnabled,
  PAGE_RESULTAT,
  startPageConfigSync,
} from '../lib/pageStore'
import { EnigmeImage } from '../components/EnigmeImage'

const DATA_EVENT = 'guess-my-name:data'

export function HomePage() {
  const { name, user } = useUser()
  const userid = user?.uid ?? ''
  const dispatch = useDispatch()
  const isAdminVerified = useSelector((s: RootState) => s.admin.isAdminVerified)
  const viewAsPlayer = useSelector((s: RootState) => s.admin.viewAsPlayer)
  const usingFirebase = useFirebaseBackend()

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

  const [enigmes, setEnigmes] = useState(loadEnigmes)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savedHint, setSavedHint] = useState<string | null>(null)
  const [reloadHint, setReloadHint] = useState<string | null>(null)
  const [reloading, setReloading] = useState(false)
  const [pageResultatEnabled, setPageResultatEnabled] = useState(() =>
    isPageEnabled(PAGE_RESULTAT),
  )

  const showDecouvrirPrenom = canAccessResultatPage(
    pageResultatEnabled,
    isAdminVerified,
    viewAsPlayer,
  )

  const refresh = useCallback(() => {
    setPageResultatEnabled(isPageEnabled(PAGE_RESULTAT))
    setEnigmes(loadEnigmes())
    const next: Record<string, string> = {}
    for (const e of loadEnigmes()) {
      const g = findUserGuessForEnigme(userid, e.enigmeid)
      next[e.enigmeid] = g?.guess ?? ''
    }
    setDrafts(next)
  }, [userid])

  useEffect(() => {
    const onData = () => refresh()
    window.addEventListener(DATA_EVENT, onData)
    return () => window.removeEventListener(DATA_EVENT, onData)
  }, [refresh])

  useEffect(() => {
    if (!name) return
    void ensureUserProfileForName(name)
  }, [name])

  useEffect(() => {
    if (!usingFirebase) return
    startPageConfigSync()
  }, [usingFirebase])

  useEffect(() => {
    if (!usingFirebase) return
    // Met à jour la requête Firestore au changement de jour
    // + lorsqu’on bascule entre "visu admin" et "visu non-admin".
    if (isAdminVerified && !viewAsPlayer) {
      enableAdminEnigmesSync()
    } else if (isAdminVerified && viewAsPlayer) {
      forceSyncHomeEnigmesForToday()
    } else {
      syncHomeEnigmesForToday()
    }
  }, [calendarTick, isAdminVerified, viewAsPlayer, usingFirebase])

  const visibles = useMemo(
    () =>
      enigmes
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
      if (!isAdminVerified || viewAsPlayer) {
        if (!cancelled) setEnigmeCounts({})
        return
      }
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
  }, [isAdminVerified, viewAsPlayer, visibles])

  const isGuessLocked = useCallback(
    (enigmeid: string): boolean => {
      if (!latestVisibleEnigmeId || enigmeid === latestVisibleEnigmeId) return false
      const g = findUserGuessForEnigme(userid, enigmeid)
      return (g?.guess ?? '').trim() !== ''
    },
    [latestVisibleEnigmeId, userid],
  )

  useEffect(() => {
    const next: Record<string, string> = {}
    for (const e of visibles) {
      const g = findUserGuessForEnigme(userid, e.enigmeid)
      next[e.enigmeid] = g?.guess ?? ''
    }
    setDrafts(next)
  }, [visibles, userid])

  const handleReloadData = async () => {
    if (!userid || reloading) return
    setReloading(true)
    setReloadHint(null)
    setSavedHint(null)
    try {
      if (usingFirebase) {
        await reloadPlayerDataNow(userid)
      }
      refresh()
      setReloadHint('Données actualisées.')
    } catch {
      setReloadHint('Actualisation impossible. Réessayez.')
    } finally {
      setReloading(false)
    }
  }

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
        {!usingFirebase ? (
          <p className="empty-state" role="note">
            Données locales (pas de Firebase configuré pour ce build).
          </p>
        ) : null}
        {isAdminVerified ? (
          <section className="panel" aria-label="Aperçu admin">
            <div className="admin-actions-row">
              <button
                type="button"
                className="secondary narrow"
                onClick={() => {
                  dispatch(setViewAsPlayer(!viewAsPlayer))
                }}
              >
                {viewAsPlayer ? 'Revenir en mode admin' : 'Voir comme un non-admin'}
              </button>
              {viewAsPlayer ? (
                <p className="ok-hint" role="status">
                  Aperçu non-admin activé (certains éléments admin sont masqués).
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {savedHint ? (
          <p className="ok-hint ok-hint-top" role="status">
            {savedHint}
          </p>
        ) : null}

        {showDecouvrirPrenom ? (
          <section className="panel" aria-label="Découvrir le prénom">
            <Link to="/resultat" className="primary home-resultat-cta">
              Découvrir le prénom
            </Link>
            {isAdminVerified && !viewAsPlayer && !pageResultatEnabled ? (
              <p className="ok-hint" role="note">
                Aperçu admin : la page n’est pas encore activée pour les joueurs.
              </p>
            ) : null}
          </section>
        ) : null}

        <section className="panel">
          <h2>Énigmes disponibles</h2>
          <p className="panel-intro">
            <strong>Une nouvelle énigme est disponible chaque Vendredi !</strong>
          </p>

          {usingFirebase ? (
            <div className="admin-actions-row">
              <button
                type="button"
                className="secondary narrow"
                disabled={reloading || !userid}
                onClick={() => void handleReloadData()}
              >
                {reloading ? 'Actualisation…' : 'Actualiser mes données'}
              </button>
              {reloadHint ? (
                <p className="ok-hint" role="status">
                  {reloadHint}
                </p>
              ) : null}
            </div>
          ) : null}

          {visibles.length === 0 ? (
            <p className="empty-state">
              Aucune énigme pour l’instant. Ajoutez-en depuis l’administration.
            </p>
          ) : (
            <ul className="enigme-list">
              {visibles.map((e) => {
                const locked = isGuessLocked(e.enigmeid)
                const isLatest = e.enigmeid === latestVisibleEnigmeId
                const canSeeCounts = isAdminVerified && !viewAsPlayer
                const count = canSeeCounts ? (enigmeCounts[e.enigmeid] ?? 0) : 0
                const countLabel = `NB propositions : ${count}`
                return (
                  <li key={e.enigmeid} className="enigme-card">
                    <div className="enigme-card-head">
                      <h3 className="enigme-title-with-stats">
                        <span className="enigme-libelle">{e.libelle}</span>
                        {canSeeCounts ? (
                          <span
                            className="enigme-player-count"
                            aria-label={`Nombre de propositions enregistrées : ${count}`}
                          >
                            {' '}
                            ({countLabel})
                          </span>
                        ) : null}
                      </h3>
                      <time dateTime={e.date}>{e.date}</time>
                    </div>
                    {e.imageDataUrl ? (
                      <EnigmeImage
                        imageRef={e.imageDataUrl}
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
