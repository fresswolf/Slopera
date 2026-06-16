import { Pencil, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  DEFAULT_OPENROUTER_IMAGE_MODEL,
  DEFAULT_OPENROUTER_MODEL,
  IMAGE_MODELS,
  JS_LEVELS,
  MODELS,
  OPENROUTER_IMAGE_MODELS,
  OPENROUTER_PAGE_MODELS,
} from '@shared/constants'
import { LENSES } from '@shared/lenses'
import type { Lens } from '@shared/lenses'
import type { CacheStats, SettingsUpdate } from '@shared/types'
import { useUI } from '../store'

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

const field =
  'h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm outline-none focus:border-violet-400'
const labelCls = 'mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500'

type KeyName = 'anthropicKey' | 'openRouterKey' | 'falKey'

export function SettingsPanel() {
  const settings = useUI((s) => s.settings)
  const updateSettings = useUI((s) => s.updateSettings)
  const closeOverlay = useUI((s) => s.closeOverlay)
  const addLens = useUI((s) => s.addLens)
  const updateLens = useUI((s) => s.updateLens)
  const removeLens = useUI((s) => s.removeLens)
  const [keyDrafts, setKeyDrafts] = useState<Record<KeyName, string>>({
    anthropicKey: '',
    openRouterKey: '',
    falKey: '',
  })
  const [lensLabel, setLensLabel] = useState('')
  const [lensInstructions, setLensInstructions] = useState('')
  const [stats, setStats] = useState<CacheStats | null>(null)

  useEffect(() => {
    void window.slopera.cache.stats().then(setStats)
  }, [])

  const setDraft = (name: KeyName, value: string) =>
    setKeyDrafts((d) => ({ ...d, [name]: value }))

  const commitKey = (name: KeyName) => {
    const value = keyDrafts[name].trim()
    if (value === '') return
    void updateSettings({ [name]: value })
    setDraft(name, '')
  }

  const done = () => {
    // Flush any key still typed but not yet blurred, then close.
    const update: SettingsUpdate = {}
    for (const name of ['anthropicKey', 'openRouterKey', 'falKey'] as KeyName[]) {
      if (keyDrafts[name].trim() !== '') update[name] = keyDrafts[name].trim()
    }
    if (Object.keys(update).length > 0) void updateSettings(update)
    closeOverlay()
  }

  const canDreamPages = !!settings && (settings.hasAnthropicKey || settings.hasOpenRouterKey)

  return (
    <div className="absolute inset-0 overflow-y-auto">
      <button
        onClick={done}
        aria-label="Close settings"
        className="fixed right-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/80 text-zinc-400 backdrop-blur hover:border-violet-400 hover:text-zinc-100"
      >
        <X size={18} />
      </button>
      <div className="mx-auto max-w-xl px-8 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-zinc-100">Settings</h1>
        </div>

        <section className="mb-8 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-300">API keys</h2>
          <KeyField
            name="anthropicKey"
            label="Anthropic"
            role="pages"
            placeholder="sk-ant-…"
            value={keyDrafts.anthropicKey}
            saved={!!settings?.hasAnthropicKey}
            onChange={setDraft}
            onCommit={commitKey}
            onRemove={() => void updateSettings({ anthropicKey: '' })}
          />
          <KeyField
            name="openRouterKey"
            label="OpenRouter"
            role="pages + images"
            placeholder="sk-or-…"
            value={keyDrafts.openRouterKey}
            saved={!!settings?.hasOpenRouterKey}
            onChange={setDraft}
            onCommit={commitKey}
            onRemove={() => void updateSettings({ openRouterKey: '' })}
          />
          <KeyField
            name="falKey"
            label="fal.ai"
            role="images"
            placeholder="key-id:key-secret"
            value={keyDrafts.falKey}
            saved={!!settings?.hasFalKey}
            onChange={setDraft}
            onCommit={commitKey}
            onRemove={() => void updateSettings({ falKey: '' })}
          />
          <p className={`text-xs ${canDreamPages ? 'text-zinc-600' : 'text-amber-400'}`}>
            You need an <strong>Anthropic</strong> or <strong>OpenRouter</strong> key to dream pages.
            Images use fal.ai or OpenRouter; without an image key they render as captioned
            placeholders. Keys save as you type them — click <strong>Remove</strong> to clear one.
          </p>
          {settings && !settings.encryptionAvailable && (
            <p className="text-xs text-amber-400">
              OS keychain encryption is unavailable; keys will be stored in plain text.
            </p>
          )}
        </section>

        {settings && (
          <>
            <section className="mb-8 space-y-4">
              <h2 className="text-sm font-semibold text-zinc-300">Pages</h2>
              <ProviderToggle
                value={settings.textProvider}
                options={[
                  { id: 'anthropic', label: 'Anthropic', enabled: settings.hasAnthropicKey },
                  { id: 'openrouter', label: 'OpenRouter', enabled: settings.hasOpenRouterKey },
                ]}
                onSelect={(id) => void updateSettings({ textProvider: id })}
              />
              {settings.textProvider === 'anthropic' ? (
                <ModelPicker
                  key="pages-anthropic"
                  models={MODELS}
                  value={settings.model}
                  placeholder="e.g. claude-opus-4-8"
                  onCommit={(model) => void updateSettings({ model })}
                />
              ) : (
                <ModelPicker
                  key="pages-openrouter"
                  models={OPENROUTER_PAGE_MODELS}
                  value={settings.model}
                  placeholder={DEFAULT_OPENROUTER_MODEL}
                  hint="Any OpenRouter model slug, e.g. anthropic/claude-opus-4, x-ai/grok-4."
                  onCommit={(model) => void updateSettings({ model })}
                />
              )}
              <div>
                <label className={labelCls}>Interactivity</label>
                <select
                  value={settings.jsLevel}
                  onChange={(e) =>
                    void updateSettings({ jsLevel: e.target.value as SettingsUpdate['jsLevel'] })
                  }
                  className={field}
                >
                  {JS_LEVELS.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-zinc-600">
                  How much JavaScript dreamed pages may run.
                </p>
              </div>
            </section>

            <section className="mb-8 space-y-4">
              <h2 className="text-sm font-semibold text-zinc-300">Images</h2>
              <ProviderToggle
                value={settings.imageProvider}
                options={[
                  { id: 'fal', label: 'fal.ai', enabled: settings.hasFalKey },
                  { id: 'openrouter', label: 'OpenRouter', enabled: settings.hasOpenRouterKey },
                ]}
                onSelect={(id) => void updateSettings({ imageProvider: id })}
              />
              {settings.imageProvider === 'fal' ? (
                <ModelPicker
                  key="images-fal"
                  models={IMAGE_MODELS}
                  value={settings.imageModel}
                  placeholder="e.g. fal-ai/flux/schnell"
                  onCommit={(imageModel) => void updateSettings({ imageModel })}
                />
              ) : (
                <ModelPicker
                  key="images-openrouter"
                  models={OPENROUTER_IMAGE_MODELS}
                  value={settings.imageModel}
                  placeholder={DEFAULT_OPENROUTER_IMAGE_MODEL}
                  hint="An OpenRouter image model slug. Exact pixel sizes aren't guaranteed; aspect ratio is honored."
                  onCommit={(imageModel) => void updateSettings({ imageModel })}
                />
              )}
              <p className="text-xs text-zinc-600">
                <strong className="text-zinc-400">fal.ai is the fastest and cheapest</strong> way to
                get images (FLUX schnell ~$0.003/img) — recommended. OpenRouter lets you try other
                image models (FLUX.2 Klein, Gemini) — or any model slug via “Custom model…”.
              </p>
            </section>

            <section className="mb-8 space-y-4">
              <h2 className="text-sm font-semibold text-zinc-300">Lens</h2>
              <div>
                <label className={labelCls}>Default lens</label>
                <select
                  value={settings.lens}
                  onChange={(e) => void updateSettings({ lens: e.target.value })}
                  className={field}
                >
                  {[...LENSES, ...settings.customLenses].map((l) => (
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
          </>
        )}

        <section className="mb-8 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-300">Custom lenses</h2>
          {(settings?.customLenses ?? []).map((l) => (
            <CustomLensRow
              key={l.id}
              lens={l}
              onSave={(label, instructions) => updateLens(l.id, label, instructions)}
              onRemove={() => removeLens(l.id)}
            />
          ))}
          <div>
            <label className={labelCls}>Name</label>
            <input
              value={lensLabel}
              onChange={(e) => setLensLabel(e.target.value)}
              placeholder="Solarpunk"
              maxLength={40}
              className={field}
            />
          </div>
          <div>
            <label className={labelCls}>Flavor — how should the web be dreamed?</label>
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

function KeyField({
  name,
  label,
  role,
  placeholder,
  value,
  saved,
  onChange,
  onCommit,
  onRemove,
}: {
  name: KeyName
  label: string
  role: string
  placeholder: string
  value: string
  saved: boolean
  onChange: (name: KeyName, value: string) => void
  onCommit: (name: KeyName) => void
  onRemove: () => void
}) {
  return (
    <div>
      <label className={labelCls}>
        {label} <span className="text-zinc-600">— {role}</span>{' '}
        {saved && <span className="text-emerald-400">saved ✓</span>}
      </label>
      <div className="flex gap-2">
        <input
          type="password"
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
          onBlur={() => onCommit(name)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          placeholder={saved ? '••••••••••••••• (enter to replace)' : placeholder}
          className={field}
        />
        {saved && (
          <button
            onClick={onRemove}
            className="shrink-0 rounded-md border border-zinc-700 px-3 text-xs text-zinc-400 hover:border-red-400 hover:text-red-300"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  )
}

function CustomLensRow({
  lens,
  onSave,
  onRemove,
}: {
  lens: Lens
  onSave: (label: string, instructions: string) => Promise<void>
  onRemove: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(lens.label)
  const [instructions, setInstructions] = useState(lens.instructions)

  const startEdit = () => {
    setLabel(lens.label)
    setInstructions(lens.instructions)
    setEditing(true)
  }

  const save = () => {
    if (label.trim() === '' || instructions.trim() === '') return
    void onSave(label, instructions).then(() => setEditing(false))
  }

  if (editing) {
    return (
      <div className="space-y-2 rounded-md border border-zinc-700 bg-zinc-900/60 px-3 py-3">
        <div>
          <label className={labelCls}>Name</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={40}
            className={field}
          />
        </div>
        <div>
          <label className={labelCls}>Flavor — how should the web be dreamed?</label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            maxLength={2000}
            rows={4}
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-violet-400"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={label.trim() === '' || instructions.trim() === ''}
            className="rounded-md bg-violet-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-400 disabled:opacity-40"
          >
            Save
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
          >
            Cancel
          </button>
        </div>
        <p className="text-xs text-zinc-600">
          Editing a lens keeps its already-dreamed pages — reload a page to re-dream it with the new
          flavor.
        </p>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-sm text-zinc-200">{lens.label}</div>
        <div className="truncate text-xs text-zinc-500" title={lens.instructions}>
          {lens.instructions}
        </div>
      </div>
      <button
        onClick={startEdit}
        className="rounded p-1 text-zinc-500 hover:bg-zinc-700 hover:text-violet-300"
        aria-label={`Edit lens ${lens.label}`}
      >
        <Pencil size={13} />
      </button>
      <button
        onClick={() => void onRemove()}
        className="rounded p-1 text-zinc-500 hover:bg-zinc-700 hover:text-red-300"
        aria-label={`Delete lens ${lens.label}`}
      >
        <X size={13} />
      </button>
    </div>
  )
}

interface ProviderOption<T extends string> {
  id: T
  label: string
  enabled: boolean
}

function ProviderToggle<T extends string>({
  value,
  options,
  onSelect,
}: {
  value: T
  options: ProviderOption<T>[]
  onSelect: (id: T) => void
}) {
  return (
    <div>
      <label className={labelCls}>Provider</label>
      <div className="inline-flex rounded-md border border-zinc-700 p-0.5">
        {options.map((o) => {
          const active = o.id === value
          const disabled = !o.enabled && !active
          return (
            <button
              key={o.id}
              onClick={() => !disabled && onSelect(o.id)}
              disabled={disabled}
              title={disabled ? `${o.label} key required` : undefined}
              className={`rounded px-3 py-1 text-sm transition-colors ${
                active
                  ? 'bg-violet-500 text-white'
                  : disabled
                    ? 'cursor-not-allowed text-zinc-600'
                    : 'text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              {o.label}
              {disabled && <span className="ml-1 text-[10px] uppercase">key req’d</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const CUSTOM_MODEL = '__custom__'

function ModelPicker({
  models,
  value,
  placeholder,
  hint,
  onCommit,
}: {
  models: ReadonlyArray<{ id: string; label: string }>
  value: string
  placeholder: string
  hint?: string
  onCommit: (model: string) => void
}) {
  const known = models.some((m) => m.id === value)
  const [customMode, setCustomMode] = useState(!known)
  const [draft, setDraft] = useState(value)
  const commitDraft = () => {
    const trimmed = draft.trim()
    if (trimmed !== '' && trimmed !== value) onCommit(trimmed)
  }
  return (
    <div>
      <label className={labelCls}>Model</label>
      <select
        value={customMode ? CUSTOM_MODEL : value}
        onChange={(e) => {
          if (e.target.value === CUSTOM_MODEL) {
            setCustomMode(true)
            setDraft(value)
          } else {
            setCustomMode(false)
            onCommit(e.target.value)
          }
        }}
        className={field}
      >
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
        <option value={CUSTOM_MODEL}>Custom model…</option>
      </select>
      {customMode && (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          placeholder={placeholder}
          spellCheck={false}
          className={`${field} mt-2`}
        />
      )}
      {hint && <p className="mt-1 text-xs text-zinc-600">{hint}</p>}
    </div>
  )
}
