import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import { INSTRUCTIONS, normalizeSuggestion, promptFor, type HistoryMessage } from './suggestion.js'
import { completeSuggestion } from './llm.js'
import { readConfig, writeConfig } from './config.js'

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

function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

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
        const pathname = request.url?.split('?')[0] ?? ''
        const endpoint = pathname.startsWith(`${CHANNEL}/`) ? pathname.slice(CHANNEL.length + 1) : undefined
        if (request.method !== 'POST' || endpoint === undefined) {
          response.writeHead(404); response.end(); return
        }
        const rpc = { type: 'server-response', rpcId: '', result: {} as JsonObject }
        try {
          const body = await readBody(request) as JsonObject
          if (body.type !== 'client-request' || typeof body.rpcId !== 'string' || body.method !== endpoint) {
            response.writeHead(400); response.end(); return
          }
          rpc.rpcId = body.rpcId
          if (endpoint === 'config/get') {
            rpc.result = { ok: true, value: readConfig() }
          } else if (endpoint === 'config/set') {
            const enabled = isRecord(body.payload) ? body.payload.enabled : undefined
            if (typeof enabled !== 'boolean') {
              rpc.result = { ok: false, error: { code: 'invalid-request', message: 'enabled must be a boolean', details: {} } }
            } else {
              writeConfig({ enabled })
              rpc.result = { ok: true, value: { enabled } }
            }
          } else if (endpoint === 'suggest' && isSelection(body.payload)) {
            const input = body.payload
            if (readConfig().enabled === false) {
              rpc.result = { ok: true, value: { text: '' } }
            } else {
              const text = await completeSuggestion(
                ctx,
                { provider: input.provider, model: input.model, reasoningEffort: input.reasoningEffort },
                INSTRUCTIONS,
                promptFor(input.history, input.draft),
                AbortSignal.timeout(60_000),
              )
              rpc.result = { ok: true, value: { text: normalizeSuggestion(text, input.draft) } }
            }
          } else {
            rpc.result = { ok: false, error: { code: 'not-found', message: `unknown endpoint ${String(endpoint)}`, details: {} } }
          }
        } catch (error) {
          rpc.result = { ok: false, error: { code: 'suggest-failed', message: error instanceof Error ? error.message : String(error), details: {} } }
        }
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify(rpc))
      },
    }), 'next-sentence: rpc')
  })
}
