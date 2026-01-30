import React from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { readMarkdownSlideDemo, resolveMarkdownSlideDemoDocumentPath } from '@/tests/lib/markdownSlideDemo'

export async function testMarkdownIframeSrcdocRendersAsSandboxedIframe() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const markdownText = readMarkdownSlideDemo()
    if (!markdownText) return

    const container = doc.createElement('section')
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)
    root.render(
      React.createElement(MarkdownPreview, {
        markdownText,
        activeDocumentPath: resolveMarkdownSlideDemoDocumentPath() ?? 'markdown-slide-demo.md',
        highlightedLineRange: null,
        markdownWordWrap: true,
        markdownPresentationMode: false,
        markdownTextHighlight: false,
        uiPanelTextFontClass: 'font-sans text-xs',
        uiPanelMonospaceTextClass: 'font-mono text-xs',
        previewOverlayScope: 'viewport',
        previewOverlayPortalTarget: null,
        previewScrollable: true,
      } as never),
    )

    const tick = (ms = 0) => new Promise<void>(resolve => setTimeout(() => resolve(), ms))
    for (let i = 0; i < 6; i += 1) await tick(i ? 10 : 0)

    const iframe = doc.querySelector('iframe[sandbox][srcdoc]') as HTMLIFrameElement | null
    if (!iframe) throw new Error('expected srcdoc iframe to be rendered as a sandboxed iframe')
    const srcdoc = iframe.getAttribute('srcdoc') || ''
    if (!srcdoc || !srcdoc.includes('Rich Media')) {
      throw new Error('expected iframe srcdoc content to be preserved')
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}

