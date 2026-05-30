import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import RichMediaPanel from '@/components/RichMediaPanel'
import { useGraphStore } from '@/hooks/useGraphStore'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { mountReactRoot, unmountReactRoot, waitForFrames, waitForNextFrame } from '@/tests/lib/reactRootHarness'

const waitForBodyLink = async (container: HTMLElement, win: Window, url: string, maxFrames = 12) => {
  for (let i = 0; i < maxFrames; i += 1) {
    const link = Array.from(container.querySelectorAll('section a')).find(anchor =>
      String((anchor as HTMLAnchorElement).getAttribute('href') || '') === url,
    ) as HTMLAnchorElement | undefined
    if (link) return link
    await waitForNextFrame(win)
  }
  return null
}

const resetRichMediaPanelTestStoreState = () => {
  const state = useGraphStore.getState()
  try {
    state.setWorkspaceViewMode('canvas')
  } catch {
    void 0
  }
  try {
    state.setWorkspaceCanvasPaneOpen(false)
  } catch {
    void 0
  }
  try {
    state.setRichMediaPanelMode('snapshot')
  } catch {
    void 0
  }
  try {
    state.setInfiniteCanvasInteractionMode('static')
  } catch {
    void 0
  }
}

export async function testRichMediaPanelRendersSnapshotForNonDirectIframe() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    resetRichMediaPanelTestStoreState()
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    await mountReactRoot(root,
      React.createElement(RichMediaPanel, {
        title: 'Example',
        url: 'https://example.com/embed',
        kind: 'iframe',
        hideUntilReady: true,
        interactive: false,
      }),
    { window: dom.window, frames: 20 })

    const iframes = Array.from(container.querySelectorAll('iframe'))
    if (iframes.length > 0) throw new Error('expected non-direct iframe to render snapshot, not iframe')
    const snapshots = Array.from(container.querySelectorAll('[data-kg-webpage-snapshot="1"]'))
    if (snapshots.length < 1) throw new Error('expected snapshot preview element')

    await unmountReactRoot(root, { window: dom.window })
  } finally {
    restoreDom()
  }
}

export async function testRichMediaPanelClickToOpenUsesBodyNotHeader() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    resetRichMediaPanelTestStoreState()
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
    await mountReactRoot(root,
      React.createElement(RichMediaPanel, {
        title: 'Example',
        url,
        kind: 'iframe',
        hideUntilReady: true,
        interactive: false,
      }),
    { window: dom.window, frames: 20 })

    const bodyLink = await waitForBodyLink(container, dom.window, url)
    if (!bodyLink) throw new Error('expected body click-to-open overlay link')
    await act(async () => {
      bodyLink.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await waitForNextFrame(dom.window)
    })
    if (opened[0] !== url) throw new Error(`expected body click to open ${url}; opened=${opened.join(',')}`)

    await unmountReactRoot(root, { window: dom.window })
  } finally {
    restoreDom()
  }
}

export async function testRichMediaPanelImageRendersInlineWithoutBodyClickOverlay() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    resetRichMediaPanelTestStoreState()
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    await mountReactRoot(root,
      React.createElement(RichMediaPanel, {
        title: 'Generated image',
        url: '/__chat_asset_proxy?url=https%3A%2F%2Fexample.com%2Fgenerated.webp',
        openUrl: 'https://example.com/generated.webp',
        kind: 'image',
        hideUntilReady: true,
        interactive: false,
      }),
    { window: dom.window, frames: 20 })

    const image = container.querySelector('img') as HTMLImageElement | null
    if (!image) throw new Error('expected image media to render inline inside RichMediaPanel')
    if (image.getAttribute('src') !== '/__chat_asset_proxy?url=https%3A%2F%2Fexample.com%2Fgenerated.webp') {
      throw new Error(`expected inline image to keep proxied playback src, got ${String(image.getAttribute('src') || '')}`)
    }
    const bodyLink = container.querySelector('section a[href="https://example.com/generated.webp"]')
    if (bodyLink) throw new Error('expected inline image rendering to suppress the body click-to-open overlay')

    await unmountReactRoot(root, { window: dom.window })
  } finally {
    restoreDom()
  }
}

export async function testRichMediaPanelVideoRendersInlineWithoutBodyClickOverlay() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    resetRichMediaPanelTestStoreState()
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    await mountReactRoot(root,
      React.createElement(RichMediaPanel, {
        title: 'Generated video',
        url: '/__chat_asset_proxy?url=https%3A%2F%2Fexample.com%2Fgenerated.mp4',
        openUrl: 'https://example.com/generated.mp4',
        kind: 'video',
        hideUntilReady: true,
        interactive: false,
      }),
    { window: dom.window, frames: 20 })

    const video = container.querySelector('video') as HTMLVideoElement | null
    if (!video) throw new Error('expected video media to render inline inside RichMediaPanel')
    if (video.getAttribute('src') !== '/__chat_asset_proxy?url=https%3A%2F%2Fexample.com%2Fgenerated.mp4') {
      throw new Error(`expected inline video to keep proxied playback src, got ${String(video.getAttribute('src') || '')}`)
    }
    const bodyLink = container.querySelector('section a[href="https://example.com/generated.mp4"]')
    if (bodyLink) throw new Error('expected inline video rendering to suppress the body click-to-open overlay')

    await unmountReactRoot(root, { window: dom.window })
  } finally {
    restoreDom()
  }
}

