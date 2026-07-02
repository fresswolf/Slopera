# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Slopera is an Electron desktop browser that never touches the real web: every page is hallucinated by an LLM and streamed into the tab; images are generated via fal.ai FLUX (or OpenRouter). Text runs on Anthropic or OpenRouter; images on fal.ai or OpenRouter — provider chosen per request from settings. **SPEC.md is the authoritative feature spec and architecture record** — consult it before making design decisions, and keep it updated when behavior changes. v1 is shipped (`v1.0.0`).

## Commands

```sh
npm run dev          # run the app (electron-vite dev)
npm run typecheck    # strict TS, both tsconfig.node.json (main) and tsconfig.web.json (renderer)
npm run lint         # eslint
npm test             # vitest unit tests (tests/unit/)
npx vitest run tests/unit/omnibox.test.ts   # single test file
npm run build        # electron-vite production build → out/
npm run test:e2e     # playwright smoke test — requires `npm run build` first (launches out/main/index.js)
npm run package:mac  # unsigned .dmg → release/ (also package:win, package:linux)
npm run icons        # regenerate app icons from logo.png
```

`SLOPERA_FAKE_GEN=1 npm run dev` runs against a canned offline generator (`src/main/generation/fixture.ts`) — no API keys, no cost. Use it for UI work; the e2e test uses it too. `SLOPERA_USER_DATA=<dir>` overrides the profile directory (used by e2e for a throwaway profile).

CI is **GitHub Actions** (`.github/workflows/release.yml`): a cheap `check` gate (lint + typecheck + unit tests) runs on every push/PR, then per-platform jobs build the installers on native runners — `windows` (NSIS + zip, x64 + arm64), `macos` (dmg, x64 + arm64, unsigned), and `linux` (AppImage, x64). Pushing a `v*` tag collects all platforms' artifacts and auto-publishes a GitHub Release.

## Architecture

Three process domains, strictly separated:

- **Main** (`src/main/`): TabManager (one `WebContentsView` per tab), protocol handlers, generation, sqlite-backed stores. Everything is wired together in `src/main/index.ts`.
- **Renderer** (`src/renderer/`): the browser chrome only (tab strip, omnibox, panels) — React 19 + Zustand + Tailwind. Talks to main exclusively through the typed `window.slopera` API defined in `src/preload/index.ts` and typed by `SloperaApi` in `src/shared/types.ts`; handlers live in `src/main/ipc.ts` (zod-validated).
- **Tab webviews**: render LLM-generated HTML that executes LLM-written JS, so they are hostile-by-default — sandboxed, no Node, no preload, dedicated session (`persist:slopweb`) whose `webRequest` blocks all network except `slopera://` / `slopera-img://` / `slopera-dl://` / `data:` (plus blob/about/devtools), plus a CSP on every response. Never add IPC surface or relax network rules for tab views.

### The core trick: navigation *is* the protocol handler

Tabs genuinely navigate to `slopera://` URLs. The handler in `src/main/protocols/page.ts` answers each request with a streaming `Response`: cache hit → disk snapshot, miss → the live LLM token stream (first token awaited so total failures become a proper error page). This gives Chromium-native back/forward, history, and loading spinner for free. Links in generated pages are plain `http(s)` hrefs rewritten to `slopera://` by a `will-navigate` hook in `src/main/tabs.ts`. Custom-scheme handlers get no referrer, so that hook also records each navigation's source page in a parent map (`recordParent`) that the next generation consumes for parent-page context.

### Permanence semantics

The past is stable: every completed generation is snapshotted (`pages/<hash>.html` + sqlite row), and back/forward/history/re-typed URLs restore snapshots instantly. **Reload is the one escape hatch** — it sets a force-regenerate flag (`markForRegen`) so the next request for that URL re-dreams. Cache key = `pageKey(url, lens)`; each lens has its own cache for writes, but a cache miss falls back to the newest snapshot of that URL under **any** lens, with a per-tab mismatch infobar ("dreamed in X — re-dream it in Y?").

### Generation pipeline

Prompt = lens preset + per-domain "site bible" + parent-page context (summary and the clicked link's own text, resolved from the parent snapshot — or the in-flight partial buffer — via `src/shared/extract.ts`) + URL. After a page completes, a cheap call distills the domain's first page into a site bible (`bibles` table) injected into all later prompts for that domain (Anthropic Haiku, or a hardcoded cheap OpenRouter model when OpenRouter is the active provider). Providers sit behind the `PageGenerator` interface (`src/main/generation/types.ts`) — `AnthropicPageGenerator` (Anthropic SDK) and `OpenRouterPageGenerator` (the `openai` SDK pointed at OpenRouter's OpenAI-compatible API; `src/main/generation/openrouter.ts`) for real use, `FixturePageGenerator` for offline. The active text provider is resolved per request from `settings.textProvider`, so a Settings change applies immediately. LLM output passes through `FenceStripper` (`src/shared/fences.ts`) to remove markdown code fences incrementally during streaming. Images branch in `protocols/image.ts`: fal.run REST, or OpenRouter — which serves image models on two surfaces, tagged per model by the `api` flag in `OPENROUTER_IMAGE_MODELS`: `'chat'` = chat completions with `modalities` (image-only models like FLUX/Seedream need `["image"]`, text+image models like Gemini need `["image","text"]`, per the `imageOnly` flag) and `'images'` = the dedicated Images API (`POST /images`; GPT Image lives only there, not in the chat catalog). Unknown slugs try chat image-only, then chat both, then the Images API. Dimensions are sent as a nearest-preset aspect ratio. Model lists and per-provider defaults live in `src/shared/constants.ts`; every model picker also offers a "Custom model…" free-text escape, so `settings.update` accepts any non-empty model string.

### Downloads

Generated pages may link `slopera-dl://download/<filename>?prompt=...`; `protocols/download.ts` dreams the file's raw contents (`PageGenerator.streamFile`) and answers with `content-disposition: attachment`, so Chromium turns the click into a native download. Text-native extensions only, whitelisted and sanitized in `src/shared/downloads.ts`; anything else gets a 204 so the current page stays put. Downloads are never cached; total failures surface as an OS notification.

### Other things to know

- **sqlite is `node:sqlite`** (bundled with Electron's Node), *not* better-sqlite3 — chosen to avoid native-module rebuilds. One file, `slopera.sqlite` (pages index, history, bookmarks, bibles); schema lives in `src/main/store/db.ts`.
- `src/shared/` is pure logic (omnibox URL-vs-query parsing, fence stripping, lenses, extraction, download sanitization, types) with no Electron imports — this is where unit-testable code goes, aliased as `@shared` everywhere.
- API keys are encrypted via `safeStorage` in `src/main/settings.ts` and must never reach the renderer.
- Lenses (prompt registers: Straight / Extra slop / 1998 / Childlike + user-defined) live in `src/shared/lenses.ts`; the active lens is stamped into every cache key, history row, and bible.
- The dream's search engine is `google.com` (`SEARCH_DOMAIN`): free-text omnibox input becomes `slopera://google.com/search?q=...` and the page prompt gives that host search-results treatment.
- New-tab/home, onboarding (no API key), and error pages are internal HTML in `src/main/internal/html.ts`, served by the protocol handler — errors are themed in dial-up vernacular, not raw stack traces.
- Multi-platform (macOS, Windows, Linux ship equally): keep code and builder config platform-clean — no platform-specific assumptions outside `electron-builder.yml` and the window-chrome switch in `src/main/index.ts`.
