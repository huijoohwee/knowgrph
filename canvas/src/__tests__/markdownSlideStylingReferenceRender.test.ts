import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export async function testMarkdownSlideStylingReferenceRendersInViewerAndPresentationModes() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const anyWindow = dom.window as unknown as {
      requestAnimationFrame?: (cb: (ts: number) => void) => number
    }
    if (!anyWindow.requestAnimationFrame) {
      anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
        setTimeout(() => cb(Date.now()), 0) as unknown as number
    }
    const anyGlobal = globalThis as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    if (!anyGlobal.requestAnimationFrame) {
      anyGlobal.requestAnimationFrame = anyWindow.requestAnimationFrame
    }

    const doc = dom.window.document

    const mdPath = resolve(
      process.cwd(),
      '..',
      '..',
      'huijoohwee.github.io',
      'guidelines',
      'markdown-slide-styling-guidelines.md',
    )
    const markdownText = readFileSync(mdPath, 'utf8')

    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    root.render(
      React.createElement(MarkdownPreview, {
        markdownText,
        activeDocumentPath: 'docs/markdown-slide-styling-guidelines.md',
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

    const tick = () =>
      new Promise<void>(resolvePromise =>
        anyWindow.requestAnimationFrame
          ? anyWindow.requestAnimationFrame(() => resolvePromise())
          : setTimeout(() => resolvePromise(), 0),
      )
    await tick()

    const rootEl = doc.querySelector('[data-testid="markdown-preview-root"]') as HTMLDivElement | null
    if (!rootEl) {
      throw new Error('markdown preview root not found')
    }

    const textContent = (rootEl.textContent || '').replace(/\s+/g, ' ').trim()
    if (!textContent.includes('Markdown Slide Styling Guidelines')) {
      throw new Error('expected title from slide styling guidelines to be present in viewer mode')
    }
    if (!textContent.includes('Click-Based Progressive Disclosure')) {
      throw new Error('expected click-based section heading to be present in viewer mode')
    }

    root.unmount()

    const container2 = doc.createElement('div')
    container2.id = 'root-presentation'
    doc.body.appendChild(container2)
    const root2 = createRoot(container2 as unknown as HTMLElement)

    const presentationApiRef = React.createRef<{ prev: () => void; next: () => void }>()

    root2.render(
      React.createElement(MarkdownPreview, {
        markdownText,
        activeDocumentPath: 'docs/markdown-slide-styling-guidelines.md',
        highlightedLineRange: null,
        markdownWordWrap: true,
        markdownPresentationMode: true,
        markdownTextHighlight: false,
        uiPanelTextFontClass: 'font-sans text-xs',
        uiPanelMonospaceTextClass: 'font-mono text-xs',
        previewOverlayScope: 'viewport',
        previewOverlayPortalTarget: null,
        previewScrollable: true,
        presentationApiRef,
      } as never),
    )

    await tick()

    const rootEl2 = doc.querySelector('[data-testid="markdown-presentation-root"]') as HTMLDivElement | null
    if (!rootEl2) {
      throw new Error('markdown presentation root not found in presentation mode')
    }

    const textContent2 = (rootEl2.textContent || '').replace(/\s+/g, ' ').trim()
    if (!textContent2) {
      throw new Error('expected non-empty content in presentation mode for slide styling reference')
    }

    const api = presentationApiRef.current
    if (!api) {
      throw new Error('presentationApiRef.current is null in presentation mode')
    }

    api.next()
    await tick()

    const textContentAfterNext = (rootEl2.textContent || '').replace(/\s+/g, ' ').trim()
    if (!textContentAfterNext) {
      throw new Error('expected non-empty content after advancing presentation step')
    }

    root2.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}
