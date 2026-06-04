import React from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export async function testMarkdownPreviewRendersCustomElementContainers() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const markdownText = [
      '<astro-island>',
      '  <section class="grid grid-cols-2 gap-4">',
      '    <section>Left</section>',
      '    <section>Right</section>',
      '  </section>',
      '</astro-island>',
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

    const txt = String(container.textContent || '')
    if (!txt.includes('Left') || !txt.includes('Right')) {
      throw new Error('expected custom element container to preserve children content')
    }
    const grid = Array.from(container.querySelectorAll('section[style]')).find(el =>
      /grid-template-columns:\s*repeat\(2/i.test(String((el as HTMLElement).getAttribute('style') || '')),
    )
    if (!grid) throw new Error('expected grid inside custom element container to render')

    root.unmount()
  } finally {
    restoreDom()
  }
}

