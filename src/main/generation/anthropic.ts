import Anthropic from '@anthropic-ai/sdk'
import { BIBLE_MODEL, PAGE_MAX_TOKENS } from '@shared/constants'
import type { Lens } from '@shared/lenses'
import {
  buildBiblePrompt,
  buildFileSystemPrompt,
  buildFileUserPrompt,
  buildSystemPrompt,
  buildUserPrompt,
} from './prompts'
import type { FileRequest, PageGenerator, PageRequest } from './types'

export interface AnthropicConfig {
  apiKey: string | null
  model: string
  customLenses: Lens[]
}

export class AnthropicPageGenerator implements PageGenerator {
  constructor(private readonly getConfig: () => AnthropicConfig) {}

  async *streamPage(req: PageRequest, signal: AbortSignal): AsyncGenerator<string> {
    const { apiKey, model, customLenses } = this.getConfig()
    if (!apiKey) throw new Error('No Anthropic API key configured')
    const client = new Anthropic({ apiKey })
    const stream = client.messages.stream(
      {
        model,
        max_tokens: PAGE_MAX_TOKENS,
        system: buildSystemPrompt(req.lens, customLenses),
        messages: [{ role: 'user', content: buildUserPrompt(req) }],
      },
      { signal },
    )
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text
      }
    }
  }

  async *streamFile(req: FileRequest, signal: AbortSignal): AsyncGenerator<string> {
    const { apiKey, model, customLenses } = this.getConfig()
    if (!apiKey) throw new Error('No Anthropic API key configured')
    const client = new Anthropic({ apiKey })
    const stream = client.messages.stream(
      {
        model,
        max_tokens: PAGE_MAX_TOKENS,
        system: buildFileSystemPrompt(req.filename, req.lens, customLenses),
        messages: [{ role: 'user', content: buildFileUserPrompt(req) }],
      },
      { signal },
    )
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text
      }
    }
  }
}

/** One cheap call per new domain, distilling its first page into a style memo. */
export async function generateBible(apiKey: string, domain: string, html: string): Promise<string> {
  const client = new Anthropic({ apiKey })
  const res = await client.messages.create({
    model: BIBLE_MODEL,
    max_tokens: 300,
    messages: [{ role: 'user', content: buildBiblePrompt(domain, html) }],
  })
  const block = res.content[0]
  if (!block || block.type !== 'text') throw new Error('Unexpected bible response')
  return block.text.trim()
}
