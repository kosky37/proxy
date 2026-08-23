import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { CertificatesPage } from './pages/CertificatesPage'
import { LogsPage } from './pages/LogsPage'
import { ProxiesPage } from './pages/ProxiesPage'
import { ProxyDetailPage } from './pages/ProxyDetailPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<ProxiesPage />} />
          <Route path="/certificates" element={<CertificatesPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/proxies/:id" element={<ProxyDetailPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
