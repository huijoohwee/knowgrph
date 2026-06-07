import React from 'react'
import type { ChatMessage } from '../FloatingPanelChatSections'
import {
  appendChatHistoryWorkspaceFile,
  isKgcStructuredMarkdown,
} from '../chatHistoryWorkspace'
import {
  extractKgcBlockFromAssistantText,
  persistChatExchangeLog,
  pickBestErrorFallbackSource,
  toConciseBulletText,
} from '../FloatingPanelChat.helpers'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { applyChatKgcWorkspaceDocumentToCanvas } from '@/features/chat/chatKgcCanvasApply'
import { publishLocalChatPipelineFinalizeSnapshot } from '@/features/agent-ready/browserLocalSurfaceSnapshots'
import { persistChatStreamArtifacts } from '@/features/chat/chatStreamArtifacts'

const normalizeStoragePromotionPath = (value: unknown): string => normalizeWorkspacePath(String(value || '').trim())

type GeneratedChatPromotionFetch = typeof fetch

export type PromoteGeneratedChatWorkspacePathsResult = {
  paths: string[]
  githubStatus: 'applied' | 'skipped' | 'failed'
  githubError?: string
  storageStatus: 'applied' | 'skipped' | 'failed'
  storageError?: string
}

export const promoteGeneratedChatWorkspacePaths = async (
  paths: ReadonlyArray<string | null | undefined>,
  options: {
    githubEnabled?: boolean
    githubBaseUrl?: string | null
    githubFetchImpl?: GeneratedChatPromotionFetch
    storageWorkspaceId?: string | null
    storageSyncNow?: boolean
    storageBaseUrl?: string | null
    storageDeviceId?: string | null
    storageFetchImpl?: GeneratedChatPromotionFetch
  } = {},
): Promise<PromoteGeneratedChatWorkspacePathsResult> => {
  const uniquePaths = [...new Set(paths.map(normalizeStoragePromotionPath).filter(path => path && path !== '/'))]
  const result: PromoteGeneratedChatWorkspacePathsResult = {
    paths: uniquePaths,
    githubStatus: 'skipped',
    storageStatus: 'skipped',
  }
  if (uniquePaths.length === 0) return result
  let githubWriteApplied = false
  try {
    const { publishGeneratedWorkspacePathsToGitHub } = await import('@/features/source-files/sourceFilesGitHubWrite')
    const githubResult = await publishGeneratedWorkspacePathsToGitHub({
      paths: uniquePaths,
      enabled: options.githubEnabled,
      baseUrl: options.githubBaseUrl,
      fetchImpl: options.githubFetchImpl,
    })
    githubWriteApplied = githubResult.status === 'applied'
    result.githubStatus = githubResult.status === 'applied' ? 'applied' : 'skipped'
    if (githubResult.status === 'failed') {
      const error = githubResult.error || 'github_write_failed'
      console.warn('[knowgrph-github] generated chat artifact promotion failed before storage fallback', error)
      return {
        ...result,
        githubStatus: 'failed',
        githubError: error,
        storageStatus: 'skipped',
      }
    }
  } catch (error) {
    console.warn('[knowgrph-github] generated chat artifact promotion skipped before storage fallback', error)
    result.githubStatus = 'skipped'
  }
  try {
    const { publishGeneratedWorkspacePathsToKnowgrphStorage } = await import('@/features/source-files/sourceFileShareUrl')
    const storageResult = await publishGeneratedWorkspacePathsToKnowgrphStorage({
      paths: uniquePaths,
      workspaceId: options.storageWorkspaceId,
      syncNow: options.storageSyncNow,
      baseUrl: options.storageBaseUrl,
      deviceId: options.storageDeviceId,
      fetchImpl: options.storageFetchImpl,
    })
    result.storageStatus = storageResult.storedCount > 0 ? 'applied' : 'skipped'
  } catch (error) {
    console.warn(
      githubWriteApplied
        ? '[knowgrph-storage] generated chat artifact secondary storage promotion skipped after GitHub write'
        : '[knowgrph-storage] generated chat artifact promotion skipped',
      error,
    )
    result.storageStatus = 'failed'
    result.storageError = error instanceof Error ? error.message : String(error || 'storage_publish_failed')
  }
  return result
}

