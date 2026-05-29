import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useUser } from '../context/UserContext'
import {
  canAccessResultatPage,
  ensurePageLoaded,
  isPageEnabled,
  PAGE_RESULTAT,
  startPageConfigSync,
} from '../lib/pageStore'
import { useFirebaseBackend } from '../lib/dataMode'
import type { RootState } from '../state/store'

const DATA_EVENT = 'guess-my-name:data'

/** Accès /resultat si `page/resultat.enabled` ou compte admin. */
export function ResultatRoute({ children }: { children: React.ReactElement }) {
  const { user, name } = useUser()
  const isAdminVerified = useSelector((s: RootState) => s.admin.isAdminVerified)
  const viewAsPlayer = useSelector((s: RootState) => s.admin.viewAsPlayer)
  const [ready, setReady] = useState(false)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const sync = () => {
      if (!cancelled) {
        setAllowed(
          canAccessResultatPage(
            isPageEnabled(PAGE_RESULTAT),
            isAdminVerified,
            viewAsPlayer,
          ),
        )
      }
    }

    // Admin : accès immédiat sans attendre Firestore (évite blocage si règles non déployées).
    if (isAdminVerified && !viewAsPlayer) {
      sync()
      setReady(true)
    }

    void (async () => {
      try {
        startPageConfigSync()
        if (useFirebaseBackend()) {
          await ensurePageLoaded(PAGE_RESULTAT)
        }
      } catch (err) {
        console.error('[Guess my name] ResultatRoute:', err)
      } finally {
        if (!cancelled) {
          sync()
          setReady(true)
        }
      }
    })()

    window.addEventListener(DATA_EVENT, sync)
    return () => {
      cancelled = true
      window.removeEventListener(DATA_EVENT, sync)
    }
  }, [isAdminVerified, viewAsPlayer])

  if (!user || !name) {
    return <Navigate to="/" replace />
  }

  if (!ready) {
    return (
      <div className="layout">
        <main className="main-content">
          <p className="empty-state">Chargement…</p>
        </main>
      </div>
    )
  }

  if (!allowed) {
    return <Navigate to="/" replace />
  }

  return children
}
