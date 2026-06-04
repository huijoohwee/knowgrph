import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { useMarkdownAutoPosition } from '@/features/markdown-workspace/hooks/useMarkdownAutoPosition'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import type { GraphData } from '@/lib/graph/types'
import type { MarkdownWorkspaceLayoutMode as MarkdownLayoutMode } from '@/features/markdown-explorer/workspaceUi'

const tick = async (dom: { window: Window }) => {
  await new Promise<void>(resolve => {
    const raf = (dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }).requestAnimationFrame
    if (typeof raf === 'function') {
      raf(() => resolve())
      return
    }
    setTimeout(() => resolve(), 0)
  })
}

const waitForValue = async <T,>(readValue: () => T | null, dom: { window: Window }, maxTicks = 8): Promise<T | null> => {
  for (let i = 0; i < maxTicks; i += 1) {
    const value = readValue()
    if (value) return value
    await act(async () => {
      await tick(dom)
    })
  }
  return readValue()
}

function MarkdownAutoPositionHarness(props: {
  selectionSource: string | null
  selectedNodeId: string | null
  selectedEdgeId: string | null
  graphData: GraphData | null
  markdownDocumentName: string | null
  triggerJump: (line: number) => void
  markdownText: string
  markdownLayoutMode: MarkdownLayoutMode
  setMarkdownLayoutMode: (mode: MarkdownLayoutMode) => void
  setMarkdownPresentationMode: (mode: boolean) => void
}) {
  useMarkdownAutoPosition({
    selectionSource: props.selectionSource,
    selectedNodeId: props.selectedNodeId,
    selectedEdgeId: props.selectedEdgeId,
    graphData: props.graphData,
    markdownDocumentName: props.markdownDocumentName,
    triggerJump: props.triggerJump,
    frontmatterMermaidCode: '',
    markdownText: props.markdownText,
    markdownLayoutMode: props.markdownLayoutMode,
    setMarkdownLayoutMode: props.setMarkdownLayoutMode,
    setMarkdownPresentationMode: props.setMarkdownPresentationMode,
  })
  return null
}

export async function testCanvasSelectionScrollsAndHighlightsMarkdown() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
  let root: ReturnType<typeof createRoot> | null = null
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

    const lines: string[] = []
    for (let i = 1; i <= 60; i += 1) {
      lines.push(`paragraph ${i}`)
      lines.push('')
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
            documentPath: '/docs/example.md',
            lineStart: 101,
            lineEnd: 101,
          },
        },
      ],
      edges: [],
      metadata: {},
    }

    const container = doc.getElementById('root')
    if (!container) throw new Error('missing root container')

    const requestedLayoutModes: MarkdownLayoutMode[] = []
    const requestedPresentationModes: boolean[] = []
    const requestedJumpLines: number[] = []

    root = createRoot(container as unknown as HTMLElement)
    await act(async () => {
      root?.render(
        React.createElement(MarkdownAutoPositionHarness, {
          selectionSource: 'canvas',
          selectedNodeId: 'node-100',
          selectedEdgeId: null,
          graphData,
          markdownDocumentName: '/docs/example.md',
          triggerJump: (line: number) => {
            requestedJumpLines.push(line)
          },
          markdownText,
          markdownLayoutMode: 'split',
          setMarkdownLayoutMode: (mode: MarkdownLayoutMode) => {
            requestedLayoutModes.push(mode)
          },
          setMarkdownPresentationMode: (mode: boolean) => {
            requestedPresentationModes.push(mode)
          },
        }),
      )
      await tick(dom)
      await tick(dom)
    })

    if (!requestedLayoutModes.includes('editor')) {
      throw new Error(`expected canvas selection to request editor mode, got ${JSON.stringify(requestedLayoutModes)}`)
    }
    if (requestedPresentationModes[0] !== false) {
      throw new Error(`expected canvas selection to disable presentation mode, got ${JSON.stringify(requestedPresentationModes)}`)
    }
    if (requestedJumpLines[0] !== 101) {
      throw new Error(`expected canvas selection to request jump to line 101, got ${JSON.stringify(requestedJumpLines)}`)
    }

    await act(async () => {
      root?.unmount()
    })
    root = createRoot(container as unknown as HTMLElement)
    await act(async () => {
      root?.render(
        React.createElement(MarkdownPreview, {
          markdownText,
          activeDocumentPath: '/docs/example.md',
          highlightedLineRange: { start: 101, end: 101 },
          markdownWordWrap: true,
          markdownPresentationMode: false,
          markdownTextHighlight: true,
          uiPanelTextFontClass: 'font-sans text-xs',
          uiPanelMonospaceTextClass: 'font-mono text-xs',
          previewOverlayScope: 'container',
          previewOverlayPortalTarget: null,
          previewScrollable: true,
          viewMode: 'viewer',
        }),
      )
      await tick(dom)
      await tick(dom)
    })

    const previewRoot = await waitForValue(
      () => doc.querySelector('[data-testid="markdown-preview-root"]') as HTMLElement | null,
      dom,
    )
    if (!previewRoot) throw new Error('expected markdown preview root')

    const highlightedBlock = await waitForValue(
      () => previewRoot.querySelector('[data-start-line="101"]') as HTMLElement | null,
      dom,
    )
    if (!highlightedBlock) throw new Error('expected highlighted markdown block at start line 101')
    if (!String(highlightedBlock.textContent || '').includes('paragraph 51')) {
      throw new Error(`expected highlighted block text for line 101, got ${JSON.stringify(highlightedBlock.textContent || '')}`)
    }
    if (!String(highlightedBlock.getAttribute('class') || '').includes('transition-colors')) {
      throw new Error(`expected highlighted markdown block classes, got ${JSON.stringify(highlightedBlock.getAttribute('class') || '')}`)
    }

    const nonHighlightedBlock = previewRoot.querySelector('[data-start-line="99"]') as HTMLElement | null
    if (!nonHighlightedBlock) throw new Error('expected neighboring markdown block at start line 99')
    if (String(nonHighlightedBlock.getAttribute('class') || '').includes('transition-colors')) {
      throw new Error('expected neighboring markdown block to remain unhighlighted')
    }
  } finally {
    try {
      await act(async () => {
        root?.unmount()
      })
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}
