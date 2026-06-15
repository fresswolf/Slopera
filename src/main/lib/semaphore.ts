export class Semaphore {
  private running = 0
  private queue: Array<() => void> = []

  constructor(private readonly limit: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire()
    try {
      return await task()
    } finally {
      this.release()
    }
  }

  /** Wait for a slot. Pair every acquire() with exactly one release(). */
  async acquire(): Promise<void> {
    if (this.running >= this.limit) {
      await new Promise<void>((resolve) => this.queue.push(resolve))
    }
    this.running++
  }

  release(): void {
    this.running--
    this.queue.shift()?.()
  }
}
