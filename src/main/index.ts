import { app, BrowserWindow, Notification, nativeImage, protocol, session } from 'electron'
import type { BrowserWindowConstructorOptions } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  DEFAULT_BOOKMARKS,
  DL_SCHEME,
  HOME_URL,
  IMG_SCHEME,
  PAGE_SCHEME,
  TAB_PARTITION,
} from '@shared/constants'
import { pageKey } from '@shared/omnibox'
import { AnthropicPageGenerator } from './generation/anthropic'
import { OpenRouterPageGenerator } from './generation/openrouter'
import { FixturePageGenerator } from './generation/fixture'
import type { PageGenerator } from './generation/types'
import { registerIpc } from './ipc'
import { buildMenu } from './menu'
import { registerDownloadProtocol } from './protocols/download'
import { registerImageProtocol } from './protocols/image'
import { registerPageProtocol } from './protocols/page'
import { SettingsStore } from './settings'
import { openDb } from './store/db'
import { BiblesStore } from './store/bibles'
import { BookmarksStore } from './store/bookmarks'
import { HistoryStore } from './store/history'
import { PagesStore } from './store/pages'
import { TabManager } from './tabs'

protocol.registerSchemesAsPrivileged([
  { scheme: PAGE_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
  { scheme: IMG_SCHEME, privileges: { standard: true, secure: true, stream: true } },
  { scheme: DL_SCHEME, privileges: { standard: true, secure: true, stream: true } },
])

// In dev, electron-vite runs from out/, so Electron can't resolve our package.json
// and app.name would fall back to "Electron". Force it so the menu bar reads "Slopera".
app.setName('Slopera')

if (process.env.SLOPERA_USER_DATA) {
  app.setPath('userData', process.env.SLOPERA_USER_DATA)
}

app.whenReady().then(() => {
  // Packaged builds use the bundle icon automatically; in dev the dock and the
  // "About" panel would otherwise show the default Electron icon.
  if (!app.isPackaged && process.platform === 'darwin') {
    const icon = nativeImage.createFromPath(join(app.getAppPath(), 'build', 'icon.png'))
    if (!icon.isEmpty()) app.dock?.setIcon(icon)
  }

  const userData = app.getPath('userData')
  const pagesDir = join(userData, 'pages')
  const imagesDir = join(userData, 'images')
  mkdirSync(pagesDir, { recursive: true })
  mkdirSync(imagesDir, { recursive: true })

  const settings = new SettingsStore(userData)
  const db = openDb(join(userData, 'slopera.sqlite'))
  const pages = new PagesStore(db, pagesDir)
  const history = new HistoryStore(db)
  const bookmarks = new BookmarksStore(db)
  const bibles = new BiblesStore(db)
  bookmarks.seedIfEmpty(DEFAULT_BOOKMARKS)

  // Generated pages run LLM-written JS: they live in their own hardened
  // session with no Node, no preload, and no real network.
  const ses = session.fromPartition(TAB_PARTITION)
  ses.webRequest.onBeforeRequest((details, callback) => {
    const allowed = /^(slopera|slopera-img|slopera-dl|data|blob|about|devtools|chrome-devtools):/.test(details.url)
    callback({ cancel: !allowed })
  })
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))

  const anthropicGen = new AnthropicPageGenerator(() => ({
    apiKey: settings.anthropicKey,
    model: settings.model,
    customLenses: settings.customLenses,
  }))
  const openRouterGen = new OpenRouterPageGenerator(() => ({
    apiKey: settings.openRouterKey,
    model: settings.model,
    customLenses: settings.customLenses,
  }))
  // Provider is resolved per request so a Settings change takes effect immediately.
  const pickGen = () => (settings.textProvider === 'openrouter' ? openRouterGen : anthropicGen)
  const generator: PageGenerator =
    process.env.SLOPERA_FAKE_GEN === '1'
      ? new FixturePageGenerator()
      : {
          streamPage: (req, signal) => pickGen().streamPage(req, signal),
          streamFile: (req, signal) => pickGen().streamFile(req, signal),
        }

  const pageCtl = registerPageProtocol(ses, { settings, pages, bibles, bookmarks, generator })
  registerImageProtocol(ses, settings, imagesDir)
  registerDownloadProtocol(ses, {
    settings,
    generator,
    onTotalFailure: (filename) => {
      if (Notification.isSupported()) {
        new Notification({ title: 'Download failed', body: `Couldn’t generate ${filename}` }).show()
      }
    },
  })

  // Window chrome is platform-specific. macOS keeps the inset title bar with
  // its traffic lights; Windows goes frameless with a native control overlay
  // painted inside our 38px tab strip (see TabStrip) and an auto-hidden menu
  // bar (revealed with Alt) so we collapse to a single Chrome-style top row.
  const chrome: Partial<BrowserWindowConstructorOptions> =
    process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' }
      : process.platform === 'win32'
        ? {
            titleBarStyle: 'hidden',
            titleBarOverlay: { color: '#18181b', symbolColor: '#a1a1aa', height: 38 },
            autoHideMenuBar: true,
          }
        : {}

  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 760,
    minHeight: 520,
    show: false,
    backgroundColor: '#18181b',
    title: 'Slopera',
    ...chrome,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
    },
  })

  const tabs = new TabManager(win, {
    settings,
    history,
    markForRegen: pageCtl.markForRegen,
    recordParent: pageCtl.recordParent,
    servedLensFor: pageCtl.servedLensFor,
    hasSnapshot: (normUrl, lens) => pages.latest(pageKey(normUrl, lens)) !== null,
  })
  tabs.onState((snapshot) => {
    if (!win.isDestroyed()) win.webContents.send('tabs:state', snapshot)
  })
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('tabs:state', tabs.snapshot())
  })

  registerIpc({ tabs, settings, history, bookmarks, pages, bibles, imagesDir })
  buildMenu(tabs, win)

  win.once('ready-to-show', () => win.show())

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }

  tabs.create(HOME_URL)
})

app.on('window-all-closed', () => {
  app.quit()
})
