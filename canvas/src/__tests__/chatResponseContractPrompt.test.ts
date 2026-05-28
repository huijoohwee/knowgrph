import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import {
  CHAT_BASE_KGC_RESPONSE_CONTRACT_PROMPT,
  CHAT_BASE_RESPONSE_CONTRACT_PROMPT,
  CHAT_RESPONSE_BASE_PARAMETER_KEYS_GENERIC,
} from '@/features/chat/chatResponseBaseContract'
import { buildResolvableVarKeySet, validateChatMarkdown } from '@/features/chat/chatMarkdownValidation'
import { isKgcStructuredMarkdown, normalizeKgcAssistantBodyForStorage } from '@/features/chat/chatHistoryWorkspace'
import { normalizeKgcFrontmatterIdentityToFileName } from '@/features/chat/chatHistoryWorkspace.kgc.normalize'
import { extractKgcBlockFromAssistantText } from '@/features/chat/FloatingPanelChat.helpers'
import {
  resolveChatKnowgrphAttempt,
  resolveKgcCorrectionInvalidMarkdown,
} from '@/features/chat/floatingPanelChat/floatingPanelChatKgcAttempt'
import {
  dismissPendingSubmitAssistant,
  finalizeSubmitTerminalState,
} from '@/features/chat/floatingPanelChat/floatingPanelChatSubmitLifecycle'
import {
  handleSubmitIssueExit,
  resolveSubmitRuntimeFriendlyMessage,
} from '@/features/chat/floatingPanelChat/floatingPanelChatSubmitErrors'
import {
  executeChatSubmitTransportAttempt,
  resolvePreferredFallbackModel,
} from '@/features/chat/floatingPanelChat/floatingPanelChatSubmitTransport'
import type { FloatingPanelChatSubmitArgs } from '@/features/chat/floatingPanelChat/floatingPanelChatSubmitTypes'
import {
  buildChatSubmitPayloadMessages,
  buildChatSubmitRequestContext,
  createChatSubmitRequestSender,
  resolveChatSubmitTokenLimitKey,
  resolveInitialChatSubmitModel,
} from '@/features/chat/floatingPanelChat/floatingPanelChatSubmitRequest'
import {
  bootstrapKnowgrphSubmitDraft,
  initializeChatSubmitOptimisticState,
  resolveChatSubmitRequestUrlOrSetError,
} from '@/features/chat/floatingPanelChat/floatingPanelChatSubmitPreflight'
import {
  CHAT_SUBMIT_PREPARATION_TIMEOUT_ERROR,
  executeFloatingPanelChatSubmitCoordinator,
} from '@/features/chat/floatingPanelChat/floatingPanelChatSubmitCoordinator'
import { useFloatingPanelChatSubmit } from '@/features/chat/floatingPanelChat/useFloatingPanelChatSubmit'
import {
  createChatKnowgrphDraftWriter,
  CHAT_STREAM_FIRST_CHUNK_TIMEOUT_ERROR,
  readAssistantResponseText,
} from '@/features/chat/floatingPanelChat/floatingPanelChatStreaming'
import { useFinalizeAssistantSuccess } from '@/features/chat/floatingPanelChat/useFinalizeAssistantSuccess'
import {
  ensureChatHistoryWorkspaceFilePath,
  toCanonicalKgcWorkspacePath,
  toKgcOutputWorkspacePath,
  toKgcTraceWorkspacePath,
} from '@/features/chat/chatHistoryWorkspace.paths'
import {
  publishLocalChatPipelineSurfaceSnapshot,
  readLocalChatPipelineSurfaceSnapshot,
  resetBrowserLocalSurfaceSnapshotsForTests,
} from '@/features/agent-ready/browserLocalSurfaceSnapshots'
import { inspectLocalChatPipelineState } from '@/features/agent-ready/localChatPipelineStateInspection'
import { tryParseMarkdownFrontmatterFlowGraph } from '@/features/parsers/markdownFrontmatterFlowGraph'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { installDeterministicRaf, mountReactRoot, unmountReactRoot } from '@/tests/lib/reactRootHarness'
import { resetWorkspaceFsForTests } from '@/features/workspace-fs/workspaceFs'
import { useGraphStore } from '@/hooks/useGraphStore'

const readComputingFlowSample = (): string => {
  const p = resolve(process.cwd(), '..', '..', 'sandbox', 'test-data', 'markdown-syntax-computing-flow-sample.md')
  return readFileSync(p, 'utf8')
}

const readBaseTemplateSample = (): string => {
  const candidates = [
    resolve(process.cwd(), '..', '..', 'huijoohwee.github.io', 'docs', 'kgc-ai-pipeline-chat-response-base-template.md'),
    resolve(process.cwd(), '..', '..', 'huijoohwee.github.io', 'template', 'kgc-ai-pipeline-chat-response-base-template.md'),
  ]
  const p = candidates.find(candidate => existsSync(candidate)) || candidates[0]!
  return readFileSync(p, 'utf8')
}

const buildSubmitArgsFixture = (overrides: Partial<FloatingPanelChatSubmitArgs> = {}): FloatingPanelChatSubmitArgs => ({
  historyKey: 'history-key',
  graphData: null,
  currentNode: null,
  markdownText: null,
  markdownDocumentName: null,
  sourceFiles: [],
  workspaceContextCacheKey: 'workspace-cache',
  chatProvider: 'openai',
  chatAuthMode: 'serverManaged',
  chatApiKey: null,
  chatEndpointUrl: 'https://chat.example.test/v1/chat/completions',
  chatModel: 'gpt-4.1-mini',
  chatTemperature: 0.3,
  chatMaxCompletionTokens: 128,
  chatServiceTier: null,
  chatStream: true,
  chatMessagesJson: null,
  chatReasoningEffort: null,
  chatThinkingType: null,
  chatThinkingJson: null,
  chatFrequencyPenalty: null,
  chatPresencePenalty: null,
  chatTopP: null,
  chatLogprobs: null,
  chatTopLogprobs: null,
  chatParallelToolCalls: null,
  chatStopJson: null,
  chatStreamOptionsJson: null,
  chatResponseFormatJson: null,
  chatLogitBiasJson: null,
  chatToolsJson: null,
  chatToolChoiceJson: null,
  chatGraphSummaryMaxTokens: null,
  chatGuidelineDigestMaxTokens: null,
  chatSystemPrompt: null,
  chatContextScope: 'workspace',
  chatStorageTarget: 'chatHistory',
  chatLocalStorageRootPath: '/workspace',
  chatKnowgrphWorkspacePath: null,
  setChatKnowgrphWorkspacePath: () => {},
  chatProviderSummary: 'openai:gpt-4.1-mini',
  setChatModel: () => {},
  messages: [],
  setMessages: () => {},
  input: '',
  setInput: () => {},
  isLoading: false,
  setIsLoading: () => {},
  setErrorText: () => {},
  setConnectivity: () => {},
  setConnectivityDetail: () => {},
  setStreamingAssistant: () => {},
  setStreamingWorkspacePath: () => {},
  abortRef: { current: null },
  streamDraftTextRef: { current: null },
  streamFollowRef: { current: null },
  followWorkspaceMarkdownPath: () => {},
  finalizeAssistantSuccess: async () => {},
  pushChatExchangeLog: () => {},
  persistChatExchangeLog: async () => {},
  ...overrides,
})

export function testChatResponseContractPromptIncludesMarkdownGuidelineAndSurfaceKeys() {
  const prompt = CHAT_BASE_RESPONSE_CONTRACT_PROMPT

  const requiredSnippets = [
    'markdown syntax guidelines',
    'Flow Editor (2D), Multi-dimensional Table, and Kanban',
    '@edge:src:handle→tgt:handle',
    'ONE fenced yaml block with',
    'root key response:',
    'Tier B keys: product, domain, subject, objective, artifact, owner, version, status.',
    'Table cells: never empty',
    'TBD (unknown) or — (not applicable)',
    'Every streamed paragraph must remain relevant to the active query',
    'never output placeholder or example links',
  ]
  requiredSnippets.forEach(snippet => {
    if (!prompt.includes(snippet)) {
      throw new Error(`Expected chat response contract prompt to include: ${snippet}`)
    }
  })

  CHAT_RESPONSE_BASE_PARAMETER_KEYS_GENERIC.forEach(key => {
    if (!prompt.includes(`\`${key}\``)) {
      throw new Error(`Expected chat response contract prompt to include response key: ${key}`)
    }
  })
}

export function testBuildChatSubmitPayloadMessagesPlacesCorrectionBetweenSystemAndConversation() {
  const payload = buildChatSubmitPayloadMessages({
    systemMessages: [{ role: 'system', content: 'base-system' }],
    conversationMessages: [{ role: 'user', content: 'user-message' }],
    correctionPrompt: 'correction-system',
  })
  if (payload.length !== 3) {
    throw new Error(`Expected payload builder to return three messages, got ${payload.length}`)
  }
  if (payload[1]?.role !== 'system' || payload[1]?.content !== 'correction-system') {
    throw new Error(`Expected correction prompt to be inserted after system messages, got: ${JSON.stringify(payload)}`)
  }
  if (payload[2]?.role !== 'user') {
    throw new Error(`Expected conversation message to remain after correction prompt, got: ${JSON.stringify(payload)}`)
  }
}

export function testResolveInitialChatSubmitModelFallsBackToProviderDefault() {
  const resolved = resolveInitialChatSubmitModel({
    chatProvider: 'openai',
    chatModel: 'nonexistent-model',
  })
  if (!resolved.providerModelOptions.includes(resolved.effectiveModel)) {
    throw new Error(`Expected initial submit model resolver to fall back to a provider-owned default, got: ${JSON.stringify(resolved)}`)
  }
}

export function testResolveChatSubmitTokenLimitKeyUsesOpenAiCompletionTokens() {
  const key = resolveChatSubmitTokenLimitKey('openai')
  if (key !== 'max_completion_tokens') {
    throw new Error(`Expected OpenAI submit token key to use max_completion_tokens, got: ${key}`)
  }
}

export function testResolveChatSubmitRequestUrlOrSetErrorRejectsMissingModel() {
  const errors: Array<string | null> = []
  const connectivity: Array<'unknown' | 'ok' | 'error'> = []
  const connectivityDetail: Array<string | null> = []
  const requestUrl = resolveChatSubmitRequestUrlOrSetError({
    chatModel: null,
    chatEndpointUrl: 'https://chat.example.test/v1/chat/completions',
    chatProvider: 'openai',
    chatAuthMode: 'serverManaged',
    chatApiKey: null,
    setErrorText: value => { errors.push(typeof value === 'function' ? null : value) },
    setConnectivity: value => { connectivity.push(typeof value === 'function' ? 'unknown' : value) },
    setConnectivityDetail: value => { connectivityDetail.push(typeof value === 'function' ? null : value) },
  })
  if (requestUrl !== null) {
    throw new Error(`Expected preflight request-url helper to reject missing model, got: ${requestUrl}`)
  }
  if (!errors[0] || connectivity[0] !== 'unknown' || connectivityDetail[0] !== null) {
    throw new Error(`Expected missing-model preflight to write unknown connectivity and error text, got: ${JSON.stringify({ errors, connectivity, connectivityDetail })}`)
  }
}

