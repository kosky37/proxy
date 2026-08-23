import { Link, NavLink, Outlet } from 'react-router-dom'
import { useGetHealthQuery } from '../store/proxyApi'
import { applyTheme, readTheme, type Theme } from '../theme'
import { useState } from 'react'

export function Layout() {
  const [theme, setTheme] = useState<Theme>(() => {
    const current = readTheme()
    applyTheme(current)
    return current
  })
  const health = useGetHealthQuery()

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    applyTheme(next)
    setTheme(next)
  }

  return (
    <>
      <nav className="navbar navbar-expand bg-body-tertiary border-bottom">
        <div className="container-fluid">
          <Link className="navbar-brand" to="/">
            Proxy
          </Link>
          <div className="navbar-nav me-auto">
            <NavLink className="nav-link" to="/">
              Proxies
            </NavLink>
          </div>
          <span className={`badge me-3 ${health.data?.status === 'ok' ? 'text-bg-success' : 'text-bg-secondary'}`}>
            API {health.data?.status ?? 'offline'}
          </span>
          <button className="btn btn-outline-secondary btn-sm" type="button" onClick={toggleTheme}>
            {theme === 'light' ? 'Dark' : 'Light'} mode
          </button>
        </div>
      </nav>
      <main className="container py-4">
        <Outlet />
      </main>
    </>
  )
}
