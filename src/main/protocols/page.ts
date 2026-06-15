import type { Session } from 'electron'
import { BIBLE_MODEL_OPENROUTER, PAGE_SCHEME } from '@shared/constants'
import { extractLinkContext, extractSummary, extractTitle } from '@shared/extract'
import { FenceStripper } from '@shared/fences'
import { normalizePageUrl, pageKey } from '@shared/omnibox'
import type { SettingsStore } from '../settings'
import type { BiblesStore } from '../store/bibles'
import type { BookmarksStore } from '../store/bookmarks'
import type { PagesStore } from '../store/pages'
import { generateBible } from '../generation/anthropic'
import { generateBibleOpenRouter } from '../generation/openrouter'
import type { PageGenerator, PageRequest } from '../generation/types'
import { errorFooterHtml, errorHtml, homeHtml, onboardingHtml } from '../internal/html'

const CSP = [
  "default-src 'none'",
  "style-src 'unsafe-inline'",
  "script-src 'unsafe-inline'",
  'img-src slopera-img: data:',
  'font-src data:',
  'media-src data:',
  'form-action slopera: https: http:',
].join('; ')

function htmlResponse(body: string | ReadableStream<Uint8Array>, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': CSP,
      'cache-control': 'no-store',
    },
  })
}

export interface PageProtocolDeps {
  settings: SettingsStore
  pages: PagesStore
  bibles: BiblesStore
  bookmarks: BookmarksStore
  generator: PageGenerator
}

export interface PageProtocolController {
  /** Mark a URL so its next request regenerates instead of hitting the cache. */
  markForRegen: (url: string, lens: string) => void
  /**
   * Remember which page a navigation came from. Electron does not surface a
   * referrer to custom-scheme protocol handlers, so the navigation layer
   * (will-navigate) tells us directly; the next generation of `childUrl` reads
   * it to honor the clicked link. Keyed by normalized child URL.
   */
  recordParent: (childUrl: string, parentUrl: string) => void
}