export function testResolveChatSubmitRequestUrlOrSetErrorRejectsMissingAgnesByokKey() {
  const errors: Array<string | null> = []
  const connectivity: Array<'unknown' | 'ok' | 'error'> = []
  const connectivityDetail: Array<string | null> = []
  const requestUrl = resolveChatSubmitRequestUrlOrSetError({
    chatModel: 'agnes-2.0-flash',
    chatEndpointUrl: 'https://apihub.agnes-ai.com/v1/chat/completions',
    chatProvider: 'agnes-ai',
    chatAuthMode: 'byok',
    chatApiKey: '',
    setErrorText: value => { errors.push(typeof value === 'function' ? null : value) },
    setConnectivity: value => { connectivity.push(typeof value === 'function' ? 'unknown' : value) },
    setConnectivityDetail: value => { connectivityDetail.push(typeof value === 'function' ? null : value) },
  })
  if (requestUrl !== null) {
    throw new Error(`Expected Agnes BYOK preflight to reject missing API key, got: ${requestUrl}`)
  }
  if (errors[0] !== 'Agnes AI API BYOK requires an API key in Settings.') {
    throw new Error(`Expected Agnes BYOK preflight error text, got: ${JSON.stringify(errors)}`)
  }
  if (connectivity[0] !== 'error' || connectivityDetail[0] !== errors[0]) {
    throw new Error(`Expected Agnes BYOK preflight to set error connectivity, got: ${JSON.stringify({ connectivity, connectivityDetail })}`)
  }
}

export function testInitializeChatSubmitOptimisticStateInsertsPendingAssistantAndCachesHistory() {
  const errorWrites: Array<string | null> = []
  const connectivityDetailWrites: Array<string | null> = []
  const streamingAssistantWrites: Array<{ id: string; text: string } | null> = []
  const messageWrites: ChatMessage[][] = []
  const inputWrites: string[] = []
  const loadingWrites: boolean[] = []
  const result = initializeChatSubmitOptimisticState({
    historyKey: 'history-key',
    trimmedInput: 'Generate KGC',
    messages: [{ id: 'm-0', role: 'assistant', content: 'Previous' }],
    setErrorText: value => { errorWrites.push(typeof value === 'function' ? null : value) },
    setConnectivityDetail: value => { connectivityDetailWrites.push(typeof value === 'function' ? null : value) },
    setStreamingAssistant: value => { streamingAssistantWrites.push(typeof value === 'function' ? null : value) },
    setMessages: value => { messageWrites.push(typeof value === 'function' ? [] : value) },
    setInput: value => { inputWrites.push(typeof value === 'function' ? '' : value) },
    setIsLoading: value => { loadingWrites.push(typeof value === 'function' ? false : value) },
  })
  if (!result.assistantMessageId || !result.traceId.includes(result.assistantMessageId)) {
    throw new Error(`Expected optimistic submit setup to return assistant id and trace id, got: ${JSON.stringify(result)}`)
  }
  if (streamingAssistantWrites.length !== 1 || streamingAssistantWrites[0]?.id !== result.assistantMessageId) {
    throw new Error('Expected optimistic submit setup to create the streaming assistant placeholder')
  }
  if (messageWrites.length !== 1 || messageWrites[0]?.length !== 3) {
    throw new Error(`Expected optimistic submit setup to append user and assistant messages, got: ${JSON.stringify(messageWrites)}`)
  }
  if (errorWrites[0] !== null || connectivityDetailWrites[0] !== null) {
    throw new Error(`Expected optimistic submit setup to clear error text and connectivity detail, got: ${JSON.stringify({ errorWrites, connectivityDetailWrites })}`)
  }
  if (inputWrites[0] !== '' || loadingWrites[0] !== true) {
    throw new Error(`Expected optimistic submit setup to clear input and set loading true, got: ${JSON.stringify({ inputWrites, loadingWrites })}`)
  }
}

export async function testBuildChatSubmitRequestContextBuildsSelectionScopedSystemMessages() {
  const submitArgs = buildSubmitArgsFixture({
    chatStorageTarget: 'chatKnowgrph',
    chatContextScope: 'selection',
    chatSystemPrompt: 'custom-system-prompt',
    markdownText: '---\ntitle: Example\n---\n# Title\nSelected body text',
    currentNode: {
      id: 'node-1',
      label: 'Node 1',
      type: 'text',
      position: { x: 0, y: 0 },
      width: 120,
      height: 60,
      selected: false,
      dragging: false,
      resizing: false,
      data: {},
      properties: {},
      metadata: {},
    },
    graphData: {
      nodes: [],
      edges: [],
      metadata: {},
      type: 'graph',
    },
  })
  const context = await buildChatSubmitRequestContext({
    submitArgs,
    nextMessages: [
      { id: 'assistant-pending', role: 'assistant', content: '' },
      { id: 'user-1', role: 'user', content: 'Generate KGC' },
    ],
    assistantMessageId: 'assistant-pending',
  })
  if (!context.systemMessages.some(message => message.content === 'custom-system-prompt')) {
    throw new Error('Expected request context builder to include the custom system prompt')
  }
  if (!context.systemMessages.some(message => message.content.includes('selected_node'))) {
    throw new Error('Expected request context builder to include packed context system content')
  }
  if (context.conversationMessages.length !== 1 || context.conversationMessages[0]?.content !== 'Generate KGC') {
    throw new Error(`Expected request context builder to exclude the pending assistant placeholder, got: ${JSON.stringify(context.conversationMessages)}`)
  }
}

export async function testCreateChatSubmitRequestSenderBuildsKnowgrphPayloadWithTokenFloor() {
  let captured: { url: string; body: Record<string, unknown>; headers: Record<string, string> } | null = null
  const submitArgs = buildSubmitArgsFixture({
    chatStorageTarget: 'chatKnowgrph',
    chatMaxCompletionTokens: 32,
  })
  const sender = createChatSubmitRequestSender({
    submitArgs,
    requestUrl: 'https://chat.example.test/v1/chat/completions',
    controller: new AbortController(),
    fetchFn: async (input, init) => {
      captured = {
        url: String(input),
        body: JSON.parse(String(init?.body || '{}')) as Record<string, unknown>,
        headers: (init?.headers || {}) as Record<string, string>,
      }
      return new Response('{}', { status: 200 })
    },
  })
  await sender('model-x', [{ role: 'system', content: 'base-system' }], 'max_completion_tokens')
  if (!captured) {
    throw new Error('Expected request sender helper to invoke fetch')
  }
  if (captured.url !== 'https://chat.example.test/v1/chat/completions') {
    throw new Error(`Expected request sender helper to preserve request URL, got: ${captured.url}`)
  }
  if (captured.body.max_completion_tokens !== 4000) {
    throw new Error(`Expected chatKnowgrph request sender to raise completion token floor to 4000, got: ${String(captured.body.max_completion_tokens)}`)
  }
  if (captured.body.stream !== true) {
    throw new Error(`Expected request sender helper to force streaming payloads, got: ${String(captured.body.stream)}`)
  }
}

export async function testBootstrapKnowgrphSubmitDraftSeedsTraceWorkspaceAndEmptyDraft() {
  const streamingWorkspaceWrites: Array<string | null> = []
  const followed: string[] = []
  const resolvedPaths: string[] = []
  const persistedAssistantTexts: string[] = []
  const submitArgs = buildSubmitArgsFixture({
    chatStorageTarget: 'chatKnowgrph',
    chatKnowgrphWorkspacePath: '/workspace/chat/20260522T170000Z/kgc_20260522T170000Z.md',
    setChatKnowgrphWorkspacePath: path => { resolvedPaths.push(path) },
    setStreamingWorkspacePath: value => { streamingWorkspaceWrites.push(typeof value === 'function' ? null : value) },
    followWorkspaceMarkdownPath: path => { followed.push(path) },
  })
  const liveKgcPath = await bootstrapKnowgrphSubmitDraft({
    submitArgs,
    requestTimestampMs: Date.UTC(2026, 4, 22, 17, 0, 0),
    trimmedInput: 'Generate KGC',
    traceId: 'trace-preflight',
    ensureWorkspacePath: async () => '/workspace/chat/20260522T170000Z/kgc_20260522T170000Z.md',
    persistDraft: async payload => {
      persistedAssistantTexts.push(String(payload.assistantText || ''))
    },
  })
  if (liveKgcPath !== '/workspace/chat/20260522T170000Z/kgc_20260522T170000Z.md') {
    throw new Error(`Expected preflight bootstrap to resolve the Knowgrph workspace path, got: ${liveKgcPath}`)
  }
  if (streamingWorkspaceWrites.length !== 1 || !String(streamingWorkspaceWrites[0] || '').includes('kgc-trace_')) {
    throw new Error(`Expected preflight bootstrap to point streaming workspace at the trace path, got: ${JSON.stringify(streamingWorkspaceWrites)}`)
  }
  if (persistedAssistantTexts.length !== 1 || persistedAssistantTexts[0] !== '') {
    throw new Error(`Expected preflight bootstrap to seed one empty assistant draft, got: ${JSON.stringify(persistedAssistantTexts)}`)
  }
  if (followed.length !== 1) {
    throw new Error(`Expected preflight bootstrap to follow the trace workspace exactly once, got: ${followed.length}`)
  }
}

export async function testExecuteFloatingPanelChatSubmitCoordinatorFinalizesSimpleChatHistorySuccess() {
  const finalized: Array<{ modelId: string; rawAssistantText: string }> = []
  const connectivity: Array<'unknown' | 'ok' | 'error'> = []
  const connectivityDetail: Array<string | null> = []
  const terminalResets: string[] = []
  const submitArgs = buildSubmitArgsFixture({
    chatStorageTarget: 'chatHistory',
    finalizeAssistantSuccess: async payload => {
      finalized.push({ modelId: payload.modelId, rawAssistantText: payload.rawAssistantText })
    },
    setConnectivity: value => { connectivity.push(typeof value === 'function' ? 'unknown' : value) },
    setConnectivityDetail: value => { connectivityDetail.push(typeof value === 'function' ? null : value) },
    abortRef: { current: null },
    streamDraftTextRef: { current: null },
    streamFollowRef: { current: null },
  })
  await executeFloatingPanelChatSubmitCoordinator({
    submitArgs,
    requestUrl: 'https://chat.example.test/v1/chat/completions',
    trimmedInput: 'Generate KGC',
    assistantMessageId: 'assistant-pending',
    nextMessages: [{ id: 'user-1', role: 'user', content: 'Generate KGC' }],
    requestTimestampMs: Date.UTC(2026, 4, 22, 18, 0, 0),
    traceId: 'trace-coordinator',
    bootstrapDraft: async () => null,
    buildRequestContext: async () => ({
      packedContext: { selected_node: null, connected_edges: [], frontmatter: null, graph_summary: '', guideline_digest: '' },
      systemMessages: [{ role: 'system', content: 'base-system' }],
      conversationMessages: [{ role: 'user', content: 'Generate KGC' }],
    }),
    createRequestSender: () => async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    resolveInitialModel: () => ({ providerModelOptions: ['model-a'], effectiveModel: 'model-a' }),
    executeTransportAttempt: async args => ({
      response: await args.sendChat('model-a', 'max_completion_tokens'),
      effectiveModel: 'model-a',
      detail: null,
    }),
    createDraftWriter: () => async () => {},
    readAssistantResponse: async () => ({
      assistantText: 'assistant response',
      rawSseEvents: [],
      reasoningSteps: [],
      reasoningPreview: null,
      reasoningStepCount: 0,
      usageSummary: null,
      finishReason: null,
      modelId: 'model-a',
    }),
    finalizeTerminal: () => { terminalResets.push('done') },
  })
  if (finalized.length !== 1 || finalized[0]?.rawAssistantText !== 'assistant response') {
    throw new Error(`Expected coordinator helper to finalize one successful assistant response, got: ${JSON.stringify(finalized)}`)
  }
  if (connectivity[0] !== 'ok' || connectivityDetail[0] !== null) {
    throw new Error(`Expected coordinator helper to mark connectivity ok on success, got: ${JSON.stringify({ connectivity, connectivityDetail })}`)
  }
  if (terminalResets.length !== 1) {
    throw new Error(`Expected coordinator helper to perform one terminal reset on success, got: ${terminalResets.length}`)
  }
}

