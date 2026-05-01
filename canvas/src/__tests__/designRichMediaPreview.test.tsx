import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { DesignRichMediaPreview } from '@/components/DesignRichMedia'

const tick = async (win: Window) => {
  const anyWindow = win as unknown as { requestAnimationFrame?: (cb: () => void) => number }
  await new Promise<void>(resolve => {
    const raf = anyWindow.requestAnimationFrame
    if (raf) {
      raf(() => resolve())
      return
    }
    setTimeout(() => resolve(), 0)
  })
}

export async function testDesignRichMediaPreviewRendersImageVideoAndIframe() {
  const { dom, restore } = initJsdomHarness()
  const prevFetch = (globalThis as unknown as { fetch?: unknown }).fetch
  try {
    ;(globalThis as unknown as { fetch?: unknown }).fetch = (async (input: unknown) => {
      const url = String(input || '')
      if (url.startsWith('/__webpage_proxy?')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          text: async () => '<!doctype html><html><head><title>OK</title></head><body><h1>Embed</h1></body></html>',
        } as unknown as Response
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => '',
      } as unknown as Response
    }) as unknown

    const doc = dom.window.document
    const container = doc.createElement('div')
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    await act(async () => {
      root.render(
        React.createElement(
          'svg',
          { width: 600, height: 240 },
          React.createElement(DesignRichMediaPreview, {
            tag: 'IMG',
            url: 'https://example.com/image.png',
            titleChip: 'Image',
            clipId: 'clip-img',
            innerX: 10,
            innerY: 10,
            innerW: 180,
            innerH: 120,
            interactive: false,
          }),
          React.createElement(DesignRichMediaPreview, {
            tag: 'VIDEO',
            url: 'https://example.com/video.mp4',
            titleChip: 'Video',
            clipId: 'clip-vid',
            innerX: 210,
            innerY: 10,
            innerW: 180,
            innerH: 120,
            interactive: false,
          }),
          React.createElement(DesignRichMediaPreview, {
            tag: 'IFRAME',
            url: 'https://www.citriniresearch.com/p/2028gic',
            titleChip: 'IFrame',
            clipId: 'clip-ifr',
            innerX: 410,
            innerY: 10,
            innerW: 85,
            innerH: 120,
            interactive: false,
          }),
          React.createElement(DesignRichMediaPreview, {
            tag: 'IFRAME',
            url: 'https://www.ycombinator.com/library/8d-how-to-build-a-great-series-a-pitch-and-deck',
            titleChip: 'IFrame',
            clipId: 'clip-ifr-2',
            innerX: 505,
            innerY: 10,
            innerW: 85,
            innerH: 120,
            interactive: false,
          }),
        ),
      )
      for (let i = 0; i < 6; i += 1) await tick(dom.window as unknown as Window)
    })

    const image = doc.querySelector('img') as HTMLImageElement | null
    if (!image) throw new Error('expected shared RichMediaPanel image element')
    if (!String(image.getAttribute('src') || '').includes('/__fetch_remote?url=')) {
      throw new Error('expected image src to use media proxy on localhost')
    }

    const video = doc.querySelector('video') as HTMLVideoElement | null
    if (!video) throw new Error('expected video element')
    if (!String(video.getAttribute('src') || '').includes('/__fetch_remote?url=')) {
      throw new Error('expected video src to use media proxy on localhost')
    }

    const iframes = Array.from(doc.querySelectorAll('iframe')) as HTMLIFrameElement[]
    if (iframes.length < 2) throw new Error('expected iframes to render')
    for (const iframe of iframes) {
      const srcdoc = iframe.getAttribute('srcdoc') || ''
      if (!srcdoc.trim()) throw new Error('expected iframe srcdoc to be populated')
    }

    await act(async () => {
      root.unmount()
    })
  } finally {
    ;(globalThis as unknown as { fetch?: unknown }).fetch = prevFetch
    restore()
  }
}
