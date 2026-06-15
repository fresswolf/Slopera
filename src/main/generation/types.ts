import type { LinkContext } from '@shared/extract'

export interface PageRequest {
  /** Normalized slopera:// URL of the page being dreamed. */
  url: string
  host: string
  /** pathname + search */
  path: string
  lens: string
  /** Site identity memo for this domain, if one exists. */
  bible: string | null
  /** Where the user clicked the link that led here. */
  parentUrl: string | null
  parentSummary: string | null
  /** What the clicked link said about this destination, if resolvable. */
  link: LinkContext | null
}

export interface FileRequest {
  /** slopera-dl:// URL of the file being dreamed. */
  url: string
  /** Sanitized filename, including extension — drives format and tone. */
  filename: string
  /** What the file should contain, from the link's ?prompt=. */
  prompt: string
  lens: string
}

export interface PageGenerator {
  streamPage(req: PageRequest, signal: AbortSignal): AsyncGenerator<string>
  /** Dream the raw contents of a downloadable file (no HTML, no fences). */
  streamFile(req: FileRequest, signal: AbortSignal): AsyncGenerator<string>
}
