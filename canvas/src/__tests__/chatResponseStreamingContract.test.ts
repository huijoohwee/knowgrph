import { buildSubmitArgsFixture } from '@/__tests__/helpers/chatSubmitArgsFixture'
import {
  CHAT_DURABLE_STREAM_CHUNK,
  CHAT_DURABLE_STREAM_DONE,
  CHAT_DURABLE_STREAM_RESPONSE,
  clearActiveDurableChatStreamRun,
  fetchWithDurableChatStream,
  readActiveDurableChatStreamRun,
  type DurableChatStreamRequestMetadata,
} from '@/features/chat/floatingPanelChat/floatingPanelChatDurableStream'
import {
  CHAT_STREAM_FIRST_CHUNK_TIMEOUT_ERROR,
  buildProviderStreamDraftText,
  buildTraceOnlyAssistantText,
  createChatKnowgrphDraftWriter,
  readAssistantResponseText,
} from '@/features/chat/floatingPanelChat/floatingPanelChatStreaming'
import { executeFloatingPanelChatSubmitCoordinator } from '@/features/chat/floatingPanelChat/floatingPanelChatSubmitCoordinator'
import { UI_COPY } from '@/lib/config'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'

export async function testReadAssistantResponseTextCollectsSseChunksAndFlushesDrafts() {
  const encoder = new TextEncoder()
  const events = [
    'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":[{"type":"text","text":" structured "},{"type":"output_text","text":"world"}]}}]}\n\n',
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
  if (assistantStream.assistantText !== 'Hello structured world') {
    throw new Error(`Expected SSE helper to accumulate assistant text, got: ${assistantStream.assistantText}`)
  }
  if (flushed.length < 2) {
    throw new Error(`Expected SSE helper to flush draft during stream and at completion, got ${flushed.length} flushes`)
  }
  const last = flushed[flushed.length - 1]
  if (last.text !== 'Hello structured world' || last.force !== true) {
    throw new Error(`Expected final SSE draft flush to be forced with full text, got: ${JSON.stringify(last)}`)
  }

  const rootDeltaResponse = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"response.output_text.delta","delta":"Root chunk"}\n\n'))
        controller.enqueue(encoder.encode('data: {"type":"response.output_text.done","text":"Root chunk"}\n\n'))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  )
  const rootDeltaStream = await readAssistantResponseText({
    response: rootDeltaResponse,
    isEventStream: true,
    flushDraft: () => {},
    firstChunkTimeoutMs: 0,
  })
  if (rootDeltaStream.assistantText !== 'Root chunk') {
    throw new Error(`Expected SSE helper to accumulate root output_text delta, got: ${rootDeltaStream.assistantText}`)
  }

  const completedEnvelopeResponse = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"reasoning_steps":[{"type":"web_search","web_search":{"search_keywords":["CPI June 2026","BTC options volatility"]}}]}}]}\n\n'))
        controller.enqueue(encoder.encode('data: {"type":"response.completed","response":{"output":[{"type":"message","content":[{"type":"output_text","text":"Final response after search."}]}]}}\n\n'))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  )
  const completedEnvelopeStream = await readAssistantResponseText({
    response: completedEnvelopeResponse,
    isEventStream: true,
    flushDraft: () => {},
    firstChunkTimeoutMs: 0,
  })
  if (completedEnvelopeStream.assistantText !== 'Final response after search.') {
    throw new Error(`Expected SSE helper to read completed response envelope text, got: ${completedEnvelopeStream.assistantText}`)
  }
  if (completedEnvelopeStream.reasoningStepCount !== 1 || !completedEnvelopeStream.reasoningPreview?.includes('web_search')) {
    throw new Error(`Expected SSE helper to preserve reasoning metadata separately, got: ${JSON.stringify(completedEnvelopeStream)}`)
  }

  const nonStreamResponse = new Response(
    JSON.stringify({
      output: [
        {
          content: [
            { type: 'output_text', text: 'Non-stream structured answer' },
          ],
        },
      ],
    }),
    { headers: { 'content-type': 'application/json' } },
  )
  const nonStream = await readAssistantResponseText({
    response: nonStreamResponse,
    isEventStream: false,
    flushDraft: () => {},
  })
  if (nonStream.assistantText !== 'Non-stream structured answer') {
    throw new Error(`Expected non-stream helper to read structured output text, got: ${nonStream.assistantText}`)
  }
}

