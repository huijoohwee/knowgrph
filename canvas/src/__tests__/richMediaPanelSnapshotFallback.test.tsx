import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import RichMediaPanel from '@/components/RichMediaPanel'
import { useGraphStore } from '@/hooks/useGraphStore'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { mountReactRoot, unmountReactRoot, waitForFrames, waitForNextFrame, waitForTasks } from '@/tests/lib/reactRootHarness'

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
  try { state.setWorkspaceViewMode('canvas') } catch { void 0 }
  try { state.setWorkspaceCanvasPaneOpen(false) } catch { void 0 }
  try { state.setRichMediaPanelMode('snapshot') } catch { void 0 }
  try { state.setInfiniteCanvasInteractionMode('static') } catch { void 0 }
}

const dispatchPanelPointerEvent = (
  target: EventTarget,
  win: Window,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  args: { pointerId?: number; clientX?: number; clientY?: number; button?: number; buttons?: number } = {},
) => {
  type MouseEventConstructorLike = new (eventType: string, eventInitDict?: Record<string, unknown>) => Event
  const MouseEventCtor = (win as unknown as { MouseEvent: MouseEventConstructorLike }).MouseEvent
  const event = new MouseEventCtor(type, {
    bubbles: true,
    cancelable: true,
    button: args.button ?? 0,
    buttons: args.buttons ?? (type === 'pointerup' || type === 'pointercancel' ? 0 : 1),
    clientX: args.clientX ?? 0,
    clientY: args.clientY ?? 0,
  })
  Object.defineProperty(event, 'pointerId', { configurable: true, value: args.pointerId ?? 1 })
  Object.defineProperty(event, 'pointerType', { configurable: true, value: 'mouse' })
  target.dispatchEvent(event)
}

export async function testRichMediaPanelRendersSnapshotForNonDirectIframe() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    resetRichMediaPanelTestStoreState()
    const doc = dom.window.document
    const container = doc.createElement('section')
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
    const container = doc.createElement('section')
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
    const container = doc.createElement('section')
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
    const container = doc.createElement('section')
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

export async function testRichMediaPanelBodyPanStartsWithoutSelectionGate() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    resetRichMediaPanelTestStoreState()
    const doc = dom.window.document
    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)
    const overlayEvents: string[] = []
    const headerEvents: string[] = []

    await mountReactRoot(root,
      React.createElement(RichMediaPanel, {
        title: 'Pan body',
        url: '',
        kind: 'iframe',
        panelChrome: 'storyboardWidget',
        interactive: false,
        onOverlayPanStart: () => overlayEvents.push('start'),
        onOverlayPan: ({ dx, dy }) => overlayEvents.push(`move:${dx}:${dy}`),
        onOverlayPanEnd: () => overlayEvents.push('end'),
        onHeaderDragStart: () => headerEvents.push('start'),
        onHeaderDrag: () => headerEvents.push('move'),
        onHeaderDragEnd: () => headerEvents.push('end'),
      }),
    { window: dom.window, frames: 8 })

    const body = container.querySelector('[data-kg-rich-media-storyboard-widget-body="1"]') as HTMLElement | null
    if (!body) throw new Error('expected shared Storyboard Widget rich-media body surface')

    await act(async () => {
      dispatchPanelPointerEvent(body, dom.window, 'pointerdown', { pointerId: 21, clientX: 100, clientY: 100, buttons: 1 })
      dispatchPanelPointerEvent(dom.window, dom.window, 'pointermove', { pointerId: 21, clientX: 124, clientY: 138, buttons: 1 })
      dispatchPanelPointerEvent(dom.window, dom.window, 'pointerup', { pointerId: 21, clientX: 124, clientY: 138, buttons: 0 })
      await waitForNextFrame(dom.window)
    })

    if (overlayEvents.join('|') !== 'start|move:24:38|end') {
      throw new Error(`expected body pointer drag to start overlay pan without selected-first gating, got ${overlayEvents.join('|')}`)
    }
    if (headerEvents.length > 0) {
      throw new Error(`expected body pointer drag not to start header drag, got ${headerEvents.join('|')}`)
    }

    await unmountReactRoot(root, { window: dom.window })
  } finally {
    restoreDom()
  }
}

export async function testRichMediaPanelHeaderDragIsScopedToChromeHeader() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    resetRichMediaPanelTestStoreState()
    const doc = dom.window.document
    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)
    const overlayEvents: string[] = []
    const headerEvents: string[] = []

    await mountReactRoot(root,
      React.createElement(RichMediaPanel, {
        title: 'Drag header',
        url: '',
        kind: 'iframe',
        panelChrome: 'storyboardWidget',
        interactive: false,
        onOverlayPanStart: () => overlayEvents.push('start'),
        onOverlayPan: () => overlayEvents.push('move'),
        onOverlayPanEnd: () => overlayEvents.push('end'),
        onHeaderDragStart: () => headerEvents.push('start'),
        onHeaderDrag: ({ dx, dy }) => headerEvents.push(`move:${dx}:${dy}`),
        onHeaderDragEnd: () => headerEvents.push('end'),
      }),
    { window: dom.window, frames: 8 })

    const header = container.querySelector('[data-kg-rich-media-storyboard-widget-header="1"]') as HTMLElement | null
    if (!header) throw new Error('expected shared Storyboard Widget rich-media header surface')

    await act(async () => {
      dispatchPanelPointerEvent(header, dom.window, 'pointerdown', { pointerId: 22, clientX: 40, clientY: 40, buttons: 1 })
      dispatchPanelPointerEvent(dom.window, dom.window, 'pointermove', { pointerId: 22, clientX: 55, clientY: 64, buttons: 1 })
      dispatchPanelPointerEvent(dom.window, dom.window, 'pointerup', { pointerId: 22, clientX: 55, clientY: 64, buttons: 0 })
      await waitForNextFrame(dom.window)
    })

    if (headerEvents.join('|') !== 'start|move:15:24|end') {
      throw new Error(`expected header pointer drag to move the panel, got ${headerEvents.join('|')}`)
    }
    if (overlayEvents.length > 0) {
      throw new Error(`expected header pointer drag not to start body overlay pan, got ${overlayEvents.join('|')}`)
    }

    await unmountReactRoot(root, { window: dom.window })
  } finally {
    restoreDom()
  }
}