export async function testExecuteFloatingPanelChatSubmitCoordinatorPublishesValidatedAndAppliedPipelineSnapshots() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null
  const previousFetch = globalThis.fetch
  let finalizeAssistantSuccess: FloatingPanelChatSubmitArgs['finalizeAssistantSuccess'] | null = null
  const connectivity: Array<'unknown' | 'ok' | 'error'> = []
  const connectivityDetail: Array<string | null> = []
  const resolvedKnowgrphPaths: string[] = []
  const followedPaths: string[] = []
  const exchangeLog: Array<{ request: string; response: string; status: 'ok' | 'error' | 'aborted'; model: string | null }> = []

  try {
    resetWorkspaceFsForTests()
    resetBrowserLocalSurfaceSnapshotsForTests()
    useGraphStore.getState().resetAll()
    globalThis.fetch = (async () => ({ ok: true, status: 200, headers: new Headers() } as Response)) as typeof fetch

    publishLocalChatPipelineSurfaceSnapshot({
      messageCount: 1,
      isLoading: true,
      errorText: null,
      connectivity: 'unknown',
      connectivityDetail: null,
      chatProviderSummary: 'openai:gpt-4.1-mini',
      chatProviderHint: null,
      chatContextScope: 'workspace',
      chatStorageTarget: 'chatKnowgrph',
      chatKnowgrphWorkspacePath: '/workspace/chat/20260522T190000Z/kgc_20260522T190000Z.md',
      chatHistoryWorkspacePath: null,
      workspaceViewMode: 'workspace',
      editorWorkspacePane: 'markdown',
      markdownDocumentName: null,
      selectedNodeId: null,
      streamingAssistant: { id: 'assistant-pending', text: 'Streaming...' },
      streamingWorkspacePath: '/workspace/chat/20260522T190000Z/kgc-trace_20260522T190000Z.md',
      streamFollowPath: '/workspace/chat/20260522T190000Z/kgc-trace_20260522T190000Z.md',
      streamDraft: {
        path: '/workspace/chat/20260522T190000Z/kgc-trace_20260522T190000Z.md',
        text: '_Streaming..._',
      },
    })

    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    anyWindow.requestAnimationFrame = installDeterministicRaf(dom.window)
    const container = dom.window.document.createElement('div')
    dom.window.document.body.appendChild(container)
    root = createRoot(container)

    const HookHarness = () => {
      const [messages, setMessages] = React.useState<Array<{ id: string; role: 'user' | 'assistant'; content: string }>>([])
      const [streamingAssistant, setStreamingAssistant] = React.useState<{ id: string; text: string } | null>(null)
      const callback = useFinalizeAssistantSuccess({
        chatStorageTarget: 'chatKnowgrph',
        chatProviderSummary: 'openai:gpt-4.1-mini',
        chatKnowgrphWorkspacePath: '/workspace/chat/20260522T190000Z/kgc_20260522T190000Z.md',
        chatHistoryWorkspacePath: null,
        chatLocalStorageRootPath: '/workspace/chat',
        setChatKnowgrphWorkspacePath: path => { resolvedKnowgrphPaths.push(path) },
        setChatHistoryWorkspacePath: () => {},
        followWorkspaceMarkdownPath: path => { followedPaths.push(path) },
        pushChatExchangeLog: payload => {
          exchangeLog.push({
            request: payload.request,
            response: payload.response,
            status: payload.status,
            model: payload.model,
          })
        },
        setMessages,
        setStreamingAssistant,
        streamFollowRef: { current: { path: '/workspace/chat/20260522T190000Z/kgc-trace_20260522T190000Z.md', atMs: Date.UTC(2026, 4, 22, 19, 0, 0) } },
        streamDraftTextRef: { current: { path: '/workspace/chat/20260522T190000Z/kgc-trace_20260522T190000Z.md', text: '_Streaming..._' } },
      })
      React.useEffect(() => {
        finalizeAssistantSuccess = callback
      }, [callback])
      void messages
      void streamingAssistant
      return null
    }

    await mountReactRoot(root, React.createElement(HookHarness), {
      window: dom.window as unknown as Window,
      frames: 2,
    })

    if (!finalizeAssistantSuccess) {
      throw new Error('Expected finalize hook harness to expose the submit finalize callback')
    }

    const canonical = readBaseTemplateSample().trim()
    const submitArgs = buildSubmitArgsFixture({
      chatStorageTarget: 'chatKnowgrph',
      chatLocalStorageRootPath: '/workspace/chat',
      chatKnowgrphWorkspacePath: '/workspace/chat/20260522T190000Z/kgc_20260522T190000Z.md',
      setChatKnowgrphWorkspacePath: path => { resolvedKnowgrphPaths.push(path) },
      followWorkspaceMarkdownPath: path => { followedPaths.push(path) },
      finalizeAssistantSuccess,
      setConnectivity: value => { connectivity.push(typeof value === 'function' ? 'unknown' : value) },
      setConnectivityDetail: value => { connectivityDetail.push(typeof value === 'function' ? null : value) },
      abortRef: { current: null },
      streamDraftTextRef: { current: { path: '/workspace/chat/20260522T190000Z/kgc-trace_20260522T190000Z.md', text: '_Streaming..._' } },
      streamFollowRef: { current: { path: '/workspace/chat/20260522T190000Z/kgc-trace_20260522T190000Z.md', atMs: Date.UTC(2026, 4, 22, 19, 0, 0) } },
    })

    await executeFloatingPanelChatSubmitCoordinator({
      submitArgs,
      requestUrl: 'https://chat.example.test/v1/chat/completions',
      trimmedInput: 'Generate KGC',
      assistantMessageId: 'assistant-pending',
      nextMessages: [{ id: 'user-1', role: 'user', content: 'Generate KGC' }],
      requestTimestampMs: Date.UTC(2026, 4, 22, 19, 0, 0),
      traceId: 'trace-webmcp-ready',
      bootstrapDraft: async () => '/workspace/chat/20260522T190000Z/kgc_20260522T190000Z.md',
      buildRequestContext: async () => ({
        packedContext: { selected_node: null, connected_edges: [], frontmatter: null, graph_summary: '', guideline_digest: '' },
        systemMessages: [{ role: 'system', content: 'base-system' }],
        conversationMessages: [{ id: 'user-1', role: 'user', content: 'Generate KGC' }],
      }),
      createRequestSender: () => async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
      resolveInitialModel: () => ({ providerModelOptions: ['model-a'], effectiveModel: 'model-a' }),
      executeTransportAttempt: async args => ({
        response: await args.sendChat('model-a', 'max_completion_tokens'),
        effectiveModel: 'model-a',
        detail: null,
      }),
      createDraftWriter: () => async () => {},
      readAssistantResponse: async () => ({
        assistantText: canonical,
        rawSseEvents: [],
        reasoningSteps: [],
        reasoningPreview: null,
        reasoningStepCount: 0,
        usageSummary: null,
        finishReason: 'stop',
        modelId: 'model-a',
      }),
    })

    const chatPipelineSnapshot = readLocalChatPipelineSurfaceSnapshot()
    const inspectedPipeline = inspectLocalChatPipelineState(chatPipelineSnapshot)
    const graphState = useGraphStore.getState()

    if (connectivity[0] !== 'ok' || connectivityDetail[0] !== null) {
      throw new Error(`Expected coordinator helper to mark connectivity ok during validated KGC finalize, got: ${JSON.stringify({ connectivity, connectivityDetail })}`)
    }
    if (inspectedPipeline.kgcValidation.stage !== 'validated' || inspectedPipeline.kgcValidation.hasYamlFrontmatter !== true) {
      throw new Error(`Expected chat pipeline inspection to expose validated YAML-frontmatter KGC state, got: ${JSON.stringify(inspectedPipeline.kgcValidation)}`)
    }
    if (inspectedPipeline.finalize.stage !== 'applied' || inspectedPipeline.finalize.persistedKnowgrphPath !== '/workspace/chat/20260522T190000Z/kgc_20260522T190000Z.md') {
      throw new Error(`Expected chat pipeline inspection to expose applied canonical KGC finalize state, got: ${JSON.stringify(inspectedPipeline.finalize)}`)
    }
    if (!followedPaths.includes('/workspace/chat/20260522T190000Z/kgc_20260522T190000Z.md')) {
      throw new Error(`Expected finalize flow to follow the canonical Knowgrph workspace path, got: ${JSON.stringify(followedPaths)}`)
    }
    if (!resolvedKnowgrphPaths.includes('/workspace/chat/20260522T190000Z/kgc_20260522T190000Z.md')) {
      throw new Error(`Expected finalize flow to resolve the canonical Knowgrph workspace path, got: ${JSON.stringify(resolvedKnowgrphPaths)}`)
    }
    if (!exchangeLog[0]?.response.includes('/workspace/chat/20260522T190000Z/kgc_20260522T190000Z.md')) {
      throw new Error(`Expected finalize flow to log the canonical workspace link in the assistant response, got: ${JSON.stringify(exchangeLog)}`)
    }
    if (
      !String(graphState.markdownDocumentName || '').endsWith('kgc_20260522T190000Z.md') ||
      !String(graphState.markdownDocumentText || '').startsWith('---\n')
    ) {
      throw new Error(`Expected finalize flow to apply the canonical KGC workspace document to the active canvas state, got: ${JSON.stringify({ markdownDocumentName: graphState.markdownDocumentName, markdownDocumentText: graphState.markdownDocumentText?.slice(0, 40) || '' })}`)
    }
  } finally {
    if (root) {
      await unmountReactRoot(root, { window: dom.window as unknown as Window })
    }
    resetWorkspaceFsForTests()
    resetBrowserLocalSurfaceSnapshotsForTests()
    useGraphStore.getState().resetAll()
    globalThis.fetch = previousFetch
    restoreDom()
    restoreWindow()
  }
}

export async function testUseFloatingPanelChatSubmitDelegatesToCoordinatorOnce() {
  const { restore: restoreWindow } = initWindowHarness()
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null
  const coordinatorCalls: Array<{ requestUrl: string; trimmedInput: string; assistantMessageId: string }> = []
  let submitHandler: React.FormEventHandler<HTMLFormElement> | null = null

  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    anyWindow.requestAnimationFrame = installDeterministicRaf(dom.window)
    const container = dom.window.document.createElement('div')
    dom.window.document.body.appendChild(container)
    root = createRoot(container)
    const args = buildSubmitArgsFixture({
      input: '  Generate KGC  ',
      isLoading: false,
    })

    const HookHarness = () => {
      const handler = useFloatingPanelChatSubmit(args, {
        resolveRequestUrlOrSetError: () => 'https://chat.example.test/v1/chat/completions',
        initializeOptimisticState: () => ({
          userMessageId: 'user-1',
          assistantMessageId: 'assistant-1',
          requestTimestampMs: 123,
          traceId: 'trace-1',
          nextMessages: [{ id: 'user-1', role: 'user', content: 'Generate KGC' }],
        }),
        executeCoordinator: async payload => {
          coordinatorCalls.push({
            requestUrl: payload.requestUrl,
            trimmedInput: payload.trimmedInput,
            assistantMessageId: payload.assistantMessageId,
          })
        },
      })
      React.useEffect(() => {
        submitHandler = handler
      }, [handler])
      return null
    }

    await mountReactRoot(root, React.createElement(HookHarness), {
      window: dom.window as unknown as Window,
      frames: 2,
    })

    if (!submitHandler) {
      throw new Error('Expected hook harness to capture the submit handler')
    }

    await act(async () => {
      await submitHandler!({
        preventDefault: () => void 0,
      } as React.FormEvent<HTMLFormElement>)
    })

    if (coordinatorCalls.length !== 1) {
      throw new Error(`Expected submit hook shell to delegate to coordinator exactly once, got: ${coordinatorCalls.length}`)
    }
    if (
      coordinatorCalls[0]?.requestUrl !== 'https://chat.example.test/v1/chat/completions' ||
      coordinatorCalls[0]?.trimmedInput !== 'Generate KGC' ||
      coordinatorCalls[0]?.assistantMessageId !== 'assistant-1'
    ) {
      throw new Error(`Expected submit hook shell to forward canonical coordinator payload, got: ${JSON.stringify(coordinatorCalls[0])}`)
    }
  } finally {
    await unmountReactRoot(root, { window: dom.window as unknown as Window })
    restoreDom()
    restoreWindow()
  }
}