export async function testReadAssistantResponseTextFlushesTraceProgressBeforeContent() {
  const encoder = new TextEncoder()
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"model":"mirothinker-1-7-deepresearch-mini","choices":[{"delta":{"reasoning_content":"Inspect market context before answering.","tool_calls":[{"function":{"name":"use_mcp_tool"}}]}}]}\n\n'))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
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
    firstChunkTimeoutMs: 0,
  })

  if (assistantStream.assistantText !== '') {
    throw new Error(`Expected trace-only stream to keep assistant text empty, got: ${assistantStream.assistantText}`)
  }
  const firstDraft = flushed[0]
  if (!firstDraft || firstDraft.force) {
    throw new Error(`Expected reasoning trace to flush as a live non-terminal draft, got: ${JSON.stringify(flushed)}`)
  }
  if (
    !firstDraft.text.includes('Provider Stream Trace') ||
    !firstDraft.text.includes('Final assistant text has not arrived yet') ||
    !firstDraft.text.includes('tool_call: use_mcp_tool') ||
    firstDraft.text.includes('_Streaming..._')
  ) {
    throw new Error(`Expected live trace draft to expose provider progress, got: ${JSON.stringify(firstDraft.text)}`)
  }
  const lastDraft = flushed[flushed.length - 1]
  if (
    !lastDraft?.force ||
    !lastDraft.text.includes('did not return final assistant text') ||
    lastDraft.text.includes('Final assistant text has not arrived yet')
  ) {
    throw new Error(`Expected final trace-only draft flush to preserve progress text, got: ${JSON.stringify(flushed)}`)
  }
}

export async function testReadAssistantResponseTextCompactsReasoningContentDeltas() {
  const encoder = new TextEncoder()
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"reasoning_content":"Thi"}}]}\n\n'))
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"reasoning_content":"s is a com"}}]}\n\n'))
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"reasoning_content":"plex BTC-gold skew note."}}]}\n\n'))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  )
  const flushed: Array<{ text: string; force: boolean }> = []
  const assistantStream = await readAssistantResponseText({
    response,
    isEventStream: true,
    flushDraft: (text, force) => { flushed.push({ text, force }) },
    firstChunkTimeoutMs: 0,
    nowMs: (() => {
      let tick = 0
      return () => {
        tick += 200
        return tick
      }
    })(),
  })
  const compact = assistantStream.reasoningSteps.join('\n')
  if (!compact.includes('This is a complex BTC-gold skew note.')) {
    throw new Error(`Expected reasoning_content chunks to compact into one readable signal, got: ${JSON.stringify(assistantStream.reasoningSteps)}`)
  }
  const finalDraft = flushed[flushed.length - 1]
  if (!finalDraft?.force || !finalDraft.text.includes('This is a complex BTC-gold skew note.')) {
    throw new Error(`Expected terminal trace draft to use compact reasoning text, got: ${JSON.stringify(flushed)}`)
  }
  if (finalDraft.text.includes('- Thi\n') || finalDraft.text.includes('- s is a com')) {
    throw new Error(`Expected terminal trace draft to avoid token-fragment bullets, got: ${JSON.stringify(finalDraft.text)}`)
  }
}

export async function testReadAssistantResponseTextYieldsDuringDenseReasoningStream() {
  const encoder = new TextEncoder()
  const events = Array.from({ length: 72 }, (_, index) =>
    `data: {"choices":[{"delta":{"reasoning_content":"dense reasoning ${index} "}}]}\n\n`
  )
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`${events.join('')}data: [DONE]\n\n`))
        controller.close()
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  )
  const flushed: Array<{ text: string; force: boolean }> = []
  let yields = 0
  const assistantStream = await readAssistantResponseText({
    response,
    isEventStream: true,
    flushDraft: (text, force) => { flushed.push({ text, force }) },
    formatDraftText: buildProviderStreamDraftText,
    firstChunkTimeoutMs: 0,
    nowMs: (() => {
      let tick = 0
      return () => {
        tick += 32
        return tick
      }
    })(),
    yieldToUi: () => { yields += 1 },
  })

  if (yields < 2) {
    throw new Error(`expected dense reasoning stream to yield for UI paints, got ${yields}`)
  }
  const liveDraft = flushed.find(draft => !draft.force && draft.text.includes('Provider Stream Trace'))
  if (!liveDraft) {
    throw new Error(`expected dense reasoning stream to flush a live trace draft before terminal state, got ${JSON.stringify(flushed)}`)
  }
  if (assistantStream.rawSseEvents.length !== 72 || assistantStream.reasoningStepCount < 1) {
    throw new Error(`expected dense reasoning stream to collect all raw events and compact reasoning, got ${JSON.stringify(assistantStream)}`)
  }
}

