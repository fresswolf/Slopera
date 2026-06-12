import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'

// Boots the built app with the offline fixture generator (no API calls),
// types a URL, and waits for the dreamed page's title to reach the tab strip.
test('boots and dreams a page', async () => {
  const app = await electron.launch({
    args: ['out/main/index.js'],
    env: {
      ...process.env,
      SLOPERA_FAKE_GEN: '1',
      SLOPERA_USER_DATA: mkdtempSync(join(tmpdir(), 'slopera-e2e-')),
    },
  })
  // Both the chrome renderer and the tab's WebContentsView surface as
  // "windows"; pick the chrome (the only one not on the slopera:// scheme).
  await expect
    .poll(() => app.windows().some((w) => w.url().startsWith('file://') || w.url().startsWith('http://')), {
      timeout: 15_000,
    })
    .toBe(true)
  const chrome = app.windows().find((w) => !w.url().startsWith('slopera://'))!

  const omnibox = chrome.getByPlaceholder(/dream up a URL/i)
  await omnibox.click()
  await omnibox.fill('wikipedia.org')
  await omnibox.press('Enter')

  await expect(chrome.getByText('Wikipedopedia', { exact: false })).toBeVisible({ timeout: 30_000 })

  await app.close()
})
