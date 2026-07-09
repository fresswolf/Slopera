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
  `Straight` (default), `Extra slop`, `1998`, `Childlike` — plus **user-defined
  lenses**: a builder in Settings (name + flavor prompt) adds custom registers
  to the dropdown. Custom lenses can be edited or deleted in Settings
  (built-ins are fixed); editing keeps the lens id stable so already-dreamed
  pages persist until reloaded. The active lens is stamped onto every cached
  page; each lens dreams its own cache — for *writes*. Reads fall through: a
  cache miss under the active lens serves the newest snapshot of that URL under
  **any** lens (see Permanence semantics), so bookmarks and old haunts load
  instantly after a lens switch instead of re-dreaming.
- **Latency is aesthetic.** Pages stream in top-to-bottom like dial-up.
  Images trickle in afterwards, one by one.

## 2. Feature spec (v1)

### Browser chrome
- Tab strip: open / close / switch; resizable window (standard Electron).
- Window chrome is platform-specific (`src/main/index.ts`): macOS uses
  `titleBarStyle: 'hiddenInset'` (traffic lights inset into the tab strip, which
  pads `pl-[84px]` to clear them). Windows and Linux go frameless
  (`titleBarStyle: 'hidden'`) with a native control overlay (`titleBarOverlay`)
  painted inside the 38px tab strip (the strip reserves `pr-[140px]` for it)
  and an auto-hidden menu bar (revealed with Alt) — collapsing the OS title
  bar, menu, and tab strip into a single Chrome-style row. The renderer learns
  the OS via `window.slopera.platform` (exposed through preload).
- The main window is created hidden and shown on `ready-to-show`, with a 3s
  fallback timer: environments whose GPU presentation never produces a first
  frame (VMs without 3D acceleration) would otherwise never fire the event and
  the app would run with no visible window.
- Back / Forward / Reload / Home buttons; the Reload button becomes Stop while
  a page is streaming.
- Omnibox: accepts URLs (`wikipedia.org`, `http://calculator.com`) and
  free-text queries. The dream's search engine is Google itself — queries go to
  `slopera://google.com/search?q=...` (`SEARCH_DOMAIN`), and the page prompt
  gives that host special search-results treatment. Generated pages' search
  forms GET the same endpoint.
- Lens dropdown in the toolbar (with a "＋ New lens…" item that opens Settings).
- Bookmarks bar, **prefilled** with curated jump points (Google, Wikipedia,
  NY Times, Amazon, Weather, WolframAlpha, and the invented catpics.net).
  Add via the toolbar star (re-bookmarking a URL updates its title), remove
  via an inline ✕; no edit/reorder UI in v1.
- History panel: chronological list with a search box (matches URL and title)
  and a Clear button; click navigates to the URL, which restores the cached
  snapshot. Each visit records the lens it was actually seen in.
- New-tab/home page (`slopera://home/`): internal HTML — logo, tagline, an
  omnibox-like input, bookmark tiles.
- Menu shortcuts: ⌘T new tab, ⌘W close tab, ⌘R re-dream, ⌘[ / ⌘] back/forward,
  ⌘L focus omnibox, ⌥⌘I page DevTools (Ctrl on Windows/Linux).
- Settings page: an **API keys** block (Anthropic, OpenRouter, fal.ai — each
  labelled with what it powers), then a **Pages** block and an **Images** block,
  each a provider toggle + model picker. Keys save as you type (on blur) and each
  saved key has a **Remove** button; a **Done** button (and Escape) closes the
  panel. Every model picker is a curated dropdown ending in **"Custom model…"**
  that reveals a free-text slug box — so any provider can run an arbitrary model.
  Pages: Anthropic (Haiku 4.5 [default] / Sonnet 4.6 / Opus 4.8 / Fable 5) **or**
  OpenRouter (curated list, default `anthropic/claude-haiku-4.5`). Images:
  fal.ai (FLUX schnell [default] / GPT Image 2) **or** OpenRouter (FLUX.2 Klein
  [default] / Gemini 2.5 Flash Image / GPT Image 2) — copy recommends fal.ai as the
  fastest/cheapest. A provider whose key isn't saved is disabled ("key req'd");
  switching provider resets the model to that provider's default. At least an
  Anthropic **or** OpenRouter key is required to dream pages. The active text
  provider self-corrects: adding/removing a key never strands it on a provider
  with no key when the other one has a key (e.g. saving only an OpenRouter key
  auto-switches Pages from the default Anthropic to OpenRouter). Plus
  default-lens picker, the custom-lens builder/editor, and cache controls
  (pages + images count and size shown, clear button — which also wipes site
  bibles). If OS keychain encryption is unavailable a warning notes keys fall
  back to plain text.