export async function testRichMediaPanelDirectIframeAndVideoKeepPlayableSurfaceWithForwarding() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    resetRichMediaPanelTestStoreState()
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)
    const forwardWheelTo = () => doc.body

    await mountReactRoot(root,
      React.createElement(RichMediaPanel, {
        title: 'Playable video',
        url: 'https://example.com/generated.mp4',
        kind: 'video',
        interactive: true,
        forwardWheelTo,
      }),
    { window: dom.window, frames: 10 })

    const video = container.querySelector('video') as HTMLVideoElement | null
    if (!video) throw new Error('expected shared card media video surface')
    if (!video.hasAttribute('controls')) throw new Error('expected video card media to expose playback controls')
    if (video.getAttribute('data-kg-card-media-interactive') !== '1') {
      throw new Error('expected playable video to mark the shared card media surface as interactive')
    }
    if (video.style.pointerEvents === 'none') {
      throw new Error('expected playable video pointer events to remain enabled even when canvas wheel forwarding exists')
    }

    await act(async () => {
      root.render(
        React.createElement(RichMediaPanel, {
          title: 'Playable YouTube',
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s',
          kind: 'iframe',
          interactive: true,
          forwardWheelTo,
        }),
      )
      await waitForFrames(dom.window, 10)
    })

    const iframe = container.querySelector('iframe[data-kg-card-media-iframe="1"]') as HTMLIFrameElement | null
    if (!iframe) throw new Error('expected direct YouTube/embed iframe to reuse the shared card media iframe surface')
    if (!String(iframe.getAttribute('src') || '').includes('youtube-nocookie.com/embed/')) {
      throw new Error(`expected YouTube link to resolve into a direct playable embed, got ${String(iframe.getAttribute('src') || '')}`)
    }
    if (iframe.getAttribute('data-kg-card-media-interactive') !== '1') {
      throw new Error('expected direct iframe embed to mark the shared card media surface as interactive')
    }
    if (iframe.style.pointerEvents === 'none') {
      throw new Error('expected direct iframe pointer events to remain enabled so click-to-play works')
    }

    await unmountReactRoot(root, { window: dom.window })
  } finally {
    restoreDom()
  }
}

export function testRichMediaPanelAndStoryboardReuseSharedCardMediaSurface() {
  const root = process.cwd()
  const sharedCardMediaText = readFileSync(resolve(root, 'src', 'lib', 'cards', 'CardMediaPreview.tsx'), 'utf8')
  const sharedCardMediaUtilsText = readFileSync(resolve(root, 'src', 'lib', 'cards', 'cardMediaPreviewUtils.ts'), 'utf8')
  const richMediaPanelText = readFileSync(resolve(root, 'src', 'components', 'RichMediaPanel.tsx'), 'utf8')
  const storyboardCanvasText = readFileSync(resolve(root, 'src', 'components', 'StoryboardCanvas.tsx'), 'utf8')
  const kanbanMenuText = readFileSync(resolve(root, 'src', 'features', 'markdown', 'ui', 'kanban', 'kanbanMenu.ts'), 'utf8')

  for (const snippet of ['export function CardMediaPreview', 'export function CardMediaEmptyPlaceholder', 'export function CardMediaLoadingSkeleton']) {
    if (!sharedCardMediaText.includes(snippet)) throw new Error(`expected shared card media owner to expose ${snippet}`)
  }
  if (!sharedCardMediaUtilsText.includes('export function isDirectPlayableCardMedia')) {
    throw new Error('expected shared card media utility owner to expose direct playable media detection')
  }
  if (!richMediaPanelText.includes("from '@/lib/cards/CardMediaPreview'")) {
    throw new Error('expected RichMediaPanel to reuse the shared card media surface')
  }
  if (!richMediaPanelText.includes("from '@/lib/cards/cardMediaPreviewUtils'")) {
    throw new Error('expected RichMediaPanel to reuse the shared card media utility owner')
  }
  if (!storyboardCanvasText.includes("import { CardMediaPreview } from '@/lib/cards/CardMediaPreview'")) {
    throw new Error('expected Storyboard cards to reuse the shared card media surface')
  }
  if (richMediaPanelText.includes('function RichMediaEmptyCardPlaceholder') || richMediaPanelText.includes('function RichMediaLoadingSkeleton')) {
    throw new Error('expected RichMediaPanel to stop owning duplicate local card placeholder renderers')
  }
  if (storyboardCanvasText.includes("import { resolveIframeEmbed } from 'grph-shared/rich-media/iframe'")) {
    throw new Error('expected Storyboard iframe media rendering to route through shared card media')
  }
  if (!kanbanMenuText.includes('[data-kg-card-media-interactive="1"]')) {
    throw new Error('expected shared card media to be recognized as an interactive kanban card target')
  }
}

