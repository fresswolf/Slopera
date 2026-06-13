import { PAGE_SCHEME } from './constants'
import { httpToSlopera, normalizePageUrl } from './omnibox'

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
}

function decodeEntitiesLite(s: string): string {
  return s.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m)
}

export function extractTitle(html: string): string | null {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  if (!m || m[1] === undefined) return null
  const title = decodeEntitiesLite(m[1]).replace(/\s+/g, ' ').trim()
  return title === '' ? null : title
}

/** Plain-text gist of a page, fed back as parent context for link clicks. */
export function extractSummary(html: string, max = 320): string {
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
  s = decodeEntitiesLite(s).replace(/\s+/g, ' ').trim()
  return s.length > max ? `${s.slice(0, max)}…` : s
}

/** What the clicked link said about its destination. */
export interface LinkContext {
  /** Visible anchor text. */
  text: string | null
  /** The anchor's title attribute, if any. */
  title: string | null
  /** alt text of an image inside the anchor (thumbnail links). */
  alt: string | null
}

const ATTR_RE = (name: string) =>
  new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')

function attr(tag: string, name: string): string | null {
  const m = ATTR_RE(name).exec(tag)
  if (!m) return null
  const v = m[2] ?? m[3] ?? m[4] ?? ''
  return v.trim() === '' ? null : decodeEntitiesLite(v).trim()
}

function plainText(html: string): string {
  return decodeEntitiesLite(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Resolve a link href the same way navigation does (see tabs.ts will-navigate):
 * absolute http(s) and site-relative hrefs both become a canonical slopera URL.
 */
function hrefToPageUrl(href: string, base: string): string | null {
  try {
    const u = new URL(href, base)
    if (u.protocol === 'http:' || u.protocol === 'https:') return httpToSlopera(u.href)
    if (u.protocol === `${PAGE_SCHEME}:`) return normalizePageUrl(u.href)
    return null
  } catch {
    return null
  }
}

/**
 * Find the link in `parentHtml` that leads to `childUrl` and report what it
 * told the user about the destination. Matching is exact-by-construction: each
 * href is normalized through the same rewrite the browser used to navigate, so
 * the clicked link resolves to `childUrl` byte-for-byte. Returns null when no
 * link matches or the match carries no usable label.
 */
export function extractLinkContext(
  parentHtml: string,
  parentUrl: string,
  childUrl: string,
): LinkContext | null {
  const target = normalizePageUrl(childUrl)
  if (!target) return null
  const anchor = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi
  for (let m = anchor.exec(parentHtml); m; m = anchor.exec(parentHtml)) {
    const attrs = m[1] ?? ''
    const inner = m[2] ?? ''
    const href = attr(attrs, 'href')
    if (!href) continue
    if (hrefToPageUrl(href, parentUrl) !== target) continue
    const text = plainText(inner) || null
    const title = attr(attrs, 'title')
    const imgMatch = /<img\b[^>]*>/i.exec(inner)
    const alt = imgMatch ? attr(imgMatch[0], 'alt') : null
    if (!text && !title && !alt) return null
    return { text, title, alt }
  }
  return null
}
