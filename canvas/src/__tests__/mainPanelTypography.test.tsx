import React from 'react'
import { createRoot } from 'react-dom/client'
import MainPanel from '@/features/panels/MainPanel'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { useGraphStore } from '@/hooks/useGraphStore'

export async function testMainPanelTypographyUsesUiSettings() {
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
    api.setUiPanelTextFontClass('font-serif')
    api.setUiPanelKeyValueTextSizeClass('text-[15px]')
    api.setUiPanelMicroLabelTextSizeClass('text-[10px]')
    api.setUiPanelMonospaceTextClass('font-mono text-[13px]')
    api.setGraphData({
      nodes: [
        { id: 'n1', label: 'Node 1', type: 'Node', properties: {} },
        { id: 'n2', label: 'Node 2', type: 'Node', properties: {} },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', label: 'Edge', type: 'Edge', properties: {} },
      ],
    } as never)
    api.setLastTraversalSummary({ mode: 'graphRag', edgeIds: ['e1'] } as never)

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    root.render(React.createElement(MainPanel, { requestedTab: 'help' } as never))

    const tick = () =>
      new Promise<void>(resolve => {
        const raf = anyWindow.requestAnimationFrame
        if (typeof raf === 'function') raf(() => resolve())
        else setTimeout(() => resolve(), 0)
      })

    await tick()

    const traversal = container.querySelector('[aria-label="Graph Traversal"]')
    if (!traversal) throw new Error('expected main panel to render traversal summary chip')
    const chipClass = String(traversal.getAttribute('class') || '')
    if (!chipClass.includes('font-serif') || !chipClass.includes('text-[10px]')) {
      throw new Error(`expected traversal chip to use micro label typography, got ${JSON.stringify(chipClass)}`)
    }

    const spanEls = Array.from(container.querySelectorAll('span')) as HTMLSpanElement[]
    const edgeCount = spanEls.find(el => (el.textContent || '').includes('1 edge'))
    if (!edgeCount) throw new Error('expected traversal chip to include edge count')
    const edgeClass = String(edgeCount.getAttribute('class') || '')
    if (!edgeClass.includes('text-[13px]')) {
      throw new Error(`expected edge count to use monospace size class, got ${JSON.stringify(edgeClass)}`)
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