export async function testReadAssistantResponseTextFormatsKgcDraftAsLiveTraceDuringContentStream() {
  const encoder = new TextEncoder()
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"model":"mirothinker-1-7-deepresearch-mini","choices":[{"delta":{"reasoning_content":"Planning KGC output."}}]}\n\n'))
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"---\\ntitle: \\"BTC Pipeline\\"\\n---\\n# Analysis"}}]}\n\n'))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  )
  const flushed: Array<{ text: string; force: boolean }> = []
  const assistantStream = await readAssistantResponseText({
    response,
    isEventStream: true,
    flushDraft: (text, force) => { flushed.push({ text, force }) },
    formatDraftText: buildProviderStreamDraftText,
    firstChunkTimeoutMs: 0,
    nowMs: (() => {
      let tick = 0
      return () => {
        tick += 200
        return tick
      }
    })(),
  })
  if (!assistantStream.assistantText.includes('BTC Pipeline')) {
    throw new Error(`Expected raw assistant text to remain available for validation, got: ${JSON.stringify(assistantStream.assistantText)}`)
  }
  const contentDraft = flushed.find(draft => draft.text.includes('Assistant Draft'))
  if (
    !contentDraft ||
    !contentDraft.text.includes('Provider Stream Trace') ||
    !contentDraft.text.includes('The provider is streaming assistant content') ||
    !contentDraft.text.includes('```markdown\n---\ntitle: "BTC Pipeline"')
  ) {
    throw new Error(`Expected content stream to stay wrapped as a live trace draft, got: ${JSON.stringify(flushed)}`)
  }
  const finalDraft = flushed[flushed.length - 1]
  if (!finalDraft?.force || !finalDraft.text.includes('The provider returned assistant text with provider trace events.')) {
    throw new Error(`Expected terminal content draft to keep trace wrapper, got: ${JSON.stringify(flushed)}`)
  }
}

