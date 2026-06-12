export class Semaphore {
  private running = 0
  private queue: Array<() => void> = []

  constructor(private readonly limit: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.running >= this.limit) {
      await new Promise<void>((resolve) => this.queue.push(resolve))
    }
    this.running++
    try {
      return await task()
    } finally {
      this.running--
      this.queue.shift()?.()
    }
  }
}
