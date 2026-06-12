import type { Bookmark } from '@shared/types'
import type { Db } from './db'

interface BookmarkRow {
  id: number
  url: string
  title: string
  position: number
}

export class BookmarksStore {
  constructor(private db: Db) {}

  seedIfEmpty(defaults: ReadonlyArray<{ url: string; title: string }>): void {
    const count = this.db.prepare('SELECT COUNT(*) AS n FROM bookmarks').get() as { n: number } | undefined
    if ((count?.n ?? 0) > 0) return
    const insert = this.db.prepare('INSERT INTO bookmarks (url, title, position) VALUES (?, ?, ?)')
    defaults.forEach((b, i) => insert.run(b.url, b.title, i))
  }

  list(): Bookmark[] {
    return this.db
      .prepare('SELECT * FROM bookmarks ORDER BY position ASC, id ASC')
      .all() as unknown as BookmarkRow[]
  }

  add(url: string, title: string): Bookmark[] {
    const max = this.db.prepare('SELECT MAX(position) AS m FROM bookmarks').get() as { m: number | null } | undefined
    this.db
      .prepare('INSERT INTO bookmarks (url, title, position) VALUES (?, ?, ?) ON CONFLICT(url) DO UPDATE SET title = excluded.title')
      .run(url, title, (max?.m ?? -1) + 1)
    return this.list()
  }

  remove(id: number): Bookmark[] {
    this.db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id)
    return this.list()
  }
}
