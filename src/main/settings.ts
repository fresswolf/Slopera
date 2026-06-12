import { safeStorage } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DEFAULT_MODEL, MODELS } from '@shared/constants'
import { DEFAULT_LENS, LENSES } from '@shared/lenses'
import type { SettingsUpdate, SettingsView } from '@shared/types'

interface Persisted {
  model: string
  lens: string
  /** API keys, stored as `enc:<base64>` (safeStorage) or `plain:<key>` as fallback. */
  anthropicKey?: string
  falKey?: string
}

export class SettingsStore {
  private file: string
  private data: Persisted

  constructor(dir: string) {
    this.file = join(dir, 'settings.json')
    this.data = { model: DEFAULT_MODEL, lens: DEFAULT_LENS }
    try {
      const raw = JSON.parse(readFileSync(this.file, 'utf8')) as Partial<Persisted>
      this.data = { ...this.data, ...raw }
    } catch {
      // first launch
    }
  }

  get model(): string {
    return this.data.model
  }

  get lens(): string {
    return this.data.lens
  }

  get anthropicKey(): string | null {
    return this.decrypt(this.data.anthropicKey)
  }

  get falKey(): string | null {
    return this.decrypt(this.data.falKey)
  }

  view(): SettingsView {
    return {
      model: this.data.model,
      lens: this.data.lens,
      hasAnthropicKey: this.anthropicKey !== null,
      hasFalKey: this.falKey !== null,
      encryptionAvailable: safeStorage.isEncryptionAvailable(),
    }
  }

  update(u: SettingsUpdate): SettingsView {
    if (u.model !== undefined && MODELS.some((m) => m.id === u.model)) {
      this.data.model = u.model
    }
    if (u.lens !== undefined && LENSES.some((l) => l.id === u.lens)) {
      this.data.lens = u.lens
    }
    if (u.anthropicKey !== undefined) {
      this.data.anthropicKey = u.anthropicKey === '' ? undefined : this.encrypt(u.anthropicKey)
    }
    if (u.falKey !== undefined) {
      this.data.falKey = u.falKey === '' ? undefined : this.encrypt(u.falKey)
    }
    this.save()
    return this.view()
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
