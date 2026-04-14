import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_COPY } from '@/lib/config'
import { CHAT_INPUT_APPEND_EVENT } from '@/features/canvas/utils'
import { getLocalStorage, readJsonFromStorage, writeJsonToStorage } from '@/lib/persistence'
import { FLOATING_PANEL_SCROLL_CLASSNAME } from '@/components/ui/FloatingPanel'
import { hashArrayOfObjectsSignature, hashSignatureParts } from '@/lib/hash/signature'
import { cancelWorkspaceSyncTask, scheduleWorkspaceSyncTask } from '@/lib/async/workspaceSyncScheduler'
import { WORKSPACE_SYNC_SCOPE_CHAT_HISTORY_RUNTIME_PERSISTENCE } from '@/lib/async/workspaceSyncKeys'
import type { ChatMessage } from './SidePanelChatSections'
import { SidePanelChatFooter, SidePanelChatMessagesSection } from './SidePanelChatSections'
import { buildBoundedGraphSystemPrompt, buildMarkdownNodeSnippetPrompt, buildWorkspaceWideContextPrompt } from './chatPromptHelpers'
import {
  CHAT_DEFAULT_ENDPOINT_URL,
  buildChatProxyHeaders,
  getDefaultChatModelForProvider,
  getChatModelOptions,
  getChatProviderLabel,
  getChatProviderRegionLabel,
  getChatRecommendedModelHint,
  normalizeChatModelIdForProvider,
  resolveChatEndpointForModels,
  resolveChatEndpointForRequest,
} from '@/lib/chatEndpoint'
import {
  buildHistoryKey,
  CHAT_HISTORY_COALESCE_DELAY_MS,
  clampTemperature,
  extractAssistantDelta,
  getCachedChatHistory,
  loadAvailableModelIds,
  parseErrorBody,
  parseLine,
  parseSseEvents,
  persistChatExchangeLog,
  putChatHistoryCache,
  shouldRetryWithModelFallback,
  toHistoryTaskKey,
  toShortId,
} from '@/features/chat/SidePanelChat.helpers'

