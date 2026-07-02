import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Db } from './db'

export interface PageRecord {
  id: number
  key: string
  url: string
  lens: string
  gen: number
  hash: string
  title: string | null
  summary: string | null
  bytes: number
}

interface PageRow {
  id: number
  key: string
  url: string
  lens: string
  gen: number
  hash: string
  title: string | null
  summary: string | null
  bytes: number
}

export class PagesStore {
  constructor(
    private db: Db,
    private dir: string,
  ) {
    mkdirSync(dir, { recursive: true })
  }

  /** Most recent hallucination of a page, i.e. what Back and revisits restore. */
  latest(key: string): PageRecord | null {
    const row = this.db
      .prepare('SELECT * FROM pages WHERE key = ? ORDER BY gen DESC LIMIT 1')
      .get(key) as PageRow | undefined
    return row ?? null
  }

  /** Most recent hallucination of a URL under any lens — the cross-lens fallback. */
  latestForUrl(url: string): PageRecord | null {
    const row = this.db
      .prepare('SELECT * FROM pages WHERE url = ? ORDER BY created_at DESC, id DESC LIMIT 1')
      .get(url) as PageRow | undefined
    return row ?? null
  }

  insert(args: { key: string; url: string; lens: string; title: string | null; summary: string; html: string }): PageRecord {
    const prev = this.latest(args.key)
    const gen = (prev?.gen ?? 0) + 1
    const hash = createHash('sha256').update(`${args.key}#${gen}`).digest('hex')
    const bytes = Buffer.byteLength(args.html)
    writeFileSync(this.file(hash), args.html)
    const info = this.db
      .prepare(
        `INSERT INTO pages (key, url, lens, gen, hash, title, summary, bytes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(args.key, args.url, args.lens, gen, hash, args.title, args.summary, bytes, Date.now())
    return { id: Number(info.lastInsertRowid), key: args.key, url: args.url, lens: args.lens, gen, hash, title: args.title, summary: args.summary, bytes }
  }

  read(hash: string): string | null {
    try {
      return readFileSync(this.file(hash), 'utf8')
    } catch {
      return null
    }
  }

  stats(): { pages: number; bytes: number } {
    const row = this.db
      .prepare('SELECT COUNT(*) AS n, SUM(bytes) AS b FROM pages')
      .get() as { n: number; b: number | null } | undefined
    return { pages: row?.n ?? 0, bytes: row?.b ?? 0 }
  }

  clearAll(): void {
    this.db.exec('DELETE FROM pages')
    for (const f of readdirSync(this.dir)) {
      rmSync(join(this.dir, f), { force: true })
    }
  }

  private file(hash: string): string {
    return join(this.dir, `${hash}.html`)
  }
}
