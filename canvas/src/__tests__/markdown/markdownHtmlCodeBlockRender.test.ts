import React from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export async function testMarkdownHtmlCodeBlockRendersAsSafeHtmlInRenderMode() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const markdownText = [
      '```html',
      '<section><v-mark type="underline" color="yellow">Hello</v-mark></section>',
      '```',
    ].join('\n')

    const container = doc.createElement('section')
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)
    root.render(
      React.createElement(MarkdownPreview, {
        markdownText,
        activeDocumentPath: 'inline-html.md',
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
    for (let i = 0; i < 4; i += 1) await tick(i ? 10 : 0)

    const mark = doc.querySelector('span.underline') as HTMLElement | null
    if (!mark) throw new Error('expected html code block to render as safe HTML in Render mode')
    if (!String(mark.textContent || '').includes('Hello')) throw new Error('expected rendered html to include text')

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}

