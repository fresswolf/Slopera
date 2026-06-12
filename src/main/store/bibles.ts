import type { Db } from './db'

/**
 * "Site bibles": one style memo per (domain, lens), distilled from the first
 * generated page of a domain and injected into every later prompt for it,
 * so a hallucinated site keeps a consistent identity across clicks.
 */
export class BiblesStore {
  constructor(private db: Db) {}

  get(domain: string, lens: string): string | null {
    const row = this.db
      .prepare('SELECT memo FROM bibles WHERE domain = ? AND lens = ?')
      .get(domain, lens) as { memo: string } | undefined
    return row?.memo ?? null
  }

  set(domain: string, lens: string, memo: string): void {
    this.db
      .prepare(
        `INSERT INTO bibles (domain, lens, memo, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(domain, lens) DO UPDATE SET memo = excluded.memo`,
      )
      .run(domain, lens, memo, Date.now())
  }

  clear(): void {
    this.db.exec('DELETE FROM bibles')
  }
}