export function testChatResponseContractPromptStaysCompatibleWithComputingFlowSample() {
  const sample = readComputingFlowSample()
  const prompt = CHAT_BASE_RESPONSE_CONTRACT_PROMPT

  const sampleSnippets = ['flow:', '@node:', '@edge:', '{{subject}}', 'TBD']
  sampleSnippets.forEach(snippet => {
    if (!sample.includes(snippet)) {
      throw new Error(`Expected computing-flow sample fixture to include snippet: ${snippet}`)
    }
  })

  const promptSnippets = ['flow blocks', '@node:id', '@edge:src:handle→tgt:handle', 'Tier B sentinel keys', 'TBD (unknown)', 'not applicable']
  promptSnippets.forEach(snippet => {
    if (!prompt.includes(snippet)) {
      throw new Error(`Expected chat response contract prompt to cover sample-compatible token: ${snippet}`)
    }
  })
}

export function testChatKgcResponseContractPromptEnforcesComputingFlowShape() {
  const prompt = CHAT_BASE_KGC_RESPONSE_CONTRACT_PROMPT
  const template = readBaseTemplateSample()

  const requiredPromptSnippets = [
    'Use canonical structure, not canonical wording',
    'schema guidance only',
    'Stream the final document progressively',
    'Every streamed chunk must stay relevant to the active query',
    'Do not widen a narrow request into a stock "PRD + TAD", "monetization pipeline", or similarly prepackaged deliverable',
    'never emit example, placeholder, or fixture URLs',
    'the answer itself must be the KGC document',
    'exactly one standalone KGC document',
    'Do not return prose plus a partial KGC fragment',
    'do not downgrade to a minimal canvas-preset-only document',
    'Do not emit stock labels such as "Request Intent"',
    'graphId, doc_type, date, ai_model, and lang MUST be concrete resolved strings.',
    'title SHOULD resolve when product context is known',
    'Mention stack, payments, geospatial, workflow, or distribution details only when present',
    'pipeline[*].node / flow.nodes[*].id / mermaid: node IDs not in exact sync',
    'flow.subgraphs[*]',
    'flow.subgraphs is the only grouping authoring surface',
    'parser projects flow.subgraphs into kg:subgraphs metadata',
    'Do not add a second grouping registry such as group:, layer:, or clusters: beside flow.subgraphs.',
    'Do not instruct any downstream local graph patch layer to reinterpret the document',
    'Never duplicate headings or restate the same requested subsection twice under different labels',
    'Canvas-preset-only fallback output that omits canonical KGC structural blocks',
    'Parallel grouping channels such as legacy `clusters:` or duplicate group registries beside flow.subgraphs',
    'n-trigger, n-pack, n-process, n-validate, n-deliver',
    'V-07',
    '## Customization Guide',
  ]
  requiredPromptSnippets.forEach(snippet => {
    if (!prompt.includes(snippet)) {
      throw new Error(`Expected KGC response contract prompt to include: ${snippet}`)
    }
  })

  const requiredTemplateSnippets = [
    '$schema: "kgc-pipeline/v1"',
    'runtime:',
    'pipeline:',
    'mermaid: |',
    'flow:',
    '## Customization Guide',
    '@edge:n-validate:correction→n-process:correction',
    '{{runtime.maxRetry}}',
  ]
  requiredTemplateSnippets.forEach(snippet => {
    if (!template.includes(snippet)) {
      throw new Error(`Expected base template fixture to include snippet: ${snippet}`)
    }
  })
}

export function testBaseTemplateFixturePassesKgcStructuredAndValidation() {
  const md = readBaseTemplateSample()
  if (!isKgcStructuredMarkdown(md)) {
    throw new Error('Expected base template fixture to satisfy KGC structured markdown detection')
  }
  const resolvableVarKeys = buildResolvableVarKeySet({ frontmatter: null, markdown: md })
  const validation = validateChatMarkdown({ markdown: md, resolvableVarKeys })
  if (!validation.ok) {
    const first = validation.errors[0]
    throw new Error(`Expected base template fixture to validate, got ${first?.ruleId}: ${first?.message}`)
  }
  const parsed = tryParseMarkdownFrontmatterFlowGraph('kgc-ai-pipeline-chat-response-base-template.md', md)
  if (!parsed) throw new Error('Expected base template fixture to parse as a frontmatter flow graph')
}

export function testKgcDeterministicFallbackIsStructuredAndValid() {
  const requestIntent = 'Solo founder bootstrap GTM with Swipe payment checkout integration'
  const md = normalizeKgcAssistantBodyForStorage({
    timestampMs: Date.UTC(2026, 3, 19, 12, 34, 56),
    requestText: requestIntent,
    assistantText: 'Focus on external adoption, conversion path, and a reusable planning package.',
  })
  if (!md.includes('subject: "solo founder"')) {
    throw new Error('Expected deterministic fallback to infer a neutral subject when it is explicit in the request')
  }
  if (!md.includes('owner: "solo founder"')) {
    throw new Error('Expected deterministic fallback to project explicit owner from the named actor')
  }
  if (!md.includes('bootstrap execution') || !md.includes('Swipe payment') || !md.includes('checkout')) {
    throw new Error('Expected deterministic fallback to derive a normalized query-shaped objective')
  }
  if (!md.includes('Swipe') || !md.includes('solo founder')) {
    throw new Error('Expected deterministic fallback body to stay request-shaped for actor and payment context')
  }
  if (!md.includes('This document packages `{{artifact}}` for `{{subject}}` around the active request.')) {
    throw new Error('Expected deterministic fallback lead to stay artifact-first instead of pipeline-first')
  }
  if (md.includes('This document turns one request into one reusable pipeline artifact.') || md.includes('The canonical five-node pipeline is applied to the current request:')) {
    throw new Error('Expected deterministic fallback to remove pipeline-self-explanatory lead prose')
  }
  const requiredSections = [
    '## Computing Flow Definition',
    '## Flow Graph',
    '## Pipeline',
    '## PRD — Product Requirements',
    '## TAD — Technical Architecture',
    '## Open Questions',
    '## Customization Guide',
    '### Variable Link Map',
    '### Request Snapshot',
  ]
  requiredSections.forEach(section => {
    if (!md.includes(section)) {
      throw new Error(`Expected deterministic fallback to include required section: ${section}`)
    }
  })
  if (md.includes('This section summarizes product requirements implied by the user request.')) {
    throw new Error('Expected deterministic fallback to remove generic PRD summary boilerplate')
  }
  if (md.includes('This section summarizes architecture boundaries and integration points implied by the user request.')) {
    throw new Error('Expected deterministic fallback to remove generic TAD summary boilerplate')
  }
  if (md.includes('Monetization Focus:') || md.includes('Stack: ')) {
    throw new Error('Expected deterministic fallback to avoid legacy canned request-specific labels')
  }
  if (!md.includes('`bg#FAEEDA:status {{status}}` · owner `solo founder`')) {
    throw new Error('Expected deterministic fallback body meta to reflect resolved owner while preserving unresolved status')
  }
  const requiredFrontmatterSnippets = [
    'feedback_arcs:',
    'forward_edges:',
    'subgraphs:',
    'sg-p1',
    'direction:  {key: direction,  type: string,  value: LR}',
    'compute:       {key: compute,       type: function, value: |',
    'click n-trigger  "#pipeline" "S01 · trigger / input"',
    'sandbox:  {key: sandbox,  type: string,  value: "quickjs-emscripten"}',
  ]
  requiredFrontmatterSnippets.forEach(snippet => {
    if (!md.includes(snippet)) {
      throw new Error(`Expected deterministic fallback frontmatter to include: ${snippet}`)
    }
  })
  if (!isKgcStructuredMarkdown(md)) {
    throw new Error('Expected deterministic fallback to satisfy KGC structured markdown detection')
  }
  const resolvableVarKeys = buildResolvableVarKeySet({ frontmatter: null, markdown: md })
  const validation = validateChatMarkdown({ markdown: md, resolvableVarKeys })
  if (!validation.ok) {
    const first = validation.errors[0]
    throw new Error(`Expected deterministic fallback to validate, got ${first?.ruleId}: ${first?.message}`)
  }
  const parsed = tryParseMarkdownFrontmatterFlowGraph('kgc-fallback.md', md)
  if (!parsed) throw new Error('Expected deterministic fallback to parse as a frontmatter flow graph')
}

export function testChatKgcFinalizeAppliesSavedWorkspaceDocumentToCanvas() {
  const finalizeText = readFileSync(resolve(process.cwd(), 'src', 'features', 'chat', 'floatingPanelChat', 'useFinalizeAssistantSuccess.ts'), 'utf8')
  const applyText = readFileSync(resolve(process.cwd(), 'src', 'features', 'chat', 'chatKgcCanvasApply.ts'), 'utf8')
  const requiredFinalizeSnippets = [
    'applyChatKgcWorkspaceDocumentToCanvas',
    'await applyChatKgcWorkspaceDocumentToCanvas(knowgrphPath)',
  ]
  requiredFinalizeSnippets.forEach(snippet => {
    if (!finalizeText.includes(snippet)) throw new Error(`Expected KGC finalize path to include: ${snippet}`)
  })
  const requiredApplySnippets = [
    'shouldApplyImportedCanvasDocumentToGraph',
    'setActiveMarkdownDocument({',
    'applyViewPreset: true',
    'applyToGraph: true',
    'forceApplyToGraph: true',
  ]
  requiredApplySnippets.forEach(snippet => {
    if (!applyText.includes(snippet)) throw new Error(`Expected KGC canvas apply bridge to include: ${snippet}`)
  })
}

