import { upsertChatHistoryWorkspaceDraft } from '../chatHistoryWorkspace'
import { toKgcTraceWorkspacePath } from '../chatHistoryWorkspace.paths'
import {
  extractAssistantDelta,
  extractAssistantStreamDelta,
  formatChatStreamUsageSummary,
  parseSseEvents,
} from '../FloatingPanelChat.helpers'

const CHAT_STREAM_FIRST_CHUNK_TIMEOUT_MS = 12_000
const CHAT_STREAM_FIRST_CHUNK_TIMEOUT_ERROR = 'CHAT_STREAM_FIRST_CHUNK_TIMEOUT'

export type StreamingDraftStateRef = { current: { path: string; text: string } | null }
export type AssistantResponseStreamState = {
  assistantText: string
  rawSseEvents: string[]
  reasoningSteps: string[]
  reasoningPreview: string | null
  reasoningStepCount: number
  usageSummary: string | null
  finishReason: string | null
  modelId: string | null
}

export const createChatKnowgrphDraftWriter = (args: {
  chatStorageTarget: 'chatHistory' | 'chatKnowgrph'
  liveKgcPath: string | null
  requestTimestampMs: number
  providerSummary: string
  userText: string
  defaultLocalRootPath: string
  traceId: string
  streamDraftTextRef: StreamingDraftStateRef
  followWorkspaceMarkdownPath: (path: string) => void
  setChatKnowgrphWorkspacePath: (path: string) => void
  setChatWorkspaceStreamingState?: (value: { path?: string | null; text?: string | null } | null) => void
  persistDraft?: typeof upsertChatHistoryWorkspaceDraft
}) => {
  return async (text: string, force: boolean): Promise<void> => {
    if (args.chatStorageTarget !== 'chatKnowgrph') return
    if (!args.liveKgcPath) return
    const liveTracePath = toKgcTraceWorkspacePath(args.liveKgcPath) || args.liveKgcPath
    if (
      !force &&
      args.streamDraftTextRef.current &&
      args.streamDraftTextRef.current.path === liveTracePath &&
      args.streamDraftTextRef.current.text === text
    ) {
      return
    }
    args.followWorkspaceMarkdownPath(liveTracePath)
    args.streamDraftTextRef.current = { path: liveTracePath, text }
    args.setChatWorkspaceStreamingState?.({ path: liveTracePath, text })
    const persistDraft = args.persistDraft || upsertChatHistoryWorkspaceDraft
    try {
      await persistDraft({
        requestedPath: args.liveKgcPath,
        onResolvedPath: p => args.setChatKnowgrphWorkspacePath(p),
        timestampMs: args.requestTimestampMs,
        providerSummary: args.providerSummary,
        userText: args.userText,
        assistantText: text,
        storageType: 'chatKnowgrph',
        defaultLocalRootPath: args.defaultLocalRootPath,
        title: 'Knowledge Graph Canvas Storage',
        traceId: args.traceId,
      })
    } catch {
      void 0
    }
  }
}

