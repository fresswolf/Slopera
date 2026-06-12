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
}

export interface PageGenerator {
  streamPage(req: PageRequest, signal: AbortSignal): AsyncGenerator<string>
}
