export interface TabState {
  id: number
  title: string
  url: string
  displayUrl: string
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
}

export interface TabsSnapshot {
  tabs: TabState[]
  activeId: number | null
}

export interface HistoryEntry {
  id: number
  url: string
  displayUrl: string
  title: string
  lens: string
  visitedAt: number
}

export interface Bookmark {
  id: number
  url: string
  title: string
  position: number
}

import type { Lens } from './lenses'
import type { ImageProvider, TextProvider } from './constants'

export interface SettingsView {
  textProvider: TextProvider
  model: string
  imageProvider: ImageProvider
  imageModel: string
  lens: string
  customLenses: Lens[]
  hasAnthropicKey: boolean
  hasOpenRouterKey: boolean
  hasFalKey: boolean
  encryptionAvailable: boolean
}

export interface SettingsUpdate {
  textProvider?: TextProvider
  model?: string
  imageProvider?: ImageProvider
  imageModel?: string
  lens?: string
  anthropicKey?: string
  openRouterKey?: string
  falKey?: string
}

export interface CacheStats {
  pages: number
  images: number
  bytes: number
}

export interface SloperaApi {
  tabs: {
    create: (input?: string) => void
    close: (id: number) => void
    activate: (id: number) => void
    navigate: (input: string) => void
    back: () => void
    forward: () => void
    reload: () => void
    stop: () => void
    home: () => void
  }
  onTabsState: (cb: (snapshot: TabsSnapshot) => void) => () => void
  onFocusOmnibox: (cb: () => void) => () => void
  history: {
    list: (query?: string) => Promise<HistoryEntry[]>
    clear: () => Promise<void>
  }
  bookmarks: {
    list: () => Promise<Bookmark[]>
    add: (url: string, title: string) => Promise<Bookmark[]>
    remove: (id: number) => Promise<Bookmark[]>
  }
  settings: {
    get: () => Promise<SettingsView>
    set: (update: SettingsUpdate) => Promise<SettingsView>
  }
  lenses: {
    add: (label: string, instructions: string) => Promise<SettingsView>
    remove: (id: string) => Promise<SettingsView>
  }
  cache: {
    stats: () => Promise<CacheStats>
    clear: () => Promise<CacheStats>
  }
  ui: {
    setOverlay: (open: boolean) => void
  }
}
