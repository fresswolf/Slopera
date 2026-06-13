import { describe, expect, it } from 'vitest'
import { extractLinkContext, extractSummary, extractTitle } from '@shared/extract'

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

describe('extractLinkContext', () => {
  const parent = 'slopera://youtube.com/'
  const html = `
    <a href="/watch?v=gH7uP2vW3c">Learn AI dev in 30 minutes</a>
    <a href="https://youtube.com/feed/trending" title="What's hot">Trending</a>
    <a href="/watch?v=catpiano"><img src="x" alt="A cat playing piano"></a>
    <a href="https://elsewhere.example/portal">Leave</a>
    <a href="/bare"></a>`

  it('matches a relative href and returns the anchor text', () => {
    expect(extractLinkContext(html, parent, 'slopera://youtube.com/watch?v=gH7uP2vW3c')).toEqual({
      text: 'Learn AI dev in 30 minutes',
      title: null,
      alt: null,
    })
  })

  it('matches an absolute same-host href and captures the title attribute', () => {
    expect(extractLinkContext(html, parent, 'slopera://youtube.com/feed/trending')).toEqual({
      text: 'Trending',
      title: "What's hot",
      alt: null,
    })
  })

  it('captures image alt text for thumbnail links with no text', () => {
    expect(extractLinkContext(html, parent, 'slopera://youtube.com/watch?v=catpiano')).toEqual({
      text: null,
      title: null,
      alt: 'A cat playing piano',
    })
  })

  it('resolves cross-site absolute hrefs', () => {
    expect(extractLinkContext(html, parent, 'slopera://elsewhere.example/portal')).toEqual({
      text: 'Leave',
      title: null,
      alt: null,
    })
  })

  it('returns null when no link leads to the target', () => {
    expect(extractLinkContext(html, parent, 'slopera://youtube.com/nowhere')).toBeNull()
  })

  it('returns null when the matching link carries no usable label', () => {
    expect(extractLinkContext(html, parent, 'slopera://youtube.com/bare')).toBeNull()
  })
})