### Generation behavior
- **Streaming HTML.** LLM output is streamed into the tab as it arrives.
- **Generated JavaScript works.** Pages may include interactive inline JS
  (e.g. `calculator.com` is a working calculator). Prompts instruct the model
  to emit `<style>` early and `<script>` at the end of the document. There is no
  interactivity knob: the system prompt tells the model to match the real page —
  little or no JS for content pages, but to build genuinely interactive pages
  (calculators, games like Flappy Bird, editors, demos) for real and ambitiously
  rather than faking them with a static mockup. The model decides per page.
- **Output-token ceiling.** `PAGE_MAX_TOKENS` (64K) caps a single page/file
  generation. It's a safety bound, not a target — both page paths stream (so no
  HTTP timeout), and the model stops on its own at its natural end well before
  this; the high cap just keeps complex pages (inline-JS games, long articles)
  from truncating mid-render. Anthropic requires `max_tokens`, so it can't be
  omitted; 64K fits every offered model's streamed-output ceiling.
- **Images.** The LLM writes
  `<img src="slopera-img://gen?prompt=...&w=...&h=...">`; a protocol handler
  generates each image async (a `Semaphore(3)` caps concurrent requests) and it
  pops in when ready. fal path: fal.run REST with exact pixels (clamped
  64–1408, rounded to the model's `dimStep`); OpenRouter path: dimensions map
  to the nearest `image_config.aspect_ratio` preset. No image key, or a
  generation failure → a captioned placeholder SVG (the prompt rendered as
  italic text on a gradient), so the dream degrades gracefully. The active
  image model is part of the image cache key, so switching engines re-dreams
  rather than serving a stale image.
- **Downloads.** The LLM links to
  `slopera-dl://download/<filename>?prompt=<description>` where a real page would
  offer a file (e.g. "Export CSV", "Add to calendar", "Download vCard"). A
  protocol handler dreams the file's raw contents (via a file-specific
  `streamFile` prompt — no HTML, no fences) and answers with
  `content-disposition: attachment`, so Chromium turns the click into a download
  and the OS save dialog takes over. **Text-native formats only** (`txt, md, csv,
  tsv, json, xml, html, svg, ics, vcf, yaml, yml, log, srt`) so every file is
  real and openable; binary/Office/zip and unknown extensions are rejected (a
  204 keeps the current page in place), and images are out of scope for v1 (a
  planned fast-follow reusing the scheme). The filename is hard-sanitized to a
  flat basename (no traversal, no hidden files). Content streams straight into
  the download; a *total* failure (bad key, first token throws) becomes a
  native OS notification instead of an error page, and a mid-stream failure
  lands as an interrupted download. Downloads are **not cached** — re-clicking
  re-dreams; they don't carry the permanence semantics of pages. A
  `Semaphore(2)` caps concurrent generations, held for the whole stream.
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
- **Cross-lens fallback:** if a URL has no snapshot under the active lens but
  has one under another, the newest snapshot across all lenses is served
  (every navigation: bookmarks, links, back/forward, typed URLs). A slim
  infobar under the chrome then reports the mismatch — "dreamed in *X* —
  re-dream it in *Y*?" — with a re-dream button (same as reload) and an X.
  The banner is **reactive**: it also appears when the lens is switched while
  viewing a page, and self-clears if the lens is switched back. Switching the
  lens sweeps the open tabs first — any tab whose URL already has a snapshot
  under the new lens restores it immediately (no banner); only tabs without
  one keep their cross-lens page and get the banner. Dismissal is per-tab and
  transient (cleared by navigation or lens change). History
  records the lens actually *seen*, not the active one. Parent-page context
  falls back across lenses too (content, not register); site bibles stay
  strictly per-lens so registers never cross-contaminate.
