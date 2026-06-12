/**
 * Strips markdown code fences from a streamed LLM response without breaking
 * the stream: models occasionally wrap HTML output in ```html ... ``` despite
 * instructions. A small holdback buffer lets us remove a trailing fence
 * before it is ever emitted.
 */
const HOLDBACK = 8
const LEADING_FENCE = /^\s*```[a-zA-Z]*[ \t]*\r?\n?/
const TRAILING_FENCE = /\s*```\s*$/

export class FenceStripper {
  private head = ''
  private tail = ''
  private started = false

  /** Feed a chunk, get back the part that is safe to emit. */
  push(chunk: string): string {
    if (!this.started) {
      this.head += chunk
      // wait until there's enough text to recognize a leading fence
      if (this.head.length < 12 && !this.head.includes('\n')) return ''
      const cleaned = this.head.replace(LEADING_FENCE, '')
      this.head = ''
      this.started = true
      return this.hold(cleaned)
    }
    return this.hold(chunk)
  }

  /** Emit everything still buffered, minus a trailing fence. */
  flush(): string {
    const rest = this.started ? this.tail : this.head.replace(LEADING_FENCE, '')
    this.head = ''
    this.tail = ''
    this.started = true
    return rest.replace(TRAILING_FENCE, '')
  }

  private hold(s: string): string {
    this.tail += s
    if (this.tail.length <= HOLDBACK) return ''
    const out = this.tail.slice(0, -HOLDBACK)
    this.tail = this.tail.slice(-HOLDBACK)
    return out
  }
}
