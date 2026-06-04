import React from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export async function testMarkdownPreviewRendersSvgFromUnlabeledFence() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const markdownText = [
      '```',
      '<svg viewBox="0 0 10 10" width="10" height="10">',
      '  <circle cx="5" cy="5" r="4" />',
      '</svg>',
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
        annotateDisplayMode: 'render',
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

    const img = container.querySelector('img')
    if (!img) throw new Error('expected svg code fence to render as <img>')
    const src = String(img.getAttribute('src') || '')
    if (!src.startsWith('data:image/svg+xml;base64,')) throw new Error(`expected svg data uri, got: ${src.slice(0, 80)}`)

    root.unmount()
  } finally {
    restoreDom()
  }
}

export async function testMarkdownPreviewRendersSpriteSvgFenceAsImageWhenSymbolPresent() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const markdownText = [
      '```svg',
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">',
      '  <defs>',
      '    <symbol id="logos-node" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="red"/></symbol>',
      '  </defs>',
      '  <use href="#logos-node"></use>',
      '</svg>',
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
        annotateDisplayMode: 'render',
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

    const img = container.querySelector('img')
    if (!img) throw new Error('expected sprite svg fence to render as <img> when symbol is present')
    const src = String(img.getAttribute('src') || '')
    if (!src.startsWith('data:image/svg+xml;base64,')) throw new Error(`expected svg data uri, got: ${src.slice(0, 80)}`)

    root.unmount()
  } finally {
    restoreDom()
  }
}
