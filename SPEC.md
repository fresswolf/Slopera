# Slopera

*The browser for the slop era.*

A desktop browser that never touches the real web. Every page is hallucinated
on the fly by an LLM; every image is generated on demand. An art project,
built like a product.

---

## 1. Concept

- **Full illusion.** Type any URL — real or invented — and get a hallucinated
  version of that site. Every link on a generated page is clickable and
  generates the next page *in context*: clicking "Octopus" on fake-Wikipedia
  yields a fake article in the same fake-Wikipedia style. Search-like input in
  the URL bar produces a fake search results page with fake, clickable results.
- **Default register: played straight.** Pages earnestly imitate the real
  site; the wrongness seeps through on its own (news from a parallel timeline,
  products that don't exist). No winking.
- **Lenses.** A toolbar dropdown of prompt presets changes the register:
  `Straight` (default), `Extra slop`, `1998` — plus **user-defined lenses**:
  a builder in Settings (name + flavor prompt) adds custom registers to the
  dropdown. Custom lenses can be edited or deleted in Settings (built-ins are
  fixed); editing keeps the lens id stable so already-dreamed pages persist
  until reloaded. The active lens is stamped onto every cached page; each lens
  dreams its own cache.
- **Latency is aesthetic.** Pages stream in top-to-bottom like dial-up.
  Images trickle in afterwards, one by one.

## 2. Feature spec (v1)

### Browser chrome
- Tab strip: open / close / switch; resizable window (standard Electron).
- Back / Forward / Reload / Home buttons.
- Omnibox: accepts URLs (`wikipedia.org`, `http://calculator.com`) and
  free-text queries (→ fake search engine at `slopera://search?q=...`).
- Lens dropdown in the toolbar.
- Bookmarks bar, **prefilled** with curated jump points (e.g. wikipedia.org,
  nytimes.com, amazon.com, wolframalpha.com, a fake search engine, one or two
  invented gems). User can add/remove/edit.
- History panel: chronological list, click restores the cached snapshot.
- New-tab page: minimal start page (logo, tagline, bookmark tiles). *(default
  chosen — veto anytime)*
- Settings page: an **API keys** block (Anthropic, OpenRouter, fal.ai — each
  labelled with what it powers), then a **Pages** block and an **Images** block,
  each a provider toggle + model picker. Keys save as you type (on blur) and each
  saved key has a **Remove** button; a **Done** button (and Escape) closes the
  panel. Every model picker is a curated dropdown ending in **"Custom model…"**
  that reveals a free-text slug box — so any provider can run an arbitrary model.
  Pages: Anthropic (Haiku [default] / Sonnet / Opus) **or** OpenRouter. Images:
  fal.ai (FLUX schnell [default] / GPT Image 2) **or** OpenRouter — copy
  recommends fal.ai as the fastest/cheapest. A provider whose key isn't saved is
  disabled ("key req'd"); switching provider resets the model to that provider's
  default. At least an Anthropic **or** OpenRouter key is required to dream pages.
  Plus default-lens picker and cache controls (size shown, clear button).

### Generation behavior
- **Streaming HTML.** LLM output is streamed into the tab as it arrives.
- **Generated JavaScript works.** Pages may include interactive inline JS
  (e.g. `calculator.com` is a working calculator). Prompts instruct the model
  to emit `<style>` early and `<script>` at the end of the document. An
  **Interactivity** setting (`settings.jsLevel`: `static` / `light` [default] /
  `rich`) swaps the JS clause of the system prompt — `static` forbids `<script>`
  entirely, `rich` pushes for ambitious mini-apps. It lives in the system prompt,
  not the cache key, so it applies to new dreams and reloads only; already-cached
  pages keep the level they were dreamed with.
- **Output-token ceiling.** `PAGE_MAX_TOKENS` (32K) caps a single page/file
  generation. It's a safety bound, not a target — both page paths stream (so no
  HTTP timeout), and the model stops on its own at its natural end well before
  this; the high cap just keeps complex pages (inline-JS games, long articles)
  from truncating mid-render. Anthropic requires `max_tokens`, so it can't be
  omitted; 32K fits every model's streamed-output ceiling.
- **Images.** The LLM writes
  `<img src="slopera-img://gen?prompt=...&w=...&h=...">`; a protocol handler
  generates each image async via the configured fal.run image model
  (FLUX schnell [default] or GPT Image 2) and it pops in when ready.
  Shimmer/alt-box placeholder while pending. The active image model is part of
  the image cache key, so switching engines re-dreams rather than serving a
  stale image.
