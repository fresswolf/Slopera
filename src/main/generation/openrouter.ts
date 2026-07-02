import OpenAI from 'openai'
import { OPENROUTER_BASE_URL, PAGE_MAX_TOKENS } from '@shared/constants'
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
    const { apiKey, model, customLenses } = this.getConfig()
    if (!apiKey) throw new Error('No OpenRouter API key configured')
    const client = createClient(apiKey)
    const stream = await client.chat.completions.create(
      {
        model,
        max_tokens: PAGE_MAX_TOKENS,
        stream: true,
        messages: [
          { role: 'system', content: buildSystemPrompt(req.lens, customLenses) },
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
  /** OpenRouter aspect-ratio preset, e.g. "16:9". */
  aspectRatio: string
  /**
   * Which surface serves the model (see `OpenRouterImageModel.api`).
   * `undefined` = custom/unknown slug: try every shape until one works.
   */
  api?: 'chat' | 'images'
  /**
   * Chat models only: whether the model emits images only. Image-only models
   * (FLUX, Seedream) need `modalities: ["image"]`; text+image models (Gemini,
   * GPT-Image chat wrappers) need both.
   */
  imageOnly?: boolean
}

type ImageAttempt = { via: 'chat'; modalities: ['image'] | ['image', 'text'] } | { via: 'images' }

export async function openRouterImage(
  apiKey: string,
  model: string,
  prompt: string,
  { aspectRatio, api, imageOnly }: OpenRouterImageOptions,
): Promise<{ bytes: Buffer; contentType: string }> {
  const attempts: ImageAttempt[] =
    api === 'images'
      ? [{ via: 'images' }]
      : imageOnly === true
        ? [{ via: 'chat', modalities: ['image'] }]
        : imageOnly === false
          ? [{ via: 'chat', modalities: ['image', 'text'] }]
          : [{ via: 'chat', modalities: ['image'] }, { via: 'chat', modalities: ['image', 'text'] }, { via: 'images' }]

  let lastErr: unknown
  for (const attempt of attempts) {
    try {
      return attempt.via === 'images'
        ? await imagesApiGenerate(apiKey, model, prompt, aspectRatio)
        : await chatGenerate(apiKey, model, prompt, aspectRatio, attempt.modalities)
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('OpenRouter returned no image')
}

async function chatGenerate(
  apiKey: string,
  model: string,
  prompt: string,
  aspectRatio: string,
  modalities: ['image'] | ['image', 'text'],
): Promise<{ bytes: Buffer; contentType: string }> {
  const client = createClient(apiKey)
  const res = await client.chat.completions.create({
    model,
    // `modalities` / `image_config` are OpenRouter extensions, not in the typed OpenAI union.
    modalities,
    image_config: { aspect_ratio: aspectRatio },
    messages: [{ role: 'user', content: prompt }],
  } as never)
  const message = res.choices[0]?.message as unknown as ImageMessage | undefined
  const url = message?.images?.[0]?.image_url?.url
  if (!url) throw new Error('OpenRouter returned no image')
  return decodeDataUrl(url)
}

/** The Images API returns base64 bytes; `media_type` is only present for non-PNG (e.g. SVG). */
interface ImagesApiResponse {
  data?: Array<{ b64_json?: string; media_type?: string }>
}

async function imagesApiGenerate(
  apiKey: string,
  model: string,
  prompt: string,
  aspectRatio: string,
): Promise<{ bytes: Buffer; contentType: string }> {
  const res = await fetch(`${OPENROUTER_BASE_URL}/images`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'HTTP-Referer': 'https://slopera.app',
      'X-Title': 'Slopera',
    },
    // aspect_ratio and quality are normalized platform params: providers clamp or
    // ignore what they don't support. quality low keeps token-priced GPT Image cheap
    // for a browser that dreams several images per page.
    body: JSON.stringify({ model, prompt, aspect_ratio: aspectRatio, quality: 'low' }),
  })
  if (!res.ok) throw new Error(`OpenRouter Images API responded ${res.status}`)
  const json = (await res.json()) as ImagesApiResponse
  const b64 = json.data?.[0]?.b64_json
  if (!b64) throw new Error('OpenRouter Images API returned no image')
  const bytes = Buffer.from(b64, 'base64')
  return { bytes, contentType: json.data?.[0]?.media_type ?? sniffImageType(bytes) }
}

function sniffImageType(bytes: Buffer): string {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg'
  if (bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP')
    return 'image/webp'
  return 'image/png'
}

function decodeDataUrl(url: string): { bytes: Buffer; contentType: string } {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(url)
  const contentType = match?.[1]
  const base64 = match?.[2]
  if (!contentType || !base64) throw new Error('OpenRouter image was not a base64 data URL')
  return { contentType, bytes: Buffer.from(base64, 'base64') }
}
