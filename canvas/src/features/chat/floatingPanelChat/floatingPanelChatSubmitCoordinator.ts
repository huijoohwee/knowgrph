import { UI_COPY } from '@/lib/config'
import { CHAT_AI_MARKDOWN_MAX_RETRY } from '../chatAiMarkdownSpec'
import { upsertChatHistoryWorkspaceDraft } from '../chatHistoryWorkspace'
import { loadAvailableModelIds, parseErrorBody } from '../FloatingPanelChat.helpers'
import type { ChatMessage } from '../FloatingPanelChatSections'
import { resolveChatKnowgrphAttempt } from './floatingPanelChatKgcAttempt'
import { handleSubmitIssueExit, resolveSubmitRuntimeFriendlyMessage } from './floatingPanelChatSubmitErrors'
import { finalizeSubmitTerminalState } from './floatingPanelChatSubmitLifecycle'
import {
  buildChatSubmitPayloadMessages,
  buildChatSubmitRequestContext,
  createChatSubmitRequestSender,
  resolveChatSubmitTokenLimitKey,
  resolveInitialChatSubmitModel,
} from './floatingPanelChatSubmitRequest'
import { bootstrapKnowgrphSubmitDraft } from './floatingPanelChatSubmitPreflight'
import { executeChatSubmitTransportAttempt } from './floatingPanelChatSubmitTransport'
import { createChatKnowgrphDraftWriter, readAssistantResponseText } from './floatingPanelChatStreaming'
import type { FloatingPanelChatSubmitArgs } from './floatingPanelChatSubmitTypes'
import { resolveChatEndpointForModels, buildChatProxyHeaders, CHAT_DEFAULT_ENDPOINT_URL } from '@/lib/chatEndpoint'
import {
  publishLocalChatPipelineFinalizeSnapshot,
  publishLocalChatPipelineKgcValidationSnapshot,
} from '@/features/agent-ready/browserLocalSurfaceSnapshots'

type SubmitRequestContext = Awaited<ReturnType<typeof buildChatSubmitRequestContext>>

