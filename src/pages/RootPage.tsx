import { useState, type FormEvent } from 'react'
import { sendPasswordResetEmail } from 'firebase/auth'
import { useUser } from '../context/UserContext'
import { HomePage } from './HomePage'
import { useFirebaseBackend } from '../lib/dataMode'
import { getFirebaseAuth } from '../lib/firebase'

export function RootPage() {
  const { user, name, signIn, signUp, setName, signOut } = useUser()
  const usingFirebase = useFirebaseBackend()

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [usernameDraft, setUsernameDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [resetHint, setResetHint] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setResetHint(null)
    try {
      if (!usingFirebase) {
        setError('Firebase n’est pas configuré pour ce build.')
        return
      }
      if (mode === 'signup') await signUp(email, password)
      else await signIn(email, password)
    } catch {
      setError('Connexion impossible. Vérifiez vos identifiants et réessayez.')
      return
    } finally {
      setBusy(false)
    }
    setError(null)
  }

  const handleResetPassword = async () => {
    if (busy) return
    const e = email.trim()
    if (!e) {
      setError('Indiquez votre email pour recevoir un lien de réinitialisation.')
      return
    }
    setBusy(true)
    setError(null)
    setResetHint(null)
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), e)
      setResetHint('Email envoyé. Vérifiez votre boîte de réception (et les spams).')
    } catch {
      setError("Impossible d’envoyer l’email. Vérifiez l’adresse et réessayez.")
    } finally {
      setBusy(false)
    }
  }

  const handleUsernameSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    const t = usernameDraft.trim()
    if (!t) {
      setError('Indiquez un nom affiché.')
      setBusy(false)
      return
    }
    if (t.length > 120) {
      setError('Le nom est trop long (120 caractères max).')
      setBusy(false)
      return
    }
    try {
      await setName(t)
      setUsernameDraft('')
    } catch {
      setError('Enregistrement impossible. Réessayez.')
    } finally {
      setBusy(false)
    }
  }

  if (!usingFirebase) {
    return (
      <main className="shell">
        <header className="header">
          <h1>Guess my name</h1>
          <p className="lede">
            Firebase n’est pas configuré pour ce build, donc l’authentification est désactivée.
          </p>
        </header>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="shell">
        <header className="header auth-header">
          <h1>Guess my name</h1>
          <p className="lede">
            Suite à plusieurs attaques de personnes à qui je regrette d’avoir partagé le lien,
            il faut désormais créer un compte pour pouvoir jouer.
            Le but de ce site était simplement de faire deviner le prénom d’un enfant.
            Je regrette d’avoir voulu partager cet événement avec ces personnes.
          </p>
        </header>

        <section className="auth-card" aria-label="Connexion">
          <div className="auth-card-head">
            <h2 className="auth-title">
              {mode === 'signup' ? 'Créer un compte' : 'Se connecter'}
            </h2>
            <p className="auth-subtitle">Connexion requise (email + mot de passe).</p>
          </div>

          <div className="auth-tabs" role="tablist" aria-label="Mode de connexion">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signin'}
              className={`auth-tab${mode === 'signin' ? ' auth-tab-active' : ''}`}
              onClick={() => {
                setMode('signin')
                if (error) setError(null)
              }}
            >
              Connexion
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              className={`auth-tab${mode === 'signup' ? ' auth-tab-active' : ''}`}
              onClick={() => {
                setMode('signup')
                if (error) setError(null)
              }}
            >
              Inscription
            </button>
          </div>

          <form className="name-form auth-form" onSubmit={handleSubmit} noValidate>
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="exemple@mail.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (error) setError(null)
              }}
              disabled={busy}
            />

            <label htmlFor="auth-password">Mot de passe</label>
            <input
              id="auth-password"
              name="password"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              placeholder={mode === 'signup' ? 'Choisissez un mot de passe' : 'Votre mot de passe'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (error) setError(null)
              }}
              disabled={busy}
            />

            {error ? (
              <p className="field-error auth-error" role="alert">
                {error}
              </p>
            ) : (
              <p className="auth-helper" role="note">
                {mode === 'signup'
                  ? 'Vous choisirez ensuite un nom affiché (modifiable).'
                  : 'Vous n’avez pas de compte ? Passez sur “Inscription”.'}
              </p>
            )}

            <button type="submit" className="primary" disabled={busy}>
              {busy
                ? 'Veuillez patienter…'
                : mode === 'signup'
                  ? 'Créer le compte'
                  : 'Se connecter'}
            </button>

            {mode === 'signin' ? (
              <button
                type="button"
                className="linkish auth-link"
                onClick={() => void handleResetPassword()}
                disabled={busy}
              >
                Mot de passe oublié ?
              </button>
            ) : null}

            {resetHint ? (
              <p className="ok-hint auth-ok" role="status">
                {resetHint}
              </p>
            ) : null}
          </form>
        </section>
      </main>
    )
  }

  if (!name) {
    return (
      <main className="shell">
        <header className="header auth-header">
          <h1>Guess my name</h1>
          <p className="lede">Dernière étape : choisissez un nom affiché.</p>
        </header>

        <section className="auth-card" aria-label="Nom affiché">
          <div className="auth-card-head">
            <h2 className="auth-title">Nom affiché</h2>
            <p className="auth-subtitle">Vous pourrez le modifier ensuite dans “Mon profil”.</p>
          </div>

          <form className="name-form auth-form" onSubmit={handleUsernameSubmit} noValidate>
            <label htmlFor="display-name">Nom affiché</label>
            <input
              id="display-name"
              name="displayName"
              type="text"
              autoComplete="nickname"
              maxLength={120}
              value={usernameDraft}
              onChange={(e) => {
                setUsernameDraft(e.target.value)
                if (error) setError(null)
              }}
              placeholder="Ex. Clélia"
              aria-invalid={error ? true : undefined}
              disabled={busy}
            />
            {error ? (
              <p className="field-error auth-error" role="alert">
                {error}
              </p>
            ) : (
              <p className="auth-helper" role="note">
                Conseil : un prénom suffit.
              </p>
            )}
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Veuillez patienter…' : 'Continuer'}
            </button>

            <button
              type="button"
              className="linkish auth-link"
              onClick={() => void signOut()}
              disabled={busy}
            >
              Retour / changer de compte
            </button>
          </form>
        </section>
      </main>
    )
  }

  return <HomePage />
}
