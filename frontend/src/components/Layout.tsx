import { useState } from 'react'
import { Badge, Button, Container, Nav, Navbar } from 'react-bootstrap'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useGetHealthQuery } from '../store/proxyApi'
import { applyTheme, readTheme, type Theme } from '../theme'

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
      <Navbar expand bg="body-tertiary" className="border-bottom">
        <Container fluid>
          <Navbar.Brand as={Link} to="/" className="d-flex align-items-center gap-2">
            <img src="/favicon.svg" alt="" className="app-logo" />
            Proxy
          </Navbar.Brand>
          <Nav className="me-auto">
            <Nav.Link as={NavLink} to="/" end>
              Proxies
            </Nav.Link>
            <Nav.Link as={NavLink} to="/certificates">
              Certificates
            </Nav.Link>
            <Nav.Link as={NavLink} to="/logs">
              Logs
            </Nav.Link>
          </Nav>
          <Badge bg={health.data?.status === 'ok' ? 'success' : 'secondary'} className="me-3">
            API {health.data?.status ?? 'offline'}
          </Badge>
          <Button variant="outline-secondary" size="sm" onClick={toggleTheme}>
            {theme === 'light' ? 'Dark' : 'Light'} mode
          </Button>
        </Container>
      </Navbar>
      <Container fluid className="py-4">
        <Outlet />
      </Container>
    </>
  )
}
