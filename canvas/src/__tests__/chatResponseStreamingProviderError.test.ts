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
