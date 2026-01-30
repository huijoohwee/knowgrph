import React from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { useGraphStore } from '@/hooks/useGraphStore'

export async function testMarkdownMermaidOpensPreviewOnDoubleClickOnly() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const markdownText = [
      '```mermaid',
      'graph TB',
      '  A[Start] --> B[End]',
      '```',
    ].join('\n')

    useGraphStore.getState().setMarkdownPreviewMermaidFocus(null)

    const container = doc.createElement('section')
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)
    root.render(
      React.createElement(MarkdownPreview, {
        markdownText,
        activeDocumentPath: 'inline-mermaid.md',
        highlightedLineRange: null,
        markdownWordWrap: true,
        markdownPresentationMode: false,
        markdownTextHighlight: false,
        uiPanelTextFontClass: 'font-sans text-xs',
        uiPanelMonospaceTextClass: 'font-mono text-xs',
        previewOverlayScope: 'viewport',
        previewOverlayPortalTarget: null,
        previewScrollable: true,
        annotateDisplayMode: 'render',
      } as never),
    )

    const tick = (ms = 0) => new Promise<void>(resolve => setTimeout(() => resolve(), ms))
    for (let i = 0; i < 6; i += 1) await tick(i ? 10 : 0)

    const figure = doc.querySelector('figure[aria-label="Mermaid diagram"]') as HTMLElement | null
    if (!figure) throw new Error('expected Mermaid diagram figure to exist')

    figure.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    const afterClick = useGraphStore.getState().markdownPreviewMermaidFocusCode
    if (afterClick) throw new Error('expected single click to NOT open preview focus')

    figure.dispatchEvent(new dom.window.MouseEvent('dblclick', { bubbles: true }))
    const afterDblClick = useGraphStore.getState().markdownPreviewMermaidFocusCode
    if (!afterDblClick || !afterDblClick.includes('graph TB')) {
      throw new Error('expected double click to open preview focus with Mermaid code')
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}

