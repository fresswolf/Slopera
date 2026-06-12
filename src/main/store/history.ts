import type { HistoryEntry } from '@shared/types'
import type { Db } from './db'

interface HistoryRow {
  id: number
  url: string
  display_url: string
  title: string
  lens: string
  visited_at: number
}

export class HistoryStore {
  constructor(private db: Db) {}

  add(url: string, displayUrl: string, lens: string): void {
    this.db
      .prepare('INSERT INTO history (url, display_url, title, lens, visited_at) VALUES (?, ?, ?, ?, ?)')
      .run(url, displayUrl, '', lens, Date.now())
  }

  /** Page titles arrive after navigation; attach to the latest visit of that URL. */
  touchTitle(url: string, title: string): void {
    this.db
      .prepare(
        `UPDATE history SET title = ?
         WHERE id = (SELECT id FROM history WHERE url = ? ORDER BY visited_at DESC LIMIT 1)`,
      )
      .run(title, url)
  }

  list(query?: string, limit = 500): HistoryEntry[] {
    const rows = (
      query
        ? this.db
            .prepare(
              `SELECT * FROM history WHERE url LIKE ? OR title LIKE ?
               ORDER BY visited_at DESC LIMIT ?`,
            )
            .all(`%${query}%`, `%${query}%`, limit)
        : this.db.prepare('SELECT * FROM history ORDER BY visited_at DESC LIMIT ?').all(limit)
    ) as unknown as HistoryRow[]
    return rows.map((r) => ({
      id: r.id,
      url: r.url,
      displayUrl: r.display_url,
      title: r.title,
      lens: r.lens,
      visitedAt: r.visited_at,
    }))
  }

  clear(): void {
    this.db.exec('DELETE FROM history')
  }
}