export async function testRichMediaPanelVideoBecomesVisibleOnLoadedMetadataWhenHideUntilReady() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    resetRichMediaPanelTestStoreState()
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    await mountReactRoot(root,
      React.createElement(RichMediaPanel, {
        title: 'Generated video',
        url: '/__chat_asset_proxy?url=https%3A%2F%2Fexample.com%2Fgenerated.mp4',
        openUrl: 'https://example.com/generated.mp4',
        kind: 'video',
        hideUntilReady: true,
        interactive: false,
      }),
    { window: dom.window, frames: 4 })

    const article = container.querySelector('[data-kg-rich-media-panel="1"]') as HTMLElement | null
    const video = container.querySelector('video') as HTMLVideoElement | null
    if (!article || !video) throw new Error('expected inline video panel shell to render')
    if (article.style.opacity !== '0') throw new Error(`expected video panel to stay hidden before readiness, got opacity=${article.style.opacity}`)

    await act(async () => {
      video.dispatchEvent(new dom.window.Event('loadedmetadata'))
      await waitForFrames(dom.window, 4)
    })

    const loadedOpacity = String(article.style.getPropertyValue('opacity'))
    if (loadedOpacity !== '1') {
      throw new Error(`expected loadedmetadata to reveal hideUntilReady video panel, got opacity=${loadedOpacity}`)
    }

    await unmountReactRoot(root, { window: dom.window })
  } finally {
    restoreDom()
  }
}

export async function testRichMediaPanelEmptyImageRendersPlaceholderInsteadOfBlankMedia() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    resetRichMediaPanelTestStoreState()
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    await mountReactRoot(root,
      React.createElement(RichMediaPanel, {
        title: 'Pending image',
        url: '',
        kind: 'image',
        interactive: false,
      }),
    { window: dom.window, frames: 20 })

    const placeholder = container.querySelector('[data-kg-rich-media-empty-card-placeholder="1"]') as HTMLElement | null
    if (!placeholder) throw new Error('expected empty image panel to render the shared empty-state placeholder')
    if (placeholder.getAttribute('data-kg-rich-media-empty-card-static') !== '1') {
      throw new Error('expected empty image placeholder to render as a static indicator instead of a loading shimmer')
    }
    if (!/Waiting for image content/i.test(placeholder.textContent || '')) {
      throw new Error(`expected image placeholder copy, got ${String(placeholder.textContent || '')}`)
    }
    if (container.querySelector('img')) throw new Error('expected empty image panel to avoid mounting a blank img tag')

    await unmountReactRoot(root, { window: dom.window })
  } finally {
    restoreDom()
  }
}

export async function testRichMediaPanelEmptyVideoRendersPlaceholderInsteadOfBlankMedia() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    resetRichMediaPanelTestStoreState()
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    await mountReactRoot(root,
      React.createElement(RichMediaPanel, {
        title: 'Pending video',
        url: '',
        kind: 'video',
        interactive: false,
      }),
    { window: dom.window, frames: 20 })

    const placeholder = container.querySelector('[data-kg-rich-media-empty-card-placeholder="1"]') as HTMLElement | null
    if (!placeholder) throw new Error('expected empty video panel to render the shared empty-state placeholder')
    if (placeholder.getAttribute('data-kg-rich-media-empty-card-static') !== '1') {
      throw new Error('expected empty video placeholder to render as a static indicator instead of a loading shimmer')
    }
    if (!/Waiting for video content/i.test(placeholder.textContent || '')) {
      throw new Error(`expected video placeholder copy, got ${String(placeholder.textContent || '')}`)
    }
    if (container.querySelector('video')) throw new Error('expected empty video panel to avoid mounting a blank video tag')

    await unmountReactRoot(root, { window: dom.window })
  } finally {
    restoreDom()
  }
}

export async function testRichMediaPanelTextModeUsesMarkdownPreviewSsot() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    resetRichMediaPanelTestStoreState()
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    await mountReactRoot(root,
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
    { window: dom.window, frames: 20 })

    const markdownPreview = container.querySelector('[data-kg-rich-media-markdown-preview="1"]')
    if (!markdownPreview) throw new Error('expected RichMediaPanel text mode to mount the shared markdown preview surface')
    const heading = Array.from(container.querySelectorAll('h1,h2,h3') as NodeListOf<HTMLElement>).find(el => (el.textContent || '').trim() === 'Hello')
    if (!heading) throw new Error('expected markdown heading to render through RichMediaPanel text mode')

    await unmountReactRoot(root, { window: dom.window })
  } finally {
    restoreDom()
  }
}
