import { RotateCw, X } from 'lucide-react'
import { LENS_BANNER_HEIGHT } from '@shared/constants'
import { LENSES } from '@shared/lenses'
import { selectActiveTab, useUI } from '../store'

/**
 * Lens-mismatch infobar: shown when the displayed page was dreamed in a lens
 * other than the active one (cross-lens cache fallback, or the lens switched
 * mid-view). Main shifts the tab view down by LENS_BANNER_HEIGHT while a tab's
 * bannerVisible is set, revealing this strip.
 */
export function LensBanner() {
  const active = useUI(selectActiveTab)
  const settings = useUI((s) => s.settings)

  if (!active?.bannerVisible || !active.servedLens || !settings) return null

  const label = (id: string): string =>
    [...LENSES, ...settings.customLenses].find((l) => l.id === id)?.label ?? id

  return (
    <div
      style={{ height: LENS_BANNER_HEIGHT }}
      className="flex shrink-0 items-center gap-2 border-b border-zinc-950 bg-zinc-800 px-3 text-xs text-zinc-400"
    >
      <span className="min-w-0 truncate">
        This page was dreamed in <span className="font-medium text-violet-300">{label(active.servedLens)}</span> —
        re-dream it in <span className="font-medium text-violet-300">{label(settings.lens)}</span>?
      </span>
      <button
        onClick={() => window.slopera.tabs.reload()}
        className="flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
      >
        <RotateCw size={12} />
        Re-dream
      </button>
      <div className="flex-1" />
      <button
        onClick={() => window.slopera.tabs.dismissBanner()}
        aria-label="Dismiss"
        title="Dismiss"
        className="shrink-0 rounded-md p-1 hover:bg-zinc-700 hover:text-zinc-100"
      >
        <X size={12} />
      </button>
    </div>
  )
}
