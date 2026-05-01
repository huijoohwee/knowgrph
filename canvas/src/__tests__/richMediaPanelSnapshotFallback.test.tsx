import React from 'react'
import { createRoot } from 'react-dom/client'
import RichMediaPanel from '@/components/RichMediaPanel'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export async function testRichMediaPanelRendersSnapshotForNonDirectIframe() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    root.render(
      React.createElement(RichMediaPanel, {
        title: 'Example',
        url: 'https://example.com/embed',
        kind: 'iframe',
        hideUntilReady: true,
        interactive: false,
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

    for (let i = 0; i < 20; i += 1) await tick()

    const iframes = Array.from(container.querySelectorAll('iframe'))
    if (iframes.length > 0) throw new Error('expected non-direct iframe to render snapshot, not iframe')
    const snapshots = Array.from(container.querySelectorAll('[data-kg-webpage-snapshot="1"]'))
    if (snapshots.length < 1) throw new Error('expected snapshot preview element')

    root.unmount()
  } finally {
    restoreDom()
  }
}

export async function testRichMediaPanelClickToOpenUsesBodyNotHeader() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: () => void) => number; open?: (...args: unknown[]) => unknown }
    const opened: string[] = []
    anyWindow.open = (url?: unknown) => {
      opened.push(String(url || ''))
      return null
    }

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const url = 'https://example.com/embed'
    root.render(
      React.createElement(RichMediaPanel, {
        title: 'Example',
        url,
        kind: 'iframe',
        hideUntilReady: true,
        interactive: false,
      }),
    )

    const tick = () =>
      new Promise<void>(resolve => {
        const raf = anyWindow.requestAnimationFrame
        if (raf) {
          raf(() => resolve())
          return
        }
        setTimeout(() => resolve(), 0)
      })

    for (let i = 0; i < 20; i += 1) await tick()

    const header = container.querySelector('[data-kg-media-panel-header="1"]') as HTMLElement | null
    if (!header) throw new Error('expected media panel header')
    header.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
    if (opened.length) throw new Error(`expected header click not to open; opened=${opened.join(',')}`)

    const bodyLink = container.querySelector(`section a[href="${url}"]`) as HTMLAnchorElement | null
    if (!bodyLink) throw new Error('expected body click-to-open overlay link')
    bodyLink.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
    if (opened[0] !== url) throw new Error(`expected body click to open ${url}; opened=${opened.join(',')}`)

    root.unmount()
  } finally {
    restoreDom()
  }
}

export async function testRichMediaPanelImageRendersInlineWithoutBodyClickOverlay() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    root.render(
      React.createElement(RichMediaPanel, {
        title: 'Generated image',
        url: '/__chat_asset_proxy?url=https%3A%2F%2Fexample.com%2Fgenerated.webp',
        openUrl: 'https://example.com/generated.webp',
        kind: 'image',
        hideUntilReady: true,
        interactive: false,
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

    for (let i = 0; i < 20; i += 1) await tick()

    const image = container.querySelector('img') as HTMLImageElement | null
    if (!image) throw new Error('expected image media to render inline inside RichMediaPanel')
    if (image.getAttribute('src') !== '/__chat_asset_proxy?url=https%3A%2F%2Fexample.com%2Fgenerated.webp') {
      throw new Error(`expected inline image to keep proxied playback src, got ${String(image.getAttribute('src') || '')}`)
    }
    const bodyLink = container.querySelector('section a[href="https://example.com/generated.webp"]')
    if (bodyLink) throw new Error('expected inline image rendering to suppress the body click-to-open overlay')

    root.unmount()
  } finally {
    restoreDom()
  }
}

export async function testRichMediaPanelVideoRendersInlineWithoutBodyClickOverlay() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    root.render(
      React.createElement(RichMediaPanel, {
        title: 'Generated video',
        url: '/__chat_asset_proxy?url=https%3A%2F%2Fexample.com%2Fgenerated.mp4',
        openUrl: 'https://example.com/generated.mp4',
        kind: 'video',
        hideUntilReady: true,
        interactive: false,
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

    for (let i = 0; i < 20; i += 1) await tick()

    const video = container.querySelector('video') as HTMLVideoElement | null
    if (!video) throw new Error('expected video media to render inline inside RichMediaPanel')
    if (video.getAttribute('src') !== '/__chat_asset_proxy?url=https%3A%2F%2Fexample.com%2Fgenerated.mp4') {
      throw new Error(`expected inline video to keep proxied playback src, got ${String(video.getAttribute('src') || '')}`)
    }
    const bodyLink = container.querySelector('section a[href="https://example.com/generated.mp4"]')
    if (bodyLink) throw new Error('expected inline video rendering to suppress the body click-to-open overlay')

    root.unmount()
  } finally {
    restoreDom()
  }
}

export async function testRichMediaPanelVideoBecomesVisibleOnLoadedMetadataWhenHideUntilReady() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    root.render(
      React.createElement(RichMediaPanel, {
        title: 'Generated video',
        url: '/__chat_asset_proxy?url=https%3A%2F%2Fexample.com%2Fgenerated.mp4',
        openUrl: 'https://example.com/generated.mp4',
        kind: 'video',
        hideUntilReady: true,
        interactive: false,
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

    for (let i = 0; i < 4; i += 1) await tick()

    const article = container.querySelector('article') as HTMLElement | null
    const video = container.querySelector('video') as HTMLVideoElement | null
    if (!article || !video) throw new Error('expected inline video panel shell to render')
    if (article.style.opacity !== '0') throw new Error(`expected video panel to stay hidden before readiness, got opacity=${article.style.opacity}`)

    video.dispatchEvent(new dom.window.Event('loadedmetadata'))
    for (let i = 0; i < 4; i += 1) await tick()

    const loadedOpacity = String(article.style.getPropertyValue('opacity'))
    if (loadedOpacity !== '1') {
      throw new Error(`expected loadedmetadata to reveal hideUntilReady video panel, got opacity=${loadedOpacity}`)
    }

    root.unmount()
  } finally {
    restoreDom()
  }
}

export async function testRichMediaPanelTextModeUsesMarkdownPreviewSsot() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    root.render(
      React.createElement(RichMediaPanel, {
        title: 'Rich Media Panel',
        url: '',
        kind: 'iframe',
        interactive: false,
        panel: {
          activeTab: 'text',
          freezeConnectedOutput: false,
          hasText: true,
          hasImage: false,
          hasVideo: false,
          hasPoi: false,
          text: '',
          connectedText: '# Hello\n\n![preview](https://example.com/preview.png)\n',
        },
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

    for (let i = 0; i < 20; i += 1) await tick()

    const markdownPreview = container.querySelector('[data-kg-rich-media-markdown-preview="1"]')
    if (!markdownPreview) throw new Error('expected RichMediaPanel text mode to mount the shared markdown preview surface')
    const heading = Array.from(container.querySelectorAll('h1,h2,h3') as NodeListOf<HTMLElement>).find(el => (el.textContent || '').trim() === 'Hello')
    if (!heading) throw new Error('expected markdown heading to render through RichMediaPanel text mode')

    root.unmount()
  } finally {
    restoreDom()
  }
}