export async function testRichMediaPanelPlayableMediaDoesNotStartOverlayPan() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    resetRichMediaPanelTestStoreState()
    const doc = dom.window.document
    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)
    const overlayEvents: string[] = []

    await mountReactRoot(root,
      React.createElement(RichMediaPanel, {
        title: 'Playable media',
        url: 'https://example.com/generated.mp4',
        kind: 'video',
        panelChrome: 'storyboardWidget',
        interactive: true,
        onOverlayPanStart: () => overlayEvents.push('start'),
        onOverlayPan: () => overlayEvents.push('move'),
        onOverlayPanEnd: () => overlayEvents.push('end'),
      }),
    { window: dom.window, frames: 8 })

    const video = container.querySelector('video[data-kg-card-media-interactive="1"]') as HTMLVideoElement | null
    if (!video) throw new Error('expected playable shared card video surface')

    await act(async () => {
      dispatchPanelPointerEvent(video, dom.window, 'pointerdown', { pointerId: 23, clientX: 10, clientY: 10, buttons: 1 })
      dispatchPanelPointerEvent(dom.window, dom.window, 'pointermove', { pointerId: 23, clientX: 40, clientY: 40, buttons: 1 })
      dispatchPanelPointerEvent(dom.window, dom.window, 'pointerup', { pointerId: 23, clientX: 40, clientY: 40, buttons: 0 })
      await waitForNextFrame(dom.window)
    })

    if (overlayEvents.length > 0) {
      throw new Error(`expected playable media pointerdown to remain available for playback controls, got overlay events ${overlayEvents.join('|')}`)
    }

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
    const container = doc.createElement('section')
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
  const readSource = (...parts: string[]) => readFileSync(resolve(root, 'src', ...parts), 'utf8')
  const sharedCardMediaText = readSource('lib', 'cards', 'CardMediaPreview.tsx')
  const sharedCardMarkdownText = readSource('lib', 'cards', 'CardMarkdownPreview.tsx')
  const sharedCardMarkdownUtilsText = readSource('lib', 'cards', 'cardMarkdownPreviewUtils.ts')
  const sharedCardInlineText = readSource('lib', 'cards', 'CardInlineTextEditor.tsx')
  const sharedCardMediaUtilsText = readSource('lib', 'cards', 'cardMediaPreviewUtils.ts')
  const richMediaPanelText = [
    readSource('components', 'RichMediaPanel.tsx'),
    readSource('components', 'RichMediaPanelDirectMediaSurface.tsx'),
    readSource('components', 'RichMediaPanelIframeSurface.tsx'),
    readSource('components', 'RichMediaPanelTextSurface.tsx'),
    readSource('components', 'RichMediaPanelContentStack.tsx'),
    readSource('components', 'RichMediaPanelShell.tsx'),
    readSource('components', 'RichMediaPanel.types.ts'),
    readSource('components', 'useRichMediaPanelSurfaceState.ts'),
  ].join('\n')
  const renderConfigText = readSource('lib', 'config.render.ts')
  const canvasViewportText = readSource('components', 'CanvasViewport.tsx')
  const storyboardCanvasText = readSource('components', 'StoryboardCanvas.tsx')
  const storyboardWidgetFormText = readSource('components', 'StoryboardWidget', 'WidgetEditorForm.tsx')
  const storyboardWidgetPanelText = readSource('components', 'StoryboardWidget', 'WidgetEditorPanel.tsx')
  const storyboardWidgetPanelChromeText = readSource('components', 'StoryboardWidget', 'StoryboardWidgetPanelChrome.tsx')
  const storyboardWidgetPanelChromeClassNameText = readSource('components', 'StoryboardWidget', 'storyboardWidgetPanelChromeClassName.ts')
  const flowCanvasOverlayText = readSource('components', 'FlowCanvas', 'FlowCanvasMediaOverlays.tsx')
  const graphCanvasOverlayText = readSource('components', 'GraphCanvasRoot', 'components', 'RichMediaOverlayLayer2d.tsx')
  const graphHoverTooltipText = readSource('components', 'GraphHoverTooltip.tsx')
  const staticPreviewText = readSource('components', 'StaticRichMediaPanelPreview.tsx')
  const designFrameText = readSource('components', 'DesignCanvas', 'FrameShellLayer.tsx')
  const designMediaOverlayText = readSource('components', 'DesignCanvas', 'MediaOverlay.tsx')
  const designWireframeText = readSource('components', 'DesignCanvas', 'WireframePreviewLayer.tsx')
  const markdownDesignOverlayText = readSource('lib', 'markdown-edgeless', 'MarkdownDesignOverlay.impl.tsx')
  const animaticCanvasText = readSource('components', 'AnimaticCanvas.tsx')
  const markdownMediaUiText = readSource('lib', 'markdown-core', 'ui', 'MarkdownMediaUi.impl.tsx')
  const markdownInlineRendererText = readSource('lib', 'markdown-core', 'ui', 'MarkdownInlineRenderer.impl.tsx')
  const markdownInlineMediaDownloadText = readSource('lib', 'markdown-core', 'ui', 'MarkdownInlineMediaDownload.tsx')
  const safeHtmlRendererText = readSource('lib', 'markdown-core', 'ui', 'markdownPreviewLinks.safeHtml.render.tsx')
  const markdownPreviewViewerText = readSource('lib', 'markdown-core', 'ui', 'MarkdownPreviewViewer.impl.tsx')
  const markdownTokenRendererText = readSource('features', 'markdown', 'ui', 'MarkdownTokenRenderer.tsx')
  const markdownCodeBlockText = readSource('features', 'markdown', 'ui', 'MarkdownCodeBlock.tsx')
  const markdownTableBlockText = readSource('features', 'markdown', 'ui', 'MarkdownTableBlock.tsx')
  const plainMermaidDiagramText = readSource('features', 'markdown', 'ui', 'PlainMermaidDiagram.tsx')
  const kanbanMenuText = readSource('features', 'markdown', 'ui', 'kanban', 'kanbanMenu.ts')

  for (const snippet of ['export function CardMediaPreview', 'export function CardMediaEmptyPlaceholder', 'export function CardMediaLoadingSkeleton']) {
    if (!sharedCardMediaText.includes(snippet)) throw new Error(`expected shared card media owner to expose ${snippet}`)
  }
  for (const snippet of ['export function CardMarkdownPreview', 'MarkdownPreviewLazy']) {
    if (!sharedCardMarkdownText.includes(snippet)) throw new Error(`expected shared card markdown owner to expose ${snippet}`)
  }
  for (const snippet of ['CARD_MARKDOWN_CONTENT_CLASS_NAME', 'markdownCardPreviewMode', 'markdownForcePlainTables']) {
    if (!sharedCardMarkdownText.includes(snippet)) throw new Error(`expected shared card markdown owner to render compact Card markdown with ${snippet}`)
  }
  for (const snippet of [
    'export function hasCardMarkdownPreviewSyntax',
    'export function readCardMarkdownPreviewSourceLineRange',
    'export function buildCardMarkdownPreviewText',
    'CARD_MARKDOWN_PREVIEW_FRAME_CLASS_NAME',
    'CARD_MARKDOWN_PREVIEW_CODE_CHROME_CLASS_NAME',
    'CARD_MARKDOWN_PREVIEW_CODE_SURFACE_PADDING_CLASS_NAME',
    'CARD_MARKDOWN_PREVIEW_CODE_SURFACE_INSET_CSS_VALUE',
    'CARD_MARKDOWN_PREVIEW_EMBEDDED_SURFACE_CLASS_NAME',
    'CARD_MARKDOWN_PREVIEW_EMBEDDED_MEDIA_SURFACE_CLASS_NAME',
    'CARD_MARKDOWN_PREVIEW_CODE_SURFACE_CLASS_NAME',
    'CARD_MARKDOWN_PREVIEW_MERMAID_SURFACE_CLASS_NAME',
    'CARD_MARKDOWN_PREVIEW_MEDIA_CHROME_CLASS_NAME',
  ]) {
    if (!sharedCardMarkdownUtilsText.includes(snippet)) {
      throw new Error(`expected shared card markdown utility owner to expose ${snippet}`)
    }
  }
  if (!sharedCardInlineText.includes('CardMarkdownPreview') || !sharedCardInlineText.includes("markdownPreview?: boolean | 'auto'")) {
    throw new Error('expected shared Storyboard card text editor to own optional card markdown preview rendering')
  }
  if (!sharedCardMediaUtilsText.includes('export function isDirectPlayableCardMedia')) {
    throw new Error('expected shared card media utility owner to expose direct playable media detection')
  }
  if (!richMediaPanelText.includes("from '@/lib/cards/CardMediaPreview'")) {
    throw new Error('expected RichMediaPanel to reuse the shared card media surface')
  }
  if (!richMediaPanelText.includes("from '@/lib/cards/CardMarkdownPreview'") || richMediaPanelText.includes('MarkdownPreviewLazy')) {
    throw new Error('expected RichMediaPanel text mode to reuse the shared card markdown surface')
  }
  if (
    !richMediaPanelText.includes("from '@/lib/cards/CardInlineTextEditor'")
    || !richMediaPanelText.includes('data-kg-rich-media-inline-edit="1"')
    || !richMediaPanelText.includes('editActivation="click"')
    || !richMediaPanelText.includes('onCommit={nextValue => {')
    || !richMediaPanelText.includes("props.onPanelChange?.({ activeTab: 'text', freezeConnectedOutput: true, text: nextText })")
  ) {
    throw new Error('expected RichMediaPanel text mode inline edits to reuse the shared Storyboard Card inline editor')
  }
  if (
    !richMediaPanelText.includes('CARD_MARKDOWN_PREVIEW_EMBEDDED_SURFACE_CLASS_NAME')
    || !richMediaPanelText.includes('CARD_MARKDOWN_PREVIEW_EMBEDDED_MEDIA_SURFACE_CLASS_NAME')
    || !richMediaPanelText.includes('CARD_MARKDOWN_PREVIEW_CODE_SURFACE_INSET_CSS_VALUE')
    || !richMediaPanelText.includes("touchAction: 'pan-y'")
    || richMediaPanelText.includes("touchAction: 'pan-x pan-y'")
  ) {
    throw new Error('expected RichMediaPanel text mode to reuse the shared vertical-only Card markdown media surface')
  }
  if (!richMediaPanelText.includes("from '@/lib/cards/cardMediaPreviewUtils'")) {
    throw new Error('expected RichMediaPanel to reuse the shared card media utility owner')
  }
  if (
    !storyboardWidgetPanelChromeText.includes('export function StoryboardWidgetPanelChromeHeader')
    || !storyboardWidgetPanelChromeClassNameText.includes('export const getStoryboardWidgetPanelChromeClassName')
    || !storyboardWidgetPanelChromeText.includes('data-kg-rich-media-storyboard-widget-header')
    || !storyboardWidgetPanelText.includes("from '@/components/StoryboardWidget/StoryboardWidgetPanelChrome'")
    || !storyboardWidgetPanelText.includes("from '@/components/StoryboardWidget/storyboardWidgetPanelChromeClassName'")
    || !storyboardWidgetPanelText.includes('<StoryboardWidgetPanelChromeHeader')
  ) {
    throw new Error('expected Storyboard Widget panel chrome to be the reusable 2D panel UI owner')
  }
  if (
    !storyboardWidgetFormText.includes("import { CardInlineTextEditor } from '@/lib/cards/CardInlineTextEditor'")
    || !storyboardWidgetFormText.includes('onCommit={setCompactPreviewText}')
    || !storyboardWidgetFormText.includes('markdownPreview="auto"')
    || storyboardWidgetFormText.includes('hasCardMarkdownPreviewSyntax(compactPreviewView.textValue)')
  ) {
    throw new Error('expected Widget compact text preview to reuse the shared Storyboard Card inline editor')
  }
  if (
    !storyboardWidgetPanelText.includes('const handleRichMediaPanelChange = richMediaWidgetPreview?.handleRichMediaPanelChange')
    || !storyboardWidgetPanelText.includes('onPanelChange={handleRichMediaPanelChange}')
  ) {
    throw new Error('expected RichMediaPanel widget body to pass the shared panel change owner into the reusable RichMediaPanel')
  }
  if (
    !richMediaPanelText.includes("from '@/components/StoryboardWidget/StoryboardWidgetPanelChrome'")
    || !richMediaPanelText.includes("panelChrome?: 'none' | 'storyboardWidget'")
    || !richMediaPanelText.includes('<StoryboardWidgetPanelChromeHeader')
    || !richMediaPanelText.includes('data-kg-rich-media-storyboard-widget-body="1"')
    || richMediaPanelText.includes('data-kg-rich-media-card-header')
    || richMediaPanelText.includes('PANEL_FRAME_HEADER_STYLE')
  ) {
    throw new Error('expected RichMediaPanel optional chrome to reuse the Storyboard Widget panel UI around the shared Card media body')
  }
  if (!renderConfigText.includes("flowchart: {\n    surfaceId: 'd3'") || !renderConfigText.includes("d3: {\n    surfaceId: 'd3'")) {
    throw new Error('expected D3 Graph and Flowchart renderers to share the D3 canvas surface')
  }
  if (
    !canvasViewportText.includes("const sharedGraphCanvasSurfaceActive = active2dSurface === 'd3'")
    || !canvasViewportText.includes('<SharedGraphCanvasLazy active />')
    || !canvasViewportText.includes('active2dSurface === \'storyboard\' ? <StoryboardWidgetCanvasLazy active storyboardWidgetSurfaceId="storyboard" storyboardCardsMode /> : null')
  ) {
    throw new Error('expected Storyboard to mount the Storyboard Widget canvas surface while D3 Graph stays graph-only')
  }
  if (!storyboardCanvasText.includes("from '@/lib/cards/CardMediaPreview'") || !storyboardCanvasText.includes('CardMediaPreview')) {
    throw new Error('expected Storyboard cards to reuse the shared card media surface')
  }
  if (!storyboardCanvasText.includes('title="Reference"') || storyboardCanvasText.includes('<img src={reference.url}')) {
    throw new Error('expected Storyboard reference thumbnails to reuse the shared card media surface')
  }
  if (!storyboardCanvasText.includes('markdownPreview="auto"')) {
    throw new Error('expected Storyboard card text fields to enable shared card markdown rendering for structured syntax')
  }
  if (!storyboardWidgetFormText.includes("import { CardMediaPreview } from '@/lib/cards/CardMediaPreview'")) {
    throw new Error('expected Storyboard Widget compact media previews to import the shared card media surface')
  }
  if (
    !storyboardWidgetFormText.includes("import { CardInlineTextEditor } from '@/lib/cards/CardInlineTextEditor'")
    || !storyboardWidgetFormText.includes('markdownPreview="auto"')
    || !storyboardWidgetFormText.includes('onCommit={setCompactPreviewText}')
    || storyboardWidgetFormText.includes('hasCardMarkdownPreviewSyntax(compactPreviewView.textValue)')
  ) {
    throw new Error('expected Storyboard Widget compact text previews to reuse shared Card inline editing and markdown rendering for structured syntax')
  }
  if (!storyboardWidgetFormText.includes('kind={compactPreviewView.kind}') || storyboardWidgetFormText.includes('<img') || storyboardWidgetFormText.includes('<video')) {
    throw new Error('expected Storyboard Widget compact image/video previews to route through the shared card media surface')
  }
  if (!flowCanvasOverlayText.includes("import RichMediaPanel from '@/components/RichMediaPanel'") || !flowCanvasOverlayText.includes('panelChrome="storyboardWidget"')) {
    throw new Error('expected Flow Canvas rich media overlays to reuse Storyboard Widget RichMediaPanel chrome')
  }
  if (!graphCanvasOverlayText.includes("import RichMediaPanel from '@/components/RichMediaPanel'") || !graphCanvasOverlayText.includes('panelChrome="storyboardWidget"')) {
    throw new Error('expected D3 graph and Flowchart rich media overlays to reuse Storyboard Widget RichMediaPanel chrome')
  }
  if (!graphHoverTooltipText.includes("import { CardMediaPreview } from '@/lib/cards/CardMediaPreview'") || graphHoverTooltipText.includes('<img')) {
    throw new Error('expected D3 graph hover thumbnails to reuse the shared card media surface')
  }
  if (
    !graphHoverTooltipText.includes("from '@/lib/ui/panelFrame'")
    || !graphHoverTooltipText.includes('PANEL_FRAME_FLOATING_ROOT_STYLE')
    || !graphHoverTooltipText.includes('data-kg-hover-panel-root')
    || graphHoverTooltipText.includes('contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text} shadow-md max-w-xs text-xs`}')
  ) {
    throw new Error('expected D3 graph hover panel chrome to reuse the shared Rich Media panel-frame surface')
  }
  if (
    !staticPreviewText.includes("import RichMediaPanel from '@/components/RichMediaPanel'")
    || !staticPreviewText.includes('panelChrome="storyboardWidget"')
    || staticPreviewText.includes('const titleWidth')
  ) {
    throw new Error('expected static renderer previews to delegate all rich-media Storyboard Widget chrome to RichMediaPanel')
  }
  if (
    !designFrameText.includes('<StaticRichMediaPanelPreview')
    || !designWireframeText.includes('<StaticRichMediaPanelPreview')
    || !designMediaOverlayText.includes('panelChrome="storyboardWidget"')
    || !markdownDesignOverlayText.includes('panelChrome="storyboardWidget"')
  ) {
    throw new Error('expected Design renderer previews and overlays to reuse Storyboard Widget RichMediaPanel chrome')
  }
  if (
    !markdownDesignOverlayText.includes("from '@/lib/cards/cardMarkdownPreviewUtils'")
    || !markdownDesignOverlayText.includes('buildCardMarkdownPreviewText({ block: b, markdownText: deferredMarkdownText })')
  ) {
    throw new Error('expected markdown design overlays to reuse the shared Card markdown preview text utility')
  }
  for (const forbiddenSnippet of ['b.preview.table.columns || []', "['```' + lang", "['```html'", 'b.preview.listItems.slice']) {
    if (markdownDesignOverlayText.includes(forbiddenSnippet)) {
      throw new Error(`expected markdown design overlay to avoid local Card markdown snippet reconstruction: ${forbiddenSnippet}`)
    }
  }
  if (/<(?:img|video|iframe)\b/.test(animaticCanvasText)) {
    throw new Error('expected Animatic renderer to avoid duplicate direct media preview tags')
  }
  if (!markdownMediaUiText.includes("from '@/lib/cards/CardMediaPreview'") || !markdownMediaUiText.includes('mediaThumbnailDataAttr')) {
    throw new Error('expected markdown image/video/iframe media to route through shared CardMediaPreview while preserving thumbnail affordances')
  }
  if (!markdownInlineRendererText.includes("from '@/lib/cards/CardMediaPreview'") || markdownInlineRendererText.includes('<img\\n          key={`${key}-image`}')) {
    throw new Error('expected inline markdown image syntax to route through shared CardMediaPreview')
  }
  if (!safeHtmlRendererText.includes("from '@/lib/cards/CardMediaPreview'") || safeHtmlRendererText.includes('<video src={src}') || safeHtmlRendererText.includes('<iframe src={src}')) {
    throw new Error('expected safe HTML image/video/iframe markdown surfaces to route through shared CardMediaPreview')
  }
  if (!markdownPreviewViewerText.includes('if (markdownCardPreviewMode) return previewContent') || !markdownPreviewViewerText.includes('data-kg-card-markdown-viewer')) {
    throw new Error('expected MarkdownPreviewViewer to expose a chrome-free Card markdown surface')
  }
  if (!markdownTokenRendererText.includes('const cardPreviewMode = markdownCardPreviewMode === true') || !markdownTokenRendererText.includes('markdownCardPreviewMode: cardPreviewMode')) {
    throw new Error('expected MarkdownTokenRenderer to propagate Card preview mode into block render opts')
  }
  if (!markdownCodeBlockText.includes('const cardPreviewMode = opts.markdownCardPreviewMode === true') || !markdownCodeBlockText.includes('cardPreviewMode ? null') || !markdownCodeBlockText.includes('aria-label={UI_COPY.markdownCodeBlockActionsLabel}')) {
    throw new Error('expected MarkdownCodeBlock to suppress document code actions only in Card preview mode')
  }
  if (
    !markdownTableBlockText.includes('CARD_MARKDOWN_PREVIEW_FRAME_CLASS_NAME')
    || !markdownCodeBlockText.includes('CARD_MARKDOWN_PREVIEW_FRAME_CLASS_NAME')
    || !markdownCodeBlockText.includes('CARD_MARKDOWN_PREVIEW_CODE_SURFACE_CLASS_NAME')
    || !markdownCodeBlockText.includes('codeFenceContentSurfaceClassName')
    || !markdownCodeBlockText.includes('codeBlockSpacingClassName')
  ) {
    throw new Error('expected Code and Table markdown blocks to reuse the shared Card preview chrome-free frame')
  }
  for (const [label, text] of [
    ['markdown media ui', markdownMediaUiText],
    ['markdown inline renderer', markdownInlineRendererText],
    ['safe HTML renderer', safeHtmlRendererText],
  ] as const) {
    if (!text.includes('CARD_MARKDOWN_PREVIEW_MEDIA_CHROME_CLASS_NAME') || !(text.includes('markdownCardPreviewMode') || text.includes('cardPreviewMode'))) {
      throw new Error(`expected ${label} to reuse shared Card preview media chrome removal`)
    }
  }
  if (
    !sharedCardMarkdownUtilsText.includes('CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_CLASS_NAME')
    || !sharedCardMarkdownUtilsText.includes('CARD_MARKDOWN_PREVIEW_CHIP_CLASS_NAME')
    || !sharedCardMarkdownUtilsText.includes('CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_PILL_CLASS_NAME')
    || !sharedCardMarkdownUtilsText.includes('CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_LABEL_CLASS_NAME')
    || !sharedCardMarkdownUtilsText.includes('readCardMarkdownPreviewMediaLabel')
    || !markdownInlineRendererText.includes('CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_CLASS_NAME')
    || !markdownInlineRendererText.includes('CardPreviewInlineMediaPill')
    || !markdownInlineRendererText.includes("fit={inlineMediaChipMode ? 'cover' : 'contain'}")
    || !markdownInlineRendererText.includes('fallbackLabel="Image"')
    || !markdownInlineRendererText.includes('fallbackLabel="Video"')
    || !safeHtmlRendererText.includes('CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_CLASS_NAME')
    || !safeHtmlRendererText.includes('renderCardPreviewInlineMediaPill')
    || !safeHtmlRendererText.includes("fit={inlineMediaChipMode ? 'cover' : 'contain'}")
    || !markdownMediaUiText.includes("fit={cardPreviewMode === true ? 'cover' : 'contain'}")
  ) {
    throw new Error('expected card-preview inline image and video surfaces to use shared mention-style media pill classes')
  }
  if (
    !sharedCardMarkdownUtilsText.includes('rounded-full')
    || !sharedCardMarkdownUtilsText.includes('h-3')
    || !sharedCardMarkdownUtilsText.includes('items-center')
    || !sharedCardMarkdownUtilsText.includes('align-baseline')
    || !sharedCardMarkdownUtilsText.includes('[font-size:inherit]')
    || !sharedCardMarkdownUtilsText.includes('[line-height:inherit]')
    || !sharedCardMarkdownUtilsText.includes('mr-1')
    || !sharedCardMarkdownUtilsText.includes('truncate [line-height:inherit]')
    || !sharedCardMarkdownUtilsText.includes('max-w-[9rem]')
    || !sharedCardMarkdownUtilsText.includes('border-[color:var(--kg-border)]')
    || !sharedCardMarkdownUtilsText.includes('text-[color:var(--kg-text-secondary)]')
  ) {
    throw new Error('expected card-preview inline image and video surfaces to reuse the shared Open brief chip styling with thumbnail and label')
  }
  if (
    !markdownInlineMediaDownloadText.includes('if (args.cardPreviewMode === true) return args.children')
    || !safeHtmlRendererText.includes('if (cardPreviewMode === true) return null')
  ) {
    throw new Error('expected Card markdown previews to keep media download affordances out of inline @ thumbnail pills')
  }
  if (
    !markdownCodeBlockText.includes('const baseMode: AnnotateDisplayMode = cardPreviewMode')
    || !markdownCodeBlockText.includes("? (isMermaidLang ? 'render' : defaultMode)")
    || !markdownCodeBlockText.includes('enablePanZoom={!cardPreviewMode}')
    || !plainMermaidDiagramText.includes('CARD_MARKDOWN_PREVIEW_MERMAID_SURFACE_CLASS_NAME')
    || !plainMermaidDiagramText.includes("style={cardPreviewMode ? { touchAction: 'pan-y' } : undefined}")
    || !plainMermaidDiagramText.includes("dangerouslySetInnerHTML={{ __html: selectedSvg }}")
  ) {
    throw new Error('expected MarkdownCodeBlock Card preview mode to render Mermaid as inline SVG while keeping non-Mermaid code fences as code')
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
    const container = doc.createElement('section')
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
    const container = doc.createElement('section')
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
    const container = doc.createElement('section')
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
    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    await mountReactRoot(root,
      React.createElement(RichMediaPanel, {
        title: 'Rich Media Panel',
        url: '',
        kind: 'iframe',
        interactive: false,
        forwardWheelTo: () => doc.body,
        panel: {
          activeTab: 'text',
          freezeConnectedOutput: false,
          hasText: true,
          hasImage: false,
          hasVideo: false,
          hasAudio: false,
          hasPoi: false,
          text: '',
          connectedText: [
            '# Hello',
            '',
            '> Storyboard quote stays structured.',
            '',
            '```ts',
            'const value = 42',
            '```',
            '',
            '```mermaid',
            'flowchart LR',
            '  A[Text surface] --> B[Mermaid surface]',
            '```',
            '',
            'Inline link [Open reference](https://example.com/reference) stays visible.',
            '',
            'Inline math $x+y$ stays visible.',
            '',
            '| ID | Criterion |',
            '| --- | --- |',
            '| C1 | Data freshness |',
            '',
            '![preview](https://example.com/preview.png)',
            '',
            '![](https://example.com/demo.mp4)',
            '',
          ].join('\n'),
        },
      }),
    { window: dom.window, frames: 28 })

    const markdownPreview = container.querySelector('[data-kg-rich-media-markdown-preview="1"]')
    if (!markdownPreview) throw new Error('expected RichMediaPanel text mode to mount the shared markdown preview surface')
    const markdownPreviewEl = markdownPreview as HTMLElement
    const markdownPreviewClassName = String(markdownPreviewEl.getAttribute('class') || '')
    if (!markdownPreviewClassName.includes('overflow-y-auto') || !markdownPreviewClassName.includes('overflow-x-hidden') || !markdownPreviewClassName.includes('bg-[color:var(--kg-code-bg)]')) {
      throw new Error(`expected RichMediaPanel text surface to reuse the shared code-like vertical-only Card surface, class=${markdownPreviewClassName}`)
    }
    if (markdownPreviewEl.style.overflowY !== 'auto' || markdownPreviewEl.style.overflowX !== 'hidden' || markdownPreviewEl.style.touchAction !== 'pan-y') {
      throw new Error(`expected RichMediaPanel text surface to allow vertical scrolling only, y=${markdownPreviewEl.style.overflowY} x=${markdownPreviewEl.style.overflowX} touch=${markdownPreviewEl.style.touchAction}`)
    }
    if (markdownPreviewEl.style.pointerEvents !== 'auto') {
      throw new Error(`expected RichMediaPanel text surface to remain scroll-targetable while canvas wheel forwarding exists, pointerEvents=${markdownPreviewEl.style.pointerEvents}`)
    }
    const cardMarkdownPreview = container.querySelector('[data-kg-card-markdown-preview="1"]')
    if (!cardMarkdownPreview) throw new Error('expected RichMediaPanel text mode to reuse the shared CardMarkdownPreview surface')
    const cardMarkdownViewer = container.querySelector('[data-kg-card-markdown-viewer="1"]')
    if (!cardMarkdownViewer) throw new Error('expected RichMediaPanel text mode to use the chrome-free Card markdown viewer')
    const cardMarkdownViewerClassName = String((cardMarkdownViewer as HTMLElement).getAttribute('class') || '')
    if (cardMarkdownViewerClassName.includes('overflow-auto')) {
      throw new Error(`expected outer RichMediaPanel text surface to own scrolling instead of nested Card markdown viewer, class=${cardMarkdownViewerClassName}`)
    }
    if (container.querySelector('[aria-label="Markdown sidebar"]')) throw new Error('expected Card markdown preview to omit document Explorer/Outline chrome')
    if (container.querySelector('[aria-label="Code block actions"]')) throw new Error('expected Card markdown preview to omit document code-block toolbar chrome')
    if (container.querySelector('script[data-kg-markdown-source="1"]')) throw new Error('expected Card markdown preview to avoid embedding hidden source payload text')
    const article = cardMarkdownPreview.querySelector('article')
    if (!article || !String(article.getAttribute('class') || '').includes('w-full')) {
      throw new Error(`expected Card markdown preview content to span the Card width, html=${container.innerHTML}`)
    }
    const heading = Array.from(container.querySelectorAll('h1,h2,h3') as NodeListOf<HTMLElement>).find(el => (el.textContent || '').trim() === 'Hello')
    if (!heading) throw new Error('expected markdown heading to render through RichMediaPanel text mode')
    const blockquote = container.querySelector('blockquote')
    if (!blockquote || !/Storyboard quote stays structured/i.test(blockquote.textContent || '')) {
      throw new Error(`expected card markdown preview to render blockquote syntax, html=${container.innerHTML}`)
    }
    const code = container.querySelector('pre code')
    if (!code || !/const value = 42/i.test(code.textContent || '')) {
      throw new Error(`expected card markdown preview to render fenced code syntax, html=${container.innerHTML}`)
    }
    const codeFigure = code.closest('figure') as HTMLElement | null
    const codeFigureClassName = String(codeFigure?.getAttribute('class') || '')
    if (/\brounded\b|\bborder\b|\bshadow-sm\b/.test(codeFigureClassName)) {
      throw new Error(`expected Card markdown code frame to avoid nested rounded border shadow chrome, class=${codeFigureClassName}`)
    }
    if (!codeFigureClassName.includes('overflow-y-auto') || !codeFigureClassName.includes('overflow-x-hidden')) {
      throw new Error(`expected Card markdown code frame to use vertical-only scrolling, class=${codeFigureClassName}`)
    }
    const link = Array.from(container.querySelectorAll('a') as NodeListOf<HTMLAnchorElement>).find(anchor =>
      String(anchor.getAttribute('href') || '').includes('https://example.com/reference'),
    )
    if (!link) throw new Error('expected card markdown preview to render markdown link syntax')
    if (!/x\+y|x\s*\+\s*y/.test(container.textContent || '')) {
      throw new Error(`expected card markdown preview to preserve inline math syntax, text=${JSON.stringify(container.textContent || '')}`)
    }
    const table = container.querySelector('table')
    if (!table || !/Data freshness/i.test(table.textContent || '')) {
      throw new Error(`expected Card markdown preview to render markdown tables as a full-width plain table, html=${container.innerHTML}`)
    }
    if (container.querySelector('[aria-label="Markdown data view"]')) {
      throw new Error('expected Card markdown preview to avoid document-level data-view table conversion')
    }
    const image = container.querySelector('img[data-kg-card-media-kind="image"][data-kg-media-thumbnail="1"]')
    if (!image) throw new Error(`expected card markdown preview markdown image to reuse CardMediaPreview, html=${container.innerHTML}`)
    const imageClassName = String((image as HTMLElement).getAttribute('class') || '')
    if (/\brounded\b|\bborder\b|\bshadow-sm\b/.test(imageClassName)) {
      throw new Error(`expected Card markdown image media to avoid nested rounded border shadow chrome, class=${imageClassName}`)
    }
    const video = container.querySelector('video[data-kg-card-media-kind="video"][data-kg-media-thumbnail="1"]')
    if (!video) throw new Error(`expected card markdown preview markdown video to reuse CardMediaPreview, html=${container.innerHTML}`)
    const videoClassName = String((video as HTMLElement).getAttribute('class') || '')
    if (/\brounded\b|\bborder\b|\bshadow-sm\b/.test(videoClassName)) {
      throw new Error(`expected Card markdown video media to avoid nested rounded border shadow chrome, class=${videoClassName}`)
    }
    const cardDownloadLink = cardMarkdownPreview.querySelector('a[download][aria-label="Download media"]')
    if (cardDownloadLink) {
      throw new Error(`expected Card markdown preview to move media download affordance out of inline @ thumbnail pills, html=${container.innerHTML}`)
    }

    await unmountReactRoot(root, { window: dom.window })
  } finally {
    restoreDom()
  }
}

