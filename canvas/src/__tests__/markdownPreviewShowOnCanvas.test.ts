import React from 'react'
import { createRoot } from 'react-dom/client'
import { useGraphStore } from '@/hooks/useGraphStore'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import type { GraphData } from '@/lib/graph/types'

const findButtonByExactText = (rootEl: HTMLElement, label: string): HTMLButtonElement | null => {
  const buttons = Array.from(rootEl.querySelectorAll('button'))
  for (const btn of buttons) {
    const text = (btn.textContent || '').trim()
    if (text === label) return btn as HTMLButtonElement
  }
  return null
}

export async function testMarkdownPreviewShowOnCanvasSelectsExpectedNode() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const anyWindow = dom.window as unknown as {
      requestAnimationFrame?: (cb: (ts: number) => void) => number
      getSelection?: () => Selection | null
    }
    if (!anyWindow.requestAnimationFrame) {
      anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
        setTimeout(() => cb(Date.now()), 0) as unknown as number
    }
    const anyGlobal = globalThis as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    if (!anyGlobal.requestAnimationFrame) {
      anyGlobal.requestAnimationFrame = anyWindow.requestAnimationFrame
    }

    const doc = dom.window.document

    const graphData: GraphData = {
      type: 'Graph',
      nodes: [
        {
          id: 'n1',
          type: 'Paragraph',
          label: 'First',
          properties: {},
          metadata: {
            documentPath: 'docs/example.md',
            lineStart: 5,
            lineEnd: 7,
          },
        },
        {
          id: 'n2',
          type: 'Paragraph',
          label: 'Second',
          properties: {},
          metadata: {
            documentPath: 'docs/example.md',
            lineStart: 20,
            lineEnd: 22,
          },
        },
      ],
      edges: [],
      metadata: {},
    }

    const state = useGraphStore.getState()
    state.setGraphData(graphData as never)
    state.selectNode(null)
    state.selectEdge(null)

    const markdownLines = [
      '# Title',
      '',
      'intro',
      '',
      'first para line 1',
      'first para line 2',
      'first para line 3',
      '',
      'other content',
      '',
      'second para line 1',
      'second para line 2',
      'second para line 3',
    ]
    const markdownText = markdownLines.join('\n')

    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    root.render(
      React.createElement(MarkdownPreview, {
        markdownText,
        activeDocumentPath: 'docs/example.md',
        highlightedLineRange: null,
        markdownWordWrap: true,
        markdownPresentationMode: false,
        markdownTextHighlight: false,
        uiPanelTextFontClass: 'font-sans text-xs',
        uiPanelMonospaceTextClass: 'font-mono text-xs',
        previewOverlayScope: 'viewport',
        previewOverlayPortalTarget: null,
        previewScrollable: true,
      } as never),
    )

    const tick = () =>
      new Promise<void>(resolve =>
        anyWindow.requestAnimationFrame ? anyWindow.requestAnimationFrame(() => resolve()) : setTimeout(() => resolve(), 0),
      )
    await tick()

    const rootEl = doc.querySelector('[data-testid="markdown-preview-root"]') as HTMLDivElement | null
    if (!rootEl) {
      throw new Error('markdown preview root not found')
    }

    const targetBlock = rootEl.querySelector('[data-start-line="5"]') as HTMLElement | null
    if (!targetBlock) {
      throw new Error('block with data-start-line=5 not found')
    }

    anyWindow.getSelection = () =>
      ({
        isCollapsed: false,
      } as unknown as Selection)

    const contextMenuEvent = new dom.window.MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 10,
      clientY: 10,
    })
    Object.defineProperty(contextMenuEvent, 'target', {
      value: targetBlock,
      writable: false,
    })

    rootEl.dispatchEvent(contextMenuEvent)
    await tick()

    const menuButton = findButtonByExactText(rootEl, 'Show on Canvas')
    if (!menuButton) {
      throw new Error('Show on Canvas menu button not found')
    }

    menuButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await tick()

    const selectedNodeId = useGraphStore.getState().selectedNodeId
    const selectedEdgeId = useGraphStore.getState().selectedEdgeId
    if (selectedNodeId !== 'n1') {
      throw new Error(
        `expected selectedNodeId to be "n1" after Show on Canvas, got ${String(selectedNodeId)} (edge=${String(selectedEdgeId)})`,
      )
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}

export async function testMarkdownPreviewContextMenuRendersInsideRoot() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const anyWindow = dom.window as unknown as {
      requestAnimationFrame?: (cb: (ts: number) => void) => number
      getSelection?: () => Selection | null
    }
    if (!anyWindow.requestAnimationFrame) {
      anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
        setTimeout(() => cb(Date.now()), 0) as unknown as number
    }
    const anyGlobal = globalThis as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    if (!anyGlobal.requestAnimationFrame) {
      anyGlobal.requestAnimationFrame = anyWindow.requestAnimationFrame
    }

    const doc = dom.window.document

    const markdownLines = [
      '# Title',
      '',
      'intro',
      '',
      'first para line 1',
      'first para line 2',
      'first para line 3',
    ]
    const markdownText = markdownLines.join('\n')

    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    root.render(
      React.createElement(MarkdownPreview, {
        markdownText,
        activeDocumentPath: 'docs/example.md',
        highlightedLineRange: null,
        markdownWordWrap: true,
        markdownPresentationMode: false,
        markdownTextHighlight: false,
        uiPanelTextFontClass: 'font-sans text-xs',
        uiPanelMonospaceTextClass: 'font-mono text-xs',
        previewOverlayScope: 'viewport',
        previewOverlayPortalTarget: null,
        previewScrollable: true,
      } as never),
    )

    const tick = () =>
      new Promise<void>(resolve =>
        anyWindow.requestAnimationFrame ? anyWindow.requestAnimationFrame(() => resolve()) : setTimeout(() => resolve(), 0),
      )
    await tick()

    const rootEl = doc.querySelector('[data-testid="markdown-preview-root"]') as HTMLDivElement | null
    if (!rootEl) {
      throw new Error('markdown preview root not found')
    }

    const targetBlock = rootEl.querySelector('[data-start-line="5"]') as HTMLElement | null
    if (!targetBlock) {
      throw new Error('block with data-start-line=5 not found')
    }

    anyWindow.getSelection = () =>
      ({
        isCollapsed: false,
      } as unknown as Selection)

    const contextMenuEvent = new dom.window.MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 10,
      clientY: 10,
    })
    Object.defineProperty(contextMenuEvent, 'target', {
      value: targetBlock,
      writable: false,
    })

    rootEl.dispatchEvent(contextMenuEvent)
    await tick()

    const menuButton = findButtonByExactText(rootEl, 'Show on Canvas')
    if (!menuButton) {
      throw new Error('context menu button not found inside markdown preview root')
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}
