import type { Session } from 'electron'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ImageModel, OpenRouterImageModel } from '@shared/constants'
import {
  DEFAULT_IMAGE_MODEL,
  IMAGE_CONCURRENCY,
  IMAGE_MODELS,
  IMG_SCHEME,
  OPENROUTER_IMAGE_MODELS,
} from '@shared/constants'
import { Semaphore } from '../lib/semaphore'
import { openRouterImage } from '../generation/openrouter'
import type { SettingsStore } from '../settings'

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function registerImageProtocol(ses: Session, settings: SettingsStore, imagesDir: string): void {
  mkdirSync(imagesDir, { recursive: true })
  const sem = new Semaphore(IMAGE_CONCURRENCY)

  ses.protocol.handle(IMG_SCHEME, async (req) => {
    const u = new URL(req.url)
    const prompt = (u.searchParams.get('prompt') ?? 'abstract texture').slice(0, 800)
    const openRouter = settings.imageProvider === 'openrouter'
    // OpenRouter image models can't be told exact pixels, so dims are only a layout
    // hint and need no rounding; fal models require a model-specific dimStep.
    const falModel = openRouter ? null : resolveImageModel(settings.imageModel)
    const modelId = falModel ? falModel.id : settings.imageModel
    const w = clampDim(u.searchParams.get('w'), 768, falModel?.dimStep ?? 1)
    const h = clampDim(u.searchParams.get('h'), 512, falModel?.dimStep ?? 1)
    // Model is part of the key so switching engines re-dreams rather than serving a stale image.
    const stem = createHash('sha256').update(`${modelId}|${prompt}|${w}x${h}`).digest('hex')

    for (const [type, ext] of Object.entries(EXT_BY_TYPE)) {
      const file = join(imagesDir, `${stem}.${ext}`)
      if (existsSync(file)) return imageResponse(readFileSync(file), type)
    }

    const apiKey = openRouter ? settings.openRouterKey : settings.falKey
    if (!apiKey || process.env.SLOPERA_FAKE_GEN === '1') {
      // No image key: the dream degrades gracefully into captioned placeholders.
      return imageResponse(Buffer.from(placeholderSvg(prompt, w, h)), 'image/svg+xml')
    }

    try {
      const known: OpenRouterImageModel | undefined = OPENROUTER_IMAGE_MODELS.find((m) => m.id === modelId)
      const { bytes, contentType } = await sem.run(() =>
        falModel
          ? falGenerate(apiKey, falModel, prompt, w, h)
          : openRouterImage(apiKey, modelId, prompt, {
              aspectRatio: nearestAspectRatio(w, h),
              api: known?.api,
              imageOnly: known?.imageOnly,
            }),
      )
      const ext = EXT_BY_TYPE[contentType]
      if (ext) writeFileSync(join(imagesDir, `${stem}.${ext}`), bytes)
      return imageResponse(bytes, contentType)
    } catch (err) {
      console.error(`[slopera-img] ${modelId} failed for "${prompt.slice(0, 60)}":`, err)
      return imageResponse(Buffer.from(placeholderSvg(prompt, w, h)), 'image/svg+xml')
    }
  })
}

function imageResponse(bytes: Buffer, contentType: string): Response {
  return new Response(new Uint8Array(bytes), {
    headers: { 'content-type': contentType, 'cache-control': 'no-store' },
  })
}

/** OpenRouter takes aspect ratio as a preset string, not pixels — pick the closest. */
const ASPECT_RATIOS: ReadonlyArray<readonly [string, number]> = [
  ['21:9', 21 / 9],
  ['16:9', 16 / 9],
  ['3:2', 3 / 2],
  ['4:3', 4 / 3],
  ['1:1', 1],
  ['3:4', 3 / 4],
  ['2:3', 2 / 3],
  ['9:16', 9 / 16],
]

function nearestAspectRatio(w: number, h: number): string {
  const target = w / h
  let best: readonly [string, number] = ['1:1', 1]
  for (const candidate of ASPECT_RATIOS) {
    if (Math.abs(candidate[1] - target) < Math.abs(best[1] - target)) best = candidate
  }
  return best[0]
}

function resolveImageModel(id: string): ImageModel {
  return (
    IMAGE_MODELS.find((m) => m.id === id) ??
    IMAGE_MODELS.find((m) => m.id === DEFAULT_IMAGE_MODEL) ??
    IMAGE_MODELS[0]
  )
}

function clampDim(raw: string | null, fallback: number, step: number): number {
  const n = Number.parseInt(raw ?? '', 10)
  const value = Number.isNaN(n) ? fallback : n
  const clamped = Math.min(1408, Math.max(64, value))
  return Math.round(clamped / step) * step
}

/** Both engines share fal.run's request/response shape but diverge on a few knobs. */
function falRequestBody(modelId: string, prompt: string, width: number, height: number): unknown {
  const common = { prompt, image_size: { width, height }, num_images: 1 }
  if (modelId === 'gpt-image-2') {
    // GPT Image 2 is token-priced and pricey at higher quality; keep it cheap for a browser.
    return { ...common, quality: 'low', output_format: 'webp' }
  }
  return { ...common, num_inference_steps: 4, enable_safety_checker: true }
}

interface FalResponse {
  images?: Array<{ url?: string; content_type?: string }>
}

async function falGenerate(
  apiKey: string,
  model: ImageModel,
  prompt: string,
  width: number,
  height: number,
): Promise<{ bytes: Buffer; contentType: string }> {
  const res = await fetch(`https://fal.run/${model.endpoint}`, {
    method: 'POST',
    headers: { authorization: `Key ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(falRequestBody(model.id, prompt, width, height)),
  })
  if (!res.ok) throw new Error(`fal.ai responded ${res.status}`)
  const json = (await res.json()) as FalResponse
  const image = json.images?.[0]
  if (!image?.url) throw new Error('fal.ai returned no image')
  const imgRes = await fetch(image.url)
  if (!imgRes.ok) throw new Error(`image fetch failed: ${imgRes.status}`)
  const contentType = imgRes.headers.get('content-type') ?? image.content_type ?? 'image/jpeg'
  return { bytes: Buffer.from(await imgRes.arrayBuffer()), contentType }
}

function placeholderSvg(prompt: string, w: number, h: number): string {
  const lines = wrap(prompt, 36).slice(0, 4)
  const fontSize = Math.max(11, Math.min(16, Math.floor(w / 30)))
  const text = lines
    .map(
      (line, i) =>
        `<text x="50%" y="${h / 2 + (i - (lines.length - 1) / 2) * (fontSize + 6)}" text-anchor="middle" fill="#a1a1aa" font-family="Georgia, serif" font-style="italic" font-size="${fontSize}">${escXml(line)}</text>`,
    )
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#27272a"/><stop offset="1" stop-color="#3f3f46"/>
</linearGradient></defs>
<rect width="100%" height="100%" fill="url(#g)"/>
<rect x="1" y="1" width="${w - 2}" height="${h - 2}" fill="none" stroke="#52525b" stroke-dasharray="6 4"/>
${text}
</svg>`
}

function wrap(s: string, width: number): string[] {
  const words = decodeURIComponentSafe(s).split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const word of words) {
    if (cur !== '' && cur.length + word.length + 1 > width) {
      lines.push(cur)
      cur = word
    } else {
      cur = cur === '' ? word : `${cur} ${word}`
    }
  }
  if (cur !== '') lines.push(cur)
  return lines
}

function decodeURIComponentSafe(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

function escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
