import { Link, NavLink } from 'react-router-dom'
import { useUser } from '../context/UserContext'

export function LoggedTopBar() {
  const { name } = useUser()

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
        <Link to="/admin" className="topbar-link">
          Administration
        </Link>
      </nav>
    </header>
  )
}
