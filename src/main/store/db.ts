import { DatabaseSync } from 'node:sqlite'

// node:sqlite (bundled with Electron's Node 24) instead of better-sqlite3:
// same synchronous API shape, zero native-module rebuild pain.
export type Db = DatabaseSync

export function openDb(file: string): Db {
  const db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec(`
    CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL,
      url TEXT NOT NULL,
      lens TEXT NOT NULL,
      gen INTEGER NOT NULL,
      hash TEXT NOT NULL,
      title TEXT,
      summary TEXT,
      bytes INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_pages_key ON pages (key, gen DESC);

    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      display_url TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      lens TEXT NOT NULL,
      visited_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_history_visited ON history (visited_at DESC);

    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      position INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bibles (
      domain TEXT NOT NULL,
      lens TEXT NOT NULL,
      memo TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (domain, lens)
    );
  `)
  return db
}
