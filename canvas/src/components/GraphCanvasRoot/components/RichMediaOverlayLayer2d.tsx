import React, { type RefObject, type SyntheticEvent } from 'react'
import { NodeOverlayEditorActionsToolbar } from '@/components/FlowEditor/NodeOverlayEditorActionsToolbar'
import { WIDGET_ACTIONS_TOOLBAR_MAX_WIDTH_PX } from '@/components/FlowEditor/flowWidgetOverlayShared'
import { useGraphStore } from '@/hooks/useGraphStore'
import { isSpacePanHeld } from '@/lib/canvas/space-pan'
import { Z_INDEX_GRAPH_MEDIA_LAYER } from '@/lib/ui/zIndex'
import RichMediaPanel from '@/components/RichMediaPanel'
import type { MediaOverlayNode } from '@/lib/render/mediaOverlayPool'
import { createUniqueId } from '@/lib/ids'
import type { GraphData, GraphNode } from '@/lib/graph/types'
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
  onHeaderDrag: (args: { clientX: number; clientY: number; dx: number; dy: number }) => void
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
  const addNode = useGraphStore(s => s.addNode)
  const addHistory = useGraphStore(s => s.addHistory)
  const removeNode = useGraphStore(s => s.removeNode)
  const selectNode = useGraphStore(s => s.selectNode)
  const selectedNodeId = useGraphStore(s => String(s.selectedNodeId || '').trim())
  const selectedNodeIds = useGraphStore(s => s.selectedNodeIds)
  const setSelectionSource = useGraphStore(s => s.setSelectionSource)
  const updateNode = useGraphStore(s => s.updateNode)
  const updateOpenWidgetNodeIds = useGraphStore(s => s.updateOpenWidgetNodeIds)
  const allowEmbeddedMediaInteraction = infiniteCanvasInteractionMode === 'interactive'
  const [activePanelId, setActivePanelId] = React.useState('')

  const selectPanel = React.useCallback((id: string) => {
    const key = String(id || '').trim()
    if (!key) return
    setActivePanelId(key)
    setSelectionSource('canvas')
    selectNode(key)
  }, [selectNode, setSelectionSource])

  const openPanelInSidepane = React.useCallback((id: string) => {
    const key = String(id || '').trim()
    if (!key) return
    selectPanel(key)
    updateOpenWidgetNodeIds(prev => (prev.includes(key) ? prev : [...prev, key]))
  }, [selectPanel, updateOpenWidgetNodeIds])

  const duplicatePanel = React.useCallback((id: string) => {
    const key = String(id || '').trim()
    if (!key) return
    const graphData = (useGraphStore.getState() as { graphData?: GraphData | null }).graphData
    const nodes = Array.isArray(graphData?.nodes) ? (graphData!.nodes as GraphNode[]) : []
    const node = nodes.find(item => String(item?.id || '').trim() === key)
    if (!node) return
    const usedIds = new Set(nodes.map(item => String(item?.id || '').trim()).filter(Boolean))
    const nextId = createUniqueId('n', usedIds)
    addNode({
      ...node,
      id: nextId,
      label: `${String(node.label || 'Rich Media Panel').trim()} Copy`,
      x: typeof node.x === 'number' && Number.isFinite(node.x) ? node.x + 32 : 32,
      y: typeof node.y === 'number' && Number.isFinite(node.y) ? node.y + 32 : 32,
      fx: undefined,
      fy: undefined,
      properties: { ...((node.properties || {}) as Record<string, unknown>) } as never,
    })
    addHistory('Rich Media duplicate')
  }, [addHistory, addNode])

  const removePanel = React.useCallback((id: string) => {
    const key = String(id || '').trim()
    if (!key) return
    removeNode(key)
    addHistory('Rich Media remove')
  }, [addHistory, removeNode])

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
        const selected = activePanelId === n.id || selectedNodeId === n.id || (Array.isArray(selectedNodeIds) && selectedNodeIds.some(id => String(id || '').trim() === n.id))
        return (
          <section
            key={n.id}
            ref={getPanelRefForId(n.id)}
            className="absolute left-0 top-0 pointer-events-none overflow-visible"
            data-kg-rich-media-overlay-shell="1"
            data-kg-rich-media-overlay-shell-id={n.id}
          >
            <NodeOverlayEditorActionsToolbar
              visible={selected}
              ariaLabel="Rich Media panel actions"
              navClassName="absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-1/2"
              navStyle={{ pointerEvents: 'auto' }}
              active
              iconSizeClass="h-3.5 w-3.5"
              iconStrokeWidth={1.8}
              enableHandlesDisabled
              convertToLoopDisabled
              duplicateDisabled={false}
              actionVisibility={{
                run: false,
                updateKvEntry: false,
                enableHandles: false,
                convertToLoop: false,
                clearOutput: false,
                help: false,
              }}
              onRun={() => void 0}
              onOpenInSidepane={() => openPanelInSidepane(n.id)}
              onDuplicate={() => duplicatePanel(n.id)}
              onClearOutput={() => void 0}
              onHelp={() => void 0}
              onRemove={() => removePanel(n.id)}
              onConvertToLoopNode={() => void 0}
              maxWidthPx={WIDGET_ACTIONS_TOOLBAR_MAX_WIDTH_PX}
            />
            <RichMediaPanel
              overlayId={n.id}
              className="relative h-full w-full pointer-events-auto"
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
                canvasRenderMode: '2d',
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
              forwardWheelBeforeScrollableTarget={!allowEmbeddedMediaInteraction}
              forwardPointerTo={() => svgRef.current}
              shouldForwardPointerDown={() => !allowEmbeddedMediaInteraction}
              shouldStartHeaderDrag={() => {
                if (isSpacePanHeld()) return false
                return true
              }}
              onOverlayPanStart={({ pointerId, clientX, clientY, buttons }) => {
                if ((buttons & 1) !== 1 && (buttons & 4) !== 4) return
                selectPanel(n.id)
                onOverlayPanStart({ pointerId, clientX, clientY })
              }}
              onOverlayPan={({ pointerId, clientX, clientY, dx, dy }) => onOverlayPan({ pointerId, clientX, clientY, dx, dy })}
              onOverlayPanEnd={({ pointerId }) => onOverlayPanEnd({ pointerId })}
              onHeaderDragStart={({ clientX, clientY }) => {
                selectPanel(n.id)
                onHeaderDragStart({ id: n.id, clientX, clientY })
              }}
              onHeaderDrag={({ clientX, clientY, dx, dy }) => onHeaderDrag({ clientX, clientY, dx, dy })}
              onHeaderDragEnd={() => onHeaderDragEnd()}
              resizable={true}
              onResizeStart={({ pointerId }) => beginResize(n.id, pointerId)}
              onResize={({ pointerId, dx, dy }) => moveResize(n.id, { pointerId, dx, dy })}
              onResizeEnd={({ pointerId }) => endResize(n.id, pointerId)}
              onClickCapture={(event) => {
                selectPanel(n.id)
                stopEvent(event)
              }}
              onDoubleClickCapture={stopEvent}
              onContextMenuCapture={stopEvent}
            />
          </section>
        )
      })}
    </section>
  )
}
