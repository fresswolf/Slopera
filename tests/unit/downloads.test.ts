import { describe, expect, it } from 'vitest'
import { parseDownloadTarget } from '@shared/downloads'

describe('parseDownloadTarget', () => {
  it('accepts a whitelisted text extension and tags the content-type', () => {
    const t = parseDownloadTarget('slopera-dl://download/q3-budget.csv?prompt=stuff')
    expect(t).toEqual({ basename: 'q3-budget.csv', contentType: 'text/csv; charset=utf-8' })
  })

  it('maps a few representative formats', () => {
    expect(parseDownloadTarget('slopera-dl://download/a.json')?.contentType).toBe(
      'application/json; charset=utf-8',
    )
    expect(parseDownloadTarget('slopera-dl://download/event.ics')?.contentType).toBe(
      'text/calendar; charset=utf-8',
    )
    expect(parseDownloadTarget('slopera-dl://download/card.vcf')?.contentType).toBe(
      'text/vcard; charset=utf-8',
    )
    expect(parseDownloadTarget('slopera-dl://download/logo.svg')?.contentType).toBe(
      'image/svg+xml; charset=utf-8',
    )
  })

  it('is case-insensitive on the extension', () => {
    expect(parseDownloadTarget('slopera-dl://download/DATA.CSV')?.basename).toBe('DATA.CSV')
  })

  it('decodes percent-encoded filenames', () => {
    expect(parseDownloadTarget('slopera-dl://download/my%20notes.txt')?.basename).toBe(
      'my notes.txt',
    )
  })

  it('rejects binary and unknown extensions', () => {
    for (const url of [
      'slopera-dl://download/report.pdf',
      'slopera-dl://download/sheet.xlsx',
      'slopera-dl://download/archive.zip',
      'slopera-dl://download/tool.exe',
      'slopera-dl://download/noext',
    ]) {
      expect(parseDownloadTarget(url)).toBeNull()
    }
  })

  it('flattens path traversal to a safe basename', () => {
    expect(parseDownloadTarget('slopera-dl://download/../../etc/passwd.csv')?.basename).toBe(
      'passwd.csv',
    )
  })

  it('strips leading dots so no hidden file is produced', () => {
    // `...secret.json` -> dots stripped -> `secret.json`
    expect(parseDownloadTarget('slopera-dl://download/...secret.json')?.basename).toBe(
      'secret.json',
    )
  })

  it('caps an absurdly long stem while keeping the extension', () => {
    const long = 'a'.repeat(500)
    const out = parseDownloadTarget(`slopera-dl://download/${long}.csv`)
    expect(out).not.toBeNull()
    expect(out!.basename.endsWith('.csv')).toBe(true)
    expect(out!.basename.length).toBeLessThanOrEqual(95)
  })

  it('returns null for an unparseable URL', () => {
    expect(parseDownloadTarget('not a url')).toBeNull()
  })
})
