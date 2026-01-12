import React from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export async function testMarkdownPresentationEnterFullscreenExposedOnApi() {
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
    const anyGlobal = globalThis as unknown as {
      requestAnimationFrame?: (cb: (ts: number) => void) => number
    }
    if (!anyGlobal.requestAnimationFrame) {
      anyGlobal.requestAnimationFrame = anyWindow.requestAnimationFrame
    }

    const doc = dom.window.document

    const markdownLines = [
      '# Slide',
      '',
      'Some content.',
    ]
    const markdownText = markdownLines.join('\n')

    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const presentationApiRef = React.createRef<{
      prev: () => void
      next: () => void
      enterFullscreen?: () => void
    }>()

    root.render(
      React.createElement(MarkdownPreview, {
        markdownText,
        activeDocumentPath: 'docs/fullscreen.md',
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
      new Promise<void>(resolve =>
        anyWindow.requestAnimationFrame
          ? anyWindow.requestAnimationFrame(() => resolve())
          : setTimeout(() => resolve(), 0),
      )
    await tick()

    const api = presentationApiRef.current
    if (!api) {
      throw new Error('presentationApiRef.current is null')
    }
    if (typeof api.enterFullscreen !== 'function') {
      throw new Error('expected enterFullscreen to be a function on presentationApiRef.current')
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}