export function testKgcIdentityNormalizationEnforcesBaseTemplateScalars() {
  const template = readBaseTemplateSample().replace(/\r\n/g, '\n')
  const mutated = template
    .replace(/title:\s+"{{product}} · AI Pipeline — Chat Response"/, 'title: "Knowledge Graph Canvas · AI Pipeline — Chat Response"')
    .replace(/graphId:\s+"md:{{domain}}-pipeline"/, 'graphId: "md:kgc-20260419180222-pipeline"')
    .replace(/date:\s+"{{date}}"/, 'date: "2026-04-19"')
    .replace('# {{product}} · AI Pipeline', '# Knowledge Graph Canvas · AI Pipeline')
    .replace('owner `{{owner}}` · {{date}}', 'owner `{{owner}}` · 2026-04-19')

  const normalized = normalizeKgcFrontmatterIdentityToFileName({
    markdown: mutated,
    workspacePath: '/chat-log/20260419T180222Z/kgc_20260419T180222Z.md',
    timestampMs: Date.UTC(2026, 3, 19, 18, 2, 22),
  })

  if (!normalized.includes('Knowledge Graph Canvas · AI Pipeline — Chat Response')) {
    throw new Error('Expected normalized KGC title to preserve authored content')
  }
  if (!normalized.includes('md:kgc-20260419180222-pipeline')) {
    throw new Error('Expected normalized KGC graphId to derive from the storage filename')
  }
  if (!normalized.includes('2026-04-19')) {
    throw new Error('Expected normalized KGC date to derive from the storage timestamp')
  }
  if (!normalized.includes('claude-sonnet-4-20250514')) {
    throw new Error('Expected normalized KGC ai_model to preserve the authored model identifier')
  }
  if (!normalized.includes('en-US')) {
    throw new Error('Expected normalized KGC lang to preserve the authored language')
  }
  if (!normalized.includes('kgc_20260419T180222Z.md')) {
    throw new Error('Expected normalized KGC self_ref to match workspace filename')
  }
  if (!normalized.includes('# Knowledge Graph Canvas · AI Pipeline')) {
    throw new Error('Expected normalized body H1 to preserve authored body content')
  }
  if (!normalized.includes('owner `{{owner}}` · 2026-04-19')) {
    throw new Error('Expected normalized body meta line to preserve authored body content')
  }
}

export function testKgcWorkspacePathCanonicalizationMapsTraceAndOutputToCanonical() {
  const tracePath = '/chat-log/20260419T180222Z/kgc-trace_20260419T180222Z.md'
  const outputPath = '/chat-log/20260419T180222Z/kgc-output_20260419T180222Z.svg'

  if (toCanonicalKgcWorkspacePath(tracePath) !== '/chat-log/20260419T180222Z/kgc_20260419T180222Z.md') {
    throw new Error('Expected trace path to canonicalize to the runnable KGC markdown path')
  }
  if (toCanonicalKgcWorkspacePath(outputPath) !== '/chat-log/20260419T180222Z/kgc_20260419T180222Z.md') {
    throw new Error('Expected output companion path to canonicalize back to the runnable KGC markdown path')
  }
  if (toKgcTraceWorkspacePath('/chat-log/20260419T180222Z/kgc_20260419T180222Z.md') !== tracePath) {
    throw new Error('Expected canonical KGC path to derive a matching trace companion path')
  }
  if (toKgcOutputWorkspacePath(tracePath, 'png') !== '/chat-log/20260419T180222Z/kgc-output_20260419T180222Z.png') {
    throw new Error('Expected trace path to derive a matching output companion path')
  }
  if (toKgcOutputWorkspacePath(tracePath, 'html', { variant: 'viewer' }) !== '/chat-log/20260419T180222Z/kgc-output_20260419T180222Z-viewer.html') {
    throw new Error('Expected trace path to derive a stable variant output companion path')
  }

  const normalized = normalizeKgcFrontmatterIdentityToFileName({
    markdown: readBaseTemplateSample(),
    workspacePath: tracePath,
    timestampMs: Date.UTC(2026, 3, 19, 18, 2, 22),
  })
  if (!normalized.includes('kgc_20260419T180222Z.md')) {
    throw new Error('Expected identity normalization to use the canonical KGC filename even when the workspace path points at a trace file')
  }
}

export async function testChatKnowgrphRejectsLegacyDocsWorkspacePath() {
  resetWorkspaceFsForTests()
  const resolved = await ensureChatHistoryWorkspaceFilePath({
    requestedPath: '/docs/20260527T131514Z/kgc_20260527T131514Z.md',
    timestampMs: Date.UTC(2026, 4, 27, 13, 15, 14),
    storageType: 'chatKnowgrph',
    defaultLocalRootPath: '/chat-log',
  })
  if (resolved !== '/chat-log/20260527T131514Z/kgc_20260527T131514Z.md') {
    throw new Error(`expected stale docs KGC path to be ignored in favor of chat-log session path, got ${resolved}`)
  }
}

export function testKgcFallbackWithNonEmptyQueryIsNotByteEqualToCanonicalTemplate() {
  const canonicalTemplate = readBaseTemplateSample().replace(/\r\n/g, '\n').trimEnd()
  const generated = normalizeKgcAssistantBodyForStorage({
    timestampMs: Date.UTC(2026, 3, 19, 20, 14, 10),
    workspacePath: '/chat-log/20260419T201410Z/kgc_20260419T201410Z.md',
    requestText: 'Solo founder bootstrap growth with Swipe checkout and RxDB MapLibre stack',
    assistantText: 'invalid fallback trigger',
  }).replace(/\r\n/g, '\n').trimEnd()

  if (generated === canonicalTemplate) {
    throw new Error('Expected fallback output with non-empty query to differ from canonical template bytes')
  }
}

export function testStructuredKgcIsEnforcedQueryResponsiveBeforePersistence() {
  const canonicalTemplate = readBaseTemplateSample().replace(/\r\n/g, '\n')
  const requestText = 'Solo founder bootstrap growth with Swipe checkout, RxDB, MapLibre, MCP marketplace'
  const generated = normalizeKgcAssistantBodyForStorage({
    timestampMs: Date.UTC(2026, 3, 19, 21, 1, 10),
    workspacePath: '/chat-log/20260419T210110Z/kgc_20260419T210110Z.md',
    requestText,
    assistantText: canonicalTemplate,
  })
  if (!generated.includes('subject: "solo founder"')) {
    throw new Error('Expected structured KGC to resolve an explicit subject from the request')
  }
  if (!generated.includes('domain: "MCP distribution') || !generated.includes('user-action monetization')) {
    throw new Error('Expected structured KGC to resolve a concise domain from the request')
  }
  if (generated.includes('Request Intent:') || generated.includes('Monetization Focus:') || generated.includes('Stack: ')) {
    throw new Error('Expected structured KGC persistence normalization to avoid legacy canned body injections')
  }
  if (generated === canonicalTemplate) {
    throw new Error('Expected structured KGC to differ from the untouched template when request context can resolve Tier B fields')
  }
}

export function testKgcDeterministicFallbackShapesLatestRecommendationQuery() {
  const requestText = 'RECOMMEND: Solo founder; zero budget, bootstrap, organic growth; **Knowledge Graph Canvas** product as MCP for external users, OpenClaw, skills marketplace; Pitch Deck+PRD+TAD, TCO; Use Case -> Problem -> Solution; User Flow+Work Flow+Data Flow; B2C monetization ideas; monetize user actions (subscriptions, pay-per-use, and commerce-like conversion); FOSS RxDB, MapLibre; expose integration with **Swipe payment** flow (payments/checkout)'
  const assistantText = [
    '---',
    'title: "knowledge-graph-canvas · AI Pipeline — PRD + TAD"',
    'graphId: "kgc-knowledge-graph-canvas-prd-tad"',
    '$schema: "kgc-pipeline/v1"',
    'pipeline:',
    'flow:',
  ].join('\n')
  const md = normalizeKgcAssistantBodyForStorage({
    timestampMs: Date.UTC(2026, 3, 20, 10, 54, 32),
    workspacePath: '/chat-log/20260420T105432Z/kgc_20260420T105432Z.md',
    requestText,
    assistantText,
  })
  const requiredSnippets = [
    'product: "Knowledge Graph Canvas"',
    'artifact: "Pitch Deck + PRD + TAD + TCO"',
    'owner: "solo founder"',
    'status: "recommended"',
    'doc_type: "Pitch Deck + PRD + TAD + TCO"',
    'title: "Knowledge Graph Canvas · AI Pipeline — Pitch Deck + PRD + TAD + TCO"',
    '## Pitch Deck + PRD + TAD + TCO',
    'label: "trigger / input"',
    'label: "context pack"',
    'label: "generate / process"',
    'label: "review / validate"',
    'label: "deliver / persist"',
    'actor: ["{{subject}}", "system"]',
    'actor: ["{{subject}}", "AI"]',
    'user_action: "{{subject}} selects scope; states the active request objective and constraints"',
    'Request injected as user turn; {{subject}} reviews streamed output for fit and clarity',
    'feedback_arcs:',
    'forward_edges:',
    'direction:  {key: direction,  type: string,  value: LR}',
    'computed:   {key: computed,   type: boolean, value: true}',
    'click n-trigger  "#pipeline" "S01 · trigger / input"',
    'click n-deliver  "#pipeline" "S05 · deliver / persist"',
    'seq:    R01',
    'seq:    R06',
    'retry ≤ {{runtime.maxRetry}}× via @edge:n-validate:correction→n-process:correction',
    '### Variable Link Map',
    '### Request Snapshot',
    '`{{product}}`',
    '`{{artifact}}`',
    '`{{subject}}`',
    '### Use Case',
    '### Problem',
    '### Solution',
    '### User Flow',
    '### Work Flow',
    '### Data Flow',
    '### Monetization Surface',
    '### Integration Boundaries',
    'OpenClaw',
    'Swipe',
    'RxDB',
    'MapLibre',
    'subscriptions',
    'pay-per-use',
    'conversion',
    'external users',
    'Swipe can cover checkout, payment confirmation, and post-payment handoff',
    'OpenClaw can cover marketplace listing and demand capture',
    'An external user discovers the `{{product}}` offer',
    'unlocks the paid entitlement or action',
    '### Request Snapshot',
    'Canonical output path',
    'kgc-output_20260420T105432Z.md',
  ]
  requiredSnippets.forEach(snippet => {
    if (!md.includes(snippet)) {
      throw new Error(`Expected latest recommendation fallback to include: ${snippet}`)
    }
  })
  if (!md.includes('domain: "MCP distribution + skills marketplace delivery + user-action monetization')) {
    throw new Error('Expected latest recommendation fallback to resolve a bounded but query-shaped domain')
  }
  if (
    !md.includes('objective: "support zero-budget execution; prioritize bootstrap execution; favor organic growth; package Knowledge Graph Canvas as an MCP offer; serve external users; support OpenClaw marketplace packaging; deliver Pitch Deck + PRD + TAD + TCO; evaluate B2C monetization; compare subscription, pay-per-use, and conversion monetization; expose Swipe payment and checkout integration') &&
    !md.includes('integrate Swipe checkout and payment flow')
  ) {
    throw new Error('Expected latest recommendation fallback to resolve a synthesized objective without clipped raw query fragments')
  }
  if (!md.includes('Which user action should trigger Swipe checkout, and what entitlement or fulfillment should follow payment completion?')) {
    throw new Error('Expected latest recommendation fallback to replace generic open questions with request-shaped ones')
  }
  if (!md.includes('S01 captures the active request brief for `{{product}}`')) {
    throw new Error('Expected latest recommendation fallback workflow wording to stay request-first rather than recommendation-first')
  }
  if (!md.includes('The execution contract below supports the current request:')) {
    throw new Error('Expected latest recommendation fallback computing-flow intro to stay request-facing')
  }
  if (md.includes('Recovered partial response signal:') || md.includes('Working response signal:')) {
    throw new Error('Expected malformed structured assistant fragments to be excluded from fallback prose')
  }
  if (md.includes('## {{doc_type}}') || md.includes('Edit Tier B variables (product, domain, subject, objective, artifact, owner, version, status)') || md.includes('This fallback preserves')) {
    throw new Error('Expected latest recommendation fallback to avoid placeholder body projections and generic template carryover')
  }
}

