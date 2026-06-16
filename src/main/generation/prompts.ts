import { DEFAULT_JS_LEVEL, DL_SCHEME, IMG_SCHEME, SEARCH_DOMAIN } from '@shared/constants'
import type { JsLevel } from '@shared/constants'
import type { LinkContext } from '@shared/extract'
import { resolveLens } from '@shared/lenses'
import type { Lens } from '@shared/lenses'
import type { FileRequest, PageRequest } from './types'

/** The JavaScript clause of the OUTPUT RULES, varied by the user's chosen level. */
function interactivityRule(level: JsLevel): string[] {
  if (level === 'static') {
    return [
      '- Do not include any JavaScript. No <script> elements at all. The page is',
      '  fully static HTML and CSS; links and GET forms are the only interactivity.',
    ]
  }
  if (level === 'rich') {
    return [
      '- Lean into interactivity: build ambitious vanilla-JavaScript mini-apps, games,',
      '  simulations and stateful widgets wherever the page invites them. Put all JS in',
      '  ONE <script> element at the very END of <body>, so the DOM it references already',
      '  exists. No external scripts, no fetch or XHR (the network is disabled), no',
      '  frameworks.',
    ]
  }
  return [
    '- Interactivity (calculators, toggles, games, form behavior) is welcome:',
    '  vanilla JavaScript in ONE <script> element at the very END of <body>, so the',
    '  DOM it references already exists. No external scripts, no fetch or XHR',
    '  (the network is disabled), no frameworks.',
  ]
}

export function buildSystemPrompt(
  lensId: string,
  customLenses: Lens[] = [],
  jsLevel: JsLevel = DEFAULT_JS_LEVEL,
): string {
  const lens = resolveLens(lensId, customLenses)
  return [
    'You are the rendering engine of Slopera, a browser that dreams the web.',
    'No real network exists. For every URL you receive, you produce the complete',
    'HTML document of that page as it plausibly exists in the dream.',
    '',
    'OUTPUT RULES',
    '- Output raw HTML only: no markdown fences, no commentary. Start immediately',
    '  with <!DOCTYPE html>.',
    '- The page must be fully self-contained. All CSS goes in ONE <style> element',
    '  inside <head>, before any body content, so the page styles itself while it',
    '  streams in.',
    ...interactivityRule(jsLevel),
    '',
    'IMAGES',
    `- Use <img src="${IMG_SCHEME}://gen/?prompt=DESCRIPTION&w=WIDTH&h=HEIGHT">.`,
    '  DESCRIPTION is a URL-encoded, richly detailed visual description including',
    '  medium and style (e.g. "press photo", "product shot on white", "oil',
    '  painting"). WIDTH/HEIGHT are the intended display size in pixels.',
    '- Use images where the real page would have them (0-6 per page) and always',
    '  give the img element explicit dimensions so the layout does not jump.',
    '',
    'DOWNLOADS',
    `- To offer a downloadable file, link to ${DL_SCHEME}://download/FILENAME?prompt=DESC`,
    '  where FILENAME has a real text extension (.csv .json .ics .vcf .txt .md .svg',
    '  .html .xml .yaml .srt .log) and DESC is a URL-encoded summary of what the',
    '  file should contain. Use this only where a real page genuinely would (e.g.',
    '  "Export CSV", "Add to calendar", "Download vCard"). Never link binary',
    '  formats (pdf, xlsx, docx, zip) — they cannot be dreamed.',
    '',
    'LINKS — every link is a door deeper into the dream',
    '- Every <a> href must be a plausible absolute URL (https://other-site.com/path)',
    '  or an absolute path on the current site (/section/article). Link generously;',
    '  all links work in this browser.',
    '- No mailto:, no javascript:, no # placeholders.',
    `- Search forms: method="GET", e.g. action="https://${SEARCH_DOMAIN}/search" with`,
    '  an input named "q".',
    '',
    'CONTENT',
    '- Invent everything: articles, names, products, prices, reviews, statistics.',
    '  Never reproduce real copyrighted text from memory. Public figures may exist',
    '  in the dream but everything they say or do here is invented.',
    '- Substantial but focused: roughly the real page above the fold plus a couple',
    '  of scrolls. Do not pad.',
    '',
    `LENS — the register of this dream: ${lens.instructions}`,
  ].join('\n')
}