export async function testRichMediaPanelTextModeInlineEditUsesStoryboardCardSsot() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  const state = useGraphStore.getState()
  const previousRenderer = state.canvas2dRenderer
  const previousRenderMode = state.canvasRenderMode
  try {
    resetRichMediaPanelTestStoreState()
    try {
      state.setCanvasRenderMode('2d')
      state.setCanvas2dRenderer('storyboard')
    } catch {
      void 0
    }
    const doc = dom.window.document
    const container = doc.createElement('section')
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
          hasAudio: false,
          hasPoi: false,
          text: '',
          connectedText: 'Connected panel text',
        },
        onPanelChange: () => void 0,
      }),
    { window: dom.window, frames: 8 })

    const inlineSurface = container.querySelector('[data-kg-rich-media-inline-edit="1"]')
    if (!inlineSurface) throw new Error('expected RichMediaPanel text mode to expose a shared inline edit surface')
    const display = inlineSurface.querySelector('[data-kg-card-inline-edit-activation="click"]')
    if (!(display instanceof dom.window.HTMLElement)) {
      throw new Error('expected RichMediaPanel inline text surface to reuse CardInlineTextEditor click activation')
    }

    await act(async () => {
      display.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await waitForNextFrame(dom.window)
    })

    const editor = container.querySelector('textarea[aria-label="Rich Media Panel text"]')
    if (!(editor instanceof dom.window.HTMLTextAreaElement)) {
      throw new Error(`expected click activation to open the shared multiline CardInlineTextEditor, html=${container.innerHTML}`)
    }
    if (editor.value !== 'Connected panel text') {
      throw new Error(`expected inline editor to open with connected panel text, got ${JSON.stringify(editor.value)}`)
    }
    if (!container.querySelector('button[title="Slash commands"]')) {
      throw new Error('expected RichMediaPanel text mode to enable shared slash commands')
    }
    if (!container.querySelector('button[title="Variable commands"]')) {
      throw new Error('expected RichMediaPanel text mode to enable shared variable commands')
    }
    if (!container.querySelector('button[title="Keyword commands"]')) {
      throw new Error('expected RichMediaPanel text mode to enable shared keyword commands')
    }

    await unmountReactRoot(root, { window: dom.window })
  } finally {
    try {
      state.setCanvasRenderMode(previousRenderMode)
      state.setCanvas2dRenderer(previousRenderer)
    } catch {
      void 0
    }
    restoreDom()
  }
}

