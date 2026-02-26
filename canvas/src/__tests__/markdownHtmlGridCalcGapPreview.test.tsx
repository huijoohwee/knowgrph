import React from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export async function testMarkdownPreviewRendersHtmlGridWithCalcGapImportant() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const markdownText = [
      '<div class="grid-test" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:calc(1rem + 2px) !important;">',
      '  <div>Cell A</div>',
      '  <div>Cell B</div>',
      '</div>',
      '',
    ].join('\n')

    root.render(
      React.createElement(MarkdownPreview, {
        markdownText,
        activeDocumentPath: '/test.md',
        highlightedLineRange: null,
        markdownWordWrap: true,
        markdownPresentationMode: false,
        markdownTextHighlight: false,
        uiPanelTextFontClass: 'font-sans',
        uiPanelMonospaceTextClass: 'font-mono',
        previewOverlayScope: 'container',
        previewOverlayPortalTarget: null,
        previewScrollable: false,
        showSidebar: false,
      }),
    )

    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: () => void) => number }
    const tick = () =>
      new Promise<void>(resolve => {
        const raf = anyWindow.requestAnimationFrame
        if (raf) {
          raf(() => resolve())
          return
        }
        setTimeout(() => resolve(), 0)
      })

    for (let i = 0; i < 12; i += 1) await tick()

    const grid = container.querySelector('section.grid-test') as HTMLElement | null
    if (!grid) throw new Error('expected grid container to render')
    if (grid.style.display !== 'grid') throw new Error(`expected display:grid, got: ${grid.getAttribute('style') || ''}`)
    if (!grid.style.gridTemplateColumns) throw new Error(`expected grid-template-columns, got: ${grid.getAttribute('style') || ''}`)
    if (grid.style.gap !== 'calc(1rem + 2px)') {
      throw new Error(`expected calc gap without !important, got: ${grid.getAttribute('style') || ''}`)
    }

    root.unmount()
  } finally {
    restoreDom()
  }
}

