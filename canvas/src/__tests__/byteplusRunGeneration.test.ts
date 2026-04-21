import {
  CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
  CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT,
  CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT,
  CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT,
  CHAT_PROVIDER_BYTEPLUS,
  getDefaultChatModelForProvider,
  getDefaultGenerationModelForProvider,
  resolveBinaryDownloadProxyUrl,
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

    const blob = await generateRunImageWithBytePlus({
      config: {
        provider: CHAT_PROVIDER_BYTEPLUS,
        endpointUrl: CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
        apiKey: 'byteplus-key',
      },
      prompt: 'Generate image',
    })
    if (!blob || blob.type !== 'image/png' || blob.size === 0) {
      throw new Error('expected BytePlus image generation helper to decode a PNG blob from base64 payloads')
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

    const blob = await generateRunImageWithBytePlus({
      config: {
        provider: CHAT_PROVIDER_BYTEPLUS,
        endpointUrl: CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
        apiKey: 'byteplus-key',
      },
      prompt: 'Generate image from URL payload',
    })
    if (!blob || blob.type !== 'image/png' || blob.size === 0) {
      throw new Error('expected BytePlus image generation helper to download URL-based image payloads through the shared asset proxy')
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

    const blob = await generateRunVideoWithBytePlus({
      config: {
        provider: CHAT_PROVIDER_BYTEPLUS,
        endpointUrl: CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
        apiKey: 'byteplus-key',
      },
      prompt: 'Generate video',
    })
    if (!blob || blob.type !== 'video/mp4' || blob.size === 0) {
      throw new Error('expected BytePlus video generation helper to poll the task and download the final MP4 blob')
    }
  } finally {
    globalThis.fetch = originalFetch
  }
}
