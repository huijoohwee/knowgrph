import React from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

const countMermaidDiagramStarts = (text: string): number => {
  const raw = String(text || '')
  const fence = raw.match(/```\s*mermaid[\s\S]*?```/i)
  if (!fence) return 0
  const body = fence[0]
  const starts = body.match(/^\s*(graph|flowchart)\b/gm) || []
  return starts.length
}

export async function testMarkdownMermaidMultiDiagramFenceRendersAllDiagrams() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const markdownText = [
      '# Demo',
      '',
      '```mermaid',
      'graph TD',
      '  A-->B',
      '',
      'graph TD',
      '  C-->D',
      '```',
      '',
    ].join('\n')

    const container = doc.createElement('section')
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)
    root.render(
      React.createElement(MarkdownPreview, {
        markdownText,
        activeDocumentPath: 'graphrag-pipeline-mmd-demo.md',
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

    const rootEl = doc.querySelector('[data-testid="markdown-preview-root"]') as HTMLElement | null
    if (!rootEl) throw new Error('markdown preview root not found')

    const expected = countMermaidDiagramStarts(markdownText)
    const diagrams = rootEl.querySelectorAll('figure[aria-label="Mermaid diagram"]')
    if (expected > 0 && diagrams.length !== expected) {
      throw new Error(`expected multi-diagram mermaid fence to render ${expected} diagrams, got ${diagrams.length}`)
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}
