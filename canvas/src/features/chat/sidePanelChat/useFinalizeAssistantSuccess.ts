import React from 'react'
import type { ChatMessage } from '../SidePanelChatSections'
import {
  appendChatHistoryWorkspaceFile,
  isKgcStructuredMarkdown,
} from '../chatHistoryWorkspace'
import {
  extractKgcBlockFromAssistantText,
  persistChatExchangeLog,
  pickBestErrorFallbackSource,
  toConciseBulletText,
} from '../SidePanelChat.helpers'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'

export const useFinalizeAssistantSuccess = (args: {
  chatStorageTarget: 'chatHistory' | 'chatKnowgrph'
  chatProviderSummary: string
  chatKnowgrphWorkspacePath: string | null
  chatHistoryWorkspacePath: string | null
  chatLocalStorageRootPath: string
  setChatKnowgrphWorkspacePath: (path: string) => void
  setChatHistoryWorkspacePath: (path: string) => void
  followWorkspaceMarkdownPath: (path: string) => void
  pushChatExchangeLog: (payload: {
    request: string
    response: string
    status: 'ok' | 'error' | 'aborted'
    model: string | null
    tsMs: number
  }) => void
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  setStreamingAssistant: React.Dispatch<React.SetStateAction<{ id: string; text: string } | null>>
  streamFollowRef: React.MutableRefObject<{ path: string; atMs: number } | null>
  streamDraftTextRef: React.MutableRefObject<{ path: string; text: string } | null>
}) => {
  return React.useCallback(async (
    payload: {
      assistantMessageId: string
      requestText: string
      modelId: string
      rawAssistantText: string
      validatedKgc?: string | null
      timestampMs: number
      traceId?: string
      knownKnowgrphPath?: string | null
      status?: 'ok' | 'error'
      finalAssistantOverride?: string | null
    },
  ) => {
    const { assistantMessageId, requestText, modelId, rawAssistantText, timestampMs, knownKnowgrphPath } = payload
    const status = payload.status === 'error' ? 'error' : 'ok'
    const traceId = String(payload.traceId || '').trim() || `trace-${timestampMs}-${assistantMessageId}`
    const extracted = args.chatStorageTarget === 'chatKnowgrph'
      ? extractKgcBlockFromAssistantText(rawAssistantText)
      : { answer: rawAssistantText, kgc: null }
    const validationFailureNote = [
      'Validation failed after retry exhaustion.',
      'Keep the leading KGC document canonical and inspect the chat history trail for the failed attempt context.',
    ].join(' ')

    const validatedKgc = typeof payload.validatedKgc === 'string' ? payload.validatedKgc.trim() : ''
    const assistantTextForKgc = status === 'error'
      ? pickBestErrorFallbackSource({
        rawAssistantText,
        extractedAnswer: extracted.answer,
        extractedKgc: extracted.kgc,
        fallbackNote: validationFailureNote,
      })
      : (validatedKgc && isKgcStructuredMarkdown(validatedKgc))
        ? validatedKgc
        : rawAssistantText

    const resolvedKnowgrphPath = await appendChatHistoryWorkspaceFile({
      storageType: 'chatKnowgrph',
      title: 'Knowledge Graph Canvas Storage',
      traceId,
      requestedPath: knownKnowgrphPath || args.chatKnowgrphWorkspacePath,
      defaultLocalRootPath: args.chatLocalStorageRootPath,
      onResolvedPath: p => args.setChatKnowgrphWorkspacePath(p),
      timestampMs,
      providerSummary: args.chatProviderSummary,
      userText: requestText,
      assistantText: assistantTextForKgc,
    })

    if (args.chatStorageTarget === 'chatHistory') {
      await appendChatHistoryWorkspaceFile({
        storageType: 'chatHistory',
        title: 'Chat History Storage',
        traceId,
        requestedPath: args.chatHistoryWorkspacePath,
        defaultLocalRootPath: args.chatLocalStorageRootPath,
        onResolvedPath: p => args.setChatHistoryWorkspacePath(p),
        timestampMs,
        providerSummary: args.chatProviderSummary,
        userText: requestText,
        assistantText: rawAssistantText,
      })
    }

    const knowgrphRawPath = String(resolvedKnowgrphPath || args.chatKnowgrphWorkspacePath || '').trim()
    const knowgrphPath = knowgrphRawPath ? normalizeWorkspacePath(knowgrphRawPath) : ''
    if (args.chatStorageTarget === 'chatKnowgrph' && knowgrphPath) {
      args.followWorkspaceMarkdownPath(knowgrphPath)
    }
    const knowgrphLabel = knowgrphPath ? (knowgrphPath.split('/').filter(Boolean).slice(-1)[0] || 'kgc.md') : ''
    const conciseSource =
      args.chatStorageTarget === 'chatKnowgrph'
        ? (extracted.answer || 'Structured KGC response saved to workspace.')
        : rawAssistantText
    const concise = toConciseBulletText(conciseSource, knowgrphPath ? 49 : 50)
    const lines = [`- ${concise}`]
    if (args.chatStorageTarget === 'chatKnowgrph' && knowgrphPath) lines.push(`- [${knowgrphLabel}](${knowgrphPath})`)
    const finalAssistantText = typeof payload.finalAssistantOverride === 'string' && payload.finalAssistantOverride.trim()
      ? payload.finalAssistantOverride
      : lines.join('\n')

    args.setMessages(prev => {
      let found = false
      const next = prev.map(m => {
        if (m.id !== assistantMessageId) return m
        found = true
        return { ...m, content: finalAssistantText }
      })
      return found ? next : [...next, { id: assistantMessageId, role: 'assistant', content: finalAssistantText }]
    })
    args.setStreamingAssistant(null)
    args.streamFollowRef.current = null
    args.streamDraftTextRef.current = null

    args.pushChatExchangeLog({
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
    args.chatHistoryWorkspacePath,
    args.chatKnowgrphWorkspacePath,
    args.chatLocalStorageRootPath,
    args.chatProviderSummary,
    args.chatStorageTarget,
    args.followWorkspaceMarkdownPath,
    args.pushChatExchangeLog,
    args.setChatHistoryWorkspacePath,
    args.setChatKnowgrphWorkspacePath,
    args.setMessages,
    args.setStreamingAssistant,
    args.streamDraftTextRef,
    args.streamFollowRef,
  ])
}

