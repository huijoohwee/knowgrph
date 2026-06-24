import React from 'react'
import RichMediaPanel from '@/components/RichMediaPanel'
import type { MediaOverlayNode } from '@/lib/render/mediaOverlayPool'
import { commitRichMediaPanelChange, resolveRichMediaPanelInteractive } from '@/lib/render/richMediaSsot'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphNode } from '@/lib/graph/types'
import {
  computePanelFrameResizeFromDrag16x9,
  computePanelFrameSizeFromWidth16x9,
  readRichMediaPanelFrameMetrics,
  type MediaPanelCssMetrics,
} from '@/lib/render/mediaPanelLayout'

type DesignMediaResizeState = {
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

function readDesignSizeOverrideFromStore(nodeId: string): { w: number; h: number } | null {
  const id = String(nodeId || '').trim()
  if (!id) return null
  const sizes = (useGraphStore.getState() as { designFrameSizeById?: Record<string, { w?: unknown; h?: unknown }> }).designFrameSizeById || {}
  const size = sizes[id]
  const w = Number(size?.w)
  const h = Number(size?.h)
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null
  return { w: Math.max(24, Math.round(w)), h: Math.max(24, Math.round(h)) }
}

export function DesignCanvasMediaOverlay(props: {
  active: boolean
  designMediaOverlayNodes: MediaOverlayNode[]
  renderMediaAsNodes: boolean
  onRegisterOverlayEl: (id: string, el: HTMLElement | null) => void
  forwardWheelTo: () => SVGSVGElement | null
  shouldStartHeaderDrag: () => boolean
  onOverlayPanStart: (args: { pointerId: number; buttons: number }) => void
  onOverlayPan: (args: { pointerId: number; dx: number; dy: number }) => void
  onOverlayPanEnd: (args: { pointerId: number }) => void
  onHeaderDragStart: (args: { nodeId: string; pointerId: number }) => void
  onHeaderDrag: (args: { nodeId: string; dx: number; dy: number; pointerId: number }) => void
  onHeaderDragEnd: (args: { nodeId: string; pointerId: number }) => void
}) {
  const {
    active,
    designMediaOverlayNodes,
    renderMediaAsNodes,
    onRegisterOverlayEl,
    forwardWheelTo,
    shouldStartHeaderDrag,
    onOverlayPanStart,
    onOverlayPan,
    onOverlayPanEnd,
    onHeaderDragStart,
    onHeaderDrag,
    onHeaderDragEnd,
  } = props
  const updateNode = useGraphStore(s => s.updateNode)
  const setDesignFrameSize = useGraphStore(s => s.setDesignFrameSize)
  const infiniteCanvasInteractionMode = useGraphStore(s => s.infiniteCanvasInteractionMode || 'static')
  const overlayElsRef = React.useRef<Map<string, HTMLElement>>(new Map())
  const overlayRefFnByIdRef = React.useRef<Map<string, (el: HTMLElement | null) => void>>(new Map())
  const resizeRef = React.useRef<DesignMediaResizeState | null>(null)

  const getPanelRefForId = React.useCallback((id: string) => {
    const key = String(id || '').trim()
    if (!key) return () => void 0
    const cached = overlayRefFnByIdRef.current.get(key)
    if (cached) return cached
    const fn = (el: HTMLElement | null) => {
      if (el) overlayElsRef.current.set(key, el)
      else overlayElsRef.current.delete(key)
      onRegisterOverlayEl(key, el)
    }
    overlayRefFnByIdRef.current.set(key, fn)
    return fn
  }, [onRegisterOverlayEl])

  const beginResize = React.useCallback((id: string, pointerId: number) => {
    const el = overlayElsRef.current.get(id) || null
    const rect = el?.getBoundingClientRect()
    const measuredW = rect && Number.isFinite(rect.width) ? Math.max(24, Math.round(rect.width)) : 0
    const measuredH = rect && Number.isFinite(rect.height) ? Math.max(24, Math.round(rect.height)) : 0
    const override = readDesignSizeOverrideFromStore(id)
    const baseProps = readGraphNodePropertiesFromStore(id)
    const storedW = Number(baseProps['visual:width'])
    const storedH = Number(baseProps['visual:height'])
    const frameMetrics = readRichMediaPanelFrameMetrics(el)
    const startW = override?.w || (Number.isFinite(storedW) && storedW > 0 ? Math.max(24, Math.round(storedW)) : Math.max(24, measuredW))
    const startH = override?.h || (Number.isFinite(storedH) && storedH > 0
      ? Math.max(24, Math.round(storedH))
      : (measuredH || Math.max(24, Math.round(computePanelFrameSizeFromWidth16x9({ panelW: startW, metrics: frameMetrics }).panelH))))
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
    setDesignFrameSize(id, { w: drag.lastW, h: drag.lastH })
    const baseProps = readGraphNodePropertiesFromStore(id)
    updateNode(id, {
      properties: {
        ...baseProps,
        'visual:width': drag.lastW,
        'visual:height': drag.lastH,
      },
    } as Partial<GraphNode>)
  }, [setDesignFrameSize, updateNode])

  if (!active || designMediaOverlayNodes.length === 0) return null
  return (
    <section aria-label="Design media overlay" className="absolute inset-0 z-[80] pointer-events-none">
      {designMediaOverlayNodes.map(node => (
        <RichMediaPanel
          key={node.id}
          ref={getPanelRefForId(node.id)}
          overlayId={node.id}
          className="absolute left-0 top-0 pointer-events-auto"
          title={node.title}
          url={node.url}
          srcDoc={node.srcDoc}
          openUrl={node.openUrl}
          kind={node.kind}
          panelChrome="flowEditor"
          interactive={resolveRichMediaPanelInteractive({
            nodeInteractive: node.interactive,
            renderMediaAsNodes,
            infiniteCanvasInteractionMode,
            canvasRenderMode: '2d',
            canvas2dRenderer: 'design',
          })}
          hideUntilReady={true}
          panel={node.panel}
          onPanelChange={next => {
            if (!node.panel) return
            commitRichMediaPanelChange({
              nodeId: node.id,
              next,
              updateNode: (id, patch) => updateNode(id, patch as Partial<import('@/lib/graph/types').GraphNode>),
            })
          }}
          forwardWheelTo={forwardWheelTo}
          shouldStartHeaderDrag={shouldStartHeaderDrag}
          onOverlayPanStart={onOverlayPanStart}
          onOverlayPan={onOverlayPan}
          onOverlayPanEnd={onOverlayPanEnd}
          onHeaderDragStart={({ pointerId }) => onHeaderDragStart({ nodeId: node.id, pointerId })}
          onHeaderDrag={({ dx, dy, pointerId }) => onHeaderDrag({ nodeId: node.id, dx, dy, pointerId })}
          onHeaderDragEnd={({ pointerId }) => onHeaderDragEnd({ nodeId: node.id, pointerId })}
          resizable={true}
          onResizeStart={({ pointerId }) => beginResize(node.id, pointerId)}
          onResize={({ pointerId, dx, dy }) => moveResize(node.id, { pointerId, dx, dy })}
          onResizeEnd={({ pointerId }) => endResize(node.id, pointerId)}
          style={{
            transform: 'translate(-99999px, -99999px)',
            width: 1,
            height: 1,
          }}
        />
      ))}
    </section>
  )
}
