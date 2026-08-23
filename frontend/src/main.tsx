import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import App from './App.tsx'
import { store } from './store/store'
import { applyTheme, readTheme } from './theme'
import 'react-bootstrap-typeahead/css/Typeahead.css'
import 'react-bootstrap-typeahead/css/Typeahead.bs5.css'
import './index.css'

applyTheme(readTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
)
