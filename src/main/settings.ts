import { safeStorage } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_MODEL,
  DEFAULT_OPENROUTER_IMAGE_MODEL,
  DEFAULT_OPENROUTER_MODEL,
} from '@shared/constants'
import type { ImageProvider, TextProvider } from '@shared/constants'
import { DEFAULT_LENS, LENSES, slugifyLensId } from '@shared/lenses'
import type { Lens } from '@shared/lenses'
import type { SettingsUpdate, SettingsView } from '@shared/types'

interface Persisted {
  textProvider: TextProvider
  model: string
  imageProvider: ImageProvider
  imageModel: string
  lens: string
  customLenses: Lens[]
  /** API keys, stored as `enc:<base64>` (safeStorage) or `plain:<key>` as fallback. */
  anthropicKey?: string
  openRouterKey?: string
  falKey?: string
}

export class SettingsStore {
  private file: string
  private data: Persisted

  constructor(dir: string) {
    this.file = join(dir, 'settings.json')
    this.data = {
      textProvider: 'anthropic',
      model: DEFAULT_MODEL,
      imageProvider: 'fal',
      imageModel: DEFAULT_IMAGE_MODEL,
      lens: DEFAULT_LENS,
      customLenses: [],
    }
    try {
      const raw = JSON.parse(readFileSync(this.file, 'utf8')) as Partial<Persisted>
      this.data = { ...this.data, ...raw }
    } catch {
      // first launch
    }
    // A profile may have been saved pointing at a provider whose key was later
    // removed (or never set); land on a usable provider before first request.
    this.reconcileTextProvider()
  }

  get textProvider(): TextProvider {
    return this.data.textProvider
  }

  get model(): string {
    return this.data.model
  }

  get imageProvider(): ImageProvider {
    return this.data.imageProvider
  }

  get imageModel(): string {
    return this.data.imageModel
  }

  get lens(): string {
    return this.data.lens
  }

  get anthropicKey(): string | null {
    return this.decrypt(this.data.anthropicKey)
  }

  get openRouterKey(): string | null {
    return this.decrypt(this.data.openRouterKey)
  }

  get falKey(): string | null {
    return this.decrypt(this.data.falKey)
  }

  /** Key for the active text provider, or null if that provider isn't configured. */
  get activeTextKey(): string | null {
    return this.data.textProvider === 'openrouter' ? this.openRouterKey : this.anthropicKey
  }

  get customLenses(): Lens[] {
    return this.data.customLenses
  }

  /** Adds a user-defined lens and makes it the active one. */
  addLens(label: string, instructions: string): SettingsView {
    const taken = [...LENSES, ...this.data.customLenses].map((l) => l.id)
    const lens: Lens = {
      id: slugifyLensId(label, taken),
      label: label.trim(),
      instructions: instructions.trim(),
    }
    this.data.customLenses = [...this.data.customLenses, lens]
    this.data.lens = lens.id
    this.save()
    return this.view()
  }

  /** Edits a user-defined lens in place, keeping its id (and thus its cache) stable. */
  updateLens(id: string, label: string, instructions: string): SettingsView {
    this.data.customLenses = this.data.customLenses.map((l) =>
      l.id === id ? { ...l, label: label.trim(), instructions: instructions.trim() } : l,
    )
    this.save()
    return this.view()
  }

  removeLens(id: string): SettingsView {
    this.data.customLenses = this.data.customLenses.filter((l) => l.id !== id)
    if (this.data.lens === id) this.data.lens = DEFAULT_LENS
    this.save()
    return this.view()
  }

  view(): SettingsView {
    return {
      textProvider: this.data.textProvider,
      model: this.data.model,
      imageProvider: this.data.imageProvider,
      imageModel: this.data.imageModel,
      lens: this.data.lens,
      customLenses: this.data.customLenses,
      hasAnthropicKey: this.anthropicKey !== null,
      hasOpenRouterKey: this.openRouterKey !== null,
      hasFalKey: this.falKey !== null,
      encryptionAvailable: safeStorage.isEncryptionAvailable(),
    }
  }

