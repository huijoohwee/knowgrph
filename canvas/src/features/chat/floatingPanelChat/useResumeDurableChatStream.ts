import React from 'react'
import { UI_COPY } from '@/lib/config'
import type { ChatMessage, StreamingAssistantState } from '../FloatingPanelChatSections'
import {
  attachDurableChatStreamResponse,
  clearActiveDurableChatStreamRun,
  forgetDurableChatStreamRun,
  readActiveDurableChatStreamRun,
} from './floatingPanelChatDurableStream'
import { resolveChatKnowgrphAttempt } from './floatingPanelChatKgcAttempt'
import { finalizeSubmitTerminalState } from './floatingPanelChatSubmitLifecycle'
import {
  buildProviderStreamDraftText,
  buildTraceOnlyAssistantText,
  createChatKnowgrphDraftWriter,
  readAssistantResponseText,
} from './floatingPanelChatStreaming'
import type { FloatingPanelChatSubmitArgs } from './floatingPanelChatSubmitTypes'

export const useResumeDurableChatStream = (args: {
  isLoading: boolean
  chatStorageTarget: 'chatHistory' | 'chatKnowgrph'
  chatProviderSummary: string
  chatLocalStorageRootPath: string
  chatModelId: string
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>
  setErrorText: React.Dispatch<React.SetStateAction<string | null>>
  setConnectivity: React.Dispatch<React.SetStateAction<'unknown' | 'ok' | 'error'>>
  setConnectivityDetail: React.Dispatch<React.SetStateAction<string | null>>
  setStreamingAssistant: React.Dispatch<React.SetStateAction<StreamingAssistantState | null>>
  setStreamingInsights: React.Dispatch<React.SetStateAction<{
    reasoningPreview: string | null
    reasoningStepCount: number
    usageSummary: string | null
    finishReason: string | null
    modelId: string | null
  } | null>>
  setStreamingWorkspacePath: React.Dispatch<React.SetStateAction<string | null>>
  setChatWorkspaceStreamingState?: (value: { path?: string | null; text?: string | null } | null) => void
  setChatKnowgrphWorkspacePath: (path: string) => void
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  followWorkspaceMarkdownPath: (path: string, options?: { forceReveal?: boolean }) => void
  finalizeAssistantSuccess: FloatingPanelChatSubmitArgs['finalizeAssistantSuccess']
  abortRef: React.MutableRefObject<AbortController | null>
  streamFollowRef: React.MutableRefObject<{ path: string; atMs: number } | null>
  streamDraftTextRef: React.MutableRefObject<{ path: string; text: string } | null>
}): void => {
  const durableResumeRunRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    const activeRun = readActiveDurableChatStreamRun()
    if (!activeRun || durableResumeRunRef.current === activeRun.runId || args.isLoading) return
    if (activeRun.chatStorageTarget !== args.chatStorageTarget) return
    durableResumeRunRef.current = activeRun.runId
    let cancelled = false

    args.setIsLoading(true)
    args.setErrorText(null)
    args.setConnectivity('unknown')
    args.setConnectivityDetail(null)
    args.setStreamingAssistant({
      id: activeRun.assistantMessageId,
      text: '',
      reasoningPreview: null,
      reasoningStepCount: 0,
      usageSummary: null,
      finishReason: null,
      modelId: activeRun.modelId,
    })
    args.setStreamingInsights(null)

    void (async () => {
      try {
        const response = await attachDurableChatStreamResponse(activeRun.runId)
        const contentType = String(response.headers.get('content-type') || '').toLowerCase()
        const flushDraft = createChatKnowgrphDraftWriter({
          chatStorageTarget: activeRun.chatStorageTarget,
          liveKgcPath: activeRun.liveKgcPath,
          requestTimestampMs: activeRun.requestTimestampMs,
          providerSummary: activeRun.providerSummary || args.chatProviderSummary,
          userText: activeRun.requestText,
          defaultLocalRootPath: activeRun.defaultLocalRootPath || args.chatLocalStorageRootPath,
          traceId: activeRun.traceId,
          streamDraftTextRef: args.streamDraftTextRef,
          followWorkspaceMarkdownPath: args.followWorkspaceMarkdownPath,
          setChatKnowgrphWorkspacePath: args.setChatKnowgrphWorkspacePath,
          setChatWorkspaceStreamingState: value => {
            args.setStreamingWorkspacePath(String(value?.path || '').trim() || null)
            args.setChatWorkspaceStreamingState?.(value)
          },
          persistWorkspaceDrafts: true,
        })
        const assistantStream = await readAssistantResponseText({
          response,
          isEventStream: contentType.includes('text/event-stream'),
          flushDraft,
          formatDraftText: activeRun.chatStorageTarget === 'chatKnowgrph'
            ? buildProviderStreamDraftText
            : undefined,
          onProgress: nextState => {
            if (cancelled) return
            args.setStreamingAssistant(current => ({
              id: current?.id || activeRun.assistantMessageId,
              text: nextState.assistantText,
              reasoningPreview: nextState.reasoningPreview,
              reasoningStepCount: nextState.reasoningStepCount,
              usageSummary: nextState.usageSummary,
              finishReason: nextState.finishReason,
              modelId: nextState.modelId || activeRun.modelId,
            }))
            args.setStreamingInsights({
              reasoningPreview: nextState.reasoningPreview,
              reasoningStepCount: nextState.reasoningStepCount,
              usageSummary: nextState.usageSummary,
              finishReason: nextState.finishReason,
              modelId: nextState.modelId || activeRun.modelId,
            })
          },
          firstChunkTimeoutMs: 0,
        })
        if (cancelled) return
        let finalAssistantText = assistantStream.assistantText
        let finalValidatedKgc: string | null = null
        let finalStatus: 'ok' | 'error' = 'ok'
        if (!finalAssistantText.trim()) {
          const traceOnlyAssistantText = buildTraceOnlyAssistantText(assistantStream)
          if (traceOnlyAssistantText) {
            await flushDraft(traceOnlyAssistantText, true)
            finalAssistantText = traceOnlyAssistantText
            finalStatus = 'error'
          } else {
            throw new Error(UI_COPY.chatResponseMissingContentError)
          }
        } else if (activeRun.chatStorageTarget === 'chatKnowgrph') {
          const knowgrphAttempt = resolveChatKnowgrphAttempt({
            assistantText: finalAssistantText,
            packedFrontmatter: activeRun.packedFrontmatter || null,
            attempt: 1,
            maxValidationAttempts: 1,
          })
          if (knowgrphAttempt.kind === 'final') {
            finalStatus = knowgrphAttempt.status
            finalAssistantText = knowgrphAttempt.finalAssistantText
            finalValidatedKgc = knowgrphAttempt.validatedKgc
          } else {
            finalStatus = 'error'
          }
        }
        await args.finalizeAssistantSuccess({
          assistantMessageId: activeRun.assistantMessageId,
          requestText: activeRun.requestText,
          modelId: assistantStream.modelId || activeRun.modelId || args.chatModelId,
          rawAssistantText: finalAssistantText,
          validatedKgc: finalValidatedKgc,
          timestampMs: Date.now(),
          traceId: activeRun.traceId,
          knownKnowgrphPath: activeRun.liveKgcPath,
          status: finalStatus,
          streamUsageSummary: assistantStream.usageSummary,
          streamFinishReason: assistantStream.finishReason,
          streamReasoningSteps: assistantStream.reasoningSteps,
          rawSseEvents: assistantStream.rawSseEvents,
        })
        args.setConnectivity('ok')
        args.setConnectivityDetail(null)
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : String(error || 'Durable chat stream resume failed.')
          args.setErrorText(message)
          args.setConnectivity('error')
          args.setConnectivityDetail(message)
          args.setMessages(prev => {
            const next = prev.filter(item => item.id !== activeRun.assistantMessageId)
            return [...next, { id: activeRun.assistantMessageId, role: 'assistant', content: message }]
          })
        }
      } finally {
        if (!cancelled) {
          clearActiveDurableChatStreamRun(activeRun.runId)
          void forgetDurableChatStreamRun(activeRun.runId)
          finalizeSubmitTerminalState({
            setIsLoading: args.setIsLoading,
            abortRef: args.abortRef,
            setStreamingWorkspacePath: args.setStreamingWorkspacePath,
            setChatWorkspaceStreamingState: args.setChatWorkspaceStreamingState,
            streamFollowRef: args.streamFollowRef,
            streamDraftTextRef: args.streamDraftTextRef,
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [args])
}
