import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import RichMediaPanel from '@/components/RichMediaPanel'
import { useGraphStore } from '@/hooks/useGraphStore'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { mountReactRoot, unmountReactRoot, waitForNextFrame } from '@/tests/lib/reactRootHarness'

const resetRichMediaPanelTestStoreState = () => {
  const state = useGraphStore.getState()
  try { state.setWorkspaceViewMode('canvas') } catch { void 0 }
  try { state.setWorkspaceCanvasPaneOpen(false) } catch { void 0 }
  try { state.setRichMediaPanelMode('snapshot') } catch { void 0 }
  try { state.setInfiniteCanvasInteractionMode('static') } catch { void 0 }
}

const dispatchMouseLikeEvent = (
  target: EventTarget,
  win: Window,
  type: 'pointerdown' | 'mousemove' | 'mouseup',
  args: { pointerId?: number; clientX?: number; clientY?: number; buttons?: number },
) => {
  type MouseEventConstructorLike = new (eventType: string, eventInitDict?: Record<string, unknown>) => Event
  const MouseEventCtor = (win as unknown as { MouseEvent: MouseEventConstructorLike }).MouseEvent
  const event = new MouseEventCtor(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    buttons: args.buttons ?? (type === 'mouseup' ? 0 : 1),
    clientX: args.clientX ?? 0,
    clientY: args.clientY ?? 0,
  })
  if (type === 'pointerdown') {
    Object.defineProperty(event, 'pointerId', { configurable: true, value: args.pointerId ?? 1 })
    Object.defineProperty(event, 'pointerType', { configurable: true, value: 'mouse' })
  }
  target.dispatchEvent(event)
}

export async function testRichMediaPanelMarkdownScrollSurfaceCanPanCanvasWhenForwarded() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    resetRichMediaPanelTestStoreState()
    const doc = dom.window.document
    const cases = [
      ['table', '| Column A | Column B | Column C |\n| --- | --- | --- |\n| Alpha | Beta | Gamma |'],
      ['code', '```md\n## Campaign brief - variant: US-WEST\nBrand: SkyKids\nPalette: amber, sand\n```'],
      ['blockquote', '> Write it. See it. Ship it.'],
    ] as const
    for (let i = 0; i < cases.length; i += 1) {
      const [label, markdown] = cases[i]!
      const container = doc.createElement('section')
      doc.body.appendChild(container)
      const root = createRoot(container as unknown as HTMLElement)
      const overlayEvents: string[] = []
      await mountReactRoot(root, React.createElement(RichMediaPanel, {
        title: `Markdown ${label}`,
        url: '',
        kind: 'iframe',
        panelChrome: 'storyboardWidget',
        interactive: true,
        forwardPointerTo: () => doc.body,
        shouldForwardPointerDown: () => true,
        onOverlayPanStart: () => overlayEvents.push('start'),
        onOverlayPan: ({ dx, dy }) => overlayEvents.push(`move:${dx}:${dy}`),
        onOverlayPanEnd: () => overlayEvents.push('end'),
        panel: {
          activeTab: 'text',
          freezeConnectedOutput: false,
          hasText: true,
          hasImage: false,
          hasVideo: false,
          hasAudio: false,
          hasPoi: false,
          text: '',
          connectedText: markdown,
        },
      }), { window: dom.window, frames: 16 })
      const scrollSurface = container.querySelector('[data-kg-media-scroll-surface="1"]') as HTMLElement | null
      if (!scrollSurface) throw new Error(`expected markdown ${label} panel to expose a scrollable rich-media body surface`)
      await act(async () => {
        dispatchMouseLikeEvent(scrollSurface, dom.window, 'pointerdown', { pointerId: 31 + i, clientX: 80, clientY: 80, buttons: 1 })
        dispatchMouseLikeEvent(doc.body, dom.window, 'mousemove', { clientX: 112, clientY: 106, buttons: 1 })
        dispatchMouseLikeEvent(doc.body, dom.window, 'mouseup', { clientX: 112, clientY: 106, buttons: 0 })
        await waitForNextFrame(dom.window)
      })
      if (overlayEvents.join('|') !== 'start|move:32:26|end') {
        throw new Error(`expected markdown ${label} body drag to pan through shared overlay pan, got ${overlayEvents.join('|')}`)
      }
      await unmountReactRoot(root, { window: dom.window })
      container.remove()
    }
  } finally {
    restoreDom()
  }
}
