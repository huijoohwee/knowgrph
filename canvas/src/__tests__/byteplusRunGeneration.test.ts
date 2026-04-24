import {
  CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
  CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT,
  CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT,
  CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT,
  CHAT_PROVIDER_BYTEPLUS,
  buildChatProxyHeaders,
  getDefaultChatModelForProvider,
  getDefaultGenerationModelForProvider,
  resolveBinaryDownloadProxyUrl,
  resolveChatUpstreamBaseForProxy,
  resolveBytePlusContentEndpointForRequest,
} from '@/lib/chatEndpoint'
import {
  generateRunImageWithBytePlus,
  generateRunMarkdownWithProvider,
  generateRunVideoWithBytePlus,
} from '@/features/chat/byteplusRunGeneration'

export function testBytePlusDefaultCatalogExposesSeedTextImageVideoModels() {
  if (getDefaultChatModelForProvider(CHAT_PROVIDER_BYTEPLUS) !== CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT) {
    throw new Error('expected BytePlus chat provider default model to resolve to the Seed text model')
  }
  if (getDefaultGenerationModelForProvider(CHAT_PROVIDER_BYTEPLUS, 'image') !== CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT) {
    throw new Error('expected BytePlus image generation default model to resolve to Seedream 5.0 Lite')
  }
  if (getDefaultGenerationModelForProvider(CHAT_PROVIDER_BYTEPLUS, 'video') !== CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT) {
    throw new Error('expected BytePlus video generation default model to resolve to Seedance 2.0')
  }
  if (
    resolveBytePlusContentEndpointForRequest({
      endpointUrl: CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
      path: '/api/v3/images/generations',
    }) !== '/__chat_proxy/api/v3/images/generations'
  ) {
    throw new Error('expected BytePlus content endpoints to resolve through the shared proxy path')
  }
  if (resolveBinaryDownloadProxyUrl('https://example.com/generated.mp4') !== '/__chat_asset_proxy?url=https%3A%2F%2Fexample.com%2Fgenerated.mp4') {
    throw new Error('expected binary asset downloads to resolve through the shared asset proxy path')
  }
}

export function testBytePlusProxyUpstreamRejectsOpenAiBase() {
  const openAiUpstream = resolveChatUpstreamBaseForProxy('https://api.openai.com/v1/chat/completions', CHAT_PROVIDER_BYTEPLUS)
  if (openAiUpstream !== null) {
    throw new Error(`expected BytePlus upstream resolver to reject OpenAI base, got ${String(openAiUpstream)}`)
  }
  const endpoint = resolveBytePlusContentEndpointForRequest({
    endpointUrl: 'https://api.openai.com/v1/chat/completions',
    path: '/api/v3/contents/generations/tasks',
  })
  if (endpoint !== '/__chat_proxy/api/v3/contents/generations/tasks') {
    throw new Error(`expected BytePlus content endpoints to fall back to BytePlus upstream base, got ${String(endpoint)}`)
  }
  const headers = buildChatProxyHeaders({
    provider: CHAT_PROVIDER_BYTEPLUS,
    apiKey: 'byteplus-key',
    endpointUrl: 'https://api.openai.com/v1/chat/completions',
    clientRequestId: 'kg-test-upstream',
  })
  if ('X-KG-Chat-Upstream' in headers) {
    throw new Error('expected BytePlus proxy headers to omit upstream override when endpointUrl points to OpenAI')
  }
}

