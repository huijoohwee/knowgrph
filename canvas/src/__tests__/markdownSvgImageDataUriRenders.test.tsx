import React from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export async function testMarkdownPreviewRendersSvgImageDataUri() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const svg = '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="red"/></svg>'
    const b64 = Buffer.from(svg, 'utf8').toString('base64')

    const markdownText = [`![node](data:image/svg+xml;base64,${b64})`, ''].join('\n')

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

    for (let i = 0; i < 10; i += 1) await tick()

    const img = container.querySelector('img')
    if (!img) throw new Error('expected markdown svg data-uri image to render as <img>')
    const src = String(img.getAttribute('src') || '')
    if (!src.startsWith('data:image/svg+xml;base64,')) throw new Error(`expected svg data uri src, got: ${src.slice(0, 80)}`)
    const decoded = Buffer.from(src.replace(/^data:image\/svg\+xml;base64,/i, ''), 'base64').toString('utf8')
    if (!/xmlns\s*=/.test(decoded)) throw new Error(`expected svg data uri to include xmlns, got: ${decoded.slice(0, 120)}`)

    root.unmount()
  } finally {
    restoreDom()
  }
}
