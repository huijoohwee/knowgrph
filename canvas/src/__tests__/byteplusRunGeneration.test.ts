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
  resolveBytePlusVideoModelPreview,
} from '@/features/chat/byteplusRunGeneration'

export function testBytePlusDefaultCatalogExposesSeedTextImageVideoModels() {
  if (getDefaultChatModelForProvider(CHAT_PROVIDER_BYTEPLUS) !== CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT) {
    throw new Error('expected BytePlus chat provider default model to resolve to the Seed text model')
  }
  if (getDefaultGenerationModelForProvider(CHAT_PROVIDER_BYTEPLUS, 'image') !== CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT) {
    throw new Error('expected BytePlus image generation default model to resolve to ByteDance-Seedream-4.0')
  }
  if (getDefaultGenerationModelForProvider(CHAT_PROVIDER_BYTEPLUS, 'video') !== CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT) {
    throw new Error('expected BytePlus video generation default model to resolve to ByteDance-Seedance-1.0-pro-fast')
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
          json: async () => ({ data: [{ id: 'seedream-4-0-250828' }] }),
        } as Response
      }
      const body = JSON.parse(String(init?.body || '{}')) as {
        model?: string
        response_format?: string
        size?: string
        output_format?: string
        watermark?: boolean
        seed?: number
        guidance_scale?: number
        image?: string
      }
      if (url !== '/__chat_proxy/api/v3/images/generations') {
        throw new Error(`unexpected image endpoint: ${url}`)
      }
      if (
        body.model !== 'seedream-4-0-250828'
        || body.response_format !== 'b64_json'
        || body.size !== '4K'
        || body.output_format !== 'png'
        || body.watermark !== true
        || body.seed !== 123
        || body.guidance_scale !== 6.5
        || body.image !== 'https://example.com/reference-image.png'
      ) {
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
      options: {
        size: '4K',
        outputFormat: 'png',
        watermark: true,
        seed: 123,
        guidanceScale: 6.5,
        referenceImageUrl: 'https://example.com/reference-image.png',
      },
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
          json: async () => ({ data: [{ id: 'seedream-4-0-250828' }] }),
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

export async function testGenerateRunImageWithBytePlusRetriesActivatedCuratedFallback() {
  const originalFetch = globalThis.fetch
  const attemptedModels: string[] = []
  try {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/models')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              { id: 'seedream-4-0-250828' },
              { id: 'seedream-4-5-250923' },
              { id: 'dola-seedream-5-0-lite-250821' },
            ],
          }),
        } as Response
      }
      if (url !== '/__chat_proxy/api/v3/images/generations') {
        throw new Error(`unexpected image endpoint: ${url}`)
      }
      const body = JSON.parse(String(init?.body || '{}')) as { model?: string; response_format?: string }
      attemptedModels.push(String(body.model || ''))
      if (body.model === 'seedream-4-0-250828') {
        return new Response(JSON.stringify({
          error: {
            message: 'Your account %!s(int64=3000548466) has not activated the model seedream-4-0-250828. Please activate the model service in the Ark Console.',
          },
        }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        })
      }
      if (body.model === 'seedream-4-5-250923') {
        return new Response(JSON.stringify({ data: [{ b64_json: 'iVBORw0KGgo=' }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      throw new Error(`unexpected fallback model attempt ${String(body.model)}`)
    }) as typeof fetch

    const result = await generateRunImageWithBytePlus({
      config: {
        provider: CHAT_PROVIDER_BYTEPLUS,
        endpointUrl: CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
        apiKey: 'byteplus-key',
      },
      prompt: 'Generate image',
      options: {
        model: CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT,
      },
    })
    if (!result) {
      throw new Error('expected image generation to succeed after trying an activated curated fallback model')
    }
    if (result.model !== 'seedream-4-5-250923') {
      throw new Error(`expected image generation to return the activated fallback model id, got ${String(result.model)}`)
    }
    if (attemptedModels.join(' -> ') !== 'seedream-4-0-250828 -> seedream-4-5-250923') {
      throw new Error(`expected activation fallback attempts to retry the next curated model, got ${attemptedModels.join(' -> ')}`)
    }
  } finally {
    globalThis.fetch = originalFetch
  }
}

export async function testGenerateRunImageWithBytePlusSkipsUnmatchedDisplayAliasFallback() {
  const originalFetch = globalThis.fetch
  const attemptedModels: string[] = []
  try {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/models')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              { id: 'seedream-4-0-250828' },
              { id: 'seedream-4-5-251128' },
            ],
          }),
        } as Response
      }
      if (url !== '/__chat_proxy/api/v3/images/generations') {
        throw new Error(`unexpected image endpoint: ${url}`)
      }
      const body = JSON.parse(String(init?.body || '{}')) as { model?: string }
      attemptedModels.push(String(body.model || ''))
      if (body.model === 'seedream-4-0-250828' || body.model === 'seedream-4-5-251128') {
        return new Response(JSON.stringify({
          error: {
            message: `The model or endpoint ${String(body.model)} does not exist or you do not have access to it.`,
          },
        }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        })
      }
      throw new Error(`runner should not send unresolved display alias fallback ${String(body.model)}`)
    }) as typeof fetch

    let errorText = ''
    try {
      await generateRunImageWithBytePlus({
        config: {
          provider: CHAT_PROVIDER_BYTEPLUS,
          endpointUrl: CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
          apiKey: 'byteplus-key',
        },
        prompt: 'Generate image',
        options: {
          model: CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT,
        },
      })
    } catch (error) {
      errorText = error instanceof Error ? error.message : String(error || '')
    }

    if (!errorText.includes('Attempted resolved models: seedream-4-0-250828, seedream-4-5-251128')) {
      throw new Error(`expected failure to report only verified /models fallback attempts, got ${errorText}`)
    }
    if (errorText.includes('Dola-Seedream-5.0-lite')) {
      throw new Error(`expected unmatched display alias fallback to be skipped, got ${errorText}`)
    }
    if (attemptedModels.join(' -> ') !== 'seedream-4-0-250828 -> seedream-4-5-251128') {
      throw new Error(`expected only verified /models candidates to be attempted, got ${attemptedModels.join(' -> ')}`)
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
          watermark?: boolean
        }
        if (body.ratio !== '9:16' || body.duration !== 6 || body.generate_audio !== true || body.watermark !== true) {
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
              : { status: 'succeeded', content: { video_url: 'https://example.com/generated.mp4' } }
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
        contentJson: JSON.stringify([{ type: 'text', text: 'Widget-local content override' }]),
        aspectRatio: 'portrait',
        duration: 6,
        generateAudio: true,
        watermark: true,
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

export async function testGenerateRunVideoWithBytePlusCompletesAfterExtendedPollingWindow() {
  const originalFetch = globalThis.fetch
  const originalSetTimeout = globalThis.setTimeout
  try {
    let statusCalls = 0
    globalThis.setTimeout = ((handler: TimerHandler) => {
      if (typeof handler === 'function') {
        handler()
      }
      return 0 as unknown as ReturnType<typeof setTimeout>
    }) as typeof globalThis.setTimeout
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/models')) {
        return {
          ok: true,
          json: async () => ({ data: [{ id: 'seedance-1-5-pro-251215' }] }),
        } as Response
      }
      if (url === '/__chat_proxy/api/v3/contents/generations/tasks' && String(init?.method || 'GET').toUpperCase() === 'POST') {
        return {
          ok: true,
          json: async () => ({ id: 'task-extended-window' }),
        } as Response
      }
      if (url === '/__chat_proxy/api/v3/contents/generations/tasks/task-extended-window') {
        statusCalls += 1
        return {
          ok: true,
          json: async () => (
            statusCalls < 23
              ? { status: 'running', updated_at: 1765510559 + statusCalls }
              : { status: 'succeeded', content: { video_url: 'https://example.com/extended-window.mp4' }, updated_at: 1765510600 }
          ),
        } as Response
      }
      if (url === '/__chat_asset_proxy?url=https%3A%2F%2Fexample.com%2Fextended-window.mp4') {
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
      prompt: 'Generate longer video',
      options: {
        model: 'ByteDance-Seedance-1.5-pro',
      },
    })
    if (!result || result.renderUrl !== '/__chat_asset_proxy?url=https%3A%2F%2Fexample.com%2Fextended-window.mp4') {
      throw new Error('expected BytePlus video helper to keep polling long enough to complete a legitimate longer-running task')
    }
    if (statusCalls !== 23) {
      throw new Error(`expected extended polling window to reach the later succeeded response, got ${String(statusCalls)} status calls`)
    }
  } finally {
    globalThis.fetch = originalFetch
    globalThis.setTimeout = originalSetTimeout
  }
}

