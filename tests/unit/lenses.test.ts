import { describe, expect, it } from 'vitest'
import { DEFAULT_LENS, LENSES, resolveLens, slugifyLensId } from '@shared/lenses'

describe('resolveLens', () => {
  it('finds built-in lenses', () => {
    expect(resolveLens('slop').id).toBe('slop')
  })

  it('finds custom lenses', () => {
    const custom = [{ id: 'noir', label: 'Noir', instructions: 'Rain-slick streets.' }]
    expect(resolveLens('noir', custom).instructions).toBe('Rain-slick streets.')
  })

  it('falls back to the default lens', () => {
    expect(resolveLens('does-not-exist').id).toBe(DEFAULT_LENS)
  })

  it('prefers built-ins over a shadowing custom id', () => {
    const custom = [{ id: 'straight', label: 'Fake', instructions: 'x' }]
    expect(resolveLens('straight', custom).label).toBe(LENSES[0]!.label)
  })
})

describe('slugifyLensId', () => {
  it('slugifies labels', () => {
    expect(slugifyLensId('Solarpunk Dreams!', [])).toBe('solarpunk-dreams')
  })

  it('avoids collisions with existing ids', () => {
    expect(slugifyLensId('Slop', ['slop'])).toBe('slop-2')
    expect(slugifyLensId('Slop', ['slop', 'slop-2'])).toBe('slop-3')
  })

  it('handles labels with no usable characters', () => {
    expect(slugifyLensId('???', [])).toBe('lens')
  })
})