export function testKgcDeterministicFallbackShapesCreativeScriptQueryWithoutTrademarkCarryover() {
  const requestText = 'generate video script inspired by prometheus + jurassic park (FORBID mention/infringe trademark) `video-script-promessic.md`'
  const md = normalizeKgcAssistantBodyForStorage({
    timestampMs: Date.UTC(2026, 3, 20, 19, 20, 54),
    workspacePath: '/chat-log/20260420T192054Z/kgc_20260420T192054Z.md',
    requestText,
    assistantText: 'Need a cinematic script draft with awe and danger.',
  })

  const requiredSnippets = [
    'artifact: "video script"',
    'objective: "develop video script; keep the output original and production-ready; avoid direct trademark or franchise references; translate inspiration into high-level tone, pacing, and atmosphere only"',
    '### Request Snapshot',
    '### Request Fit',
    '### Direction',
    '### Guardrails',
    'video-script-promessic.md',
    'high-level inspiration only',
    'avoid direct trademark or franchise references',
    'request_scope',
    'objective_focus',
  ]
  requiredSnippets.forEach(snippet => {
    if (!md.includes(snippet)) {
      throw new Error(`Expected creative script fallback to include: ${snippet}`)
    }
  })

  const forbiddenSnippets = [
    'Recommendation Snapshot',
    'OpenClaw marketplace distribution',
    'B2C monetization',
    'prometheus',
    'jurassic park',
  ]
  forbiddenSnippets.forEach(snippet => {
    if (md.toLowerCase().includes(snippet.toLowerCase())) {
      throw new Error(`Expected creative script fallback to avoid: ${snippet}`)
    }
  })
}

export function testKgcDeterministicFallbackStaysNeutralForGenericRequest() {
  const requestText = 'Draft a concise implementation memo for improving offline sync conflict visibility in a local-first workspace'
  const md = normalizeKgcAssistantBodyForStorage({
    timestampMs: Date.UTC(2026, 3, 20, 21, 46, 8),
    workspacePath: '/chat-log/20260420T214608Z/kgc_20260420T214608Z.md',
    requestText,
    assistantText: 'Need a short memo with implementation direction and constraints.',
  })

  const requiredSnippets = [
    '### Request Snapshot',
    '### Request Fit',
    '### Direction',
    '### Guardrails',
    '`{{artifact}}`',
    '`{{subject}}`',
    'This document packages `{{artifact}}` for `{{subject}}` around the active request.',
  ]
  requiredSnippets.forEach(snippet => {
    if (!md.includes(snippet)) {
      throw new Error(`Expected generic fallback to include: ${snippet}`)
    }
  })

  const forbiddenSnippets = [
    '### Use Case',
    '### Monetization Surface',
    '### Integration Boundaries',
    'recommendation package',
    'OpenClaw',
    'Swipe',
    'video-script-promessic.md',
    'This document turns one request into one reusable pipeline artifact.',
  ]
  forbiddenSnippets.forEach(snippet => {
    if (md.includes(snippet)) {
      throw new Error(`Expected generic fallback to avoid: ${snippet}`)
    }
  })
}

export function testValidateChatMarkdownRejectsWrappedKgcPreamble() {
  const wrapped = [
    'Here is your KGC document:',
    '',
    readBaseTemplateSample(),
  ].join('\n')
  const resolvableVarKeys = buildResolvableVarKeySet({ frontmatter: null, markdown: wrapped })
  const validation = validateChatMarkdown({ markdown: wrapped, resolvableVarKeys })
  if (validation.ok) {
    throw new Error('Expected validator to reject prose-wrapped KGC output')
  }
  if (validation.failedRuleId !== 'V-03') {
    throw new Error(`Expected wrapped KGC to fail V-03, got ${validation.failedRuleId || 'unknown'}`)
  }
  if (!validation.errors[0]?.message.includes('start immediately with YAML frontmatter')) {
    throw new Error(`Expected wrapped KGC validation message to mention the frontmatter envelope, got: ${validation.errors[0]?.message || 'unknown error'}`)
  }
}

export function testValidateChatMarkdownRejectsCanvasPresetOnlyFallback() {
  const md = [
    '---',
    'kgFrontmatterModeEnabled: true',
    'kgDocumentSemanticMode: "document"',
    'kgCanvasSurfaceMode: "2d"',
    'kgCanvas2dRenderer: "flowEditor"',
    '---',
    '# Thin fallback',
    '## Note',
    'This shell mentions `{{subject}}` but omits the canonical KGC contract.',
  ].join('\n')
  const resolvableVarKeys = buildResolvableVarKeySet({ frontmatter: null, markdown: md })
  const validation = validateChatMarkdown({ markdown: md, resolvableVarKeys })
  if (validation.ok) {
    throw new Error('Expected validator to reject a canvas-preset-only KGC fallback')
  }
  if (validation.failedRuleId !== 'V-03') {
    throw new Error(`Expected thin canvas-preset fallback to fail V-03, got ${validation.failedRuleId || 'unknown'}`)
  }
  if (!validation.errors[0]?.message.includes('minimal canvas-preset-only')) {
    throw new Error(`Expected thin canvas-preset fallback message to mention minimal fallback, got: ${validation.errors[0]?.message || 'unknown error'}`)
  }
}

export function testValidateChatMarkdownRejectsParallelGroupingChannelsBesideFlowSubgraphs() {
  const md = readBaseTemplateSample().replace(
    'flow:\n',
    [
      'kg:subgraphs:',
      '  - {id: legacy-sg, kind: subgraph, label: "Legacy", memberNodeIds: ["n-trigger"], parentId: null}',
      'flow:',
      '',
    ].join('\n'),
  )
  const resolvableVarKeys = buildResolvableVarKeySet({ frontmatter: null, markdown: md })
  const validation = validateChatMarkdown({ markdown: md, resolvableVarKeys })
  if (validation.ok) {
    throw new Error('Expected validator to reject parallel grouping channels beside flow.subgraphs')
  }
  if (validation.failedRuleId !== 'V-03') {
    throw new Error(`Expected duplicate grouping channels to fail V-03, got ${validation.failedRuleId || 'unknown'}`)
  }
  if (!validation.errors[0]?.message.includes('flow.subgraphs as the only grouping source of truth')) {
    throw new Error(`Expected duplicate grouping validation message to mention flow.subgraphs SSOT, got: ${validation.errors[0]?.message || 'unknown error'}`)
  }
}

export function testValidateChatMarkdownAcceptsCanonicalFlowSubgraphsWithoutParallelGroupingChannels() {
  const md = readBaseTemplateSample()
  if (/(^|\n)kg:subgraphs\s*:/m.test(md) || /(^|\n)(?:clusters|groups?|layers?)\s*:/m.test(md)) {
    throw new Error('Expected base template fixture to avoid parallel top-level grouping aliases')
  }
  const resolvableVarKeys = buildResolvableVarKeySet({ frontmatter: null, markdown: md })
  const validation = validateChatMarkdown({ markdown: md, resolvableVarKeys })
  if (!validation.ok) {
    throw new Error(`Expected canonical flow.subgraphs-only KGC to validate, got ${validation.errors[0]?.ruleId}: ${validation.errors[0]?.message}`)
  }
}

export function testNormalizeKgcAssistantBodyForStorageSalvagesWrappedStructuredDocument() {
  const wrapped = [
    'Here is your corrected KGC document.',
    '',
    '```markdown',
    readBaseTemplateSample().trim(),
    '```',
  ].join('\n')
  const md = normalizeKgcAssistantBodyForStorage({
    timestampMs: Date.UTC(2026, 4, 22, 16, 10, 0),
    workspacePath: '/chat-log/20260522T161000Z/kgc_20260522T161000Z.md',
    requestText: '',
    assistantText: wrapped,
  })
  if (!md.startsWith('---\n')) {
    throw new Error('Expected wrapped structured KGC salvage to start directly with YAML frontmatter')
  }
  if (md.includes('Here is your corrected KGC document.')) {
    throw new Error('Expected wrapped structured KGC salvage to strip wrapper prose before persistence')
  }
  if (!isKgcStructuredMarkdown(md)) {
    throw new Error('Expected wrapped structured KGC salvage to remain structurally parseable')
  }
  const resolvableVarKeys = buildResolvableVarKeySet({ frontmatter: null, markdown: md })
  const validation = validateChatMarkdown({ markdown: md, resolvableVarKeys })
  if (!validation.ok) {
    throw new Error(`Expected wrapped structured KGC salvage to validate, got ${validation.errors[0]?.ruleId}: ${validation.errors[0]?.message}`)
  }
}

export function testNormalizeKgcAssistantBodyForStorageRemovesLegacyGroupingAliasesFromStructuredDocument() {
  const aliased = readBaseTemplateSample().replace(
    'flow:\n',
    [
      'kg:subgraphs:',
      '  - {id: legacy-sg, kind: subgraph, label: "Legacy", memberNodeIds: ["n-trigger"], parentId: null}',
      'flow:',
      '  clusters:',
      '    - id: legacy-cluster',
      '      label: "Legacy cluster"',
      '      memberNodeIds: ["n-process"]',
      '',
    ].join('\n'),
  )
  const md = normalizeKgcAssistantBodyForStorage({
    timestampMs: Date.UTC(2026, 4, 22, 16, 12, 0),
    workspacePath: '/chat-log/20260522T161200Z/kgc_20260522T161200Z.md',
    requestText: '',
    assistantText: aliased,
  })
  if (/(^|\n)kg:subgraphs\s*:/m.test(md)) {
    throw new Error('Expected normalization to remove top-level kg:subgraphs alias blocks')
  }
  if (/\n\s+clusters:\s*\n/.test(md)) {
    throw new Error('Expected normalization to remove legacy grouping aliases nested under flow')
  }
  if (!isKgcStructuredMarkdown(md)) {
    throw new Error('Expected normalized structured KGC with alias cleanup to remain structurally parseable')
  }
  const resolvableVarKeys = buildResolvableVarKeySet({ frontmatter: null, markdown: md })
  const validation = validateChatMarkdown({ markdown: md, resolvableVarKeys })
  if (!validation.ok) {
    throw new Error(`Expected alias-cleaned KGC to validate, got ${validation.errors[0]?.ruleId}: ${validation.errors[0]?.message}`)
  }
}

export function testExtractKgcBlockFromAssistantTextSalvagesWrappedStructuredMarkdownDocument() {
  const wrapped = [
    'Here is your corrected KGC document.',
    '',
    '```markdown',
    readBaseTemplateSample().trim(),
    '```',
  ].join('\n')
  const extracted = extractKgcBlockFromAssistantText(wrapped)
  if (!extracted.kgc || !extracted.kgc.startsWith('---\n')) {
    throw new Error('Expected wrapped markdown response to yield a direct structured KGC candidate')
  }
  if (extracted.kgc.includes('Here is your corrected KGC document.')) {
    throw new Error('Expected wrapped markdown recovery to strip wrapper prose from the KGC candidate')
  }
  if (!isKgcStructuredMarkdown(extracted.kgc)) {
    throw new Error('Expected wrapped markdown recovery candidate to remain structurally parseable')
  }
  if (extracted.answer !== 'Here is your corrected KGC document.') {
    throw new Error(`Expected wrapped markdown recovery to preserve only the prose wrapper as answer, got: ${extracted.answer || 'empty'}`)
  }
}

