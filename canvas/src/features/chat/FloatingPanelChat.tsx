import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_COPY, LS_KEYS } from '@/lib/config'
import { CHAT_INPUT_APPEND_EVENT } from '@/features/canvas/utils'
import { getLocalStorage, lsSetJson, readJsonFromStorage, writeJsonToStorage } from '@/lib/persistence'
import { UI_RESPONSIVE_FLOATING_PANEL_SCROLL_CLASSNAME } from '@/lib/ui/responsiveElementClasses'
import { hashArrayOfObjectsSignature, hashSignatureParts } from '@/lib/hash/signature'
import { cancelWorkspaceSyncTask, scheduleWorkspaceSyncTask } from '@/lib/async/workspaceSyncScheduler'
import { WORKSPACE_SYNC_SCOPE_CHAT_HISTORY_RUNTIME_PERSISTENCE } from '@/lib/async/workspaceSyncKeys'
import type {
  ChatMessage,
  StreamingAssistantState,
} from './FloatingPanelChatSections'
import { FloatingPanelChatFooter, FloatingPanelChatMessagesSection } from './FloatingPanelChatSections'
import { createNewChatHistoryWorkspaceFilePath } from '@/features/chat/chatHistoryWorkspace'
import { CHAT_LOCAL_STORAGE_ROOT_PATH_DEFAULT } from '@/features/chat/chatStorageConfig'
import { ensureChatStreamArtifactBundleInitialized } from '@/features/chat/chatStreamArtifacts'
import { mirrorChatWorkspaceFileToHost } from '@/features/chat/chatWorkspaceMirror'
import { writeWorkspaceFileTextEnsuringFile } from '@/features/chat/chatWorkspaceFsWrite'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import {
  CHAT_DEFAULT_ENDPOINT_URL,
  getChatProviderLabel,
  getChatProviderRegionLabel,
  getChatRecommendedModelHint,
  normalizeChatProviderId,
} from '@/lib/chatEndpoint'
import { parseIntegrationConfigsJson } from '@/features/integrations/config'
import {
  buildHistoryKey,
  CHAT_HISTORY_COALESCE_DELAY_MS,
  getCachedChatHistory,
  persistChatExchangeLog,
  putChatHistoryCache,
  toHistoryTaskKey,
} from '@/features/chat/floatingPanelChat/floatingPanelChatRuntime'
import { useFinalizeAssistantSuccess } from '@/features/chat/floatingPanelChat/useFinalizeAssistantSuccess'
import { useFloatingPanelChatSubmit } from '@/features/chat/floatingPanelChat/useFloatingPanelChatSubmit'
import { shouldRenderFloatingChatApiKeyPrompt } from '@/features/chat/floatingPanelChat/floatingPanelChatApiKeyPrompt'
import { buildStorageChatRelayLogDescriptor } from '@/features/chat/floatingPanelChat/floatingPanelChatRelayDiagnostics'
import {
  readActiveDurableChatStreamRun,
} from '@/features/chat/floatingPanelChat/floatingPanelChatDurableStream'
import { useResumeDurableChatStream } from '@/features/chat/floatingPanelChat/useResumeDurableChatStream'
import { openMarkdownWorkspaceEditorPane } from '@/features/workspace-table/workspaceTableSsot'
import { emitMarkdownLayoutRequest } from '@/lib/markdown-workspace-runtime/markdownWorkspaceRuntime.shared'
import { normalizeMarkdownWorkspaceSelectionPath } from '@/lib/markdown-workspace-runtime/markdownWorkspaceSelectionPath'
import { getCachedGraphLookup } from '@/lib/graph/lookupCache'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'
import { parseChatIngestUrlCommand } from '@/features/chat/chatCommandRegistry'
import {
  clearLocalChatPipelineSurfaceSnapshot,
  publishLocalChatPipelineSurfaceSnapshot,
} from '@/features/agent-ready/browserLocalSurfaceSnapshots'
import {
  fetchKnowgrphStorageChatPolicies,
  fetchKnowgrphStorageChatSession,
  isKnowgrphStorageChatAuthModeAllowed,
  readKnowgrphStorageChatRelayConfig,
  resolveKnowgrphStorageChatPolicy,
  toKnowgrphStorageChatProviderId,
  type KnowgrphStorageChatRelayDecision,
} from '@/lib/storage/knowgrphStorageChatClient'
import type {
  KnowgrphStorageChatPoliciesResponse,
  KnowgrphStorageChatSessionMembership,
  KnowgrphStorageChatSessionResponse,
} from '@/lib/storage/knowgrphStorageSyncContract'
import {
  KTV_ROW_TEXT_SIZE_FALLBACK_CLASS_NAME,
  KTV_STATUS_TEXT_SIZE_CLASS_NAME,
} from 'grph-shared/ui/keyTypeValueRows'
import { resolveSharedChatModelSelect } from '@/features/chat/chatModelCredentialResolver'
import { useFloatingPanelChatSurfaceModel } from '@/features/chat/floatingPanelChat/useFloatingPanelChatSurfaceModel'
import { stopFloatingPanelChatStream } from '@/features/chat/floatingPanelChat/floatingPanelChatStop'
export default function FloatingPanelChat() {
  const graphData = useGraphStore(s => s.graphData)
  const graphDataRevision = useGraphStore(s => s.graphDataRevision || 0)
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const markdownText = useGraphStore(s => s.markdownDocumentText || null)
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || 'font-sans')
  const uiPanelKeyValueTextSizeClass = useGraphStore(s => s.uiPanelKeyValueTextSizeClass || KTV_ROW_TEXT_SIZE_FALLBACK_CLASS_NAME)
  const uiPanelMicroLabelTextSizeClass = useGraphStore(s => s.uiPanelMicroLabelTextSizeClass || KTV_STATUS_TEXT_SIZE_CLASS_NAME)

  const chatProvider = useGraphStore(s => s.chatProvider)
  const chatAuthMode = useGraphStore(s => (s.chatAuthMode === 'byok' ? 'byok' : 'serverManaged'))
  const chatApiKey = useGraphStore(s => s.chatApiKey)
  const setChatApiKey = useGraphStore(s => s.setChatApiKey)
  const chatEndpointUrl = useGraphStore(s => s.chatEndpointUrl)
  const chatModel = useGraphStore(s => s.chatModel)
  const chatTemperature = useGraphStore(s => s.chatTemperature)
  const chatMaxCompletionTokens = useGraphStore(s => s.chatMaxCompletionTokens)
  const chatServiceTier = useGraphStore(s => s.chatServiceTier)
  const chatStream = useGraphStore(s => s.chatStream)
  const chatMessagesJson = useGraphStore(s => s.chatMessagesJson)
  const chatReasoningEffort = useGraphStore(s => s.chatReasoningEffort)
  const chatThinkingType = useGraphStore(s => s.chatThinkingType)
  const chatThinkingJson = useGraphStore(s => s.chatThinkingJson)
  const chatFrequencyPenalty = useGraphStore(s => s.chatFrequencyPenalty)
  const chatPresencePenalty = useGraphStore(s => s.chatPresencePenalty)
  const chatTopP = useGraphStore(s => s.chatTopP)
  const chatLogprobs = useGraphStore(s => s.chatLogprobs)
  const chatTopLogprobs = useGraphStore(s => s.chatTopLogprobs)
  const chatParallelToolCalls = useGraphStore(s => s.chatParallelToolCalls)
  const chatStopJson = useGraphStore(s => s.chatStopJson)
  const chatStreamOptionsJson = useGraphStore(s => s.chatStreamOptionsJson)
  const chatResponseFormatJson = useGraphStore(s => s.chatResponseFormatJson)
  const chatLogitBiasJson = useGraphStore(s => s.chatLogitBiasJson)
  const chatToolsJson = useGraphStore(s => s.chatToolsJson)
  const chatToolChoiceJson = useGraphStore(s => s.chatToolChoiceJson)
  const chatGraphSummaryMaxTokens = useGraphStore(s => s.chatGraphSummaryMaxTokens)
  const chatGuidelineDigestMaxTokens = useGraphStore(s => s.chatGuidelineDigestMaxTokens)
  const chatSystemPrompt = useGraphStore(s => s.chatSystemPrompt)
  const chatContextScope = useGraphStore(s => s.chatContextScope || 'hybrid')
  const setChatModel = useGraphStore(s => s.setChatModel)
  const pushChatExchangeLog = useGraphStore(s => s.pushChatExchangeLog)
  const pushUiLog = useGraphStore(s => s.pushUiLog)
  const requestHistorySubTab = useGraphStore(s => s.requestHistorySubTab)
  const setBottomSurfaceCollapsed = useGraphStore(s => s.setBottomSurfaceCollapsed)
  const setBottomSurfaceTab = useGraphStore(s => s.setBottomSurfaceTab)
  const pushUiToast = useGraphStore(s => s.pushUiToast)

  const chatStorageTarget = useGraphStore(s => (s.chatStorageTarget === 'chatHistory' ? 'chatHistory' : 'chatKnowgrph'))
  const chatLocalStorageRootPath = useGraphStore(s => s.chatLocalStorageRootPath || CHAT_LOCAL_STORAGE_ROOT_PATH_DEFAULT)
  const chatKnowgrphWorkspacePath = useGraphStore(s => s.chatKnowgrphWorkspacePath || null)
  const chatKnowgrphCloudUrl = useGraphStore(s => s.chatKnowgrphCloudUrl || null)
  const setChatKnowgrphWorkspacePath = useGraphStore(s => s.setChatKnowgrphWorkspacePath)
  const setChatWorkspaceStreamingState = useGraphStore(s => s.setChatWorkspaceStreamingState)
  const chatHistoryWorkspacePath = useGraphStore(s => s.chatHistoryWorkspacePath || null)
  const chatHistoryCloudUrl = useGraphStore(s => s.chatHistoryCloudUrl || null)
  const setChatHistoryWorkspacePath = useGraphStore(s => s.setChatHistoryWorkspacePath)
  const workspaceViewMode = useGraphStore(s => (s.workspaceViewMode === 'editor' ? 'editor' : 'canvas'))
  const editorWorkspacePane = useGraphStore(s => s.editorWorkspacePane)
  const markdownDocumentName = useGraphStore(s => s.markdownDocumentName || null)
  const sourceFiles = useGraphStore(s => s.sourceFiles)
  const docLocationRevision = useGraphStore(s => s.docLocationRevision)
  const integrationConfigsJson = useGraphStore(s => s.integrationConfigsJson)
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [input, setInput] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)
  const [errorText, setErrorText] = React.useState<string | null>(null)
  const [connectivity, setConnectivity] = React.useState<'unknown' | 'ok' | 'error'>('unknown')
  const [connectivityDetail, setConnectivityDetail] = React.useState<string | null>(null)
  const [streamingAssistant, setStreamingAssistant] = React.useState<StreamingAssistantState | null>(null)
  const [streamingInsights, setStreamingInsights] = React.useState<{
    reasoningPreview: string | null
    reasoningStepCount: number
    usageSummary: string | null
    finishReason: string | null
    modelId: string | null
  } | null>(null)
  const [streamingWorkspacePath, setStreamingWorkspacePath] = React.useState<string | null>(null)

  const abortRef = React.useRef<AbortController | null>(null)
  const scrollRef = React.useRef<HTMLElement | null>(null)
  const scrollRafRef = React.useRef<number | null>(null)
  const lastLoadedHistoryKeyRef = React.useRef<string | null>(null)
  const streamFollowRef = React.useRef<{ path: string; atMs: number } | null>(null)
  const streamDraftTextRef = React.useRef<{ path: string; text: string } | null>(null)
  const lastRelayLogSignatureRef = React.useRef<string | null>(null)
  const storageChatRelayConfig = React.useMemo(() => readKnowgrphStorageChatRelayConfig(), [])
  const [storageChatSession, setStorageChatSession] = React.useState<KnowgrphStorageChatSessionResponse | null>(null)
  const [storageChatPolicies, setStorageChatPolicies] = React.useState<KnowgrphStorageChatPoliciesResponse | null>(null)
  const [storageChatRelayBootstrap, setStorageChatRelayBootstrap] = React.useState<{
    status: 'disabled' | 'loading' | 'ready' | 'blocked'
    detail: string | null
  }>({
    status: storageChatRelayConfig ? 'loading' : 'disabled',
    detail: storageChatRelayConfig ? 'Checking workspace relay policy...' : null,
  })
  React.useEffect(() => {
    if (isLoading) return
    setChatWorkspaceStreamingState(null)
    setStreamingInsights(null)
    setStreamingWorkspacePath(null)
  }, [isLoading, setChatWorkspaceStreamingState])
  const streamRevealSeqRef = React.useRef(0)

  React.useEffect(() => {
    if (!storageChatRelayConfig) {
      setStorageChatSession(null)
      setStorageChatPolicies(null)
      setStorageChatRelayBootstrap({ status: 'disabled', detail: null })
      return
    }
    let cancelled = false
    setStorageChatRelayBootstrap({
      status: 'loading',
      detail: 'Checking workspace relay policy...',
    })
    setStorageChatSession(null)
    setStorageChatPolicies(null)
    void (async () => {
      try {
        const session = await fetchKnowgrphStorageChatSession({ config: storageChatRelayConfig })
        if (cancelled) return
        const membership = session.memberships.find(entry => entry.workspaceId === storageChatRelayConfig.workspaceId)
        if (!membership) {
          setStorageChatRelayBootstrap({
            status: 'blocked',
            detail: 'Workspace relay session is not a member of the configured storage workspace.',
          })
          return
        }
        const policies = await fetchKnowgrphStorageChatPolicies({ config: storageChatRelayConfig })
        if (cancelled) return
        setStorageChatSession(session)
        setStorageChatPolicies(policies)
        setStorageChatRelayBootstrap({
          status: 'ready',
          detail: 'Workspace relay policy loaded.',
        })
      } catch (error) {
        if (cancelled) return
        setStorageChatRelayBootstrap({
          status: 'blocked',
          detail: error instanceof Error ? error.message : 'Storage chat relay bootstrap failed.',
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [storageChatRelayConfig])

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
  const chatProviderHint = React.useMemo(() => getChatRecommendedModelHint(chatProvider), [chatProvider])
  const pixverseVideoConfig = React.useMemo(() => parseIntegrationConfigsJson(integrationConfigsJson).pixverseVideo, [integrationConfigsJson])
  const chatProviderHintWithPixVerse = React.useMemo(() => {
    const pixverseHint = pixverseVideoConfig.enabled
      ? `PixVerse ${String(pixverseVideoConfig.strategy || 'auto')} is armed for rich-media runs.`
      : ''
    if (chatProviderHint && pixverseHint) return `${chatProviderHint} ${pixverseHint}`
    return pixverseHint || chatProviderHint
  }, [chatProviderHint, pixverseVideoConfig.enabled, pixverseVideoConfig.strategy])
  const storageChatProviderId = React.useMemo(
    () => toKnowgrphStorageChatProviderId(chatProvider),
    [chatProvider],
  )
  const storageChatMembership = React.useMemo<KnowgrphStorageChatSessionMembership | null>(() => {
    if (!storageChatRelayConfig || !storageChatSession) return null
    return storageChatSession.memberships.find(entry => entry.workspaceId === storageChatRelayConfig.workspaceId) || null
  }, [storageChatRelayConfig, storageChatSession])
  const storageChatPolicy = React.useMemo(() => {
    if (!storageChatRelayConfig || !storageChatProviderId || !storageChatPolicies) return null
    return resolveKnowgrphStorageChatPolicy({
      workspaceId: storageChatRelayConfig.workspaceId,
      providerId: storageChatProviderId,
      policies: storageChatPolicies.policies,
    })
  }, [storageChatPolicies, storageChatProviderId, storageChatRelayConfig])
  const storageChatRelayDecision = React.useMemo<KnowgrphStorageChatRelayDecision>(() => {
    if (!storageChatRelayConfig) return { kind: 'disabled' }
    if (!storageChatProviderId) return { kind: 'disabled' }
    if (storageChatRelayBootstrap.status === 'loading') {
      return {
        kind: 'loading',
        detail: storageChatRelayBootstrap.detail || 'Checking workspace relay policy...',
      }
    }
    if (storageChatRelayBootstrap.status === 'blocked') {
      return {
        kind: 'blocked',
        detail: storageChatRelayBootstrap.detail || 'Storage chat relay is unavailable.',
        policy: storageChatPolicy,
      }
    }
    if (!storageChatMembership) {
      return {
        kind: 'blocked',
        detail: 'Workspace relay session is not a member of the configured storage workspace.',
        policy: storageChatPolicy,
      }
    }
    if (!storageChatPolicy) {
      return {
        kind: 'blocked',
        detail: 'Workspace relay policy is unavailable for the selected provider.',
        policy: null,
      }
    }
    if (!isKnowgrphStorageChatAuthModeAllowed(storageChatPolicy, chatAuthMode)) {
      return {
        kind: 'blocked',
        detail: chatAuthMode === 'byok'
          ? `${chatProviderLabel} BYOK relay is not enabled for this workspace.`
          : `${chatProviderLabel} server-managed relay is not enabled for this workspace.`,
        policy: storageChatPolicy,
      }
    }
    return {
      kind: 'ready',
      detail: `${chatProviderLabel} workspace relay is ready.`,
      config: storageChatRelayConfig,
      membership: storageChatMembership,
      policy: storageChatPolicy,
    }
  }, [
    chatAuthMode,
    chatProviderLabel,
    storageChatMembership,
    storageChatPolicy,
    storageChatProviderId,
    storageChatRelayBootstrap.detail,
    storageChatRelayBootstrap.status,
    storageChatRelayConfig,
  ])
  const visibleRelayStatus = React.useMemo<{
    tone: 'info' | 'ok' | 'error'
    detail: string
  } | null>(() => {
    if (storageChatRelayDecision.kind === 'disabled') return null
    if (!storageChatRelayDecision.detail) return null
    if (storageChatRelayDecision.kind === 'ready') {
      return {
        tone: 'ok',
        detail: storageChatRelayDecision.detail,
      }
    }
    if (storageChatRelayDecision.kind === 'blocked') {
      return {
        tone: 'error',
        detail: storageChatRelayDecision.detail,
      }
    }
    return {
      tone: 'info',
      detail: storageChatRelayDecision.detail,
    }
  }, [storageChatRelayDecision])
  const visibleRelaySummary = React.useMemo<string | null>(() => {
    if (storageChatRelayDecision.kind === 'disabled') return null
    const parts: string[] = []
    const workspaceId = String(storageChatRelayConfig?.workspaceId || '').trim()
    if (workspaceId) parts.push(`Workspace ${workspaceId}`)
    if (storageChatRelayDecision.kind === 'ready') {
      parts.push(`Role ${storageChatRelayDecision.membership.role}`)
      parts.push(`Auth ${chatAuthMode === 'byok' ? 'BYOK' : 'server-managed'}`)
      if (storageChatRelayDecision.policy.defaultModel) {
        parts.push(`Default model ${storageChatRelayDecision.policy.defaultModel}`)
      }
      return parts.join(' · ')
    }
    if (chatAuthMode === 'byok' || chatAuthMode === 'serverManaged') {
      parts.push(`Requested auth ${chatAuthMode === 'byok' ? 'BYOK' : 'server-managed'}`)
    }
    if (storageChatPolicy?.defaultModel) {
      parts.push(`Default model ${storageChatPolicy.defaultModel}`)
    }
    return parts.length > 0 ? parts.join(' · ') : null
  }, [chatAuthMode, storageChatPolicy, storageChatRelayConfig, storageChatRelayDecision])
  const openRelayLogView = React.useCallback(() => {
    try {
      setBottomSurfaceCollapsed(false)
    } catch {
      void 0
    }
    try {
      setBottomSurfaceTab('history')
    } catch {
      void 0
    }
    try {
      requestHistorySubTab('log')
    } catch {
      void 0
    }
  }, [requestHistorySubTab, setBottomSurfaceCollapsed, setBottomSurfaceTab])
  React.useEffect(() => {
    const relayLogDescriptor = buildStorageChatRelayLogDescriptor({
      relayDecision: storageChatRelayDecision,
      workspaceId: storageChatRelayConfig?.workspaceId || null,
      providerLabel: chatProviderLabel,
      authMode: chatAuthMode,
      policy: storageChatPolicy,
    })
    if (!relayLogDescriptor) {
      lastRelayLogSignatureRef.current = null
      return
    }
    if (lastRelayLogSignatureRef.current === relayLogDescriptor.signature) return
    lastRelayLogSignatureRef.current = relayLogDescriptor.signature
    pushUiLog(relayLogDescriptor.entry)
  }, [
    chatAuthMode,
    chatProviderLabel,
    pushUiLog,
    storageChatPolicy,
    storageChatRelayConfig,
    storageChatRelayDecision,
  ])
  const shouldShowChatApiKeyPrompt = shouldRenderFloatingChatApiKeyPrompt({ chatAuthMode, chatProvider })

  React.useEffect(() => {
    publishLocalChatPipelineSurfaceSnapshot({
      messageCount: messages.length,
      isLoading,
      errorText,
      connectivity,
      connectivityDetail,
      chatProviderSummary,
      chatProviderHint: chatProviderHintWithPixVerse || null,
      chatContextScope,
      chatStorageTarget,
      chatKnowgrphWorkspacePath,
      chatHistoryWorkspacePath,
      chatKnowgrphCloudUrl,
      chatHistoryCloudUrl,
      workspaceViewMode,
      editorWorkspacePane,
      markdownDocumentName,
      selectedNodeId: selectedNodeId || null,
      streamingAssistant: streamingAssistant
        ? {
            id: String(streamingAssistant.id || ''),
            text: String(streamingAssistant.text || ''),
            reasoningPreview: String(streamingAssistant.reasoningPreview || ''),
            reasoningStepCount: Number(streamingAssistant.reasoningStepCount || 0),
            usageSummary: String(streamingAssistant.usageSummary || ''),
            finishReason: String(streamingAssistant.finishReason || ''),
            modelId: String(streamingAssistant.modelId || ''),
          }
        : null,
      streamingInsights: streamingInsights
        ? {
            reasoningPreview: String(streamingInsights.reasoningPreview || ''),
            reasoningStepCount: Number(streamingInsights.reasoningStepCount || 0),
            usageSummary: String(streamingInsights.usageSummary || ''),
            finishReason: String(streamingInsights.finishReason || ''),
            modelId: String(streamingInsights.modelId || ''),
          }
        : null,
      streamingWorkspacePath,
      streamFollowPath: streamFollowRef.current?.path || null,
      streamDraft: streamDraftTextRef.current
        ? {
            path: String(streamDraftTextRef.current.path || ''),
            text: String(streamDraftTextRef.current.text || ''),
          }
        : null,
    })
    return () => {
      clearLocalChatPipelineSurfaceSnapshot()
    }
  }, [
    chatContextScope,
    chatHistoryCloudUrl,
    chatHistoryWorkspacePath,
    chatKnowgrphCloudUrl,
    chatKnowgrphWorkspacePath,
    chatProviderHintWithPixVerse,
    chatProviderSummary,
    chatStorageTarget,
    connectivity,
    connectivityDetail,
    editorWorkspacePane,
    errorText,
    isLoading,
    markdownDocumentName,
    messages.length,
    selectedNodeId,
    streamingAssistant,
    streamingInsights,
    streamingWorkspacePath,
    workspaceViewMode,
  ])

  const chatModelSelect = React.useMemo(() => {
    return resolveSharedChatModelSelect({ chatModel, chatProvider })
  }, [chatModel, chatProvider])

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
    const normalized = normalizeMarkdownWorkspaceSelectionPath(path as never) || path
    openMarkdownWorkspaceEditorPane(useGraphStore.getState())
    useMarkdownExplorerStore.getState().setActivePath(normalized)
    lsSetJson<'split' | 'editor' | 'viewer'>(LS_KEYS.markdownLayoutMode, 'editor')
    emitMarkdownLayoutRequest('editor')
  }, [])

  const followWorkspaceMarkdownPath = React.useCallback((path: string, options?: { forceReveal?: boolean }) => {
    const normalized = normalizeMarkdownWorkspaceSelectionPath(path as never) || path
    const nowMs = Date.now()
    const prevFollow = streamFollowRef.current
    const samePath = !!prevFollow && prevFollow.path === normalized
    const forceReveal = options?.forceReveal === true
    if (!samePath || workspaceViewMode !== 'editor' || editorWorkspacePane !== 'markdown') {
      openMarkdownWorkspaceEditorPane(useGraphStore.getState())
    }
    const explorer = useMarkdownExplorerStore.getState()
    const activePath = String(explorer.activePath || '').trim()
    if (!samePath || activePath !== normalized) explorer.setActivePath(normalized)
    lsSetJson<'split' | 'editor' | 'viewer'>(LS_KEYS.markdownLayoutMode, 'editor')
    emitMarkdownLayoutRequest('editor')
    if (forceReveal || !samePath || nowMs - prevFollow.atMs >= 180) {
      streamRevealSeqRef.current = (streamRevealSeqRef.current + 1) % 2
      const tailLine = Number.MAX_SAFE_INTEGER - streamRevealSeqRef.current
      explorer.requestRevealLine(tailLine)
      streamFollowRef.current = { path: normalized, atMs: nowMs }
    }
  }, [editorWorkspacePane, workspaceViewMode])

  const stopActiveChatStream = React.useCallback(() => {
    stopFloatingPanelChatStream({
      setIsLoading,
      abortRef,
      setStreamingWorkspacePath,
      setChatWorkspaceStreamingState,
      setStreamingAssistant,
      setStreamingInsights,
      streamFollowRef,
      streamDraftTextRef,
    })
  }, [setChatWorkspaceStreamingState])

  const handleNewChat = React.useCallback(async () => {
    if (chatStorageTarget !== 'chatKnowgrph') return
    if (isLoading) {
      stopActiveChatStream()
      setIsLoading(false)
    }
    setErrorText(null)
    setConnectivity('unknown')
    setConnectivityDetail(null)
    setInput('')
    setStreamingAssistant(null)
    setStreamingInsights(null)
    setStreamingWorkspacePath(null)
    setChatWorkspaceStreamingState(null)
    streamFollowRef.current = null
    streamDraftTextRef.current = null
    const timestampMs = Date.now()
    try {
      const nextPath = await createNewChatHistoryWorkspaceFilePath(timestampMs, {
        storageType: 'chatKnowgrph',
        defaultLocalRootPath: chatLocalStorageRootPath,
      })
      await ensureChatStreamArtifactBundleInitialized({
        workspacePath: nextPath,
        timestampMs,
        defaultLocalRootPath: chatLocalStorageRootPath,
      })
      await writeWorkspaceFileTextEnsuringFile({ path: nextPath, text: '' })
      await mirrorChatWorkspaceFileToHost({ workspacePath: nextPath, text: '' })
      useGraphStore.setState({ workspaceGraphMutationLayoutLockActive: false })
      followWorkspaceMarkdownPath(nextPath, { forceReveal: true })
      setChatKnowgrphWorkspacePath(nextPath)
      clearCurrentHistory()
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
    stopActiveChatStream,
  ])

  const graphLookup = React.useMemo(() => {
    if (!graphData) return null
    const graphSemanticKey = buildScopedGraphSemanticKey('floating-panel-chat-graph', {
      graphData,
      graphRevision: graphDataRevision,
    })
    return getCachedGraphLookup({
      cacheScope: 'floating-panel-chat-graph',
      graphData,
      graphRevision: graphDataRevision,
      graphSemanticKey,
      preferCurrentGraphDataRefs: true,
    })
  }, [graphData, graphDataRevision])

  const currentNode = React.useMemo(() => {
    if (!selectedNodeId) return null
    return graphLookup?.nodeById.get(selectedNodeId) || null
  }, [graphLookup, selectedNodeId])

  const {
    appendPrompt: appendChatPrompt,
    contextItems: chatContextItems,
    pipelineStages: chatPipelineStages,
    quickActions: chatQuickActions,
    workspaceContextCacheKey,
  } = useFloatingPanelChatSurfaceModel({
    chatContextScope, markdownDocumentName, markdownText, docLocationRevision, sourceFiles,
    graphData, workspaceViewMode, chatKnowgrphWorkspacePath, chatHistoryWorkspacePath,
    currentNode, messageCount: messages.length, isLoading, setInput,
  })

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
      if (readActiveDurableChatStreamRun()) return
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

  useResumeDurableChatStream({
    isLoading,
    chatStorageTarget,
    chatProviderSummary,
    chatLocalStorageRootPath,
    chatModelId: chatModelSelect.modelId,
    setIsLoading,
    setErrorText,
    setConnectivity,
    setConnectivityDetail,
    setStreamingAssistant,
    setStreamingInsights,
    setStreamingWorkspacePath,
    setChatWorkspaceStreamingState,
    setChatKnowgrphWorkspacePath,
    setMessages,
    followWorkspaceMarkdownPath,
    finalizeAssistantSuccess,
    abortRef,
    streamFollowRef,
    streamDraftTextRef,
  })

  const handleSubmit = useFloatingPanelChatSubmit({
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
    chatServiceTier,
    chatStream,
    chatMessagesJson,
    chatReasoningEffort,
    chatThinkingType,
    chatThinkingJson,
    chatFrequencyPenalty,
    chatPresencePenalty,
    chatTopP,
    chatLogprobs,
    chatTopLogprobs,
    chatParallelToolCalls,
    chatStopJson,
    chatStreamOptionsJson,
    chatResponseFormatJson,
    chatLogitBiasJson,
    chatToolsJson,
    chatToolChoiceJson,
    chatGraphSummaryMaxTokens,
    chatGuidelineDigestMaxTokens,
    chatSystemPrompt,
    chatContextScope: (chatContextScope === 'selection' || chatContextScope === 'workspace') ? chatContextScope : 'hybrid',
    chatStorageTarget,
    chatLocalStorageRootPath,
    chatKnowgrphWorkspacePath,
    storageChatRelayDecision,
    setChatKnowgrphWorkspacePath,
    setChatWorkspaceStreamingState,
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
    pushUiLog,
    requestHistorySubTab,
    setStreamingInsights,
  })

  const handleSubmitWithCommands = React.useCallback<React.FormEventHandler<HTMLFormElement>>((e) => {
    const cmd = parseChatIngestUrlCommand(input)
    if (!cmd) {
      handleSubmit(e)
      return
    }
    e.preventDefault()
    if (isLoading) return
    const userText = String(input || '').trim()
    if (!userText) return
    setErrorText(null)
    setInput('')
    setMessages(prev => [...prev, { id: `cmd-user-${Date.now().toString(36)}`, role: 'user', content: userText }])
    void (async () => {
      try {
        const { importUrlViaDeerFlowAndApply } = (await import(
          '@/features/markdown-workspace/useWorkspaceFileActions/deerflowUrlImportAction'
        )) as typeof import('@/features/markdown-workspace/useWorkspaceFileActions/deerflowUrlImportAction')
        const result = await importUrlViaDeerFlowAndApply({ urlRaw: cmd.url, pushUiToast })
        const created = result?.createdPaths || []
        const links = created
          .map(path => {
            const name = String(path || '').split('/').filter(Boolean).slice(-1)[0] || String(path || '')
            return name ? `- [${name}](${path})` : ''
          })
          .filter(Boolean)
          .join('\n')
        const assistantText = created.length
          ? `Imported ${created.length} file(s):\n${links}`
          : 'Import finished (no files reported).'
        setMessages(prev => [...prev, { id: `cmd-assistant-${Date.now().toString(36)}`, role: 'assistant', content: assistantText }])
      } catch (err) {
        const message = err && typeof err === 'object' && 'message' in err ? String(err.message || '') : ''
        setMessages(prev => [...prev, { id: `cmd-error-${Date.now().toString(36)}`, role: 'assistant', content: message || 'Import failed.' }])
      }
    })()
  }, [handleSubmit, input, isLoading, pushUiToast])

  return (
    <section className="h-full flex flex-col">
      <section ref={scrollRef} className={`${UI_RESPONSIVE_FLOATING_PANEL_SCROLL_CLASSNAME} p-2 space-y-2`}>
        <FloatingPanelChatMessagesSection
          messages={messages}
          isLoading={isLoading}
          historyKey={historyKey}
          contextItems={chatContextItems}
          pipelineStages={chatPipelineStages}
          onPipelineStageAction={appendChatPrompt}
          uiPanelTextFontClass={uiPanelTextFontClass}
          uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
          uiPanelMicroLabelTextSizeClass={uiPanelMicroLabelTextSizeClass}
          streamingReasoningPreview={streamingInsights?.reasoningPreview || null}
          streamingUsageSummary={streamingInsights?.usageSummary || null}
          streamingFinishReason={streamingInsights?.finishReason || null}
          writingWorkspaceFileLabel={
            isLoading && chatStorageTarget === 'chatKnowgrph' && streamingWorkspacePath
              ? `Writing to ${(streamingWorkspacePath.split('/').filter(Boolean).slice(-1)[0] || 'kgc.md')}...`
              : null
          }
          onOpenWorkspacePath={openWorkspaceMarkdownPath}
          quickActions={messages.length === 0 ? chatQuickActions : []} onQuickAction={appendChatPrompt} setMessages={setMessages}
        />
      </section>

      <FloatingPanelChatFooter
        input={input}
        setInput={setInput}
        isLoading={isLoading}
        errorText={errorText}
        connectivity={connectivity}
        connectivityDetail={connectivityDetail}
        relayStatus={visibleRelayStatus}
        relaySummary={visibleRelaySummary}
        relayAction={visibleRelayStatus || visibleRelaySummary ? { label: 'Open Log', onClick: openRelayLogView } : null}
        apiKeyPrompt={shouldShowChatApiKeyPrompt ? { providerLabel: chatProviderLabel, value: chatApiKey || '', onChange: setChatApiKey } : null}
        currentNode={currentNode}
        modelId={chatModelSelect.modelId}
        modelOptions={chatModelSelect.options}
        onModelChanged={setChatModel}
        uiPanelTextFontClass={uiPanelTextFontClass}
        uiPanelMicroLabelTextSizeClass={uiPanelMicroLabelTextSizeClass}
        isSubmitDisabled={!input.trim() || isLoading || !chatModelSelect.modelId}
        onSubmit={handleSubmitWithCommands}
        onStop={stopActiveChatStream}
        showNewChatButton={chatStorageTarget === 'chatKnowgrph'}
        onNewChat={handleNewChat}
        quickActions={messages.length === 0 ? [] : chatQuickActions}
        onQuickAction={appendChatPrompt}
        markdownText={markdownText}
      />
    </section>
  )
}
