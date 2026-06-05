import { buildSubmitArgsFixture } from '@/__tests__/helpers/chatSubmitArgsFixture'
import {
  CHAT_STREAM_FIRST_CHUNK_TIMEOUT_ERROR,
  readAssistantResponseText,
} from '@/features/chat/floatingPanelChat/floatingPanelChatStreaming'
import { executeFloatingPanelChatSubmitCoordinator } from '@/features/chat/floatingPanelChat/floatingPanelChatSubmitCoordinator'
import { UI_COPY } from '@/lib/config'

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
      reasoningSteps: ['provider returned reasoning without final content'],
      reasoningPreview: 'Reasoning 1: provider returned reasoning without final content',
      reasoningStepCount: 1,
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
