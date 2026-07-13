import {
  BYTEPLUS_VIDEO_POLL_BOUNDED_WINDOW_MS,
  BYTEPLUS_VIDEO_POLL_MAX_ATTEMPTS,
  generateRunVideoWithBytePlus,
} from '@/features/chat/byteplusRunGeneration'
import {
  CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
  CHAT_PROVIDER_BYTEPLUS,
} from '@/lib/chatEndpoint'

export async function testGenerateRunVideoWithBytePlusCompletesAfterExtendedPollingWindow() {
  if (BYTEPLUS_VIDEO_POLL_MAX_ATTEMPTS !== 60 || BYTEPLUS_VIDEO_POLL_BOUNDED_WINDOW_MS !== 590000) {
    throw new Error(`expected 60 attempts across a 590-second bounded polling window, got ${String(BYTEPLUS_VIDEO_POLL_MAX_ATTEMPTS)} attempts and ${String(BYTEPLUS_VIDEO_POLL_BOUNDED_WINDOW_MS)}ms`)
  }
  const originalFetch = globalThis.fetch
  const originalSetTimeout = globalThis.setTimeout
  try {
    let statusCalls = 0
    const pollDelays: number[] = []
    globalThis.setTimeout = ((handler: TimerHandler, timeout?: number) => {
      pollDelays.push(timeout ?? 0)
      if (typeof handler === 'function') handler()
      return 0 as unknown as ReturnType<typeof setTimeout>
    }) as typeof globalThis.setTimeout
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/models')) {
        return { ok: true, json: async () => ({ data: [{ id: 'seedance-1-5-pro-251215' }] }) } as Response
      }
      if (url === '/__chat_proxy/api/v3/contents/generations/tasks' && String(init?.method || 'GET').toUpperCase() === 'POST') {
        return { ok: true, json: async () => ({ id: 'task-extended-window' }) } as Response
      }
      if (url === '/__chat_proxy/api/v3/contents/generations/tasks/task-extended-window') {
        statusCalls += 1
        return {
          ok: true,
          json: async () => statusCalls < 30
            ? { status: 'running', updated_at: 1765510559 + statusCalls }
            : { status: 'succeeded', content: { video_url: 'https://example.com/extended-window.mp4' }, updated_at: 1765510600 },
        } as Response
      }
      if (url === '/__chat_asset_proxy?url=https%3A%2F%2Fexample.com%2Fextended-window.mp4') {
        return { ok: true, blob: async () => new Blob([Uint8Array.from([0, 1, 2, 3])], { type: 'video/mp4' }) } as Response
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
      options: { model: 'ByteDance-Seedance-1.5-pro' },
    })
    if (!result || result.renderUrl !== '/__chat_asset_proxy?url=https%3A%2F%2Fexample.com%2Fextended-window.mp4') {
      throw new Error('expected BytePlus video helper to keep polling long enough to complete a legitimate longer-running task')
    }
    if (statusCalls !== 30) {
      throw new Error(`expected extended polling window to reach the later succeeded response, got ${String(statusCalls)} status calls`)
    }
    if (pollDelays.length !== 29 || pollDelays.some(delayMs => delayMs !== 10000)) {
      throw new Error(`expected every pending retry to use the documented 10-second interval, got ${JSON.stringify(pollDelays)}`)
    }
  } finally {
    globalThis.fetch = originalFetch
    globalThis.setTimeout = originalSetTimeout
  }
}