export async function testGenerateRunVideoWithBytePlusPrefersWidgetContentJsonOverride() {
  const originalFetch = globalThis.fetch
  try {
    let createRequestCount = 0
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/models')) {
        return {
          ok: true,
          json: async () => ({ data: [{ id: CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT }] }),
        } as Response
      }
      if (url === '/__chat_proxy/api/v3/contents/generations/tasks' && String(init?.method || 'GET').toUpperCase() === 'POST') {
        createRequestCount += 1
        const body = JSON.parse(String(init?.body || '{}')) as {
          content?: Array<{ type?: string; text?: string }>
        }
        const firstContent = Array.isArray(body.content) ? body.content[0] : null
        if (firstContent?.text !== 'Widget-local content override') {
          throw new Error(`expected widget-local content_json override to win over generated/default content, got ${JSON.stringify(body.content)}`)
        }
        return {
          ok: true,
          json: async () => ({ id: 'task-widget-content' }),
        } as Response
      }
      if (url === '/__chat_proxy/api/v3/contents/generations/tasks/task-widget-content') {
        return {
          ok: true,
          json: async () => ({ status: 'succeeded', data: { video_url: 'https://example.com/widget-content.mp4' } }),
        } as Response
      }
      if (url === '/__chat_asset_proxy?url=https%3A%2F%2Fexample.com%2Fwidget-content.mp4') {
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
      prompt: 'Generated prompt fallback',
      options: {
        contentJson: JSON.stringify([{ type: 'text', text: 'Widget-local content override' }]),
      },
    })
    if (!result || result.blob.type !== 'video/mp4') {
      throw new Error('expected BytePlus video generation helper to complete when using widget-local content_json override')
    }
    if (createRequestCount !== 1) {
      throw new Error(`expected one task creation request, got ${String(createRequestCount)}`)
    }
  } finally {
    globalThis.fetch = originalFetch
  }
}

