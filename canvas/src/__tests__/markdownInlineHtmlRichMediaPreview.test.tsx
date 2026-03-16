import React from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { useGraphStore } from '@/hooks/useGraphStore'

export async function testMarkdownPreviewRendersInlineHtmlRichMedia() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const markdownText = [
      'Before <img src="https://example.com/a.webp" alt="WebP" /> After',
      '',
      'Before <iframe src="https://example.com/"></iframe> After',
      '',
      '<blockquote class="reddit-embed-bq" data-embed-height="969">',
      '<a href=" `https://www.reddit.com/r/Trae_ai/comments/1ovcca2/comment/nojw5gz/` ">Comment</a><br> by',
      '<a href="https://www.reddit.com/user/Trae_AI/">u/Trae_AI</a> from discussion',
      '<a href="https://www.reddit.com/r/Trae_ai/comments/1ovcca2/join_the_parade_win_show_us_your_trae_solo/"></a><br> in',
      '<a href="https://www.reddit.com/r/Trae_ai/">Trae_ai</a>',
      '</blockquote><script async="" src=" `https://embed.reddit.com/widgets.js` " charset="UTF-8"></script>',
      '',
    ].join('\n')

    useGraphStore.getState().setRichMediaPanelMode('snapshot')

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

    for (let i = 0; i < 12; i += 1) await tick()

    const img = container.querySelector('img[alt="WebP"]') as HTMLImageElement | null
    if (!img) throw new Error('expected inline HTML img to render')
    const src = String(img.getAttribute('src') || '')
    if (!src) throw new Error('expected inline HTML img src to be set')
    if (!/a\.webp/i.test(decodeURIComponent(src))) throw new Error(`expected inline HTML img to reference .webp, got: ${src}`)

    const snapshot = container.querySelector('[data-kg-webpage-snapshot="1"][data-src*="example.com"]') as HTMLElement | null
    if (!snapshot) throw new Error(`expected inline HTML iframe to render as snapshot by default; html=${container.innerHTML}`)

    const iframe0 = container.querySelector('iframe') as HTMLIFrameElement | null
    if (iframe0) throw new Error(`expected no iframe in snapshot mode; html=${container.innerHTML}`)

    const redditSnap = container.querySelector('[data-kg-webpage-snapshot="1"][data-src*="reddit.com"]') as HTMLElement | null
    if (!redditSnap) throw new Error(`expected reddit embed to render as a snapshot preview card; html=${container.innerHTML}`)
    const thumb = redditSnap.querySelector('[data-kg-media-thumbnail="1"]') as HTMLElement | null
    if (!thumb) throw new Error('expected reddit snapshot to include thumbnail-click surface')

    useGraphStore.getState().setRichMediaPanelMode('embed')
    for (let i = 0; i < 10; i += 1) await tick()
    const iframe1 = container.querySelector('iframe') as HTMLIFrameElement | null
    if (!iframe1) throw new Error(`expected inline HTML iframe to render in embed mode; html=${container.innerHTML}`)

    root.unmount()
  } finally {
    restoreDom()
  }
}
