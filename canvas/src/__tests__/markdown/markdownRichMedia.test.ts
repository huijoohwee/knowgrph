
import React from 'react'
import { createRoot } from 'react-dom/client'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'

export async function testMarkdownYouTubeRendering() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    if (!anyWindow.requestAnimationFrame) {
      anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
        setTimeout(() => cb(Date.now()), 0) as unknown as number
    }
    const anyGlobal = globalThis as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    if (!anyGlobal.requestAnimationFrame) {
      anyGlobal.requestAnimationFrame = anyWindow.requestAnimationFrame
    }

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const markdown = [
      '# Media Test',
      '',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      '',
      '<iframe src="https://example.com/embed" title="Example"></iframe>',
    ].join('\n')

    root.render(
      React.createElement(MarkdownPreview, {
        markdownText: markdown,
        activeDocumentPath: 'test.md',
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
      new Promise<void>(resolve =>
        anyWindow.requestAnimationFrame ? anyWindow.requestAnimationFrame(() => resolve()) : setTimeout(() => resolve(), 0),
      )
    await tick()
    await tick()

    const iframes = Array.from(doc.querySelectorAll('iframe'))
    const youtubeIframe = iframes.find(f => (f as HTMLIFrameElement).src.includes('youtube-nocookie.com/embed/dQw4w9WgXcQ'))

    if (!youtubeIframe) {
      throw new Error('Expected YouTube link to be rendered as an embedded iframe')
    }

    const explicitIframe = iframes.find(f => (f as HTMLIFrameElement).src === 'https://example.com/embed')
    if (!explicitIframe) {
      throw new Error('Expected explicit iframe tag to be rendered')
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}
