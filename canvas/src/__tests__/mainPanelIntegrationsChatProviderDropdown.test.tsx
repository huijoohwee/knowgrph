import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Simulate } from 'react-dom/test-utils'
import MainPanel from '@/features/panels/MainPanel'
import {
  CHAT_AGNES_MODEL_OPTIONS,
  CHAT_GOOGLE_CLOUD_MODEL_OPTIONS,
  CHAT_MIROMIND_MODEL_OPTIONS,
  CHAT_OPENAI_MODEL_OPTIONS,
  CHAT_PROVIDER_AGNES,
  CHAT_PROVIDER_GOOGLE_CLOUD,
  CHAT_PROVIDER_MIROMIND,
  CHAT_PROVIDER_QWEN,
  CHAT_QWEN_ENDPOINT_OPTIONS,
  CHAT_QWEN_MODEL_OPTIONS,
} from '@/lib/chatEndpoint'
import { useGraphStore } from '@/hooks/useGraphStore'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import {
  installDeterministicRaf,
  mountReactRoot,
  unmountReactRoot,
  waitForFrames as waitForFramesShared,
} from '@/tests/lib/reactRootHarness'

const waitForFrames = async (count = 1) => {
  const win = (globalThis as unknown as { window?: Window }).window
  if (!win) throw new Error('expected window for frame flush')
  await waitForFramesShared(win, count)
}

const renderRequestedIntegrationsSearch = async (
  root: ReturnType<typeof createRoot>,
  requestedSearchQuery: string,
) => {
  const win = (globalThis as unknown as { window?: Window }).window
  if (!win) throw new Error('expected window for root render flush')
  await mountReactRoot(
    root,
    React.createElement(MainPanel, {
      requestedTab: 'integrations',
      requestedSearchQuery,
    } as never),
    { window: win, frames: 6 },
  )
}

const unmountAndFlush = async (root: ReturnType<typeof createRoot> | null) => {
  if (!root) return
  const win = (globalThis as unknown as { window?: Window }).window
  await unmountReactRoot(root, win ? { window: win } : undefined)
}

const createMainPanelHost = () => {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
  anyWindow.requestAnimationFrame = installDeterministicRaf(dom.window)
  useGraphStore.getState().resetAll()

  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)

  return {
    container,
    dom,
    root,
    restore: async () => {
      try {
        await unmountAndFlush(root)
      } catch {
        void 0
      }
      restoreDom()
      restoreWindow()
    },
  }
}

const findValueCellSelectForRowKey = (container: HTMLElement, rowKey: string) => {
  const valueRows = Array.from(container.querySelectorAll('dl')) as HTMLElement[]
  const row = valueRows.find(item => item.children[0]?.textContent?.trim() === rowKey)
  return row?.children[2]?.querySelector<HTMLSelectElement>('select') || null
}

export async function testMainPanelRequestedIntegrationsChatProviderValueCellUsesSingleDropdownOwner() {
  const host = createMainPanelHost()

  try {
    await renderRequestedIntegrationsSearch(host.root, 'chatProvider')

    const valueRows = Array.from(host.container.querySelectorAll('dl')) as HTMLElement[]
    const providerRow = valueRows.find(row => row.children[0]?.textContent?.trim() === 'chatProvider')
    const providerValueCell = providerRow?.children[2] as HTMLElement | undefined
    const providerSelect = providerValueCell?.querySelector('select') as HTMLSelectElement | null
    if (!providerValueCell || !providerSelect) {
      throw new Error(`expected chatProvider Value cell to render one provider dropdown, got ${JSON.stringify(providerValueCell?.textContent || '')}`)
    }
    if (providerValueCell.querySelectorAll('select').length !== 1) {
      throw new Error('expected chatProvider Value cell to render a single dropdown owner')
    }
    if (providerValueCell.querySelector('button')) {
      throw new Error(`expected chatProvider Value cell to omit duplicate provider preset buttons, got ${JSON.stringify(providerValueCell.textContent || '')}`)
    }

    const valueSetter = Object.getOwnPropertyDescriptor(host.dom.window.HTMLSelectElement.prototype, 'value')?.set
    if (!valueSetter) throw new Error('expected DOM select value setter')
    await act(async () => {
      valueSetter.call(providerSelect, CHAT_PROVIDER_QWEN)
      Simulate.change(providerSelect)
      await waitForFrames()
    })

    const rerenderedRows = Array.from(host.container.querySelectorAll('dl')) as HTMLElement[]
    const rerenderedProviderRow = rerenderedRows.find(row => row.children[0]?.textContent?.trim() === 'chatProvider')
    const rerenderedProviderSelect = rerenderedProviderRow?.children[2]?.querySelector('select') as HTMLSelectElement | null
    if (rerenderedProviderSelect?.value !== CHAT_PROVIDER_QWEN) {
      throw new Error(`expected chatProvider dropdown to keep selected value ${JSON.stringify(CHAT_PROVIDER_QWEN)}, got ${JSON.stringify(rerenderedProviderSelect?.value)}`)
    }
  } finally {
    await host.restore()
  }
}