export async function testGenerateRunMarkdownWithProviderUsesChatProxyResponse() {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/models')) {
        return {
          ok: true,
          json: async () => ({ data: [{ id: CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT }] }),
        } as Response
      }
      const body = JSON.parse(String(init?.body || '{}')) as { model?: string }
      if (url !== '/__chat_proxy/api/v3/chat/completions') {
        throw new Error(`unexpected chat endpoint: ${url}`)
      }
      if (body.model !== CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT) {
        throw new Error(`expected text generation to use the Seed text model, got ${String(body.model)}`)
      }
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: '# Final Output\n\nSpecific answer.' } }] }),
      } as Response
    }) as typeof fetch

    const text = await generateRunMarkdownWithProvider({
      config: {
        provider: CHAT_PROVIDER_BYTEPLUS,
        endpointUrl: CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
        apiKey: 'byteplus-key',
        chatModel: '',
      },
      prompt: 'Generate markdown',
    })
    if (text !== '# Final Output\n\nSpecific answer.') {
      throw new Error(`unexpected generated markdown: ${String(text)}`)
    }
  } finally {
    globalThis.fetch = originalFetch
  }
}

export async function testGenerateRunMarkdownWithProviderSupportsOpenAiResponsesApi() {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url !== '/__chat_proxy/v1/responses') {
        throw new Error(`unexpected openai responses endpoint: ${url}`)
      }
      const body = JSON.parse(String(init?.body || '{}')) as {
        model?: string
        input?: unknown
        instructions?: unknown
        messages?: unknown
      }
      if (!body.model) {
        throw new Error('expected responses request to include model')
      }
      if (typeof body.instructions !== 'string' || !body.instructions.trim()) {
        throw new Error('expected responses request to include instructions')
      }
      if (typeof body.input !== 'string' || !body.input.trim()) {
        throw new Error('expected responses request to use input text payload')
      }
      if (typeof body.messages !== 'undefined') {
        throw new Error('expected responses request to omit messages field')
      }
      return {
        ok: true,
        json: async () => ({
          output: [
            {
              type: 'message',
              role: 'assistant',
              content: [{ type: 'output_text', text: '# Final Output\n\nSpecific answer.' }],
            },
          ],
        }),
      } as Response
    }) as typeof fetch

    const text = await generateRunMarkdownWithProvider({
      config: {
        provider: 'openai',
        endpointUrl: 'https://api.openai.com/v1/responses',
        apiKey: '',
        chatModel: 'gpt-5.4-nano',
      },
      prompt: 'Generate markdown',
      options: {
        chatMaxCompletionTokens: 120,
      },
    })
    if (text !== '# Final Output\n\nSpecific answer.') {
      throw new Error(`unexpected generated markdown from responses: ${String(text)}`)
    }
  } finally {
    globalThis.fetch = originalFetch
  }
}

export async function testGenerateRunMarkdownWithProviderStreamsChatCompletionText() {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/models')) {
        return {
          ok: true,
          json: async () => ({ data: [{ id: CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT }] }),
        } as Response
      }
      const body = JSON.parse(String(init?.body || '{}')) as { stream?: unknown }
      if (url !== '/__chat_proxy/api/v3/chat/completions') {
        throw new Error(`unexpected chat endpoint: ${url}`)
      }
      if (body.stream !== true) {
        throw new Error('expected run markdown generation to request streaming text output')
      }
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"# Final"}}]}\n\n'))
          controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":" Output\\n\\nSpecific answer."}}]}\n\n'))
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
          controller.close()
        },
      })
      return new Response(stream, {
        headers: { 'content-type': 'text/event-stream' },
      })
    }) as typeof fetch

    const chunks: string[] = []
    const text = await generateRunMarkdownWithProvider({
      config: {
        provider: CHAT_PROVIDER_BYTEPLUS,
        endpointUrl: CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
        apiKey: 'byteplus-key',
        chatModel: '',
      },
      prompt: 'Generate markdown',
      options: {
        onText: next => chunks.push(next),
      },
    })
    if (text !== '# Final Output\n\nSpecific answer.') {
      throw new Error(`unexpected streamed markdown: ${String(text)}`)
    }
    if (chunks.join(' | ') !== '# Final | # Final Output\n\nSpecific answer.') {
      throw new Error(`unexpected streamed text snapshots: ${chunks.join(' | ')}`)
    }
  } finally {
    globalThis.fetch = originalFetch
  }
}

