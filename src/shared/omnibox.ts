import { HOME_URL, SEARCH_DOMAIN } from './constants'

const SCHEME_RE = /^[a-z][a-z0-9+.-]*:\/\//i

/** Turn raw omnibox input into a slopera:// URL. */
export function omniboxToUrl(raw: string): string {
  const input = raw.trim()
  if (input === '') return HOME_URL
  if (input.toLowerCase().startsWith('slopera://')) {
    return normalizePageUrl(input) ?? HOME_URL
  }
  if (SCHEME_RE.test(input)) {
    return httpToSlopera(input) ?? searchUrl(input)
  }
  if (/\s/.test(input)) return searchUrl(input)
  const hostPart = input.split(/[/?#]/, 1)[0] ?? ''
  if (!hostPart.includes('.')) return searchUrl(input)
  return normalizePageUrl(`slopera://${input}`) ?? searchUrl(input)
}

export function searchUrl(query: string): string {
  return `slopera://${SEARCH_DOMAIN}/search?q=${encodeURIComponent(query)}`
}

/** Convert an http(s) URL (e.g. a link in a generated page) to slopera://. */
export function httpToSlopera(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return normalizePageUrl(`slopera://${u.host}${u.pathname}${u.search}`)
  } catch {
    return null
  }
}

/**
 * Canonical page URL, used as cache identity: lowercase host, no hash,
 * no trailing slash except at the root. Node parses unregistered schemes
 * as non-special URLs (empty pathname at root), Chromium parses slopera://
 * as a standard scheme (pathname "/") — this normalizes both spellings.
 */
export function normalizePageUrl(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.host.toLowerCase()
    if (host === '') return null
    let path = u.pathname
    if (path !== '/' && path.endsWith('/')) path = path.slice(0, -1)
    if (path === '') path = '/'
    return `slopera://${host}${path}${u.search}`
  } catch {
    return null
  }
}

/** Cache identity of a page: one hallucination per (lens, canonical URL). */
export function pageKey(url: string, lens: string): string {
  return `${lens}|${normalizePageUrl(url) ?? url}`
}

/** What the omnibox shows for a given tab URL. */
export function urlToDisplay(url: string): string {
  if (url === '' || url === HOME_URL || url === 'slopera://home') return ''
  if (url.toLowerCase().startsWith('slopera://')) {
    const rest = url.slice('slopera://'.length)
    return rest.endsWith('/') && !rest.slice(0, -1).includes('/') ? rest.slice(0, -1) : rest
  }
  return url
}
