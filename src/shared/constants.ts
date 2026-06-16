export const PAGE_SCHEME = 'slopera'
export const IMG_SCHEME = 'slopera-img'
export const DL_SCHEME = 'slopera-dl'

export const HOME_URL = 'slopera://home/'
export const SEARCH_DOMAIN = 'google.com'

export const TAB_PARTITION = 'persist:slopweb'

/** Height of the browser chrome (tab strip + toolbar + bookmarks bar) in px. */
export const CHROME_HEIGHT = 120

export const MODELS = [
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5 — fast, maximum slop' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6 — balanced' },
  { id: 'claude-opus-4-8', label: 'Opus 4.8 — deluxe hallucinations' },
] as const

export const DEFAULT_MODEL = 'claude-haiku-4-5'
export const BIBLE_MODEL = 'claude-haiku-4-5'

export type TextProvider = 'anthropic' | 'openrouter'
export type ImageProvider = 'fal' | 'openrouter'

/** How much JavaScript the page generator is told to put in dreamed pages. */
export type JsLevel = 'static' | 'light' | 'rich'

export const DEFAULT_JS_LEVEL: JsLevel = 'light'

export const JS_LEVELS = [
  { id: 'static', label: 'Static — no JavaScript' },
  { id: 'light', label: 'Light — modest interactivity' },
  { id: 'rich', label: 'Rich — ambitious mini-apps' },
] as const satisfies readonly { id: JsLevel; label: string }[]

/** OpenRouter speaks the OpenAI chat-completions API for every model it proxies. */
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

/** Curated OpenRouter page models; "Custom model…" in the UI covers anything else. */
export const OPENROUTER_PAGE_MODELS = [
  { id: 'anthropic/claude-haiku-4.5', label: 'Claude Haiku 4.5' },
  { id: 'anthropic/claude-sonnet-4.6', label: 'Claude Sonnet 4.6' },
  { id: 'anthropic/claude-opus-4.8-fast', label: 'Claude Opus 4.8 Fast' },
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { id: 'openai/gpt-5.4-mini', label: 'GPT-5.4 mini' },
  { id: 'openai/gpt-5.4', label: 'GPT-5.4' },
] as const

export interface OpenRouterImageModel {
  id: string
  label: string
  /**
   * Image-only models (FLUX, Seedream) require `modalities: ["image"]`; text+image
   * models (Gemini, GPT-Image) require `["image", "text"]`. Drives request shaping.
   */
  imageOnly: boolean
}

/** Curated OpenRouter image models; "Custom model…" in the UI covers anything else. */
export const OPENROUTER_IMAGE_MODELS = [
  { id: 'black-forest-labs/flux.2-klein-4b', label: 'FLUX.2 Klein 4B — fast & cheap', imageOnly: true },
  { id: 'google/gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image (Nano Banana)', imageOnly: false },
] as const satisfies readonly OpenRouterImageModel[]

/** Suggested-but-editable model when the user first switches to OpenRouter. */
export const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-5.4-mini'
/** Hardcoded cheap model for site-bible distillation on OpenRouter (overridable account permitting). */
export const BIBLE_MODEL_OPENROUTER = 'google/gemini-2.5-flash'
/** Suggested-but-editable image model when the user first switches images to OpenRouter. */
export const DEFAULT_OPENROUTER_IMAGE_MODEL = 'black-forest-labs/flux.2-klein-4b'

export interface ImageModel {
  id: string
  label: string
  /** fal.run model path, served at `https://fal.run/<endpoint>`. */
  endpoint: string
  /** Generated dimensions are rounded to a multiple of this (model requirement). */
  dimStep: number
}

/** Image generators, all reachable through the same fal.run REST surface. */
export const IMAGE_MODELS = [
  {
    id: 'flux-schnell',
    label: 'FLUX schnell — fast & cheap (~$0.003/img)',
    endpoint: 'fal-ai/flux/schnell',
    dimStep: 8,
  },
  {
    id: 'gpt-image-2',
    label: 'GPT Image 2 — slow, sharper, pricier',
    endpoint: 'openai/gpt-image-2',
    dimStep: 16,
  },
] as const satisfies readonly ImageModel[]

export const DEFAULT_IMAGE_MODEL = 'flux-schnell'

/**
 * Output-token ceiling for a single page/file generation. This is a safety cap,
 * not a target: both page paths stream, so HTTP timeouts aren't a concern, and
 * the model stops on its own at its natural end-of-turn well before this. Set
 * high so complex pages (inline-JS games, long articles) finish instead of
 * truncating mid-render; it only bounds runaway output. 32K fits every model's
 * streamed output ceiling (Haiku/Sonnet cap at 64K, Opus at 128K).
 */
export const PAGE_MAX_TOKENS = 64000

export const IMAGE_CONCURRENCY = 3
export const DOWNLOAD_CONCURRENCY = 2

export const DEFAULT_BOOKMARKS: ReadonlyArray<{ url: string; title: string }> = [
  { url: 'slopera://google.com/', title: 'Google' },
  { url: 'slopera://wikipedia.org/', title: 'Wikipedia' },
  { url: 'slopera://nytimes.com/', title: 'NY Times' },
  { url: 'slopera://amazon.com/', title: 'Amazon' },
  { url: 'slopera://weather.com/', title: 'Weather' },
  { url: 'slopera://wolframalpha.com/', title: 'WolframAlpha' },
  { url: 'slopera://catpics.net/', title: 'catpics.net' },
]
