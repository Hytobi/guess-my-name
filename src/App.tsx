import { useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { UserProvider } from './context/UserContext'
import { AdminPage } from './pages/AdminPage'
import { ProfilePage } from './pages/ProfilePage'
import { RootPage } from './pages/RootPage'
import { isCurrentUserAdmin } from './lib/store'
import { useFirebaseBackend } from './lib/dataMode'
import { setAdminVerified } from './state/adminSlice'
import './App.css'

export default function App() {
  const dispatch = useDispatch()

  // Au refresh (ou ouverture directe), on recalcule l’admin côté client.
  // Important: permet de ré-afficher le lien "Administration" sans repasser par /admin.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!useFirebaseBackend()) {
        dispatch(setAdminVerified(false))
        return
      }
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

  return (
    <UserProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootPage />} />
          <Route path="/profil" element={<ProfilePage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </BrowserRouter>
    </UserProvider>
  )
}
