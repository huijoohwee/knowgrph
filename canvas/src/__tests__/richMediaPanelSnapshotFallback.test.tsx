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
    const heading = Array.from(container.querySelectorAll('h1,h2,h3')).find(el => (el.textContent || '').trim() === 'Hello')
    if (!heading) throw new Error('expected markdown heading to render through RichMediaPanel text mode')

    root.unmount()
  } finally {
    restoreDom()
  }
}
