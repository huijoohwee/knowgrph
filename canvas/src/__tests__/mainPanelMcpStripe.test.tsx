import React from 'react'
import { createRoot } from 'react-dom/client'
import McpHubView from '@/features/panels/views/McpHubView'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { installDeterministicRaf, mountReactRoot, unmountReactRoot } from '@/tests/lib/reactRootHarness'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  assertMcpHubSurfacesCrawlerAccessAndPaymentReadiness,
  assertMcpHubSurfacesStripeMcpPaymentReadiness,
} from '@/__tests__/helpers/mainPanelMcpExpectations'

const withRenderedMcpHub = async (assertions: (container: Element) => void): Promise<void> => {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    anyWindow.requestAnimationFrame = installDeterministicRaf(dom.window)

    useGraphStore.getState().resetAll()

    const doc = dom.window.document
    const container = doc.createElement('div')
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    await mountReactRoot(root, React.createElement(McpHubView), { window: dom.window, frames: 4 })

    assertions(container)
  } finally {
    try {
      if (root) await unmountReactRoot(root, { window: dom.window })
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}

export async function testMcpHubSurfacesStripeMcpPaymentReadiness() {
  await withRenderedMcpHub(assertMcpHubSurfacesStripeMcpPaymentReadiness)
}

export async function testMcpHubSurfacesCrawlerAccessAndStripePaymentReadiness() {
  await withRenderedMcpHub(container => {
    assertMcpHubSurfacesCrawlerAccessAndPaymentReadiness(container)
    assertMcpHubSurfacesStripeMcpPaymentReadiness(container)
  })
}
