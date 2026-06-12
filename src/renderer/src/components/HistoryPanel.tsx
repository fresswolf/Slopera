import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { HistoryEntry } from '@shared/types'
import { useUI } from '../store'

export function HistoryPanel() {
  const closeOverlay = useUI((s) => s.closeOverlay)
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    void window.slopera.history.list(query || undefined).then((list) => {
      if (!cancelled) setEntries(list)
    })
    return () => {
      cancelled = true
    }
  }, [query])

  return (
    <div className="absolute inset-0 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-8 py-8">
        <div className="mb-4 flex items-center gap-3">
          <h1 className="text-xl font-semibold text-zinc-100">History</h1>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the dreams you've had…"
            className="h-8 flex-1 rounded-full border border-zinc-700 bg-zinc-900 px-4 text-sm outline-none focus:border-violet-400"
          />
          <button
            onClick={() => {
              void window.slopera.history.clear().then(() => setEntries([]))
            }}
            className="flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:border-red-400 hover:text-red-300"
          >
            <Trash2 size={12} /> Clear
          </button>
        </div>
        {entries.length === 0 && (
          <p className="py-12 text-center text-sm text-zinc-600">No dreams recorded yet.</p>
        )}
        <ul className="divide-y divide-zinc-800/60">
          {entries.map((entry) => (
            <li key={entry.id}>
              <button
                onClick={() => {
                  closeOverlay()
                  window.slopera.tabs.navigate(entry.url)
                }}
                className="flex w-full items-baseline gap-3 px-2 py-2 text-left hover:bg-zinc-800/50"
              >
                <span className="w-32 shrink-0 text-[11px] tabular-nums text-zinc-600">
                  {new Date(entry.visitedAt).toLocaleString()}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
                  {entry.title || entry.displayUrl}
                </span>
                <span className="min-w-0 max-w-[220px] truncate text-xs text-zinc-500">
                  {entry.displayUrl}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