export function testExtractKgcBlockFromAssistantTextRemovesLegacyGroupingAliases() {
  const aliased = readBaseTemplateSample().replace(
    'flow:\n',
    [
      'kg:subgraphs:',
      '  - {id: legacy-sg, kind: subgraph, label: "Legacy", memberNodeIds: ["n-trigger"], parentId: null}',
      'flow:',
      '  groups:',
      '    - id: legacy-group',
      '      label: "Legacy group"',
      '      memberNodeIds: ["n-process"]',
      '',
    ].join('\n'),
  )
  const extracted = extractKgcBlockFromAssistantText(aliased)
  if (!extracted.kgc) {
    throw new Error('Expected aliased structured document to keep a recovered KGC candidate')
  }
  if (/(^|\n)kg:subgraphs\s*:/m.test(extracted.kgc)) {
    throw new Error('Expected shared recovery to remove top-level kg:subgraphs aliases')
  }
  if (/\n\s+groups:\s*\n/.test(extracted.kgc)) {
    throw new Error('Expected shared recovery to remove nested legacy grouping aliases')
  }
  const resolvableVarKeys = buildResolvableVarKeySet({ frontmatter: null, markdown: extracted.kgc })
  const validation = validateChatMarkdown({ markdown: extracted.kgc, resolvableVarKeys })
  if (!validation.ok) {
    throw new Error(`Expected alias-cleaned extracted KGC candidate to validate, got ${validation.errors[0]?.ruleId}: ${validation.errors[0]?.message}`)
  }
}

export function testResolveKgcCorrectionInvalidMarkdownPrefersRecoveredStructuredKgcCandidate() {
  const wrapped = [
    'Here is your corrected KGC document.',
    '',
    '```markdown',
    readBaseTemplateSample().trim(),
    '```',
  ].join('\n')
  const extracted = extractKgcBlockFromAssistantText(wrapped)
  const invalidMarkdown = resolveKgcCorrectionInvalidMarkdown({
    rawAssistantText: wrapped,
    extracted,
  })
  if (!invalidMarkdown.startsWith('---\n')) {
    throw new Error('Expected correction invalid-markdown source to start with the recovered KGC document')
  }
  if (invalidMarkdown.includes('Here is your corrected KGC document.')) {
    throw new Error('Expected correction invalid-markdown source to avoid raw wrapper prose when a structured KGC candidate was recovered')
  }
}

export function testResolveKgcCorrectionInvalidMarkdownFallsBackToTrimmedAnswerWhenNoKgcRecovered() {
  const raw = [
    'Here is my explanation first.',
    '',
    'The model did not return a standalone KGC document yet.',
    '',
    'Please retry.',
  ].join('\n')
  const extracted = extractKgcBlockFromAssistantText(raw)
  const invalidMarkdown = resolveKgcCorrectionInvalidMarkdown({
    rawAssistantText: raw,
    extracted,
  })
  if (invalidMarkdown !== raw.trim()) {
    throw new Error(`Expected correction invalid-markdown fallback to use the trimmed extracted answer, got: ${invalidMarkdown}`)
  }
}

export function testResolveChatKnowgrphAttemptRetriesUsingRecoveredStructuredCandidate() {
  const thinWrapped = [
    'Please fix this KGC document.',
    '',
    '```markdown',
    '---',
    'kgFrontmatterModeEnabled: true',
    'kgDocumentSemanticMode: "document"',
    'kgCanvasSurfaceMode: "2d"',
    'kgCanvas2dRenderer: "flowEditor"',
    '---',
    '# Thin fallback',
    '## Note',
    'This shell omits the canonical KGC contract.',
    '```',
  ].join('\n')
  const result = resolveChatKnowgrphAttempt({
    assistantText: thinWrapped,
    packedFrontmatter: null,
    attempt: 1,
    maxValidationAttempts: 2,
  })
  if (result.kind !== 'retry') {
    throw new Error(`Expected thin wrapped KGC attempt to request retry, got ${result.kind}`)
  }
  if (result.correctionPrompt.includes('Please fix this KGC document.')) {
    throw new Error('Expected retry correction prompt to use the recovered KGC candidate, not the raw wrapper prose')
  }
  if (!result.correctionPrompt.includes('kgFrontmatterModeEnabled: true')) {
    throw new Error('Expected retry correction prompt to include the recovered thin KGC candidate for reference')
  }
}

export function testResolveChatKnowgrphAttemptFinalizesValidatedCanonicalKgc() {
  const canonical = readBaseTemplateSample().trim()
  const result = resolveChatKnowgrphAttempt({
    assistantText: canonical,
    packedFrontmatter: null,
    attempt: 1,
    maxValidationAttempts: 2,
  })
  if (result.kind !== 'final') {
    throw new Error(`Expected canonical KGC attempt to finalize, got ${result.kind}`)
  }
  if (!result.validatedKgc || !result.validatedKgc.startsWith('---\n')) {
    throw new Error('Expected canonical KGC attempt to return validated KGC markdown')
  }
  if (result.finalAssistantText !== canonical) {
    throw new Error('Expected canonical KGC attempt to preserve the assistant text on successful validation')
  }
}

export async function testCreateChatKnowgrphDraftWriterSkipsDuplicateNonForceWrites() {
  const persisted: string[] = []
  const followed: string[] = []
  const streamDraftTextRef = { current: null as { path: string; text: string } | null }
  const flushDraft = createChatKnowgrphDraftWriter({
    chatStorageTarget: 'chatKnowgrph',
    liveKgcPath: '/workspace/chat/kgc.md',
    requestTimestampMs: Date.UTC(2026, 4, 22, 16, 30, 0),
    providerSummary: 'openai:gpt',
    userText: 'Generate KGC',
    defaultLocalRootPath: '/workspace',
    traceId: 'trace-stream-test',
    streamDraftTextRef,
    followWorkspaceMarkdownPath: path => { followed.push(path) },
    setChatKnowgrphWorkspacePath: () => {},
    persistDraft: async payload => { persisted.push(String(payload.assistantText || '')) },
  })
  await flushDraft('alpha', false)
  await flushDraft('alpha', false)
  await flushDraft('alpha', true)
  if (persisted.length !== 0) {
    throw new Error(`Expected streaming draft writer to avoid workspace persistence churn, got ${persisted.length} writes`)
  }
  if (followed.length !== 1) {
    throw new Error(`Expected duplicate draft updates to avoid repeated follow-path churn, got ${followed.length}`)
  }
  if (streamDraftTextRef.current?.text !== 'alpha') {
    throw new Error(`Expected live streaming draft state to retain the latest text, got: ${JSON.stringify(streamDraftTextRef.current)}`)
  }
}

