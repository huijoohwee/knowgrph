import React from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export async function testMarkdownPreviewRendersWebpageSnapshotForStandaloneLinkAndScriptEmbed() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const markdownText = [
      '[Example](https://example.com/abc)',
      '',
      '<blockquote><a href="https://example.com/embed">Embed</a></blockquote><script async src="https://example.com/widget.js"></script>',
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

    const snapshots = Array.from(container.querySelectorAll('[data-kg-webpage-snapshot="1"]'))
    if (snapshots.length < 2) throw new Error(`expected >=2 webpage snapshots, got: ${snapshots.length}`)

    const standalone = snapshots.find(el => String(el.getAttribute('data-src') || '').includes('example.com/abc'))
    if (!standalone) throw new Error('expected snapshot for standalone markdown link')
    const scriptEmbed = snapshots.find(el => String(el.getAttribute('data-src') || '').includes('example.com/embed'))
    if (!scriptEmbed) throw new Error('expected snapshot for HTML script embed')

    root.unmount()
  } finally {
    restoreDom()
  }
}

