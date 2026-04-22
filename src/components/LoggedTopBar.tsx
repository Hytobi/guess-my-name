import { Link, NavLink } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { useSelector } from 'react-redux'
import type { RootState } from '../state/store'

export function LoggedTopBar() {
  const { name } = useUser()
  const showAdminLink = useSelector(
    (s: RootState) => s.admin.isAdminVerified && !s.admin.viewAsPlayer,
  )

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <Link to="/">Guess my name</Link>
      </div>
      <nav className="topbar-nav">
        {name ? <span className="topbar-user">{name}</span> : null}
        <NavLink
          to="/profil"
          className={({ isActive }) =>
            `topbar-link${isActive ? ' topbar-link-active' : ''}`
          }
        >
          Mon profil
        </NavLink>
        {showAdminLink ? (
          <Link to="/admin" className="topbar-link">
            Administration
          </Link>
        ) : null}
      </nav>
    </header>
  )
}
