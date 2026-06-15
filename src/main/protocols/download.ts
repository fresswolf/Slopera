import type { Session } from 'electron'
import { DL_SCHEME, DOWNLOAD_CONCURRENCY } from '@shared/constants'
import { parseDownloadTarget } from '@shared/downloads'
import { FenceStripper } from '@shared/fences'
import { Semaphore } from '../lib/semaphore'
import type { FileRequest, PageGenerator } from '../generation/types'
import type { SettingsStore } from '../settings'

export interface DownloadProtocolDeps {
  settings: SettingsStore
  generator: PageGenerator
  /** Surface a download that never got off the ground (bad key, total failure). */
  onTotalFailure: (filename: string) => void
}

/**
 * Serves slopera-dl:// links as file downloads. The model links to
 * `slopera-dl://download/<filename>?prompt=...`; we dream the file's contents
 * and answer with `content-disposition: attachment`, which makes Chromium turn
 * the navigation into a download (the current page stays put) and fire
 * `will-download` on the tab session — where the default save dialog takes over.
 */
export function registerDownloadProtocol(ses: Session, deps: DownloadProtocolDeps): void {
  const sem = new Semaphore(DOWNLOAD_CONCURRENCY)

  // A download click is a top-level navigation, so anything that is NOT an
  // attachment must answer 204 — Chromium then abandons the navigation and
  // keeps the current page (same trick the page protocol uses for favicons),
  // instead of replacing it with an error document.
  const noNavigation = () => new Response(null, { status: 204 })

  ses.protocol.handle(DL_SCHEME, async (req) => {
    const target = parseDownloadTarget(req.url)
    // Unknown/binary/unsafe extension: refuse rather than dream junk bytes.
    // The model is told not to link these, so stay silent and keep the page.
    if (!target) return noNavigation()

    const fake = process.env.SLOPERA_FAKE_GEN === '1'
    if (!fake && !deps.settings.activeTextKey) {
      deps.onTotalFailure(target.basename)
      return noNavigation()
    }

    const prompt = (new URL(req.url).searchParams.get('prompt') ?? '').slice(0, 800)
    const fileReq: FileRequest = {
      url: req.url,
      filename: target.basename,
      prompt,
      lens: deps.settings.lens,
    }

    // Hold a slot for the whole generation, not just the first token, so a burst
    // of download links can't fan out concurrent provider calls.
    await sem.acquire()
    const ac = new AbortController()
    const iterator = deps.generator.streamFile(fileReq, ac.signal)[Symbol.asyncIterator]()

    // Await the first token so total failures become a notification, not a
    // download that starts and instantly fails. Mid-stream failures fall through
    // to Electron's native interrupted-download state.
    let first: IteratorResult<string>
    try {
      first = await iterator.next()
    } catch {
      sem.release()
      deps.onTotalFailure(target.basename)
      return noNavigation()
    }

    const stripper = new FenceStripper()
    const encoder = new TextEncoder()
    let released = false
    const releaseOnce = () => {
      if (!released) {
        released = true
        sem.release()
      }
    }

    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        const emit = (text: string) => {
          if (text !== '') controller.enqueue(encoder.encode(text))
        }
        try {
          if (!first.done) emit(stripper.push(first.value))
          for (;;) {
            const r = await iterator.next()
            if (r.done) break
            emit(stripper.push(r.value))
          }
          emit(stripper.flush())
          controller.close()
        } catch {
          // Mid-stream failure: close the stream so the download lands as
          // interrupted rather than hanging.
          try {
            controller.close()
          } catch {
            // already closed/errored
          }
        } finally {
          releaseOnce()
        }
      },
      cancel() {
        ac.abort()
        releaseOnce()
      },
    })

    return new Response(body, {
      headers: {
        'content-type': target.contentType,
        'content-disposition': `attachment; filename="${target.basename}"`,
        'cache-control': 'no-store',
      },
    })
  })
}
