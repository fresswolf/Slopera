import { describe, expect, it } from 'vitest'
import { FenceStripper } from '@shared/fences'

function run(chunks: string[]): string {
  const stripper = new FenceStripper()
  let out = ''
  for (const chunk of chunks) out += stripper.push(chunk)
  return out + stripper.flush()
}

describe('FenceStripper', () => {
  const doc = '<!DOCTYPE html>\n<html><body>hello</body></html>'

  it('passes clean HTML through untouched', () => {
    expect(run([doc])).toBe(doc)
    expect(run(doc.split(''))).toBe(doc)
  })

  it('strips a leading ```html fence', () => {
    expect(run(['```html\n', doc])).toBe(doc)
    expect(run(['```\n' + doc])).toBe(doc)
  })

  it('strips a trailing fence', () => {
    expect(run([doc, '\n```'])).toBe(doc)
    expect(run(['```html\n', doc, '\n```\n'])).toBe(doc)
  })

  it('handles fences split across stream chunks', () => {
    expect(run(['``', '`ht', 'ml\n', doc, '\n`', '``'])).toBe(doc)
  })

  it('handles tiny documents', () => {
    expect(run(['<p>x</p>'])).toBe('<p>x</p>')
    expect(run(['```html\n<p>x</p>\n```'])).toBe('<p>x</p>')
  })
})