export async function testGenerateRunMarkdownWithProviderStreamsOpenAiResponsesText() {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url !== '/__chat_proxy/v1/responses') {
        throw new Error(`unexpected openai responses endpoint: ${url}`)
      }
      const body = JSON.parse(String(init?.body || '{}')) as { stream?: unknown }
      if (body.stream !== true) {
        throw new Error('expected openai responses run markdown generation to request streaming text output')
      }
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"type":"response.output_text.delta","delta":"# Final"}\n\n'))
          controller.enqueue(new TextEncoder().encode('data: {"type":"response.output_text.delta","delta":" Output\\n\\nSpecific answer."}\n\n'))
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
          controller.close()
        },
      })
      return new Response(stream, {
        headers: { 'content-type': 'text/event-stream' },
      })
    }) as typeof fetch

    const chunks: string[] = []
    const text = await generateRunMarkdownWithProvider({
      config: {
        provider: 'openai',
        endpointUrl: 'https://api.openai.com/v1/responses',
        apiKey: '',
        chatModel: 'gpt-5.4-nano',
      },
      prompt: 'Generate markdown',
      options: {
        onText: next => chunks.push(next),
      },
    })
    if (text !== '# Final Output\n\nSpecific answer.') {
      throw new Error(`unexpected streamed responses markdown: ${String(text)}`)
    }
    if (chunks.join(' | ') !== '# Final | # Final Output\n\nSpecific answer.') {
      throw new Error(`unexpected streamed responses snapshots: ${chunks.join(' | ')}`)
    }
  } finally {
    globalThis.fetch = originalFetch
  }
}

export async function testGenerateRunImageWithBytePlusAcceptsBase64Payload() {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/models')) {
        return {
          ok: true,
          json: async () => ({ data: [{ id: CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT }] }),
        } as Response
      }
      const body = JSON.parse(String(init?.body || '{}')) as { model?: string; response_format?: string }
      if (url !== '/__chat_proxy/api/v3/images/generations') {
        throw new Error(`unexpected image endpoint: ${url}`)
      }
      if (body.model !== CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT || body.response_format !== 'b64_json') {
        throw new Error(`unexpected image generation payload: ${JSON.stringify(body)}`)
      }
      return {
        ok: true,
        json: async () => ({ data: [{ b64_json: 'iVBORw0KGgo=' }] }),
      } as Response
    }) as typeof fetch

    const result = await generateRunImageWithBytePlus({
      config: {
        provider: CHAT_PROVIDER_BYTEPLUS,
        endpointUrl: CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
        apiKey: 'byteplus-key',
      },
      prompt: 'Generate image',
    })
    if (!result || result.blob.type !== 'image/png' || result.blob.size === 0) {
      throw new Error('expected BytePlus image generation helper to decode a PNG blob from base64 payloads')
    }
    if (!String(result.renderUrl || '').startsWith('data:image/png;base64,')) {
      throw new Error('expected base64-backed image responses to expose a renderable data URL')
    }
  } finally {
    globalThis.fetch = originalFetch
  }
}

