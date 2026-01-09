import React from 'react'
import { createRoot } from 'react-dom/client'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData } from '@/lib/graph/types'
import PreviewPanelView from '@/features/panels/views/PreviewPanelView'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

const buildGraphWithMediaNode = (): GraphData => ({
  type: 'Graph',
  nodes: [
    {
      id: 'n1',
      type: 'Image',
      label: 'Example media node',
      properties: {
        media_kind: 'image',
        image: 'https://example.com/example.png',
      },
      metadata: {
        documentPath: 'doc.md',
        lineStart: 5,
        lineEnd: 7,
      },
    },
  ],
  edges: [],
})

const buildMarkdown = (): string =>
  [
    '# Title',
    '',
    'Paragraph before image.',
    '',
    '![Inline image](https://example.com/example.png)',
    '',
  ].join('\n')

const waitForNextFrame = (win: Window): Promise<void> => {
  const anyWindow = win as unknown as { requestAnimationFrame?: (cb: () => void) => number }
  if (!anyWindow.requestAnimationFrame) {
    anyWindow.requestAnimationFrame = (cb: () => void) =>
      setTimeout(cb, 0) as unknown as number
  }
  return new Promise<void>(resolve => anyWindow.requestAnimationFrame!(() => resolve()))
}

export async function testPreviewPanelGraphMediaSelectionOpensMarkdownPanel() {
  const storage = new MemoryStorage()
  const { dom, restore: restoreDom } = initJsdomHarness()
  const { restore: restoreWindow } = initWindowHarness({ storage })

  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const state = useGraphStore.getState()
    const graph = buildGraphWithMediaNode()
    state.setGraphData(graph)
    state.setMarkdownDocument('doc.md', buildMarkdown())
    state.setBottomPanelTab('data')
    state.setBottomPanelCurationView('grid')
    state.selectNode(null)
    state.setSelectionSource(null)
    state.setMarkdownPreviewMermaidFocus(null)
    state.setMarkdownPreviewActiveMediaKey(null)

    root.render(React.createElement(PreviewPanelView))
    await waitForNextFrame(dom.window)

    const buttons = Array.from(doc.querySelectorAll('button')) as HTMLButtonElement[]
    const graphCard = buttons.find(btn => {
      const text = btn.textContent || ''
      return text.includes('Graph') && text.includes('Node media:')
    })
    if (!graphCard) {
      throw new Error('graph media gallery card not found')
    }

    graphCard.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await waitForNextFrame(dom.window)

    const after = useGraphStore.getState()

    if (after.selectedNodeId !== 'n1') {
      throw new Error(`expected selectedNodeId to be "n1", got ${String(after.selectedNodeId)}`)
    }
    if (after.selectionSource !== 'toolbar') {
      throw new Error(`expected selectionSource "toolbar", got ${String(after.selectionSource)}`)
    }
    if (after.bottomPanelTab !== 'curation') {
      throw new Error(`expected bottomPanelTab "curation", got ${String(after.bottomPanelTab)}`)
    }
    if (after.bottomPanelCurationView !== 'markdown') {
      throw new Error(
        `expected bottomPanelCurationView "markdown", got ${String(after.bottomPanelCurationView)}`,
      )
    }
    const expectedKey = 'graph-node-media:n1:image:https://example.com/example.png'
    if (after.markdownPreviewActiveMediaKey !== expectedKey) {
      throw new Error(
        `expected markdownPreviewActiveMediaKey "${expectedKey}", got ${String(
          after.markdownPreviewActiveMediaKey,
        )}`,
      )
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}