export async function testMainPanelRequestedIntegrationsChatModelValueCellUsesVisibleModelDropdown() {
  const host = createMainPanelHost()

  try {
    await renderRequestedIntegrationsSearch(host.root, 'chatModel')

    const modelSelect = findValueCellSelectForRowKey(host.container, 'chatModel')
    if (!modelSelect) {
      throw new Error('expected chatModel Value cell to render a visible model dropdown')
    }
    if (modelSelect.closest('dl')?.children[2]?.querySelector('input[list="settings-chat-model-options"]')) {
      throw new Error('expected chatModel Value cell to avoid plain datalist-only text input')
    }
    ;[
      CHAT_OPENAI_MODEL_OPTIONS[0],
      CHAT_MIROMIND_MODEL_OPTIONS[0],
      CHAT_AGNES_MODEL_OPTIONS[0],
      CHAT_QWEN_MODEL_OPTIONS[0],
      CHAT_GOOGLE_CLOUD_MODEL_OPTIONS[0],
    ].forEach(value => {
      if (!Array.from(modelSelect.options).some(option => option.value === value)) {
        throw new Error(`expected chatModel dropdown to include shared model option ${JSON.stringify(value)}`)
      }
    })
  } finally {
    await host.restore()
  }
}

export async function testMainPanelRequestedIntegrationsProviderModelRowsRejectKnownCrossProviderLeak() {
  const leakedOpenAiModel: string = CHAT_OPENAI_MODEL_OPTIONS[0]
  const cases = [
    {
      provider: CHAT_PROVIDER_MIROMIND,
      query: 'chatModel',
      rowKey: 'chatModel',
      expectedModel: CHAT_MIROMIND_MODEL_OPTIONS[0],
    },
    {
      provider: CHAT_PROVIDER_MIROMIND,
      query: 'miromindApi.model',
      rowKey: 'miromindApi.model',
      expectedModel: CHAT_MIROMIND_MODEL_OPTIONS[0],
    },
    {
      provider: CHAT_PROVIDER_AGNES,
      query: 'agnesApi.model',
      rowKey: 'agnesApi.model',
      expectedModel: CHAT_AGNES_MODEL_OPTIONS[0],
    },
    {
      provider: CHAT_PROVIDER_QWEN,
      query: 'qwenApi.model',
      rowKey: 'qwenApi.model',
      expectedModel: CHAT_QWEN_MODEL_OPTIONS[0],
    },
    {
      provider: CHAT_PROVIDER_GOOGLE_CLOUD,
      query: 'googleCloudApi.model',
      rowKey: 'googleCloudApi.model',
      expectedModel: CHAT_GOOGLE_CLOUD_MODEL_OPTIONS[0],
    },
  ] as const

  for (const testCase of cases) {
    const host = createMainPanelHost()

    try {
      const graphState = useGraphStore.getState()
      graphState.setChatProvider(testCase.provider)
      graphState.setChatModel(leakedOpenAiModel)
      const storedModel = useGraphStore.getState().chatModel
      if (storedModel !== testCase.expectedModel) {
        throw new Error(`expected chatModel setter to reject known cross-provider model ${JSON.stringify(leakedOpenAiModel)} for ${testCase.provider}, got ${JSON.stringify(storedModel)}`)
      }

      await renderRequestedIntegrationsSearch(host.root, testCase.query)

      const modelSelect = findValueCellSelectForRowKey(host.container, testCase.rowKey)
      if (!modelSelect) {
        throw new Error(`expected ${testCase.rowKey} Value cell to render a configurable model dropdown`)
      }
      if (!Array.from(modelSelect.options).some(option => option.value === testCase.expectedModel)) {
        throw new Error(`expected ${testCase.rowKey} model dropdown to include ${JSON.stringify(testCase.expectedModel)}`)
      }
      if (modelSelect.value !== testCase.expectedModel) {
        throw new Error(`expected ${testCase.rowKey} to render ${JSON.stringify(testCase.expectedModel)} instead of leaked OpenAI model, got ${JSON.stringify(modelSelect.value)}`)
      }
      if (modelSelect.value === leakedOpenAiModel) {
        throw new Error(`expected ${testCase.rowKey} to avoid leaking ${JSON.stringify(leakedOpenAiModel)}`)
      }
    } finally {
      await host.restore()
    }
  }
}