export const executeFloatingPanelChatSubmitCoordinator = async (args: {
  submitArgs: FloatingPanelChatSubmitArgs
  requestUrl: string
  trimmedInput: string
  assistantMessageId: string
  nextMessages: ChatMessage[]
  requestTimestampMs: number
  traceId: string
  bootstrapDraft?: typeof bootstrapKnowgrphSubmitDraft
  buildRequestContext?: (args: {
    submitArgs: FloatingPanelChatSubmitArgs
    nextMessages: ChatMessage[]
    assistantMessageId: string
  }) => Promise<SubmitRequestContext>
  createRequestSender?: typeof createChatSubmitRequestSender
  resolveInitialModel?: typeof resolveInitialChatSubmitModel
  executeTransportAttempt?: typeof executeChatSubmitTransportAttempt
  createDraftWriter?: typeof createChatKnowgrphDraftWriter
  readAssistantResponse?: typeof readAssistantResponseText
  resolveKnowgrphAttempt?: typeof resolveChatKnowgrphAttempt
  handleIssueExit?: typeof handleSubmitIssueExit
  resolveRuntimeFriendly?: typeof resolveSubmitRuntimeFriendlyMessage
  finalizeTerminal?: typeof finalizeSubmitTerminalState
}): Promise<void> => {
  const bootstrapDraft = args.bootstrapDraft || bootstrapKnowgrphSubmitDraft
  const buildRequestContext = args.buildRequestContext || buildChatSubmitRequestContext
  const createRequestSender = args.createRequestSender || createChatSubmitRequestSender
  const resolveInitialModel = args.resolveInitialModel || resolveInitialChatSubmitModel
  const executeTransportAttempt = args.executeTransportAttempt || executeChatSubmitTransportAttempt
  const createDraftWriter = args.createDraftWriter || createChatKnowgrphDraftWriter
  const readAssistantResponse = args.readAssistantResponse || readAssistantResponseText
  const resolveKnowgrphAttempt = args.resolveKnowgrphAttempt || resolveChatKnowgrphAttempt
  const handleIssueExit = args.handleIssueExit || handleSubmitIssueExit
  const resolveRuntimeFriendly = args.resolveRuntimeFriendly || resolveSubmitRuntimeFriendlyMessage
  const finalizeTerminal = args.finalizeTerminal || finalizeSubmitTerminalState

  try {
    const liveKgcPath = await bootstrapDraft({
      submitArgs: args.submitArgs,
      requestTimestampMs: args.requestTimestampMs,
      trimmedInput: args.trimmedInput,
      traceId: args.traceId,
      persistDraft: upsertChatHistoryWorkspaceDraft,
    })

    const {
      packedContext,
      systemMessages,
      conversationMessages,
    } = await buildRequestContext({
      submitArgs: args.submitArgs,
      nextMessages: args.nextMessages,
      assistantMessageId: args.assistantMessageId,
    })

    const controller = new AbortController()
    args.submitArgs.abortRef.current = controller
    const sendChat = createRequestSender({
      submitArgs: args.submitArgs,
      requestUrl: args.requestUrl,
      controller,
    })
    const {
      providerModelOptions,
      effectiveModel: initialEffectiveModel,
    } = resolveInitialModel({
      chatProvider: args.submitArgs.chatProvider,
      chatModel: args.submitArgs.chatModel,
    })
    let effectiveModel = initialEffectiveModel
    const maxValidationAttempts =
      args.submitArgs.chatStorageTarget === 'chatKnowgrph' ? CHAT_AI_MARKDOWN_MAX_RETRY : 1
    let attempt = 0
    let correctionPrompt: string | null = null
    let finalAssistantText = ''
    let finalValidatedKgc: string | null = null
    let finalStatus: 'ok' | 'error' = 'ok'
    const finalOverride: string | null = null

    publishLocalChatPipelineKgcValidationSnapshot({
      stage: 'idle',
      attempt: 0,
      maxAttempts: maxValidationAttempts,
      failedRuleId: null,
      failedMessage: null,
      correctionPromptPreview: null,
      hasStructuredKgc: false,
      hasYamlFrontmatter: false,
      validatedKgcLength: 0,
    })
    publishLocalChatPipelineFinalizeSnapshot({
      stage: 'idle',
      traceId: args.traceId,
      modelId: null,
      finalStatus: null,
      persistedKnowgrphPath: liveKgcPath || null,
      applied: null,
      message: null,
    })

    while (attempt < maxValidationAttempts) {
      attempt += 1
      const payloadMessages = buildChatSubmitPayloadMessages({
        systemMessages,
        conversationMessages,
        correctionPrompt,
      })
      const transport = await executeTransportAttempt({
        effectiveModel,
        tokenLimitKey: resolveChatSubmitTokenLimitKey(args.submitArgs.chatProvider),
        controller,
        sendChat: async (model, tokenLimitKey) => await sendChat(model, payloadMessages, tokenLimitKey),
        parseErrorBody,
        providerModelOptions,
        loadFallbackModelIds: async () => {
          const modelsEndpoint = resolveChatEndpointForModels(args.submitArgs.chatEndpointUrl || CHAT_DEFAULT_ENDPOINT_URL)
          if (!modelsEndpoint) return []
          return await loadAvailableModelIds(
            modelsEndpoint,
            buildChatProxyHeaders({
              provider: args.submitArgs.chatProvider,
              apiKey: args.submitArgs.chatAuthMode === 'byok' ? args.submitArgs.chatApiKey : null,
              endpointUrl: args.submitArgs.chatEndpointUrl || CHAT_DEFAULT_ENDPOINT_URL,
              clientRequestId: `kg-chat-models-${Date.now().toString(36)}`,
            }),
          )
        },
        onResolvedFallbackModel: fallback => {
          effectiveModel = fallback
          args.submitArgs.setChatModel(fallback)
        },
      })
      effectiveModel = transport.effectiveModel
      const res = transport.response
      if (!res.ok) {
        const statusText = UI_COPY.chatRequestFailedStatus(res.status)
        const suffix = transport.detail ? ` ${transport.detail}` : ''
        handleIssueExit({
          assistantMessageId: args.assistantMessageId,
          requestText: args.trimmedInput,
          responseText: `${statusText}${suffix}`.trim(),
          status: 'error',
          modelId: effectiveModel,
          timestampMs: Date.now(),
          setStreamingAssistant: args.submitArgs.setStreamingAssistant,
          setMessages: args.submitArgs.setMessages,
          setErrorText: args.submitArgs.setErrorText,
          errorText: `${statusText}${suffix}`.trim(),
          setConnectivity: args.submitArgs.setConnectivity,
          connectivity: 'error',
          setConnectivityDetail: args.submitArgs.setConnectivityDetail,
          connectivityDetail: `Chat endpoint returned ${res.status}.`,
          setIsLoading: args.submitArgs.setIsLoading,
          abortRef: args.submitArgs.abortRef,
          setStreamingWorkspacePath: args.submitArgs.setStreamingWorkspacePath,
          streamFollowRef: args.submitArgs.streamFollowRef,
          streamDraftTextRef: args.submitArgs.streamDraftTextRef,
          pushChatExchangeLog: args.submitArgs.pushChatExchangeLog,
          persistChatExchangeLog: args.submitArgs.persistChatExchangeLog,
          shouldReportIssue: false,
        })
        return
      }

      const contentType = String(res.headers.get('content-type') || '').toLowerCase()
      const flushDraft = createDraftWriter({
        chatStorageTarget: args.submitArgs.chatStorageTarget,
        liveKgcPath,
        requestTimestampMs: args.requestTimestampMs,
        providerSummary: args.submitArgs.chatProviderSummary,
        userText: args.trimmedInput,
        defaultLocalRootPath: args.submitArgs.chatLocalStorageRootPath,
        traceId: args.traceId,
        streamDraftTextRef: args.submitArgs.streamDraftTextRef,
        followWorkspaceMarkdownPath: args.submitArgs.followWorkspaceMarkdownPath,
        setChatKnowgrphWorkspacePath: args.submitArgs.setChatKnowgrphWorkspacePath,
        persistDraft: upsertChatHistoryWorkspaceDraft,
      })
      const assistantStream = await readAssistantResponse({
        response: res,
        isEventStream: contentType.includes('text/event-stream'),
        flushDraft,
        onProgress: nextState => {
          args.submitArgs.setStreamingAssistant(current => ({
            id: current?.id || args.assistantMessageId,
            text: nextState.assistantText,
            reasoningPreview: nextState.reasoningPreview,
            reasoningStepCount: nextState.reasoningStepCount,
            usageSummary: nextState.usageSummary,
            finishReason: nextState.finishReason,
            modelId: nextState.modelId,
          }))
          args.submitArgs.setStreamingInsights({
            reasoningPreview: nextState.reasoningPreview,
            reasoningStepCount: nextState.reasoningStepCount,
            usageSummary: nextState.usageSummary,
            finishReason: nextState.finishReason,
            modelId: nextState.modelId,
          })
        },
      })
      const assistantText = assistantStream.assistantText

      if (!assistantText) {
        handleIssueExit({
          assistantMessageId: args.assistantMessageId,
          requestText: args.trimmedInput,
          responseText: UI_COPY.chatResponseMissingContentError,
          status: 'error',
          modelId: effectiveModel,
          timestampMs: Date.now(),
          setStreamingAssistant: args.submitArgs.setStreamingAssistant,
          setMessages: args.submitArgs.setMessages,
          setErrorText: args.submitArgs.setErrorText,
          errorText: UI_COPY.chatResponseMissingContentError,
          setConnectivity: args.submitArgs.setConnectivity,
          connectivity: 'error',
          setConnectivityDetail: args.submitArgs.setConnectivityDetail,
          connectivityDetail: null,
          setIsLoading: args.submitArgs.setIsLoading,
          abortRef: args.submitArgs.abortRef,
          setStreamingWorkspacePath: args.submitArgs.setStreamingWorkspacePath,
          streamFollowRef: args.submitArgs.streamFollowRef,
          streamDraftTextRef: args.submitArgs.streamDraftTextRef,
          pushChatExchangeLog: args.submitArgs.pushChatExchangeLog,
          persistChatExchangeLog: args.submitArgs.persistChatExchangeLog,
        })
        return
      }

      finalAssistantText = assistantText
      if (args.submitArgs.chatStorageTarget !== 'chatKnowgrph') break

      const knowgrphAttempt = resolveKnowgrphAttempt({
        assistantText,
        packedFrontmatter: packedContext.frontmatter,
        attempt,
        maxValidationAttempts: maxValidationAttempts,
      })
      publishLocalChatPipelineKgcValidationSnapshot({
        ...knowgrphAttempt.validation,
        correctionPromptPreview: knowgrphAttempt.kind === 'retry'
          ? knowgrphAttempt.correctionPrompt.slice(0, 240)
          : knowgrphAttempt.validation.correctionPromptPreview,
      })
      if (knowgrphAttempt.kind === 'retry') {
        correctionPrompt = knowgrphAttempt.correctionPrompt
        continue
      }
      finalStatus = knowgrphAttempt.status
      finalAssistantText = knowgrphAttempt.finalAssistantText
      finalValidatedKgc = knowgrphAttempt.validatedKgc
      break
    }

    await args.submitArgs.finalizeAssistantSuccess({
      assistantMessageId: args.assistantMessageId,
      requestText: args.trimmedInput,
      modelId: effectiveModel,
      rawAssistantText: finalAssistantText,
      validatedKgc: finalValidatedKgc,
      timestampMs: Date.now(),
      traceId: args.traceId,
      knownKnowgrphPath: liveKgcPath,
      status: finalStatus,
      finalAssistantOverride: finalOverride,
      streamUsageSummary: assistantStream.usageSummary,
      streamFinishReason: assistantStream.finishReason,
      streamReasoningSteps: assistantStream.reasoningSteps,
      rawSseEvents: assistantStream.rawSseEvents,
    })
    args.submitArgs.setConnectivity('ok')
    args.submitArgs.setConnectivityDetail(null)
    finalizeTerminal({
      setIsLoading: args.submitArgs.setIsLoading,
      abortRef: args.submitArgs.abortRef,
      setStreamingWorkspacePath: args.submitArgs.setStreamingWorkspacePath,
      streamFollowRef: args.submitArgs.streamFollowRef,
      streamDraftTextRef: args.submitArgs.streamDraftTextRef,
    })
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : String(err || '')
    if (raw && raw.toLowerCase().includes('aborted')) {
      handleIssueExit({
        assistantMessageId: args.assistantMessageId,
        requestText: args.trimmedInput,
        responseText: raw || 'Request aborted',
        status: 'aborted',
        modelId: args.submitArgs.chatModel || null,
        timestampMs: Date.now(),
        setStreamingAssistant: args.submitArgs.setStreamingAssistant,
        setMessages: args.submitArgs.setMessages,
        setConnectivity: args.submitArgs.setConnectivity,
        connectivity: 'unknown',
        setConnectivityDetail: args.submitArgs.setConnectivityDetail,
        connectivityDetail: null,
        setIsLoading: args.submitArgs.setIsLoading,
        abortRef: args.submitArgs.abortRef,
        setStreamingWorkspacePath: args.submitArgs.setStreamingWorkspacePath,
        streamFollowRef: args.submitArgs.streamFollowRef,
        streamDraftTextRef: args.submitArgs.streamDraftTextRef,
        pushChatExchangeLog: args.submitArgs.pushChatExchangeLog,
        persistChatExchangeLog: args.submitArgs.persistChatExchangeLog,
      })
      return
    }
    const friendly = resolveRuntimeFriendly({
      raw,
      endpointUrl: args.submitArgs.chatEndpointUrl,
    })
    handleIssueExit({
      assistantMessageId: args.assistantMessageId,
      requestText: args.trimmedInput,
      responseText: friendly,
      status: 'error',
      modelId: args.submitArgs.chatModel || null,
      timestampMs: Date.now(),
      setStreamingAssistant: args.submitArgs.setStreamingAssistant,
      setMessages: args.submitArgs.setMessages,
      setErrorText: args.submitArgs.setErrorText,
      errorText: friendly,
      setConnectivity: args.submitArgs.setConnectivity,
      connectivity: 'error',
      setConnectivityDetail: args.submitArgs.setConnectivityDetail,
      connectivityDetail: friendly,
      setIsLoading: args.submitArgs.setIsLoading,
      abortRef: args.submitArgs.abortRef,
      setStreamingWorkspacePath: args.submitArgs.setStreamingWorkspacePath,
      streamFollowRef: args.submitArgs.streamFollowRef,
      streamDraftTextRef: args.submitArgs.streamDraftTextRef,
      pushChatExchangeLog: args.submitArgs.pushChatExchangeLog,
      persistChatExchangeLog: args.submitArgs.persistChatExchangeLog,
    })
  }
}