- **Downloads.** The LLM links to
  `slopera-dl://download/<filename>?prompt=<description>` where a real page would
  offer a file (e.g. "Export CSV", "Add to calendar", "Download vCard"). A
  protocol handler dreams the file's raw contents (via a file-specific
  `streamFile` prompt — no HTML, no fences) and answers with
  `content-disposition: attachment`, so Chromium turns the click into a download
  and the OS save dialog takes over. **Text-native formats only** (`txt, md, csv,
  tsv, json, xml, html, svg, ics, vcf, yaml, yml, log, srt`) so every file is
  real and openable; binary/Office/zip and unknown extensions are rejected, and
  images are out of scope for v1 (a planned fast-follow reusing the scheme). The
  filename is hard-sanitized to a flat basename (no traversal, no hidden files).
  Content streams straight into the download; a *total* failure (bad key, first
  token throws) becomes a native OS notification instead of an error page, and a
  mid-stream failure lands as an interrupted download. Downloads are **not
  cached** — re-clicking re-dreams; they don't carry the permanence semantics of
  pages. A `Semaphore(2)` caps concurrent generations.
- **Site coherence.** Per-domain "site bible" (style, tone, nav structure,
  recurring fake entities) created on first visit, stored, and injected into
  every subsequent prompt for that domain.
