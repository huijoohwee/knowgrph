import {
  buildProviderStreamDraftText,
  readAssistantResponseText,
} from '@/features/chat/floatingPanelChat/floatingPanelChatStreaming'

export function testLiveProviderTraceDraftExtendsByAppendWithoutChangingHeaderMetadata() {
  const first = buildProviderStreamDraftText({
    assistantText: '',
    rawSseEvents: ['{"type":"reasoning.delta"}'],
    reasoningText: 'Thinking about BTC',
    reasoningSteps: ['Thinking about BTC'],
    reasoningPreview: 'Reasoning 1: Thinking about BTC',
    reasoningStepCount: 1,
    usageSummary: null,
    finishReason: null,
    modelId: 'mirothinker-test',
  }, 'live')
  const second = buildProviderStreamDraftText({
    assistantText: '',
    rawSseEvents: ['{"type":"reasoning.delta"}', '{"type":"reasoning.delta"}'],
    reasoningText: 'Thinking about BTC and gold skew',
    reasoningSteps: ['Thinking about BTC', 'and gold skew'],
    reasoningPreview: 'Reasoning 2: and gold skew',
    reasoningStepCount: 2,
    usageSummary: null,
    finishReason: null,
    modelId: 'mirothinker-test',
  }, 'live')
  if (!second.startsWith(first)) {
    throw new Error(`expected live trace draft to be append-stable, got ${JSON.stringify({ first, second })}`)
  }
  for (const forbidden of ['SSE events:', 'Model:', 'Finish:', 'Assistant characters:']) {
    if (second.includes(forbidden)) throw new Error(`expected live draft to avoid changing header metadata: ${forbidden}`)
  }
}

export function testLiveAssistantDraftExtendsByAppendAndTerminalMayFinalizeMetadata() {
  const first = buildProviderStreamDraftText({
    assistantText: 'Final answer starts',
    rawSseEvents: ['{}'],
    reasoningText: 'reasoning',
    reasoningSteps: ['reasoning'],
    reasoningPreview: null,
    reasoningStepCount: 1,
    usageSummary: null,
    finishReason: null,
    modelId: null,
  }, 'live')
  const second = buildProviderStreamDraftText({
    assistantText: 'Final answer starts here',
    rawSseEvents: ['{}', '{}'],
    reasoningText: 'reasoning',
    reasoningSteps: ['reasoning'],
    reasoningPreview: null,
    reasoningStepCount: 1,
    usageSummary: null,
    finishReason: null,
    modelId: null,
  }, 'live')
  const terminal = buildProviderStreamDraftText({
    assistantText: 'Final answer starts here',
    rawSseEvents: ['{}', '{}'],
    reasoningText: 'reasoning',
    reasoningSteps: ['reasoning'],
    reasoningPreview: null,
    reasoningStepCount: 1,
    liveTranscriptText: '[reasoning]\nreasoning\n\n[assistant]\nFinal answer starts here',
    usageSummary: 'Usage: prompt 1',
    finishReason: 'stop',
    modelId: 'mirothinker-test',
  }, 'terminal')
  if (!second.startsWith(first)) throw new Error('expected live assistant draft to append without rewriting earlier text')
  if (!terminal.startsWith(buildProviderStreamDraftText({
    assistantText: 'Final answer starts here',
    rawSseEvents: ['{}', '{}'],
    reasoningText: 'reasoning',
    reasoningSteps: ['reasoning'],
    reasoningPreview: null,
    reasoningStepCount: 1,
    liveTranscriptText: '[reasoning]\nreasoning\n\n[assistant]\nFinal answer starts here',
    usageSummary: null,
    finishReason: null,
    modelId: null,
  }, 'live'))) {
    throw new Error(`expected terminal draft to append metadata after live draft, got ${terminal}`)
  }
  if (!terminal.includes('SSE events: 2') || !terminal.includes('Finish: stop') || !terminal.includes('Assistant characters: 24')) {
    throw new Error(`expected terminal draft to land complete metadata once, got ${terminal}`)
  }
}

export async function testReadAssistantResponseTextKeepsLiveDraftsAppendOnlyAcrossTraceAndAssistantTransitions() {
  const encoder = new TextEncoder()
  const events = [
    { choices: [{ delta: { reasoning_content: 'Thinking about BTC ' } }] },
    { choices: [{ delta: { reasoning_steps: [{ type: 'web_search', web_search: { search_keywords: ['BTC ETF flows'] } }] } }] },
    { choices: [{ delta: { reasoning_content: 'and gold skew.' } }] },
    { type: 'response.output_text.delta', delta: 'Final answer starts' },
    { type: 'response.output_text.delta', delta: ' here.' },
    { model: 'mirothinker-test', usage: { prompt_tokens: 1, completion_tokens: 2 } },
  ]
  const response = new Response(
    new ReadableStream({
      start(controller) {
        events.forEach(event => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  )
  const flushed: Array<{ text: string; force: boolean }> = []
  await readAssistantResponseText({
    response,
    isEventStream: true,
    flushDraft: (text, force) => { flushed.push({ text, force }) },
    formatDraftText: buildProviderStreamDraftText,
    yieldToUi: async () => undefined,
    nowMs: () => flushed.length * 200,
  })
  const writes = flushed.map(entry => entry.text).filter(Boolean)
  if (writes.length < 3) throw new Error(`expected multiple live writes, got ${writes.length}`)
  for (let index = 1; index < writes.length; index += 1) {
    if (!writes[index].startsWith(writes[index - 1])) {
      throw new Error(`expected write ${index} to append previous live draft: ${JSON.stringify({ previous: writes[index - 1], next: writes[index] })}`)
    }
  }
  const final = writes[writes.length - 1] || ''
  for (const expected of ['[reasoning]', 'Thinking about BTC', '[assistant]', 'Final answer starts here.', '### Terminal Metadata']) {
    if (!final.includes(expected)) throw new Error(`expected append-only final trace to include ${expected}: ${final}`)
  }
}
