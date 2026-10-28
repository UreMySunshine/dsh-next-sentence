import type { Context } from '@deepseek-ai/cordis'

export interface SuggestionRoute {
  provider: string
  model: string
  reasoningEffort?: string
}

interface SettingsRow {
  ns: string
  user?: unknown
  value?: unknown
}

interface SettingsService {
  describe?(): SettingsRow[]
  get?(ns: string): unknown
}

interface ProviderConfig {
  baseURL?: string
  apiKeyEnv?: string
  api?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function providerConfig(ctx: Context, provider: string): ProviderConfig | undefined {
  const settings = ctx.get('settings', false) as SettingsService | undefined
  if (settings === undefined) return undefined
  let section: unknown
  try {
    section = settings.get?.('llm-pi-ai')
      ?? settings.describe?.().find(row => row.ns === 'llm-pi-ai')?.value
  } catch {
    return undefined
  }
  if (!isRecord(section) || !isRecord(section.providers)) return undefined
  const config = section.providers[provider]
  return isRecord(config) ? config as ProviderConfig : undefined
}

/** One non-streaming OpenAI-compatible completion for providers whose stream omits text. */
async function nonStreamingCompletion(
  ctx: Context,
  route: SuggestionRoute,
  system: string,
  user: string,
  signal: AbortSignal,
): Promise<string> {
  const config = providerConfig(ctx, route.provider)
  if (config?.baseURL === undefined) {
    // eslint-disable-next-line no-console
    console.error('[dsh-next-sentence] no baseURL for', route.provider)
    return ''
  }
  const base = config.baseURL.replace(/\/+$/u, '')
  const apiKey = config.apiKeyEnv === undefined ? undefined : process.env[config.apiKeyEnv]
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(apiKey === undefined || apiKey === '' ? {} : { authorization: `Bearer ${apiKey}` }),
    },
    body: JSON.stringify({
      model: route.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: 4096,
      temperature: 0.4,
      stream: false,
    }),
    signal,
  })
  if (!response.ok) {
    // eslint-disable-next-line no-console
    console.error('[dsh-next-sentence] fallback HTTP', response.status, await response.text().catch(() => ''))
    return ''
  }
  const data = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> }
  const content = data.choices?.[0]?.message?.content
  return typeof content === 'string' ? content : ''
}

/** Ask the current route for one suggestion, falling back when its stream carries no text. */
export async function completeSuggestion(
  ctx: Context,
  route: SuggestionRoute,
  system: string,
  user: string,
  signal: AbortSignal,
): Promise<string> {
  // OpenAI-compatible routes answer consistently without streaming; prefer that
  // path so a reasoning-only stream cannot leave the suggestion empty.
  const direct = await nonStreamingCompletion(ctx, route, system, user, signal)
  if (direct.trim() !== '') return direct

  let text = ''
  const deltaBlocks = new Set<number>()
  for await (const chunk of ctx.llm.stream({
    provider: route.provider,
    model: route.model,
    ...(route.reasoningEffort === undefined ? {} : { reasoningEffort: route.reasoningEffort as never }),
    system,
    messages: [{ role: 'user', content: [{ type: 'text', text: user }] }],
    maxTokens: 4096,
    temperature: 0.4,
    signal,
  })) {
    if (chunk.type === 'text-delta') {
      deltaBlocks.add(chunk.index)
      text += chunk.text
    }
    if (chunk.type === 'block-end' && chunk.block.type === 'text' && !deltaBlocks.has(chunk.index)) {
      text += chunk.block.text
    }
  }
  if (text.trim() !== '') return text
  return nonStreamingCompletion(ctx, route, system, user, signal)
}
