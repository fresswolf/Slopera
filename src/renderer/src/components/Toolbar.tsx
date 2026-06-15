import { ArrowLeft, ArrowRight, Clock, Home, RotateCw, Settings, Star, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { LENSES } from '@shared/lenses'
import { selectActiveTab, useUI } from '../store'

function IconButton(props: {
  onClick: () => void
  disabled?: boolean
  label: string
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      aria-label={props.label}
      title={props.label}
      className={`rounded-md p-1.5 ${
        props.active ? 'bg-zinc-700 text-violet-300' : 'text-zinc-400'
      } enabled:hover:bg-zinc-700 enabled:hover:text-zinc-100 disabled:opacity-30`}
    >
      {props.children}
    </button>
  )
}

export function Toolbar() {
  const active = useUI(selectActiveTab)
  const overlay = useUI((s) => s.overlay)
  const toggleOverlay = useUI((s) => s.toggleOverlay)
  const closeOverlay = useUI((s) => s.closeOverlay)
  const focusNonce = useUI((s) => s.focusNonce)
  const settings = useUI((s) => s.settings)
  const updateSettings = useUI((s) => s.updateSettings)
  const addBookmark = useUI((s) => s.addBookmark)

  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const [editing, setEditing] = useState(false)

  const tabUrl = active?.displayUrl ?? ''
  useEffect(() => {
    if (!editing) setValue(tabUrl)
  }, [tabUrl, editing])

  useEffect(() => {
    if (focusNonce > 0) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [focusNonce])

  const loading = active?.loading ?? false

  return (
    <div className="flex h-[48px] shrink-0 items-center gap-1 bg-zinc-800 px-2">
      <IconButton
        onClick={() => {
          closeOverlay()
          window.slopera.tabs.back()
        }}
        disabled={!active?.canGoBack}
        label="Back"
      >
        <ArrowLeft size={16} />
      </IconButton>
      <IconButton
        onClick={() => {
          closeOverlay()
          window.slopera.tabs.forward()
        }}
        disabled={!active?.canGoForward}
        label="Forward"
      >
        <ArrowRight size={16} />
      </IconButton>
      <IconButton
        onClick={() => {
          closeOverlay()
          if (loading) window.slopera.tabs.stop()
          else window.slopera.tabs.reload()
        }}
        label={loading ? 'Stop' : 'Re-dream this page'}
      >
        {loading ? <X size={16} /> : <RotateCw size={16} />}
      </IconButton>
      <IconButton
        onClick={() => {
          closeOverlay()
          window.slopera.tabs.home()
        }}
        label="Home"
      >
        <Home size={16} />
      </IconButton>

      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={(e) => {
          setEditing(true)
          e.target.select()
        }}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            closeOverlay()
            window.slopera.tabs.navigate(value)
            setEditing(false)
            inputRef.current?.blur()
          } else if (e.key === 'Escape') {
            setEditing(false)
            setValue(tabUrl)
            inputRef.current?.blur()
          }
        }}
        placeholder="Search Google or dream up a URL"
        spellCheck={false}
        className="mx-2 h-[30px] min-w-0 flex-1 rounded-full border border-zinc-700 bg-zinc-900 px-4 text-[13px] text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-violet-400"
      />

      <select
        value={settings?.lens ?? 'straight'}
        onChange={(e) => {
          if (e.target.value === '__new__') {
            toggleOverlay('settings')
            return
          }
          void updateSettings({ lens: e.target.value })
        }}
        title="Lens — the register the web is dreamed in"
        className="h-[28px] rounded-md border border-zinc-700 bg-zinc-900 px-1.5 text-xs text-zinc-300 outline-none focus:border-violet-400"
      >
        {[...LENSES, ...(settings?.customLenses ?? [])].map((lens) => (
          <option key={lens.id} value={lens.id}>
            {lens.label}
          </option>
        ))}
        <option value="__new__">＋ New lens…</option>
      </select>

      <IconButton
        onClick={() => {
          if (active && active.url !== '' && active.displayUrl !== '') {
            void addBookmark(active.url, active.title)
          }
        }}
        label="Bookmark this page"
      >
        <Star size={16} />
      </IconButton>
      <IconButton
        onClick={() => toggleOverlay('history')}
        active={overlay === 'history'}
        label="History"
      >
        <Clock size={16} />
      </IconButton>
      <IconButton
        onClick={() => toggleOverlay('settings')}
        active={overlay === 'settings'}
        label="Settings"
      >
        <Settings size={16} />
      </IconButton>
    </div>
  )
}
