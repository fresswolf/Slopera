import { ipcMain } from 'electron'
import { readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { omniboxToUrl } from '@shared/omnibox'
import type { CacheStats } from '@shared/types'
import type { SettingsStore } from './settings'
import type { BiblesStore } from './store/bibles'
import type { BookmarksStore } from './store/bookmarks'
import type { HistoryStore } from './store/history'
import type { PagesStore } from './store/pages'
import type { TabManager } from './tabs'

const inputSchema = z.string().max(2048)
const idSchema = z.number().int().nonnegative()
const settingsUpdateSchema = z
  .object({
    model: z.string().max(64).optional(),
    lens: z.string().max(64).optional(),
    anthropicKey: z.string().max(512).optional(),
    falKey: z.string().max(512).optional(),
  })
  .strict()

export interface IpcDeps {
  tabs: TabManager
  settings: SettingsStore
  history: HistoryStore
  bookmarks: BookmarksStore
  pages: PagesStore
  bibles: BiblesStore
  imagesDir: string
}

export function registerIpc(deps: IpcDeps): void {
  const { tabs, settings, history, bookmarks, pages, bibles, imagesDir } = deps

  ipcMain.on('tabs:create', (_e, input?: unknown) => {
    const parsed = inputSchema.optional().safeParse(input)
    if (!parsed.success) return
    tabs.create(parsed.data === undefined ? undefined : omniboxToUrl(parsed.data))
  })
  ipcMain.on('tabs:close', (_e, id: unknown) => {
    const parsed = idSchema.safeParse(id)
    if (parsed.success) tabs.close(parsed.data)
  })
  ipcMain.on('tabs:activate', (_e, id: unknown) => {
    const parsed = idSchema.safeParse(id)
    if (parsed.success) tabs.activate(parsed.data)
  })
  ipcMain.on('tabs:navigate', (_e, input: unknown) => {
    const parsed = inputSchema.safeParse(input)
    if (parsed.success) tabs.navigate(parsed.data, omniboxToUrl(parsed.data))
  })
  ipcMain.on('tabs:back', () => tabs.back())
  ipcMain.on('tabs:forward', () => tabs.forward())
  ipcMain.on('tabs:reload', () => tabs.reload())
  ipcMain.on('tabs:stop', () => tabs.stop())
  ipcMain.on('tabs:home', () => tabs.home())

  ipcMain.on('ui:set-overlay', (_e, open: unknown) => {
    tabs.setOverlay(open === true)
  })

  ipcMain.handle('history:list', (_e, query?: unknown) => {
    const parsed = inputSchema.optional().safeParse(query)
    return history.list(parsed.success ? parsed.data : undefined)
  })
  ipcMain.handle('history:clear', () => {
    history.clear()
  })

  ipcMain.handle('bookmarks:list', () => bookmarks.list())
  ipcMain.handle('bookmarks:add', (_e, url: unknown, title: unknown) => {
    const u = inputSchema.safeParse(url)
    const t = inputSchema.safeParse(title)
    if (!u.success || !t.success) return bookmarks.list()
    return bookmarks.add(u.data, t.data || u.data)
  })
  ipcMain.handle('bookmarks:remove', (_e, id: unknown) => {
    const parsed = idSchema.safeParse(id)
    return parsed.success ? bookmarks.remove(parsed.data) : bookmarks.list()
  })

  ipcMain.handle('settings:get', () => settings.view())
  ipcMain.handle('settings:set', (_e, update: unknown) => {
    const parsed = settingsUpdateSchema.safeParse(update)
    return parsed.success ? settings.update(parsed.data) : settings.view()
  })

  ipcMain.handle('lenses:add', (_e, label: unknown, instructions: unknown) => {
    const l = z.string().trim().min(1).max(40).safeParse(label)
    const i = z.string().trim().min(1).max(2000).safeParse(instructions)
    return l.success && i.success ? settings.addLens(l.data, i.data) : settings.view()
  })
  ipcMain.handle('lenses:remove', (_e, id: unknown) => {
    const parsed = z.string().max(64).safeParse(id)
    return parsed.success ? settings.removeLens(parsed.data) : settings.view()
  })

  ipcMain.handle('cache:stats', (): CacheStats => cacheStats(pages, imagesDir))
  ipcMain.handle('cache:clear', (): CacheStats => {
    pages.clearAll()
    bibles.clear()
    for (const f of readdirSync(imagesDir)) rmSync(join(imagesDir, f), { force: true })
    return cacheStats(pages, imagesDir)
  })
}

function cacheStats(pages: PagesStore, imagesDir: string): CacheStats {
  const p = pages.stats()
  let images = 0
  let imageBytes = 0
  try {
    for (const f of readdirSync(imagesDir)) {
      images++
      imageBytes += statSync(join(imagesDir, f)).size
    }
  } catch {
    // images dir may not exist yet
  }
  return { pages: p.pages, images, bytes: p.bytes + imageBytes }
}
