export const PAGE_SCHEME = 'slopera'
export const IMG_SCHEME = 'slopera-img'

export const HOME_URL = 'slopera://home/'
export const SEARCH_DOMAIN = 'gargle.com'

export const TAB_PARTITION = 'persist:slopweb'

/** Height of the browser chrome (tab strip + toolbar + bookmarks bar) in px. */
export const CHROME_HEIGHT = 120

export const MODELS = [
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5 — fast, maximum slop' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6 — balanced' },
  { id: 'claude-opus-4-8', label: 'Opus 4.8 — deluxe hallucinations' },
] as const

export const DEFAULT_MODEL = 'claude-sonnet-4-6'
export const BIBLE_MODEL = 'claude-haiku-4-5'

export const PAGE_MAX_TOKENS = 8192
export const IMAGE_CONCURRENCY = 3

export const DEFAULT_BOOKMARKS: ReadonlyArray<{ url: string; title: string }> = [
  { url: 'slopera://gargle.com/', title: 'Gargle' },
  { url: 'slopera://wikipedia.org/', title: 'Wikipedia' },
  { url: 'slopera://nytimes.com/', title: 'NY Times' },
  { url: 'slopera://amazon.com/', title: 'Amazon' },
  { url: 'slopera://weather.com/', title: 'Weather' },
  { url: 'slopera://calculator.com/', title: 'Calculator' },
  { url: 'slopera://catpics.net/', title: 'catpics.net' },
]
