import React from 'react'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { useGraphStore } from '@/hooks/useGraphStore'
import { createRoot } from 'react-dom/client'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'

export async function testMarkdownFrontmatterBlocksRenderInViewer() {
  const prev = useGraphStore.getState().frontmatterModeEnabled
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    useGraphStore.getState().setFrontmatterModeEnabled(true)
    const markdown = [
      '---',
      'title: Demo',
      'mermaid: |',
      '  graph TD',
      '    A-->B',
      '---',
      '',
      '# Body',
      '',
      'Hello',
      '',
    ].join('\n')

    const doc = dom.window.document
    const container = doc.createElement('div')
    doc.body.appendChild(container)

    const root = createRoot(container as unknown as HTMLElement)

    const tick = () =>
      new Promise<void>(resolve =>
        dom.window.requestAnimationFrame
          ? dom.window.requestAnimationFrame(() => resolve())
          : setTimeout(() => resolve(), 0),
      )
    await tick()
    await tick()

    root.render(
      React.createElement(MarkdownPreview, {
        markdownText: markdown,
        activeDocumentPath: 'test.md',
        highlightedLineRange: null as React.ComponentProps<typeof MarkdownPreview>['highlightedLineRange'],
        markdownWordWrap: true,
        markdownPresentationMode: false,
        markdownTextHighlight: false,
        uiPanelTextFontClass: 'font-sans',
        uiPanelMonospaceTextClass: 'font-mono',
        annotateDisplayMode: 'inline',
      }),
    )
    await tick()
    await tick()

    if (!doc.querySelector('.highlight-source-yaml')) {
      throw new Error('expected YAML frontmatter code block to render')
    }
    if (!doc.querySelector('.highlight-source-mermaid')) {
      throw new Error('expected Mermaid frontmatter code block to render')
    }

    root.render(
      React.createElement(MarkdownPreview, {
        markdownText: markdown,
        activeDocumentPath: 'test.md',
        highlightedLineRange: null as React.ComponentProps<typeof MarkdownPreview>['highlightedLineRange'],
        markdownWordWrap: true,
        markdownPresentationMode: false,
        markdownTextHighlight: false,
        uiPanelTextFontClass: 'font-sans',
        uiPanelMonospaceTextClass: 'font-mono',
        annotateDisplayMode: 'render',
      }),
    )
    await tick()

    const hasMermaidRenderNode =
      !!doc.querySelector('.mermaid-container') || !!doc.querySelector('figure[aria-label="Mermaid diagram"]')
    if (!hasMermaidRenderNode) {
      throw new Error('expected Mermaid frontmatter to render when annotateDisplayMode is render')
    }
    root.unmount()
  } finally {
    useGraphStore.getState().setFrontmatterModeEnabled(!!prev)
    restoreDom()
    restoreWindow()
  }
}
