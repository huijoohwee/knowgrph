import {
  extractAssistantStreamDelta,
  parseSseEvents,
} from './floatingPanelChat/floatingPanelChatStreamParsing'

export async function readRunTextEventStream(args: {
  body: ReadableStream<Uint8Array>
  extractText: (payload: unknown) => string
  onText?: (text: string) => void
}): Promise<string> {
  const reader = args.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''
  let done = false
  let finishReason = ''
  let reasoningObserved = false
  const providerErrors: string[] = []
  const consumePayload = (payload: unknown) => {
    const streamDelta = extractAssistantStreamDelta(payload)
    if (streamDelta.finishReason) finishReason = streamDelta.finishReason
    if (streamDelta.reasoningTextDelta || streamDelta.reasoningStepSummaries.length) reasoningObserved = true
    streamDelta.reasoningStepSummaries.forEach(summary => {
      if (summary.startsWith('provider_error: ')) providerErrors.push(summary.slice('provider_error: '.length))
    })
    const next = args.extractText(payload)
    if (!next) return
    fullText += next
    args.onText?.(fullText)
  }
  const consumeEvents = (events: readonly string[]) => {
    for (const raw of events) {
      if (raw === '[DONE]') {
        done = true
        break
      }
      try {
        consumePayload(JSON.parse(raw) as unknown)
      } catch {
        void 0
      }
    }
  }
  while (!done) {
    const chunk = await reader.read()
    if (chunk.done) break
    buffer += decoder.decode(chunk.value, { stream: true })
    const parsed = parseSseEvents(buffer)
    buffer = parsed.rest
    consumeEvents(parsed.events)
  }
  buffer += decoder.decode()
  if (buffer.trim()) consumeEvents(parseSseEvents(`${buffer}\n\n`).events)
  if (fullText.trim()) return fullText
  if (providerErrors.length) throw new Error(providerErrors[0])
  if (finishReason === 'length') {
    throw new Error('Text generation reached max_completion_tokens before returning assistant content. Disable thinking or increase the text-stage token budget.')
  }
  if (reasoningObserved) {
    throw new Error('Text generation returned reasoning but no assistant content. Disable thinking for final-output workflow stages.')
  }
  throw new Error(`Text generation stream ended without assistant content${finishReason ? ` (finish_reason: ${finishReason})` : ''}.`)
}
