import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InputActions, InputState } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ModelDirectory, ModelDirectoryResolver } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ISessions, SessionEventSource } from '@deepseek-ai/dsh-api-session-controller/client'
import type { TextBlock } from '@deepseek-ai/dsh-llm'
interface OverlayProps {
  sessionId: SessionId
  useInput: <T>(selector: (input: InputState) => T) => T
  inputActions: InputActions
}

declare module '@deepseek-ai/dsh-api-session-controller/client' {
  interface SessionReferenceSourceMap { 'next-sentence': true }
}
import type { HistoryMessage } from './suggestion.js'

export const inject = ['slots', 'sessions', 'modelDirectories', 'connection']
const SLOT = 'conversation.input.overlay'
const SETTINGS_SLOT = 'settings.general.item'
const ENABLED_STORAGE_KEY = 'dsh-next-sentence.enabled'

function readEnabledPreference(): boolean {
  try {
    return window.localStorage.getItem(ENABLED_STORAGE_KEY) !== 'false'
  } catch {
    return true
  }
}

let enabledPreference = readEnabledPreference()
const enabledListeners = new Set<() => void>()
const enabledStore = {
  getSnapshot: () => enabledPreference,
  subscribe: (listener: () => void) => {
    enabledListeners.add(listener)
    return () => enabledListeners.delete(listener)
  },
  set: (enabled: boolean) => {
    if (enabledPreference === enabled) return
    enabledPreference = enabled
    try { window.localStorage.setItem(ENABLED_STORAGE_KEY, String(enabled)) } catch { /* storage unavailable */ }
    enabledListeners.forEach(listener => listener())
  },
}

function EnabledSetting() {
  const enabled = useSyncExternalStore(enabledStore.subscribe, enabledStore.getSnapshot)
  return <div className="ns-setting-row">
    <div className="ns-setting-copy">
      <div className="ns-setting-title">自动推荐下一句话</div>
      <div className="ns-setting-description">回合结束后，用当前模型生成一句可 Tab 填入的建议；每次推荐是一次单独的模型请求。</div>
    </div>
    <div className="ns-setting-control">
      <span className="ns-setting-state">{enabled ? '开启' : '关闭'}</span>
      <button type="button" role="switch" aria-label="自动推荐下一句话" aria-checked={enabled}
        className={`ns-setting-switch${enabled ? ' is-on' : ''}`} onClick={() => enabledStore.set(!enabled)}>
        <span className="ns-setting-switch-knob" aria-hidden="true" />
      </button>
    </div>
  </div>
}

interface Rpc { call(channel: string, endpoint: string, payload?: unknown): Promise<unknown> }
interface SuggestionProps {
  running: boolean
  input: InputState
  inputActions: InputActions
  eventSource: SessionEventSource
  directory: ModelDirectory
  rpc?: Rpc
}

function historyOf(source: SessionEventSource): HistoryMessage[] {
  const messages: HistoryMessage[] = []
  for (const entry of source.getSnapshot().entries) {
    const event = entry.event
    if (event.type !== 'user/message' && event.type !== 'assistant/message') continue
    const message: { content: readonly import('@deepseek-ai/dsh-llm').ContentBlock[] } = event.type === 'user/message' ? event.data : event.data.message
    const text = message.content.filter((block): block is TextBlock => block.type === 'text').map(block => block.text).join('\n')
    if (text) messages.push({ role: event.type === 'user/message' ? 'user' : 'assistant', text })
  }
  return messages.slice(-8)
}

function editorEnd(actions: InputActions) {
  const selection = window.getSelection()
  if (!selection?.isCollapsed) return false
  const root = selection?.anchorNode instanceof Element
    ? selection.anchorNode.closest('[contenteditable="true"]')
    : selection?.anchorNode?.parentElement?.closest('[contenteditable="true"]')
  if (!root) return false
  const range = selection.getRangeAt(0).cloneRange()
  range.selectNodeContents(root)
  range.setStart(selection.anchorNode!, selection.anchorOffset)
  return range.toString().length === 0
}