- **Reload re-dreams:** the reload button is the one escape hatch — it
  explicitly regenerates the URL in the *active* lens (bypassing the
  cross-lens fallback). The old snapshot stays in history.
- Bonus: a fully cached profile is a **$0 demo mode**.

### Error states
- No usable page key (neither Anthropic nor OpenRouter for the active provider)
  → friendly onboarding page pointing to Settings.
- API failure / rate limit before the first token → themed error page in
  dial-up vernacular ("The dream could not be reached") with a "Dream again"
  retry link. Mid-stream failure → a "the dream collapsed mid-sentence" footer
  appended to the partial page (which is not snapshotted).
- Failed image → captioned placeholder SVG. Failed download → OS notification
  (total failure) or interrupted download (mid-stream).

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
│ slopera-dl://     protocol handler → dreamed file download │
│ GenerationService Anthropic or OpenRouter (streaming),    │
│                   prompt builder, site-bible store        │
│ Stores            slopera.sqlite, pages/, images/,        │
│                   settings.json (safeStorage keys)        │
└──────────────┬────────────────────────────────────────────┘
        typed IPC (zod-validated)
┌──────────────┴────────────┐  ┌─ per-tab WebContentsView ──┐
│ renderer: chrome UI       │  │ sandboxed, no Node, no IPC │
│ React 19 + TS strict      │  │ network blocked except the │
│ Zustand + Tailwind        │  │ slopera* schemes & data:   │
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
       → stream tokens → FenceStripper → Response stream
       → page builds in tab
       → on complete: snapshot to disk, update history,
         cheap Haiku call distills/updates the site bible
