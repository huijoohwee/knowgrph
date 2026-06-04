import React from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export async function testMarkdownPreviewRendersInlineHtmlGridInsideParagraph() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const markdownText = [
      'Grid: <section class="grid-cols-2 gap-4"><section>Left</section><section>Right</section></section>',
      '',
      'Columns: <section style="column-count:2;column-gap:16px"><section>ColA</section><section>ColB</section></section>',
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

    for (let i = 0; i < 8; i += 1) await tick()

    const styledSections = Array.from(container.querySelectorAll('section[style]')) as unknown as HTMLElement[]
    const grid = styledSections.find(el => /grid-template-columns:\s*repeat\(2/i.test(String(el.getAttribute('style') || '')))
    if (!grid) throw new Error('expected inline HTML grid to be rendered with derived grid-template-columns')
    if (!/display:\s*grid/i.test(String(grid.getAttribute('style') || ''))) {
      throw new Error('expected inline HTML grid to infer display:grid')
    }
    if (!String(container.textContent || '').includes('Left') || !String(container.textContent || '').includes('Right')) {
      throw new Error('expected grid inner text to render')
    }

    const columns = styledSections.find(el => /column-count:\s*2/i.test(String(el.getAttribute('style') || '')))
    if (!columns) throw new Error('expected inline HTML columns container to be rendered with column-count:2')

    root.unmount()
  } finally {
    restoreDom()
  }
}
