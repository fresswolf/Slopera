// On macOS, the application menu's bold title and the dock label come from the
// running .app bundle's Info.plist (CFBundleName), NOT from app.setName() or the
// menu template. In dev we run node_modules/electron/dist/Electron.app, so without
// this patch the menu reads "Electron" instead of "Slopera". Packaged builds are
// unaffected — electron-builder writes the correct plist itself.
//
// Runs as `predev`; a no-op on non-macOS and when already patched.
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync } from 'node:fs'

const APP_NAME = 'Slopera'

if (process.platform !== 'darwin') process.exit(0)

const appDir = 'node_modules/electron/dist/Electron.app/Contents'
const plist = `${appDir}/Info.plist`
if (!existsSync(plist)) {
  console.warn(`[patch-dev-app-name] ${plist} not found — skipping`)
  process.exit(0)
}

const plistBuddy = '/usr/libexec/PlistBuddy'
const set = (key) => {
  try {
    execFileSync(plistBuddy, ['-c', `Set :${key} ${APP_NAME}`, plist])
  } catch {
    // Key may not exist yet (e.g. CFBundleDisplayName); add it.
    execFileSync(plistBuddy, ['-c', `Add :${key} string ${APP_NAME}`, plist])
  }
}

set('CFBundleName')
set('CFBundleDisplayName')

// The "About" panel, dock, and Finder read the bundle's icon file (CFBundleIconFile),
// not app.dock.setIcon. Drop our icon in over Electron's, keeping the same filename.
const ourIcns = 'build/icon.icns'
if (existsSync(ourIcns)) {
  const iconName = execFileSync(plistBuddy, ['-c', 'Print :CFBundleIconFile', plist])
    .toString()
    .trim()
  copyFileSync(ourIcns, `${appDir}/Resources/${iconName}`)
}

console.log(`[patch-dev-app-name] dev Electron bundle now identifies as "${APP_NAME}"`)
