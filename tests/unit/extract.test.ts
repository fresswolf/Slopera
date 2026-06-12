import { describe, expect, it } from 'vitest'
import { extractSummary, extractTitle } from '@shared/extract'

describe('extractTitle', () => {
  it('finds and decodes the title', () => {
    expect(extractTitle('<html><head><title> Octopus &amp; Friends </title></head></html>')).toBe(
      'Octopus & Friends',
    )
  })

  it('returns null when missing', () => {
    expect(extractTitle('<html><body>x</body></html>')).toBeNull()
  })
})

describe('extractSummary', () => {
  it('strips markup, scripts and styles', () => {
    const html =
      '<html><head><style>body{color:red}</style></head><body><h1>Hi</h1><script>var x=1;</script><p>The octopus dreams.</p></body></html>'
    expect(extractSummary(html)).toBe('Hi The octopus dreams.')
  })

  it('truncates long pages', () => {
    const html = `<p>${'word '.repeat(200)}</p>`
    const summary = extractSummary(html, 50)
    expect(summary.length).toBeLessThanOrEqual(51)
    expect(summary.endsWith('…')).toBe(true)
  })
})