export async function testReadAssistantResponseTextCollectsSseChunksAndFlushesDrafts() {
  const encoder = new TextEncoder()
  const events = [
    'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
    'data: [DONE]\n\n',
  ]
  const response = new Response(
    new ReadableStream({
      start(controller) {
        events.forEach(event => controller.enqueue(encoder.encode(event)))
        controller.close()
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  )
  const flushed: Array<{ text: string; force: boolean }> = []
  let nowTick = 200
  const assistantStream = await readAssistantResponseText({
    response,
    isEventStream: true,
    flushDraft: (text, force) => { flushed.push({ text, force }) },
    nowMs: () => {
      const current = nowTick
      nowTick += 200
      return current
    },
  })
  if (assistantStream.assistantText !== 'Hello world') {
    throw new Error(`Expected SSE helper to accumulate assistant text, got: ${assistantStream.assistantText}`)
  }
  if (flushed.length < 2) {
    throw new Error(`Expected SSE helper to flush draft during stream and at completion, got ${flushed.length} flushes`)
  }
  const last = flushed[flushed.length - 1]
  if (last.text !== 'Hello world' || last.force !== true) {
    throw new Error(`Expected final SSE draft flush to be forced with full text, got: ${JSON.stringify(last)}`)
  }
}

export async function testReadAssistantResponseTextFailsOnMissingFirstChunk() {
  const response = new Response(
    new ReadableStream<Uint8Array>({
      start() {
        return
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  )
  let failed = false
  try {
    await readAssistantResponseText({
      response,
      isEventStream: true,
      flushDraft: async () => {},
      firstChunkTimeoutMs: 10,
    })
  } catch (error) {
    failed = String(error instanceof Error ? error.message : error).includes(CHAT_STREAM_FIRST_CHUNK_TIMEOUT_ERROR)
  }
  if (!failed) {
    throw new Error('Expected event-stream reader to fail when the first chunk never arrives')
  }
}

export function testFinalizeSubmitTerminalStateResetsLoadingAbortAndStreamingWorkspace() {
  const loadingWrites: boolean[] = []
  const workspaceWrites: Array<string | null> = []
  const abortRef = { current: new AbortController() as AbortController | null }
  const streamFollowRef = { current: { path: '/workspace/chat/trace.md', atMs: 123 } }
  const streamDraftTextRef = { current: { path: '/workspace/chat/trace.md', text: 'draft' } }
  finalizeSubmitTerminalState({
    setIsLoading: value => { loadingWrites.push(typeof value === 'function' ? false : value) },
    abortRef,
    setStreamingWorkspacePath: value => { workspaceWrites.push(typeof value === 'function' ? null : value) },
    streamFollowRef,
    streamDraftTextRef,
  })
  if (loadingWrites.length !== 1 || loadingWrites[0] !== false) {
    throw new Error(`Expected terminal lifecycle helper to set loading false once, got: ${JSON.stringify(loadingWrites)}`)
  }
  if (abortRef.current !== null) {
    throw new Error('Expected terminal lifecycle helper to clear abortRef.current')
  }
  if (workspaceWrites.length !== 1 || workspaceWrites[0] !== null) {
    throw new Error(`Expected terminal lifecycle helper to clear streaming workspace path once, got: ${JSON.stringify(workspaceWrites)}`)
  }
  if (streamFollowRef.current !== null || streamDraftTextRef.current !== null) {
    throw new Error('Expected terminal lifecycle helper to clear both streaming refs')
  }
}

export function testDismissPendingSubmitAssistantClearsStreamingAssistantAndRemovesPlaceholderMessage() {
  const streamingAssistantWrites: Array<{ id: string; text: string } | null> = []
  let nextMessages: Array<{ id: string; role?: string }> = [
    { id: 'user-1', role: 'user' },
    { id: 'assistant-pending', role: 'assistant' },
    { id: 'assistant-stable', role: 'assistant' },
  ]
  dismissPendingSubmitAssistant({
    assistantMessageId: 'assistant-pending',
    setStreamingAssistant: value => { streamingAssistantWrites.push(typeof value === 'function' ? null : value) },
    setMessages: updater => {
      nextMessages = typeof updater === 'function' ? updater(nextMessages) : updater
    },
  })
  if (streamingAssistantWrites.length !== 1 || streamingAssistantWrites[0] !== null) {
    throw new Error(`Expected pending-assistant helper to clear streaming assistant once, got: ${JSON.stringify(streamingAssistantWrites)}`)
  }
  if (nextMessages.some(message => message.id === 'assistant-pending')) {
    throw new Error('Expected pending-assistant helper to remove the pending assistant placeholder message')
  }
  if (!nextMessages.some(message => message.id === 'assistant-stable')) {
    throw new Error('Expected pending-assistant helper to preserve unrelated messages')
  }
}

export function testResolveSubmitRuntimeFriendlyMessageUsesEndpointSpecificNetworkCopy() {
  const friendly = resolveSubmitRuntimeFriendlyMessage({
    raw: 'Failed to fetch',
    endpointUrl: 'https://chat.example.test/v1',
  })
  if (!friendly.includes('https://chat.example.test/v1')) {
    throw new Error(`Expected network-friendly submit message to include the endpoint URL, got: ${friendly}`)
  }
}

export function testResolveSubmitRuntimeFriendlyMessageUsesPreparationTimeoutCopy() {
  const friendly = resolveSubmitRuntimeFriendlyMessage({
    raw: `${CHAT_SUBMIT_PREPARATION_TIMEOUT_ERROR}:draft-bootstrap`,
    endpointUrl: 'https://apihub.agnes-ai.com/v1/chat/completions',
    chatProvider: 'agnes-ai',
  })
  if (!friendly.includes('Agnes') || !friendly.includes('preparing the chat request')) {
    throw new Error(`Expected preparation-timeout submit message to use provider-friendly copy, got: ${friendly}`)
  }
}

export async function testExecuteFloatingPanelChatSubmitCoordinatorFailsOnPreparationTimeout() {
  const errors: Array<string | null> = []
  const connectivity: Array<'unknown' | 'ok' | 'error'> = []
  const connectivityDetail: Array<string | null> = []
  const loadingWrites: boolean[] = []
  const workspaceWrites: Array<string | null> = []
  const streamingAssistantWrites: Array<{ id: string; text: string } | null> = []
  let messages: Array<{ id: string; role: string; content: string }> = [
    { id: 'assistant-pending', role: 'assistant', content: '' },
  ]
  const submitArgs = buildSubmitArgsFixture({
    chatProvider: 'agnes-ai',
    chatStorageTarget: 'chatKnowgrph',
    chatLocalStorageRootPath: '/workspace/chat',
    chatKnowgrphWorkspacePath: '/workspace/chat/20260522T190000Z/kgc_20260522T190000Z.md',
    setErrorText: value => { errors.push(typeof value === 'function' ? null : value) },
    setConnectivity: value => { connectivity.push(typeof value === 'function' ? 'unknown' : value) },
    setConnectivityDetail: value => { connectivityDetail.push(typeof value === 'function' ? null : value) },
    setIsLoading: value => { loadingWrites.push(typeof value === 'function' ? false : value) },
    setStreamingWorkspacePath: value => { workspaceWrites.push(typeof value === 'function' ? null : value) },
    setStreamingAssistant: value => { streamingAssistantWrites.push(typeof value === 'function' ? null : value) },
    setMessages: updater => { messages = typeof updater === 'function' ? updater(messages) : updater },
  })

  await executeFloatingPanelChatSubmitCoordinator({
    submitArgs,
    requestUrl: 'https://chat.example.test/v1/chat/completions',
    trimmedInput: 'Generate KGC',
    assistantMessageId: 'assistant-pending',
    nextMessages: [{ id: 'user-1', role: 'user', content: 'Generate KGC' }],
    requestTimestampMs: Date.UTC(2026, 4, 22, 19, 0, 0),
    traceId: 'trace-prep-timeout',
    preparationTimeoutMs: 5,
    bootstrapDraft: () => new Promise<string | null>(() => {}),
  })

  if (!String(errors[0] || '').includes('preparing the chat request')) {
    throw new Error(`Expected coordinator to surface a preparation-timeout error, got: ${JSON.stringify(errors)}`)
  }
  if (connectivity[0] !== 'error' || connectivityDetail[0] !== errors[0]) {
    throw new Error(`Expected coordinator to mark connectivity error on preparation timeout, got: ${JSON.stringify({ connectivity, connectivityDetail, errors })}`)
  }
  if (loadingWrites[0] !== false || workspaceWrites[0] !== null || streamingAssistantWrites[0] !== null) {
    throw new Error(`Expected coordinator timeout exit to clear loading and streaming state, got: ${JSON.stringify({ loadingWrites, workspaceWrites, streamingAssistantWrites })}`)
  }
  if (messages.some(message => message.id === 'assistant-pending')) {
    throw new Error('Expected coordinator timeout exit to dismiss the pending assistant placeholder')
  }
}

export function testHandleSubmitIssueExitReportsDismissesAndFinalizes() {
  const logs: string[] = []
  const persisted: string[] = []
  const errors: Array<string | null> = []
  const connectivity: Array<'unknown' | 'ok' | 'error'> = []
  const connectivityDetail: Array<string | null> = []
  const streamingAssistantWrites: Array<{ id: string; text: string } | null> = []
  let messages: Array<{ id: string }> = [{ id: 'assistant-pending' }, { id: 'stable' }]
  const abortRef = { current: new AbortController() as AbortController | null }
  const streamFollowRef = { current: { path: '/workspace/chat/trace.md', atMs: 1 } }
  const streamDraftTextRef = { current: { path: '/workspace/chat/trace.md', text: 'draft' } }
  const workspaceWrites: Array<string | null> = []
  const loadingWrites: boolean[] = []
  handleSubmitIssueExit({
    assistantMessageId: 'assistant-pending',
    requestText: 'Generate KGC',
    responseText: 'Synthetic submit failure',
    status: 'error',
    modelId: 'gpt-test',
    timestampMs: 42,
    setStreamingAssistant: value => { streamingAssistantWrites.push(typeof value === 'function' ? null : value) },
    setMessages: updater => { messages = typeof updater === 'function' ? updater(messages) : updater },
    setErrorText: value => { errors.push(typeof value === 'function' ? null : value) },
    errorText: 'Synthetic submit failure',
    setConnectivity: value => { connectivity.push(typeof value === 'function' ? 'unknown' : value) },
    connectivity: 'error',
    setConnectivityDetail: value => { connectivityDetail.push(typeof value === 'function' ? null : value) },
    connectivityDetail: 'connectivity detail',
    setIsLoading: value => { loadingWrites.push(typeof value === 'function' ? false : value) },
    abortRef,
    setStreamingWorkspacePath: value => { workspaceWrites.push(typeof value === 'function' ? null : value) },
    streamFollowRef,
    streamDraftTextRef,
    pushChatExchangeLog: payload => { logs.push(`${payload.status}:${payload.response}`) },
    persistChatExchangeLog: async payload => { persisted.push(`${payload.status}:${payload.response}`) },
  })
  if (errors[0] !== 'Synthetic submit failure') {
    throw new Error(`Expected issue exit helper to write error text, got: ${JSON.stringify(errors)}`)
  }
  if (connectivity[0] !== 'error' || connectivityDetail[0] !== 'connectivity detail') {
    throw new Error(`Expected issue exit helper to write connectivity state, got: ${JSON.stringify({ connectivity, connectivityDetail })}`)
  }
  if (logs.length !== 1 || persisted.length !== 1) {
    throw new Error(`Expected issue exit helper to report exactly one log and one persisted issue, got logs=${logs.length}, persisted=${persisted.length}`)
  }
  if (messages.some(message => message.id === 'assistant-pending')) {
    throw new Error('Expected issue exit helper to remove the pending assistant placeholder')
  }
  if (streamingAssistantWrites[0] !== null || abortRef.current !== null || workspaceWrites[0] !== null || loadingWrites[0] !== false) {
    throw new Error('Expected issue exit helper to clear streaming assistant, abort ref, workspace path, and loading state')
  }
}

export function testHandleSubmitIssueExitCanSkipReportingForEndpointFailure() {
  const logs: string[] = []
  const persisted: string[] = []
  let messages: Array<{ id: string }> = [{ id: 'assistant-pending' }]
  handleSubmitIssueExit({
    assistantMessageId: 'assistant-pending',
    requestText: 'Generate KGC',
    responseText: 'Endpoint status text',
    status: 'error',
    modelId: 'gpt-test',
    timestampMs: 99,
    setStreamingAssistant: () => {},
    setMessages: updater => { messages = typeof updater === 'function' ? updater(messages) : updater },
    setErrorText: () => {},
    errorText: 'Endpoint status text',
    setConnectivity: () => {},
    connectivity: 'error',
    setConnectivityDetail: () => {},
    connectivityDetail: 'Chat endpoint returned 500.',
    setIsLoading: () => {},
    abortRef: { current: null },
    setStreamingWorkspacePath: () => {},
    streamFollowRef: { current: null },
    streamDraftTextRef: { current: null },
    pushChatExchangeLog: payload => { logs.push(payload.response) },
    persistChatExchangeLog: async payload => { persisted.push(payload.response) },
    shouldReportIssue: false,
  })
  if (logs.length !== 0 || persisted.length !== 0) {
    throw new Error(`Expected endpoint-style issue exit to skip reporting, got logs=${logs.length}, persisted=${persisted.length}`)
  }
  if (messages.length !== 0) {
    throw new Error('Expected endpoint-style issue exit to still dismiss the pending assistant placeholder')
  }
}

export function testResolvePreferredFallbackModelPrefersProviderOwnedCandidate() {
  const fallback = resolvePreferredFallbackModel({
    providerModelOptions: ['provider-a', 'provider-b'],
    availableModelIds: ['other', 'provider-b', 'provider-c'],
    effectiveModel: 'provider-a',
  })
  if (fallback !== 'provider-b') {
    throw new Error(`Expected preferred fallback helper to pick provider-owned candidate first, got: ${fallback}`)
  }
}

export async function testExecuteChatSubmitTransportAttemptRetriesUnsupportedTokenParameter() {
  const calls: Array<{ model: string; tokenLimitKey: 'max_tokens' | 'max_completion_tokens' }> = []
  const response = await executeChatSubmitTransportAttempt({
    effectiveModel: 'model-a',
    tokenLimitKey: 'max_tokens',
    controller: new AbortController(),
    sendChat: async (model, tokenLimitKey) => {
      calls.push({ model, tokenLimitKey })
      if (calls.length === 1) return new Response('bad token', { status: 400 })
      return new Response('{}', { status: 200 })
    },
    parseErrorBody: async res => (res.status === 400 ? "Unsupported parameter: 'max_tokens'" : null),
    providerModelOptions: ['model-a'],
    loadFallbackModelIds: async () => [],
  })
  if (!response.response.ok) {
    throw new Error('Expected token fallback transport attempt to recover to an OK response')
  }
  if (calls.length !== 2 || calls[1]?.tokenLimitKey !== 'max_completion_tokens') {
    throw new Error(`Expected transport helper to retry once with flipped token parameter, got: ${JSON.stringify(calls)}`)
  }
}

export async function testExecuteChatSubmitTransportAttemptFallsBackToPreferredModel() {
  const calls: Array<{ model: string; tokenLimitKey: 'max_tokens' | 'max_completion_tokens' }> = []
  const resolvedModels: string[] = []
  const result = await executeChatSubmitTransportAttempt({
    effectiveModel: 'model-a',
    tokenLimitKey: 'max_completion_tokens',
    controller: new AbortController(),
    sendChat: async (model, tokenLimitKey) => {
      calls.push({ model, tokenLimitKey })
      if (model === 'model-a') return new Response('fallback required', { status: 404 })
      return new Response('{}', { status: 200 })
    },
    parseErrorBody: async res => (res.status === 404 ? 'Model not found' : null),
    providerModelOptions: ['model-a', 'model-b'],
    loadFallbackModelIds: async () => ['other-model', 'model-b'],
    onResolvedFallbackModel: modelId => { resolvedModels.push(modelId) },
  })
  if (!result.response.ok || result.effectiveModel !== 'model-b') {
    throw new Error(`Expected transport helper to recover with preferred fallback model, got: ${JSON.stringify({ ok: result.response.ok, effectiveModel: result.effectiveModel })}`)
  }
  if (resolvedModels.length !== 1 || resolvedModels[0] !== 'model-b') {
    throw new Error(`Expected transport helper to notify exactly one resolved fallback model, got: ${JSON.stringify(resolvedModels)}`)
  }
}

export async function testExecuteChatSubmitTransportAttemptRetriesRetryableNetworkErrorOnce() {
  let calls = 0
  const result = await executeChatSubmitTransportAttempt({
    effectiveModel: 'model-a',
    tokenLimitKey: 'max_completion_tokens',
    controller: new AbortController(),
    sendChat: async () => {
      calls += 1
      if (calls === 1) throw new Error('Failed to fetch')
      return new Response('{}', { status: 200 })
    },
    parseErrorBody: async () => null,
    providerModelOptions: ['model-a'],
    loadFallbackModelIds: async () => [],
  })
  if (!result.response.ok || calls !== 2) {
    throw new Error(`Expected retryable network transport error to resend once and recover, got calls=${calls}, ok=${result.response.ok}`)
  }
}
