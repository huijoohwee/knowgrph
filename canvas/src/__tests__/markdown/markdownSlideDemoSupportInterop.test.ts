import React from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { readMarkdownSlideDemo, resolveMarkdownSlideDemoDocumentPath } from '@/tests/lib/markdownSlideDemo'
import { slugify } from 'grph-shared/markdown/slugify'

export async function testMarkdownSlideDemoSupportInteropFeaturesRenderAndLink() {
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

    const tick = () => new Promise<void>(resolve => setTimeout(() => resolve(), 0))
    await tick()
    await tick()

    const rootEl = doc.querySelector('[data-testid="markdown-preview-root"]') as HTMLDivElement | null
    if (!rootEl) throw new Error('markdown preview root not found')

    const anchor = doc.getElementById('phase-1-input')
    if (!anchor || !rootEl.contains(anchor)) {
      throw new Error('expected <a id="phase-1-input"></a> to be preserved in rendered DOM')
    }

    const blockAnchor = doc.getElementById('^mermaid-s2-decide')
    if (!blockAnchor || !rootEl.contains(blockAnchor)) {
      throw new Error('expected block-id anchor ^mermaid-s2-decide to be rendered in DOM')
    }

    const expectedHeadingId = slugify('Phase 2 Transform (Mermaid S2)')
    const headingEl = doc.getElementById(expectedHeadingId)
    if (!headingEl) {
      throw new Error(`expected heading id ${expectedHeadingId} to exist in DOM`)
    }

    const blockLink = rootEl.querySelector('a[href="#^mermaid-s2-decide"]')
    if (!blockLink) {
      throw new Error('expected wikilink [[#^mermaid-s2-decide]] to render as href="#^mermaid-s2-decide"')
    }

    const headingLink = rootEl.querySelector(`a[href="#${expectedHeadingId}"]`)
    if (!headingLink) {
      throw new Error('expected wikilink [[#Phase 2 Transform (Mermaid S2)]] to render as an in-doc anchor link')
    }

    const callout = rootEl.querySelector('aside[aria-label="Status"], details[aria-label="Status"]')
    if (!callout) {
      throw new Error('expected callout blockquote syntax to render as a callout container')
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}