export async function testReadAssistantResponseTextFailsOnMissingFirstChunk() {
  let cancelled = false
  let cancelReason = ''
  const response = new Response(
    new ReadableStream<Uint8Array>({
      start() {
        return
      },
      cancel(reason) {
        cancelled = true
        cancelReason = String(reason instanceof Error ? reason.message : reason || '')
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
  if (!cancelled || !cancelReason.includes(CHAT_STREAM_FIRST_CHUNK_TIMEOUT_ERROR)) {
    throw new Error(`Expected timed-out event-stream reader to be cancelled, got ${JSON.stringify({ cancelled, cancelReason })}`)
  }
}

export async function testCreateChatKnowgrphDraftWriterStreamsTraceCompanionAndPersistsCanonicalPath() {
  const followedPaths: string[] = []
  const streamingStates: Array<{ path: string | null; text: string }> = []
  const persistedDrafts: Array<{ requestedPath: string; assistantText: string }> = []
  const streamDraftTextRef: { current: { path: string; text: string } | null } = { current: null }
  const flushDraft = createChatKnowgrphDraftWriter({
    chatStorageTarget: 'chatKnowgrph',
    liveKgcPath: '/workspace/chat/20260522T181000Z/kgc_20260522T181000Z.md',
    requestTimestampMs: Date.UTC(2026, 4, 22, 18, 10, 0),
    providerSummary: 'MiroMind API · Global · mirothinker',
    userText: 'Generate durable KGC',
    defaultLocalRootPath: '/workspace/chat',
    traceId: 'trace-durable-stream',
    streamDraftTextRef,
    followWorkspaceMarkdownPath: path => { followedPaths.push(path) },
    setChatKnowgrphWorkspacePath: () => {},
    setChatWorkspaceStreamingState: value => {
      streamingStates.push({
        path: String(value?.path || '').trim() || null,
        text: String(value?.text || ''),
      })
    },
    persistDraft: async payload => {
      persistedDrafts.push({
        requestedPath: String(payload.requestedPath || ''),
        assistantText: String(payload.assistantText || ''),
      })
      return '/workspace/chat/20260522T181000Z/kgc_20260522T181000Z.md'
    },
    persistWorkspaceDrafts: true,
  })

  await flushDraft('partial durable stream', false)

  const tracePath = '/workspace/chat/20260522T181000Z/kgc-trace_20260522T181000Z.md'
  if (followedPaths.length !== 1 || followedPaths[0] !== tracePath) {
    throw new Error(`Expected streaming draft writer to follow the trace companion, got: ${JSON.stringify(followedPaths)}`)
  }
  if (streamDraftTextRef.current?.path !== tracePath || streamDraftTextRef.current?.text !== 'partial durable stream') {
    throw new Error(`Expected stream draft ref to point at the trace companion, got: ${JSON.stringify(streamDraftTextRef.current)}`)
  }
  if (
    streamingStates.length !== 1 ||
    streamingStates[0]?.path !== tracePath ||
    streamingStates[0]?.text !== 'partial durable stream'
  ) {
    throw new Error(`Expected live workspace streaming state to expose trace companion text, got: ${JSON.stringify(streamingStates)}`)
  }
  if (
    persistedDrafts.length !== 1 ||
    persistedDrafts[0]?.requestedPath !== '/workspace/chat/20260522T181000Z/kgc_20260522T181000Z.md' ||
    persistedDrafts[0]?.assistantText !== 'partial durable stream'
  ) {
    throw new Error(`Expected durable persistence to keep canonical output ownership, got: ${JSON.stringify(persistedDrafts)}`)
  }
}

export async function testDurableChatStreamFetchBridgesWorkerSseWithoutPersistingAuthHeaders() {
  const storage = new MemoryStorage()
  const { g, restore } = initWindowHarness({ storage })
  const capturedMessages: Array<Record<string, unknown>> = []
  const workerTarget = {
    postMessage(message: unknown, ports?: readonly MessagePort[]) {
      const record = message && typeof message === 'object' ? message as Record<string, unknown> : {}
      capturedMessages.push(record)
      const port = ports?.[0]
      if (!port) return
      queueMicrotask(() => {
        port.postMessage({
          type: CHAT_DURABLE_STREAM_RESPONSE,
          runId: 'trace-durable-worker',
          status: 200,
          statusText: 'OK',
          contentType: 'text/event-stream; charset=utf-8',
        })
        port.postMessage({
          type: CHAT_DURABLE_STREAM_CHUNK,
          runId: 'trace-durable-worker',
          chunk: 'data: {"choices":[{"delta":{"content":"Worker "}}]}\n\n',
        })
        port.postMessage({
          type: CHAT_DURABLE_STREAM_CHUNK,
          runId: 'trace-durable-worker',
          chunk: 'data: {"choices":[{"delta":{"content":"resume"}}]}\n\n',
        })
        port.postMessage({
          type: CHAT_DURABLE_STREAM_CHUNK,
          runId: 'trace-durable-worker',
          chunk: 'data: [DONE]\n\n',
        })
        port.postMessage({ type: CHAT_DURABLE_STREAM_DONE, runId: 'trace-durable-worker' })
      })
    },
  } as unknown as ServiceWorker
  const serviceWorker = {
    controller: workerTarget,
    ready: Promise.resolve({ active: workerTarget }),
  }
  try {
    Object.defineProperty(g, 'navigator', {
      configurable: true,
      value: { serviceWorker },
    })
    Object.defineProperty(g.window, 'navigator', {
      configurable: true,
      value: { serviceWorker },
    })

    const metadata: DurableChatStreamRequestMetadata = {
      runId: 'trace-durable-worker',
      traceId: 'trace-durable-worker',
      assistantMessageId: 'assistant-durable-worker',
      requestText: 'Stream through worker and survive refresh.',
      requestTimestampMs: Date.UTC(2026, 5, 6, 1, 0, 0),
      chatStorageTarget: 'chatKnowgrph',
      liveKgcPath: '/workspace/chat/20260606T010000Z/kgc_20260606T010000Z.md',
      providerSummary: 'OpenAI · Global · gpt-worker',
      defaultLocalRootPath: '/workspace/chat',
      packedFrontmatter: null,
    }
    const response = await fetchWithDurableChatStream({
      runMetadata: metadata,
      input: 'https://chat.example.test/v1/chat/completions',
      init: {
        method: 'POST',
        headers: {
          Authorization: 'Bearer SECRET_SHOULD_NOT_PERSIST',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: 'gpt-worker', stream: true, messages: [] }),
      },
      fallbackFetch: async () => {
        throw new Error('durable stream should not fall back in worker bridge test')
      },
    })
    const assistantStream = await readAssistantResponseText({
      response,
      isEventStream: true,
      flushDraft: () => {},
      firstChunkTimeoutMs: 0,
    })
    if (assistantStream.assistantText !== 'Worker resume') {
      throw new Error(`Expected worker-backed response to feed the shared SSE reader, got ${JSON.stringify(assistantStream.assistantText)}`)
    }
    const activeRun = readActiveDurableChatStreamRun()
    if (!activeRun || activeRun.runId !== metadata.runId || activeRun.liveKgcPath !== metadata.liveKgcPath) {
      throw new Error(`Expected durable stream metadata to persist for refresh reattach, got ${JSON.stringify(activeRun)}`)
    }
    if (JSON.stringify(activeRun).includes('SECRET_SHOULD_NOT_PERSIST')) {
      throw new Error(`Expected active durable stream metadata not to persist provider auth headers, got ${JSON.stringify(activeRun)}`)
    }
    const startMessage = capturedMessages.find(message => message.type === 'KG_CHAT_STREAM_START') as {
      request?: { headers?: Record<string, string> }
    } | undefined
    if (startMessage?.request?.headers?.authorization !== 'Bearer SECRET_SHOULD_NOT_PERSIST') {
      throw new Error(`Expected provider auth to be sent only to the worker request, got ${JSON.stringify(capturedMessages)}`)
    }
  } finally {
    clearActiveDurableChatStreamRun('trace-durable-worker')
    restore()
  }
}

export async function testCreateChatKnowgrphDraftWriterSerializesDraftPersistenceWithoutBlockingLiveState() {
  const followedPaths: string[] = []
  const streamingStates: Array<{ path: string | null; text: string }> = []
  const persistedDrafts: string[] = []
  const streamDraftTextRef: { current: { path: string; text: string } | null } = { current: null }
  let markFirstPersistStarted: (() => void) | null = null
  let releaseFirstPersist: (() => void) | null = null
  const firstPersistStarted = new Promise<void>(resolve => {
    markFirstPersistStarted = resolve
  })
  const allowFirstPersist = new Promise<void>(resolve => {
    releaseFirstPersist = resolve
  })
  const flushDraft = createChatKnowgrphDraftWriter({
    chatStorageTarget: 'chatKnowgrph',
    liveKgcPath: '/workspace/chat/20260522T182000Z/kgc_20260522T182000Z.md',
    requestTimestampMs: Date.UTC(2026, 4, 22, 18, 20, 0),
    providerSummary: 'MiroMind API · Global · mirothinker',
    userText: 'Generate ordered durable KGC',
    defaultLocalRootPath: '/workspace/chat',
    traceId: 'trace-ordered-stream',
    streamDraftTextRef,
    followWorkspaceMarkdownPath: path => { followedPaths.push(path) },
    setChatKnowgrphWorkspacePath: () => {},
    setChatWorkspaceStreamingState: value => {
      streamingStates.push({
        path: String(value?.path || '').trim() || null,
        text: String(value?.text || ''),
      })
    },
    persistDraft: async payload => {
      const text = String(payload.assistantText || '')
      persistedDrafts.push(text)
      if (text === 'first partial') {
        markFirstPersistStarted?.()
        await allowFirstPersist
      }
      return '/workspace/chat/20260522T182000Z/kgc_20260522T182000Z.md'
    },
    persistWorkspaceDrafts: true,
  })

  const firstWrite = flushDraft('first partial', false)
  const secondWrite = flushDraft('second terminal', true)
  await firstPersistStarted

  const tracePath = '/workspace/chat/20260522T182000Z/kgc-trace_20260522T182000Z.md'
  if (streamDraftTextRef.current?.text !== 'second terminal' || streamDraftTextRef.current.path !== tracePath) {
    throw new Error(`Expected live draft ref to update immediately to the latest stream text, got ${JSON.stringify(streamDraftTextRef.current)}`)
  }
  if (
    streamingStates.length !== 2 ||
    streamingStates[0]?.text !== 'first partial' ||
    streamingStates[1]?.text !== 'second terminal'
  ) {
    throw new Error(`Expected live workspace state to update synchronously while persistence is pending, got ${JSON.stringify(streamingStates)}`)
  }
  if (persistedDrafts.length !== 1 || persistedDrafts[0] !== 'first partial') {
    throw new Error(`Expected second persistence write to wait for the first, got ${JSON.stringify(persistedDrafts)}`)
  }
  releaseFirstPersist?.()
  await firstWrite
  await secondWrite
  if (persistedDrafts.join(' -> ') !== 'first partial -> second terminal') {
    throw new Error(`Expected durable draft persistence to preserve stream order, got ${JSON.stringify(persistedDrafts)}`)
  }
  if (followedPaths.length !== 2 || followedPaths.every(path => path === tracePath) !== true) {
    throw new Error(`Expected both live updates to follow the trace workspace path, got ${JSON.stringify(followedPaths)}`)
  }
}

export function testBuildTraceOnlyAssistantTextUsesProviderSignals() {
  const text = buildTraceOnlyAssistantText({
    assistantText: '',
    rawSseEvents: ['{"choices":[{"delta":{"reasoning_content":"Inspect context","tool_calls":[{"function":{"name":"google_search"}}]}}]}'],
    reasoningSteps: ['Inspect context', 'tool_call: google_search'],
    reasoningPreview: 'Reasoning 2: Inspect context | tool_call: google_search',
    reasoningStepCount: 2,
    usageSummary: 'Usage: prompt 1 · completion 2',
    finishReason: 'error',
    modelId: 'mirothinker-1-7-deepresearch-mini',
  })
  if (!text.includes('## Provider Stream Trace') || !text.includes('tool_call: google_search')) {
    throw new Error(`Expected trace-only assistant text to preserve provider signals, got: ${JSON.stringify(text)}`)
  }
  if (text.includes('Chat endpoint responded')) {
    throw new Error(`Expected trace-only assistant text to avoid stale missing-content status copy, got: ${JSON.stringify(text)}`)
  }
}

export async function testExecuteFloatingPanelChatSubmitCoordinatorReportsMissingContentStatus() {
  const missingErrors: Array<string | null> = []
  const missingConnectivity: Array<'unknown' | 'ok' | 'error'> = []
  const missingConnectivityDetail: Array<string | null> = []
  const missingSubmitArgs = buildSubmitArgsFixture({
    chatStorageTarget: 'chatHistory',
    setErrorText: value => { missingErrors.push(typeof value === 'function' ? null : value) },
    setConnectivity: value => { missingConnectivity.push(typeof value === 'function' ? 'unknown' : value) },
    setConnectivityDetail: value => { missingConnectivityDetail.push(typeof value === 'function' ? null : value) },
    abortRef: { current: null },
    streamDraftTextRef: { current: null },
    streamFollowRef: { current: null },
  })
  await executeFloatingPanelChatSubmitCoordinator({
    submitArgs: missingSubmitArgs,
    requestUrl: 'https://chat.example.test/v1/chat/completions',
    trimmedInput: 'Generate empty answer',
    assistantMessageId: 'assistant-empty',
    nextMessages: [{ id: 'user-empty', role: 'user', content: 'Generate empty answer' }],
    requestTimestampMs: Date.UTC(2026, 4, 22, 18, 5, 0),
    traceId: 'trace-empty-content',
    bootstrapDraft: async () => null,
    buildRequestContext: async () => ({
      packedContext: { selected_node: null, connected_edges: [], frontmatter: null, graph_summary: '', guideline_digest: '' },
      systemMessages: [{ role: 'system', content: 'base-system' }],
      conversationMessages: [{ role: 'user', content: 'Generate empty answer' }],
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
      assistantText: '',
      rawSseEvents: [],
      reasoningSteps: [],
      reasoningPreview: null,
      reasoningStepCount: 0,
      usageSummary: null,
      finishReason: 'stop',
      modelId: 'model-a',
    }),
    finalizeTerminal: () => {},
  })
  if (missingErrors[0] !== UI_COPY.chatResponseMissingContentError) {
    throw new Error(`Expected missing-content error copy, got: ${JSON.stringify(missingErrors)}`)
  }
  const missingDetail = String(missingConnectivityDetail[0] || '')
  if (missingConnectivity[0] !== 'error' || missingDetail !== UI_COPY.chatResponseMissingContentStatus) {
    throw new Error(`Expected missing-content status instead of endpoint status, got: ${JSON.stringify({ missingConnectivity, missingConnectivityDetail })}`)
  }
}

export async function testExecuteFloatingPanelChatSubmitCoordinatorFinalizesTraceOnlyStream() {
  const errors: Array<string | null> = []
  const connectivity: Array<'unknown' | 'ok' | 'error'> = []
  const finalized: Array<{
    rawAssistantText: string
    status?: 'ok' | 'error'
    streamReasoningSteps?: string[]
    rawSseEvents?: string[]
  }> = []
  const flushedDrafts: Array<{ text: string; force: boolean }> = []
  const submitArgs = buildSubmitArgsFixture({
    chatStorageTarget: 'chatKnowgrph',
    setErrorText: value => { errors.push(typeof value === 'function' ? null : value) },
    setConnectivity: value => { connectivity.push(typeof value === 'function' ? 'unknown' : value) },
    abortRef: { current: null },
    streamDraftTextRef: { current: null },
    streamFollowRef: { current: null },
    finalizeAssistantSuccess: async payload => {
      finalized.push({
        rawAssistantText: String(payload.rawAssistantText || ''),
        status: payload.status,
        streamReasoningSteps: payload.streamReasoningSteps,
        rawSseEvents: payload.rawSseEvents,
      })
    },
  })

  await executeFloatingPanelChatSubmitCoordinator({
    submitArgs,
    requestUrl: 'https://chat.example.test/v1/chat/completions',
    trimmedInput: 'Need current market context',
    assistantMessageId: 'assistant-trace-only',
    nextMessages: [{ id: 'user-trace-only', role: 'user', content: 'Need current market context' }],
    requestTimestampMs: Date.UTC(2026, 4, 22, 18, 15, 0),
    traceId: 'trace-only-content',
    bootstrapDraft: async () => '/workspace/chat/kgc.md',
    buildRequestContext: async () => ({
      packedContext: { selected_node: null, connected_edges: [], frontmatter: null, graph_summary: '', guideline_digest: '' },
      systemMessages: [{ role: 'system', content: 'base-system' }],
      conversationMessages: [{ role: 'user', content: 'Need current market context' }],
    }),
    createRequestSender: () => async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    resolveInitialModel: () => ({ providerModelOptions: ['model-a'], effectiveModel: 'model-a' }),
    executeTransportAttempt: async args => ({
      response: await args.sendChat('model-a', 'max_completion_tokens'),
      effectiveModel: 'model-a',
      detail: null,
    }),
    createDraftWriter: () => async (text, force) => { flushedDrafts.push({ text, force }) },
    readAssistantResponse: async () => ({
      assistantText: '',
      rawSseEvents: ['{"choices":[{"delta":{"reasoning_content":"Inspect market context","tool_calls":[{"function":{"name":"google_search"}}]},"finish_reason":"error"}]}'],
      reasoningSteps: ['Inspect market context', 'tool_call: google_search'],
      reasoningPreview: 'Reasoning 2: Inspect market context | tool_call: google_search',
      reasoningStepCount: 2,
      usageSummary: null,
      finishReason: 'error',
      modelId: 'model-a',
    }),
    finalizeTerminal: () => {},
  })

  if (errors.length > 0) {
    throw new Error(`Expected trace-only stream not to raise missing-content error text, got: ${JSON.stringify(errors)}`)
  }
  if (finalized.length !== 1 || finalized[0]?.status !== 'error') {
    throw new Error(`Expected trace-only stream to finalize once with error status, got: ${JSON.stringify(finalized)}`)
  }
  if (!finalized[0]?.rawAssistantText.includes('Provider Stream Trace') || !finalized[0]?.rawAssistantText.includes('tool_call: google_search')) {
    throw new Error(`Expected trace-only final assistant text to preserve provider signals, got: ${JSON.stringify(finalized[0])}`)
  }
  const lastDraft = flushedDrafts[flushedDrafts.length - 1]
  if (!lastDraft?.force || !lastDraft.text.includes('Provider Stream Trace')) {
    throw new Error(`Expected trace-only stream to force a terminal draft flush, got: ${JSON.stringify(flushedDrafts)}`)
  }
  if (connectivity[0] !== 'ok') {
    throw new Error(`Expected trace-only finalize to use terminal finalize path instead of issue exit, got: ${JSON.stringify(connectivity)}`)
  }
}
