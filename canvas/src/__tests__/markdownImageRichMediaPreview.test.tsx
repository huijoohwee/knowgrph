import React from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export async function testMarkdownPreviewRendersMarkdownImageAndVideoAudioIframe() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  const originalFetch = (globalThis as unknown as { fetch?: unknown }).fetch
  try {
    ;(globalThis as unknown as { fetch: unknown }).fetch = async (input: unknown) => {
      const url = typeof input === 'string' ? input : (input && typeof (input as { url?: unknown }).url === 'string' ? (input as { url: string }).url : '')
      if (typeof url === 'string' && url.includes('/__fetch_remote?url=')) {
        const html = '<!doctype html><html><head><title>Example</title></head><body><h1>Hello</h1></body></html>'
        return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
      }
      if (typeof url === 'string' && url.includes('/__webpage_proxy?url=')) {
        const html = '<!doctype html><html><head><title>Example</title></head><body><h1>Hello</h1></body></html>'
        return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
      }
      if (typeof originalFetch === 'function') return await (originalFetch as (i: unknown) => Promise<Response>)(input)
      throw new Error('fetch not available')
    }
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const markdownText = [
      'PNG:',
      '',
      '![](https://example.com/a.png)',
      '',
      'JPG:',
      '',
      '![](https://example.com/a.jpg)',
      '',
      'Proxied JPEG:',
      '',
      '![](/__fetch_remote?url=https%3A%2F%2Fexample.com%2Fb.jpeg)',
      '',
      'Autolink PNG:',
      '',
      '<https://substackcdn.com/image/fetch/$s_!kA4x!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F0bc01ebb-a883-4e5c-bd2b-fa7aaa872edb_1600x1059.png>',
      '',
      'WeChat img (no extension):',
      '',
      '![](https://mmbiz.qpic.cn/mmbiz_png/test/640?wx_fmt=jpeg)',
      '',
      'Video:',
      '',
      '![](https://example.com/demo.mp4)',
      '',
      'Audio:',
      '',
      '![](https://example.com/demo.mp3)',
      '',
      'IFrame:',
      '',
      '![iframe](https://example.com/)',
      '',
      'Webpage URL:',
      '',
      '![](https://www.ycombinator.com/library/8d-how-to-build-a-great-series-a-pitch-and-deck)',
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

    for (let i = 0; i < 16; i += 1) await tick()

    const img = container.querySelector('img') as HTMLImageElement | null
    if (!img) throw new Error(`expected markdown image png to render; html=${container.innerHTML}`)
    const imgSrc = String(img.getAttribute('src') || '')
    if (!/a\.png/i.test(decodeURIComponent(imgSrc))) throw new Error(`expected png img src, got: ${imgSrc}`)

    const imgEls = Array.from(container.querySelectorAll('img')) as HTMLImageElement[]
    const imgSrcs = imgEls.map(el => String(el.getAttribute('src') || ''))
    const hasJpg = imgSrcs.some(s => /a\.jpg/i.test(decodeURIComponent(s)))
    if (!hasJpg) {
      throw new Error(`expected jpg markdown image to render as img, got: ${imgSrcs.join(', ')}`)
    }
    const hasProxiedJpeg = imgSrcs.some(s => {
      const raw = String(s || '')
      if (!raw.includes('/__fetch_remote?url=')) return false
      try {
        return decodeURIComponent(raw).includes('example.com/b.jpeg')
      } catch {
        return raw.includes('b.jpeg')
      }
    })
    if (!hasProxiedJpeg) {
      throw new Error(`expected proxied jpeg markdown image to render as img, got: ${imgSrcs.join(', ')}`)
    }
    const hasSubstack = imgSrcs.some(s => {
      const raw = String(s || '')
      if (raw.includes('substackcdn.com/image/fetch')) return true
      if (raw.includes('substackcdn.com%2Fimage%2Ffetch')) return true
      try {
        return decodeURIComponent(raw).includes('substackcdn.com/image/fetch')
      } catch {
        return false
      }
    })
    if (!hasSubstack) {
      throw new Error(`expected autolink image url to render as img, got: ${imgSrcs.join(', ')}`)
    }

    const hasWeChat = imgSrcs.some(s => {
      const raw = String(s || '')
      try {
        return decodeURIComponent(raw).includes('mmbiz.qpic.cn/mmbiz_png/test/640?wx_fmt=jpeg')
      } catch {
        return raw.includes('mmbiz.qpic.cn')
      }
    })
    if (!hasWeChat) {
      throw new Error(`expected wechat image url to render as img, got: ${imgSrcs.join(', ')}`)
    }

    const video = container.querySelector('video') as HTMLVideoElement | null
    if (!video) throw new Error('expected markdown image with mp4 to render as video')
    const videoSrc = String(video.getAttribute('src') || '')
    if (!/demo\.mp4/i.test(decodeURIComponent(videoSrc))) throw new Error(`expected mp4 video src, got: ${videoSrc}`)

    const audio = container.querySelector('audio') as HTMLAudioElement | null
    if (!audio) throw new Error('expected markdown image with mp3 to render as audio')
    const audioSrc = String(audio.getAttribute('src') || '')
    if (!/demo\.mp3/i.test(decodeURIComponent(audioSrc))) throw new Error(`expected mp3 audio src, got: ${audioSrc}`)

    const iframes = Array.from(container.querySelectorAll('iframe')) as HTMLIFrameElement[]
    const nonSrcDocIframes = iframes.filter(el => !!el.getAttribute('src'))
    if (nonSrcDocIframes.length > 0) {
      throw new Error(
        `expected non-direct iframe embeds to render as snapshot previews; iframe srcs=${nonSrcDocIframes
          .map(el => String(el.getAttribute('src') || ''))
          .join(', ')}`,
      )
    }

    const snapshots = Array.from(container.querySelectorAll('[data-kg-webpage-snapshot="1"]'))
    const hasExampleSnapshot = snapshots.some(el => String(el.getAttribute('data-src') || '').includes('https://example.com/'))
    if (!hasExampleSnapshot) throw new Error(`expected iframe-marked url to render as snapshot preview; html=${container.innerHTML}`)
    const hasYcSnapshot = snapshots.some(el =>
      String(el.getAttribute('data-src') || '').includes('https://www.ycombinator.com/library/8d-how-to-build-a-great-series-a-pitch-and-deck'),
    )
    if (!hasYcSnapshot) throw new Error(`expected webpage url to render as snapshot preview; html=${container.innerHTML}`)

    root.unmount()
  } finally {
    ;(globalThis as unknown as { fetch?: unknown }).fetch = originalFetch
    restoreDom()
  }
}
