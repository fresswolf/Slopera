import OpenAI from 'openai'
import { OPENROUTER_BASE_URL, PAGE_MAX_TOKENS } from '@shared/constants'
import type { JsLevel } from '@shared/constants'
import type { Lens } from '@shared/lenses'
import {
  buildBiblePrompt,
  buildFileSystemPrompt,
  buildFileUserPrompt,
  buildSystemPrompt,
  buildUserPrompt,
} from './prompts'
import type { FileRequest, PageGenerator, PageRequest } from './types'

export interface OpenRouterConfig {
  apiKey: string | null
  model: string
  customLenses: Lens[]
  jsLevel: JsLevel
}

/** OpenRouter is OpenAI-compatible; identify Slopera so it shows up in their dashboards. */
function createClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    defaultHeaders: { 'HTTP-Referer': 'https://slopera.app', 'X-Title': 'Slopera' },
  })
}

export class OpenRouterPageGenerator implements PageGenerator {
  constructor(private readonly getConfig: () => OpenRouterConfig) {}

  async *streamPage(req: PageRequest, signal: AbortSignal): AsyncGenerator<string> {
    const { apiKey, model, customLenses, jsLevel } = this.getConfig()
    if (!apiKey) throw new Error('No OpenRouter API key configured')
    const client = createClient(apiKey)
    const stream = await client.chat.completions.create(
      {
        model,
        max_tokens: PAGE_MAX_TOKENS,
        stream: true,
        messages: [
          { role: 'system', content: buildSystemPrompt(req.lens, customLenses, jsLevel) },
          { role: 'user', content: buildUserPrompt(req) },
        ],
      },
      { signal },
    )
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content
      if (delta) yield delta
    }
  }

  async *streamFile(req: FileRequest, signal: AbortSignal): AsyncGenerator<string> {
    const { apiKey, model, customLenses } = this.getConfig()
    if (!apiKey) throw new Error('No OpenRouter API key configured')
    const client = createClient(apiKey)
    const stream = await client.chat.completions.create(
      {
        model,
        max_tokens: PAGE_MAX_TOKENS,
        stream: true,
        messages: [
          { role: 'system', content: buildFileSystemPrompt(req.filename, req.lens, customLenses) },
          { role: 'user', content: buildFileUserPrompt(req) },
        ],
      },
      { signal },
    )
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content
      if (delta) yield delta
    }
  }
}

/** One cheap call per new domain, distilling its first page into a style memo. */
export async function generateBibleOpenRouter(
  apiKey: string,
  model: string,
  domain: string,
  html: string,
): Promise<string> {
  const client = createClient(apiKey)
  const res = await client.chat.completions.create({
    model,
    max_tokens: 300,
    messages: [{ role: 'user', content: buildBiblePrompt(domain, html) }],
  })
  const text = res.choices[0]?.message?.content
  if (!text) throw new Error('Unexpected bible response')
  return text.trim()
}

/** OpenRouter returns generated images as base64 data-URLs on `message.images`. */
interface ImageMessage {
  images?: Array<{ image_url?: { url?: string } }>
}

export interface OpenRouterImageOptions {
  /** OpenRouter aspect-ratio preset, e.g. "16:9"; passed via image_config. */
  aspectRatio: string
  /**
   * Whether the model emits images only. Image-only models (FLUX, Seedream) need
   * `modalities: ["image"]`; text+image models (Gemini, GPT-Image) need both.
   * `undefined` = custom/unknown model: try image-only first, then both.
   */
  imageOnly?: boolean
}

export async function openRouterImage(
  apiKey: string,
  model: string,
  prompt: string,
  { aspectRatio, imageOnly }: OpenRouterImageOptions,
): Promise<{ bytes: Buffer; contentType: string }> {
  const client = createClient(apiKey)
  const attempts: Array<['image'] | ['image', 'text']> =
    imageOnly === true ? [['image']] : imageOnly === false ? [['image', 'text']] : [['image'], ['image', 'text']]

  let lastErr: unknown
  for (const modalities of attempts) {
    try {
      const res = await client.chat.completions.create({
        model,
        // `modalities` / `image_config` are OpenRouter extensions, not in the typed OpenAI union.
        modalities,
        image_config: { aspect_ratio: aspectRatio },
        messages: [{ role: 'user', content: prompt }],
      } as never)
      const message = res.choices[0]?.message as unknown as ImageMessage | undefined
      const url = message?.images?.[0]?.image_url?.url
      if (url) return decodeDataUrl(url)
      lastErr = new Error('OpenRouter returned no image')
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('OpenRouter returned no image')
}

function decodeDataUrl(url: string): { bytes: Buffer; contentType: string } {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(url)
  const contentType = match?.[1]
  const base64 = match?.[2]
  if (!contentType || !base64) throw new Error('OpenRouter image was not a base64 data URL')
  return { contentType, bytes: Buffer.from(base64, 'base64') }
}
