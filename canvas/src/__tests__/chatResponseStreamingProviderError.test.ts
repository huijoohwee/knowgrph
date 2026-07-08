import {
  buildProviderStreamDraftText,
  readAssistantResponseText,
} from '@/features/chat/floatingPanelChat/floatingPanelChatStreaming'

export async function testReadAssistantResponseTextSurfacesOpenAiResponsesFailedEvent() {
  const encoder = new TextEncoder()
  const flushedDrafts: Array<{ text: string; force: boolean }> = []
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"response.created","response":{"status":"in_progress","model":"gpt-5-nano","error":null}}\n\n'))
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'response.failed',
          response: {
            status: 'failed',
            model: 'gpt-5-nano',
            error: {
              code: 'unsupported_parameter',
              message: "Unsupported parameter: 'stop'.",
            },
          },
        })}\n\n`))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  )

  const stream = await readAssistantResponseText({
    response,
    isEventStream: true,
    flushDraft: (text, force) => { flushedDrafts.push({ text, force }) },
    formatDraftText: buildProviderStreamDraftText,
    firstChunkTimeoutMs: 0,
  })
  const finalDraft = flushedDrafts[flushedDrafts.length - 1]?.text || ''
  if (stream.assistantText !== '' || stream.finishReason !== 'error') {
    throw new Error(`Expected failed Responses stream to stay trace-only with error finish, got ${JSON.stringify(stream)}`)
  }
  if (!finalDraft.includes('provider_error: Unsupported parameter') || !finalDraft.includes('Finish: error')) {
    throw new Error(`Expected failed Responses stream draft to surface provider error, got ${JSON.stringify(finalDraft)}`)
  }
}

export async function testReadAssistantResponseTextFinalizesPartialStreamReadError() {
  const encoder = new TextEncoder()
  const flushedDrafts: Array<{ text: string; force: boolean }> = []
  let sentChunk = false
  const response = new Response(
    new ReadableStream({
      pull(controller) {
        if (sentChunk) {
          controller.error(new Error('network stream closed'))
          return
        }
        sentChunk = true
        controller.enqueue(encoder.encode('data: {"type":"response.created","response":{"status":"in_progress","model":"gpt-5-nano-2025-08-07","error":null}}\n\n'))
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  )

  const stream = await readAssistantResponseText({
    response,
    isEventStream: true,
    flushDraft: (text, force) => { flushedDrafts.push({ text, force }) },
    formatDraftText: buildProviderStreamDraftText,
    firstChunkTimeoutMs: 0,
  })
  const finalDraft = flushedDrafts[flushedDrafts.length - 1]?.text || ''
  if (stream.assistantText !== '' || stream.finishReason !== 'error' || stream.rawSseEvents.length !== 1) {
    throw new Error(`Expected partial stream read failure to finalize trace-only error state, got ${JSON.stringify(stream)}`)
  }
  if (!stream.reasoningSteps.some(step => step.includes('stream_error: network stream closed'))) {
    throw new Error(`Expected stream_error signal in stream state, got ${JSON.stringify(stream.reasoningSteps)}`)
  }
  if (!finalDraft.includes('stream_error: network stream closed') || !finalDraft.includes('Finish: error')) {
    throw new Error(`Expected terminal draft to surface partial stream error, got ${JSON.stringify(finalDraft)}`)
  }
}

export async function testReadAssistantResponseTextFinalizesMetadataOnlyStream() {
  const encoder = new TextEncoder()
  const flushedDrafts: Array<{ text: string; force: boolean }> = []
  const response = new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"type":"response.created","response":{"status":"in_progress","model":"gpt-5-nano-2025-08-07","error":null}}\n\n'))
      controller.enqueue(encoder.encode('data: {"type":"response.in_progress","response":{"status":"in_progress","model":"gpt-5-nano-2025-08-07","error":null}}\n\n'))
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  }), { headers: { 'content-type': 'text/event-stream' } })
  const stream = await readAssistantResponseText({
    response,
    isEventStream: true,
    flushDraft: (text, force) => { flushedDrafts.push({ text, force }) },
    formatDraftText: buildProviderStreamDraftText,
    firstChunkTimeoutMs: 0,
  })
  const finalDraft = flushedDrafts[flushedDrafts.length - 1]?.text || ''
  if (stream.assistantText !== '' || stream.finishReason !== 'error' || stream.rawSseEvents.length !== 2) {
    throw new Error(`Expected metadata-only stream to finalize trace-only error state, got ${JSON.stringify(stream)}`)
  }
  if (!finalDraft.includes('stream_empty: provider stream ended without assistant text') || !finalDraft.includes('Finish: error')) {
    throw new Error(`Expected terminal draft to surface metadata-only stream failure, got ${JSON.stringify(finalDraft)}`)
  }
}
