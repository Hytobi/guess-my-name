import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import type { Enigme, GuessListEntry } from '../types'
import { todayIsoDay } from '../lib/dates'
import {
  formatWeeknumber,
  getWeeknumberFromIsoDate,
} from '../lib/week'
import { useFirebaseBackend } from '../lib/dataMode'
import {
  signInFirebaseAdminAfterGate,
  signOutFirebaseAdmin,
} from '../lib/firebaseAuthAdmin'
import {
  checkAdminPassword,
  countUsersWhoPlayedEnigme,
  enableAdminEnigmesSync,
  enableAdminGuessesSync,
  isCurrentUserAdmin,
  loadEnigmes,
  loadGuessList,
  reloadAllGuessesNow,
  saveEnigmes,
} from '../lib/store'
import { useDispatch, useSelector } from 'react-redux'
import { setAdminVerified } from '../state/adminSlice'
import type { RootState } from '../state/store'

const MAX_DATA_URL_CHARS = 400_000

type AdminSection = 'enigmes' | 'propositions'

export function AdminPage() {
  const { name: playerName } = useUser()
  const dispatch = useDispatch()
  const logged = useSelector((s: RootState) => s.admin.isAdminVerified)
  const [section, setSection] = useState<AdminSection>('propositions')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)

  // Si Redux repart à zéro après un refresh mais que Firebase Auth a encore une session admin,
  // on recalcule l’état côté client (uniquement si le backend Firebase est actif).
  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!useFirebaseBackend()) return
      try {
        const ok = await isCurrentUserAdmin()
        if (!cancelled) dispatch(setAdminVerified(ok))
      } catch {
        if (!cancelled) dispatch(setAdminVerified(false))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dispatch])

  const [enigmes, setEnigmes] = useState<Enigme[]>(loadEnigmes)
  const [guesses, setGuesses] = useState<GuessListEntry[]>(loadGuessList)
  const [guessWeekFilter, setGuessWeekFilter] = useState<string>('')
  const [guessNameFilter, setGuessNameFilter] = useState('')
  const [libelle, setLibelle] = useState('')
  const [date, setDate] = useState(() => todayIsoDay())
  const [message, setMessage] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [editingEnigmeId, setEditingEnigmeId] = useState<string | null>(null)
  const [editingOriginal, setEditingOriginal] = useState<Enigme | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [formOk, setFormOk] = useState<string | null>(null)
  const [reloadHint, setReloadHint] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setEnigmes(loadEnigmes())
    setGuesses(loadGuessList())
  }, [])

  useEffect(() => {
    const onData = () => refresh()
    window.addEventListener('guess-my-name:data', onData)
    return () => window.removeEventListener('guess-my-name:data', onData)
  }, [refresh])

  // Si on arrive sur /admin avec une session déjà active (refresh navigateur),
  // on doit activer la synchro "toutes les énigmes" (y compris futures).
  useEffect(() => {
    if (!logged) return
    if (!useFirebaseBackend()) return
    enableAdminEnigmesSync()
  }, [logged])

  // Les propositions (guesses) complètes ne sont chargées que sur l’onglet "Propositions".
  useEffect(() => {
    if (!logged) return
    if (!useFirebaseBackend()) return
    if (section !== 'propositions') return
    enableAdminGuessesSync()
  }, [logged, section])

  const handleReloadGuesses = async () => {
    if (!logged) return
    setReloadHint(null)
    try {
      await reloadAllGuessesNow()
      setReloadHint('Propositions rechargées.')
    } catch {
      setReloadHint('Rechargement impossible. Réessayez.')
    }
  }

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    if (!checkAdminPassword(password)) {
      setLoginError('Mot de passe incorrect.')
      return
    }
    setLoginError(null)
    setPassword('')
    try {
      if (useFirebaseBackend()) {
        await signInFirebaseAdminAfterGate()
      }
    } catch {
      setLoginError(
        'Connexion Firebase impossible (compte admin ou mot de passe Firebase).',
      )
      return
    }

    if (useFirebaseBackend()) {
      try {
        const ok = await isCurrentUserAdmin()
        if (!ok) {
          setLoginError(
            'Compte non autorisé. Demandez à un administrateur de vous accorder l’accès.',
          )
          return
        }
      } catch {
        setLoginError('Vérification admin impossible. Réessayez.')
        return
      }
    }

    dispatch(setAdminVerified(true))
  }

  const handleLogout = async () => {
    await signOutFirebaseAdmin()
    dispatch(setAdminVerified(false))
  }

  const resetEnigmeForm = () => {
    setEditingEnigmeId(null)
    setEditingOriginal(null)
    setLibelle('')
    setMessage('')
    setFile(null)
    setDate(todayIsoDay())
  }

  const handleEditEnigme = (en: Enigme) => {
    setFormError(null)
    setFormOk(null)
    setEditingEnigmeId(en.enigmeid)
    setEditingOriginal(en)
    setLibelle(en.libelle)
    setDate(en.date)
    setMessage(en.message)
    setFile(null)
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
    })
  }

  const handleSaveEnigme = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setFormOk(null)
    const L = libelle.trim()
    if (!L) {
      setFormError('Indiquez un libellé.')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setFormError('Date invalide (AAAA-MM-JJ).')
      return
    }

    let nomFichier = editingOriginal?.nomFichier ?? ''
    let imageDataUrl: string | null =
      (editingOriginal?.imageDataUrl as string | null | undefined) ?? null

    if (file) {
      nomFichier = file.name
      try {
        const dataUrl = await readFileAsDataUrl(file)
        if (dataUrl.length > MAX_DATA_URL_CHARS) {
          setFormError(
            'Image trop lourde pour le stockage local. Réduisez la taille ou laissez sans fichier (Firebase Storage plus tard).',
          )
          return
        }
        imageDataUrl = dataUrl
      } catch {
        setFormError('Lecture du fichier impossible.')
        return
      }
    }

    const base: Enigme = {
      enigmeid: editingEnigmeId ?? crypto.randomUUID(),
      libelle: L,
      date,
      nomFichier,
      message: message.trim(),
      imageDataUrl: imageDataUrl ?? undefined,
    }

    const list = loadEnigmes()
    const nextList =
      editingEnigmeId == null
        ? [base, ...list]
        : [base, ...list.filter((x) => x.enigmeid !== editingEnigmeId)]
    await saveEnigmes(nextList)
    resetEnigmeForm()
    setFormOk(editingEnigmeId ? 'Énigme modifiée.' : 'Énigme enregistrée.')
    refresh()
  }

  const handleDelete = async (id: string) => {
    const list = loadEnigmes().filter((x) => x.enigmeid !== id)
    await saveEnigmes(list)
    refresh()
  }

  const enigmeById = useMemo(() => {
    const m = new Map<string, Enigme>()
    for (const e of enigmes) m.set(e.enigmeid, e)
    return m
  }, [enigmes])

  const guessWeekOptions = useMemo(() => {
    const set = new Set<number>()
    for (const g of guesses) {
      const en = enigmeById.get(g.enigmeid)
      const w = en?.date ? getWeeknumberFromIsoDate(en.date) : null
      if (w != null) set.add(w)
    }
    return [...set].sort((a, b) => b - a)
  }, [enigmeById, guesses])

  const filteredGuesses = useMemo(() => {
    const nameNeedle = guessNameFilter.trim().toLowerCase()
    let rows = guesses
    if (guessWeekFilter !== '') {
      const w = Number(guessWeekFilter)
      rows = rows.filter((g) => {
        const en = enigmeById.get(g.enigmeid)
        const fromEnigme = en?.date ? getWeeknumberFromIsoDate(en.date) : null
        return fromEnigme === w
      })
    }
    if (nameNeedle) {
      rows = rows.filter((g) => {
        const nom = (g.userName ?? '').toLowerCase()
        const id = g.userid.toLowerCase()
        return nom.includes(nameNeedle) || id.includes(nameNeedle)
      })
    }
    return [...rows].sort((a, b) => {
      const ta = a.updatedAtMs ?? 0
      const tb = b.updatedAtMs ?? 0
      if (tb !== ta) return tb - ta
      const wa =
        enigmeById.get(a.enigmeid)?.date != null
          ? getWeeknumberFromIsoDate(enigmeById.get(a.enigmeid)!.date)
          : null
      const wb =
        enigmeById.get(b.enigmeid)?.date != null
          ? getWeeknumberFromIsoDate(enigmeById.get(b.enigmeid)!.date)
          : null
      if (wa != null && wb != null && wb !== wa) return wb - wa
      if (wa == null && wb != null) return 1
      if (wa != null && wb == null) return -1
      if (b.weeknumber !== a.weeknumber) return b.weeknumber - a.weeknumber
      const la = enigmeById.get(a.enigmeid)?.libelle ?? ''
      const lb = enigmeById.get(b.enigmeid)?.libelle ?? ''
      if (la !== lb) return la.localeCompare(lb, 'fr')
      // Dernier recours stable : id (évite un tri par nom de joueur).
      return b.guesslistid.localeCompare(a.guesslistid)
    })
  }, [enigmeById, guessNameFilter, guessWeekFilter, guesses])

  if (!logged) {
    return (
      <main className="shell admin-shell">
        <header className="header">
          <h1>Administration</h1>
          <p className="lede">
            Connexion requise pour gérer les énigmes. Si vous n'êtes pas l'un des parents vous n'avez pas accès à cette page.
          </p>
        </header>
        <form className="name-form" onSubmit={handleLogin}>
          <label htmlFor="admin-pw">Mot de passe</label>
          <input
            id="admin-pw"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(ev) => {
              setPassword(ev.target.value)
              if (loginError) setLoginError(null)
            }}
          />
          {loginError ? (
            <p className="field-error" role="alert">
              {loginError}
            </p>
          ) : null}
          <button type="submit" className="primary">
            Se connecter
          </button>
          <p className="form-footer">
            <Link to="/">Retour à l’accueil</Link>
          </p>
        </form>
      </main>
    )
  }

  return (
    <div className="layout">
      <header className="topbar">
        <div className="topbar-brand">
          <Link to="/">Guess my name</Link>
        </div>
        <nav className="topbar-nav">
          <Link to="/" className="topbar-link">
            Accueil joueur
          </Link>
          {playerName ? (
            <Link to="/profil" className="topbar-link">
              Mon profil
            </Link>
          ) : null}
          <button type="button" className="linkish" onClick={handleLogout}>
            Déconnexion admin
          </button>
        </nav>
      </header>

      <main className="main-content">
        <div className="admin-tabs" role="tablist" aria-label="Sections administration">
          <button
            type="button"
            role="tab"
            id="admin-tab-enigmes"
            aria-selected={section === 'enigmes'}
            aria-controls="admin-panel-enigmes"
            tabIndex={section === 'enigmes' ? 0 : -1}
            className={`admin-tab${section === 'enigmes' ? ' admin-tab-active' : ''}`}
            onClick={() => setSection('enigmes')}
          >
            Énigmes
          </button>
          <button
            type="button"
            role="tab"
            id="admin-tab-propositions"
            aria-selected={section === 'propositions'}
            aria-controls="admin-panel-propositions"
            tabIndex={section === 'propositions' ? 0 : -1}
            className={`admin-tab${section === 'propositions' ? ' admin-tab-active' : ''}`}
            onClick={() => setSection('propositions')}
          >
            Propositions des joueurs
          </button>
        </div>

        {section === 'enigmes' ? (
          <div
            id="admin-panel-enigmes"
            role="tabpanel"
            aria-labelledby="admin-tab-enigmes"
          >
        <section className="panel">
          <h2>{editingEnigmeId ? 'Modifier une énigme' : 'Nouvelle énigme'}</h2>
          <form className="admin-form" onSubmit={handleSaveEnigme}>
            <label>
              Libellé (titre)
              <input
                value={libelle}
                onChange={(e) => setLibelle(e.target.value)}
                maxLength={200}
              />
            </label>
            <label>
              Date (jour de référence, AAAA-MM-JJ)
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label>
              Message
              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={8000}
              />
            </label>
            <label>
              Image (optionnel, stockage local temporaire)
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setFile(e.target.files?.[0] ?? null)
                }
              />
            </label>
            {formError ? (
              <p className="field-error" role="alert">
                {formError}
              </p>
            ) : null}
            {formOk ? (
              <p className="ok-hint" role="status">
                {formOk}
              </p>
            ) : null}
            <div className="admin-actions-row">
              <button type="submit" className="primary narrow">
                {editingEnigmeId ? 'Modifier l’énigme' : 'Ajouter l’énigme'}
              </button>
              {editingEnigmeId ? (
                <button
                  type="button"
                  className="secondary narrow"
                  onClick={resetEnigmeForm}
                >
                  Annuler
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="panel">
          <h2>Énigmes existantes</h2>
          {enigmes.length === 0 ? (
            <p className="empty-state">Aucune énigme.</p>
          ) : (
            <ul className="admin-list">
              {enigmes.map((en) => {
                const players = countUsersWhoPlayedEnigme(en.enigmeid)
                const playersLabel =
                  players === 1 ? '1 joueur' : `${players} joueurs`
                return (
                  <li key={en.enigmeid} className="admin-row">
                    <div>
                      <strong className="admin-enigme-title">
                        <span>{en.libelle}</span>
                        <span
                          className="enigme-player-count"
                          aria-label={`Nombre de joueurs ayant proposé une réponse : ${players}`}
                        >
                          {' '}
                          ({playersLabel})
                        </span>
                      </strong>
                      <span className="meta">
                        {' '}
                        · {en.date}
                        {en.nomFichier ? ` · ${en.nomFichier}` : ''}
                      </span>
                      <p className="admin-msg-preview">{en.message}</p>
                    </div>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => handleEditEnigme(en)}
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      className="secondary danger"
                      onClick={() => handleDelete(en.enigmeid)}
                    >
                      Supprimer
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
          </div>
        ) : (
          <div
            id="admin-panel-propositions"
            role="tabpanel"
            aria-labelledby="admin-tab-propositions"
          >
        <section className="panel">
          <h2>Propositions des joueurs</h2>
          <p className="panel-intro">
            Filtrez par la <strong>semaine ISO de la date de l’énigme</strong>, ou par
            texte (nom affiché ou identifiant utilisateur).
          </p>

          <div className="admin-actions-row">
            <button
              type="button"
              className="secondary narrow"
              onClick={handleReloadGuesses}
            >
              Recharger les propositions
            </button>
            {reloadHint ? (
              <p className="ok-hint" role="status">
                {reloadHint}
              </p>
            ) : null}
          </div>

          <div className="guess-admin-filters">
            <label className="filter-field">
              <span>Semaine (date énigme)</span>
              <select
                value={guessWeekFilter}
                onChange={(e) => setGuessWeekFilter(e.target.value)}
                aria-label="Filtrer par semaine ISO de la date de l’énigme"
              >
                <option value="">Toutes les semaines</option>
                {guessWeekOptions.map((w) => (
                  <option key={w} value={String(w)}>
                    {formatWeeknumber(w)} ({w})
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-field filter-grow">
              <span>Nom ou identifiant</span>
              <input
                type="search"
                value={guessNameFilter}
                onChange={(e) => setGuessNameFilter(e.target.value)}
                placeholder="Ex. Camille ou partie du userid…"
                aria-label="Filtrer par nom ou identifiant"
              />
            </label>
          </div>

          {filteredGuesses.length === 0 ? (
            <p className="empty-state">
              {guesses.length === 0
                ? 'Aucune proposition enregistrée.'
                : 'Aucun résultat pour ces filtres.'}
            </p>
          ) : (
            <div className="guess-table-wrap">
              <table className="guess-table">
                <thead>
                  <tr>
                    <th scope="col">Semaine (date énigme)</th>
                    <th scope="col">Joueur</th>
                    <th scope="col">Énigme</th>
                    <th scope="col">Proposition</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGuesses.map((g) => {
                    const en = enigmeById.get(g.enigmeid)
                    const libelle = en?.libelle ?? '(énigme inconnue ou supprimée)'
                    const displayName = g.userName?.trim() || '—'
                    const weekFromEnigmeDate =
                      en?.date != null ? getWeeknumberFromIsoDate(en.date) : null
                    return (
                      <tr key={g.guesslistid}>
                        <td>
                          {weekFromEnigmeDate != null ? (
                            <>
                              <span className="cell-title">
                                {formatWeeknumber(weekFromEnigmeDate)}
                              </span>
                              <span className="cell-meta">
                                {weekFromEnigmeDate} · {en?.date}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="cell-title">—</span>
                              <span className="cell-meta">
                                Énigme absente ou date invalide
                              </span>
                            </>
                          )}
                        </td>
                        <td>
                          <span className="cell-title">{displayName}</span>
                          <span className="cell-meta mono">{g.userid}</span>
                        </td>
                        <td>{libelle}</td>
                        <td className="guess-cell">
                          {g.guess.trim() ? (
                            <span className="guess-text">{g.guess}</span>
                          ) : (
                            <span className="guess-empty">(vide)</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
          </div>
        )}
      </main>
    </div>
  )
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      if (typeof r.result === 'string') resolve(r.result)
      else reject(new Error('read'))
    }
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}
