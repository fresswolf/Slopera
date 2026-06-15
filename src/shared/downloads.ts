/**
 * Parsing + safety for slopera-dl:// download links. Pure (no Electron) so the
 * sanitization and the extension whitelist are unit-testable. The model emits
 * `slopera-dl://download/<filename>?prompt=<description>`; this turns that into a
 * safe save name and a content-type, or null if the file can't be honored.
 */

/** Text-native formats an LLM can actually emit as valid, openable bytes. */
const CONTENT_TYPES: Record<string, string> = {
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  json: 'application/json',
  xml: 'application/xml',
  html: 'text/html',
  svg: 'image/svg+xml',
  ics: 'text/calendar',
  vcf: 'text/vcard',
  yaml: 'application/yaml',
  yml: 'application/yaml',
  log: 'text/plain',
  srt: 'application/x-subrip',
}

export interface DownloadTarget {
  /** Sanitized, flat basename safe to use as a save name. */
  basename: string
  /** Full content-type header value, charset-tagged. */
  contentType: string
}

export function parseDownloadTarget(url: string): DownloadTarget | null {
  let segment: string
  try {
    const u = new URL(url)
    segment = u.pathname.split('/').pop() ?? ''
    try {
      segment = decodeURIComponent(segment)
    } catch {
      // leave the raw segment; sanitize below will scrub it
    }
  } catch {
    return null
  }

  const basename = sanitizeBasename(segment)
  if (!basename) return null

  const ext = basename.slice(basename.lastIndexOf('.') + 1).toLowerCase()
  const type = CONTENT_TYPES[ext]
  if (!type) return null

  return { basename, contentType: `${type}; charset=utf-8` }
}

/** Characters illegal in filenames across common platforms. */
const ILLEGAL = /[<>:"/\\|?*]/g

/** Drop ASCII control characters (below 0x20 and DEL) without a control regex. */
function stripControl(s: string): string {
  let out = ''
  for (const ch of s) {
    const code = ch.charCodeAt(0)
    if (code >= 0x20 && code !== 0x7f) out += ch
  }
  return out
}

/**
 * Collapse an LLM-written path segment to a single safe filename: no directory
 * parts, no traversal, no control/illegal chars, capped length, exactly one
 * extension. Returns null if nothing usable remains.
 */
function sanitizeBasename(raw: string): string | null {
  // Take only the last path component, so `../../etc/passwd.csv` -> `passwd.csv`.
  const flat = raw.replace(/\\/g, '/').split('/').pop() ?? ''
  const cleaned = stripControl(flat)
    .replace(ILLEGAL, '')
    .replace(/^\.+/, '') // no leading dots -> no hidden/`..` files
    .trim()

  const dot = cleaned.lastIndexOf('.')
  if (dot <= 0 || dot === cleaned.length - 1) return null // need stem + extension

  let stem = cleaned.slice(0, dot)
  const ext = cleaned.slice(dot + 1)
  if (stem.length > 90) stem = stem.slice(0, 90)
  if (!stem) return null

  return `${stem}.${ext}`
}
