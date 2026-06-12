import { SEARCH_DOMAIN } from '@shared/constants'
import type { Bookmark } from '@shared/types'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const BASE_STYLE = `
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: radial-gradient(120% 120% at 50% 0%, #27272a 0%, #09090b 70%);
    color: #e4e4e7; font-family: -apple-system, 'Helvetica Neue', sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  main { width: min(680px, 90vw); text-align: center; padding: 3rem 0; }
  h1 { font-family: Didot, 'Bodoni 72', Georgia, serif; font-size: 4rem; margin: 0; letter-spacing: .02em; }
  .tagline { color: #a1a1aa; font-style: italic; margin: .4rem 0 2.5rem; }
  a { color: #e4e4e7; text-decoration: none; }
`

export function homeHtml(bookmarks: Bookmark[]): string {
  const tiles = bookmarks
    .map(
      (b) => `<a class="tile" href="${esc(b.url)}"><span class="dot"></span>${esc(b.title)}</a>`,
    )
    .join('\n')
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Slopera</title>
<style>
${BASE_STYLE}
  form { display: flex; justify-content: center; margin-bottom: 2.5rem; }
  input {
    width: min(480px, 80vw); padding: .8rem 1.2rem; font-size: 1rem; border-radius: 999px;
    border: 1px solid #3f3f46; background: #18181b; color: #e4e4e7; outline: none;
  }
  input:focus { border-color: #a78bfa; }
  .tiles { display: flex; flex-wrap: wrap; gap: .6rem; justify-content: center; }
  .tile {
    padding: .55rem 1rem; border: 1px solid #3f3f46; border-radius: 999px; font-size: .9rem;
    background: rgba(24,24,27,.7); transition: border-color .15s;
  }
  .tile:hover { border-color: #a78bfa; }
  .dot { display: inline-block; width: .5em; height: .5em; border-radius: 50%;
    background: linear-gradient(135deg, #a78bfa, #f472b6); margin-right: .5em; }
</style></head>
<body>
<main>
  <h1>Slopera</h1>
  <p class="tagline">The browser for the slop era.</p>
  <form id="f"><input id="q" placeholder="Dream up anything…" autofocus></form>
  <nav class="tiles">
${tiles}
  </nav>
</main>
<script>
  document.getElementById('f').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = document.getElementById('q').value.trim();
    if (!v) return;
    if (/^[a-z0-9.-]+\\.[a-z]{2,}([/?#]|$)/i.test(v)) location.href = 'https://' + v;
    else location.href = 'https://${SEARCH_DOMAIN}/search?q=' + encodeURIComponent(v);
  });
</script>
</body>
</html>`
}

export function onboardingHtml(): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Slopera — connect the dream</title>
<style>${BASE_STYLE}
  main { text-align: left; }
  h1 { font-size: 2.6rem; text-align: center; }
  .tagline { text-align: center; }
  ol { line-height: 1.9; color: #d4d4d8; }
  code { background: #18181b; border: 1px solid #3f3f46; border-radius: 4px; padding: .1em .4em; }
</style></head>
<body>
<main>
  <h1>Slopera</h1>
  <p class="tagline">The dream engine is not connected yet.</p>
  <ol>
    <li>Open <strong>Settings</strong> — the gear button in the toolbar.</li>
    <li>Paste your <strong>Anthropic API key</strong> (pages) and optionally a
        <strong>fal.ai key</strong> (images).</li>
    <li>Come back and type any URL. The web will be dreamed for you.</li>
  </ol>
  <p style="color:#71717a">Keys are stored encrypted on this machine and are only ever
  sent to their respective APIs.</p>
</main>
</body>
</html>`
}

export function errorHtml(url: string, message: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>The dream could not be reached</title>
<style>${BASE_STYLE}
  .err { color: #fca5a5; font-family: ui-monospace, monospace; font-size: .85rem;
    background: #18181b; border: 1px solid #3f3f46; border-radius: 8px; padding: 1rem;
    word-break: break-word; }
  .retry { display: inline-block; margin-top: 1.5rem; padding: .6rem 1.4rem;
    border: 1px solid #a78bfa; border-radius: 999px; }
</style></head>
<body>
<main>
  <h1 style="font-size:2.4rem">The dream could not be reached</h1>
  <p class="tagline">${esc(url)}</p>
  <p class="err">${esc(message)}</p>
  <a class="retry" href="${esc(url)}">Dream again</a>
</main>
</body>
</html>`
}

/** Appended to a page whose generation failed mid-stream. */
export function errorFooterHtml(message: string): string {
  return `
<div style="margin:2rem;padding:1rem;border:1px dashed #999;font-family:monospace;color:#666">
  the dream collapsed mid-sentence: ${esc(message)}
</div>`
}
