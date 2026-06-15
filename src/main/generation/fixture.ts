import type { FileRequest, PageGenerator, PageRequest } from './types'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Deterministic offline generator, used when SLOPERA_FAKE_GEN=1 — for the
 * Playwright smoke test and for hacking on the UI without burning tokens.
 */
export class FixturePageGenerator implements PageGenerator {
  async *streamPage(req: PageRequest, signal: AbortSignal): AsyncGenerator<string> {
    const title =
      req.host === 'wikipedia.org'
        ? 'Wikipedopedia — The Free Encyclopedia That Never Was'
        : `Dream of ${req.host}`
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  body { font-family: Georgia, serif; margin: 2rem auto; max-width: 640px; color: #222; }
  header { border-bottom: 2px solid #222; padding-bottom: .5rem; margin-bottom: 1rem; }
  a { color: #0645ad; }
</style>
</head>
<body>
<header><h1>${title}</h1></header>
<p>This is a fixture page for <strong>${req.url}</strong>, rendered without any API
calls. The lens is <em>${req.lens}</em>.</p>
<p><img src="slopera-img://gen/?prompt=a%20placeholder%20test%20image&w=320&h=180" width="320" height="180" alt="placeholder"></p>
<p>Continue the dream at <a href="https://${req.host}/deeper/into/the/dream">a deeper page</a>
or visit <a href="https://elsewhere.example/portal">another site entirely</a>.</p>
<p><a href="slopera-dl://download/dream-data.csv?prompt=a%20small%20fixture%20dataset">Download the data (CSV)</a></p>
</body>
</html>`
    for (const chunk of html.match(/[\s\S]{1,200}/g) ?? []) {
      if (signal.aborted) return
      await sleep(15)
      yield chunk
    }
  }

  async *streamFile(req: FileRequest, signal: AbortSignal): AsyncGenerator<string> {
    const body = fixtureFileBody(req)
    for (const chunk of body.match(/[\s\S]{1,200}/g) ?? []) {
      if (signal.aborted) return
      await sleep(15)
      yield chunk
    }
  }
}

/** Deterministic, format-appropriate contents for the offline file generator. */
function fixtureFileBody(req: FileRequest): string {
  const ext = req.filename.slice(req.filename.lastIndexOf('.') + 1).toLowerCase()
  const note = req.prompt || 'fixture file'
  switch (ext) {
    case 'csv':
    case 'tsv': {
      const sep = ext === 'tsv' ? '\t' : ','
      const rows = [
        ['id', 'name', 'amount'],
        ['1', 'Alpha', '100.00'],
        ['2', 'Beta', '250.50'],
        ['3', 'Gamma', '42.00'],
      ]
      return rows.map((r) => r.join(sep)).join('\n') + '\n'
    }
    case 'json':
      return JSON.stringify({ file: req.filename, note, rows: [1, 2, 3] }, null, 2) + '\n'
    case 'svg':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="#3f3f46"/><text x="80" y="50" fill="#fff" text-anchor="middle" font-size="12">${note}</text></svg>\n`
    default:
      return `Fixture contents for ${req.filename}.\n\n${note}\n`
  }
}
