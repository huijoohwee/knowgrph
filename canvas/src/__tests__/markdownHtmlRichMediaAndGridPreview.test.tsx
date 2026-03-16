import React from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { useGraphStore } from '@/hooks/useGraphStore'

export async function testMarkdownPreviewRendersHtmlVideoAutoplayAndGridSpans() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  const state = useGraphStore.getState()
  const prevMode = state.richMediaPanelMode
  try {
    state.setRichMediaPanelMode('embed')

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const markdownText = [
      '<article class="grid grid-cols-3 gap-4">',
      '  <div class="col-span-2">Left</div>',
      '  <div>Right</div>',
      '  <div class="col-span-full">Bottom</div>',
      '</article>',
      '',
      '<video autoplay muted loop playsinline poster="poster.png" class="w-[500px]">',
      '  <source src="clip.webm" type="video/webm" />',
      '</video>',
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

    for (let i = 0; i < 12; i += 1) await tick()

    const gridEl =
      (Array.from(container.querySelectorAll('article, section')) as unknown as HTMLElement[]).find(el => {
        const t = String((el as HTMLElement).textContent || '')
        if (!t.includes('Left') || !t.includes('Right') || !t.includes('Bottom')) return false
        const cls = String((el as HTMLElement).getAttribute('class') || '')
        if (cls.includes('grid-cols-3')) return true
        const style = String((el as HTMLElement).getAttribute('style') || '')
        return /grid-template-columns/i.test(style)
      }) as HTMLElement | undefined
    if (!gridEl) throw new Error('expected grid container to be rendered')
    const articleStyle = String(gridEl.getAttribute('style') || '')
    if (!/display:\s*grid/i.test(articleStyle)) throw new Error(`expected grid display, got: ${articleStyle}`)
    if (!/grid-template-columns:\s*repeat\(3/i.test(articleStyle)) {
      throw new Error(`expected grid-cols-3 to derive grid-template-columns, got: ${articleStyle}`)
    }

    const spans = (Array.from(container.querySelectorAll('section')) as unknown as HTMLElement[]).filter(el =>
      String((el as HTMLElement).textContent || '').trim() === 'Left' || String((el as HTMLElement).textContent || '').trim() === 'Bottom',
    ) as HTMLElement[]
    const left = spans.find(el => String(el.textContent || '').trim() === 'Left') || null
    const bottom = spans.find(el => String(el.textContent || '').trim() === 'Bottom') || null
    if (!left) throw new Error('expected Left cell to render')
    if (!bottom) throw new Error('expected Bottom cell to render')
    const leftStyle = String(left.getAttribute('style') || '')
    const bottomStyle = String(bottom.getAttribute('style') || '')
    if (!/grid-column:/i.test(leftStyle)) throw new Error(`expected col-span-2 to map to grid-column, got: ${leftStyle}`)
    if (!/grid-column:\s*1\s*\/\s*-1/i.test(bottomStyle)) {
      throw new Error(`expected col-span-full to map to grid-column: 1 / -1, got: ${bottomStyle}`)
    }

    const video = container.querySelector('video') as HTMLVideoElement | null
    if (!video) throw new Error('expected HTML video to render')
    const hasAutoplay = video.hasAttribute('autoplay') || (video as unknown as { autoplay?: boolean }).autoplay === true
    const hasLoop = video.hasAttribute('loop') || (video as unknown as { loop?: boolean }).loop === true
    const hasMuted = video.hasAttribute('muted') || (video as unknown as { muted?: boolean }).muted === true
    if (!hasAutoplay) throw new Error('expected autoplay to be enabled')
    if (!hasLoop) throw new Error('expected looping video')
    if (!hasMuted) throw new Error('expected muted video')
    if (video.controls) throw new Error('expected controls to be disabled for autoplay/loop video')
    const poster = String(video.getAttribute('poster') || '')
    if (!poster) throw new Error('expected poster attribute to be preserved')

    root.unmount()

  } finally {
    state.setRichMediaPanelMode(prevMode)
    restoreDom()
  }
}
