import { X } from 'lucide-react'
import { useUI } from '../store'

export function BookmarksBar() {
  const bookmarks = useUI((s) => s.bookmarks)
  const removeBookmark = useUI((s) => s.removeBookmark)
  const closeOverlay = useUI((s) => s.closeOverlay)

  return (
    <div className="flex h-[34px] shrink-0 items-center gap-1 overflow-x-auto border-b border-zinc-950 bg-zinc-800 px-3">
      {bookmarks.map((b) => (
        <span
          key={b.id}
          className="group flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
        >
          <button
            onClick={() => {
              closeOverlay()
              window.slopera.tabs.navigate(b.url)
            }}
          >
            {b.title}
          </button>
          <button
            onClick={() => void removeBookmark(b.id)}
            className="rounded p-0.5 opacity-0 hover:bg-zinc-600 group-hover:opacity-100"
            aria-label={`Remove bookmark ${b.title}`}
          >
            <X size={10} />
          </button>
        </span>
      ))}
    </div>
  )
}
