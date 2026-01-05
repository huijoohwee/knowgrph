import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getChatHistoryStorageKey, UI_COPY, UI_LABELS } from '@/lib/config'
import { CHAT_INPUT_APPEND_EVENT } from '@/features/canvas/utils'
import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'
import { getLocalStorage, readJsonFromStorage, writeJsonToStorage } from '@/lib/persistence'

type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string }

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
      const serializeValue = (raw: unknown): string => {
        if (raw == null) return 'null'
        if (typeof raw === 'string') {
          const s = raw.trim()
          if (!s) return '""'
          const clipped = s.length > 120 ? `${s.slice(0, 117)}...` : s
          return JSON.stringify(clipped)
        }
        if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw)
        if (Array.isArray(raw)) return `[${raw.slice(0, 3).map(v => serializeValue(v)).join(', ')}${raw.length > 3 ? ', …' : ''}]`
        if (typeof raw === 'object') {
          const keys = Object.keys(raw as Record<string, unknown>).slice(0, 6)
          return `{ ${keys.join(', ')}${Object.keys(raw as Record<string, unknown>).length > keys.length ? ', …' : ''} }`
        }
        return JSON.stringify(String(raw))
      }

      const buildBoundedGraphSystemPrompt = (): string => {
        const nodesAll = graphData?.nodes || []
        const edgesAll = graphData?.edges || []
        const nodeCount = nodesAll.length
        const edgeCount = edgesAll.length
        const graphContext = typeof graphData?.context === 'string' ? graphData.context : ''

        if (!currentNode || !graphData) {
          return [
            'You operate on BOUNDED GRAPH CONTEXT.',
            '',
            'RULES:',
            '- Reference ONLY entities and relationships provided in this conversation.',
            '- If information is missing, say so and ask for a specific node/edge selection.',
            '- For relationship claims, cite as: "[Entity A] --[Relationship]--> [Entity B]".',
            '',
            'Graph Structure:',
            `Nodes: ${nodeCount} entities`,
            `Edges: ${edgeCount} relationships`,
            graphContext ? `Context: ${graphContext}` : '',
          ]
            .filter(Boolean)
            .join('\n')
        }

        const byId = new Map<string, GraphNode>()
        graphData.nodes.forEach(n => byId.set(n.id, n))
        const focusId = currentNode.id
        const incidentEdges: GraphEdge[] = graphData.edges
          .filter(e => e.source === focusId || e.target === focusId)
          .slice(0, 50)
        const nodeIdSet = new Set<string>([focusId])
        incidentEdges.forEach(e => {
          nodeIdSet.add(e.source)
          nodeIdSet.add(e.target)
        })
        const subNodes = Array.from(nodeIdSet)
          .map(id => byId.get(id))
          .filter((n): n is GraphNode => Boolean(n))
          .slice(0, 25)

        const entityList = subNodes
          .map(n => {
            const label = String(n.label || n.id || '')
            const type = String(n.type || '')
            return `- ${label}${type ? ` (${type})` : ''} [id=${String(n.id)}]`
          })
          .slice(0, 30)

        const relationshipList = incidentEdges
          .map(e => {
            const src = byId.get(e.source)
            const tgt = byId.get(e.target)
            const srcLabel = String(src?.label || src?.id || e.source || '')
            const tgtLabel = String(tgt?.label || tgt?.id || e.target || '')
            const rel = String(e.label || 'rel')
            return `[${srcLabel}] --[${rel}]--> [${tgtLabel}]`
          })
          .slice(0, 30)

        const serializedNodes = subNodes.map(n => {
          const props: Record<string, JSONValue> = n.properties || {}
          const keys = Object.keys(props).slice(0, 6)
          const obj = keys.map(k => `${k}: ${serializeValue(props[k])}`).join(', ')
          return `- (${String(n.id)}:${String(n.type || 'entity')} { label: ${serializeValue(n.label || '')}${obj ? `, ${obj}` : ''} })`
        })
        const serializedEdges = incidentEdges.map(e => {
          const src = String(e.source)
          const tgt = String(e.target)
          const label = String(e.label || 'rel')
          const props: Record<string, JSONValue> = e.properties || {}
          const keys = Object.keys(props).slice(0, 6)
          const obj = keys.map(k => `${k}: ${serializeValue(props[k])}`).join(', ')
          return `- (${src}) -[${label}${obj ? ` { ${obj} }` : ''}]-> (${tgt})`
        })

        return [
          'You operate on BOUNDED GRAPH CONTEXT.',
          '',
          'RULES:',
          '- Reference ONLY entities and relationships in the provided Subgraph Context.',
          '- State graph paths for multi-hop answers using the citation format.',
          '- Express uncertainty if a path does not exist in the provided Subgraph Context.',
          '- Citation format: "[Entity A] --[Relationship]--> [Entity B]".',
          '',
          'Graph Structure:',
          `Nodes: ${nodeCount} entities`,
          `Edges: ${edgeCount} relationships`,
          graphContext ? `Context: ${graphContext}` : '',
          '',
          'Available Entities:',
          entityList.length ? entityList.join('\n') : '- (none)',
          '',
          'Available Relationships:',
          relationshipList.length ? relationshipList.join('\n') : '- (none)',
          '',
          'Subgraph Context:',
          'Nodes:',
          serializedNodes.length ? serializedNodes.join('\n') : '- (none)',
          '',
          'Relationships:',
          serializedEdges.length ? serializedEdges.join('\n') : '- (none)',
        ]
          .filter(Boolean)
          .join('\n')
      }

      payloadMessages.push({ role: 'system', content: buildBoundedGraphSystemPrompt() })
      if (chatSystemPrompt && typeof chatSystemPrompt === 'string' && chatSystemPrompt.trim()) {
        payloadMessages.push({ role: 'system', content: chatSystemPrompt })
      }

      if (markdownText && typeof markdownText === 'string' && markdownText.trim() && currentNode) {
        const meta = (currentNode.metadata || {}) as { lineStart?: unknown; lineEnd?: unknown }
        const lineStart = parseLine(meta.lineStart)
        const lineEnd = parseLine(meta.lineEnd) ?? lineStart
        if (lineStart != null && lineEnd != null) {
          const lines = markdownText.split(/\r?\n/)
          const safeStart = Math.max(1, Math.min(lines.length || 1, Math.floor(lineStart)))
          const safeEnd = Math.max(1, Math.min(lines.length || 1, Math.floor(lineEnd)))
          const start = Math.min(safeStart, safeEnd)
          const end = Math.max(safeStart, safeEnd)
          const pad = 8
          const sliceStart = Math.max(1, start - pad)
          const sliceEnd = Math.min(lines.length || end, end + pad)
          const snippet = lines.slice(sliceStart - 1, sliceEnd).join('\n')
          const trimmedSnippet = snippet.length > 2000 ? `${snippet.slice(0, 1997)}...` : snippet
          payloadMessages.push({
            role: 'system',
            content: [
              'Markdown excerpt associated with the selected node (line-range aligned).',
              `Line range: ${sliceStart}-${sliceEnd}`,
              'Snippet:',
              trimmedSnippet,
            ].join('\n'),
          })
        }
      }

      nextMessages
        .filter(m => m.id !== assistantMessageId)
        .forEach(m => payloadMessages.push({ role: m.role, content: m.content }))

      const controller = new AbortController()
      abortRef.current = controller

      const res = await fetch(String(chatEndpointUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: chatModel,
          messages: payloadMessages,
          temperature: clampTemperature(chatTemperature),
          stream: true,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        setConnectivity('ok')
        setConnectivityDetail(null)
        setErrorText(UI_COPY.chatRequestFailedStatus(res.status))
        setMessages(prev => prev.filter(m => m.id !== assistantMessageId))
        setIsLoading(false)
        abortRef.current = null
        return
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className={[uiPanelTextFontClass, uiPanelMicroLabelTextSizeClass, 'text-gray-500'].join(' ')}>
            {UI_COPY.chatHistoryCountStatus(messages.length)}
          </div>
          <button
            type="button"
            className="text-xs text-gray-500 hover:text-gray-900 disabled:opacity-50"
            onClick={() => {
              setMessages([])
              const storage = getLocalStorage()
              if (!storage) return
              try {
                storage.removeItem(historyKey)
              } catch {
                void 0
              }
            }}
            disabled={messages.length === 0 || isLoading}
          >
            {UI_LABELS.clear}
          </button>
        </div>

        {messages.length === 0 && (
          <div className={[uiPanelTextFontClass, uiPanelMicroLabelTextSizeClass, 'text-gray-600'].join(' ')}>
            {UI_COPY.chatEmptyStateHelp}
          </div>
        )}

        {messages.map(m => (
          <div key={m.id} className="flex">
            <div
              className={[
                'max-w-[85%] rounded px-3 py-2 mb-1 whitespace-pre-wrap break-words',
                uiPanelTextFontClass,
                uiPanelKeyValueTextSizeClass,
                m.role === 'user' ? 'ml-auto bg-blue-600 text-white' : 'mr-auto bg-gray-100 text-gray-900',
              ].join(' ')}
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-200 p-3 space-y-2">
        {errorText && (
          <div className={[uiPanelTextFontClass, uiPanelMicroLabelTextSizeClass, 'text-red-600'].join(' ')}>
            {errorText}
          </div>
        )}

        {connectivity !== 'unknown' && (
          <div
            className={[
              uiPanelTextFontClass,
              uiPanelMicroLabelTextSizeClass,
              connectivity === 'ok' ? 'text-emerald-600' : 'text-amber-600',
            ].join(' ')}
          >
            {connectivity === 'ok' ? UI_COPY.chatEndpointOkStatus : connectivityDetail || UI_COPY.chatEndpointUnreachableStatus}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            rows={3}
            className={['w-full border border-gray-300 rounded px-2 py-1 text-sm resize-none', uiPanelTextFontClass].join(' ')}
            placeholder={UI_COPY.chatInputPlaceholder}
          />

          <div className="flex items-center justify-between">
            <div className={[uiPanelTextFontClass, uiPanelMicroLabelTextSizeClass, 'text-gray-500'].join(' ')}>
              {currentNode
                ? UI_COPY.chatUsingSelectedNodeContextStatus(currentNode.label, currentNode.type)
                : UI_COPY.chatNoSelectionContextStatus}
            </div>
            <div className="flex items-center gap-2">
              {isLoading && (
                <button
                  type="button"
                  className="App-toolbar__btn text-xs bg-gray-200 text-gray-900 disabled:opacity-50"
                  onClick={handleStop}
                >
                  {UI_COPY.chatStopButtonLabel}
                </button>
              )}
              <button
                type="submit"
                className="App-toolbar__btn text-xs bg-blue-600 text-white disabled:opacity-50"
                disabled={!input.trim() || isLoading || !chatEndpointUrl || !chatModel}
              >
                {isLoading ? UI_COPY.chatSendingButtonLabel : UI_COPY.chatSendButtonLabel}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