export async function testRichMediaPanelStoryboardWidgetChromeWrapsSharedCardBody() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    resetRichMediaPanelTestStoreState()
    const doc = dom.window.document
    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    await mountReactRoot(root,
      React.createElement(RichMediaPanel, {
        title: 'Rich Media Panel - Storyboard Widget Chrome',
        url: '',
        kind: 'iframe',
        interactive: false,
        panelChrome: 'storyboardWidget',
        style: {
          display: 'block',
          width: 226,
          height: 163,
        },
        panel: {
          activeTab: 'text',
          freezeConnectedOutput: false,
          hasText: true,
          hasImage: false,
          hasVideo: false,
          hasAudio: false,
          hasPoi: false,
          text: '',
          connectedText: [
            '> Shared card quote',
            '',
            '```ts',
            'const storyboardWidgetChrome = true',
            '```',
            '',
            '![preview](https://example.com/preview.png)',
          ].join('\n'),
        },
      }),
    { window: dom.window, frames: 28 })

    const panel = container.querySelector('[data-kg-rich-media-panel="1"]')
    if (!panel) throw new Error('expected RichMediaPanel root')
    if (panel.getAttribute('data-kg-rich-media-storyboard-widget-chrome') !== '1') {
      throw new Error('expected RichMediaPanel root to expose Storyboard Widget chrome marker')
    }
    const panelEl = panel as HTMLElement
    if (panelEl.style.display !== 'flex' || panelEl.style.flexDirection !== 'column') {
      throw new Error(`expected Storyboard Widget chrome root to preserve shared flex frame after overlay styles, got display=${panelEl.style.display} flexDirection=${panelEl.style.flexDirection}`)
    }
    const header = panel.querySelector('[data-kg-rich-media-storyboard-widget-header="1"]')
    if (!header) throw new Error('expected shared RichMediaPanel Storyboard Widget chrome header')
    if (!/Rich Media Panel - Storyboard Widget Chrome/.test(header.textContent || '')) {
      throw new Error(`expected Storyboard Widget chrome header to render the panel title, html=${container.innerHTML}`)
    }
    if (header.querySelectorAll('button').length < 3) {
      throw new Error(`expected Storyboard Widget chrome header to render the shared Flow widget action buttons, html=${container.innerHTML}`)
    }
    const body = panel.querySelector('[data-kg-rich-media-storyboard-widget-body="1"]')
    if (!body) throw new Error('expected shared RichMediaPanel Storyboard Widget chrome body')
    if (!body.querySelector('[data-kg-card-markdown-preview="1"]')) {
      throw new Error('expected Storyboard Widget chrome body to reuse shared CardMarkdownPreview')
    }
    await act(async () => {
      for (let attempt = 0; attempt < 8 && !body.querySelector('img[data-kg-card-media-kind="image"][data-kg-media-thumbnail="1"]'); attempt += 1) {
        await waitForTasks(2)
        await waitForFrames(dom.window, 2)
      }
    })
    if (!body.querySelector('img[data-kg-card-media-kind="image"][data-kg-media-thumbnail="1"]')) {
      throw new Error(`expected markdown image inside Storyboard Widget chrome body to reuse shared CardMediaPreview, html=${container.innerHTML}`)
    }
    if (container.querySelector('[aria-label="Markdown sidebar"]')) {
      throw new Error('expected Storyboard Widget chrome body to avoid document markdown sidebar chrome')
    }

    await unmountReactRoot(root, { window: dom.window })
  } finally {
    restoreDom()
  }
}
