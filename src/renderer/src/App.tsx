import { useEffect } from 'react'
import { BookmarksBar } from './components/BookmarksBar'
import { HistoryPanel } from './components/HistoryPanel'
import { LensBanner } from './components/LensBanner'
import { SettingsPanel } from './components/SettingsPanel'
import { TabStrip } from './components/TabStrip'
import { Toolbar } from './components/Toolbar'
import { useUI } from './store'

export default function App() {
  const overlay = useUI((s) => s.overlay)
  const closeOverlay = useUI((s) => s.closeOverlay)

  // The tab WebContentsView sits on top of this window; main hides it while
  // an overlay panel is open so the panel is actually visible.
  useEffect(() => {
    window.slopera.ui.setOverlay(overlay !== 'none')
  }, [overlay])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeOverlay()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeOverlay])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-900 text-zinc-300">
      <TabStrip />
      <Toolbar />
      <BookmarksBar />
      <LensBanner />
      <div className="relative flex-1 bg-zinc-950">
        {overlay === 'history' && <HistoryPanel />}
        {overlay === 'settings' && <SettingsPanel />}
      </div>
    </div>
  )
}
