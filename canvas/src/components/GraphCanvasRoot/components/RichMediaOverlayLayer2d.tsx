import React, { type RefObject, type SyntheticEvent } from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { isSpacePanHeld } from '@/lib/canvas/space-pan'
import { Z_INDEX_GRAPH_MEDIA_LAYER } from '@/lib/ui/zIndex'
import RichMediaPanel from '@/components/RichMediaPanel'
import type { MediaOverlayNode } from '@/lib/render/mediaOverlayPool'
import type { GraphNode } from '@/lib/graph/types'
import { commitRichMediaPanelChange, resolveRichMediaPanelInteractive } from '@/lib/render/richMediaSsot'
import {
  computePanelFrameResizeFromDrag16x9,
  computePanelFrameSizeFromWidth16x9,
  readRichMediaPanelFrameMetrics,
  type MediaPanelCssMetrics,
} from '@/lib/render/mediaPanelLayout'
import { UI_RESPONSIVE_PASSIVE_FILL_SURFACE_CLASSNAME } from '@/lib/ui/responsiveElementClasses'
type RichMediaResizeState = {
  id: string
  pointerId: number
  startW: number
  startH: number
  frameMetrics: Pick<MediaPanelCssMetrics, 'headerH' | 'padding' | 'borderW'>
  lastW: number
  lastH: number
}

function readGraphNodePropertiesFromStore(nodeId: string): Record<string, unknown> {
  const id = String(nodeId || '').trim()
  if (!id) return {}
  const graphData = (useGraphStore.getState() as { graphData?: { nodes?: GraphNode[] } | null }).graphData
  const nodes = Array.isArray(graphData?.nodes) ? graphData.nodes : []
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    if (String(n?.id || '').trim() !== id) continue
    const props = n?.properties
    return props && typeof props === 'object' && !Array.isArray(props) ? { ...(props as Record<string, unknown>) } : {}
  }
  return {}
}

