import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { isEnigmeVisibleOnHome } from '../lib/dates'
import {
  ensureUserProfileForName,
  findGuess,
  getMyConnectionCode,
  getOrCreateUserId,
  loadEnigmes,
  readUserId,
  upsertGuess,
} from '../lib/store'
import { formatWeeknumber, getCurrentWeeknumber } from '../lib/week'

const DATA_EVENT = 'guess-my-name:data'

export function HomePage() {
  const { name, clearName } = useUser()
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
  const [connectionCode, setConnectionCode] = useState<string | null>(null)
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
    if (!name) {
      setConnectionCode(null)
      return
    }
    ensureUserProfileForName(name)
    setConnectionCode(getMyConnectionCode())
  }, [name])

  const visibles = useMemo(
    () =>
      enigmes
        .filter((e) => isEnigmeVisibleOnHome(e.date))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [enigmes],
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
    setDrafts((d) => ({ ...d, [enigmeid]: text }))
    setSavedHint(null)
  }

  const saveGuess = (enigmeid: string) => {
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
    setSavedHint('Proposition enregistrée (stockage local).')
  }

  return (
    <div className="layout">
      <header className="topbar">
        <div className="topbar-brand">
          <Link to="/">Guess my name</Link>
        </div>
        <nav className="topbar-nav">
          <span className="topbar-user">{name}</span>
          <Link to="/admin" className="topbar-link">
            Administration
          </Link>
          <button type="button" className="linkish" onClick={clearName}>
            Changer de nom
          </button>
        </nav>
      </header>

      <main className="main-content">
        {connectionCode ? (
          <section
            className="info-banner info-banner-home"
            role="region"
            aria-label="Code de connexion"
          >
            <p className="code-line">
              <strong>Votre code à 8 chiffres :</strong>{' '}
              <span className="code-chip" translate="no">
                {connectionCode}
              </span>
            </p>
            <p className="info-banner-note">
              Sur un autre appareil, ouvrez cette page et saisissez ce code à la place
              du nom pour retrouver le même compte (disponible sur tous les appareils
              lorsque les données seront synchronisées, par ex. avec Firebase).
            </p>
          </section>
        ) : null}

        <section className="panel">
          <h2>Énigmes disponibles</h2>
          <p className="panel-intro">
            Affichage des énigmes dont la date (jour) est strictement antérieure à
            aujourd’hui (voir <code>bdd.txt</code>). Semaine en cours :{' '}
            <strong>{formatWeeknumber(weeknumber)}</strong>.
          </p>

          {visibles.length === 0 ? (
            <p className="empty-state">
              Aucune énigme pour l’instant. Ajoutez-en depuis l’administration.
            </p>
          ) : (
            <ul className="enigme-list">
              {visibles.map((e) => (
                <li key={e.enigmeid} className="enigme-card">
                  <div className="enigme-card-head">
                    <h3>{e.libelle}</h3>
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

                  <div className="guess-block">
                    <label htmlFor={`guess-${e.enigmeid}`}>
                      Votre proposition (modifiable à tout moment)
                    </label>
                    <textarea
                      id={`guess-${e.enigmeid}`}
                      rows={3}
                      value={drafts[e.enigmeid] ?? ''}
                      onChange={(ev) => setDraft(e.enigmeid, ev.target.value)}
                      placeholder="Votre réponse ou indice pour cette semaine…"
                    />
                    <button
                      type="button"
                      className="primary narrow"
                      onClick={() => saveGuess(e.enigmeid)}
                    >
                      Enregistrer
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {savedHint ? (
            <p className="ok-hint" role="status">
              {savedHint}
            </p>
          ) : null}
        </section>
      </main>
    </div>
  )
}
