import React from 'react'
import { createRoot } from 'react-dom/client'
import MainPanel from '@/features/panels/MainPanel'
import { useGraphStore } from '@/hooks/useGraphStore'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import {
  installDeterministicRaf,
  mountReactRoot,
  unmountReactRoot,
} from '@/tests/lib/reactRootHarness'
import {
  CHAT_MIROMIND_BASE,
  CHAT_MIROMIND_ENDPOINT_URL,
  CHAT_PROVIDER_MIROMIND,
  buildChatProxyHeaders,
} from '@/lib/chatEndpoint'

const requireKtvValueCell = (container: Element, key: string): HTMLElement => {
  const row = (Array.from(container.querySelectorAll('dl')) as HTMLElement[])
    .find(candidate => String(candidate.children[0]?.textContent || '').trim() === key)
  if (!row) {
    throw new Error(`expected ${key} KTV row, got ${JSON.stringify(container.textContent || '')}`)
  }
  const valueCell = row.children[2] as HTMLElement | undefined
  if (!valueCell) {
    throw new Error(`expected ${key} row to have a Value cell`)
  }
  return valueCell
}

export async function testMainPanelMiroMindApiKeyUsesServerManagedPagesSecretContract() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    anyWindow.requestAnimationFrame = installDeterministicRaf(dom.window)

    const api = useGraphStore.getState()
    api.resetAll()

    const container = dom.window.document.createElement('section')
    dom.window.document.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    await mountReactRoot(root, React.createElement(MainPanel, {
      requestedTab: 'integrations',
      requestedSearchQuery: 'MIROMIND_API_KEY',
    } as never), {
      window: dom.window as unknown as Window,
      frames: 6,
      tasks: 3,
    })

    const text = container.textContent || ''
    ;['MiroMind API', 'miromindApi.api_key'].forEach(token => {
      if (!text.includes(token)) {
        throw new Error(`expected MiroMind API key search to include ${JSON.stringify(token)}, got ${JSON.stringify(text)}`)
      }
    })

    const apiKeyValueCell = requireKtvValueCell(container, 'miromindApi.api_key')
    const serverManagedInput = apiKeyValueCell.querySelector('input') as HTMLInputElement | null
    if (!serverManagedInput || serverManagedInput.type === 'password' || serverManagedInput.placeholder !== 'Server-managed Key') {
      throw new Error(`expected miromindApi.api_key to render the server-managed placeholder by default, got ${JSON.stringify(apiKeyValueCell.textContent || '')}`)
    }
    if (useGraphStore.getState().chatAuthMode !== 'serverManaged' || useGraphStore.getState().chatApiKey !== '') {
      throw new Error(`expected MiroMind server-managed mode to keep the browser key empty, got ${JSON.stringify({
        chatAuthMode: useGraphStore.getState().chatAuthMode,
        hasKey: Boolean(useGraphStore.getState().chatApiKey),
      })}`)
    }

    const headers = buildChatProxyHeaders({
      provider: CHAT_PROVIDER_MIROMIND,
      endpointUrl: CHAT_MIROMIND_ENDPOINT_URL,
      apiKey: '',
      clientRequestId: 'kg-miromind-mainpanel-server-managed',
    })
    if (headers['X-KG-Chat-Provider'] !== CHAT_PROVIDER_MIROMIND || headers['X-KG-Chat-Api-Key']) {
      throw new Error(`expected server-managed MiroMind requests to omit browser API-key headers, got ${JSON.stringify(headers)}`)
    }
    if (headers['X-KG-Chat-Upstream'] !== CHAT_MIROMIND_BASE) {
      throw new Error(`expected MiroMind upstream to route through the shared proxy owner, got ${JSON.stringify(headers)}`)
    }
  } finally {
    if (root) {
      await unmountReactRoot(root, { window: dom.window as unknown as Window })
    }
    restoreDom()
    restoreWindow()
  }
}
