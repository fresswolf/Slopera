# Slopera

*The browser for the slop era.*

Slopera is a desktop browser that never touches the real web. Type any URL —
real or invented — and the page is **hallucinated on the fly** by an LLM,
streaming into the tab top-to-bottom like a dial-up connection from a parallel
timeline. Images are generated on demand and trickle in one by one. Every link
on a generated page is a door deeper into the dream: click an article on
fake-Wikipedia and the article gets dreamed up too, in the same fake-Wikipedia
house style.

> An art project, built like a product.

<!-- TODO: demo GIF — a page streaming into a tab -->

## How the illusion works

```
┌─ main process ────────────────────────────────────────────┐
│ TabManager        one WebContentsView per tab             │
│ slopera://        protocol handler = cache-or-generate,   │
│                   returns a *streaming* Response          │
│ slopera-img://    protocol handler → FLUX schnell → cache │
│ GenerationService Anthropic SDK (streaming), lens presets,│
│                   prompt builder, per-domain "site bibles"│
│ Stores            history.sqlite, pages/, images/,        │
│                   bookmarks, settings (safeStorage keys)  │
└──────────────┬────────────────────────────────────────────┘
        typed IPC (zod-validated)
┌──────────────┴────────────┐  ┌─ per-tab WebContentsView ──┐
│ renderer: chrome UI       │  │ sandboxed, no Node, no IPC │
│ React 19 + TS + Zustand   │  │ network blocked except     │
│ tabs, omnibox, panels     │  │ slopera:// & slopera-img://│
└───────────────────────────┘  └────────────────────────────┘
```

The architectural trick: **navigation *is* the protocol handler.** Tabs
genuinely navigate to `slopera://` URLs. The handler answers a cache miss with
the live LLM token stream as the response body, and a cache hit with the disk
snapshot. That one seam buys the streaming dial-up aesthetic, instant
Back/Forward, stable history, and Chromium's real loading spinner — for free.

Other load-bearing ideas:

- **The past is stable; Reload re-dreams.** Every generated page is
  snapshotted. Back/Forward/history restore snapshots instantly. The reload
  button is the one escape hatch: it regenerates the URL into a *new*
  hallucination.
- **Site bibles.** The first page of a domain is distilled (one cheap Haiku
  call) into a style memo that is injected into every later prompt for that
  domain — so a dreamed site keeps its identity as you click deeper.
- **Lenses.** A toolbar dropdown switches the register the web is dreamed in:
  *Straight* (earnest and uncanny, the default), *Slop* (maximum slop), *1998*
  (the entire web as its Geocities self). Each lens dreams its own cache.
- **Generated JS runs.** `calculator.com` is a working calculator. Pages
  execute LLM-written JavaScript, so tab webviews are hostile-by-default:
  sandboxed, no Node, no preload, all real network blocked at the session
  level, CSP on every response.

## Running it

```sh
npm install
npm run dev
```

Then open Settings (gear icon) and paste:

- an **Anthropic API key** — required, dreams the pages (~$0.05–0.10/page on
  the default Sonnet model; a Haiku option is cheaper and sloppier)
- a **fal.ai key** — optional, generates images (~$0.003/image via FLUX
  schnell). Without it, images degrade into captioned placeholders.

Keys are stored encrypted via the OS keychain (`safeStorage`) and only ever
sent to their respective APIs. Browsing already-dreamed pages costs nothing.

## Development

```sh
npm run typecheck   # strict TS, main + renderer
npm run lint        # eslint
npm test            # vitest: omnibox parsing, fence-stripping, prompts, extraction
npm run build       # electron-vite production build
npm run test:e2e    # playwright: boots the app with an offline fixture generator
npm run package:mac # unsigned .dmg into release/
```

`SLOPERA_FAKE_GEN=1 npm run dev` runs the whole browser against a canned
offline generator — useful for UI work and used by the e2e test. CI
(`.gitlab-ci.yml`) runs lint, typecheck, unit tests and the build on every
push. macOS is the supported platform for v1; the code and builder config are
kept platform-clean so Windows/Linux are a config flip away.

## Repo layout

```
src/main/        tabs, protocol handlers, generation, stores
src/preload/     typed IPC bridge
src/renderer/    browser chrome (React)
src/shared/      pure logic: URL handling, fence-stripping, lenses, types
tests/           vitest unit tests + playwright smoke test
SPEC.md          full feature spec & architecture decisions
```

## License

MIT. Nothing Slopera renders is real; any resemblance to actual websites,
living or dead, is the point.
