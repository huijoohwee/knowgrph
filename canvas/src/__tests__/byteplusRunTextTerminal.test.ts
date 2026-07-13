import { generateRunMarkdownWithProvider } from '@/features/chat/byteplusRunGeneration'
import {
  CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
  CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT,
  CHAT_PROVIDER_BYTEPLUS,
} from '@/lib/chatEndpoint'

export async function testBytePlusRunTextReportsReasoningOnlyLengthTerminal() {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/models')) {
        return new Response(JSON.stringify({ data: [{ id: CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT }] }), {
          headers: { 'content-type': 'application/json' },
        })
      }
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"reasoning_content":"Planning"}}]}\n\n'))
          controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{},"finish_reason":"length"}],"usage":{"completion_tokens":1000}}\n\n'))
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
          controller.close()
        },
      })
      return new Response(stream, { headers: { 'content-type': 'text/event-stream' } })
    }) as typeof fetch

    let failure = ''
    try {
      await generateRunMarkdownWithProvider({
        config: {
          provider: CHAT_PROVIDER_BYTEPLUS,
          endpointUrl: CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
          apiKey: 'test-key',
          chatModel: CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT,
        },
        prompt: 'Generate the final artifact.',
      })
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error)
    }
    if (!failure.includes('max_completion_tokens') || !failure.includes('Disable thinking')) {
      throw new Error(`expected actionable reasoning-only terminal detail, got ${JSON.stringify(failure)}`)
    }
  } finally {
    globalThis.fetch = originalFetch
  }
}

export async function testBytePlusRunTextRejectsMissingEndpointBeforeFetch() {
  const originalFetch = globalThis.fetch
  let fetchCount = 0
  try {
    globalThis.fetch = (async () => {
      fetchCount += 1
      throw new Error('fetch must not run')
    }) as typeof fetch
    let failure = ''
    try {
      await generateRunMarkdownWithProvider({
        config: { provider: CHAT_PROVIDER_BYTEPLUS, endpointUrl: '', apiKey: 'test-key' },
        prompt: 'Generate the final artifact.',
      })
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error)
    }
    if (!failure.includes('endpoint is unavailable') || fetchCount !== 0) {
      throw new Error(`expected typed missing-endpoint failure before fetch, got ${JSON.stringify({ failure, fetchCount })}`)
    }
  } finally {
    globalThis.fetch = originalFetch
  }
}

export async function testBytePlusRunTextReportsEmptySuccessfulJsonWithoutRawParserFailure() {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/models')) {
        return new Response(JSON.stringify({ data: [{ id: CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT }] }), {
          headers: { 'content-type': 'application/json' },
        })
      }
      return new Response('', { status: 200, headers: { 'content-type': 'application/json' } })
    }) as typeof fetch

    let failure = ''
    try {
      await generateRunMarkdownWithProvider({
        config: {
          provider: CHAT_PROVIDER_BYTEPLUS,
          endpointUrl: CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
          apiKey: 'test-key',
          chatModel: CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT,
        },
        prompt: 'Generate the final artifact.',
        options: { chatStream: false },
      })
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error)
    }
    if (!failure.includes('Run text generation returned an empty JSON response')) {
      throw new Error(`expected typed empty JSON failure, got ${JSON.stringify(failure)}`)
    }
    if (failure.includes('Unexpected end of JSON input')) {
      throw new Error(`expected raw Response.json failure to be eliminated, got ${JSON.stringify(failure)}`)
    }
  } finally {
    globalThis.fetch = originalFetch
  }
}

export async function testBytePlusRunTextReportsTruncatedSuccessfulJsonWithoutRetrying() {
  const originalFetch = globalThis.fetch
  let generationRequests = 0
  try {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/models')) {
        return new Response(JSON.stringify({ data: [{ id: CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT }] }), {
          headers: { 'content-type': 'application/json' },
        })
      }
      generationRequests += 1
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.error(new Error('upstream terminated'))
        },
      })
      return new Response(stream, { status: 200, headers: { 'content-type': 'application/json' } })
    }) as typeof fetch

    let failure = ''
    try {
      await generateRunMarkdownWithProvider({
        config: {
          provider: CHAT_PROVIDER_BYTEPLUS,
          endpointUrl: CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
          apiKey: 'test-key',
          chatModel: CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT,
        },
        prompt: 'Generate the final artifact.',
        options: { chatStream: false },
      })
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error)
    }
    if (!failure.includes('Run text generation returned a truncated response body')) {
      throw new Error(`expected typed truncated-body failure, got ${JSON.stringify(failure)}`)
    }
    if (generationRequests !== 1) {
      throw new Error(`expected no automatic retry after an ambiguous provider response, got ${generationRequests} requests`)
    }
  } finally {
    globalThis.fetch = originalFetch
  }
}
