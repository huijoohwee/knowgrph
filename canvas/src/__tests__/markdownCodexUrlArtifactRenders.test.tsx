import React from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { readWebpageArtifactFixture } from './helpers/webpageArtifactFixtures'

export async function testMarkdownPreviewRendersCodexUrlArtifact() {
  const { markdownText, activeDocumentPath } = readWebpageArtifactFixture('codex')
  if (/<!--/.test(markdownText)) throw new Error('expected Codex webpage artifact fixture to not include HTML comment markers')

  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    root.render(
      React.createElement(MarkdownPreview, {
        markdownText,
        activeDocumentPath,
        highlightedLineRange: null,
        markdownWordWrap: true,
        markdownPresentationMode: false,
        markdownTextHighlight: false,
        uiPanelTextFontClass: 'font-sans',
        uiPanelMonospaceTextClass: 'font-mono',
        previewOverlayScope: 'container',
        previewOverlayPortalTarget: null,
        previewScrollable: true,
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

    const h1 = container.querySelector('h1')
    if (!h1 || !String(h1.textContent || '').includes('Codex')) {
      throw new Error('expected Codex heading to render')
    }

    const links = container.querySelectorAll('a')
    if (links.length < 3) throw new Error('expected at least a few links to render')

    root.unmount()
  } finally {
    restoreDom()
  }
}
