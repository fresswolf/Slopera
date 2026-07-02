import { WebContentsView } from 'electron'
import type { BrowserWindow, WebContents } from 'electron'
import { CHROME_HEIGHT, HOME_URL, LENS_BANNER_HEIGHT, TAB_PARTITION } from '@shared/constants'
import { httpToSlopera, normalizePageUrl, urlToDisplay } from '@shared/omnibox'
import type { TabsSnapshot } from '@shared/types'
import type { SettingsStore } from './settings'
import type { HistoryStore } from './store/history'

interface Tab {
  id: number
  view: WebContentsView
  /** Suppress the next did-navigate history record (back/forward/re-dream). */
  skipHistoryOnce: boolean
  /** Lens the current page was dreamed in, captured at navigation time. */
  servedLens: string | null
  /** X on the mismatch infobar; cleared on navigation and lens change. */
  bannerDismissed: boolean
}

export interface TabManagerDeps {
  settings: SettingsStore
  history: HistoryStore
  markForRegen: (url: string, lens: string) => void
  /** Tell the page protocol which page a navigation came from (no referrer exists). */
  recordParent: (childUrl: string, parentUrl: string) => void
  /** Ask the page protocol which lens it served a URL from (cross-lens fallback). */
  servedLensFor: (normUrl: string) => string | null
  /** Whether a snapshot of this URL exists under this lens. */
  hasSnapshot: (normUrl: string, lens: string) => boolean
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
    const tab: Tab = { id, view, skipHistoryOnce: false, servedLens: null, bannerDismissed: false }
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

  /** X on the lens-mismatch infobar: hide it until the next navigation or lens change. */
  dismissBanner(): void {
    const tab = this.active()
    if (!tab) return
    tab.bannerDismissed = true
    this.emit()
  }

  /**
   * The active lens changed. Tabs whose page already exists under the new lens
   * restore that snapshot immediately (a plain reload — the exact-lens cache
   * hit wins); only tabs without one keep their cross-lens page and get the
   * mismatch banner. Dismissals reset either way.
   */
  lensChanged(): void {
    const lens = this.deps.settings.lens
    for (const tab of this.tabs.values()) {
      tab.bannerDismissed = false
      const wc = tab.view.webContents
      // Don't yank a page that's mid-dream; the banner covers it after loading.
      if (wc.isLoading()) continue
      if (tab.servedLens === null || tab.servedLens === lens) continue
      const norm = normalizePageUrl(wc.getURL())
      if (norm && this.deps.hasSnapshot(norm, lens)) {
        tab.skipHistoryOnce = true
        wc.reload()
      }
    }
    this.emit()
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
          servedLens: t.servedLens,
          bannerVisible: this.bannerVisible(t),
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
      // No referrer reaches a custom-scheme handler, so record the source page
      // here for the page protocol to honor the clicked link's intent.
      const parent = wc.getURL()
      // Downloads: let Chromium fetch the slopera-dl:// URL untouched. Its
      // attachment response turns the navigation into a download, so the current
      // page is never replaced.
      if (url.startsWith('slopera-dl://')) return
      if (url.startsWith('slopera://')) {
        this.deps.recordParent(url, parent)
        return
      }
      event.preventDefault()
      const rewritten = httpToSlopera(url)
      if (rewritten) {
        this.deps.recordParent(rewritten, parent)
        void wc.loadURL(rewritten)
      }
    })

    wc.setWindowOpenHandler(({ url }) => {
      // A download link with target=_blank: trigger the download on the current
      // contents instead of spawning an empty tab.
      if (url.startsWith('slopera-dl://')) {
        wc.downloadURL(url)
        return { action: 'deny' }
      }
      const target = url.startsWith('slopera://') ? url : httpToSlopera(url)
      if (target) {
        this.deps.recordParent(target, wc.getURL())
        this.create(target)
      }
      return { action: 'deny' }
    })

    wc.on('did-navigate', (_event, url) => {
      const norm = normalizePageUrl(url)
      tab.servedLens = norm ? this.deps.servedLensFor(norm) : null
      tab.bannerDismissed = false
      if (tab.skipHistoryOnce) {
        tab.skipHistoryOnce = false
      } else {
        if (norm && new URL(norm).host !== 'home') {
          // Record the lens you actually saw — a cross-lens cache hit is a
          // property of the snapshot, not of the dropdown at the time.
          this.deps.history.add(norm, urlToDisplay(norm), tab.servedLens ?? this.deps.settings.lens)
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

  private bannerVisible(tab: Tab): boolean {
    // A streaming page is being dreamed in the active lens; nothing to report.
    if (tab.view.webContents.isLoading()) return false
    return (
      tab.servedLens !== null && tab.servedLens !== this.deps.settings.lens && !tab.bannerDismissed
    )
  }

  private layout(): void {
    const [width, height] = this.win.getContentSize()
    for (const tab of this.tabs.values()) {
      const top = CHROME_HEIGHT + (this.bannerVisible(tab) ? LENS_BANNER_HEIGHT : 0)
      tab.view.setBounds({ x: 0, y: top, width: width ?? 0, height: Math.max(0, (height ?? 0) - top) })
    }
  }

  private emit(): void {
    // Banner visibility feeds both the snapshot and each tab's bounds; keep
    // them in lockstep by re-laying-out on every state change.
    this.layout()
    const snap = this.snapshot()
    for (const cb of this.listeners) cb(snap)
  }
}