export function buildUserPrompt(req: PageRequest, today = new Date()): string {
  const parts: string[] = [
    `Render this page: ${req.url}`,
    `Host: ${req.host}`,
    `Path: ${req.path || '/'}`,
    `Today's date in the dream: ${today.toISOString().slice(0, 10)}`,
  ]

  if (req.host === SEARCH_DOMAIN) {
    const q = searchQuery(req.path)
    if (q) {
      parts.push(
        `This is Google, the dream's search engine. Render the results page for the query "${q}":`,
        '8-10 diverse results from different invented-but-plausible domains, each with a',
        'linked title, a green URL line and a two-line snippet. Include a search box',
        'prefilled with the query, and the usual sponsored-result clutter at the top.',
      )
    } else {
      parts.push(
        "This is Google, the dream's search engine: render its minimalist homepage with a",
        'centered logo and search form.',
      )
    }
  }

  if (req.bible) {
    parts.push('', 'Site identity memo — stay strictly consistent with it:', req.bible)
  } else {
    parts.push('', 'First visit to this domain: establish a strong, memorable site identity.')
  }

  const arrival = req.link && linkArrival(req.link)
  if (req.parentUrl && arrival) {
    parts.push('', `The user arrived by ${arrival} on ${req.parentUrl}.`)
    if (req.parentSummary) parts.push(`For context, that page was about: ${req.parentSummary}`)
    parts.push(
      'This page is the destination of that link. It must deliver exactly what the link',
      'promised — same topic, same title, same subject matter. Treat the link as the',
      'authoritative description of what this page contains.',
    )
  } else if (req.parentUrl && req.parentSummary) {
    parts.push(
      '',
      `The user arrived by following a link on ${req.parentUrl}, a page about:`,
      req.parentSummary,
      'The new page must satisfy the expectation that link created.',
    )
  }

  return parts.join('\n')
}

/** Render the clicked link's signal as a clause: "clicking a link labeled …". */
function linkArrival(link: LinkContext): string | null {
  if (link.text) {
    return link.title
      ? `clicking a link labeled "${link.text}" (described as "${link.title}")`
      : `clicking a link labeled "${link.text}"`
  }
  if (link.alt) return `clicking a thumbnail showing "${link.alt}"`
  if (link.title) return `clicking a link described as "${link.title}"`
  return null
}

export function buildBiblePrompt(domain: string, html: string): string {
  return [
    `Below is the first page ever rendered for the fictional website "${domain}".`,
    'Write a compact style memo (max 120 words, plain text) that future pages of this',
    'site will follow: site name, color palette and typography, layout and main nav',
    'items, editorial tone, and any recurring fictional entities (people, products,',
    'section names) worth keeping consistent.',
    '',
    html.slice(0, 6000),
  ].join('\n')
}

export function buildFileSystemPrompt(
  filename: string,
  lensId: string,
  customLenses: Lens[] = [],
): string {
  const lens = resolveLens(lensId, customLenses)
  return [
    'You are the file generator of Slopera, a browser that dreams the web. The',
    `user is downloading a file named "${filename}". Produce its complete raw`,
    'contents — exactly the bytes that belong inside that file, and nothing else.',
    '',
    'OUTPUT RULES',
    '- Output ONLY the file contents. No commentary, no explanation, no markdown',
    '  code fences, no backticks. Start immediately with the first byte of the file.',
    '- Match the format the extension implies exactly: valid CSV, JSON, ICS,',
    '  vCard, SVG, HTML, etc. The file must open cleanly in its native app.',
    '- Invent realistic, self-consistent data. Never reproduce real copyrighted',
    '  text from memory.',
    '',
    `LENS — the register of this dream: ${lens.instructions}`,
  ].join('\n')
}

export function buildFileUserPrompt(req: FileRequest): string {
  return [
    `Filename: ${req.filename}`,
    `What this file should contain: ${req.prompt || 'plausible, realistic contents that match the filename'}`,
  ].join('\n')
}

function searchQuery(path: string): string | null {
  const i = path.indexOf('?')
  if (i === -1) return null
  const q = new URLSearchParams(path.slice(i + 1)).get('q')
  return q && q.trim() !== '' ? q : null
}
