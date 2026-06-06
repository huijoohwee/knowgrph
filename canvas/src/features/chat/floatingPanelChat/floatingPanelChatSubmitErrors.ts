import type React from 'react'
import { UI_COPY } from '@/lib/config'
import { getChatProviderLabel } from '@/lib/chatEndpoint'
import { CHAT_STREAM_FIRST_CHUNK_TIMEOUT_ERROR } from './floatingPanelChatStreaming'
import { CHAT_SUBMIT_PREPARATION_TIMEOUT_ERROR } from './floatingPanelChatSubmitCoordinator'
import { CHAT_SUBMIT_TRANSPORT_TIMEOUT_ERROR } from './floatingPanelChatSubmitTransport'
import { dismissPendingSubmitAssistant, finalizeSubmitTerminalState } from './floatingPanelChatSubmitLifecycle'

export const resolveSubmitRuntimeFriendlyMessage = (args: {
  raw: string
  endpointUrl: string | null
  chatProvider?: string | null
}): string => {
  const raw = String(args.raw || '')
  const lowered = raw.toLowerCase()
  const endpoint = typeof args.endpointUrl === 'string' && args.endpointUrl ? String(args.endpointUrl) : ''
  const isNetwork =
    raw === 'Failed to fetch' ||
    lowered.includes('networkerror') ||
    lowered.includes('net::') ||
    lowered.includes('connection refused')
  if (raw.includes(CHAT_SUBMIT_PREPARATION_TIMEOUT_ERROR)) {
    return UI_COPY.chatSubmitPreparationTimeoutError(getChatProviderLabel(args.chatProvider || 'openai'))
  }
  if (raw.includes(CHAT_SUBMIT_TRANSPORT_TIMEOUT_ERROR)) {
    return UI_COPY.chatSubmitTransportTimeoutError(getChatProviderLabel(args.chatProvider || 'openai'))
  }
  if (raw.includes(CHAT_STREAM_FIRST_CHUNK_TIMEOUT_ERROR)) {
    return UI_COPY.chatStreamFirstChunkTimeoutError(getChatProviderLabel(args.chatProvider || 'openai'))
  }
  return isNetwork
    ? endpoint
      ? UI_COPY.chatUnableToReachEndpointError(endpoint)
      : UI_COPY.chatUnableToReachEndpointGenericError
    : raw || UI_COPY.chatRequestFailedGenericError
}

export const reportSubmitExchangeIssue = (args: {
  requestText: string
  responseText: string
  status: 'ok' | 'error' | 'aborted'
  modelId: string | null
  timestampMs: number
  pushChatExchangeLog: (payload: {
    request: string
    response: string
    status: 'ok' | 'error' | 'aborted'
    model: string | null
    tsMs: number
  }) => void
  persistChatExchangeLog: (payload: {
    request: string
    response: string
    status: 'ok' | 'error' | 'aborted'
    model: string
    timestampMs: number
  }) => Promise<void>
}): void => {
  args.pushChatExchangeLog({
    request: args.requestText,
    response: args.responseText,
    status: args.status,
    model: args.modelId,
    tsMs: args.timestampMs,
  })
  void args.persistChatExchangeLog({
    request: args.requestText,
    response: args.responseText,
    status: args.status,
    model: args.modelId || '',
    timestampMs: args.timestampMs,
  })
}

export const handleSubmitIssueExit = <TMessage extends { id: string }>(args: {
  assistantMessageId: string
  requestText: string
  responseText: string
  status: 'error' | 'aborted'
  modelId: string | null
  timestampMs: number
  setStreamingAssistant: React.Dispatch<React.SetStateAction<{ id: string; text: string } | null>>
  setMessages: React.Dispatch<React.SetStateAction<TMessage[]>>
  setErrorText?: React.Dispatch<React.SetStateAction<string | null>>
  errorText?: string | null
  setConnectivity: React.Dispatch<React.SetStateAction<'unknown' | 'ok' | 'error'>>
  connectivity: 'unknown' | 'error'
  setConnectivityDetail: React.Dispatch<React.SetStateAction<string | null>>
  connectivityDetail: string | null
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>
  abortRef: { current: AbortController | null }
  setStreamingWorkspacePath: React.Dispatch<React.SetStateAction<string | null>>
  setChatWorkspaceStreamingState?: (value: { path?: string | null; text?: string | null } | null) => void
  streamFollowRef: { current: { path: string; atMs: number } | null }
  streamDraftTextRef: { current: { path: string; text: string } | null }
  pushChatExchangeLog: (payload: {
    request: string
    response: string
    status: 'ok' | 'error' | 'aborted'
    model: string | null
    tsMs: number
  }) => void
  persistChatExchangeLog: (payload: {
    request: string
    response: string
    status: 'ok' | 'error' | 'aborted'
    model: string
    timestampMs: number
  }) => Promise<void>
  shouldDismissAssistant?: boolean
  shouldReportIssue?: boolean
}): void => {
  if (args.setErrorText && typeof args.errorText === 'string') {
    args.setErrorText(args.errorText)
  }
  if (args.shouldDismissAssistant !== false) {
    dismissPendingSubmitAssistant({
      assistantMessageId: args.assistantMessageId,
      setStreamingAssistant: args.setStreamingAssistant,
      setMessages: args.setMessages,
    })
  }
  args.setConnectivity(args.connectivity)
  args.setConnectivityDetail(args.connectivityDetail)
  if (args.shouldReportIssue !== false) {
    reportSubmitExchangeIssue({
      requestText: args.requestText,
      responseText: args.responseText,
      status: args.status,
      modelId: args.modelId,
      timestampMs: args.timestampMs,
      pushChatExchangeLog: args.pushChatExchangeLog,
      persistChatExchangeLog: args.persistChatExchangeLog,
    })
  }
  finalizeSubmitTerminalState({
    setIsLoading: args.setIsLoading,
    abortRef: args.abortRef,
    setStreamingWorkspacePath: args.setStreamingWorkspacePath,
    setChatWorkspaceStreamingState: args.setChatWorkspaceStreamingState,
    streamFollowRef: args.streamFollowRef,
    streamDraftTextRef: args.streamDraftTextRef,
  })
}
