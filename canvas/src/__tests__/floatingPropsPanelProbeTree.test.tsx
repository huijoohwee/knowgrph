import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Simulate } from 'react-dom/test-utils'

import { FloatingPropsPanel } from '@/features/toolbar/FloatingPropsPanel'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData } from '@/lib/graph/types'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { installDeterministicRaf, mountReactRoot, unmountReactRoot, waitForFrames } from '@/tests/lib/reactRootHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'

const renderAndFlush = async (
  root: ReturnType<typeof createRoot>,
  node: React.ReactNode,
  frameCount = 4,
) => {
  const win = (globalThis as unknown as { window?: Window }).window
  if (!win) throw new Error('expected window for root render flush')
  await mountReactRoot(root, node as React.ReactElement, { window: win, frames: frameCount })
}

export async function testPropsPanelProbeTreeButtonMaterializesSelectedCardBranches() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    anyWindow.requestAnimationFrame = installDeterministicRaf(dom.window)

    const api = useGraphStore.getState()
    api.resetAll()
    api.setGraphData({
      type: 'Graph',
      nodes: [{
        id: 'props_source',
        label: 'Props Panel Card',
        type: 'Card',
        x: 10,
        y: 20,
        properties: {
          summary: 'Runtime-ready selected card context',
          action: 'Generate bounded next-step options',
          prompt: '/knowgrph.probe-tree #knowgrph.probe-tree @knowgrph.probe-tree',
          lane: 'Storyboard',
        },
      }],
      edges: [],
      metadata: {},
    } as GraphData)
    api.selectNode('props_source')

    const container = dom.window.document.createElement('section')
    dom.window.document.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    await renderAndFlush(root, React.createElement(FloatingPropsPanel))

    const probeTreeButton = (Array.from(container.querySelectorAll('[role="button"]')) as HTMLElement[])
      .find(button => String(button.textContent || '').trim() === 'Probe-Tree')
    if (!probeTreeButton) {
      throw new Error(`expected Floating Props Panel to render Probe-Tree selected-card action, got ${JSON.stringify(container.textContent || '')}`)
    }

    await act(async () => {
      Simulate.click(probeTreeButton)
      await waitForFrames(dom.window, 4)
    })

    const graphData = useGraphStore.getState().graphData
    const probeNodes = (graphData?.nodes || []).filter(node => node.type === 'ProbeTreeCandidate')
    const candidateEdges = (graphData?.edges || []).filter(edge => edge.source === 'props_source' && edge.label === 'candidateOption')
    if (probeNodes.length !== 3 || candidateEdges.length !== 3) {
      throw new Error(`expected Props Panel Probe-Tree click to materialize 3 candidate cards and edges, got ${JSON.stringify(graphData)}`)
    }
    if (!probeNodes.every(node => node.properties.atToken === '@knowgrph.probe-tree')) {
      throw new Error(`expected Props Panel Probe-Tree click to preserve @ invocation token, got ${JSON.stringify(probeNodes)}`)
    }
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