  update(u: SettingsUpdate): SettingsView {
    // Provider switches first: a model string is only valid for one provider, so
    // flipping providers resets the model to that provider's default unless the
    // same call also supplies a fitting one.
    if (u.textProvider === 'anthropic' || u.textProvider === 'openrouter') {
      if (u.textProvider !== this.data.textProvider) {
        this.data.textProvider = u.textProvider
        this.data.model = u.textProvider === 'openrouter' ? DEFAULT_OPENROUTER_MODEL : DEFAULT_MODEL
      }
    }
    if (u.imageProvider === 'fal' || u.imageProvider === 'openrouter') {
      if (u.imageProvider !== this.data.imageProvider) {
        this.data.imageProvider = u.imageProvider
        this.data.imageModel =
          u.imageProvider === 'openrouter' ? DEFAULT_OPENROUTER_IMAGE_MODEL : DEFAULT_IMAGE_MODEL
      }
    }
    // "Custom model…" is offered for every provider, so any non-empty model string
    // is accepted; the curated lists are a UI affordance, not a validation gate.
    if (u.model !== undefined && u.model.trim() !== '') {
      this.data.model = u.model.trim()
    }
    if (u.imageModel !== undefined && u.imageModel.trim() !== '') {
      this.data.imageModel = u.imageModel.trim()
    }
    if (
      u.lens !== undefined &&
      [...LENSES, ...this.data.customLenses].some((l) => l.id === u.lens)
    ) {
      this.data.lens = u.lens
    }
    if (u.anthropicKey !== undefined) {
      this.data.anthropicKey = u.anthropicKey === '' ? undefined : this.encrypt(u.anthropicKey)
    }
    if (u.openRouterKey !== undefined) {
      this.data.openRouterKey = u.openRouterKey === '' ? undefined : this.encrypt(u.openRouterKey)
    }
    if (u.falKey !== undefined) {
      this.data.falKey = u.falKey === '' ? undefined : this.encrypt(u.falKey)
    }
    // Adding/removing a key can strand the active text provider on one with no
    // key (e.g. default Anthropic, but only an OpenRouter key was supplied).
    this.reconcileTextProvider()
    this.save()
    return this.view()
  }

  /**
   * Keep the active text provider pointed at a configured one. A page can't be
   * dreamed without a key, so if the current provider lacks one but the other
   * has it, switch over (resetting the model to that provider's default, since a
   * model string is only valid for one provider). No-op when neither has a key.
   */
  private reconcileTextProvider(): void {
    const hasKey = (p: TextProvider) =>
      p === 'openrouter' ? this.openRouterKey !== null : this.anthropicKey !== null
    if (hasKey(this.data.textProvider)) return
    const other: TextProvider = this.data.textProvider === 'anthropic' ? 'openrouter' : 'anthropic'
    if (hasKey(other)) {
      this.data.textProvider = other
      this.data.model = other === 'openrouter' ? DEFAULT_OPENROUTER_MODEL : DEFAULT_MODEL
    }
  }

  private encrypt(value: string): string {
    if (safeStorage.isEncryptionAvailable()) {
      return `enc:${safeStorage.encryptString(value).toString('base64')}`
    }
    return `plain:${value}`
  }

  private decrypt(stored: string | undefined): string | null {
    if (!stored) return null
    try {
      if (stored.startsWith('enc:')) {
        return safeStorage.decryptString(Buffer.from(stored.slice(4), 'base64'))
      }
      if (stored.startsWith('plain:')) return stored.slice(6)
      return null
    } catch {
      return null
    }
  }

  private save(): void {
    mkdirSync(dirname(this.file), { recursive: true })
    writeFileSync(this.file, JSON.stringify(this.data, null, 2))
  }
}
