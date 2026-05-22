import { upsertChatHistoryWorkspaceDraft } from '../chatHistoryWorkspace'
import { toKgcTraceWorkspacePath } from '../chatHistoryWorkspace.paths'
import { extractAssistantDelta, parseSseEvents } from '../SidePanelChat.helpers'

export type StreamingDraftStateRef = { current: { path: string; text: string } | null }

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
  nowMs?: () => number
}): Promise<string> => {
  const flushDraft = args.flushDraft
  if (!args.isEventStream || !args.response.body) {
    const data = (await args.response.json()) as unknown
    const assistantText = extractAssistantDelta(data) || ''
    await flushDraft(assistantText, true)
    return assistantText
  }

  const reader = args.response.body.getReader()
  const decoder = new TextDecoder()
  const nowMs = args.nowMs || Date.now
  let assistantText = ''
  let buffer = ''
  let done = false
  let lastDraftFlushMs = 0
  let pendingDraftWrite: Promise<unknown> | null = null
  const flushDraftThrottled = (force: boolean) => {
    const currentMs = nowMs()
    if (!force && currentMs - lastDraftFlushMs < 160) return
    lastDraftFlushMs = currentMs
    pendingDraftWrite = Promise.resolve(flushDraft(assistantText, force))
  }

  while (!done) {
    const chunk = await reader.read()
    if (chunk.done) break
    buffer += decoder.decode(chunk.value, { stream: true })
    const parsed = parseSseEvents(buffer)
    buffer = parsed.rest
    for (const raw of parsed.events) {
      if (raw === '[DONE]') {
        done = true
        break
      }
      try {
        const next = extractAssistantDelta(JSON.parse(raw) as unknown)
        if (!next) continue
        assistantText += next
        flushDraftThrottled(false)
      } catch {
        void 0
      }
    }
  }
  flushDraftThrottled(true)
  if (pendingDraftWrite) {
    try {
      await pendingDraftWrite
    } catch {
      void 0
    }
  }
  return assistantText
}
