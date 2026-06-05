import {
  extractAssistantStreamDelta,
  formatChatStreamUsageSummary,
  parseSseEvents,
} from '@/features/chat/FloatingPanelChat.helpers'

export function testParseSseEventsSkipsHeartbeatCommentsAndKeepsMultiLinePayloads() {
  const input = [
    ': keep-alive',
    '',
    'data: {"choices":[{"delta":{"reasoning_steps":[{"type":"thinking","thought":"inspect graph"}]}}]}',
    '',
    'data: {"choices":[{"delta":{"content":"Hello"}}]}',
    'data: {"choices":[{"delta":{"content":" world"}}]}',
    '',
    '',
  ].join('\n')

  const parsed = parseSseEvents(input)

  if (parsed.rest !== '') {
    throw new Error(`expected SSE parser to flush the complete buffer, got ${JSON.stringify(parsed.rest)}`)
  }
  if (parsed.events.length !== 2) {
    throw new Error(`expected 2 SSE events, got ${JSON.stringify(parsed.events)}`)
  }
  if (!parsed.events[0]?.includes('"reasoning_steps"')) {
    throw new Error(`expected first SSE event to preserve reasoning payload, got ${JSON.stringify(parsed.events[0])}`)
  }
  if (parsed.events[1] !== '{"choices":[{"delta":{"content":"Hello"}}]}\n{"choices":[{"delta":{"content":" world"}}]}') {
    throw new Error(`expected multiline SSE payload join, got ${JSON.stringify(parsed.events[1])}`)
  }
}

export function testExtractAssistantStreamDeltaReadsMiroMindReasoningAndUsage() {
  const delta = extractAssistantStreamDelta({
    model: 'mirothinker-1-7-deepresearch-mini',
    choices: [
      {
        delta: {
          content: 'Answer',
          reasoning_steps: [
            { type: 'thinking', thought: 'inspect graph structure' },
            { type: 'web_search', web_search: { search_keywords: ['miromind', 'kgc'] } },
          ],
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 11,
      completion_tokens: 22,
      total_tokens: 33,
      reasoning_tokens: 7,
      num_search_queries: 2,
    },
  })

  if (delta.contentDelta !== 'Answer') {
    throw new Error(`expected content delta, got ${JSON.stringify(delta.contentDelta)}`)
  }
  if (delta.modelId !== 'mirothinker-1-7-deepresearch-mini') {
    throw new Error(`expected model id, got ${JSON.stringify(delta.modelId)}`)
  }
  if (delta.finishReason !== 'stop') {
    throw new Error(`expected finish reason, got ${JSON.stringify(delta.finishReason)}`)
  }
  if (
    delta.reasoningStepSummaries.length !== 2
    || delta.reasoningStepSummaries[0] !== 'inspect graph structure'
    || delta.reasoningStepSummaries[1] !== 'web_search: miromind, kgc'
  ) {
    throw new Error(`expected reasoning summaries, got ${JSON.stringify(delta.reasoningStepSummaries)}`)
  }
  const usageSummary = formatChatStreamUsageSummary(delta.usage)
  if (usageSummary !== 'Usage: prompt 11 · completion 22 · total 33 · reasoning 7 · searches 2') {
    throw new Error(`expected usage summary, got ${JSON.stringify(usageSummary)}`)
  }

  const structuredDelta = extractAssistantStreamDelta({
    model: 'mirothinker-1-7-deepresearch-mini',
    choices: [
      {
        delta: {
          content: [
            { type: 'text', text: 'Structured ' },
            { type: 'output_text', text: 'answer' },
          ],
        },
      },
    ],
  })
  if (structuredDelta.contentDelta !== 'Structured answer') {
    throw new Error(`expected structured content delta, got ${JSON.stringify(structuredDelta.contentDelta)}`)
  }

  const responsesDelta = extractAssistantStreamDelta({
    type: 'response.output_text.delta',
    delta: 'Responses chunk',
  })
  if (responsesDelta.contentDelta !== 'Responses chunk') {
    throw new Error(`expected root output_text delta, got ${JSON.stringify(responsesDelta.contentDelta)}`)
  }
}
