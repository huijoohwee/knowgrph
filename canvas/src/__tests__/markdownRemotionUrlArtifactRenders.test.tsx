import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export async function testMarkdownPreviewRendersRemotionUrlArtifact() {
  const p = path.resolve(process.cwd(), 'sandbox', 'tmp-remotion.md')
  const markdownText = fs.readFileSync(p, 'utf8')
  if (!markdownText || !markdownText.trim()) throw new Error('expected tmp-remotion.md to be non-empty')
  if (/<!--/.test(markdownText)) throw new Error('expected tmp-remotion.md to not include HTML comment markers')

  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    root.render(
      React.createElement(MarkdownPreview, {
        markdownText,
        activeDocumentPath: '/sandbox/tmp-remotion.md',
        highlightedLineRange: null,
        markdownWordWrap: true,
        markdownPresentationMode: false,
        markdownTextHighlight: false,
        uiPanelTextFontClass: 'font-sans',
        uiPanelMonospaceTextClass: 'font-mono',
        previewOverlayScope: 'container',
        previewOverlayPortalTarget: null,
        previewScrollable: true,
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

    for (let i = 0; i < 8; i += 1) await tick()

    const h1 = container.querySelector('h1')
    if (!h1 || !String(h1.textContent || '').toLowerCase().includes('make videos')) {
      throw new Error('expected Remotion page heading to render')
    }

    const pricing = (Array.from(container.querySelectorAll('h2')) as unknown as HTMLElement[]).find(h =>
      String((h as HTMLElement).textContent || '').trim().toLowerCase() === 'pricing',
    )
    if (!pricing) throw new Error('expected Pricing section heading to render')

    const imgs = container.querySelectorAll('img')
    if (imgs.length < 1) throw new Error('expected at least one image to render')

    const videos = container.querySelectorAll('video')
    const webmLink = (Array.from(container.querySelectorAll('a')) as unknown as HTMLElement[]).some(a =>
      /\.webm(\b|$)/i.test(String((a as HTMLElement).getAttribute('href') || '')),
    )
    if (videos.length < 1 && !webmLink) throw new Error('expected at least one video (or a .webm link) to render')

    const heroVideo = (Array.from(videos) as unknown as HTMLVideoElement[]).find(v =>
      /compose\.webm(\b|$)/i.test(String((v as HTMLVideoElement).getAttribute('src') || '')),
    )
    if (heroVideo) {
      const styleAttr = String((heroVideo as HTMLVideoElement).getAttribute('style') || '')
      if (!/width\s*:\s*500px/i.test(styleAttr)) {
        throw new Error('expected Remotion hero video to preserve width from class-derived layout')
      }
    }

    root.unmount()
  } finally {
    restoreDom()
  }
}
