import React from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export async function testMarkdownPreviewRendersSvgAndIframeHtmlBlocks() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const markdownText = [
      '<svg viewBox="0 0 10 10" width="10" height="10"><circle cx="5" cy="5" r="4" /></svg>',
      '',
      '<iframe srcdoc="<!doctype html><html><body><h1>Hi</h1></body></html>"></iframe>',
      '',
      '<details open><summary>More</summary><p>Details body</p></details>',
      '',
      '<audio controls src="/audio.mp3"></audio>',
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

    for (let i = 0; i < 16; i += 1) await tick()

    const svg = container.querySelector('svg')
    if (!svg) throw new Error('expected svg to be rendered')
    const iframe = container.querySelector('iframe')
    if (!iframe) throw new Error('expected iframe to be rendered')
    const details = container.querySelector('details')
    if (!details) throw new Error('expected details to be rendered')
    const audio = container.querySelector('audio')
    if (!audio) throw new Error('expected audio to be rendered')

    root.unmount()
  } finally {
    restoreDom()
  }
}