export function registerPageProtocol(ses: Session, deps: PageProtocolDeps): PageProtocolController {
  const regenKeys = new Set<string>()
  const pendingParents = new Map<string, string>()
  // HTML-so-far of in-flight (and mid-stream-abandoned) generations, keyed by
  // pageKey. Lets a link clicked before its page finished streaming still carry
  // context: the snapshot doesn't exist yet (finalize never ran), but the
  // partial buffer already holds the clicked link.
  const liveBuffers = new Map<string, { html: string }>()

  ses.protocol.handle(PAGE_SCHEME, async (req) => {
    try {
      return await handle(req)
    } catch (err) {
      return htmlResponse(errorHtml(req.url, String(err)), 500)
    }
  })

  async function handle(req: Request): Promise<Response> {
    const u = new URL(req.url)
    const host = u.host.toLowerCase()

    if (host === 'home') return htmlResponse(homeHtml(deps.bookmarks.list()))
    // Chromium fetches favicons on its own; don't dream one up as a page.
    if (u.pathname.endsWith('/favicon.ico')) return new Response(null, { status: 204 })

    const norm = normalizePageUrl(req.url)
    if (!norm) return htmlResponse(errorHtml(req.url, 'Unparseable dream address'), 400)

    const lens = deps.settings.lens
    const key = pageKey(norm, lens)
    const force = regenKeys.delete(key)
    const parentUrl = pendingParents.get(norm) ?? ''
    pendingParents.delete(norm)

    if (!force) {
      const snap = deps.pages.latest(key)
      if (snap) {
        const html = deps.pages.read(snap.hash)
        if (html !== null) return htmlResponse(html)
      }
    }

    const fake = process.env.SLOPERA_FAKE_GEN === '1'
    if (!fake && !deps.settings.activeTextKey) return htmlResponse(onboardingHtml())

    const parsed = new URL(norm)
    const genReq: PageRequest = {
      url: norm,
      host,
      path: parsed.pathname + parsed.search,
      lens,
      bible: deps.bibles.get(host, lens),
      ...parentContext(parentUrl, norm, lens),
    }

    return streamGeneration(genReq, key)
  }

  function parentContext(
    parentUrl: string,
    childUrl: string,
    lens: string,
  ): Pick<PageRequest, 'parentUrl' | 'parentSummary' | 'link'> {
    const none = { parentUrl: null, parentSummary: null, link: null }
    if (!parentUrl) return none
    const norm = normalizePageUrl(parentUrl)
    if (!norm) return none
    const pkey = pageKey(norm, lens)
    const snap = deps.pages.latest(pkey)
    let html = snap ? deps.pages.read(snap.hash) : null
    let summary = snap?.summary ?? null
    if (!html) {
      // Page still streaming (or abandoned mid-stream): use the partial buffer.
      const live = liveBuffers.get(pkey)?.html
      if (live) {
        html = live
        summary = extractSummary(live)
      }
    }
    if (!html) return none
    const link = extractLinkContext(html, norm, childUrl)
    if (!summary && !link) return none
    return { parentUrl: norm, parentSummary: summary, link }
  }

  async function streamGeneration(genReq: PageRequest, key: string): Promise<Response> {
    const ac = new AbortController()
    const iterator = deps.generator.streamPage(genReq, ac.signal)[Symbol.asyncIterator]()

    // Await the first token before answering, so total failures (bad key,
    // rate limit) become a proper error page instead of a broken stream.
    let first: IteratorResult<string>
    try {
      first = await iterator.next()
    } catch (err) {
      return htmlResponse(errorHtml(genReq.url, errMessage(err)), 502)
    }

    const stripper = new FenceStripper()
    const encoder = new TextEncoder()
    let acc = ''
    const buf = { html: '' }
    liveBuffers.set(key, buf)

    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        const emit = (text: string) => {
          if (text === '') return
          acc += text
          buf.html = acc
          controller.enqueue(encoder.encode(text))
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
          finalize(genReq, key, acc)
          // Snapshot now canonical; drop the partial. A mid-stream abort leaves
          // the buffer in place so the child it navigated to can still read it.
          liveBuffers.delete(key)
        } catch (err) {
          if (!ac.signal.aborted) {
            // Mid-stream failure: surface it in the page, don't snapshot.
            emit(stripper.flush())
            emit(errorFooterHtml(errMessage(err)))
          }
          try {
            controller.close()
          } catch {
            // stream already errored/cancelled
          }
        }
      },
      cancel() {
        ac.abort()
      },
    })

    return htmlResponse(body)
  }

  function finalize(genReq: PageRequest, key: string, html: string): void {
    if (html.length < 100) return
    const title = extractTitle(html)
    const summary = extractSummary(html)
    deps.pages.insert({ key, url: genReq.url, lens: genReq.lens, title, summary, html })

    if (!genReq.bible && process.env.SLOPERA_FAKE_GEN !== '1') {
      // Bible distillation follows the active text provider so an OpenRouter-only
      // user (no Anthropic key) still gets per-domain identity.
      const bible =
        deps.settings.textProvider === 'openrouter'
          ? deps.settings.openRouterKey &&
            generateBibleOpenRouter(
              deps.settings.openRouterKey,
              BIBLE_MODEL_OPENROUTER,
              genReq.host,
              html,
            )
          : deps.settings.anthropicKey &&
            generateBible(deps.settings.anthropicKey, genReq.host, html)
      if (bible) {
        bible
          .then((memo) => deps.bibles.set(genReq.host, genReq.lens, memo))
          .catch(() => {
            // bible is an enhancement; the next page just establishes identity again
          })
      }
    }
  }

  return {
    markForRegen(url, lens) {
      regenKeys.add(pageKey(url, lens))
    },
    recordParent(childUrl, parentUrl) {
      const norm = normalizePageUrl(childUrl)
      if (norm) pendingParents.set(norm, parentUrl)
    },
  }
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