export const readAssistantResponseText = async (args: {
  response: Response
  isEventStream: boolean
  flushDraft: (text: string, force: boolean) => Promise<unknown> | unknown
  onProgress?: (state: AssistantResponseStreamState) => void
  nowMs?: () => number
  firstChunkTimeoutMs?: number
}): Promise<AssistantResponseStreamState> => {
  const flushDraft = args.flushDraft
  const onProgress = args.onProgress
  const buildState = (current: {
    assistantText: string
    rawSseEvents: string[]
    reasoningSteps: string[]
    usageSummary: string | null
    finishReason: string | null
    modelId: string | null
  }): AssistantResponseStreamState => ({
    assistantText: current.assistantText,
    rawSseEvents: [...current.rawSseEvents],
    reasoningSteps: [...current.reasoningSteps],
    reasoningPreview:
      current.reasoningSteps.length > 0
        ? `Reasoning ${current.reasoningSteps.length}: ${current.reasoningSteps.slice(-2).join(' | ')}`
        : null,
    reasoningStepCount: current.reasoningSteps.length,
    usageSummary: current.usageSummary,
    finishReason: current.finishReason,
    modelId: current.modelId,
  })
  if (!args.isEventStream || !args.response.body) {
    const data = (await args.response.json()) as unknown
    const assistantText = extractAssistantDelta(data) || ''
    await flushDraft(assistantText, true)
    const streamDelta = extractAssistantStreamDelta(data)
    const state = buildState({
      assistantText,
      rawSseEvents: [],
      reasoningSteps: streamDelta.reasoningStepSummaries,
      usageSummary: formatChatStreamUsageSummary(streamDelta.usage),
      finishReason: streamDelta.finishReason,
      modelId: streamDelta.modelId,
    })
    onProgress?.(state)
    return state
  }

  const reader = args.response.body.getReader()
  const decoder = new TextDecoder()
  const nowMs = args.nowMs || Date.now
  const firstChunkTimeoutMs = Math.max(0, Number(args.firstChunkTimeoutMs ?? CHAT_STREAM_FIRST_CHUNK_TIMEOUT_MS) || 0)
  let state = {
    assistantText: '',
    rawSseEvents: [] as string[],
    reasoningSteps: [] as string[],
    usageSummary: null as string | null,
    finishReason: null as string | null,
    modelId: null as string | null,
  }
  let buffer = ''
  let done = false
  let receivedAnyChunk = false
  let lastDraftFlushMs = 0
  let lastProgressFlushMs = 0
  let pendingDraftWrite: Promise<unknown> | null = null
  const flushProgressThrottled = (force: boolean) => {
    const currentMs = nowMs()
    if (!force && currentMs - lastProgressFlushMs < 160) return
    lastProgressFlushMs = currentMs
    onProgress?.(buildState(state))
  }
  const flushDraftThrottled = (force: boolean) => {
    const currentMs = nowMs()
    if (!force && currentMs - lastDraftFlushMs < 160) return
    lastDraftFlushMs = currentMs
    pendingDraftWrite = Promise.resolve(flushDraft(state.assistantText, force))
  }

  while (!done) {
    const chunk = receivedAnyChunk || firstChunkTimeoutMs <= 0
      ? await reader.read()
      : await (() => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null
        const chunkPromise = reader.read()
        const timeoutPromise = new Promise<ReadableStreamReadResult<Uint8Array>>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error(CHAT_STREAM_FIRST_CHUNK_TIMEOUT_ERROR)), firstChunkTimeoutMs)
        })
        return Promise.race([chunkPromise, timeoutPromise]).finally(() => {
          if (timeoutId) clearTimeout(timeoutId)
        })
      })()
    if (chunk.done) break
    receivedAnyChunk = true
    buffer += decoder.decode(chunk.value, { stream: true })
    const parsed = parseSseEvents(buffer)
    buffer = parsed.rest
    for (const raw of parsed.events) {
      if (raw === '[DONE]') {
        done = true
        break
      }
      try {
        state = { ...state, rawSseEvents: [...state.rawSseEvents, raw] }
        const next = extractAssistantStreamDelta(JSON.parse(raw) as unknown)
        let changed = false
        if (next.modelId && next.modelId !== state.modelId) {
          state = { ...state, modelId: next.modelId }
          changed = true
        }
        if (next.reasoningStepSummaries.length > 0) {
          state = { ...state, reasoningSteps: [...state.reasoningSteps, ...next.reasoningStepSummaries] }
          changed = true
        }
        if (next.contentDelta) {
          state = { ...state, assistantText: `${state.assistantText}${next.contentDelta}` }
          changed = true
          flushDraftThrottled(false)
        }
        const usageSummary = formatChatStreamUsageSummary(next.usage)
        if (usageSummary && usageSummary !== state.usageSummary) {
          state = { ...state, usageSummary }
          changed = true
        }
        if (next.finishReason && next.finishReason !== state.finishReason) {
          state = { ...state, finishReason: next.finishReason }
          changed = true
        }
        if (changed) flushProgressThrottled(false)
      } catch {
        void 0
      }
    }
  }
  flushDraftThrottled(true)
  flushProgressThrottled(true)
  if (pendingDraftWrite) {
    try {
      await pendingDraftWrite
    } catch {
      void 0
    }
  }
  const finalState = buildState(state)
  onProgress?.(finalState)
  return finalState
}

export { CHAT_STREAM_FIRST_CHUNK_TIMEOUT_ERROR }
