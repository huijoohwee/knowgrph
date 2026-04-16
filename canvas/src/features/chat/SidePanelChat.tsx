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
import { CHAT_KGC_RESPONSE_CONTRACT_PROMPT, CHAT_RESPONSE_CONTRACT_PROMPT } from './chatResponseContract'
import { buildPackedContextSystemPrompt, packChatContext } from './chatContextPack'
import { buildResolvableVarKeySet, validateChatMarkdown } from './chatMarkdownValidation'
import { CHAT_AI_MARKDOWN_MAX_RETRY, clampChatCompletionTokens } from './chatAiMarkdownSpec'
import {
  CHAT_DEFAULT_ENDPOINT_URL,
  CHAT_PROVIDER_OPENAI,
  buildChatProxyHeaders,
  getDefaultChatModelForProvider,
  getChatModelOptions,
  getChatProviderLabel,
  getChatProviderRegionLabel,
  getChatRecommendedModelHint,
  normalizeChatEndpointUrlInput,
  normalizeChatModelIdForProvider,
  normalizeChatProviderId,
  resolveChatEndpointForModels,
  resolveChatEndpointForRequest,
} from '@/lib/chatEndpoint'
import {
  appendChatHistoryWorkspaceFile,
  createNewChatHistoryWorkspaceFilePath,
  ensureChatHistoryWorkspaceFilePath,
  isKgcStructuredMarkdown,
  upsertChatHistoryWorkspaceDraft,
} from '@/features/chat/chatHistoryWorkspace'
import { CHAT_LOCAL_STORAGE_ROOT_PATH_DEFAULT } from '@/features/chat/chatStorageConfig'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
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
  extractKgcBlockFromAssistantText,
  persistChatExchangeLog,
  putChatHistoryCache,
  shouldRetryWithModelFallback,
  toHistoryTaskKey,
  toShortId,
} from '@/features/chat/SidePanelChat.helpers'

const MARKDOWN_LAYOUT_REQUEST_EVENT = 'kg:markdown-workspace-layout-request'