export default function SidePanelChat() {
  const graphData = useGraphStore(s => s.graphData)
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const markdownText = useGraphStore(s => s.markdownDocumentText || null)
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || 'font-sans')
  const uiPanelKeyValueTextSizeClass = useGraphStore(s => s.uiPanelKeyValueTextSizeClass || 'text-sm')
  const uiPanelMicroLabelTextSizeClass = useGraphStore(s => s.uiPanelMicroLabelTextSizeClass || 'text-xs')
  const chatProvider = useGraphStore(s => s.chatProvider)
  const chatApiKey = useGraphStore(s => s.chatApiKey)
  const chatEndpointUrl = useGraphStore(s => s.chatEndpointUrl)
  const chatModel = useGraphStore(s => s.chatModel)
  const chatTemperature = useGraphStore(s => s.chatTemperature)
  const chatSystemPrompt = useGraphStore(s => s.chatSystemPrompt)
  const chatContextScope = useGraphStore(s => s.chatContextScope || 'workspace')
  const setChatModel = useGraphStore(s => s.setChatModel)
  const pushChatExchangeLog = useGraphStore(s => s.pushChatExchangeLog)
  const markdownDocumentName = useGraphStore(s => s.markdownDocumentName || null)
  const sourceFiles = useGraphStore(s => s.sourceFiles)
  const docLocationRevision = useGraphStore(s => s.docLocationRevision)

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
  const chatProviderLabel = React.useMemo(
    () => getChatProviderLabel(chatProvider),
    [chatProvider],
  )
  const chatProviderRegion = React.useMemo(
    () => getChatProviderRegionLabel(chatProvider, chatEndpointUrl || CHAT_DEFAULT_ENDPOINT_URL),
    [chatEndpointUrl, chatProvider],
  )
  const chatProviderSummary = React.useMemo(() => {
    const modelLabel = typeof chatModel === 'string' && chatModel.trim() ? chatModel.trim() : 'model pending'
    return `${chatProviderLabel} · ${chatProviderRegion} · ${modelLabel}`
  }, [chatModel, chatProviderLabel, chatProviderRegion])
  const chatProviderHint = React.useMemo(
    () => getChatRecommendedModelHint(chatProvider),
    [chatProvider],
  )
  const sourceFilesSignature = React.useMemo(() => {
    const compact = Array.isArray(sourceFiles)
      ? sourceFiles
        .slice(0, 64)
        .map(file => ({
          id: String(file?.id || ''),
          name: String(file?.name || ''),
          enabled: file?.enabled !== false,
          status: String(file?.status || ''),
          textLength: typeof file?.text === 'string' ? file.text.length : 0,
          parsedTextHash: String(file?.parsedTextHash || ''),
        }))
      : []
    return hashArrayOfObjectsSignature(compact, { maxItems: 64, maxKeysPerItem: 6 })
  }, [sourceFiles])
  const workspaceContextCacheKey = React.useMemo(() => {
    const markdownHead = typeof markdownText === 'string' ? markdownText.slice(0, 180) : ''
    const markdownTail = typeof markdownText === 'string' ? markdownText.slice(-180) : ''
    return hashSignatureParts([
      'chat:workspace-context',
      markdownDocumentName || '',
      docLocationRevision,
      typeof markdownText === 'string' ? markdownText.length : 0,
      markdownHead,
      markdownTail,
      sourceFilesSignature,
    ])
  }, [docLocationRevision, markdownDocumentName, markdownText, sourceFilesSignature])

  const currentNode = React.useMemo(() => {
    if (!graphData || !selectedNodeId) return null
    return graphData.nodes.find(n => n.id === selectedNodeId) || null
  }, [graphData, selectedNodeId])

  React.useEffect(() => {
    if (lastLoadedHistoryKeyRef.current === historyKey) return
    lastLoadedHistoryKeyRef.current = historyKey
    const cached = getCachedChatHistory(historyKey)
    if (cached) {
      setMessages(cached)
      return
    }
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
    const trimmed = next.slice(-80)
    putChatHistoryCache(historyKey, trimmed)
    setMessages(trimmed)
  }, [historyKey])

  React.useEffect(() => {
    const history = messages.slice(-80)
    putChatHistoryCache(historyKey, history)
    const taskKey = toHistoryTaskKey(historyKey)
    const signature = hashSignatureParts([
      historyKey,
      history.length,
      hashArrayOfObjectsSignature(history, { maxItems: 24, maxKeysPerItem: 4 }),
    ])
    scheduleWorkspaceSyncTask(taskKey, () => {
      const storage = getLocalStorage()
      if (!storage) return
      writeJsonToStorage(storage, historyKey, history)
    }, CHAT_HISTORY_COALESCE_DELAY_MS, {
      signature,
      scopeKey: WORKSPACE_SYNC_SCOPE_CHAT_HISTORY_RUNTIME_PERSISTENCE,
    })
  }, [historyKey, messages])

  React.useEffect(() => {
    return () => {
      const taskKey = toHistoryTaskKey(historyKey)
      cancelWorkspaceSyncTask(taskKey)
    }
  }, [historyKey])

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
    if (!chatModel) {
      setErrorText(UI_COPY.chatMissingEndpointAndModelError)
      setConnectivity('unknown')
      setConnectivityDetail(null)
      return
    }
    const requestUrl = resolveChatEndpointForRequest(chatEndpointUrl || CHAT_DEFAULT_ENDPOINT_URL)
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
    const seededHistory = nextMessages.slice(-80)
    putChatHistoryCache(historyKey, seededHistory)
    const seededStorage = getLocalStorage()
    if (seededStorage) {
      writeJsonToStorage(seededStorage, historyKey, seededHistory)
    }
    setMessages(nextMessages)
    setInput('')
    setIsLoading(true)

    try {
      const payloadMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = []

      const includeSelectionContext = chatContextScope === 'selection' || chatContextScope === 'hybrid'
      const includeWorkspaceContext = chatContextScope === 'workspace' || chatContextScope === 'hybrid'

      if (includeSelectionContext) {
        payloadMessages.push({ role: 'system', content: buildBoundedGraphSystemPrompt(graphData, currentNode) })
      }
      if (chatSystemPrompt && typeof chatSystemPrompt === 'string' && chatSystemPrompt.trim()) {
        payloadMessages.push({ role: 'system', content: chatSystemPrompt })
      }

      if (includeSelectionContext) {
        const markdownSnippet = buildMarkdownNodeSnippetPrompt(markdownText, currentNode, parseLine)
        if (markdownSnippet) {
          payloadMessages.push({
            role: 'system',
            content: markdownSnippet,
          })
        }
      }
      if (includeWorkspaceContext) {
        const workspaceContextPrompt = await buildWorkspaceWideContextPrompt({
          markdownDocumentName,
          markdownText,
          sourceFiles,
          cacheKey: workspaceContextCacheKey,
        })
        if (workspaceContextPrompt) {
          payloadMessages.push({
            role: 'system',
            content: workspaceContextPrompt,
          })
        }
      }

      nextMessages
        .filter(m => m.id !== assistantMessageId)
        .forEach(m => payloadMessages.push({ role: m.role, content: m.content }))

      const controller = new AbortController()
      abortRef.current = controller

      const sendChat = async (model: string) => {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...buildChatProxyHeaders({
            provider: chatProvider,
            apiKey: chatApiKey,
            endpointUrl: chatEndpointUrl || CHAT_DEFAULT_ENDPOINT_URL,
            clientRequestId: `kg-chat-${toShortId()}`,
          }),
        }
        return await fetch(requestUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            messages: payloadMessages,
            temperature: clampTemperature(chatTemperature),
            stream: true,
          }),
          signal: controller.signal,
        })
      }

      const providerModelOptions = getChatModelOptions(chatProvider)
      const normalizedProviderModel = normalizeChatModelIdForProvider(chatModel, chatProvider)
      let effectiveModel =
        providerModelOptions.includes(normalizedProviderModel)
          ? normalizedProviderModel
          : getDefaultChatModelForProvider(chatProvider)
      let res: Response
      try {
        res = await sendChat(effectiveModel)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error || '')
        if (!/aborted/i.test(message) || controller.signal.aborted) {
          throw error
        }
        res = await sendChat(effectiveModel)
      }
      if (!res.ok) {
        const initialDetail = await parseErrorBody(res)
        const allowFallback = shouldRetryWithModelFallback(res.status, initialDetail)
        if (allowFallback) {
          const modelsEndpoint = resolveChatEndpointForModels(chatEndpointUrl || CHAT_DEFAULT_ENDPOINT_URL)
          const ids = modelsEndpoint
            ? await loadAvailableModelIds(
              modelsEndpoint,
              buildChatProxyHeaders({
                provider: chatProvider,
                apiKey: chatApiKey,
                endpointUrl: chatEndpointUrl || CHAT_DEFAULT_ENDPOINT_URL,
                clientRequestId: `kg-chat-models-${toShortId()}`,
              }),
            )
            : []
          const preferredFallback = providerModelOptions.find(id => ids.includes(id) && id !== effectiveModel) || ''
          const fallback = preferredFallback || ids.find(id => id !== effectiveModel) || ids[0] || ''
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
          const nowMs = Date.now()
          pushChatExchangeLog({
            request: trimmed,
            response: UI_COPY.chatResponseMissingContentError,
            status: 'error',
            model: effectiveModel,
            tsMs: nowMs,
          })
          void persistChatExchangeLog({
            request: trimmed,
            response: UI_COPY.chatResponseMissingContentError,
            status: 'error',
            model: effectiveModel,
            timestampMs: nowMs,
          })
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
          const nowMs = Date.now()
          pushChatExchangeLog({
            request: trimmed,
            response: UI_COPY.chatResponseMissingContentError,
            status: 'error',
            model: effectiveModel,
            tsMs: nowMs,
          })
          void persistChatExchangeLog({
            request: trimmed,
            response: UI_COPY.chatResponseMissingContentError,
            status: 'error',
            model: effectiveModel,
            timestampMs: nowMs,
          })
          setIsLoading(false)
          abortRef.current = null
          return
        }
        setMessages(prev => prev.map(m => (m.id === assistantMessageId ? { ...m, content: assistantText } : m)))
        const nowMs = Date.now()
        pushChatExchangeLog({
          request: trimmed,
          response: assistantText,
          status: 'ok',
          model: effectiveModel,
          tsMs: nowMs,
        })
        void persistChatExchangeLog({
          request: trimmed,
          response: assistantText,
          status: 'ok',
          model: effectiveModel,
          timestampMs: nowMs,
        })
      }

      setConnectivity('ok')
      setConnectivityDetail(null)
      setIsLoading(false)
      abortRef.current = null
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err || '')
      if (raw && raw.toLowerCase().includes('aborted')) {
        const nowMs = Date.now()
        pushChatExchangeLog({
          request: trimmed,
          response: raw || 'Request aborted',
          status: 'aborted',
          model: chatModel || null,
          tsMs: nowMs,
        })
        void persistChatExchangeLog({
          request: trimmed,
          response: raw || 'Request aborted',
          status: 'aborted',
          model: chatModel || '',
          timestampMs: nowMs,
        })
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
      const nowMs = Date.now()
      pushChatExchangeLog({
        request: trimmed,
        response: friendly,
        status: 'error',
        model: chatModel || null,
        tsMs: nowMs,
      })
      void persistChatExchangeLog({
        request: trimmed,
        response: friendly,
        status: 'error',
        model: chatModel || '',
        timestampMs: nowMs,
      })
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
        providerSummary={chatProviderSummary}
        providerHint={chatProviderHint}
        uiPanelTextFontClass={uiPanelTextFontClass}
        uiPanelMicroLabelTextSizeClass={uiPanelMicroLabelTextSizeClass}
        isSubmitDisabled={!input.trim() || isLoading || !chatModel}
        onSubmit={handleSubmit}
        onStop={handleStop}
      />
    </div>
  )
}