export async function testGenerateRunImageWithBytePlusDownloadsUrlThroughAssetProxy() {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/models')) {
        return {
          ok: true,
          json: async () => ({ data: [{ id: CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT }] }),
        } as Response
      }
      if (url === '/__chat_proxy/api/v3/images/generations') {
        return {
          ok: true,
          json: async () => ({ data: [{ url: 'https://example.com/generated-image.png' }] }),
        } as Response
      }
      if (url === '/__chat_asset_proxy?url=https%3A%2F%2Fexample.com%2Fgenerated-image.png') {
        if (String(init?.method || 'GET').toUpperCase() !== 'GET') {
          throw new Error('expected asset proxy download to use GET')
        }
        return {
          ok: true,
          blob: async () => new Blob([Uint8Array.from([137, 80, 78, 71])], { type: 'image/png' }),
        } as Response
      }
      throw new Error(`unexpected image asset fetch request: ${url}`)
    }) as typeof fetch

    const result = await generateRunImageWithBytePlus({
      config: {
        provider: CHAT_PROVIDER_BYTEPLUS,
        endpointUrl: CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
        apiKey: 'byteplus-key',
      },
      prompt: 'Generate image from URL payload',
    })
    if (!result || result.blob.type !== 'image/png' || result.blob.size === 0) {
      throw new Error('expected BytePlus image generation helper to download URL-based image payloads through the shared asset proxy')
    }
    if (result.renderUrl !== '/__chat_asset_proxy?url=https%3A%2F%2Fexample.com%2Fgenerated-image.png') {
      throw new Error(`expected image render URL to use shared asset proxy, got ${String(result.renderUrl)}`)
    }
  } finally {
    globalThis.fetch = originalFetch
  }
}

export async function testGenerateRunVideoWithBytePlusPollsTaskAndDownloadsBlob() {
  const originalFetch = globalThis.fetch
  try {
    let statusCalls = 0
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/models')) {
        return {
          ok: true,
          json: async () => ({ data: [{ id: CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT }] }),
        } as Response
      }
      if (url === '/__chat_proxy/api/v3/contents/generations/tasks' && String(init?.method || 'GET').toUpperCase() === 'POST') {
        const body = JSON.parse(String(init?.body || '{}')) as {
          content?: Array<{ type?: string; image_url?: { url?: string } }>
          ratio?: string
          duration?: number
          generate_audio?: boolean
        }
        if (body.ratio !== '9:16' || body.duration !== 6 || body.generate_audio !== true) {
          throw new Error(`expected video generation options to map onto the BytePlus task request: ${JSON.stringify(body)}`)
        }
        const imageRef = Array.isArray(body.content)
          ? body.content.find(item => item && item.type === 'image_url')
          : null
        if (imageRef?.image_url?.url !== 'https://example.com/reference.png') {
          throw new Error('expected reference image URL to be forwarded into the BytePlus video task payload')
        }
        return {
          ok: true,
          json: async () => ({ id: 'task-123' }),
        } as Response
      }
      if (url === '/__chat_proxy/api/v3/contents/generations/tasks/task-123') {
        statusCalls += 1
        return {
          ok: true,
          json: async () => (
            statusCalls < 2
              ? { status: 'running' }
              : { status: 'succeeded', data: { video_url: 'https://example.com/generated.mp4' } }
          ),
        } as Response
      }
      if (url === '/__chat_asset_proxy?url=https%3A%2F%2Fexample.com%2Fgenerated.mp4') {
        return {
          ok: true,
          blob: async () => new Blob([Uint8Array.from([0, 1, 2, 3])], { type: 'video/mp4' }),
        } as Response
      }
      throw new Error(`unexpected fetch request: ${url}`)
    }) as typeof fetch

    const result = await generateRunVideoWithBytePlus({
      config: {
        provider: CHAT_PROVIDER_BYTEPLUS,
        endpointUrl: CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
        apiKey: 'byteplus-key',
      },
      prompt: 'Generate video',
      options: {
        aspectRatio: 'portrait',
        duration: 6,
        generateAudio: true,
        referenceImageUrl: 'https://example.com/reference.png',
      },
    })
    if (!result || result.blob.type !== 'video/mp4' || result.blob.size === 0) {
      throw new Error('expected BytePlus video generation helper to poll the task and download the final MP4 blob')
    }
    if (result.renderUrl !== '/__chat_asset_proxy?url=https%3A%2F%2Fexample.com%2Fgenerated.mp4') {
      throw new Error(`expected video render URL to use shared asset proxy, got ${String(result.renderUrl)}`)
    }
  } finally {
    globalThis.fetch = originalFetch
  }
}
