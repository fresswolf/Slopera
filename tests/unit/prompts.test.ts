import { describe, expect, it } from 'vitest'
import { buildSystemPrompt, buildUserPrompt } from '../../src/main/generation/prompts'
import type { PageRequest } from '../../src/main/generation/types'

const base: PageRequest = {
  url: 'slopera://wikipedia.org/wiki/Octopus',
  host: 'wikipedia.org',
  path: '/wiki/Octopus',
  lens: 'straight',
  bible: null,
  parentUrl: null,
  parentSummary: null,
}

describe('buildSystemPrompt', () => {
  it('forbids fences and embeds the lens', () => {
    const prompt = buildSystemPrompt('straight')
    expect(prompt).toContain('no markdown fences')
    expect(prompt).toContain('slopera-img://gen/')
    expect(prompt).toContain('earnestly')
  })

  it('falls back to the default lens for unknown ids', () => {
    expect(buildSystemPrompt('nope')).toContain('earnestly')
  })

  it('embeds user-defined custom lenses', () => {
    const custom = [{ id: 'noir', label: 'Noir', instructions: 'Everything is rain-slick and lit by one neon sign.' }]
    expect(buildSystemPrompt('noir', custom)).toContain('rain-slick')
  })
})

describe('buildUserPrompt', () => {
  it('includes the URL and first-visit instruction', () => {
    const prompt = buildUserPrompt(base)
    expect(prompt).toContain('slopera://wikipedia.org/wiki/Octopus')
    expect(prompt).toContain('First visit to this domain')
  })

  it('injects the site bible when present', () => {
    const prompt = buildUserPrompt({ ...base, bible: 'Serif fonts, beige boxes.' })
    expect(prompt).toContain('Serif fonts, beige boxes.')
    expect(prompt).not.toContain('First visit')
  })

  it('injects parent-page context for link clicks', () => {
    const prompt = buildUserPrompt({
      ...base,
      parentUrl: 'slopera://wikipedia.org/',
      parentSummary: 'An encyclopedia front page.',
    })
    expect(prompt).toContain('slopera://wikipedia.org/')
    expect(prompt).toContain('An encyclopedia front page.')
  })

  it('switches into search-engine mode on gargle.com', () => {
    const prompt = buildUserPrompt({
      ...base,
      url: 'slopera://gargle.com/search?q=best+pizza',
      host: 'gargle.com',
      path: '/search?q=best+pizza',
    })
    expect(prompt).toContain('search engine')
    expect(prompt).toContain('best pizza')
  })

  it('renders the gargle homepage without a query', () => {
    const prompt = buildUserPrompt({
      ...base,
      url: 'slopera://gargle.com/',
      host: 'gargle.com',
      path: '/',
    })
    expect(prompt).toContain('homepage')
  })
})
