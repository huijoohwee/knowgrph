import React from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { useGraphStore } from '@/hooks/useGraphStore'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import type { GraphData } from '@/lib/graph/types'

const tick = async (n: number = 1) => {
  for (let i = 0; i < n; i += 1) {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
  }
}

const ensureRangeRect = (dom: ReturnType<typeof initJsdomHarness>['dom']) => {
  try {
    const proto = (dom.window as unknown as { Range?: { prototype?: Record<string, unknown> } }).Range?.prototype as unknown as {
      getBoundingClientRect?: () => DOMRect
    } | null
    if (proto && typeof proto.getBoundingClientRect !== 'function') {
      proto.getBoundingClientRect = () => {
        return {
          x: 0, y: 0, top: 0, left: 0, right: 10, bottom: 10, width: 10, height: 10, toJSON: () => ({}),
        } as unknown as DOMRect
      }
    }
  } catch {
    void 0
  }
}

const findButtonByExactText = (rootEl: HTMLElement, label: string): HTMLButtonElement | null => {
  const buttons = Array.from(rootEl.querySelectorAll('button'))
  for (const btn of buttons) {
    const text = (btn.textContent || '').trim()
    if (text === label) return btn as HTMLButtonElement
  }
  return null
}

export async function testInlineEditToolbarMoreMenuIncludesSelectionActionsAndNoDuplicateBubble() {
  const { dom, restore } = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  ensureRangeRect(dom)
  const doc = dom.window.document
  const container = doc.getElementById('root')
  if (!container) throw new Error('missing root container')
  const root = createRoot(container as unknown as HTMLElement)

  try {
    const graphData: GraphData = {
      type: 'Graph',
      nodes: [
        {
          id: 'n1',
          type: 'Paragraph',
          label: 'Hello',
          properties: {},
          metadata: { documentPath: 'docs/example.md', lineStart: 1, lineEnd: 1 },
        },
      ],
      edges: [],
      metadata: {},
    }
    const store = useGraphStore.getState()
    store.setGraphData(graphData as never)
    store.selectNode(null)
    store.selectEdge(null)

    root.render(
      React.createElement(MarkdownPreview, {
        markdownText: 'Hello world',
        activeDocumentPath: 'docs/example.md',
        highlightedLineRange: null,
        markdownWordWrap: true,
        markdownPresentationMode: false,
        markdownTextHighlight: false,
        uiPanelTextFontClass: 'font-sans text-xs',
        uiPanelMonospaceTextClass: 'font-mono text-xs',
        previewOverlayScope: 'container',
        previewOverlayPortalTarget: null,
        previewScrollable: true,
        onReplaceLineRange: () => {},
      } as never),
    )

    await tick(6)

    const host = doc.querySelector('[data-start-line="1"]') as HTMLElement | null
    if (!host) throw new Error('expected host for start line 1')
    host.getBoundingClientRect = () => {
      return {
        x: 0, y: 0, top: 0, left: 0, right: 460, bottom: 60, width: 460, height: 60, toJSON: () => ({}),
      } as unknown as DOMRect
    }
    host.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, clientX: 28, clientY: 16, detail: 1 }))
    await tick(6)

    const editor = doc.querySelector('[contenteditable="true"]') as HTMLElement | null
    if (!editor) throw new Error('expected inline editor after click')

    const textNode = editor.firstChild
    if (!textNode || textNode.nodeType !== dom.window.Node.TEXT_NODE) throw new Error('expected editor text node')
    const range = doc.createRange()
    range.setStart(textNode, 0)
    range.setEnd(textNode, 5)
    const sel = dom.window.getSelection()
    if (!sel) throw new Error('expected selection')
    sel.removeAllRanges()
    sel.addRange(range)
    doc.dispatchEvent(new dom.window.Event('selectionchange'))
    editor.dispatchEvent(new dom.window.MouseEvent('mouseup', { bubbles: true, cancelable: true, detail: 1 }))
    await tick(6)

    const selectionActionsBubble = doc.querySelector('button[aria-label="Selection actions"]')
    if (selectionActionsBubble) throw new Error('did not expect separate Selection actions bubble while inline edit enabled')

    const toolbar = doc.querySelector('menu[aria-label="Inline selection toolbar"]') as HTMLElement | null
    if (!toolbar) throw new Error('expected inline selection toolbar')

    const moreSummary = toolbar.querySelector('button[aria-label="More"]') as HTMLElement | null
    if (!moreSummary) throw new Error('expected More trigger in inline toolbar')
    moreSummary.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
    await tick(2)

    const showOnCanvas = findButtonByExactText(doc.body, 'Show on Canvas')
    if (!showOnCanvas) throw new Error('expected Show on Canvas inside inline toolbar More menu')
    showOnCanvas.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
    await tick(2)

    const selectedNodeId = useGraphStore.getState().selectedNodeId
    if (selectedNodeId !== 'n1') throw new Error(`expected selectedNodeId to be n1, got ${String(selectedNodeId)}`)
  } finally {
    try { root.unmount() } catch { void 0 }
    restore()
  }
}