export async function testGenerateRunVideoWithBytePlusResolvesCanonicalVideoAliasToAvailableModelId() {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/models')) {
        return {
          ok: true,
          json: async () => ({ data: [{ id: 'seedance-1-5-pro-250918' }] }),
        } as Response
      }
      if (url === '/__chat_proxy/api/v3/contents/generations/tasks' && String(init?.method || 'GET').toUpperCase() === 'POST') {
        const body = JSON.parse(String(init?.body || '{}')) as { model?: string }
        if (body.model !== 'seedance-1-5-pro-250918') {
          throw new Error(`expected canonical ByteDance alias to resolve to available endpoint model id, got ${String(body.model)}`)
        }
        return {
          ok: true,
          json: async () => ({ id: 'task-alias-resolve' }),
        } as Response
      }
      if (url === '/__chat_proxy/api/v3/contents/generations/tasks/task-alias-resolve') {
        return {
          ok: true,
          json: async () => ({ status: 'succeeded', data: { video_url: 'https://example.com/alias-resolve.mp4' } }),
        } as Response
      }
      if (url === '/__chat_asset_proxy?url=https%3A%2F%2Fexample.com%2Falias-resolve.mp4') {
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
        model: 'ByteDance-Seedance-1.5-pro',
      },
    })
    if (!result || result.blob.type !== 'video/mp4') {
      throw new Error('expected BytePlus video generation helper to complete when canonical alias resolves to an available model id')
    }
  } finally {
    globalThis.fetch = originalFetch
  }
}

export async function testResolveBytePlusVideoModelPreviewExposesResolvedCandidate() {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/models')) {
        return {
          ok: true,
          json: async () => ({ data: [{ id: 'seedance-1-0-pro-fast-250601' }, { id: 'seedance-1-5-pro-250918' }] }),
        } as Response
      }
      throw new Error(`unexpected fetch request: ${url}`)
    }) as typeof fetch

    const preview = await resolveBytePlusVideoModelPreview(
      {
        provider: CHAT_PROVIDER_BYTEPLUS,
        endpointUrl: CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
        apiKey: 'byteplus-key',
      },
      'ByteDance-Seedance-1.5-pro',
      { fast: false },
    )
    if (preview.preferredModel !== 'ByteDance-Seedance-1.5-pro') {
      throw new Error(`expected preview to preserve preferred canonical model label, got ${String(preview.preferredModel)}`)
    }
    if (preview.resolvedModel !== 'seedance-1-5-pro-250918') {
      throw new Error(`expected preview to expose resolved /models candidate, got ${String(preview.resolvedModel)}`)
    }
    if (preview.matchedAvailableModel !== true) {
      throw new Error('expected preview to report that the resolved model came from BytePlus /models')
    }
    if (preview.availableCount !== 2) {
      throw new Error(`expected preview to report available model count, got ${String(preview.availableCount)}`)
    }
  } finally {
    globalThis.fetch = originalFetch
  }
}

