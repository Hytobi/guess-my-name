import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { updateUserDisplayName } from '../lib/store'
import { LoggedTopBar } from '../components/LoggedTopBar'

export function ProfilePage() {
  const { name, setName, signOut } = useUser()
  const navigate = useNavigate()
  const [pseudoDraft, setPseudoDraft] = useState('')
  const [pseudoError, setPseudoError] = useState<string | null>(null)
  const [pseudoOk, setPseudoOk] = useState<string | null>(null)

  useEffect(() => {
    if (name) setPseudoDraft(name)
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
      await setName(row.name)
      setPseudoOk('Nom affiché enregistré.')
    } catch {
      setPseudoError('Enregistrement impossible. Réessayez.')
    }
  }

  const handleChangeAccount = useCallback(() => {
    void signOut().finally(() => {
      navigate('/', { replace: true })
    })
  }, [navigate, signOut])

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

          <section className="profile-subsection">
            <h2 className="profile-section-title">Modifier mon nom affiché</h2>
            <p className="panel-intro">
              Change uniquement le nom affiché sur le site et dans les listes admin.
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
              Déconnectez-vous pour vous connecter avec un autre compte.
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
