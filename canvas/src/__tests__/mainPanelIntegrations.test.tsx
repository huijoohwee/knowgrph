import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import MainPanel from '@/features/panels/MainPanel'
import IntegrationsHubView from '@/features/panels/views/IntegrationsHubView'
import MapsHubView from '@/features/panels/views/MapsHubView'
import DiscoveryHubView from '@/features/panels/views/DiscoveryHubView'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { useGraphStore } from '@/hooks/useGraphStore'
import { PROPS_PANEL_OPEN_EVENT, SIDE_PANEL_OPEN_EVENT } from '@/features/canvas/utils'
import { MAIN_PANEL_OPEN_EVENT } from '@/features/panels/utils/useMainPanelRect'
import {
  CHAT_BYTEPLUS_AP_SOUTHEAST_BASE,
  CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT,
  CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT,
  CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT,
} from '@/lib/chatEndpoint'
import { getBytePlusChatApiRowAnchorId } from '@/features/panels/views/byteplusChatApiDocs'

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
      'Open FloatingPanel Chat UI',
      'chatProvider',
      'chatModel',
      'integrationConfigsJson',
      'Official AI',
      'AI routing',
      'BytePlus Chat API',
      'Open FloatingPanel Props Panel Text Widget',
      'byteplusApi.provider',
      'byteplusApi.auth_mode',
      'byteplusApi.endpoint_url',
      'byteplusApi.api_key',
      'byteplusApi.model',
      'byteplusApi.messages',
      'byteplusApi.response_format.type',
      'byteplusApi.tool_choice',
      'OpenAI Chat API',
      'Open FloatingPanel Props Panel OpenAI Text Widget',
      'openaiApi.provider',
      'openaiApi.endpoint_url',
      'openaiApi.model',
      'openaiApi.input',
      'openaiApi.response_format',
      'openaiApi.tool_choice',
      'BytePlus Video Generation API',
      'Open FloatingPanel BytePlus Video Widget',
      'BytePlus Image Generation API',
      'Open FloatingPanel Image Widget',
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

export async function testIntegrationsHubSectionLinksOpenFloatingPanels() {
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

    useGraphStore.getState().resetAll()

    const doc = dom.window.document
    const container = doc.createElement('div')
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    await renderAndFlush(root, React.createElement(IntegrationsHubView), anyWindow.requestAnimationFrame, 3)

    const sidePanelEvents: Array<string> = []
    const propsPanelEvents: Array<string> = []
    const eventWindow = globalThis.window as Window & typeof globalThis
    const originalDispatchEvent = eventWindow.dispatchEvent.bind(eventWindow)
    eventWindow.dispatchEvent = ((event: Event) => {
      if (event.type === SIDE_PANEL_OPEN_EVENT) {
        const custom = event as CustomEvent<{ tab?: string }>
        sidePanelEvents.push(String(custom.detail?.tab || ''))
      }
      if (event.type === PROPS_PANEL_OPEN_EVENT) {
        propsPanelEvents.push('propsPanel')
      }
      return originalDispatchEvent(event)
    }) as typeof eventWindow.dispatchEvent

    const clickButton = async (label: string) => {
      const buttons = Array.from(container.querySelectorAll('button')) as HTMLButtonElement[]
      const button = buttons.find(node => Boolean(node.textContent?.includes(label)))
      if (!button) throw new Error(`expected integrations section button ${JSON.stringify(label)}`)
      await act(async () => {
        button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
        await waitForFrames(anyWindow.requestAnimationFrame, 1)
      })
    }

    await clickButton('Open FloatingPanel Chat UI')
    await clickButton('Open FloatingPanel Props Panel Text Widget')
    await clickButton('Open FloatingPanel Props Panel OpenAI Text Widget')
    await clickButton('Open FloatingPanel BytePlus Video Widget')
    await clickButton('Open FloatingPanel Image Widget')

    if (sidePanelEvents.filter(value => value === 'chat').length !== 1) {
      throw new Error(`expected chat section link to open floating chat once, got ${JSON.stringify(sidePanelEvents)}`)
    }
    if (propsPanelEvents.length !== 4) {
      throw new Error(`expected text/openai/video/image section links to open floating props panel four times, got ${JSON.stringify(propsPanelEvents)}`)
    }
    eventWindow.dispatchEvent = originalDispatchEvent
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
    const integrationsScrollHost = container.querySelector('[aria-label="Main Panel Content"]') as HTMLElement | null
    if (!integrationsScrollHost) {
      throw new Error('expected integrations tab to reuse MainPanelBody scroll host')
    }
    if (!integrationsScrollHost.className.includes('overflow-auto')) {
      throw new Error(`expected integrations scroll host to be overflow-auto, got ${JSON.stringify(integrationsScrollHost.className)}`)
    }
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
      'ByteDance-Seedance-1.0-pro-fast',
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

    const modelDatalistInputs = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[list="settings-chat-model-options"]'),
    )
    if (modelDatalistInputs.length === 0) {
      throw new Error('expected chat model datalist input to render')
    }
    const datalist = container.querySelector('#settings-chat-model-options')
    const optionValues = Array.from(datalist?.querySelectorAll('option') || [])
      .map(option => (option as HTMLOptionElement).getAttribute('value') || '')
    if (modelDatalistInputs.length < 2) {
      throw new Error(`expected BytePlus API model row to reuse chatModel editor surface, got ${modelDatalistInputs.length} model inputs`)
    }
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

