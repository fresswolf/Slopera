import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { useUI } from './store'
import './styles.css'

window.slopera.onTabsState((snapshot) => useUI.getState().setSnapshot(snapshot))
window.slopera.onFocusOmnibox(() => useUI.getState().bumpFocus())
void useUI.getState().loadSettings()
void useUI.getState().loadBookmarks()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
