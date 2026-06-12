import { create } from 'zustand'
import type { Bookmark, SettingsUpdate, SettingsView, TabsSnapshot, TabState } from '@shared/types'

export type Overlay = 'none' | 'history' | 'settings'

interface UIState {
  tabs: TabState[]
  activeId: number | null
  overlay: Overlay
  focusNonce: number
  settings: SettingsView | null
  bookmarks: Bookmark[]
  setSnapshot: (snapshot: TabsSnapshot) => void
  toggleOverlay: (overlay: Exclude<Overlay, 'none'>) => void
  closeOverlay: () => void
  bumpFocus: () => void
  loadSettings: () => Promise<void>
  updateSettings: (update: SettingsUpdate) => Promise<void>
  loadBookmarks: () => Promise<void>
  addBookmark: (url: string, title: string) => Promise<void>
  removeBookmark: (id: number) => Promise<void>
}

export const useUI = create<UIState>()((set, get) => ({
  tabs: [],
  activeId: null,
  overlay: 'none',
  focusNonce: 0,
  settings: null,
  bookmarks: [],

  setSnapshot: ({ tabs, activeId }) => set({ tabs, activeId }),
  toggleOverlay: (overlay) => set({ overlay: get().overlay === overlay ? 'none' : overlay }),
  closeOverlay: () => set({ overlay: 'none' }),
  bumpFocus: () => set((s) => ({ focusNonce: s.focusNonce + 1, overlay: 'none' })),

  loadSettings: async () => set({ settings: await window.slopera.settings.get() }),
  updateSettings: async (update) => set({ settings: await window.slopera.settings.set(update) }),
  loadBookmarks: async () => set({ bookmarks: await window.slopera.bookmarks.list() }),
  addBookmark: async (url, title) => set({ bookmarks: await window.slopera.bookmarks.add(url, title) }),
  removeBookmark: async (id) => set({ bookmarks: await window.slopera.bookmarks.remove(id) }),
}))

export function selectActiveTab(s: { tabs: TabState[]; activeId: number | null }): TabState | null {
  return s.tabs.find((t) => t.id === s.activeId) ?? null
}
