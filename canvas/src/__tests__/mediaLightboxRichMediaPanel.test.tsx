import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MediaLightbox } from '@/lib/ui/MediaLightbox'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'

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

async function assertMediaLightboxUsesRichMediaPanel(args: {
  kind: 'image' | 'video'
  src: string
  title: string
  description: string
}) {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    const doc = dom.window.document
    const container = doc.createElement('section')
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)

    await act(async () => {
      root.render(
        React.createElement(MediaLightbox, {
          open: true,
          src: args.src,
          alt: args.title,
          kind: args.kind,
          title: args.title,
          description: args.description,
          onClose: () => undefined,
        }),
      )
      for (let i = 0; i < 6; i += 1) await tick(dom.window as unknown as Window)
    })

    const lightbox = doc.querySelector('[data-kg-media-lightbox="1"]')
    if (!(lightbox instanceof dom.window.HTMLElement)) {
      throw new Error('expected media lightbox root to render')
    }
    const panelSelector = `[data-kg-media-lightbox-${args.kind}="1"]`
    const mediaPanel = doc.querySelector(panelSelector)
    if (!(mediaPanel instanceof dom.window.HTMLElement)) {
      throw new Error(`expected ${args.kind} lightbox panel marker to render`)
    }
    const richMediaPanel = mediaPanel.querySelector('[data-kg-rich-media-panel="1"]')
    if (!(richMediaPanel instanceof dom.window.HTMLElement)) {
      throw new Error(`expected ${args.kind} lightbox to reuse RichMediaPanel`)
    }
    if (richMediaPanel.getAttribute('data-kg-kind') !== args.kind) {
      throw new Error(`expected lightbox RichMediaPanel kind=${args.kind}, got ${String(richMediaPanel.getAttribute('data-kg-kind') || '')}`)
    }
    const storyboardWidgetHeader = mediaPanel.querySelector('[data-kg-rich-media-storyboard-widget-header="1"]')
    if (!(storyboardWidgetHeader instanceof dom.window.HTMLElement)) {
      throw new Error(`expected ${args.kind} lightbox RichMediaPanel to preserve shared panel chrome`)
    }
  } finally {
    try {
      if (root) {
        await act(async () => {
          root.unmount()
        })
      }
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}

export async function testMediaLightboxImageUsesRichMediaPanelSurface() {
  await assertMediaLightboxUsesRichMediaPanel({
    kind: 'image',
    src: 'https://example.com/runtime-demo.png',
    title: 'Runtime still',
    description: 'Shared image preview',
  })
}

export async function testMediaLightboxVideoUsesRichMediaPanelSurface() {
  await assertMediaLightboxUsesRichMediaPanel({
    kind: 'video',
    src: 'https://example.com/runtime-demo.mp4',
    title: 'Runtime demo',
    description: 'Shared preview',
  })
}
