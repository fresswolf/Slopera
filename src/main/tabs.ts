import { WebContentsView } from 'electron'
import type { BrowserWindow, WebContents } from 'electron'
import { CHROME_HEIGHT, HOME_URL, TAB_PARTITION } from '@shared/constants'
import { httpToSlopera, normalizePageUrl, urlToDisplay } from '@shared/omnibox'
import type { TabsSnapshot } from '@shared/types'
import type { SettingsStore } from './settings'
import type { HistoryStore } from './store/history'

interface Tab {
  id: number
  view: WebContentsView
  /** Suppress the next did-navigate history record (back/forward/re-dream). */
  skipHistoryOnce: boolean
}

export interface TabManagerDeps {
  settings: SettingsStore
  history: HistoryStore
  markForRegen: (url: string, lens: string) => void
}

export class TabManager {
  private tabs = new Map<number, Tab>()
  private order: number[] = []
  private activeId: number | null = null
  private nextId = 1
  private overlayOpen = false
  private listeners: Array<(s: TabsSnapshot) => void> = []

  constructor(
    private win: BrowserWindow,
    private deps: TabManagerDeps,
  ) {
    win.on('resize', () => this.layout())
  }

  onState(cb: (s: TabsSnapshot) => void): void {
    this.listeners.push(cb)
  }

  create(url = HOME_URL, activate = true): void {
    const id = this.nextId++
    const view = new WebContentsView({
      webPreferences: {
        partition: TAB_PARTITION,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    })
    view.setBackgroundColor('#ffffff')
    const tab: Tab = { id, view, skipHistoryOnce: false }
    this.tabs.set(id, tab)
    this.order.push(id)
    this.wire(tab)
    this.win.contentView.addChildView(view)
    if (activate) this.activate(id)
    this.layout()
    void view.webContents.loadURL(url)
    this.emit()
  }

  close(id: number): void {
    const tab = this.tabs.get(id)
    if (!tab) return
    this.win.contentView.removeChildView(tab.view)
    tab.view.webContents.close()
    this.tabs.delete(id)
    const idx = this.order.indexOf(id)
    this.order.splice(idx, 1)
    if (this.order.length === 0) {
      this.win.close()
      return
    }
    if (this.activeId === id) {
      this.activate(this.order[Math.min(idx, this.order.length - 1)]!)
    }
    this.emit()
  }

  closeActive(): void {
    if (this.activeId !== null) this.close(this.activeId)
  }

  get count(): number {
    return this.order.length
  }

  activate(id: number): void {
    if (!this.tabs.has(id)) return
    this.activeId = id
    for (const tab of this.tabs.values()) {
      tab.view.setVisible(tab.id === id && !this.overlayOpen)
    }
    this.emit()
  }

  navigate(input: string, url: string): void {
    void input
    const wc = this.activeWc()
    if (wc) void wc.loadURL(url)
  }

  back(): void {
    const tab = this.active()
    if (tab?.view.webContents.navigationHistory.canGoBack()) {
      tab.skipHistoryOnce = true
      tab.view.webContents.navigationHistory.goBack()
    }
  }

  forward(): void {
    const tab = this.active()
    if (tab?.view.webContents.navigationHistory.canGoForward()) {
      tab.skipHistoryOnce = true
      tab.view.webContents.navigationHistory.goForward()
    }
  }

  /** Reload is the re-dream button: same URL, fresh hallucination. */
  reload(): void {
    const tab = this.active()
    if (!tab) return
    const url = tab.view.webContents.getURL()
    if (!url.startsWith('slopera://')) return
    this.deps.markForRegen(url, this.deps.settings.lens)
    tab.skipHistoryOnce = true
    tab.view.webContents.reload()
  }

  stop(): void {
    this.activeWc()?.stop()
  }

  home(): void {
    const wc = this.activeWc()
    if (wc) void wc.loadURL(HOME_URL)
  }

  setOverlay(open: boolean): void {
    this.overlayOpen = open
    for (const tab of this.tabs.values()) {
      tab.view.setVisible(tab.id === this.activeId && !open)
    }
  }

  openActiveDevTools(): void {
    this.activeWc()?.openDevTools({ mode: 'detach' })
  }

  activeUrl(): string | null {
    const url = this.activeWc()?.getURL()
    return url && url !== '' ? url : null
  }

  activeTitle(): string {
    return this.activeWc()?.getTitle() ?? ''
  }

  snapshot(): TabsSnapshot {
    const tabs = this.order
      .map((id) => this.tabs.get(id))
      .filter((t): t is Tab => t !== undefined)
      .map((t) => {
        const wc = t.view.webContents
        const url = wc.getURL()
        return {
          id: t.id,
          title: wc.getTitle() || 'New Tab',
          url,
          displayUrl: urlToDisplay(url),
          loading: wc.isLoading(),
          canGoBack: wc.navigationHistory.canGoBack(),
          canGoForward: wc.navigationHistory.canGoForward(),
        }
      })
    return { tabs, activeId: this.activeId }
  }

  private active(): Tab | null {
    return this.activeId === null ? null : (this.tabs.get(this.activeId) ?? null)
  }

  private activeWc(): WebContents | null {
    return this.active()?.view.webContents ?? null
  }

  private wire(tab: Tab): void {
    const wc = tab.view.webContents

    wc.on('will-navigate', (event, url) => {
      if (url.startsWith('slopera://')) return
      event.preventDefault()
      const rewritten = httpToSlopera(url)
      if (rewritten) void wc.loadURL(rewritten)
    })

    wc.setWindowOpenHandler(({ url }) => {
      const target = url.startsWith('slopera://') ? url : httpToSlopera(url)
      if (target) this.create(target)
      return { action: 'deny' }
    })

    wc.on('did-navigate', (_event, url) => {
      if (tab.skipHistoryOnce) {
        tab.skipHistoryOnce = false
      } else {
        const norm = normalizePageUrl(url)
        if (norm && new URL(norm).host !== 'home') {
          this.deps.history.add(norm, urlToDisplay(norm), this.deps.settings.lens)
        }
      }
      this.emit()
    })

    wc.on('page-title-updated', (_event, title) => {
      const norm = normalizePageUrl(wc.getURL())
      if (norm) this.deps.history.touchTitle(norm, title)
      this.emit()
    })

    wc.on('did-start-loading', () => this.emit())
    wc.on('did-stop-loading', () => this.emit())
    wc.on('did-finish-load', () => this.emit())
    wc.on('did-fail-load', () => this.emit())
  }

  private layout(): void {
    const [width, height] = this.win.getContentSize()
    const bounds = { x: 0, y: CHROME_HEIGHT, width: width ?? 0, height: Math.max(0, (height ?? 0) - CHROME_HEIGHT) }
    for (const tab of this.tabs.values()) {
      tab.view.setBounds(bounds)
    }
  }

  private emit(): void {
    const snap = this.snapshot()
    for (const cb of this.listeners) cb(snap)
  }
}