export const useFinalizeAssistantSuccess = (args: {
  chatStorageTarget: 'chatHistory' | 'chatKnowgrph'
  chatProviderSummary: string
  chatKnowgrphWorkspacePath: string | null
  chatHistoryWorkspacePath: string | null
  chatLocalStorageRootPath: string
  setChatKnowgrphWorkspacePath: (path: string) => void
  setChatHistoryWorkspacePath: (path: string) => void
  followWorkspaceMarkdownPath: (path: string, options?: { forceReveal?: boolean }) => void
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
      streamUsageSummary?: string | null
      streamFinishReason?: string | null
      streamReasoningSteps?: string[]
      rawSseEvents?: string[]
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
    const streamReasoningSteps = Array.isArray(payload.streamReasoningSteps)
      ? payload.streamReasoningSteps.filter(step => typeof step === 'string').map(step => String(step).trim()).filter(Boolean)
      : []
    const rawSseEvents = Array.isArray(payload.rawSseEvents)
      ? payload.rawSseEvents.filter(step => typeof step === 'string').map(step => String(step))
      : []
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

    const storagePromotionPaths: string[] = []
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
    storagePromotionPaths.push(resolvedKnowgrphPath)

    const persistedStreamArtifacts = await persistChatStreamArtifacts({
      workspacePath: resolvedKnowgrphPath,
      timestampMs,
      defaultLocalRootPath: args.chatLocalStorageRootPath,
      traceId,
      providerSummary: args.chatProviderSummary,
      modelId,
      requestText,
      rawAssistantText,
      workspaceAssistantText: assistantTextForKgc,
      usageSummary: payload.streamUsageSummary || null,
      finishReason: payload.streamFinishReason || null,
      reasoningSteps: streamReasoningSteps,
      rawSseEvents,
      status,
    })
    storagePromotionPaths.push(...persistedStreamArtifacts.createdArtifactPaths)

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
    let canvasApplied: boolean | null = null
    let canvasApplyError: string | null = null
    try {
      if (args.chatStorageTarget === 'chatKnowgrph' && knowgrphPath) {
        args.followWorkspaceMarkdownPath(knowgrphPath, { forceReveal: true })
        const applied = await applyChatKgcWorkspaceDocumentToCanvas(knowgrphPath)
        canvasApplied = applied
        publishLocalChatPipelineFinalizeSnapshot({
          stage: applied ? 'applied' : 'skipped',
          traceId,
          modelId,
          finalStatus: status,
          persistedKnowgrphPath: knowgrphPath,
          applied,
          message: applied
            ? 'Canonical KGC workspace document was persisted and applied to the active canvas graph.'
            : 'Canonical KGC workspace document was persisted, but graph apply was skipped by import/apply policy or returned false.',
        })
      } else {
        publishLocalChatPipelineFinalizeSnapshot({
          stage: args.chatStorageTarget === 'chatKnowgrph' ? 'skipped' : 'persisted',
          traceId,
          modelId,
          finalStatus: status,
          persistedKnowgrphPath: knowgrphPath || null,
          applied: args.chatStorageTarget === 'chatKnowgrph' ? false : null,
          message: args.chatStorageTarget === 'chatKnowgrph'
            ? 'Canonical KGC workspace document was persisted, but no normalized Knowgrph workspace path was available for canvas apply.'
            : 'Assistant response was persisted to chat history only; canvas apply is reserved for chatKnowgrph storage.',
        })
      }
    } catch (error: unknown) {
      canvasApplied = false
      canvasApplyError = error instanceof Error ? error.message : String(error || 'Canvas apply failed.')
      publishLocalChatPipelineFinalizeSnapshot({
        stage: 'error',
        traceId,
        modelId,
        finalStatus: status,
        persistedKnowgrphPath: knowgrphPath || null,
        applied: false,
        message: canvasApplyError,
      })
      if (args.chatStorageTarget === 'chatKnowgrph') {
        try {
          await promoteGeneratedChatWorkspacePaths(storagePromotionPaths)
        } catch {
          void 0
        }
      }
      throw error
    }
    if (args.chatStorageTarget === 'chatKnowgrph') {
      await promoteGeneratedChatWorkspacePaths(storagePromotionPaths)
    }
    const knowgrphLabel = knowgrphPath ? (knowgrphPath.split('/').filter(Boolean).slice(-1)[0] || 'kgc.md') : ''
    const conciseSource =
      args.chatStorageTarget === 'chatKnowgrph'
        ? (extracted.answer || 'Structured KGC response saved to workspace.')
        : rawAssistantText
    const concise = toConciseBulletText(conciseSource, knowgrphPath ? 49 : 50)
    const lines = [`- ${concise}`]
    if (args.chatStorageTarget === 'chatKnowgrph' && knowgrphPath) {
      lines.push(`- [Open in Source Files: ${knowgrphLabel}](${knowgrphPath})`)
    }
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
