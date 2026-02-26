import React from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export async function testMarkdownPreviewRendersInlineHtmlRichMedia() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const markdownText = [
      'Before <img src="https://example.com/a.webp" alt="WebP" /> After',
      '',
      'Before <iframe src="https://example.com/"></iframe> After',
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

    const img = container.querySelector('img[alt="WebP"]') as HTMLImageElement | null
    if (!img) throw new Error('expected inline HTML img to render')
    const src = String(img.getAttribute('src') || '')
    if (!src) throw new Error('expected inline HTML img src to be set')
    if (!/a\.webp/i.test(decodeURIComponent(src))) throw new Error(`expected inline HTML img to reference .webp, got: ${src}`)

    const iframe = container.querySelector('iframe') as HTMLIFrameElement | null
    if (!iframe) throw new Error(`expected inline HTML iframe to render; html=${container.innerHTML}`)
    const iframeSrc = String(iframe.getAttribute('src') || '')
    if (!iframeSrc) throw new Error('expected inline HTML iframe src to be set')

    root.unmount()
  } finally {
    restoreDom()
  }
}
