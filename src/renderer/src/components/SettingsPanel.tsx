import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { MODELS } from '@shared/constants'
import { LENSES } from '@shared/lenses'
import type { CacheStats } from '@shared/types'
import { useUI } from '../store'

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function SettingsPanel() {
  const settings = useUI((s) => s.settings)
  const updateSettings = useUI((s) => s.updateSettings)
  const addLens = useUI((s) => s.addLens)
  const removeLens = useUI((s) => s.removeLens)
  const [anthropicKey, setAnthropicKey] = useState('')
  const [falKey, setFalKey] = useState('')
  const [lensLabel, setLensLabel] = useState('')
  const [lensInstructions, setLensInstructions] = useState('')
  const [stats, setStats] = useState<CacheStats | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void window.slopera.cache.stats().then(setStats)
  }, [])

  const saveKeys = () => {
    const update: { anthropicKey?: string; falKey?: string } = {}
    if (anthropicKey.trim() !== '') update.anthropicKey = anthropicKey.trim()
    if (falKey.trim() !== '') update.falKey = falKey.trim()
    if (Object.keys(update).length === 0) return
    void updateSettings(update).then(() => {
      setAnthropicKey('')
      setFalKey('')
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    })
  }

  const field =
    'h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm outline-none focus:border-violet-400'
  const label = 'mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500'

  return (
    <div className="absolute inset-0 overflow-y-auto">
      <div className="mx-auto max-w-xl px-8 py-8">
        <h1 className="mb-6 text-xl font-semibold text-zinc-100">Settings</h1>

        <section className="mb-8 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-300">Dream engines</h2>
          <div>
            <label className={label}>
              Anthropic API key (pages) {settings?.hasAnthropicKey && '— saved ✓'}
            </label>
            <input
              type="password"
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              placeholder={settings?.hasAnthropicKey ? '••••••••••••••• (enter to replace)' : 'sk-ant-…'}
              className={field}
            />
          </div>
          <div>
            <label className={label}>
              fal.ai API key (images, optional) {settings?.hasFalKey && '— saved ✓'}
            </label>
            <input
              type="password"
              value={falKey}
              onChange={(e) => setFalKey(e.target.value)}
              placeholder={settings?.hasFalKey ? '••••••••••••••• (enter to replace)' : 'key-id:key-secret'}
              className={field}
            />
            <p className="mt-1 text-xs text-zinc-600">
              Without it, images render as captioned placeholders.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={saveKeys}
              className="rounded-md bg-violet-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-400"
            >
              Save keys
            </button>
            {saved && <span className="text-xs text-emerald-400">Saved.</span>}
          </div>
          {settings && !settings.encryptionAvailable && (
            <p className="text-xs text-amber-400">
              OS keychain encryption is unavailable; keys will be stored in plain text.
            </p>
          )}
        </section>

        <section className="mb-8 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-300">The dream</h2>
          <div>
            <label className={label}>Page model</label>
            <select
              value={settings?.model ?? ''}
              onChange={(e) => void updateSettings({ model: e.target.value })}
              className={field}
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Default lens</label>
            <select
              value={settings?.lens ?? ''}
              onChange={(e) => void updateSettings({ lens: e.target.value })}
              className={field}
            >
              {[...LENSES, ...(settings?.customLenses ?? [])].map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-600">
              Each lens dreams its own web — cached pages are per-lens.
            </p>
          </div>
        </section>

        <section className="mb-8 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-300">Custom lenses</h2>
          {(settings?.customLenses ?? []).map((l) => (
            <div key={l.id} className="flex items-start gap-2 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-zinc-200">{l.label}</div>
                <div className="truncate text-xs text-zinc-500" title={l.instructions}>
                  {l.instructions}
                </div>
              </div>
              <button
                onClick={() => void removeLens(l.id)}
                className="rounded p-1 text-zinc-500 hover:bg-zinc-700 hover:text-red-300"
                aria-label={`Delete lens ${l.label}`}
              >
                <X size={13} />
              </button>
            </div>
          ))}
          <div>
            <label className={label}>Name</label>
            <input
              value={lensLabel}
              onChange={(e) => setLensLabel(e.target.value)}
              placeholder="Solarpunk"
              maxLength={40}
              className={field}
            />
          </div>
          <div>
            <label className={label}>Flavor — how should the web be dreamed?</label>
            <textarea
              value={lensInstructions}
              onChange={(e) => setLensInstructions(e.target.value)}
              placeholder="Render every site as if civilization went right: lush rooftop gardens in the stock photos, repair guides instead of upsells, optimistic typography…"
              maxLength={2000}
              rows={4}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          </div>
          <button
            onClick={() => {
              if (lensLabel.trim() === '' || lensInstructions.trim() === '') return
              void addLens(lensLabel, lensInstructions).then(() => {
                setLensLabel('')
                setLensInstructions('')
              })
            }}
            disabled={lensLabel.trim() === '' || lensInstructions.trim() === ''}
            className="rounded-md bg-violet-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-400 disabled:opacity-40"
          >
            Add lens &amp; switch to it
          </button>
        </section>

        <section className="mb-8 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-300">Cache</h2>
          <p className="text-sm text-zinc-500">
            {stats
              ? `${stats.pages} pages, ${stats.images} images — ${formatBytes(stats.bytes)}. Cached dreams load instantly and cost nothing.`
              : 'Loading…'}
          </p>
          <button
            onClick={() => void window.slopera.cache.clear().then(setStats)}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:border-red-400 hover:text-red-300"
          >
            Forget every dream
          </button>
        </section>

        <footer className="border-t border-zinc-800 pt-4 text-xs text-zinc-600">
          <span className="font-serif text-sm italic text-zinc-500">
            Slopera — the browser for the slop era.
          </span>
          <br />
          Every page is hallucinated. Nothing you read here is real.
        </footer>
      </div>
    </div>
  )
}
