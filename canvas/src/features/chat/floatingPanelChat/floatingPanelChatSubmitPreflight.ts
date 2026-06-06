import type React from 'react'
import { UI_COPY } from '@/lib/config'
import {
  CHAT_DEFAULT_ENDPOINT_URL,
  chatProviderRequiresApiKey,
  getChatProviderLabel,
  normalizeChatEndpointUrlInput,
  resolveChatEndpointForRequest,
} from '@/lib/chatEndpoint'
import {
  ensureChatHistoryWorkspaceFilePath,
  toKgcStreamingWorkspacePath,
  upsertChatHistoryWorkspaceDraft,
} from '../chatHistoryWorkspace'
import { putChatHistoryCache, toShortId } from '../FloatingPanelChat.helpers'
import type { ChatMessage, StreamingAssistantState } from '../FloatingPanelChatSections'
import type { FloatingPanelChatSubmitArgs } from './floatingPanelChatSubmitTypes'

export const resolveChatSubmitRequestUrlOrSetError = (args: {
  chatModel: string | null
  chatEndpointUrl: string | null
  chatProvider: string
  chatAuthMode: 'byok' | 'serverManaged'
  chatApiKey: string | null
  setErrorText: React.Dispatch<React.SetStateAction<string | null>>
  setConnectivity: React.Dispatch<React.SetStateAction<'unknown' | 'ok' | 'error'>>
  setConnectivityDetail: React.Dispatch<React.SetStateAction<string | null>>
}): string | null => {
  if (!args.chatModel) {
    args.setErrorText(UI_COPY.chatMissingEndpointAndModelError)
    args.setConnectivity('unknown')
    args.setConnectivityDetail(null)
    return null
  }
  if (
    args.chatAuthMode === 'byok'
    && chatProviderRequiresApiKey(args.chatProvider)
    && !String(args.chatApiKey || '').trim()
  ) {
    const detail = UI_COPY.chatMissingByokApiKeyError(getChatProviderLabel(args.chatProvider))
    args.setErrorText(detail)
    args.setConnectivity('error')
    args.setConnectivityDetail(detail)
    return null
  }
  const requestUrl = resolveChatEndpointForRequest(
    normalizeChatEndpointUrlInput(args.chatEndpointUrl || CHAT_DEFAULT_ENDPOINT_URL, args.chatProvider),
  )
  if (requestUrl) return requestUrl
  args.setErrorText(UI_COPY.chatMissingEndpointAndModelError)
  args.setConnectivity('unknown')
  args.setConnectivityDetail(null)
  return null
}

export const initializeChatSubmitOptimisticState = (args: {
  historyKey: string
  trimmedInput: string
  messages: ChatMessage[]
  setErrorText?: React.Dispatch<React.SetStateAction<string | null>>
  setConnectivityDetail?: React.Dispatch<React.SetStateAction<string | null>>
  setStreamingAssistant: React.Dispatch<React.SetStateAction<StreamingAssistantState | null>>
  setStreamingInsights?: React.Dispatch<React.SetStateAction<{
    reasoningPreview: string | null
    reasoningStepCount: number
    usageSummary: string | null
    finishReason: string | null
    modelId: string | null
  } | null>>
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  setInput: React.Dispatch<React.SetStateAction<string>>
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>
}): {
  userMessageId: string
  assistantMessageId: string
  requestTimestampMs: number
  traceId: string
  nextMessages: ChatMessage[]
} => {
  const userMessageId = toShortId()
  const assistantMessageId = toShortId()
  const requestTimestampMs = Date.now()
  const traceId = `trace-${requestTimestampMs}-${assistantMessageId}`
  args.setErrorText?.(null)
  args.setConnectivityDetail?.(null)
  args.setStreamingInsights?.(null)
  args.setStreamingAssistant({ id: assistantMessageId, text: '' })
  const nextMessages: ChatMessage[] = [
    ...args.messages,
    { id: userMessageId, role: 'user', content: args.trimmedInput },
    { id: assistantMessageId, role: 'assistant', content: '' },
  ]
  putChatHistoryCache(args.historyKey, nextMessages.slice(-80))
  args.setMessages(nextMessages)
  args.setInput('')
  args.setIsLoading(true)
  return {
    userMessageId,
    assistantMessageId,
    requestTimestampMs,
    traceId,
    nextMessages,
  }
}

export const bootstrapKnowgrphSubmitDraft = async (args: {
  submitArgs: FloatingPanelChatSubmitArgs
  requestTimestampMs: number
  trimmedInput: string
  traceId: string
  ensureWorkspacePath?: typeof ensureChatHistoryWorkspaceFilePath
  persistDraft?: typeof upsertChatHistoryWorkspaceDraft
}): Promise<string | null> => {
  if (args.submitArgs.chatStorageTarget !== 'chatKnowgrph') return null
  const ensureWorkspacePath = args.ensureWorkspacePath || ensureChatHistoryWorkspaceFilePath
  const persistDraft = args.persistDraft || upsertChatHistoryWorkspaceDraft
  const liveKgcPath = await ensureWorkspacePath({
    requestedPath: args.submitArgs.chatKnowgrphWorkspacePath,
    timestampMs: args.requestTimestampMs,
    storageType: 'chatKnowgrph',
    defaultLocalRootPath: args.submitArgs.chatLocalStorageRootPath,
    onResolvedPath: path => args.submitArgs.setChatKnowgrphWorkspacePath(path),
  })
  const liveStreamingPath = toKgcStreamingWorkspacePath(liveKgcPath)
  args.submitArgs.setStreamingWorkspacePath(liveStreamingPath)
  args.submitArgs.setChatWorkspaceStreamingState?.({
    path: liveStreamingPath,
    text: '_Streaming..._',
  })
  args.submitArgs.followWorkspaceMarkdownPath(liveStreamingPath)
  await persistDraft({
    requestedPath: liveKgcPath,
    onResolvedPath: path => args.submitArgs.setChatKnowgrphWorkspacePath(path),
    timestampMs: args.requestTimestampMs,
    providerSummary: args.submitArgs.chatProviderSummary,
    userText: args.trimmedInput,
    assistantText: '',
    storageType: 'chatKnowgrph',
    defaultLocalRootPath: args.submitArgs.chatLocalStorageRootPath,
    title: 'Knowledge Graph Canvas Storage',
    traceId: args.traceId,
  })
  return liveKgcPath
}