images → slopera-img:// requests resolve independently, async
files  → slopera-dl:// requests stream as attachments, uncached
```
The first token is awaited before the `Response` is returned, so a total
failure becomes a proper error page rather than a broken stream.

### Models & cost
| Role        | Default              | Notes                                  |
|-------------|----------------------|----------------------------------------|
| Pages       | claude-haiku-4-5     | Anthropic (Haiku 4.5 ↔ Sonnet 4.6 ↔ Opus 4.8 ↔ Fable 5) or any OpenRouter model slug |
| Site bible  | claude-haiku-4-5     | one cheap call per new domain; on OpenRouter uses a hardcoded cheap default (`google/gemini-2.5-flash`) |
| Images      | fal.ai FLUX schnell  | fal (↔ GPT Image 2, same fal.run key) or any OpenRouter image-capable model; FLUX ~1–2 s, ~$0.003/image |

**Provider routing.** Page generation sits behind `PageGenerator`
(`streamPage` + `streamFile`): `AnthropicPageGenerator` (Anthropic SDK,
streaming) and `OpenRouterPageGenerator` (`openai` SDK pointed at OpenRouter's
OpenAI-compatible API, streaming); the active one is resolved per request from
`settings.textProvider` so a Settings change takes effect immediately. Images
branch in the `slopera-img://` handler: fal.run REST, or OpenRouter. OpenRouter
serves image models on two surfaces, and the curated list tags each with an
`api` flag: `'chat'` = chat completions with the `modalities` extension (the
image comes back as a base64 data-URL on `message.images`), `'images'` = the
dedicated Images API (`POST /images`, returns `data[0].b64_json`; models like
GPT Image exist only there, not in the chat catalog). Chat image-only models
(FLUX, Seedream) require `modalities: ["image"]` while text+image models
(Gemini) require `["image", "text"]` — an `imageOnly` flag on chat entries. A
custom/unknown slug tries chat image-only, then chat both, then the Images API.
Requested w/h map to the nearest aspect-ratio preset (OpenRouter image models
don't take exact pixels); on the Images API `quality: "low"` is also sent
(ignored by providers without the knob) to keep token-priced models cheap.
OpenRouter is one shared key across pages and images. The active model id is
part of every image cache key, so switching engines re-dreams. Image failures
log the underlying error to the main-process console before falling back to
the placeholder SVG.

### Security model
Generated pages execute LLM-written JS, so tab views are hostile-by-default:
`sandbox: true`, `contextIsolation`, no Node, no preload IPC surface, all
permission requests denied, a dedicated session (`persist:slopweb`) whose
`webRequest` blocks everything except `slopera://`, `slopera-img://`,
`slopera-dl://`, `data:`, `blob:`, `about:` and devtools schemes, plus a CSP
on every page response (`default-src 'none'`; inline style/script allowed;
images only from `slopera-img:`/`data:`; form-action allows `slopera:`/http(s)
so GET search forms work). API keys are encrypted via `safeStorage`
(`plain:`-prefixed fallback with a UI warning when the OS keychain is
unavailable) and never reach the renderer.

### Data layout
`~/Library/Application Support/slopera/` (or `SLOPERA_USER_DATA`):
`slopera.sqlite` (pages index, history, bookmarks, site bibles),
`pages/<hash>.html`, `images/<hash>.{png,jpg,webp}`, `settings.json`.
Page cache identity: `pageKey = "<lens>|<normalized url>"`; each regeneration
bumps a per-key `gen` counter and writes a new sqlite row + snapshot file
(named by `sha256(key#gen)`), so `latest(key)` is the current page and older
generations remain on disk. Image cache key: `sha256(model|prompt|WxH)`.

### Repo layout
```
src/main/        tabs, protocols, generation, stores
src/preload/     typed IPC bridge (window.slopera)
src/renderer/    chrome UI (React)
src/shared/      pure logic: omnibox/URL, fences, lenses, extraction, types
tests/unit/      vitest (omnibox, fences, lenses, prompts, extract, downloads)
tests/e2e/       playwright smoke test (fixture generator, no API)
```

## 4. Engineering & delivery

- **Repo:** GitHub (`fresswolf/Slopera`). README leads with the tagline and
  points at the Releases page.
- **CI (GitHub Actions, `.github/workflows/release.yml`):** a cheap `check`
  gate (lint + typecheck + vitest) on every push/PR, then per-platform build
  jobs on native runners — `windows` (NSIS + zip, x64 + arm64), `macos` (dmg,
  x64 + arm64, signed + notarized when the signing secrets are present — see
  below), `linux` (AppImage, x64). Pushing a `v*` tag collects all artifacts
  and **auto-publishes** a GitHub Release.
- **Tests where logic is real:** omnibox parsing (URL vs query), fence
  stripping, lens resolution/slugging, prompt building, link/summary
  extraction, download-target sanitization — all in `src/shared/` or
  `src/main/generation/prompts.ts`, no API clients involved. One Playwright
  smoke test: boot the built app with `SLOPERA_FAKE_GEN=1` → type URL →
  fixture page renders.
- **Platforms:** multi-platform — installers ship for macOS, Windows and Linux
  as equals, each with native window chrome. Code and electron-builder config
  are platform-clean.
- **macOS signing/notarization:** `electron-builder.yml` sets
  `hardenedRuntime: true` + `notarize: true` (electron-builder's default
  Electron entitlements). CI imports a Developer ID Application certificate
  from the `CSC_LINK`/`CSC_KEY_PASSWORD` secrets and notarizes via
  `APPLE_ID`/`APPLE_APP_SPECIFIC_PASSWORD`/`APPLE_TEAM_ID`. When creds are
  absent (local builds, fork PRs) electron-builder warns and falls back to an
  unsigned build, so nothing breaks without the secrets.

## 5. Out of scope for v1 (stretch)
Two-phase fast-layout generation · dreamed image downloads (reusing
`slopera-dl://`) · view-source easter egg · find-in-page · tab drag-reorder ·
bookmark edit/reorder · shared gallery of best pages · Ollama/local model
support · Windows code signing.
