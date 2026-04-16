import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_COPY, LS_KEYS } from '@/lib/config'
import { CHAT_INPUT_APPEND_EVENT } from '@/features/canvas/utils'
import { getLocalStorage, lsSetJson, readJsonFromStorage, writeJsonToStorage } from '@/lib/persistence'
import { FLOATING_PANEL_SCROLL_CLASSNAME } from '@/components/ui/FloatingPanel'
import { hashArrayOfObjectsSignature, hashSignatureParts } from '@/lib/hash/signature'
import { cancelWorkspaceSyncTask, scheduleWorkspaceSyncTask } from '@/lib/async/workspaceSyncScheduler'
import { WORKSPACE_SYNC_SCOPE_CHAT_HISTORY_RUNTIME_PERSISTENCE } from '@/lib/async/workspaceSyncKeys'
import type { ChatMessage } from './SidePanelChatSections'
import { SidePanelChatFooter, SidePanelChatMessagesSection } from './SidePanelChatSections'
import { createNewChatHistoryWorkspaceFilePath } from '@/features/chat/chatHistoryWorkspace'
import { CHAT_LOCAL_STORAGE_ROOT_PATH_DEFAULT } from '@/features/chat/chatStorageConfig'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import {
  CHAT_DEFAULT_ENDPOINT_URL,
  getDefaultChatModelForProvider,
  getChatModelOptions,
  getChatProviderLabel,
  getChatProviderRegionLabel,
  getChatRecommendedModelHint,
  normalizeChatModelIdForProvider,
  normalizeChatProviderId,
} from '@/lib/chatEndpoint'
import {
  buildHistoryKey,
  CHAT_HISTORY_COALESCE_DELAY_MS,
  getCachedChatHistory,
  persistChatExchangeLog,
  putChatHistoryCache,
  toHistoryTaskKey,
} from '@/features/chat/SidePanelChat.helpers'
import { useFinalizeAssistantSuccess } from '@/features/chat/sidePanelChat/useFinalizeAssistantSuccess'
import { useSidePanelChatSubmit } from '@/features/chat/sidePanelChat/useSidePanelChatSubmit'

const MARKDOWN_LAYOUT_REQUEST_EVENT = 'kg:markdown-workspace-layout-request'

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
  const chatKnowgrphWorkspacePath = useGraphStore(s => s.chatKnowgrphWorkspacePath || null)
  const setChatKnowgrphWorkspacePath = useGraphStore(s => s.setChatKnowgrphWorkspacePath)
  const chatHistoryWorkspacePath = useGraphStore(s => s.chatHistoryWorkspacePath || null)
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
    lsSetJson<'split' | 'editor' | 'viewer'>(LS_KEYS.markdownLayoutMode, 'editor')
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent(MARKDOWN_LAYOUT_REQUEST_EVENT, { detail: { mode: 'editor' } }))
      } catch {
        void 0
      }
    }
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
    lsSetJson<'split' | 'editor' | 'viewer'>(LS_KEYS.markdownLayoutMode, 'editor')
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent(MARKDOWN_LAYOUT_REQUEST_EVENT, { detail: { mode: 'editor' } }))
      } catch {
        void 0
      }
    }
    if (!samePath || nowMs - prevFollow.atMs >= 180) {
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

  const finalizeAssistantSuccess = useFinalizeAssistantSuccess({
    chatStorageTarget,
    chatProviderSummary,
    chatKnowgrphWorkspacePath,
    chatHistoryWorkspacePath,
    chatLocalStorageRootPath,
    setChatKnowgrphWorkspacePath,
    setChatHistoryWorkspacePath,
    followWorkspaceMarkdownPath,
    pushChatExchangeLog,
    setMessages,
    setStreamingAssistant,
    streamFollowRef,
    streamDraftTextRef,
  })

  const handleSubmit = useSidePanelChatSubmit({
    historyKey,
    graphData,
    currentNode,
    markdownText,
    markdownDocumentName,
    sourceFiles,
    workspaceContextCacheKey,
    chatProvider,
    chatAuthMode,
    chatApiKey,
    chatEndpointUrl,
    chatModel: chatModelSelect.modelId,
    chatTemperature,
    chatMaxCompletionTokens,
    chatGraphSummaryMaxTokens,
    chatGuidelineDigestMaxTokens,
    chatSystemPrompt,
    chatContextScope: (chatContextScope === 'selection' || chatContextScope === 'hybrid') ? chatContextScope : 'workspace',
    chatStorageTarget,
    chatLocalStorageRootPath,
    chatKnowgrphWorkspacePath,
    setChatKnowgrphWorkspacePath,
    chatProviderSummary,
    setChatModel,
    messages,
    setMessages,
    input,
    setInput,
    isLoading,
    setIsLoading,
    setErrorText,
    setConnectivity,
    setConnectivityDetail,
    setStreamingAssistant,
    setStreamingWorkspacePath,
    abortRef,
    streamDraftTextRef,
    streamFollowRef,
    followWorkspaceMarkdownPath,
    finalizeAssistantSuccess,
    pushChatExchangeLog,
    persistChatExchangeLog,
  })

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
        isSubmitDisabled={!input.trim() || isLoading || !chatModelSelect.modelId}
        onSubmit={handleSubmit}
        onStop={handleStop}
        showNewChatButton={chatStorageTarget === 'chatKnowgrph'}
        isNewChatDisabled={isLoading}
        onNewChat={handleNewChat}
      />
    </div>
  )
}
