import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import {
  ensureUserProfileForName,
  getMyConnectionCode,
  updateUserDisplayName,
} from '../lib/store'
import { LoggedTopBar } from '../components/LoggedTopBar'

export function ProfilePage() {
  const { name, setName, clearName } = useUser()
  const navigate = useNavigate()
  const [connectionCode, setConnectionCode] = useState<string | null>(null)
  const [connectionCodeVisible, setConnectionCodeVisible] = useState(false)
  const [pseudoDraft, setPseudoDraft] = useState('')
  const [pseudoError, setPseudoError] = useState<string | null>(null)
  const [pseudoOk, setPseudoOk] = useState<string | null>(null)

  useEffect(() => {
    if (name) setPseudoDraft(name)
  }, [name])

  useEffect(() => {
    if (!name) {
      setConnectionCode(null)
      setConnectionCodeVisible(false)
      return
    }
    setConnectionCodeVisible(false)
    let cancelled = false
    void (async () => {
      await ensureUserProfileForName(name)
      if (cancelled) return
      setConnectionCode(await getMyConnectionCode())
    })()
    return () => {
      cancelled = true
    }
  }, [name])

  const handlePseudoSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setPseudoError(null)
    setPseudoOk(null)
    const t = pseudoDraft.trim()
    if (!t) {
      setPseudoError('Indiquez un nom.')
      return
    }
    if (t.length > 120) {
      setPseudoError('Le nom est trop long (120 caractères max).')
      return
    }
    try {
      const row = await updateUserDisplayName(t)
      if (!row) {
        setPseudoError(
          'Profil introuvable. Rechargez la page ou reconnectez-vous.',
        )
        return
      }
      setName(row.name)
      setPseudoOk('Pseudo enregistré. Votre code à 8 chiffres est inchangé.')
    } catch {
      setPseudoError('Enregistrement impossible. Réessayez.')
    }
  }

  const handleChangeAccount = useCallback(() => {
    clearName()
    navigate('/', { replace: true })
  }, [clearName, navigate])

  if (!name) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="layout">
      <LoggedTopBar />

      <main className="main-content">
        <p className="panel-intro profile-lede">
          <Link to="/" className="topbar-link">
            ← Retour aux énigmes
          </Link>
        </p>

        <section className="panel">
          <h1 className="profile-page-title">Mon profil</h1>

          <section
            className="info-banner info-banner-home"
            role="region"
            aria-label="Connexion sur un autre appareil"
          >
            <h2 className="profile-section-title">Mon code à 8 chiffres</h2>
            <p className="info-banner-note">
              Sur un autre appareil, saisissez ce code à la place du nom pour
              retrouver ce compte et vos propositions.
            </p>
            <div className="connection-code-row">
              <button
                type="button"
                className="secondary narrow"
                onClick={() => setConnectionCodeVisible((v) => !v)}
                aria-expanded={connectionCodeVisible}
                aria-controls="connection-code-display-profil"
              >
                {connectionCodeVisible ? 'Masquer mon code' : 'Afficher mon code'}
              </button>
              <div
                id="connection-code-display-profil"
                className="connection-code-display"
                aria-live="polite"
              >
                {connectionCodeVisible ? (
                  connectionCode ? (
                    <p className="connection-code-reveal">
                      <span className="sr-only">Votre code à 8 chiffres : </span>
                      <span className="code-chip" translate="no">
                        {connectionCode}
                      </span>
                    </p>
                  ) : (
                    <span className="connection-code-loading">Chargement…</span>
                  )
                ) : null}
              </div>
            </div>
          </section>

          <section className="profile-subsection">
            <h2 className="profile-section-title">Modifier mon pseudo</h2>
            <p className="panel-intro">
              Change uniquement le nom affiché sur le site et dans les listes
              admin. Ton <strong>code à 8 chiffres</strong> reste le même.
            </p>
            <form className="name-form profile-pseudo-form" onSubmit={handlePseudoSubmit}>
              <label htmlFor="profile-pseudo">Nom affiché</label>
              <input
                id="profile-pseudo"
                name="pseudo"
                type="text"
                autoComplete="nickname"
                maxLength={120}
                value={pseudoDraft}
                onChange={(ev) => {
                  setPseudoDraft(ev.target.value)
                  if (pseudoError) setPseudoError(null)
                  if (pseudoOk) setPseudoOk(null)
                }}
                aria-invalid={pseudoError ? true : undefined}
                aria-describedby={
                  pseudoError ? 'profile-pseudo-error' : undefined
                }
              />
              {pseudoError ? (
                <p id="profile-pseudo-error" className="field-error" role="alert">
                  {pseudoError}
                </p>
              ) : null}
              {pseudoOk ? (
                <p className="ok-hint" role="status">
                  {pseudoOk}
                </p>
              ) : null}
              <button type="submit" className="primary narrow">
                Enregistrer mon pseudo
              </button>
            </form>
          </section>

          <section className="profile-subsection profile-account-block">
            <h2 className="profile-section-title">Changer de compte</h2>
            <p className="panel-intro">
              Tu quittes ce compte sur cet appareil pour te connecter avec un
              autre nom ou un autre code (comme sur la page d’accueil).
            </p>
            <button
              type="button"
              className="secondary danger"
              onClick={handleChangeAccount}
            >
              Changer de compte
            </button>
          </section>
        </section>
      </main>
    </div>
  )
}
