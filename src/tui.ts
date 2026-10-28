import type { Context } from '@deepseek-ai/cordis'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import { INSTRUCTIONS, normalizeSuggestion, promptFor, type HistoryMessage } from './suggestion.js'

export const name = 'dsh-next-sentence-tui'
export const inject = ['llm']

interface StatusRuntime { set(key: string, text: string | undefined): () => void }
interface SuggestionHost {
  suggestion: string
  accept?: () => string
}

function host(): SuggestionHost {
  const global = globalThis as typeof globalThis & { __dshNextSentenceTui?: SuggestionHost }
  return global.__dshNextSentenceTui ??= { suggestion: '' }
}

export function historyOf(session: Session): HistoryMessage[] {
  const messages: HistoryMessage[] = []
  for (const event of session.snapshotEvents() as readonly SessionEvent[]) {
    if (event.type !== 'user/message' && event.type !== 'assistant/message') continue
    const message = event.type === 'user/message' ? event.data : event.data.message
    const text = message.content.filter((block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
      .map(block => block.text).join('\n')
    if (text) messages.push({ role: event.type === 'user/message' ? 'user' : 'assistant', text })
  }
  return messages.slice(-8)
}

export function apply(ctx: Context): void {
  let status: StatusRuntime | undefined
  ctx.inject(['tuiStatus'], statusCtx => {
    status = statusCtx.get('tuiStatus') as StatusRuntime
  })
  const pending = new Map<Session, AbortController>()
  const state = host()
  state.accept = () => {
    const text = state.suggestion
    state.suggestion = ''
    status?.set('next-sentence', undefined)
    return text
  }
  ;(globalThis as typeof globalThis & { __dshNextSentenceAccept?: () => string }).__dshNextSentenceAccept = state.accept
  ctx.on('session/event', (session: Session, event: SessionEvent) => {
    if (event.type === 'turn/start' || event.type === 'user/message') {
      pending.get(session)?.abort()
      pending.delete(session)
      state.suggestion = ''
      status?.set('next-sentence', undefined)
      return
    }
    if (event.type !== 'turn/end' || ctx.llm === undefined) return
    const controller = new AbortController()
    pending.set(session, controller)
    const header = session.requestHeader()
    if (!header) {
      status?.set('next-sentence:error', '推荐生成失败：当前会话没有模型路由')
      return
    }
    const { provider, model } = header.config
    void (async () => {
      let text = ''
      for await (const chunk of ctx.llm.stream({
        provider, model, system: INSTRUCTIONS,
        messages: [{ role: 'user', content: [{ type: 'text', text: promptFor(historyOf(session), '') }] }],
        maxTokens: 160, temperature: 0.4, signal: controller.signal,
      })) {
        if (chunk.type === 'text-delta') text += chunk.text
      }
      if (!controller.signal.aborted) {
        state.suggestion = normalizeSuggestion(text, '')
        status?.set('next-sentence', state.suggestion ? `→ / Tab 填入 · ${state.suggestion}` : undefined)
      }
    })().catch((error: unknown) => {
      status?.set('next-sentence:error', `推荐生成失败：${error instanceof Error ? error.message : String(error)}`)
    }).finally(() => {
      if (pending.get(session) === controller) pending.delete(session)
    })
  })
  ctx.on('session/disposed', (session: Session) => pending.get(session)?.abort())
  ctx.effect(() => () => {
    for (const controller of pending.values()) controller.abort()
    state.suggestion = ''
    delete (globalThis as typeof globalThis & { __dshNextSentenceAccept?: unknown }).__dshNextSentenceAccept
  }, 'next-sentence: tui')
}
