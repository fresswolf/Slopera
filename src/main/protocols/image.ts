import type { Session } from 'electron'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { IMAGE_CONCURRENCY, IMG_SCHEME } from '@shared/constants'
import { Semaphore } from '../lib/semaphore'
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
    const w = clampDim(u.searchParams.get('w'), 768)
    const h = clampDim(u.searchParams.get('h'), 512)
    const stem = createHash('sha256').update(`${prompt}|${w}x${h}`).digest('hex')

    for (const [type, ext] of Object.entries(EXT_BY_TYPE)) {
      const file = join(imagesDir, `${stem}.${ext}`)
      if (existsSync(file)) return imageResponse(readFileSync(file), type)
    }

    const apiKey = settings.falKey
    if (!apiKey || process.env.SLOPERA_FAKE_GEN === '1') {
      // No image key: the dream degrades gracefully into captioned placeholders.
      return imageResponse(Buffer.from(placeholderSvg(prompt, w, h)), 'image/svg+xml')
    }

    try {
      const { bytes, contentType } = await sem.run(() => falGenerate(apiKey, prompt, w, h))
      const ext = EXT_BY_TYPE[contentType]
      if (ext) writeFileSync(join(imagesDir, `${stem}.${ext}`), bytes)
      return imageResponse(bytes, contentType)
    } catch {
      return imageResponse(Buffer.from(placeholderSvg(prompt, w, h)), 'image/svg+xml')
    }
  })
}

function imageResponse(bytes: Buffer, contentType: string): Response {
  return new Response(new Uint8Array(bytes), {
    headers: { 'content-type': contentType, 'cache-control': 'no-store' },
  })
}

function clampDim(raw: string | null, fallback: number): number {
  const n = Number.parseInt(raw ?? '', 10)
  if (Number.isNaN(n)) return fallback
  const clamped = Math.min(1408, Math.max(64, n))
  return Math.round(clamped / 8) * 8
}

interface FalResponse {
  images?: Array<{ url?: string; content_type?: string }>
}

async function falGenerate(
  apiKey: string,
  prompt: string,
  width: number,
  height: number,
): Promise<{ bytes: Buffer; contentType: string }> {
  const res = await fetch('https://fal.run/fal-ai/flux/schnell', {
    method: 'POST',
    headers: { authorization: `Key ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt,
      image_size: { width, height },
      num_images: 1,
      num_inference_steps: 4,
      enable_safety_checker: true,
    }),
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