export function RichMediaOverlayLayer2d(props: {
  active: boolean
  mediaOverlayNodes: MediaOverlayNode[]
  getOverlayRefForId: (id: string) => (el: HTMLElement | null) => void
  svgRef: RefObject<SVGSVGElement | null>
  renderMediaAsNodes: boolean
  stopEvent: (event: SyntheticEvent) => void
  onOverlayPanStart: (args: { pointerId: number; clientX: number; clientY: number }) => void
  onOverlayPan: (args: { pointerId: number; clientX: number; clientY: number; dx: number; dy: number }) => void
  onOverlayPanEnd: (args: { pointerId: number }) => void
  onHeaderDragStart: (args: { id: string; clientX: number; clientY: number }) => void
  onHeaderDrag: (args: { dx: number; dy: number }) => void
  onHeaderDragEnd: () => void
  requestMediaOverlaySchedule?: () => void
}) {
  const {
    active,
    mediaOverlayNodes,
    getOverlayRefForId,
    svgRef,
    renderMediaAsNodes,
    stopEvent,
    onOverlayPanStart,
    onOverlayPan,
    onOverlayPanEnd,
    onHeaderDragStart,
    onHeaderDrag,
    onHeaderDragEnd,
    requestMediaOverlaySchedule,
  } = props

  const overlayElsRef = React.useRef<Map<string, HTMLElement>>(new Map())
  const overlayRefFnByIdRef = React.useRef<Map<string, (el: HTMLElement | null) => void>>(new Map())
  const resizeRef = React.useRef<RichMediaResizeState | null>(null)
  const infiniteCanvasInteractionMode = useGraphStore(s => s.infiniteCanvasInteractionMode)
  const updateNode = useGraphStore(s => s.updateNode)
  const allowEmbeddedMediaInteraction = infiniteCanvasInteractionMode === 'interactive'

  const getPanelRefForId = React.useCallback((id: string) => {
    const key = String(id || '').trim()
    if (!key) return () => void 0
    const cached = overlayRefFnByIdRef.current.get(key)
    if (cached) return cached
    const outerRef = getOverlayRefForId(key)
    const fn = (el: HTMLElement | null) => {
      if (el) overlayElsRef.current.set(key, el)
      else overlayElsRef.current.delete(key)
      outerRef(el as HTMLElement | null)
    }
    overlayRefFnByIdRef.current.set(key, fn)
    return fn
  }, [getOverlayRefForId])

  const beginResize = React.useCallback((id: string, pointerId: number) => {
    const el = overlayElsRef.current.get(id) || null
    const rect = el?.getBoundingClientRect()
    const measuredW = rect && Number.isFinite(rect.width) ? Math.max(24, Math.round(rect.width)) : 0
    const measuredH = rect && Number.isFinite(rect.height) ? Math.max(24, Math.round(rect.height)) : 0
    const baseProps = readGraphNodePropertiesFromStore(id)
    const storedW = Number(baseProps['visual:width'])
    const storedH = Number(baseProps['visual:height'])
    const frameMetrics = readRichMediaPanelFrameMetrics(el)
    const startW = Number.isFinite(storedW) && storedW > 0 ? Math.max(24, Math.round(storedW)) : Math.max(24, measuredW)
    const startH = Number.isFinite(storedH) && storedH > 0
      ? Math.max(24, Math.round(storedH))
      : (measuredH || Math.max(24, Math.round(computePanelFrameSizeFromWidth16x9({ panelW: startW, metrics: frameMetrics }).panelH)))
    resizeRef.current = { id, pointerId, startW, startH, frameMetrics, lastW: startW, lastH: startH }
    if (el) {
      el.style.width = `${startW}px`
      el.style.height = `${startH}px`
    }
  }, [])

  const moveResize = React.useCallback((id: string, payload: { pointerId: number; dx: number; dy: number }) => {
    const drag = resizeRef.current
    if (!drag || drag.id !== id || drag.pointerId !== payload.pointerId) return
    const next = computePanelFrameResizeFromDrag16x9({
      startW: drag.startW,
      startH: drag.startH,
      dxClientPx: payload.dx,
      dyClientPx: payload.dy,
      scale: 1,
      metrics: drag.frameMetrics,
      minPanelW: 24,
      minPanelH: 24,
    })
    const nextW = Math.max(24, Math.round(next.panelW))
    const nextH = Math.max(24, Math.round(next.panelH))
    drag.lastW = nextW
    drag.lastH = nextH
    const el = overlayElsRef.current.get(id) || null
    if (el) {
      el.style.width = `${nextW}px`
      el.style.height = `${nextH}px`
    }
  }, [])

  const endResize = React.useCallback((id: string, pointerId: number) => {
    const drag = resizeRef.current
    if (!drag || drag.id !== id || drag.pointerId !== pointerId) return
    resizeRef.current = null
    const baseProps = readGraphNodePropertiesFromStore(id)
    updateNode(id, {
      properties: {
        ...baseProps,
        'visual:width': drag.lastW,
        'visual:height': drag.lastH,
      },
    } as Partial<GraphNode>)
    requestMediaOverlaySchedule?.()
  }, [requestMediaOverlaySchedule, updateNode])

  if (!active) return null
  if (mediaOverlayNodes.length === 0) return null

  return (
    <section
      aria-label="D3 rich media overlay"
      className={UI_RESPONSIVE_PASSIVE_FILL_SURFACE_CLASSNAME}
      style={{ zIndex: Z_INDEX_GRAPH_MEDIA_LAYER }}
    >
      {mediaOverlayNodes.map(n => {
        const kind = n.kind === 'iframe' || n.kind === 'image' || n.kind === 'svg' || n.kind === 'video' || n.kind === 'audio' ? n.kind : undefined
        return (
          <RichMediaPanel
            key={n.id}
            ref={getPanelRefForId(n.id)}
            overlayId={n.id}
            className="absolute left-0 top-0 pointer-events-auto"
            title={n.title}
            url={n.url}
            srcDoc={n.srcDoc}
            openUrl={n.openUrl}
            kind={kind}
            panelChrome="flowEditor"
            interactive={resolveRichMediaPanelInteractive({
              nodeInteractive: n.interactive,
              renderMediaAsNodes,
              infiniteCanvasInteractionMode,
            })}
            panel={n.panel}
            onPanelChange={next => {
              if (!n.panel) return
              commitRichMediaPanelChange({
                nodeId: n.id,
                next,
                updateNode: (id, patch) => updateNode(id, patch as Partial<import('@/lib/graph/types').GraphNode>),
              })
            }}
            forwardWheelTo={allowEmbeddedMediaInteraction ? undefined : (() => svgRef.current)}
            shouldStartHeaderDrag={() => {
              if (isSpacePanHeld()) return false
              return true
            }}
            onOverlayPanStart={({ pointerId, clientX, clientY, buttons }) => {
              if ((buttons & 1) !== 1 && (buttons & 4) !== 4) return
              onOverlayPanStart({ pointerId, clientX, clientY })
            }}
            onOverlayPan={({ pointerId, clientX, clientY, dx, dy }) => onOverlayPan({ pointerId, clientX, clientY, dx, dy })}
            onOverlayPanEnd={({ pointerId }) => onOverlayPanEnd({ pointerId })}
            onHeaderDragStart={({ clientX, clientY }) => onHeaderDragStart({ id: n.id, clientX, clientY })}
            onHeaderDrag={({ dx, dy }) => onHeaderDrag({ dx, dy })}
            onHeaderDragEnd={() => onHeaderDragEnd()}
            resizable={true}
            onResizeStart={({ pointerId }) => beginResize(n.id, pointerId)}
            onResize={({ pointerId, dx, dy }) => moveResize(n.id, { pointerId, dx, dy })}
            onResizeEnd={({ pointerId }) => endResize(n.id, pointerId)}
            onWheelCapture={stopEvent}
            onClickCapture={stopEvent}
            onDoubleClickCapture={stopEvent}
            onContextMenuCapture={stopEvent}
          />
        )
      })}
    </section>
  )
}
