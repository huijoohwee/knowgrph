import React from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { normalizeMermaidMmdToMarkdown } from 'grph-shared/markdown/mermaidInput'

export async function testMarkdownMmdMermaidRendersInViewer() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const rawMermaid = ['graph TD', 'A[Start] --> B[End]'].join('\n')
    const markdownText = normalizeMermaidMmdToMarkdown('demo.mmd', rawMermaid)
    if (!/```mermaid/i.test(markdownText)) {
      throw new Error('expected .mmd normalization to wrap content in a mermaid code fence')
    }

    const container = doc.createElement('section')
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)
    root.render(
      React.createElement(MarkdownPreview, {
        markdownText,
        activeDocumentPath: 'demo.mmd',
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

    const tick = () => new Promise<void>(resolve => setTimeout(() => resolve(), 0))
    await tick()
    await tick()

    const rootEl = doc.querySelector('[data-testid="markdown-preview-root"]') as HTMLElement | null
    if (!rootEl) throw new Error('markdown preview root not found')

    const mermaidFigure = rootEl.querySelector('figure[aria-label="Mermaid diagram"]')
    if (!mermaidFigure) throw new Error('expected Mermaid diagram figure to render for .mmd input')

    const svg = rootEl.querySelector('.mermaid-container svg')
    if (!svg) throw new Error('expected Mermaid diagram to inject an <svg> into the container')

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}

