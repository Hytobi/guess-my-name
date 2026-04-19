import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { UserProvider } from './context/UserContext'
import { AdminPage } from './pages/AdminPage'
import { ProfilePage } from './pages/ProfilePage'
import { RootPage } from './pages/RootPage'
import './App.css'

export default function App() {
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
