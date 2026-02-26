import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export async function testMarkdownPreviewRendersCodexUrlArtifact() {
  const p = path.resolve(process.cwd(), 'sandbox', 'tmp-codex.md')
  const markdownText = fs.readFileSync(p, 'utf8')
  if (!markdownText || !markdownText.trim()) throw new Error('expected tmp-codex.md to be non-empty')
  if (/<!--/.test(markdownText)) throw new Error('expected tmp-codex.md to not include HTML comment markers')

  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    root.render(
      React.createElement(MarkdownPreview, {
        markdownText,
        activeDocumentPath: '/sandbox/tmp-codex.md',
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
