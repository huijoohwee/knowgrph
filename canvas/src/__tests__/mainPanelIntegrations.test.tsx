import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import MainPanel from '@/features/panels/MainPanel'
import IntegrationsHubView from '@/features/panels/views/IntegrationsHubView'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  CHAT_BYTEPLUS_AP_SOUTHEAST_BASE,
  CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT,
  CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT,
} from '@/lib/chatEndpoint'

const waitForFrames = async (raf: ((cb: (ts: number) => void) => number) | undefined, count = 3) => {
  for (let i = 0; i < count; i += 1) {
    await new Promise<void>(resolve => {
      if (typeof raf === 'function') raf(() => resolve())
      else setTimeout(() => resolve(), 0)
    })
  }
}

const renderAndFlush = async (
  root: ReturnType<typeof createRoot>,
  node: React.ReactNode,
  raf: ((cb: (ts: number) => void) => number) | undefined,
  frameCount = 3,
) => {
  await act(async () => {
    root.render(node)
    await waitForFrames(raf, frameCount)
  })
}

const unmountAndFlush = async (root: ReturnType<typeof createRoot> | null) => {
  if (!root) return
  await act(async () => {
    root.unmount()
  })
}

export async function testIntegrationsHubReusesSettingsEntryList() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
      setTimeout(() => cb(Date.now()), 0) as unknown as number
    ;(globalThis as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }).requestAnimationFrame =
      anyWindow.requestAnimationFrame

    const api = useGraphStore.getState()
    api.resetAll()
    api.setChatProvider('lmstudio-local')
    api.setChatModel('qwen/qwen3.5-9b@q4_k_m')
    api.setChatEndpointUrl('/__chat_proxy/v1/chat/completions')
    api.setIntegrationConfigsJson(JSON.stringify({
      aiChat: { enabled: false, provider: 'native', openTab: 'chat' },
      simulationCommands: {
        enabled: true,
        commandPrefix: '/simulate',
        defaultPlatform: 'parallel',
        defaultSimulationId: 'sim_demo',
      },
    }))

    const doc = dom.window.document
    const container = doc.createElement('div')
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    await renderAndFlush(root, React.createElement(IntegrationsHubView), anyWindow.requestAnimationFrame, 3)

    const text = container.textContent || ''
    const expectedTokens = [
      'Key',
      'Type',
      'Value',
      'Chat',
      'chatProvider',
      'chatModel',
      'integrationConfigsJson',
      'Official AI',
      'AI routing',
      'BytePlus Chat API',
      'byteplusApi.model',
      'byteplusApi.messages',
      'byteplusApi.response_format.type',
      'byteplusApi.tool_choice',
    ]
    expectedTokens.forEach(token => {
      if (!text.includes(token)) {
        throw new Error(`expected integrations hub settings surface to include ${JSON.stringify(token)}, got ${JSON.stringify(text)}`)
      }
    })
    if (text.includes('Global Reset')) {
      throw new Error('expected integrations hub reuse to omit global reset section')
    }
  } finally {
    try {
      await unmountAndFlush(root)
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}

export async function testMainPanelRequestedSettingsSearchExcludesIntegrationEntries() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
      setTimeout(() => cb(Date.now()), 0) as unknown as number
    ;(globalThis as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }).requestAnimationFrame =
      anyWindow.requestAnimationFrame

    const api = useGraphStore.getState()
    api.resetAll()

    const doc = dom.window.document
    const container = doc.createElement('div')
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    await renderAndFlush(
      root,
      React.createElement(MainPanel, {
        requestedTab: 'settings',
        requestedSearchQuery: 'chat',
      } as never),
      anyWindow.requestAnimationFrame,
      10,
    )

    const text = container.textContent || ''
    if (text.includes('chatContextScope')) {
      throw new Error(`expected settings search to exclude chatContextScope, got ${JSON.stringify(text)}`)
    }
    if (text.includes('integrationConfigsJson')) {
      throw new Error(`expected settings search to exclude integrationConfigsJson, got ${JSON.stringify(text)}`)
    }
  } finally {
    try {
      await unmountAndFlush(root)
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}

export async function testMainPanelRequestedIntegrationsSearchShowsAiControls() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
      setTimeout(() => cb(Date.now()), 0) as unknown as number
    ;(globalThis as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }).requestAnimationFrame =
      anyWindow.requestAnimationFrame

    const api = useGraphStore.getState()
    api.resetAll()
    api.setIntegrationConfigsJson(
      JSON.stringify({
        aiChat: { enabled: true, provider: 'native', openTab: 'chat' },
        simulationCommands: {
          enabled: true,
          commandPrefix: '/simulate',
          defaultPlatform: 'parallel',
          defaultSimulationId: 'sim_demo',
        },
      }),
    )

    const doc = dom.window.document
    const container = doc.createElement('div')
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    await renderAndFlush(
      root,
      React.createElement(MainPanel, {
        requestedTab: 'integrations',
        requestedSearchQuery: 'chat',
      } as never),
      anyWindow.requestAnimationFrame,
      6,
    )

    const text = container.textContent || ''
    ;[
      'Context scope',
      'AI routing',
      'Enable AI Chat',
      'Disable AI Chat',
      'Format JSON',
      'Refresh Models',
      'Multi-modal Run',
      'OpenAI default text model',
      'Seedream 5.0 Lite',
      'Seedance 2.0',
    ].forEach(token => {
      if (!text.includes(token)) {
        throw new Error(`expected chat settings controls to include ${JSON.stringify(token)}, got ${JSON.stringify(text)}`)
      }
    })
    if (!text.includes(`${CHAT_BYTEPLUS_AP_SOUTHEAST_BASE}/api/v3`)) {
      throw new Error(`expected integrations chat controls to include default BytePlus base url ${CHAT_BYTEPLUS_AP_SOUTHEAST_BASE}/api/v3`)
    }
    if (!text.includes(CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT)) {
      throw new Error(`expected chat settings controls to include image default ${CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT}`)
    }
    if (!text.includes(CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT)) {
      throw new Error(`expected chat settings controls to include video default ${CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT}`)
    }
  } finally {
    try {
      await unmountAndFlush(root)
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}

export async function testMainPanelRequestedIntegrationsSearchPreservesCustomModelValue() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
      setTimeout(() => cb(Date.now()), 0) as unknown as number
    ;(globalThis as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }).requestAnimationFrame =
      anyWindow.requestAnimationFrame

    const api = useGraphStore.getState()
    api.resetAll()
    api.setChatModel('custom/provider-model')

    const doc = dom.window.document
    const container = doc.createElement('div')
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    await renderAndFlush(
      root,
      React.createElement(MainPanel, {
        requestedTab: 'integrations',
        requestedSearchQuery: 'chat',
      } as never),
      anyWindow.requestAnimationFrame,
      6,
    )

    const input = container.querySelector('input[list="settings-chat-model-options"]') as HTMLInputElement | null
    if (!input) {
      throw new Error('expected chat model datalist input to render')
    }
    if (input.value !== 'custom/provider-model') {
      throw new Error(`expected custom chat model to be preserved, got ${JSON.stringify(input.value)}`)
    }
    const datalist = container.querySelector('#settings-chat-model-options')
    const optionValues = Array.from(datalist?.querySelectorAll('option') || []).map(option => option.getAttribute('value') || '')
    if (!optionValues.includes(CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT)) {
      throw new Error(`expected chat model datalist to include ${CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT}`)
    }
    if (!optionValues.includes(CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT)) {
      throw new Error(`expected chat model datalist to include ${CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT}`)
    }
  } finally {
    try {
      await unmountAndFlush(root)
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}
