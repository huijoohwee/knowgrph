import React from 'react'
import { createRoot } from 'react-dom/client'
import { useGraphStore } from '@/hooks/useGraphStore'
import { BottomPanelMarkdownSection } from '@/components/BottomPanel/BottomPanelMarkdownSection'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import type { GraphData } from '@/lib/graph/types'

export async function testCanvasSelectionScrollsAndHighlightsMarkdown() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    if (!doc.defaultView) {
      Object.defineProperty(doc, 'defaultView', {
        value: dom.window,
        configurable: true,
      })
    }

    const anyWindow = dom.window as unknown as {
      requestAnimationFrame?: (cb: (ts: number) => void) => number
    }
    if (!anyWindow.requestAnimationFrame) {
      anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
        setTimeout(() => cb(Date.now()), 0) as unknown as number
    }
    const anyGlobal = globalThis as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    if (!anyGlobal.requestAnimationFrame) {
      anyGlobal.requestAnimationFrame = anyWindow.requestAnimationFrame
    }

    Object.defineProperty(dom.window.HTMLTextAreaElement.prototype, 'scrollHeight', {
      get() {
        return 1000
      },
      configurable: true,
    })
    Object.defineProperty(dom.window.HTMLTextAreaElement.prototype, 'clientHeight', {
      get() {
        return 100
      },
      configurable: true,
    })

    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const lines: string[] = []
    for (let i = 1; i <= 200; i += 1) {
      lines.push(`line ${i}`)
    }
    const markdownText = lines.join('\n')

    const graphData: GraphData = {
      type: 'Graph',
      nodes: [
        {
          id: 'node-100',
          type: 'Paragraph',
          label: 'Target',
          properties: {},
          metadata: {
            documentPath: '',
            lineStart: 100,
            lineEnd: 102,
          },
        },
      ],
      edges: [],
      metadata: {},
    }

    const state = useGraphStore.getState()
    state.setGraphData(graphData as never)
    state.setMarkdownDocument('test.md', markdownText)
    state.setSelectionSource('canvas')
    state.selectNode('node-100')

    root.render(React.createElement(BottomPanelMarkdownSection))

    const tick = () =>
      new Promise<void>(resolve =>
        anyWindow.requestAnimationFrame ? anyWindow.requestAnimationFrame(() => resolve()) : setTimeout(() => resolve(), 0),
      )
    await tick()
    await tick()

    const toggleButton = doc.querySelector(
      'button[aria-label="Toggle text highlight"]',
    ) as HTMLButtonElement | null
    if (!toggleButton) {
      throw new Error('markdown text highlight toggle button not found')
    }
    toggleButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await tick()
    await tick()

    const textarea = doc.querySelector('textarea') as HTMLTextAreaElement | null
    if (!textarea) {
      throw new Error('editor textarea not found')
    }

    Object.defineProperty(textarea, 'scrollHeight', {
      value: 1000,
      configurable: true,
    })
    Object.defineProperty(textarea, 'clientHeight', {
      value: 100,
      configurable: true,
    })

    await tick()
    await tick()

    const scrollTopAfter = textarea.scrollTop
    if (scrollTopAfter <= 0) {
      throw new Error('expected textarea to scroll for selected node line range')
    }

    const gutter = doc.querySelector(
      '.shrink-0.border-r.border-gray-200.bg-gray-50.text-gray-500.relative.overflow-hidden',
    ) as HTMLDivElement | null
    if (!gutter) {
      throw new Error('editor gutter not found')
    }
    const highlighted = gutter.querySelectorAll('[style*="background-color"]')
    if (!highlighted || highlighted.length === 0) {
      throw new Error('expected at least one highlighted line number in gutter')
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}
