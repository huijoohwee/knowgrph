import React from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export async function testMarkdownPreviewRendersArticleGridAndDisablesWrapForAsciiTables() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const markdownText = [
      '<article class="grid grid-cols-2 gap-4">',
      '  <section>Left</section>',
      '  <section>Right</section>',
      '</article>',
      '',
      '```',
      '... | ## Compose with code',
      '... | ## Edit dynamically',
      '... |',
      '... | ## Scalable rendering',
      '```',
      '',
      '```',
      '┌──┬──┐',
      '│ A│ B│',
      '└──┴──┘',
      '```',
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

    const articles = Array.from(container.querySelectorAll('article')) as unknown as HTMLElement[]
    const article = articles.find(el => String(el.getAttribute('class') || '').includes('grid-cols-2')) || null
    if (!article) throw new Error('expected article grid container to be rendered')
    const styleAttr = String(article.getAttribute('style') || '')
    if (!/display:\s*grid/i.test(styleAttr)) throw new Error(`expected article grid to preserve display:grid, got: ${styleAttr}`)
    if (!/grid-template-columns:\s*repeat\(2/i.test(styleAttr)) {
      throw new Error(`expected article grid-cols-2 to derive grid-template-columns, got: ${styleAttr}`)
    }

    const preLayout = (Array.from(container.querySelectorAll('pre')) as unknown as HTMLElement[]).find(p =>
      String((p as HTMLElement).textContent || '').includes('Compose with code'),
    )
    if (!preLayout) throw new Error('expected pipe-column layout fence to render')
    if (String(preLayout.getAttribute('class') || '').includes('whitespace-pre-wrap')) {
      throw new Error('expected pipe-column layout fence to disable wrapping even when markdownWordWrap is enabled')
    }

    const pre = (Array.from(container.querySelectorAll('pre')) as unknown as HTMLElement[]).find(p =>
      String((p as HTMLElement).textContent || '').includes('┌──'),
    )
    if (!pre) throw new Error('expected ascii table code block to render')
    if (String(pre.getAttribute('class') || '').includes('whitespace-pre-wrap')) {
      throw new Error('expected ascii table code block to disable wrapping even when markdownWordWrap is enabled')
    }

    root.unmount()
  } finally {
    restoreDom()
  }
}