export async function testIntegrationsHubSurfacesGrabMapsTravelVideoCopy() {
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

    useGraphStore.getState().resetAll()

    const doc = dom.window.document
    const container = doc.createElement('div')
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    await renderAndFlush(root, React.createElement(IntegrationsHubView), anyWindow.requestAnimationFrame, 4)

    const text = container.textContent || ''
    ;[
      'Travel-planning video prompts can reuse GrabMaps-selected geojson plus place search context from FloatingPanel Discovery, while MainPanel Maps keeps backend/system/API/MCP config.',
      'Output stays on the shared widget -> edge -> Rich Media Panel pipeline for inline video rendering.',
    ].forEach(token => {
      if (!text.includes(token)) {
        throw new Error(`expected integrations hub to surface GrabMaps-aware video guidance ${JSON.stringify(token)}, got ${JSON.stringify(text)}`)
      }
    })
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

export async function testMapsHubSurfacesGrabMapsSearchDiscoveryCopy() {
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

    useGraphStore.getState().resetAll()

    const doc = dom.window.document
    const container = doc.createElement('div')
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    await renderAndFlush(root, React.createElement(MapsHubView), anyWindow.requestAnimationFrame, 4)

    const text = container.textContent || ''
    ;[
      'Style loading uses Bearer auth against https://maps.grab.com/api/style.json.',
      'Backend/system/API/MCP-facing config for the shared GrabMaps remote MCP server and tool defaults.',
      'Default remote server uses `grab-maps-playground` with `npx mcp-remote@latest` over `https://maps.grab.com/api/v1/mcp`.',
      'Auth uses `Authorization:${AUTH_HEADER}` with `AUTH_HEADER=Bearer mcp_{TOKEN}` and `startup_timeout_ms=60000`.',
      'Directions default to lng,lat coordinate order unless lat_first is enabled.',
      'Use overview=full when you need route geometry suitable for animation or media prompts.',
    ].forEach(token => {
      if (!text.includes(token)) {
        throw new Error(`expected maps hub to retain backend/system/API GrabMaps guidance ${JSON.stringify(token)}, got ${JSON.stringify(text)}`)
      }
    })
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

export async function testDiscoveryHubOwnsGrabMapsSearchDiscoveryCopy() {
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

    useGraphStore.getState().resetAll()

    const doc = dom.window.document
    const container = doc.createElement('div')
    doc.body.appendChild(container)
    let mainPanelOpenDetail: Record<string, unknown> | null = null
    dom.window.addEventListener(MAIN_PANEL_OPEN_EVENT, ev => {
      mainPanelOpenDetail = ((ev as CustomEvent<{ tab?: string; searchQuery?: string }>).detail || null) as Record<string, unknown> | null
    })
    root = createRoot(container as unknown as HTMLElement)
    await renderAndFlush(root, React.createElement(DiscoveryHubView), anyWindow.requestAnimationFrame, 4)

    const text = container.textContent || ''
    ;[
      'User-facing place search and discovery for GrabMaps. MainPanel Maps remains backend/system/API/MCP-facing.',
      'Search Places',
      'Keyword Search Preview',
      'Nearby Search Preview',
      'MainPanel Maps keeps backend/system/API/MCP-facing config, including server key, command, args, env, and startup timeout.',
      'Open MainPanel Maps',
    ].forEach(token => {
      if (!text.includes(token)) {
        throw new Error(`expected discovery hub to own GrabMaps search-discovery guidance ${JSON.stringify(token)}, got ${JSON.stringify(text)}`)
      }
    })
    ;[
      'mcp-remote@latest',
      'AUTH_HEADER=Bearer mcp_{TOKEN}',
      'startup_timeout_ms=60000',
    ].forEach(token => {
      if (text.includes(token)) {
        throw new Error(`expected discovery hub to avoid raw backend MCP config duplication ${JSON.stringify(token)}, got ${JSON.stringify(text)}`)
      }
    })

    const openMapsButton = Array.from(container.querySelectorAll('button')).find(button => button.textContent?.includes('Open MainPanel Maps'))
    if (!openMapsButton) throw new Error('expected discovery hub to expose Open MainPanel Maps action')
    await act(async () => {
      openMapsButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await waitForFrames(anyWindow.requestAnimationFrame, 2)
    })
    if (String(mainPanelOpenDetail?.tab || '') !== 'maps') {
      throw new Error(`expected discovery hub open-main-panel action to target maps, got ${JSON.stringify(mainPanelOpenDetail)}`)
    }
    if (String(mainPanelOpenDetail?.searchQuery || '') !== 'GrabMaps MCP Configuration') {
      throw new Error(`expected discovery hub open-main-panel action to focus GrabMaps MCP Configuration, got ${JSON.stringify(mainPanelOpenDetail)}`)
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

export async function testMainPanelBytePlusModelRowNormalizesAwayOpenAiValueLeak() {
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
    api.setChatProvider('openai')
    api.setChatModel('gpt-5.4-nano')

    const doc = dom.window.document
    const container = doc.createElement('div')
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    await renderAndFlush(
      root,
      React.createElement(MainPanel, {
        requestedTab: 'integrations',
        requestedSearchQuery: 'byteplusApi.model',
      } as never),
      anyWindow.requestAnimationFrame,
      6,
    )

    const modelInputs = Array.from(container.querySelectorAll<HTMLInputElement>('input[list="settings-chat-model-options"]'))
    if (modelInputs.length !== 1) {
      throw new Error(`expected filtered BytePlus API model search to render one shared model editor, got ${modelInputs.length} model inputs`)
    }
    const bytePlusModelInput = modelInputs[0] as HTMLInputElement | undefined
    if (!bytePlusModelInput) {
      throw new Error('expected BytePlus API model input to exist')
    }
    if (bytePlusModelInput.value !== CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT) {
      throw new Error(`expected byteplusApi.model row to normalize to ${CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT}, got ${JSON.stringify(bytePlusModelInput.value)}`)
    }
    if (String(bytePlusModelInput.value) === 'gpt-5.4-nano') {
      throw new Error('expected byteplusApi.model row to avoid leaking the active OpenAI model value')
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

export async function testMainPanelRequestedIntegrationsSearchUnifiesBytePlusVideoModelRow() {
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

    useGraphStore.getState().resetAll()

    const doc = dom.window.document
    const container = doc.createElement('div')
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    await renderAndFlush(
      root,
      React.createElement(MainPanel, {
        requestedTab: 'integrations',
        requestedSearchQuery: 'byteplusVideoApi.model',
      } as never),
      anyWindow.requestAnimationFrame,
      6,
    )

    const text = container.textContent || ''
    if (!text.includes('byteplusVideoModel')) {
      throw new Error(`expected integrations video model search to surface unified byteplusVideoModel row, got ${JSON.stringify(text)}`)
    }
    if (text.includes('byteplusVideoApi.model')) {
      throw new Error('expected duplicate byteplusVideoApi.model alias row to be removed from integrations results')
    }
    const selects = Array.from(container.querySelectorAll('select'))
    if (selects.length !== 1) {
      throw new Error(`expected unified video model search to render one shared select editor, got ${selects.length}`)
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

export async function testMainPanelRequestedIntegrationsSearchReusesBytePlusScalarConfig() {
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

    useGraphStore.getState().resetAll()
    useGraphStore.getState().setChatTopP(0.92)
    useGraphStore.getState().setChatFrequencyPenalty(-0.5)

    const doc = dom.window.document
    const container = doc.createElement('div')
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    await renderAndFlush(
      root,
      React.createElement(MainPanel, {
        requestedTab: 'integrations',
        requestedSearchQuery: 'top_p',
      } as never),
      anyWindow.requestAnimationFrame,
      6,
    )

    const text = container.textContent || ''
    if (!text.includes('byteplusApi.top_p')) {
      throw new Error(`expected BytePlus top_p row in integrations search, got ${JSON.stringify(text)}`)
    }
    const topPInputs = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="number"]'))
    if (topPInputs.length === 0) {
      throw new Error('expected integrations top_p row to render a writable numeric input')
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

export async function testMainPanelRequestedIntegrationsSearchRendersBytePlusJsonEditor() {
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

    useGraphStore.getState().resetAll()
    useGraphStore.getState().setChatResponseFormatJson('{"type":"json_object"}')

    const doc = dom.window.document
    const container = doc.createElement('div')
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    await renderAndFlush(
      root,
      React.createElement(MainPanel, {
        requestedTab: 'integrations',
        requestedSearchQuery: 'response_format.type',
      } as never),
      anyWindow.requestAnimationFrame,
      6,
    )

    const text = container.textContent || ''
    if (!text.includes('byteplusApi.response_format.type')) {
      throw new Error(`expected BytePlus response_format.type row in integrations search, got ${JSON.stringify(text)}`)
    }
    const editors = Array.from(container.querySelectorAll('textarea'))
    if (editors.length === 0) {
      throw new Error('expected BytePlus response_format.type row to render a multiline shared JSON editor')
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

export async function testMainPanelRequestedIntegrationsSearchRendersBytePlusMessagesJsonEditor() {
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

    useGraphStore.getState().resetAll()
    useGraphStore.getState().setChatMessagesJson('[{"role":"user","content":"hi"}]')

    const doc = dom.window.document
    const container = doc.createElement('div')
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    await renderAndFlush(
      root,
      React.createElement(MainPanel, {
        requestedTab: 'integrations',
        requestedSearchQuery: 'messages.role',
      } as never),
      anyWindow.requestAnimationFrame,
      6,
    )

    const text = container.textContent || ''
    if (!text.includes('byteplusApi.messages.role')) {
      throw new Error(`expected BytePlus messages.role row in integrations search, got ${JSON.stringify(text)}`)
    }
    const editors = Array.from(container.querySelectorAll('textarea'))
    if (editors.length === 0) {
      throw new Error('expected BytePlus messages.role row to render a multiline shared JSON editor')
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

export async function testMainPanelRequestedIntegrationsSearchShowsOpenAiApiRows() {
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
        requestedTab: 'integrations',
        requestedSearchQuery: 'openaiApi.input',
      } as never),
      anyWindow.requestAnimationFrame,
      6,
    )

    const text = container.textContent || ''
    ;['OpenAI Chat API', 'openaiApi.input', 'string | object[]'].forEach(token => {
      if (!text.includes(token)) {
        throw new Error(`expected OpenAI integrations search to include ${JSON.stringify(token)}, got ${JSON.stringify(text)}`)
      }
    })
    const jsonEditors = Array.from(container.querySelectorAll('textarea'))
    if (jsonEditors.length === 0) {
      throw new Error('expected OpenAI input row to reuse the shared multiline JSON editor')
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

export async function testMainPanelRequestedIntegrationsAnchorScrollsExactBytePlusRow() {
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

    useGraphStore.getState().resetAll()

    let scrolledAnchor = ''
    const originalScrollIntoView = dom.window.HTMLElement.prototype.scrollIntoView
    dom.window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {
      scrolledAnchor = String((this as HTMLElement).getAttribute('data-kg-anchor') || '')
    }

    const doc = dom.window.document
    const container = doc.createElement('div')
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    const anchorId = getBytePlusChatApiRowAnchorId('byteplusApi.auth_mode')
    await renderAndFlush(
      root,
      React.createElement(MainPanel, {
        requestedTab: 'integrations',
        requestedSearchQuery: 'byteplusApi.auth_mode',
        requestedAnchorId: anchorId,
        requestedAnchorSeq: 1,
      } as never),
      anyWindow.requestAnimationFrame,
      8,
    )

    if (scrolledAnchor !== anchorId) {
      throw new Error(`expected integrations request to scroll exact BytePlus row anchor ${JSON.stringify(anchorId)}, got ${JSON.stringify(scrolledAnchor)}`)
    }
    const target = container.querySelector(`[data-kg-anchor="${anchorId}"]`)
    if (!target) {
      throw new Error(`expected requested BytePlus row anchor to render: ${JSON.stringify(anchorId)}`)
    }
    dom.window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView
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
