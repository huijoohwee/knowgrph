import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getChatHistoryStorageKey, UI_COPY } from '@/lib/config'
import { CHAT_INPUT_APPEND_EVENT } from '@/features/canvas/utils'
import type { GraphData } from '@/lib/graph/types'
import { getLocalStorage, readJsonFromStorage, writeJsonToStorage } from '@/lib/persistence'
import { FLOATING_PANEL_SCROLL_CLASSNAME } from '@/components/ui/FloatingPanel'
import type { ChatMessage } from './SidePanelChatSections'
import { SidePanelChatFooter, SidePanelChatMessagesSection } from './SidePanelChatSections'
import { buildBoundedGraphSystemPrompt, buildMarkdownNodeSnippetPrompt } from './chatPromptHelpers'
import { normalizeChatModelId, resolveChatEndpointForModels, resolveChatEndpointForRequest } from '@/lib/chatEndpoint'

const clampTemperature = (raw: unknown): number => {
  const t = Number(raw)
  if (!Number.isFinite(t)) return 0.3
  if (t < 0) return 0
  if (t > 2) return 2
  return t
}

const toShortId = (): string => `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const parseLine = (raw: unknown): number | null => {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (typeof raw === 'string') {
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const buildHistoryKey = (graphData: GraphData | null): string => {
  const meta = graphData?.metadata || null
  const getString = (k: string) => {
    const raw = meta ? meta[k] : null
    return typeof raw === 'string' ? raw.trim() : ''
  }
  const idish =
    getString('graphId') ||
    getString('id') ||
    getString('source') ||
    getString('path') ||
    getString('dataset') ||
    getString('name')
  const fallback = (() => {
    if (!graphData) return 'empty'
    const nodes = Array.isArray(graphData.nodes) ? graphData.nodes.length : 0
    const edges = Array.isArray(graphData.edges) ? graphData.edges.length : 0
    const type = typeof graphData.type === 'string' ? graphData.type : 'graph'
    return `${type}:${nodes}:${edges}`
  })()
  return getChatHistoryStorageKey(idish || fallback)
}

const parseSseEvents = (buffer: string): { events: string[]; rest: string } => {
  const lines = buffer.split(/\r?\n/)
  const rest = lines.pop() || ''
  const events: string[] = []
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line.startsWith('data:')) continue
    const payload = line.slice('data:'.length).trim()
    if (!payload) continue
    events.push(payload)
  }
  return { events, rest }
}

const extractAssistantDelta = (payload: unknown): string => {
  if (!payload || typeof payload !== 'object') return ''
  const choices = (payload as { choices?: unknown }).choices
  if (!Array.isArray(choices) || choices.length === 0) return ''
  const first = choices[0] as { delta?: { content?: unknown }; message?: { content?: unknown } } | null
  const delta = first?.delta && typeof first.delta.content === 'string' ? String(first.delta.content) : ''
  const direct = first?.message && typeof first.message.content === 'string' ? String(first.message.content) : ''
  return delta || direct || ''
}

const parseErrorBody = async (res: Response): Promise<string> => {
  const contentType = String(res.headers.get('content-type') || '').toLowerCase()
  try {
    if (contentType.includes('application/json')) {
      const data = (await res.json()) as {
        error?: { message?: unknown } | string
        message?: unknown
      }
      if (data && typeof data.error === 'object' && data.error && typeof data.error.message === 'string') {
        return data.error.message.trim()
      }
      if (typeof data?.error === 'string') return data.error.trim()
      if (typeof data?.message === 'string') return data.message.trim()
      return ''
    }
    const text = await res.text()
    return String(text || '').trim()
  } catch {
    return ''
  }
}

const shouldRetryWithModelFallback = (status: number, detail: string): boolean => {
  if (status !== 400 && status !== 404) return false
  const lowered = String(detail || '').toLowerCase()
  if (!lowered) return false
  if (!lowered.includes('model')) return false
  if (lowered.includes('not found')) return true
  if (lowered.includes('does not exist')) return true
  if (lowered.includes('unknown')) return true
  if (lowered.includes('invalid')) return true
  if (lowered.includes('load')) return true
  return false
}

const loadAvailableModelIds = async (endpoint: string): Promise<string[]> => {
  const res = await fetch(endpoint, { method: 'GET' })
  if (!res.ok) return []
  const data = (await res.json()) as { data?: unknown }
  const list = Array.isArray(data?.data) ? data.data : []
  const ids = list
    .map(entry => {
      if (!entry || typeof entry !== 'object') return ''
      const id = (entry as { id?: unknown }).id
      return typeof id === 'string' ? id.trim() : ''
    })
    .filter(Boolean)
  if (!ids.length) return []
  const seen = new Set<string>()
  const out: string[] = []
  ids.forEach(id => {
    if (seen.has(id)) return
    seen.add(id)
    out.push(id)
  })
  return out
}

export default function SidePanelChat() {
  const graphData = useGraphStore(s => s.graphData)
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const markdownText = useGraphStore(s => s.markdownDocumentText || null)
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || 'font-sans')
  const uiPanelKeyValueTextSizeClass = useGraphStore(s => s.uiPanelKeyValueTextSizeClass || 'text-sm')
  const uiPanelMicroLabelTextSizeClass = useGraphStore(s => s.uiPanelMicroLabelTextSizeClass || 'text-xs')
  const chatEndpointUrl = useGraphStore(s => s.chatEndpointUrl)
  const chatModel = useGraphStore(s => s.chatModel)
  const chatTemperature = useGraphStore(s => s.chatTemperature)
  const chatSystemPrompt = useGraphStore(s => s.chatSystemPrompt)
  const setChatModel = useGraphStore(s => s.setChatModel)

  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [input, setInput] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)
  const [errorText, setErrorText] = React.useState<string | null>(null)
  const [connectivity, setConnectivity] = React.useState<'unknown' | 'ok' | 'error'>('unknown')
  const [connectivityDetail, setConnectivityDetail] = React.useState<string | null>(null)

  const abortRef = React.useRef<AbortController | null>(null)
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const lastLoadedHistoryKeyRef = React.useRef<string | null>(null)

  const historyKey = React.useMemo(() => buildHistoryKey(graphData), [graphData])

  const currentNode = React.useMemo(() => {
    if (!graphData || !selectedNodeId) return null
    return graphData.nodes.find(n => n.id === selectedNodeId) || null
  }, [graphData, selectedNodeId])

  React.useEffect(() => {
    if (lastLoadedHistoryKeyRef.current === historyKey) return
    lastLoadedHistoryKeyRef.current = historyKey
    const storage = getLocalStorage()
    if (!storage) {
      setMessages([])
      return
    }
    const parseHistory = (raw: unknown): ChatMessage[] | null => {
      if (!Array.isArray(raw)) return null
      const next: ChatMessage[] = []
      raw.forEach(item => {
        if (!item || typeof item !== 'object') return
        const id = typeof (item as { id?: unknown }).id === 'string' ? String((item as { id: unknown }).id) : ''
        const role = (item as { role?: unknown }).role
        const content = (item as { content?: unknown }).content
        if (!id) return
        if (role !== 'user' && role !== 'assistant') return
        if (typeof content !== 'string') return
        next.push({ id, role, content })
      })
      return next
    }
    const next = readJsonFromStorage(storage, historyKey, [] as ChatMessage[], parseHistory)
    setMessages(next.slice(-80))
  }, [historyKey])

  React.useEffect(() => {
    const storage = getLocalStorage()
    if (!storage) return
    writeJsonToStorage(storage, historyKey, messages.slice(-80))
  }, [historyKey, messages])

  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    try {
      el.scrollTop = el.scrollHeight
    } catch {
      void 0
    }
  }, [messages.length])

  React.useEffect(() => {
    return () => {
      const ctrl = abortRef.current
      if (!ctrl) return
      try {
        ctrl.abort()
      } catch {
        void 0
      }
    }
  }, [])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<{ text?: string; mode?: 'append' | 'replace' } | undefined>
      const text = typeof e.detail?.text === 'string' ? e.detail?.text : ''
      if (!text.trim()) return
      const mode = e.detail?.mode === 'replace' ? 'replace' : 'append'
      setInput(prev => {
        if (mode === 'replace') return text
        const base = String(prev || '')
        if (!base.trim()) return text
        const sep = base.endsWith('\n') ? '\n' : '\n\n'
        return `${base}${sep}${text}`
      })
    }
    window.addEventListener(CHAT_INPUT_APPEND_EVENT, handler as EventListener)
    return () => {
      window.removeEventListener(CHAT_INPUT_APPEND_EVENT, handler as EventListener)
    }
  }, [])

  const handleStop = () => {
    const ctrl = abortRef.current
    if (!ctrl) return
    try {
      ctrl.abort()
    } catch {
      void 0
    }
  }

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async ev => {
    ev.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isLoading) return
    if (!chatEndpointUrl || !chatModel) {
      setErrorText(UI_COPY.chatMissingEndpointAndModelError)
      setConnectivity('unknown')
      setConnectivityDetail(null)
      return
    }
    const requestUrl = resolveChatEndpointForRequest(chatEndpointUrl)
    if (!requestUrl) {
      setErrorText(UI_COPY.chatMissingEndpointAndModelError)
      setConnectivity('unknown')
      setConnectivityDetail(null)
      return
    }

    setErrorText(null)
    setConnectivityDetail(null)
    const userMessageId = toShortId()
    const assistantMessageId = toShortId()
    const nextMessages: ChatMessage[] = [
      ...messages,
      { id: userMessageId, role: 'user', content: trimmed },
      { id: assistantMessageId, role: 'assistant', content: '' },
    ]
    setMessages(nextMessages)
    setInput('')
    setIsLoading(true)

    try {
      const payloadMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = []

      payloadMessages.push({ role: 'system', content: buildBoundedGraphSystemPrompt(graphData, currentNode) })
      if (chatSystemPrompt && typeof chatSystemPrompt === 'string' && chatSystemPrompt.trim()) {
        payloadMessages.push({ role: 'system', content: chatSystemPrompt })
      }

      const markdownSnippet = buildMarkdownNodeSnippetPrompt(markdownText, currentNode, parseLine)
      if (markdownSnippet) {
        payloadMessages.push({
          role: 'system',
          content: markdownSnippet,
        })
      }

      nextMessages
        .filter(m => m.id !== assistantMessageId)
        .forEach(m => payloadMessages.push({ role: m.role, content: m.content }))

      const controller = new AbortController()
      abortRef.current = controller

      const sendChat = async (model: string) => {
        return await fetch(requestUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: payloadMessages,
            temperature: clampTemperature(chatTemperature),
            stream: true,
          }),
          signal: controller.signal,
        })
      }

      let effectiveModel = normalizeChatModelId(chatModel)
      let res = await sendChat(effectiveModel)
      if (!res.ok) {
        const initialDetail = await parseErrorBody(res)
        const allowFallback = shouldRetryWithModelFallback(res.status, initialDetail)
        if (allowFallback) {
          const modelsEndpoint = resolveChatEndpointForModels(chatEndpointUrl)
          const ids = modelsEndpoint ? await loadAvailableModelIds(modelsEndpoint) : []
          const fallback = ids.find(id => id !== effectiveModel) || ids[0] || ''
          if (fallback && fallback !== effectiveModel) {
            effectiveModel = fallback
            setChatModel(fallback)
            res = await sendChat(fallback)
          }
        }
        if (!res.ok) {
          const detail = initialDetail || (await parseErrorBody(res))
          const statusText = UI_COPY.chatRequestFailedStatus(res.status)
          const suffix = detail ? ` ${detail}` : ''
          setConnectivity('ok')
          setConnectivityDetail(null)
          setErrorText(`${statusText}${suffix}`.trim())
          setMessages(prev => prev.filter(m => m.id !== assistantMessageId))
          setIsLoading(false)
          abortRef.current = null
          return
        }
      }

      const contentType = String(res.headers.get('content-type') || '').toLowerCase()
      const isEventStream = contentType.includes('text/event-stream')

      if (isEventStream && res.body) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let assistantText = ''
        let done = false
        while (!done) {
          const chunk = await reader.read()
          if (chunk.done) break
          buffer += decoder.decode(chunk.value, { stream: true })
          const parsed = parseSseEvents(buffer)
          buffer = parsed.rest
          for (const raw of parsed.events) {
            if (raw === '[DONE]') {
              done = true
              break
            }
            try {
              const next = extractAssistantDelta(JSON.parse(raw) as unknown)
              if (!next) continue
              assistantText += next
              setMessages(prev => prev.map(m => (m.id === assistantMessageId ? { ...m, content: assistantText } : m)))
            } catch {
              void 0
            }
          }
        }
        if (!assistantText) {
          setErrorText(UI_COPY.chatResponseMissingContentError)
          setMessages(prev => prev.filter(m => m.id !== assistantMessageId))
          setIsLoading(false)
          abortRef.current = null
          return
        }
      } else {
        const data = (await res.json()) as unknown
        const assistantText = extractAssistantDelta(data)
        if (!assistantText) {
          setErrorText(UI_COPY.chatResponseMissingContentError)
          setMessages(prev => prev.filter(m => m.id !== assistantMessageId))
          setIsLoading(false)
          abortRef.current = null
          return
        }
        setMessages(prev => prev.map(m => (m.id === assistantMessageId ? { ...m, content: assistantText } : m)))
      }

      setConnectivity('ok')
      setConnectivityDetail(null)
      setIsLoading(false)
      abortRef.current = null
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err || '')
      if (raw && raw.toLowerCase().includes('aborted')) {
        setConnectivity('unknown')
        setConnectivityDetail(null)
        setIsLoading(false)
        abortRef.current = null
        return
      }
      const lowered = raw.toLowerCase()
      const endpoint = typeof chatEndpointUrl === 'string' && chatEndpointUrl ? String(chatEndpointUrl) : ''
      const isNetwork =
        raw === 'Failed to fetch' ||
        lowered.includes('networkerror') ||
        lowered.includes('net::') ||
        lowered.includes('connection refused')
      const friendly = isNetwork
        ? endpoint
          ? UI_COPY.chatUnableToReachEndpointError(endpoint)
          : UI_COPY.chatUnableToReachEndpointGenericError
        : raw || UI_COPY.chatRequestFailedGenericError

      setErrorText(friendly)
      setConnectivity('error')
      setConnectivityDetail(friendly)
      setMessages(prev => prev.filter(m => m.id !== assistantMessageId))
      setIsLoading(false)
      abortRef.current = null
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div ref={scrollRef} className={`${FLOATING_PANEL_SCROLL_CLASSNAME} p-3 space-y-3`}>
        <SidePanelChatMessagesSection
          messages={messages}
          isLoading={isLoading}
          historyKey={historyKey}
          uiPanelTextFontClass={uiPanelTextFontClass}
          uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
          uiPanelMicroLabelTextSizeClass={uiPanelMicroLabelTextSizeClass}
          setMessages={setMessages}
        />
      </div>

      <SidePanelChatFooter
        input={input}
        setInput={setInput}
        isLoading={isLoading}
        errorText={errorText}
        connectivity={connectivity}
        connectivityDetail={connectivityDetail}
        currentNode={currentNode}
        uiPanelTextFontClass={uiPanelTextFontClass}
        uiPanelMicroLabelTextSizeClass={uiPanelMicroLabelTextSizeClass}
        isSubmitDisabled={!input.trim() || isLoading || !chatEndpointUrl || !chatModel}
        onSubmit={handleSubmit}
        onStop={handleStop}
      />
    </div>
  )
}
