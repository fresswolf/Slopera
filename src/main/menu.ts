import { app, Menu } from 'electron'
import type { BrowserWindow, MenuItemConstructorOptions } from 'electron'
import type { TabManager } from './tabs'

export function buildMenu(tabs: TabManager, win: BrowserWindow): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [
        { label: 'New Tab', accelerator: 'CmdOrCtrl+T', click: () => tabs.create() },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            if (tabs.count > 1) tabs.closeActive()
            else win.close()
          },
        },
      ],
    },
    { label: 'Edit', role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { label: 'Re-dream This Page', accelerator: 'CmdOrCtrl+R', click: () => tabs.reload() },
        { label: 'Back', accelerator: 'CmdOrCtrl+[', click: () => tabs.back() },
        { label: 'Forward', accelerator: 'CmdOrCtrl+]', click: () => tabs.forward() },
        { type: 'separator' },
        {
          label: 'Open Address Bar',
          accelerator: 'CmdOrCtrl+L',
          click: () => win.webContents.send('ui:focus-omnibox'),
        },
        { type: 'separator' },
        {
          label: 'Page DevTools',
          accelerator: 'Alt+CmdOrCtrl+I',
          click: () => tabs.openActiveDevTools(),
        },
        { label: 'Chrome DevTools', click: () => win.webContents.openDevTools({ mode: 'detach' }) },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { label: 'Window', role: 'windowMenu' },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
