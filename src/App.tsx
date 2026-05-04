import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { UserProvider } from './context/UserContext'
import { useUser } from './context/UserContext'
import { AdminPage } from './pages/AdminPage'
import { AdminDecoyPage } from './pages/AdminDecoyPage'
import { MorganPage } from './pages/MorganPage'
import { ProfilePage } from './pages/ProfilePage'
import { RootPage } from './pages/RootPage'
import { isCurrentUserAdmin } from './lib/store'
import { useFirebaseBackend } from './lib/dataMode'
import { setAdminVerified } from './state/adminSlice'
import type { RootState } from './state/store'
import './App.css'

function AdminRoute({ children }: { children: React.ReactElement }) {
  const isAdmin = useSelector((s: RootState) => s.admin.isAdminVerified)
  if (!isAdmin) return <Navigate to="/" replace />
  return children
}

function AppInner() {
  const dispatch = useDispatch()
  const { user } = useUser()

  // Au refresh (ou ouverture directe), on recalcule l’admin côté client.
  // Important: permet de ré-afficher le lien "Administration" sans repasser par /admin.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!useFirebaseBackend()) {
        dispatch(setAdminVerified(false))
        return
      }
      // Si pas de session Auth, pas d'admin.
      if (!user) {
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
  }, [dispatch, user?.uid])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootPage />} />
        <Route path="/profil" element={<ProfilePage />} />
        <Route
          path="/nova"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />
        <Route path="/admin" element={<AdminDecoyPage />} />
        <Route path="/morgan" element={<MorganPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <UserProvider>
      <AppInner />
    </UserProvider>
  )
}
