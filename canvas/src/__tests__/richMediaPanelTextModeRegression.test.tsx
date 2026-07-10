import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import RichMediaPanel from '@/components/RichMediaPanel'
import { useGraphStore } from '@/hooks/useGraphStore'
import { writeMediaDragPayload, type MediaDragPayload } from '@/lib/ui/mediaDragPayload'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { mountReactRoot, unmountReactRoot, waitForFrames, waitForNextFrame } from '@/tests/lib/reactRootHarness'

const queryRichMediaTextEditor = (container: HTMLElement): HTMLElement | null =>
  container.querySelector('[contenteditable="true"][data-kg-card-inline-viewer-edit-surface="1"][aria-label="Rich Media Panel text"]')

const resetRichMediaPanelTestStoreState = () => {
  const state = useGraphStore.getState()
  try { state.setWorkspaceViewMode('canvas') } catch { void 0 }
  try { state.setWorkspaceCanvasPaneOpen(false) } catch { void 0 }
  try { state.setRichMediaPanelMode('snapshot') } catch { void 0 }
  try { state.setInfiniteCanvasInteractionMode('static') } catch { void 0 }
}

const createMediaDataTransfer = (payload: MediaDragPayload): DataTransfer => {
  const values = new Map<string, string>()
  const transfer = {
    dropEffect: '',
    effectAllowed: '',
    get types() {
      return Array.from(values.keys())
    },
    clearData: (type?: string) => {
      if (type) values.delete(type)
      else values.clear()
    },
    getData: (type: string) => values.get(type) || '',
    setData: (type: string, value: string) => {
      values.set(type, value)
    },
  } as unknown as DataTransfer
  writeMediaDragPayload(transfer, payload)
  return transfer
}

const dispatchMediaDrop = (win: Window, target: EventTarget, payload: MediaDragPayload) => {
  const EventCtor = (win as unknown as { Event: typeof Event }).Event
  const event = new EventCtor('drop', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', { configurable: true, value: createMediaDataTransfer(payload) })
  Object.defineProperty(event, 'clientX', { configurable: true, value: 12 })
  Object.defineProperty(event, 'clientY', { configurable: true, value: 12 })
  target.dispatchEvent(event)
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

export async function testRichMediaPanelTextModeAddTextReusesMediaDropZone() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    resetRichMediaPanelTestStoreState()
    const doc = dom.window.document
    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)
    const dropped: MediaDragPayload[] = []

    await mountReactRoot(root,
      React.createElement(RichMediaPanel, {
        overlayId: 'rich-media-panel-add-text',
        title: 'Rich Media Panel',
        url: '',
        kind: 'iframe',
        interactive: false,
        panel: {
          activeTab: 'text',
          freezeConnectedOutput: false,
          hasText: false,
          hasImage: false,
          hasVideo: false,
          hasAudio: false,
          hasPoi: false,
          text: '',
          connectedText: '',
        },
        onPanelChange: () => void 0,
        onMediaDrop: payload => {
          dropped.push(payload)
        },
      }),
    { window: dom.window, frames: 20 })

    const dropZone = container.querySelector('[data-kg-rich-media-media-drop-zone="1"][data-kg-card-media-drop-zone="1"]') as HTMLElement | null
    if (!dropZone) throw new Error(`expected Rich Media Panel Add text surface to reuse the shared card media drop zone, html=${container.innerHTML}`)
    if (dropZone.getAttribute('data-kg-media-drop-consumes-canvas-drop') !== '1') {
      throw new Error('expected Rich Media Panel media drop zone to consume canvas-level media drops')
    }
    const editor = queryRichMediaTextEditor(container)
    const display = container.querySelector('[data-kg-card-inline-edit="1"]')
    if (!editor && !/Add text/.test(String(display?.textContent || ''))) {
      throw new Error(`expected Rich Media Panel Add text editor to remain available inside the media drop zone, html=${container.innerHTML}`)
    }

    const mediaPayload: MediaDragPayload = {
      kind: 'image',
      label: 'Storyboard source frame',
      url: 'https://example.com/storyboard-source-frame.png',
      thumbnailUrl: 'https://example.com/storyboard-source-frame-thumb.png',
      sourceKey: 'source-frame',
    }
    await act(async () => {
      dispatchMediaDrop(dom.window, dropZone, mediaPayload)
      await waitForFrames(dom.window, 2)
    })

    if (dropped.length !== 1 || dropped[0]?.url !== mediaPayload.url || dropped[0]?.kind !== 'image') {
      throw new Error(`expected Rich Media Panel Add text drop zone to forward the media payload, got ${JSON.stringify(dropped)}`)
    }

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

    const editor = queryRichMediaTextEditor(container)
    if (!(editor instanceof dom.window.HTMLElement)) {
      throw new Error(`expected click activation to open the shared multiline Viewer edit surface, html=${container.innerHTML}`)
    }
    if (editor.textContent !== 'Connected panel text') {
      throw new Error(`expected inline editor to open with connected panel text, got ${JSON.stringify(editor.textContent)}`)
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
