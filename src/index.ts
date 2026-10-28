import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import { INSTRUCTIONS, normalizeSuggestion, promptFor, type HistoryMessage } from './suggestion.js'

export const name = 'dsh-next-sentence'
export const inject = ['llm']

const CHANNEL = '/dsh-next-sentence'
const MAX_BODY = 96 * 1024

interface ModelSelection { provider: string; model: string; reasoningEffort?: import('@deepseek-ai/dsh-llm').ReasoningEffortId }
interface SuggestRequest extends ModelSelection { history: HistoryMessage[]; draft: string }
interface JsonObject { [key: string]: unknown }
interface RouteRequest {
  method?: string
  url?: string
  headers: Record<string, string | readonly string[] | undefined>
  on(event: 'data' | 'end' | 'error', listener: (value?: unknown) => void): void
}
interface RouteResponse { writeHead(status: number, headers?: Record<string, string>): void; end(body?: string): void }

function isSelection(value: unknown): value is SuggestRequest {
  if (typeof value !== 'object' || value === null) return false
  const input = value as JsonObject
  return typeof input.provider === 'string' && typeof input.model === 'string'
    && typeof input.draft === 'string' && Array.isArray(input.history)
    && input.history.every(item => typeof item === 'object' && item !== null
      && ((item as JsonObject).role === 'user' || (item as JsonObject).role === 'assistant')
      && typeof (item as JsonObject).text === 'string')
}

function readBody(request: RouteRequest): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Uint8Array[] = []
    request.on('data', value => {
      const chunk = value as Uint8Array
      size += chunk.length
      if (size > MAX_BODY) reject(new Error('request too large'))
      else chunks.push(chunk)
    })
    request.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) }
      catch (error) { reject(error) }
    })
    request.on('error', reject)
  })
}

export function apply(ctx: Context): void {
  ctx.inject(['connection', 'webServer'], routeCtx => {
    const connection = routeCtx.get('connection') as { requestRejection(request: RouteRequest): number | undefined }
    const webServer = routeCtx.get('webServer') as { register(route: JsonObject): () => void }
    routeCtx.effect(() => webServer.register({
      kind: 'prefix', path: CHANNEL,
      handler: async (request: RouteRequest, response: RouteResponse) => {
        const rejection = connection.requestRejection(request)
        if (rejection !== undefined) { response.writeHead(rejection); response.end(); return }
        if (request.method !== 'POST' || request.url?.split('?')[0] !== `${CHANNEL}/suggest`) {
          response.writeHead(404); response.end(); return
        }
        const rpc = { type: 'server-response', rpcId: '', result: {} as JsonObject }
        try {
          const body = await readBody(request) as JsonObject
          if (body.type !== 'client-request' || typeof body.rpcId !== 'string' || body.method !== 'suggest' || !isSelection(body.payload)) {
            response.writeHead(400); response.end(); return
          }
          rpc.rpcId = body.rpcId
          const input = body.payload
          let text = ''
          for await (const chunk of ctx.llm.stream({
            provider: input.provider, model: input.model,
            ...(input.reasoningEffort ? { reasoningEffort: input.reasoningEffort } : {}),
            system: INSTRUCTIONS,
            messages: [{ role: 'user', content: [{ type: 'text', text: promptFor(input.history, input.draft) }] }],
            maxTokens: 160, temperature: 0.4,
          })) {
            if (chunk.type === 'text-delta') text += chunk.text
            if (chunk.type === 'finish' && chunk.reason.kind !== 'stop') break
          }
          rpc.result = { ok: true, value: { text: normalizeSuggestion(text, input.draft) } }
        } catch (error) {
          rpc.result = { ok: false, error: { code: 'suggest-failed', message: error instanceof Error ? error.message : String(error), details: {} } }
        }
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify(rpc))
      },
    }), 'next-sentence: rpc')
  })
}
