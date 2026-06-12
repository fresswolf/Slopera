import { Loader2, Plus, X } from 'lucide-react'
import { useUI } from '../store'

export function TabStrip() {
  const tabs = useUI((s) => s.tabs)
  const activeId = useUI((s) => s.activeId)

  return (
    <div className="drag-region flex h-[38px] shrink-0 items-end gap-1 bg-zinc-900 px-2 pl-[84px]">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => window.slopera.tabs.activate(tab.id)}
          className={`no-drag group flex h-[30px] min-w-0 max-w-[200px] flex-1 cursor-default items-center gap-1.5 rounded-t-lg px-3 text-xs ${
            tab.id === activeId
              ? 'bg-zinc-800 text-zinc-100'
              : 'text-zinc-400 hover:bg-zinc-800/50'
          }`}
        >
          {tab.loading ? (
            <Loader2 size={12} className="shrink-0 animate-spin text-violet-400" />
          ) : (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br from-violet-400 to-pink-400" />
          )}
          <span className="min-w-0 flex-1 truncate">{tab.title}</span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              window.slopera.tabs.close(tab.id)
            }}
            className="shrink-0 rounded p-0.5 opacity-0 hover:bg-zinc-700 group-hover:opacity-100"
            aria-label="Close tab"
          >
            <X size={11} />
          </button>
        </div>
      ))}
      <button
        onClick={() => window.slopera.tabs.create()}
        className="no-drag mb-1 rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
        aria-label="New tab"
      >
        <Plus size={14} />
      </button>
    </div>
  )
}
