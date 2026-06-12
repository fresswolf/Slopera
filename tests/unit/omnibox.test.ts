import { describe, expect, it } from 'vitest'
import { httpToSlopera, normalizePageUrl, omniboxToUrl, pageKey, urlToDisplay } from '@shared/omnibox'

describe('omniboxToUrl', () => {
  it('treats bare domains as sites', () => {
    expect(omniboxToUrl('wikipedia.org')).toBe('slopera://wikipedia.org/')
  })

  it('keeps paths and queries', () => {
    expect(omniboxToUrl('wikipedia.org/wiki/Octopus')).toBe('slopera://wikipedia.org/wiki/Octopus')
    expect(omniboxToUrl('example.com/a?b=c')).toBe('slopera://example.com/a?b=c')
  })

  it('strips http(s) schemes', () => {
    expect(omniboxToUrl('https://nytimes.com/section/world')).toBe('slopera://nytimes.com/section/world')
    expect(omniboxToUrl('http://calculator.com')).toBe('slopera://calculator.com/')
  })

  it('sends queries to the dream search engine', () => {
    expect(omniboxToUrl('best pizza near me')).toBe(
      'slopera://gargle.com/search?q=best%20pizza%20near%20me',
    )
    expect(omniboxToUrl('octopus')).toBe('slopera://gargle.com/search?q=octopus')
  })

  it('returns home for empty input', () => {
    expect(omniboxToUrl('  ')).toBe('slopera://home/')
  })

  it('passes through slopera URLs', () => {
    expect(omniboxToUrl('slopera://wikipedia.org/wiki/Octopus')).toBe(
      'slopera://wikipedia.org/wiki/Octopus',
    )
  })

  it('lowercases hosts', () => {
    expect(omniboxToUrl('WIKIPEDIA.org/Wiki/Octopus')).toBe('slopera://wikipedia.org/Wiki/Octopus')
  })
})

describe('httpToSlopera', () => {
  it('rewrites generated links', () => {
    expect(httpToSlopera('https://elsewhere.example/portal?x=1')).toBe(
      'slopera://elsewhere.example/portal?x=1',
    )
  })

  it('rejects non-http schemes', () => {
    expect(httpToSlopera('mailto:a@b.c')).toBeNull()
    expect(httpToSlopera('javascript:alert(1)')).toBeNull()
  })
})

describe('normalizePageUrl', () => {
  it('is stable across root spellings', () => {
    expect(normalizePageUrl('slopera://wikipedia.org')).toBe('slopera://wikipedia.org/')
    expect(normalizePageUrl('slopera://wikipedia.org/')).toBe('slopera://wikipedia.org/')
  })

  it('drops trailing slashes and fragments', () => {
    expect(normalizePageUrl('slopera://a.com/b/')).toBe('slopera://a.com/b')
    expect(normalizePageUrl('slopera://a.com/b#frag')).toBe('slopera://a.com/b')
  })
})

describe('pageKey', () => {
  it('separates lenses', () => {
    expect(pageKey('slopera://a.com/', 'straight')).not.toBe(pageKey('slopera://a.com/', 'slop'))
  })

  it('is identical for equivalent URLs', () => {
    expect(pageKey('slopera://A.com', 'straight')).toBe(pageKey('slopera://a.com/', 'straight'))
  })
})

describe('urlToDisplay', () => {
  it('hides the scheme and home', () => {
    expect(urlToDisplay('slopera://home/')).toBe('')
    expect(urlToDisplay('slopera://wikipedia.org/')).toBe('wikipedia.org')
    expect(urlToDisplay('slopera://wikipedia.org/wiki/Octopus')).toBe('wikipedia.org/wiki/Octopus')
  })
})