const toConciseBulletText = (raw: string, maxWords = 50): string => {
  const cleaned = String(raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/````[\s\S]*?````/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/[#>*_`]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const words = cleaned.split(' ').filter(Boolean)
  if (words.length === 0) return 'No response content.'
  const sliced = words.slice(0, Math.max(1, maxWords))
  const suffix = words.length > sliced.length ? '…' : ''
  return `${sliced.join(' ')}${suffix}`
}

export default function SidePanelChat() {
  const graphData = useGraphStore(s => s.graphData)
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const markdownText = useGraphStore(s => s.markdownDocumentText || null)
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || 'font-sans')
  const uiPanelKeyValueTextSizeClass = useGraphStore(s => s.uiPanelKeyValueTextSizeClass || 'text-sm')
  const uiPanelMicroLabelTextSizeClass = useGraphStore(s => s.uiPanelMicroLabelTextSizeClass || 'text-xs')
  const chatProvider = useGraphStore(s => s.chatProvider)
  const chatAuthMode = useGraphStore(s => (s.chatAuthMode === 'byok' ? 'byok' : 'serverManaged'))
  const chatApiKey = useGraphStore(s => s.chatApiKey)
  const chatEndpointUrl = useGraphStore(s => s.chatEndpointUrl)
  const chatModel = useGraphStore(s => s.chatModel)
  const chatTemperature = useGraphStore(s => s.chatTemperature)
  const chatMaxCompletionTokens = useGraphStore(s => s.chatMaxCompletionTokens)
  const chatGraphSummaryMaxTokens = useGraphStore(s => s.chatGraphSummaryMaxTokens)
  const chatGuidelineDigestMaxTokens = useGraphStore(s => s.chatGuidelineDigestMaxTokens)
  const chatSystemPrompt = useGraphStore(s => s.chatSystemPrompt)
  const chatContextScope = useGraphStore(s => s.chatContextScope || 'workspace')
  const setChatModel = useGraphStore(s => s.setChatModel)
  const pushChatExchangeLog = useGraphStore(s => s.pushChatExchangeLog)
  const chatStorageTarget = useGraphStore(s => (s.chatStorageTarget === 'chatHistory' ? 'chatHistory' : 'chatKnowgrph'))
  const chatLocalStorageRootPath = useGraphStore(s => s.chatLocalStorageRootPath || CHAT_LOCAL_STORAGE_ROOT_PATH_DEFAULT)
  const chatKnowgrphStorageMode = useGraphStore(s => (s.chatKnowgrphStorageMode === 'cloud' ? 'cloud' : 'local'))
  const chatKnowgrphWorkspacePath = useGraphStore(s => s.chatKnowgrphWorkspacePath || null)
  const chatKnowgrphCloudUrl = useGraphStore(s => s.chatKnowgrphCloudUrl || null)
  const setChatKnowgrphWorkspacePath = useGraphStore(s => s.setChatKnowgrphWorkspacePath)
  const chatHistoryWorkspacePath = useGraphStore(s => s.chatHistoryWorkspacePath || null)
  const chatHistoryStorageMode = useGraphStore(s => (s.chatHistoryStorageMode === 'cloud' ? 'cloud' : 'local'))
  const chatHistoryCloudUrl = useGraphStore(s => s.chatHistoryCloudUrl || null)
  const setChatHistoryWorkspacePath = useGraphStore(s => s.setChatHistoryWorkspacePath)
  const setWorkspaceViewMode = useGraphStore(s => s.setWorkspaceViewMode)
  const setEditorWorkspacePane = useGraphStore(s => s.setEditorWorkspacePane)
  const workspaceViewMode = useGraphStore(s => (s.workspaceViewMode === 'editor' ? 'editor' : 'canvas'))
  const editorWorkspacePane = useGraphStore(s => (s.editorWorkspacePane === 'graphTable' ? 'graphTable' : 'markdown'))
  const markdownDocumentName = useGraphStore(s => s.markdownDocumentName || null)
  const sourceFiles = useGraphStore(s => s.sourceFiles)
  const docLocationRevision = useGraphStore(s => s.docLocationRevision)

  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [input, setInput] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)
  const [errorText, setErrorText] = React.useState<string | null>(null)
  const [connectivity, setConnectivity] = React.useState<'unknown' | 'ok' | 'error'>('unknown')
  const [connectivityDetail, setConnectivityDetail] = React.useState<string | null>(null)
  const [streamingAssistant, setStreamingAssistant] = React.useState<{ id: string; text: string } | null>(null)
  const [streamingWorkspacePath, setStreamingWorkspacePath] = React.useState<string | null>(null)

  const abortRef = React.useRef<AbortController | null>(null)
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const scrollRafRef = React.useRef<number | null>(null)
  const lastLoadedHistoryKeyRef = React.useRef<string | null>(null)
  const streamFollowRef = React.useRef<{ path: string; atMs: number } | null>(null)
  const streamDraftTextRef = React.useRef<{ path: string; text: string } | null>(null)
  const streamRevealSeqRef = React.useRef(0)

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

  const chatModelSelect = React.useMemo(() => {
    const normalizedProvider = normalizeChatProviderId(chatProvider)
    const options = Array.from(getChatModelOptions(normalizedProvider))
    const normalizedModel = normalizeChatModelIdForProvider(chatModel, normalizedProvider)
    const fallbackModel = normalizedModel || getDefaultChatModelForProvider(normalizedProvider)
    const selected = fallbackModel || (options[0] || '')
    const combined = options.includes(selected)
      ? options
      : [selected, ...options].filter(Boolean)
    return { modelId: selected, options: combined }
  }, [chatModel, chatProvider])
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

  const clearCurrentHistory = React.useCallback(() => {
    setMessages([])
    putChatHistoryCache(historyKey, [])
    const storage = getLocalStorage()
    if (!storage) return
    try {
      storage.removeItem(historyKey)
    } catch {
      void 0
    }
  }, [historyKey])

  const openWorkspaceMarkdownPath = React.useCallback((path: string) => {
    const normalized = normalizeWorkspacePath(path)
    setWorkspaceViewMode('editor')
    setEditorWorkspacePane('markdown')
    useMarkdownExplorerStore.getState().setActivePath(normalized)
  }, [setEditorWorkspacePane, setWorkspaceViewMode])

  const followWorkspaceMarkdownPath = React.useCallback((path: string) => {
    const normalized = normalizeWorkspacePath(path)
    const nowMs = Date.now()
    const prevFollow = streamFollowRef.current
    const samePath = !!prevFollow && prevFollow.path === normalized
    if (!samePath || workspaceViewMode !== 'editor') setWorkspaceViewMode('editor')
    if (!samePath || editorWorkspacePane !== 'markdown') setEditorWorkspacePane('markdown')
    const explorer = useMarkdownExplorerStore.getState()
    const activePath = String(explorer.activePath || '').trim()
    if (!samePath || activePath !== normalized) explorer.setActivePath(normalized)
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent(MARKDOWN_LAYOUT_REQUEST_EVENT, { detail: { mode: 'split' } }))
      } catch {
        void 0
      }
    }
    if (!samePath || nowMs - prevFollow.atMs >= 180) {
      // Alternate the reveal target line so repeated tail-follow requests always produce a state change.
      streamRevealSeqRef.current = (streamRevealSeqRef.current + 1) % 2
      const tailLine = Number.MAX_SAFE_INTEGER - streamRevealSeqRef.current
      explorer.requestRevealLine(tailLine)
      streamFollowRef.current = { path: normalized, atMs: nowMs }
    }
  }, [editorWorkspacePane, setEditorWorkspacePane, setWorkspaceViewMode, workspaceViewMode])

  const handleNewChat = React.useCallback(async () => {
    if (isLoading || chatStorageTarget !== 'chatKnowgrph') return
    setErrorText(null)
    setConnectivity('unknown')
    setConnectivityDetail(null)
    setInput('')
    setStreamingAssistant(null)
    setStreamingWorkspacePath(null)
    streamFollowRef.current = null
    streamDraftTextRef.current = null
    const timestampMs = Date.now()
    try {
      const nextPath = await createNewChatHistoryWorkspaceFilePath(timestampMs, {
        storageType: 'chatKnowgrph',
        defaultLocalRootPath: chatLocalStorageRootPath,
      })
      setChatKnowgrphWorkspacePath(nextPath)
      clearCurrentHistory()
      followWorkspaceMarkdownPath(nextPath)
    } catch {
      setErrorText(UI_COPY.chatNewChatFailedError)
    }
  }, [
    chatLocalStorageRootPath,
    chatStorageTarget,
    clearCurrentHistory,
    followWorkspaceMarkdownPath,
    isLoading,
    setChatKnowgrphWorkspacePath,
  ])

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
    const history = (() => {
      const base = messages.slice(-80)
      const streamingId = streamingAssistant?.id || ''
      if (!streamingId) return base
      return base.filter(m => !(m.id === streamingId && m.role === 'assistant' && !String(m.content || '').trim()))
    })()
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
  }, [historyKey, messages, streamingAssistant ? streamingAssistant.id : ''])

  React.useEffect(() => {
    return () => {
      const taskKey = toHistoryTaskKey(historyKey)
      cancelWorkspaceSyncTask(taskKey)
    }
  }, [historyKey])

  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const bottomDistancePx = el.scrollHeight - (el.scrollTop + el.clientHeight)
    if (bottomDistancePx > 160) return
    const prev = scrollRafRef.current
    if (typeof prev === 'number') {
      try {
        cancelAnimationFrame(prev)
      } catch {
        void 0
      }
    }
    scrollRafRef.current = requestAnimationFrame(() => {
      try {
        el.scrollTop = el.scrollHeight
      } catch {
        void 0
      }
    })
  }, [messages.length, streamingAssistant ? streamingAssistant.text.length : 0])

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
    return () => {
      const id = scrollRafRef.current
      scrollRafRef.current = null
      if (typeof id !== 'number') return
      try {
        cancelAnimationFrame(id)
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

  const buildValidationFailedUiText = React.useCallback((knowgrphPath: string): string => {
    const normalized = String(knowgrphPath || '').trim()
    const label = normalized ? (normalized.split('/').filter(Boolean).slice(-1)[0] || 'kgc.md') : 'kgc.md'
    const lines = [
      '- Validation failed after 3 correction attempts.',
      '- Saved a canonical fallback KGC document for continued editing.',
    ]
    if (normalized) lines.push(`- [${label}](${normalized})`)
    return lines.join('\n')
  }, [])

  const finalizeAssistantSuccess = React.useCallback(async (
    args: {
      assistantMessageId: string
      requestText: string
      modelId: string
      rawAssistantText: string
      timestampMs: number
      traceId?: string
      knownKnowgrphPath?: string | null
      status?: 'ok' | 'error'
      finalAssistantOverride?: string | null
    },
  ) => {
    const { assistantMessageId, requestText, modelId, rawAssistantText, timestampMs, knownKnowgrphPath } = args
    const status = args.status === 'error' ? 'error' : 'ok'
    const traceId = String(args.traceId || '').trim() || `trace-${timestampMs}-${assistantMessageId}`
    const extracted = chatStorageTarget === 'chatKnowgrph'
      ? extractKgcBlockFromAssistantText(rawAssistantText)
      : { answer: rawAssistantText, kgc: null }
    const validationFailureNote = [
      'Validation failed after retry exhaustion.',
      'Keep the leading KGC document canonical and inspect the chat history trail for the failed attempt context.',
    ].join(' ')
    const assistantTextForKgc = status === 'error'
      ? (extracted.answer || validationFailureNote)
      : (extracted.kgc && isKgcStructuredMarkdown(extracted.kgc))
        ? extracted.kgc
        : (extracted.answer || rawAssistantText)
    let resolvedKnowgrphPath = ''
    resolvedKnowgrphPath = await appendChatHistoryWorkspaceFile({
      storageType: 'chatKnowgrph',
      title: 'Knowledge Graph Canvas Storage',
      traceId,
      requestedPath: knownKnowgrphPath || chatKnowgrphWorkspacePath,
      defaultLocalRootPath: chatLocalStorageRootPath,
      onResolvedPath: p => setChatKnowgrphWorkspacePath(p),
      timestampMs,
      providerSummary: chatProviderSummary,
      userText: requestText,
      assistantText: assistantTextForKgc,
    })
    if (chatKnowgrphStorageMode !== 'local') {
      void chatKnowgrphCloudUrl
    }

    if (chatStorageTarget === 'chatHistory') {
      if (chatHistoryStorageMode === 'local') {
        await appendChatHistoryWorkspaceFile({
          storageType: 'chatHistory',
          title: 'Chat History Storage',
          traceId,
          requestedPath: chatHistoryWorkspacePath,
          defaultLocalRootPath: chatLocalStorageRootPath,
          onResolvedPath: p => setChatHistoryWorkspacePath(p),
          timestampMs,
          providerSummary: chatProviderSummary,
          userText: requestText,
          assistantText: rawAssistantText,
        })
      } else {
        void chatHistoryCloudUrl
      }
    }

    const knowgrphRawPath = String(resolvedKnowgrphPath || chatKnowgrphWorkspacePath || '').trim()
    const knowgrphPath = knowgrphRawPath ? normalizeWorkspacePath(knowgrphRawPath) : ''
    const knowgrphLabel = knowgrphPath ? (knowgrphPath.split('/').filter(Boolean).slice(-1)[0] || 'kgc.md') : ''
    const conciseSource =
      chatStorageTarget === 'chatKnowgrph'
        ? (extracted.answer || 'Structured KGC response saved to workspace.')
        : rawAssistantText
    const concise = toConciseBulletText(conciseSource, knowgrphPath ? 49 : 50)
    const lines = [`- ${concise}`]
    if (chatStorageTarget === 'chatKnowgrph' && knowgrphPath) lines.push(`- [${knowgrphLabel}](${knowgrphPath})`)
    const finalAssistantText = typeof args.finalAssistantOverride === 'string' && args.finalAssistantOverride.trim()
      ? args.finalAssistantOverride
      : lines.join('\n')

    setMessages(prev => {
      let found = false
      const next = prev.map(m => {
        if (m.id !== assistantMessageId) return m
        found = true
        return { ...m, content: finalAssistantText }
      })
      return found ? next : [...next, { id: assistantMessageId, role: 'assistant', content: finalAssistantText }]
    })
    setStreamingAssistant(null)
    streamFollowRef.current = null
    streamDraftTextRef.current = null

    pushChatExchangeLog({
      request: requestText,
      response: finalAssistantText,
      status,
      model: modelId,
      tsMs: timestampMs,
    })
    void persistChatExchangeLog({
      request: requestText,
      response: finalAssistantText,
      status,
      model: modelId,
      timestampMs,
    })

  }, [
    chatHistoryCloudUrl,
    chatHistoryStorageMode,
    chatHistoryWorkspacePath,
    chatKnowgrphCloudUrl,
    chatKnowgrphStorageMode,
    chatKnowgrphWorkspacePath,
    chatLocalStorageRootPath,
    chatProviderSummary,
    chatStorageTarget,
    buildValidationFailedUiText,
    setChatHistoryWorkspacePath,
    setChatKnowgrphWorkspacePath,
    pushChatExchangeLog,
  ])

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
    const requestUrl = resolveChatEndpointForRequest(
      normalizeChatEndpointUrlInput(chatEndpointUrl || CHAT_DEFAULT_ENDPOINT_URL, chatProvider),
    )
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
    const requestTimestampMs = Date.now()
    const traceId = `trace-${requestTimestampMs}-${assistantMessageId}`
    setStreamingAssistant({ id: assistantMessageId, text: '' })
    const nextMessages: ChatMessage[] = [
      ...messages,
      { id: userMessageId, role: 'user', content: trimmed },
      { id: assistantMessageId, role: 'assistant', content: '' },
    ]
    const seededHistory = nextMessages.slice(-80)
    putChatHistoryCache(historyKey, seededHistory)
    setMessages(nextMessages)
    setInput('')
    setIsLoading(true)

    try {
      let liveKgcPath: string | null = null
      if (chatStorageTarget === 'chatKnowgrph') {
        liveKgcPath = await ensureChatHistoryWorkspaceFilePath({
          requestedPath: chatKnowgrphWorkspacePath,
          timestampMs: requestTimestampMs,
          storageType: 'chatKnowgrph',
          defaultLocalRootPath: chatLocalStorageRootPath,
          onResolvedPath: p => setChatKnowgrphWorkspacePath(p),
        })
        setStreamingWorkspacePath(liveKgcPath)
        followWorkspaceMarkdownPath(liveKgcPath)
        await upsertChatHistoryWorkspaceDraft({
          requestedPath: liveKgcPath,
          onResolvedPath: p => setChatKnowgrphWorkspacePath(p),
          timestampMs: requestTimestampMs,
          providerSummary: chatProviderSummary,
          userText: trimmed,
          assistantText: '',
          storageType: 'chatKnowgrph',
          defaultLocalRootPath: chatLocalStorageRootPath,
          title: 'Knowledge Graph Canvas Storage',
          traceId,
        })
      }

      const packedContext = packChatContext({
        graphData,
        currentNode,
        markdownText,
        graphSummaryMaxTokens: chatGraphSummaryMaxTokens,
        guidelineDigestMaxTokens: chatGuidelineDigestMaxTokens,
      })
      const includeSelectionContext = chatContextScope === 'selection' || chatContextScope === 'hybrid'
      const includeWorkspaceContext = chatContextScope === 'workspace' || chatContextScope === 'hybrid'

      const systemMessages: { role: 'system'; content: string }[] = [
        {
          role: 'system',
          content: chatStorageTarget === 'chatKnowgrph' ? CHAT_KGC_RESPONSE_CONTRACT_PROMPT : CHAT_RESPONSE_CONTRACT_PROMPT,
        },
        {
          role: 'system',
          content: buildPackedContextSystemPrompt(packedContext),
        },
      ]

      if (includeSelectionContext) {
        systemMessages.push({ role: 'system', content: buildBoundedGraphSystemPrompt(graphData, currentNode) })
      }
      if (chatSystemPrompt && typeof chatSystemPrompt === 'string' && chatSystemPrompt.trim()) {
        systemMessages.push({ role: 'system', content: chatSystemPrompt })
      }
      if (includeSelectionContext) {
        const markdownSnippet = buildMarkdownNodeSnippetPrompt(markdownText, currentNode, parseLine)
        if (markdownSnippet) systemMessages.push({ role: 'system', content: markdownSnippet })
      }
      if (includeWorkspaceContext) {
        const workspaceContextPrompt = await buildWorkspaceWideContextPrompt({
          markdownDocumentName,
          markdownText,
          sourceFiles,
          cacheKey: workspaceContextCacheKey,
        })
        if (workspaceContextPrompt) systemMessages.push({ role: 'system', content: workspaceContextPrompt })
      }

      const conversationMessages: { role: 'user' | 'assistant'; content: string }[] = nextMessages
        .filter(m => m.id !== assistantMessageId)
        .map(m => ({ role: m.role, content: m.content }))

      const buildPayloadMessages = (correction: string | null) => {
        const out: { role: 'system' | 'user' | 'assistant'; content: string }[] = [...systemMessages]
        if (correction && correction.trim()) out.push({ role: 'system', content: correction })
        out.push(...conversationMessages)
        return out
      }

      const controller = new AbortController()
      abortRef.current = controller

      const resolveTokenLimitKey = (): 'max_tokens' | 'max_completion_tokens' => {
        const provider = normalizeChatProviderId(chatProvider)
        if (provider === CHAT_PROVIDER_OPENAI) return 'max_completion_tokens'
        return 'max_tokens'
      }

      const sendChat = async (
        model: string,
        messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
        tokenLimitKey: 'max_tokens' | 'max_completion_tokens' = resolveTokenLimitKey(),
      ) => {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...buildChatProxyHeaders({
            provider: chatProvider,
            apiKey: chatAuthMode === 'byok' ? chatApiKey : null,
            endpointUrl: chatEndpointUrl || CHAT_DEFAULT_ENDPOINT_URL,
            clientRequestId: `kg-chat-${toShortId()}`,
          }),
        }
        const tokenLimit = clampChatCompletionTokens(chatMaxCompletionTokens)
        return await fetch(requestUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            messages,
            temperature: clampTemperature(chatTemperature),
            ...(tokenLimitKey === 'max_completion_tokens'
              ? { max_completion_tokens: tokenLimit }
              : { max_tokens: tokenLimit }),
            stream: true,
          }),
          signal: controller.signal,
        })
      }

      const wrapFence = (content: string, lang: string): string => {
        const safeLang = String(lang || '').trim() || 'text'
        const safe = String(content || '').replace(/\r\n/g, '\n')
        const ticks = safe.includes('```') ? '````' : '```'
        return [`${ticks}${safeLang}`, safe, ticks].join('\n')
      }

      const clipForPrompt = (raw: string, maxChars: number): string => {
        const text = String(raw || '')
        if (text.length <= maxChars) return text
        return `${text.slice(0, Math.max(0, maxChars - 3))}...`
      }

      const buildCorrectionPrompt = (args: { ruleId: string; message: string; invalidMarkdown: string }) => {
        const block = clipForPrompt(args.invalidMarkdown, 6000)
        return [
          '@flag:correction',
          `failed_rule: ${args.ruleId}`,
          `reason: ${args.message}`,
          '',
          'Return a corrected answer that fully satisfies ALL rules and the strict output format.',
          'Fix only what is necessary; preserve section order and schema.',
          '',
          'Invalid output (for reference; do not repeat verbatim):',
          wrapFence(block, 'markdown'),
        ].join('\n')
      }

      const providerModelOptions = getChatModelOptions(chatProvider)
      const normalizedProviderModel = normalizeChatModelIdForProvider(chatModel, chatProvider)
      let effectiveModel =
        providerModelOptions.includes(normalizedProviderModel)
          ? normalizedProviderModel
          : getDefaultChatModelForProvider(chatProvider)

      const MAX_VALIDATION_ATTEMPTS = chatStorageTarget === 'chatKnowgrph' ? CHAT_AI_MARKDOWN_MAX_RETRY : 1
      let attempt = 0
      let correctionPrompt: string | null = null
      let finalAssistantText = ''
      let finalStatus: 'ok' | 'error' = 'ok'
      let finalOverride: string | null = null

      while (attempt < MAX_VALIDATION_ATTEMPTS) {
        attempt += 1
        const payloadMessages = buildPayloadMessages(correctionPrompt)
        let tokenLimitKey = resolveTokenLimitKey()
        let tokenParamFallbackTried = false
        let res: Response
        try {
          res = await sendChat(effectiveModel, payloadMessages, tokenLimitKey)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error || '')
          const lowered = message.toLowerCase()
          const isRetryable =
            !controller.signal.aborted &&
            (/aborted/i.test(message) || lowered.includes('failed to fetch') || lowered.includes('networkerror') || lowered.includes('err_aborted'))
          if (!isRetryable) throw error
          res = await sendChat(effectiveModel, payloadMessages, tokenLimitKey)
        }
        if (!res.ok) {
          const initialDetail = await parseErrorBody(res)

          const shouldRetryWithTokenFallback = (status: number, detail: string | null): boolean => {
            if (status !== 400) return false
            const text = String(detail || '')
            return (
              text.includes("Unsupported parameter: 'max_tokens'") ||
              text.includes("Unsupported parameter: 'max_completion_tokens'") ||
              text.includes('Use \'max_completion_tokens\' instead') ||
              text.includes('Use "max_completion_tokens" instead')
            )
          }

          if (!tokenParamFallbackTried && shouldRetryWithTokenFallback(res.status, initialDetail)) {
            tokenParamFallbackTried = true
            tokenLimitKey = tokenLimitKey === 'max_tokens' ? 'max_completion_tokens' : 'max_tokens'
            res = await sendChat(effectiveModel, payloadMessages, tokenLimitKey)
          }

          const allowFallback = shouldRetryWithModelFallback(res.status, initialDetail)
          if (allowFallback) {
            const modelsEndpoint = resolveChatEndpointForModels(chatEndpointUrl || CHAT_DEFAULT_ENDPOINT_URL)
            const ids = modelsEndpoint
              ? await loadAvailableModelIds(
                modelsEndpoint,
                buildChatProxyHeaders({
                  provider: chatProvider,
                  apiKey: chatAuthMode === 'byok' ? chatApiKey : null,
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
              res = await sendChat(fallback, payloadMessages, tokenLimitKey)
            }
          }
          if (!res.ok) {
            const detail = initialDetail || (await parseErrorBody(res))
            const statusText = UI_COPY.chatRequestFailedStatus(res.status)
            const decorateServerManagedHint = (rawDetail: string): string => {
              if (res.status !== 500) return rawDetail
              if (chatAuthMode !== 'serverManaged') return rawDetail
              const lowered = String(rawDetail || '').toLowerCase()
              if (lowered.includes('missing openai api key')) {
                return `${rawDetail} (Server-managed Key: set KNOWGRPH_CHAT_PROXY_OPENAI_API_KEY or OPENAI_API_KEY in the hosting environment; for local dev set it in your shell/.env, for Pages set it in the Pages project env and redeploy.)`
              }
              return rawDetail
            }
            const decorated = detail ? decorateServerManagedHint(detail) : ''
            const suffix = decorated ? ` ${decorated}` : ''
            setConnectivity('error')
            setConnectivityDetail(`Chat endpoint returned ${res.status}.`)
            setErrorText(`${statusText}${suffix}`.trim())
            setStreamingAssistant(null)
            setMessages(prev => prev.filter(m => m.id !== assistantMessageId))
            setIsLoading(false)
            abortRef.current = null
            return
          }
        }

        const contentType = String(res.headers.get('content-type') || '').toLowerCase()
        const isEventStream = contentType.includes('text/event-stream')

        let assistantText = ''

        if (isEventStream && res.body) {
          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''
          let done = false
          let lastDraftFlushMs = 0
          let pendingDraftWrite: Promise<unknown> | null = null
          const flushDraft = (force: boolean) => {
            if (chatStorageTarget !== 'chatKnowgrph') return
            if (!liveKgcPath) return
            const nowMs = Date.now()
            if (!force && nowMs - lastDraftFlushMs < 160) return
            const prevDraft = streamDraftTextRef.current
            if (!force && prevDraft && prevDraft.path === liveKgcPath && prevDraft.text === assistantText) return
            lastDraftFlushMs = nowMs
            followWorkspaceMarkdownPath(liveKgcPath)
            streamDraftTextRef.current = { path: liveKgcPath, text: assistantText }
            pendingDraftWrite = upsertChatHistoryWorkspaceDraft({
              requestedPath: liveKgcPath,
              onResolvedPath: p => setChatKnowgrphWorkspacePath(p),
              timestampMs: requestTimestampMs,
              providerSummary: chatProviderSummary,
              userText: trimmed,
              assistantText,
              storageType: 'chatKnowgrph',
              defaultLocalRootPath: chatLocalStorageRootPath,
              title: 'Knowledge Graph Canvas Storage',
              traceId,
            })
              .then(() => {
                followWorkspaceMarkdownPath(liveKgcPath)
              })
              .catch(() => void 0)
          }
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
                flushDraft(false)
              } catch {
                void 0
              }
            }
          }
          flushDraft(true)
          if (pendingDraftWrite) {
            try {
              await pendingDraftWrite
            } catch {
              void 0
            }
          }
        } else {
          const data = (await res.json()) as unknown
          assistantText = extractAssistantDelta(data) || ''
          if (chatStorageTarget === 'chatKnowgrph' && liveKgcPath) {
            try {
              await upsertChatHistoryWorkspaceDraft({
                requestedPath: liveKgcPath,
                onResolvedPath: p => setChatKnowgrphWorkspacePath(p),
                timestampMs: requestTimestampMs,
                providerSummary: chatProviderSummary,
                userText: trimmed,
                assistantText,
                storageType: 'chatKnowgrph',
                defaultLocalRootPath: chatLocalStorageRootPath,
                title: 'Knowledge Graph Canvas Storage',
                traceId,
              })
            } catch {
              void 0
            }
          }
        }

        if (!assistantText) {
          setErrorText(UI_COPY.chatResponseMissingContentError)
          setStreamingAssistant(null)
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

        finalAssistantText = assistantText
        if (chatStorageTarget !== 'chatKnowgrph') break

        const extracted = extractKgcBlockFromAssistantText(assistantText)
        const kgc = typeof extracted.kgc === 'string' ? extracted.kgc.trim() : ''
        if (!kgc) {
          if (attempt < MAX_VALIDATION_ATTEMPTS) {
            correctionPrompt = buildCorrectionPrompt({
              ruleId: 'V-03',
              message: 'Missing required fenced `kgc` block (exactly one) in the response.',
              invalidMarkdown: assistantText,
            })
            continue
          }
          finalStatus = 'error'
          const knowgrphPath = liveKgcPath ? normalizeWorkspacePath(liveKgcPath) : ''
          finalOverride = buildValidationFailedUiText(knowgrphPath)
          setErrorText('Validation failed after 3 correction attempts.')
          break
        }
        if (!isKgcStructuredMarkdown(kgc)) {
          if (attempt < MAX_VALIDATION_ATTEMPTS) {
            correctionPrompt = buildCorrectionPrompt({
              ruleId: 'V-03',
              message: 'The `kgc` block is not a standalone parseable chatKnowgrph document (section order / flow schema invalid).',
              invalidMarkdown: kgc,
            })
            continue
          }
          finalStatus = 'error'
          const knowgrphPath = liveKgcPath ? normalizeWorkspacePath(liveKgcPath) : ''
          finalOverride = buildValidationFailedUiText(knowgrphPath)
          setErrorText('Validation failed after 3 correction attempts.')
          break
        }

        const resolvableVarKeys = buildResolvableVarKeySet({ frontmatter: packedContext.frontmatter, markdown: kgc })
        const validation = validateChatMarkdown({ markdown: kgc, resolvableVarKeys })
        if (validation.ok) break

        const first = validation.errors[0]
        const nextRule = first?.ruleId || 'V-03'
        const nextMsg = first?.message || 'Validation failed.'

        if (attempt < MAX_VALIDATION_ATTEMPTS) {
          correctionPrompt = buildCorrectionPrompt({
            ruleId: nextRule,
            message: nextMsg,
            invalidMarkdown: kgc,
          })
          continue
        }

        finalStatus = 'error'
        const knowgrphPath = liveKgcPath ? normalizeWorkspacePath(liveKgcPath) : ''
        finalOverride = buildValidationFailedUiText(knowgrphPath)
        setErrorText('Validation failed after 3 correction attempts.')
        break
      }

      const nowMs = Date.now()
      await finalizeAssistantSuccess({
        assistantMessageId,
        requestText: trimmed,
        modelId: effectiveModel,
        rawAssistantText: finalAssistantText,
        timestampMs: nowMs,
        traceId,
        knownKnowgrphPath: liveKgcPath,
        status: finalStatus,
        finalAssistantOverride: finalOverride,
      })

      setStreamingWorkspacePath(null)
      streamFollowRef.current = null
      streamDraftTextRef.current = null

      setConnectivity('ok')
      setConnectivityDetail(null)
      setIsLoading(false)
      abortRef.current = null
      setStreamingWorkspacePath(null)
      streamFollowRef.current = null
      streamDraftTextRef.current = null
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err || '')
      if (raw && raw.toLowerCase().includes('aborted')) {
        const nowMs = Date.now()
        setStreamingAssistant(null)
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
        setMessages(prev => prev.filter(m => m.id !== assistantMessageId))
        setConnectivity('unknown')
        setConnectivityDetail(null)
        setIsLoading(false)
        abortRef.current = null
        setStreamingWorkspacePath(null)
        streamFollowRef.current = null
        streamDraftTextRef.current = null
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
      setStreamingAssistant(null)
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
      setStreamingWorkspacePath(null)
      streamFollowRef.current = null
      streamDraftTextRef.current = null
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div ref={scrollRef} className={`${FLOATING_PANEL_SCROLL_CLASSNAME} p-3 space-y-3`}>
        <SidePanelChatMessagesSection
          messages={messages}
          isLoading={isLoading}
          historyKey={historyKey}
          streamingAssistant={streamingAssistant}
          uiPanelTextFontClass={uiPanelTextFontClass}
          uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
          uiPanelMicroLabelTextSizeClass={uiPanelMicroLabelTextSizeClass}
          onOpenWorkspacePath={openWorkspaceMarkdownPath}
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
        modelId={chatModelSelect.modelId}
        modelOptions={chatModelSelect.options}
        onModelChanged={setChatModel}
          writingWorkspaceFileLabel={
            isLoading && chatStorageTarget === 'chatKnowgrph' && streamingWorkspacePath
              ? `Writing to ${(streamingWorkspacePath.split('/').filter(Boolean).slice(-1)[0] || 'kgc.md')}...`
              : null
          }
        uiPanelTextFontClass={uiPanelTextFontClass}
        uiPanelMicroLabelTextSizeClass={uiPanelMicroLabelTextSizeClass}
        isSubmitDisabled={!input.trim() || isLoading || !chatModel}
        onSubmit={handleSubmit}
        onStop={handleStop}
        showNewChatButton={chatStorageTarget === 'chatKnowgrph'}
        isNewChatDisabled={isLoading}
        onNewChat={handleNewChat}
      />
    </div>
  )
}