export async function testMainPanelRequestedIntegrationsMappedDropdownKeepsUserSelection() {
  const host = createMainPanelHost()

  try {
    await renderRequestedIntegrationsSearch(host.root, 'qwenApi.endpoint_url')

    const endpointSelect = Array.from(host.container.querySelectorAll('select') as NodeListOf<HTMLSelectElement>)
      .find(select => Array.from(select.options).some(option => option.value === CHAT_QWEN_ENDPOINT_OPTIONS[1]))
    if (!endpointSelect) {
      throw new Error('expected Qwen endpoint_url Value cell to render a configurable dropdown')
    }
    const nextEndpoint = CHAT_QWEN_ENDPOINT_OPTIONS[1]
    const valueSetter = Object.getOwnPropertyDescriptor(host.dom.window.HTMLSelectElement.prototype, 'value')?.set
    if (!valueSetter) throw new Error('expected DOM select value setter')
    await act(async () => {
      valueSetter.call(endpointSelect, nextEndpoint)
      Simulate.change(endpointSelect)
      await waitForFrames()
    })

    const row = endpointSelect.closest('dl')
    if (!row) {
      throw new Error('expected Qwen endpoint dropdown to live inside a key/type/value row')
    }
    await act(async () => {
      row.dispatchEvent(new host.dom.window.MouseEvent('click', { bubbles: true }))
      await waitForFrames()
    })

    const rerenderedEndpointSelect = Array.from(host.container.querySelectorAll('select') as NodeListOf<HTMLSelectElement>)
      .find(select => Array.from(select.options).some(option => option.value === CHAT_QWEN_ENDPOINT_OPTIONS[1]))
    if (rerenderedEndpointSelect?.value !== nextEndpoint) {
      throw new Error(`expected mapped Qwen endpoint dropdown to keep edited value, got ${JSON.stringify(rerenderedEndpointSelect?.value)}`)
    }
  } finally {
    await host.restore()
  }
}

export async function testMainPanelRequestedIntegrationsMappedChatModelKeepsUserSelection() {
  const host = createMainPanelHost()

  try {
    await renderRequestedIntegrationsSearch(host.root, 'qwenApi.model')

    const modelSelect = findValueCellSelectForRowKey(host.container, 'qwenApi.model')
    if (!modelSelect) {
      throw new Error('expected Qwen model Value cell to render a configurable chatModel dropdown')
    }
    const nextModel = CHAT_QWEN_MODEL_OPTIONS[2]
    const valueSetter = Object.getOwnPropertyDescriptor(host.dom.window.HTMLSelectElement.prototype, 'value')?.set
    if (!valueSetter) throw new Error('expected DOM select value setter')
    await act(async () => {
      valueSetter.call(modelSelect, nextModel)
      Simulate.change(modelSelect)
      await waitForFrames()
    })

    const row = modelSelect.closest('dl')
    if (!row) {
      throw new Error('expected Qwen model dropdown to live inside a key/type/value row')
    }
    await act(async () => {
      row.dispatchEvent(new host.dom.window.MouseEvent('click', { bubbles: true }))
      await waitForFrames()
    })

    const rerenderedModelSelect = findValueCellSelectForRowKey(host.container, 'qwenApi.model')
    if (rerenderedModelSelect?.value !== nextModel) {
      throw new Error(`expected mapped Qwen chatModel dropdown to keep edited value, got ${JSON.stringify(rerenderedModelSelect?.value)}`)
    }
  } finally {
    await host.restore()
  }
}

export async function testMainPanelRequestedIntegrationsDropdownValuesStayEditableAndUnduplicated() {
  await testMainPanelRequestedIntegrationsChatProviderValueCellUsesSingleDropdownOwner()
  await testMainPanelRequestedIntegrationsChatModelValueCellUsesVisibleModelDropdown()
  await testMainPanelRequestedIntegrationsProviderModelRowsRejectKnownCrossProviderLeak()
  await testMainPanelRequestedIntegrationsMappedDropdownKeepsUserSelection()
  await testMainPanelRequestedIntegrationsMappedChatModelKeepsUserSelection()
}