- **Link-target fidelity.** A clicked link's own text is the strongest signal
  for what its destination should contain. On navigation the page protocol
  reads the parent snapshot's HTML, finds the `<a>` whose href resolves to the
  child URL (matched through the same rewrite navigation uses, so it's exact),
  and passes the anchor text — plus the link's `title` and any inner `<img alt>`
  for thumbnail/"read more" links — into the child prompt as the authoritative
  description of the page. The short parent-page summary still rides along as
  backdrop. Carries coherence one hop deep; no extra model calls. Works even
  when the link is clicked before its page finished streaming: the parent isn't
  snapshotted yet, so the handler reads the in-memory partial buffer of the
  in-flight generation, which already contains the clicked link. (Custom-scheme
  handlers get no referrer, so the navigation layer records the source page
  directly — see protocol section.)

### Permanence semantics
- Every generated page is **snapshotted to disk** (final HTML + images).
- Back / Forward / history clicks / re-typed URLs → instant restore from
  snapshot. The past is stable.
- **Reload re-dreams:** the reload button is the one escape hatch — it
  explicitly regenerates the URL. The old snapshot stays in history.
- Bonus: a fully cached profile is a **$0 demo mode**.

### Error states *(defaults chosen — veto anytime)*
- No usable page key (neither Anthropic nor OpenRouter for the active provider)
  → friendly onboarding page pointing to Settings.
- API failure / rate limit → themed error page in dial-up vernacular
  ("The dream could not be reached. Try again.") with a retry button.

## 3. Architecture

### Platform
Electron + electron-vite. **Why not a Chromium fork:** slopera never renders
arbitrary real websites, only LLM-generated HTML — a sandboxed webview is the
entire rendering requirement. Electron's chrome-UI / per-tab
`WebContentsView` split structurally mirrors real browser architecture.

```
┌─ main process ────────────────────────────────────────────┐
│ TabManager        one WebContentsView per tab             │
│ slopera://        protocol handler = cache-or-generate,   │
│                   returns a *streaming* Response          │
│ slopera-img://    protocol handler → fal/OpenRouter → cache│
│ GenerationService Anthropic or OpenRouter (streaming),    │
│                   prompt builder, site-bible store        │
│ Stores            history.sqlite, pages/, images/,        │
│                   bookmarks, settings (safeStorage keys)  │
└──────────────┬────────────────────────────────────────────┘
        typed IPC (zod-validated)
┌──────────────┴────────────┐  ┌─ per-tab WebContentsView ──┐
│ renderer: chrome UI       │  │ sandboxed, no Node, no IPC │
│ React 19 + TS strict      │  │ network blocked except     │
│ Zustand + Tailwind        │  │ slopera:// & slopera-img://│
│ tabs, omnibox, panels     │  │ CSP injected into pages    │
└───────────────────────────┘  └────────────────────────────┘
```

### The elegant core: navigation *is* the protocol handler
Tabs genuinely navigate to `slopera://<domain>/<path>`. The `slopera://`
handler returns a streamed `Response`: cache hit → file stream; miss → the
live LLM token stream. This buys real navigation events, the real spinner,
and per-tab back/forward **for free** from Chromium — Back re-requests the
URL, the handler serves the snapshot, instant. Links in generated pages are
plain hrefs; a `will-navigate` hook rewrites outbound `http(s)` to
`slopera://`. Reload-to-re-dream sets a force-regenerate flag for that
request. Custom-scheme handlers receive no referrer, so `will-navigate` (and
the new-tab opener) record the source page in a parent map keyed by child URL;
the next generation of that URL consumes it to inject the parent summary and
the clicked link's text.

### Generation pipeline
```
omnibox/link → parse (URL vs query) → cache lookup
  miss → prompt = lens preset + site bible + parent summary
                  + clicked-link text + url/path
       → stream tokens → Response stream → page builds in tab
       → on complete: snapshot to disk, update history,
         cheap Haiku call distills/updates the site bible
images → slopera-img:// requests resolve independently, async
```

### Models & cost
| Role        | Default              | Notes                                  |
|-------------|----------------------|----------------------------------------|
| Pages       | claude-haiku-4-5     | Anthropic (haiku [default] ↔ opus-class) or any OpenRouter model slug |
| Site bible  | claude-haiku-4-5     | one cheap call per new domain; on OpenRouter uses a hardcoded cheap default (`google/gemini-2.5-flash`) |
| Images      | fal.ai FLUX schnell  | fal (↔ GPT Image 2, same fal.run key) or any OpenRouter image-capable model; FLUX ~1–2 s, ~$0.003/image |

**Provider routing.** Page generation sits behind `PageGenerator`:
`AnthropicPageGenerator` (Anthropic SDK, streaming) and
`OpenRouterPageGenerator` (`openai` SDK pointed at OpenRouter's
OpenAI-compatible API, streaming); the active one is resolved per request from
`settings.textProvider` so a Settings change takes effect immediately. Images
branch in the `slopera-img://` handler: fal.run REST, or OpenRouter
chat-completions with image output. OpenRouter image-only models (FLUX, Seedream)
require `modalities: ["image"]` while text+image models (Gemini, GPT Image)
require `["image", "text"]`; the curated list tags each, and a custom/unknown
slug tries image-only first then both. Requested w/h map to the nearest
`image_config.aspect_ratio` preset (OpenRouter image models don't take exact
pixels); the image comes back as a base64 data-URL. OpenRouter is one shared key
across pages and images. The active model id is part of every cache key, so
switching engines re-dreams.

### Security model
Generated pages execute LLM-written JS, so tab views are hostile-by-default:
`sandbox: true`, `contextIsolation`, no Node, no preload IPC surface, a
dedicated session whose `webRequest` blocks everything except `slopera://`,
`slopera-img://`, `slopera-dl://` (downloads), and `data:`, plus an injected
CSP. API keys live in `safeStorage`, never in the renderer.

### Data layout
`~/Library/Application Support/slopera/`: `history.sqlite` (history,
bookmarks, site bibles, page index), `pages/<hash>.html`,
`images/<hash>.png`. Cache key: `hash(url + lens + generation-counter)`.

### Repo layout
```
src/main/        tabs, protocols, generation, stores
src/preload/     typed IPC bridge
src/renderer/    chrome UI (React)
src/shared/      types, zod schemas, lens presets
tests/           vitest unit + playwright smoke
```

## 4. Engineering & delivery

- **Repo:** GitLab. README leads with the tagline, a demo GIF of a page
  streaming in, and the architecture diagram.
- **CI (`.gitlab-ci.yml`):** lint + `tsc` + vitest + build on Linux runners
  every push. Packaging is a manual job run on macOS (GitLab macOS runners
  are paid — revisit later).
- **Tests where logic is real:** prompt builder, omnibox parsing
  (URL vs query), cache keying, history logic — mocked API clients. One
  Playwright smoke test: boot → type URL → fixture page renders (no real API
  in CI).
- **Platforms:** macOS-first for v1; code and electron-builder config kept
  platform-clean so Windows/Linux are a config flip, not a port. Signing/
  notarization deferred (needs Apple dev account — open item).

## 5. Out of scope for v1 (stretch)
Two-phase fast-layout generation · downloads ("download" a hallucinated
PDF?) · view-source easter egg · find-in-page · tab drag-reorder · shared
gallery of best pages · Ollama/local model support · Windows/Linux releases.