export async function testResolveBytePlusVideoModelPreviewDoesNotFalseMatchDateSuffixVariant() {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/models')) {
        return {
          ok: true,
          json: async () => ({ data: [{ id: 'seedance-1-0-pro-fast-251015' }] }),
        } as Response
      }
      throw new Error(`unexpected fetch request: ${url}`)
    }) as typeof fetch

    const preview = await resolveBytePlusVideoModelPreview(
      {
        provider: CHAT_PROVIDER_BYTEPLUS,
        endpointUrl: CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
        apiKey: 'byteplus-key',
      },
      'ByteDance-Seedance-1.5-pro',
      { fast: false },
    )
    if (preview.resolvedModel !== 'ByteDance-Seedance-1.5-pro') {
      throw new Error(`expected resolver to avoid false 1.5 -> 1.0-fast date-suffix match, got ${String(preview.resolvedModel)}`)
    }
    if (preview.matchedAvailableModel !== false) {
      throw new Error('expected resolver to report no accessible family match when only a wrong date-suffixed variant is returned')
    }
  } finally {
    globalThis.fetch = originalFetch
  }
}

export async function testGenerateRunVideoWithBytePlusCreateFailureIncludesActionableFixDetail() {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/models')) {
        return {
          ok: true,
          json: async () => ({ data: [{ id: 'seedance-1-5-pro-250918' }] }),
        } as Response
      }
      if (url === '/__chat_proxy/api/v3/contents/generations/tasks') {
        return {
          ok: false,
          status: 400,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ error: { message: 'The model or endpoint seedance-1-5-pro-250918 does not exist or you do not have access to it.' } }),
        } as Response
      }
      throw new Error(`unexpected fetch request: ${url}`)
    }) as typeof fetch

    let errorText = ''
    try {
      await generateRunVideoWithBytePlus({
        config: {
          provider: CHAT_PROVIDER_BYTEPLUS,
          endpointUrl: CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
          apiKey: 'byteplus-key',
        },
        prompt: 'Generate video',
        options: {
          model: 'ByteDance-Seedance-1.5-pro',
        },
      })
    } catch (error) {
      errorText =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message || '')
          : String(error || '')
    }
    if (!errorText.includes('BytePlus video run failed:')) {
      throw new Error(`expected actionable BytePlus failure prefix, got ${JSON.stringify(errorText)}`)
    }
    if (!errorText.includes('Selected video model: ByteDance-Seedance-1.5-pro')) {
      throw new Error(`expected selected video model detail in failure message, got ${JSON.stringify(errorText)}`)
    }
    if (!errorText.includes('Resolved /models candidate: seedance-1-5-pro-250918')) {
      throw new Error(`expected resolved candidate detail in failure message, got ${JSON.stringify(errorText)}`)
    }
    if (!errorText.includes('Fix:')) {
      throw new Error(`expected actionable fix guidance in failure message, got ${JSON.stringify(errorText)}`)
    }
  } finally {
    globalThis.fetch = originalFetch
  }
}

export async function testGenerateRunVideoWithBytePlusTaskFailureIncludesActionableFixDetail() {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/models')) {
        return {
          ok: true,
          json: async () => ({ data: [{ id: 'seedance-1-5-pro-250918' }] }),
        } as Response
      }
      if (url === '/__chat_proxy/api/v3/contents/generations/tasks' && String(init?.method || 'GET').toUpperCase() === 'POST') {
        return {
          ok: true,
          json: async () => ({ id: 'task-failed-detail' }),
        } as Response
      }
      if (url === '/__chat_proxy/api/v3/contents/generations/tasks/task-failed-detail') {
        return {
          ok: true,
          json: async () => ({
            status: 'failed',
            error: { message: 'Content moderation blocked this prompt.' },
          }),
        } as Response
      }
      throw new Error(`unexpected fetch request: ${url}`)
    }) as typeof fetch

    let errorText = ''
    try {
      await generateRunVideoWithBytePlus({
        config: {
          provider: CHAT_PROVIDER_BYTEPLUS,
          endpointUrl: CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
          apiKey: 'byteplus-key',
        },
        prompt: 'Generate video',
        options: {
          model: 'ByteDance-Seedance-1.5-pro',
        },
      })
    } catch (error) {
      errorText =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message || '')
          : String(error || '')
    }
    if (!errorText.includes('Content moderation blocked this prompt.')) {
      throw new Error(`expected task failure reason to survive into the actionable log detail, got ${JSON.stringify(errorText)}`)
    }
    if (!errorText.includes('Selected video model: ByteDance-Seedance-1.5-pro')) {
      throw new Error(`expected selected model context in task failure detail, got ${JSON.stringify(errorText)}`)
    }
    if (!errorText.includes('Fix:')) {
      throw new Error(`expected actionable fix guidance for task failure detail, got ${JSON.stringify(errorText)}`)
    }
  } finally {
    globalThis.fetch = originalFetch
  }
}
