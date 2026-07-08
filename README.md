# Slopera

*The browser for the slop era.*

Slopera is a desktop browser that never touches the real web. Type any URL (real or invented) and the page is **hallucinated on the fly** by an LLM.

![A page streaming into a tab](fishrain.gif)

## Running it

Grab an installer for macOS, Windows or Linux from the
[Releases page](https://github.com/fresswolf/Slopera/releases), or run from
source:

```sh
npm install
npm run dev
```

Either way, open Settings (gear icon) and paste:

- an **API key** from **Anthropic** or **OpenRouter**  — required, dreams the pages
- a **fal.ai key** — optional, generates images. With an OpenRouter key you can instead pick from alternative (but slower) image models served via OpenRouter. Without either, images degrade into captioned placeholders.

Keys are stored encrypted via the OS keychain (`safeStorage`) and only ever
sent to their respective APIs. Browsing already-dreamed pages costs nothing.

> **Use at your own risk.** Every freshly dreamed page and image is a paid API
> call billed to your keys, and generated content is unmoderated LLM output.

## Development

```sh
npm run typecheck     # strict TS, main + renderer
npm run lint          # eslint
npm test              # vitest: omnibox parsing, fence-stripping, prompts, extraction
npm run build         # electron-vite production build
npm run test:e2e      # playwright: boots the built app (run `npm run build` first)
npm run package:mac   # unsigned .dmg into release/
npm run package:win   # NSIS installer (x64) into release/
npm run package:linux # AppImage (x64) into release/
npm run icons         # regenerate app icons from logo.png
```

`SLOPERA_FAKE_GEN=1 npm run dev` runs the whole browser against a canned
offline generator — useful for UI work and used by the e2e test. CI
(GitHub Actions, `.github/workflows/release.yml`) runs lint, typecheck and
unit tests on every push, and builds installers for macOS, Windows and Linux;
pushing a `v*` tag collects them into a draft GitHub Release.

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
