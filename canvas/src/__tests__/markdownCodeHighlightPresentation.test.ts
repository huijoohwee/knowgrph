import React from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'

export async function testMarkdownCodeHighlightPresentationSteps() {
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
      'src',
      '__tests__',
      'demo',
      'markdown-slide-demo.md',
    )
    const markdownText = readFileSync(mdPath, 'utf8')

    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const presentationApiRef = React.createRef<{ prev: () => void; next: () => void }>()

    root.render(
      React.createElement(MarkdownPreview, {
        markdownText,
        activeDocumentPath: 'docs/demo/markdown-slide-demo.md',
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

    const tick = () =>
      new Promise<void>(resolvePromise =>
        anyWindow.requestAnimationFrame
          ? anyWindow.requestAnimationFrame(() => resolvePromise())
          : setTimeout(() => resolvePromise(), 0),
      )
    await tick()

    const rootEl = doc.querySelector('[data-testid="markdown-presentation-root"]') as HTMLDivElement | null
    if (!rootEl) {
      throw new Error('markdown presentation root not found in presentation mode for code highlight test')
    }

    const textAtInitial = (rootEl.textContent || '').replace(/\s+/g, ' ').trim()
    if (!textAtInitial.includes('Code Line Highlighting and Steps')) {
      throw new Error('expected code line highlighting slide title to be present at some step')
    }

    const api = presentationApiRef.current
    if (!api) {
      throw new Error('presentationApiRef.current is null for code highlight test')
    }

    api.next()
    await tick()

    const textAfterNext = (rootEl.textContent || '').replace(/\s+/g, ' ').trim()
    if (!textAfterNext) {
      throw new Error('expected non-empty content after advancing code highlight presentation step')
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}
