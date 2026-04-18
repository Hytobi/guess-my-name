import { useState, type FormEvent } from 'react'
import { useUser } from '../context/UserContext'
import {
  loginWithConnectionCode,
  registerUserName,
} from '../lib/store'
import { HomePage } from './HomePage'

function isEightDigitCode(s: string): boolean {
  return /^\d{8}$/.test(s.replace(/\s+/g, ''))
}

export function RootPage() {
  const { name, setName } = useUser()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed) {
      setError('Indiquez un nom ou un code à 8 chiffres.')
      return
    }

    if (isEightDigitCode(trimmed)) {
      try {
        const profile = await loginWithConnectionCode(trimmed)
        if (!profile) {
          setError('Code inconnu. Vérifiez les 8 chiffres ou utilisez votre nom.')
          return
        }
        setName(profile.name)
      } catch {
        setError('Connexion impossible. Réessayez.')
        return
      }
      setError(null)
      setDraft('')
      return
    }

    if (trimmed.length > 120) {
      setError('Le nom est trop long (120 caractères max).')
      return
    }

    try {
      await registerUserName(trimmed)
      setName(trimmed)
    } catch {
      setError('Impossible d’enregistrer. Réessayez.')
      return
    }
    setError(null)
    setDraft('')
  }

  if (!name) {
    return (
      <main className="shell">
        <header className="header">
          <h1>Guess my name</h1>
          <p className="lede">
            La premiere fois, indiquez votre <strong>nom et prenom</strong> pour qu'on vous reconnaisse ! Sinon utilisez votre{' '}
            <strong>code à 8 chiffres</strong> si vous avez déjà joué sur un autre
            navigateur où ce code a été affiché.
          </p>
        </header>

        <div className="info-banner" role="note">
          <p>
            Après avoir choisi votre nom, un <strong>code de connexion</strong> à
            8 chiffres vous sera affiché. Conservez-le : vous pourrez le saisir ici
            pour retrouver votre compte sur un autre appareil.
          </p>
        </div>

        <form className="name-form" onSubmit={handleSubmit} noValidate>
          <label htmlFor="user-name">Nom affiché ou code à 8 chiffres</label>
          <input
            id="user-name"
            name="userName"
            type="text"
            inputMode="text"
            autoComplete="username"
            maxLength={120}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              if (error) setError(null)
            }}
            placeholder="Ex. Clélia ou 12345678"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'name-error' : undefined}
          />
          {error ? (
            <p id="name-error" className="field-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="primary">
            Continuer
          </button>
        </form>
      </main>
    )
  }

  return <HomePage />
}
