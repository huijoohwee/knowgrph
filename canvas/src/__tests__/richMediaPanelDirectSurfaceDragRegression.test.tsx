import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import RichMediaPanel from '@/components/RichMediaPanel'
import { MEDIA_PREVIEW_SELECTABLE_SURFACE_ATTR } from '@/lib/cards/mediaPreviewSurfaceSelection'
import { useGraphStore } from '@/hooks/useGraphStore'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { mountReactRoot, unmountReactRoot, waitForNextFrame } from '@/tests/lib/reactRootHarness'

const resetRichMediaPanelDragState = () => {
  const state = useGraphStore.getState()
  try { state.setWorkspaceViewMode('canvas') } catch { void 0 }
  try { state.setWorkspaceCanvasPaneOpen(false) } catch { void 0 }
  try { state.setRichMediaPanelMode('snapshot') } catch { void 0 }
  try { state.setInfiniteCanvasInteractionMode('static') } catch { void 0 }
}

const dispatchPointerEvent = (
  target: EventTarget,
  win: Window,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  args: { pointerId?: number; clientX?: number; clientY?: number; button?: number; buttons?: number } = {},
) => {
  type EventConstructorLike = new (eventType: string, eventInitDict?: Record<string, unknown>) => Event
  const MouseEventCtor = (win as unknown as { MouseEvent: EventConstructorLike }).MouseEvent
  const event = new MouseEventCtor(type, {
    bubbles: true,
    cancelable: true,
    button: args.button ?? 0,
    buttons: args.buttons ?? (type === 'pointerup' ? 0 : 1),
    clientX: args.clientX ?? 0,
    clientY: args.clientY ?? 0,
  })
  Object.defineProperty(event, 'pointerId', { configurable: true, value: args.pointerId ?? 1 })
  Object.defineProperty(event, 'pointerType', { configurable: true, value: 'mouse' })
  target.dispatchEvent(event)
}

export async function testRichMediaPanelDirectImageSurfaceStartsOverlayDrag() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    resetRichMediaPanelDragState()
    const doc = dom.window.document
    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)
    const overlayEvents: string[] = []

    await mountReactRoot(root,
      React.createElement(RichMediaPanel, {
        title: 'Generated image',
        url: 'https://example.com/generated.png',
        kind: 'image',
        panelChrome: 'storyboardWidget',
        interactive: false,
        onOverlayPanStart: () => overlayEvents.push('start'),
        onOverlayPan: ({ dx, dy }) => overlayEvents.push(`move:${dx}:${dy}`),
        onOverlayPanEnd: () => overlayEvents.push('end'),
      }),
    { window: dom.window, frames: 12 })

    const selector = `[${MEDIA_PREVIEW_SELECTABLE_SURFACE_ATTR}="1"]`
    const image = container.querySelector(`img${selector}`) as HTMLImageElement | null
    const frame = container.querySelector(selector) as HTMLElement | null
    const target = image || frame
    if (!target) throw new Error('expected direct Rich Media image to expose the shared selectable surface marker')

    await act(async () => {
      dispatchPointerEvent(target, dom.window, 'pointerdown', { pointerId: 41, clientX: 10, clientY: 20, buttons: 1 })
      dispatchPointerEvent(dom.window, dom.window, 'pointermove', { pointerId: 41, clientX: 42, clientY: 45, buttons: 1 })
      dispatchPointerEvent(dom.window, dom.window, 'pointerup', { pointerId: 41, clientX: 42, clientY: 45, buttons: 0 })
      await waitForNextFrame(dom.window)
    })

    if (overlayEvents.join('|') !== 'start|move:32:25|end') {
      throw new Error(`expected direct image surface pointer drag to move the Rich Media panel, got ${overlayEvents.join('|')}`)
    }

    await unmountReactRoot(root, { window: dom.window })
  } finally {
    restoreDom()
  }
}
