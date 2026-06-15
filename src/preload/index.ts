import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type { SloperaApi, TabsSnapshot } from '@shared/types'

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_e: IpcRendererEvent, payload: T) => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: SloperaApi = {
  tabs: {
    create: (input) => ipcRenderer.send('tabs:create', input),
    close: (id) => ipcRenderer.send('tabs:close', id),
    activate: (id) => ipcRenderer.send('tabs:activate', id),
    navigate: (input) => ipcRenderer.send('tabs:navigate', input),
    back: () => ipcRenderer.send('tabs:back'),
    forward: () => ipcRenderer.send('tabs:forward'),
    reload: () => ipcRenderer.send('tabs:reload'),
    stop: () => ipcRenderer.send('tabs:stop'),
    home: () => ipcRenderer.send('tabs:home'),
  },
  onTabsState: (cb) => subscribe<TabsSnapshot>('tabs:state', cb),
  onFocusOmnibox: (cb) => subscribe<void>('ui:focus-omnibox', () => cb()),
  history: {
    list: (query) => ipcRenderer.invoke('history:list', query),
    clear: () => ipcRenderer.invoke('history:clear'),
  },
  bookmarks: {
    list: () => ipcRenderer.invoke('bookmarks:list'),
    add: (url, title) => ipcRenderer.invoke('bookmarks:add', url, title),
    remove: (id) => ipcRenderer.invoke('bookmarks:remove', id),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (update) => ipcRenderer.invoke('settings:set', update),
  },
  lenses: {
    add: (label, instructions) => ipcRenderer.invoke('lenses:add', label, instructions),
    update: (id, label, instructions) =>
      ipcRenderer.invoke('lenses:update', id, label, instructions),
    remove: (id) => ipcRenderer.invoke('lenses:remove', id),
  },
  cache: {
    stats: () => ipcRenderer.invoke('cache:stats'),
    clear: () => ipcRenderer.invoke('cache:clear'),
  },
  ui: {
    setOverlay: (open) => ipcRenderer.send('ui:set-overlay', open),
  },
}

contextBridge.exposeInMainWorld('slopera', api)
