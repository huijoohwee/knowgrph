import React from 'react'
import { createRoot } from 'react-dom/client'
import MainPanel from '@/features/panels/MainPanel'
import IntegrationsHubView from '@/features/panels/views/IntegrationsHubView'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { useGraphStore } from '@/hooks/useGraphStore'

const waitForFrames = async (raf: ((cb: (ts: number) => void) => number) | undefined, count = 3) => {
  for (let i = 0; i < count; i += 1) {
    await new Promise<void>(resolve => {
      if (typeof raf === 'function') raf(() => resolve())
      else setTimeout(() => resolve(), 0)
    })
  }
}

export async function testIntegrationsHubShowsChatStatus() {
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
    root.render(React.createElement(IntegrationsHubView))

    await waitForFrames(anyWindow.requestAnimationFrame, 3)

    const text = container.textContent || ''
    const expectedTokens = ['Chat', 'Disabled', 'lmstudio-local', 'qwen/qwen3.5-9b@q4_k_m', 'Proxy endpoint']
    expectedTokens.forEach(token => {
      if (!text.includes(token)) {
        throw new Error(`expected integrations hub to include ${JSON.stringify(token)}, got ${JSON.stringify(text)}`)
      }
    })
  } finally {
    try {
      root?.unmount()
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}

export async function testMainPanelRequestedChatSearchShowsIntegrationEntries() {
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
    root.render(
      React.createElement(MainPanel, {
        requestedTab: 'settings',
        requestedSearchQuery: 'chat',
      } as never),
    )

    await waitForFrames(anyWindow.requestAnimationFrame, 6)

    const text = container.textContent || ''
    if (!text.includes('chatContextScope')) {
      throw new Error(`expected chat settings search to include chatContextScope, got ${JSON.stringify(text)}`)
    }
    if (!text.includes('integrationConfigsJson')) {
      throw new Error(`expected chat settings search to include integrationConfigsJson, got ${JSON.stringify(text)}`)
    }
  } finally {
    try {
      root?.unmount()
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}

export async function testMainPanelRequestedChatSearchShowsAiControls() {
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
    root.render(
      React.createElement(MainPanel, {
        requestedTab: 'settings',
        requestedSearchQuery: 'chat',
      } as never),
    )

    await waitForFrames(anyWindow.requestAnimationFrame, 6)

    const text = container.textContent || ''
    ;['Context scope', 'AI routing', 'Enable AI Chat', 'Disable AI Chat', 'Format JSON', 'Refresh Models'].forEach(token => {
      if (!text.includes(token)) {
        throw new Error(`expected chat settings controls to include ${JSON.stringify(token)}, got ${JSON.stringify(text)}`)
      }
    })
  } finally {
    try {
      root?.unmount()
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}

export async function testMainPanelRequestedChatSearchPreservesCustomModelValue() {
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
    root.render(
      React.createElement(MainPanel, {
        requestedTab: 'settings',
        requestedSearchQuery: 'chat',
      } as never),
    )

    await waitForFrames(anyWindow.requestAnimationFrame, 6)

    const input = container.querySelector('input[list="settings-chat-model-options"]') as HTMLInputElement | null
    if (!input) {
      throw new Error('expected chat model datalist input to render')
    }
    if (input.value !== 'custom/provider-model') {
      throw new Error(`expected custom chat model to be preserved, got ${JSON.stringify(input.value)}`)
    }
  } finally {
    try {
      root?.unmount()
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}