function Watermark({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const update = () => {
      const node = ref.current
      if (!node) return
      const placeholder = document.querySelector<HTMLElement>('[data-composer-placeholder]')
      const editor = document.querySelector<HTMLElement>('[data-composer-card] [contenteditable="true"]')
      const host = placeholder ?? editor
      if (!host) return
      const rect = host.getBoundingClientRect()
      const style = getComputedStyle(host)
      Object.assign(node.style, {
        left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`,
        fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
      })
      if (placeholder) placeholder.style.visibility = 'hidden'
    }
    update()
    const observer = new ResizeObserver(update)
    const placeholder = document.querySelector<HTMLElement>('[data-composer-placeholder]')
    if (placeholder) observer.observe(placeholder)
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
      document.querySelectorAll<HTMLElement>('[data-composer-placeholder]').forEach(el => { el.style.visibility = '' })
    }
  }, [text])
  return <div ref={ref} className="dsh-next-sentence" aria-hidden="true">
    <span className="dsh-next-sentence-text">{text}</span><kbd>Tab</kbd>
  </div>
}

interface SessionCache { suggestion: string; settled: boolean; dismissed: boolean }
const sessionCaches = new Map<string, SessionCache>()

function Suggestion({ running, input, inputActions, eventSource, directory, rpc, sessionId }: SuggestionProps & { sessionId: string }) {
  const enabled = useSyncExternalStore(enabledStore.subscribe, enabledStore.getSnapshot)
  const cacheRef = useRef<SessionCache>()
  if (!cacheRef.current || cacheRef.current !== sessionCaches.get(sessionId)) {
    cacheRef.current = sessionCaches.get(sessionId) ?? { suggestion: '', settled: false, dismissed: false }
    sessionCaches.set(sessionId, cacheRef.current)
  }
  const cache = cacheRef.current
  const [suggestion, setSuggestion] = useState(cache.suggestion)
  const suggestionRef = useRef(cache.suggestion)
  useEffect(() => {
    setSuggestion(cache.suggestion)
  }, [cache])
  const revision = useSyncExternalStore(
    listener => eventSource.subscribe(listener),
    () => eventSource.getSnapshot().revision,
  )
  const selected = useSyncExternalStore(
    listener => directory.store.subscribe(listener),
    () => directory.store.getSnapshot().current,
  )
  suggestionRef.current = suggestion

  useEffect(() => {
    if (running) {
      cache.settled = true
      cache.dismissed = false
      cache.suggestion = ''
      setSuggestion('')
    }
  }, [running, cache])

  useEffect(() => {
    if (!enabled) { setSuggestion(''); return }
    if (input.draft || running) {
      // Typing keeps the cached recommendation; only non-empty drafts hide it.
      if (input.draft) setSuggestion('')
      return
    }
    if (cache.suggestion) { setSuggestion(cache.suggestion); return }
    if (revision === 0) return
    if (!cache.settled || cache.dismissed || !selected || !rpc || input.phase !== 'plain') return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      const model = directory.store.getSnapshot().current
      if (!model || controller.signal.aborted) return
      try {
        const response = await rpc.call('/dsh-next-sentence', 'suggest', {
          ...model, history: historyOf(eventSource), draft: '',
        }) as { ok: boolean; value?: { text: string } }
        if (!controller.signal.aborted && response.ok) {
          cache.suggestion = response.value?.text ?? ''
          setSuggestion(cache.suggestion)
        }
      } catch { /* A recommendation is optional. */ }
    }, 350)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [enabled, running, revision, input.draft, input.phase, selected, rpc, eventSource, directory, cache])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && suggestionRef.current) {
        event.preventDefault(); event.stopPropagation()
        cache.suggestion = ''
        cache.dismissed = true
        setSuggestion('')
        return
      }
      if (event.key !== 'Tab' || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return
      if (!suggestionRef.current || !editorEnd(inputActions)) return
      event.preventDefault(); event.stopImmediatePropagation()
      const span = inputActions.captureInsertion()
      if (inputActions.insertText(suggestionRef.current, span)) {
        setSuggestion('')
        // Keep cache.suggestion: deleting the filled draft brings the same line back.
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [inputActions, cache])

  if (!suggestion) return null
  return <Watermark text={suggestion} />
}

export function apply(ctx: Context) {
  const sessions = ctx.sessions as unknown as ISessions
  const directories = ctx.modelDirectories as ModelDirectoryResolver
  const rpc = (ctx.get('connection') as { rpc?: Rpc } | undefined)?.rpc
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.plugin = 'dsh-next-sentence'
    style.textContent = `
      .dsh-next-sentence { position:fixed; z-index:4; display:flex; align-items:center;
        gap:8px; min-width:0; pointer-events:none; color:var(--dsw-alias-label-tertiary); }
      .dsh-next-sentence-text { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .dsh-next-sentence kbd { flex:none; padding:0 4px; border:1px solid var(--dsw-alias-border-l1);
        border-radius:4px; font:10px/16px inherit; color:var(--dsw-alias-label-caption); }
      .ns-setting-row { display:flex; align-items:center; justify-content:space-between; gap:24px;
        padding:16px 0; border-bottom:1px solid var(--dsw-alias-border-l2, rgba(121,126,145,.18)); }
      .ns-setting-copy { min-width:0; }
      .ns-setting-title { color:var(--dsw-alias-label-primary,#15171b); font-size:14px; line-height:22px; }
      .ns-setting-description { margin-top:3px; color:var(--dsw-alias-label-tertiary,#9296a0); font-size:12px; line-height:18px; }
      .ns-setting-control { display:inline-flex; align-items:center; gap:10px; flex:none; }
      .ns-setting-state { color:var(--dsw-alias-label-secondary,#686c75); font-size:13px; }
      .ns-setting-switch { position:relative; width:38px; height:22px; padding:0; border:0; border-radius:999px;
        background:var(--dsw-alias-fill-quaternary,#c7cbd3); cursor:pointer; transition:background 150ms ease; }
      .ns-setting-switch.is-on { background:var(--dsw-alias-state-business-primary,#4f73ff); }
      .ns-setting-switch-knob { position:absolute; top:2px; left:2px; width:18px; height:18px; border-radius:50%;
        background:#fff; box-shadow:0 1px 4px rgba(0,0,0,.2); transition:transform 170ms cubic-bezier(.22,1,.36,1); }
      .ns-setting-switch.is-on .ns-setting-switch-knob { transform:translateX(16px); }
    `
    document.head.appendChild(style)
    return () => style.remove()
  }, 'next-sentence: styles')

  ctx.slots.inject(SETTINGS_SLOT, () => ctx.slots.register(
    { name: SETTINGS_SLOT, id: 'next-sentence-enabled', order: 30 },
    EnabledSetting,
  ))

  ctx.slots.inject(SLOT, () => ctx.slots.register({ name: SLOT, id: 'next-sentence' }, (props: OverlayProps) => {
    const ref = useRef<ReturnType<ISessions['retain']> | null>(null)
    if (ref.current?.sessionId !== props.sessionId) {
      ref.current?.release()
      ref.current = sessions.retain(props.sessionId, { source: 'next-sentence' })
    }
    useEffect(() => () => { ref.current?.release(); ref.current = null }, [])
    const eventSource = ref.current!.binding.eventSource
    return <Suggestion running={ref.current!.binding.session.getSnapshot().running}
      input={props.useInput(input => input)} inputActions={props.inputActions}
      eventSource={eventSource}
      directory={directories.directoryFor(props.sessionId)}
      sessionId={props.sessionId}
      rpc={rpc} />
  }))
}
