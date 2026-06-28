import React from 'react'
import { UI_RESPONSIVE_PASSIVE_FILL_SURFACE_CLASSNAME } from '@/lib/ui/responsiveElementClasses'
import FlowCanvas from '@/components/FlowCanvas'
import {
  StoryboardCardOverlayLayer2d,
  applyFixedStoryboardCardPlacementsToGraphData2d,
} from '@/components/FlowEditorCanvas/StoryboardCardOverlayLayer2d'
import { filterGraphByExcludedNodeIds } from '@/components/FlowEditorCanvas/flowEditorCanvasShared'
import { buildStoryboardBoardModel } from '@/components/StoryboardCanvas/storyboardModel'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { Z_INDEX_GRAPH_OVERLAY_EDGES } from '@/lib/ui/zIndex'
import { readFlowWidgetDragPayloadFromDataTransfer } from '@/lib/flowEditor/widgetDrag'
import {
  MEDIA_POINTER_DRAG_DROP_EVENT,
  claimMediaPointerDragDrop,
  clearMediaPointerDragPayload,
  hasMediaDragPayload,
  isMediaPointerDragDropClaimed,
  isMediaDropClaimedByNestedTarget,
  readMediaDragPayload,
  type MediaPointerDragDropDetail,
} from '@/lib/ui/mediaDragPayload'
import { screenToWorld } from '@/lib/zoom/viewport'
import { getEffectiveZoomStateForKey } from '@/lib/canvas/zoom-effective'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  CANVAS_OVERLAY_DRAG_HANDLE_SELECTOR,
  CANVAS_OVERLAY_PROXY_ROOT_SELECTOR,
  CANVAS_OVERLAY_RESIZE_HANDLE_SELECTOR,
  FLOW_EDITOR_OVERLAY_INTERACTIVE_SELECTOR,
  readFlowEditorElementSurfaceId,
  readFlowEditorOverlaySurfaceId,
} from '@/lib/canvas/flow-editor-overlay-proxy'
import {
  applyFlowEditorScreenAuthorityPanSnapshot,
  readFlowEditorScreenAuthorityPanSnapshot,
  shouldUseFlowEditorScreenAuthorityCollectivePan,
  type FlowEditorScreenAuthorityPanSnapshot,
} from '@/lib/flowEditor/screenAuthorityCollectivePan'
import type { GraphData } from '@/lib/graph/types'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import { FlowEditorOverlayPortHandleProvider } from '@/components/FlowEditor/FlowEditorOverlayPortHandles'
import { FLOW_PORT_HANDLE_SELECTOR, readFlowPortHandleAtClientPoint } from '@/components/FlowEditor/flowPortHandlePointerDrag'
import { useStoryboardEdgeCreationRequest } from '@/components/FlowEditorCanvas/runtime/useStoryboardEdgeCreationRequest'
import { isStoryboardFixedCardOwnedNode } from '@/components/FlowEditorCanvas/storyboardCardOwnership2d'
import { resolveGraphNodeByCanonicalId } from '@/lib/graph/canonicalNodeIds'

export default function FlowEditorCanvasSurface(props: {
  rootRef: React.RefObject<HTMLElement | null>
  flowEditorSurfaceId: string
  active: boolean
  canInteract: boolean
  canEdit: boolean
  geospatialWidgetPanelMode?: boolean
  storyboardCardsMode?: boolean
  storyboardSourceGraphData?: GraphData | null
  renderGraphDataOverride: GraphData | null
  flowEditorViewActive: boolean
  draftGraphDataRevision: number
  baseGraphDataRevision: number
  flowRuntimeRefRef: React.MutableRefObject<React.MutableRefObject<any> | null>
  hasOverlayEditors: boolean
  emitFlowEditorInteractionFrame: () => void
  overlayOnlyActive: boolean
  overlayEdgesSvgRef: React.Ref<SVGSVGElement>
  overlayEditorElements: React.ReactNode
  noGraphLoaded: boolean
  toolMode: 'select' | 'addEdge'
  pendingEdgeSourceId: string | null
  beginAddEdgeFromNode: (nodeId: string, portKey?: string | null) => void
  cancelPendingEdge: () => void
  finalizePendingEdge: (nodeId: string, portKey?: string | null) => void
  inspectorPortalHost: HTMLElement | null
  inspectorElement: React.ReactNode
  widgetRegistry: ReadonlyArray<WidgetRegistryEntry>
  shouldDedupeWidgetDrop: (key: string) => boolean
  setCanvasWindowOffsetFromRect: (rect: DOMRect) => void
  getLiveZoomTransform: () => { k: number; x: number; y: number } | null
  zoomViewKeyRef: React.MutableRefObject<string | null>
  addNodeFromRegistryAtWorld: (args: { entry: WidgetRegistryEntry; x: number; y: number }) => void
  addRichMediaPanelFromMediaAtWorld: (args: { media: import('@/lib/ui/mediaDragPayload').MediaDragPayload; x: number; y: number }) => string
  upsertUiToast: (args: { id: string; kind: 'neutral' | 'warning' | 'success' | 'error'; message: string; ttlMs?: number }) => void
  createPortal: typeof import('react-dom').createPortal
}) {
  const canvas2dRenderer = useGraphStore(s => s.canvas2dRenderer)
  const graphContentRevision = useGraphStore(s => s.graphContentRevision)
  const graphDataRevision = useGraphStore(s => s.graphDataRevision)
  const schema = useGraphStore(s => s.schema)
  const storyboardCardsActive = props.storyboardCardsMode === true && canvas2dRenderer === 'storyboard'
  const storyboardGraphData = React.useMemo(() => {
    if (!storyboardCardsActive) return null
    return applyFixedStoryboardCardPlacementsToGraphData2d({
      graphData: props.storyboardSourceGraphData || null,
      graphRevision: graphContentRevision || graphDataRevision || 0,
      schema,
      widgetRegistry: props.widgetRegistry,
    })
  }, [graphContentRevision, graphDataRevision, props.storyboardSourceGraphData, schema, storyboardCardsActive])
  const storyboardHiddenNodeIds = React.useMemo(() => {
    if (!storyboardCardsActive) return []
    const board = buildStoryboardBoardModel({
      graphData: storyboardGraphData,
      graphRevision: graphContentRevision || graphDataRevision || 0,
      widgetRegistry: props.widgetRegistry,
    })
    return board.lanes
      .flatMap(lane => lane.cards.map(card => String(card.id || '').trim()))
      .filter(id => isStoryboardFixedCardOwnedNode(resolveGraphNodeByCanonicalId(storyboardGraphData, id)))
  }, [graphContentRevision, graphDataRevision, props.widgetRegistry, storyboardCardsActive, storyboardGraphData])
  const readFlowCanvasBaseGraphDataOverride = React.useCallback(() => {
    const flowCanvasGraphDataOverride = storyboardCardsActive ? storyboardGraphData : props.renderGraphDataOverride
    return flowCanvasGraphDataOverride
  }, [props.renderGraphDataOverride, storyboardCardsActive, storyboardGraphData])
  const flowCanvasGraphDataOverride = React.useMemo(() => {
    const baseGraphData = readFlowCanvasBaseGraphDataOverride()
    if (!storyboardCardsActive) return baseGraphData
    return filterGraphByExcludedNodeIds({
      graphData: baseGraphData,
      excludedNodeIds: storyboardHiddenNodeIds,
    })
  }, [readFlowCanvasBaseGraphDataOverride, storyboardCardsActive, storyboardHiddenNodeIds])
  const flowCanvasHiddenNodeIds = storyboardCardsActive ? storyboardHiddenNodeIds : undefined
  useStoryboardEdgeCreationRequest({
    active: storyboardCardsActive,
    beginEdge: props.beginAddEdgeFromNode,
    graphData: flowCanvasGraphDataOverride,
  })
  const screenAuthorityPanRef = React.useRef<null | {
    pointerId: number
    startClientX: number
    startClientY: number
    snapshot: FlowEditorScreenAuthorityPanSnapshot
    transform: { k: number; x: number; y: number }
    started: boolean
  }>(null)
  const readSurfaceDrop = React.useCallback((clientX: number, clientY: number) => {
    const rect = props.rootRef.current?.getBoundingClientRect()
    if (!rect) return null
    props.setCanvasWindowOffsetFromRect(rect)
    const sx = clientX - rect.left
    const sy = clientY - rect.top
    if (!Number.isFinite(sx) || !Number.isFinite(sy) || sx < 0 || sy < 0 || sx > rect.width || sy > rect.height) return null
    return screenToWorld({
      transform: props.getLiveZoomTransform() || getEffectiveZoomStateForKey({
        zoomViewKey: props.zoomViewKeyRef.current,
        zoomStateByKey: useGraphStore.getState().zoomStateByKey,
        zoomState: useGraphStore.getState().zoomState,
      }),
      sx,
      sy,
    })
  }, [props])

  const appendMediaPanelAtClientPoint = React.useCallback((payload: import('@/lib/ui/mediaDragPayload').MediaDragPayload, clientX: number, clientY: number) => {
    if (props.geospatialWidgetPanelMode || !props.canEdit) return false
    if (isMediaDropClaimedByNestedTarget(clientX, clientY)) return false
    const mediaUrl = String(payload?.url || '').trim()
    if (!mediaUrl) return false
    const pos = readSurfaceDrop(clientX, clientY)
    if (!pos) return false
    const actualId = props.addRichMediaPanelFromMediaAtWorld({ media: { ...payload, url: mediaUrl }, x: pos.x, y: pos.y })
    if (!actualId) return false
    props.upsertUiToast({ id: 'flow-editor-drop-media', kind: 'neutral', message: 'Created Rich Media Panel node.', ttlMs: 1500 })
    clearMediaPointerDragPayload()
    return true
  }, [props, readSurfaceDrop])

  const isMediaPointerDropDistanceAccepted = React.useCallback((detail: MediaPointerDragDropDetail) => {
    if (!Number.isFinite(detail.startClientX) || !Number.isFinite(detail.startClientY)) return true
    const dx = detail.clientX - Number(detail.startClientX)
    const dy = detail.clientY - Number(detail.startClientY)
    return Math.hypot(dx, dy) >= 6
  }, [])

  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const isPointerEventLike = (event: PointerEvent | MouseEvent): event is PointerEvent =>
      typeof (event as PointerEvent).pointerId === 'number'

    const readInteractionPointerId = (event: PointerEvent | MouseEvent): number =>
      isPointerEventLike(event) ? event.pointerId : -1

    const readTransform = (): { k: number; x: number; y: number } => {
      const st = useGraphStore.getState()
      const resolved =
        props.getLiveZoomTransform()
        || getEffectiveZoomStateForKey({
          zoomViewKey: props.zoomViewKeyRef.current,
          zoomStateByKey: st.zoomStateByKey,
          zoomState: st.zoomState,
        })
        || st.zoomState
        || { k: 1, x: 0, y: 0 }
      return {
        k: Number.isFinite(resolved.k) ? resolved.k : 1,
        x: Number.isFinite(resolved.x) ? resolved.x : 0,
        y: Number.isFinite(resolved.y) ? resolved.y : 0,
      }
    }

    const readActiveSurfaceId = (surfaceRoot: HTMLElement) => String(props.flowEditorSurfaceId || '').trim() || readFlowEditorElementSurfaceId(surfaceRoot)

    const onPointerDown = (event: PointerEvent | MouseEvent) => {
      if (screenAuthorityPanRef.current) return
      if (isPointerEventLike(event) && event.pointerType === 'touch') return
      if (event.button !== 0) return
      const surfaceRoot = props.rootRef.current
      if (!surfaceRoot) return
      const state = useGraphStore.getState()
      const flowEditorOverlayInteractionMode = shouldUseFlowEditorScreenAuthorityCollectivePan(state)
      if (!flowEditorOverlayInteractionMode) return
      const target = event.target instanceof Element ? event.target : null
      if (!target) return
      if (target.closest(FLOW_EDITOR_OVERLAY_INTERACTIVE_SELECTOR)) return
      if (target.closest(CANVAS_OVERLAY_RESIZE_HANDLE_SELECTOR)) return
      if (target.closest(CANVAS_OVERLAY_DRAG_HANDLE_SELECTOR)) return
      const overlayRoot = target.closest(CANVAS_OVERLAY_PROXY_ROOT_SELECTOR)
      if (!(overlayRoot instanceof HTMLElement)) return
      const surfaceId = readActiveSurfaceId(surfaceRoot)
      if (!surfaceId || readFlowEditorOverlaySurfaceId(overlayRoot) !== surfaceId) return
      const transform = readTransform()
      const snapshot = readFlowEditorScreenAuthorityPanSnapshot({ flowEditorSurfaceId: surfaceId, transform })
      if (!snapshot) return
      screenAuthorityPanRef.current = {
        pointerId: readInteractionPointerId(event),
        startClientX: Number.isFinite(event.clientX) ? event.clientX : 0,
        startClientY: Number.isFinite(event.clientY) ? event.clientY : 0,
        snapshot,
        transform,
        started: false,
      }
      try {
        event.preventDefault()
        event.stopPropagation()
      } catch {
        void 0
      }
    }

    const onPointerMove = (event: PointerEvent | MouseEvent) => {
      const pending = screenAuthorityPanRef.current
      if (!pending || readInteractionPointerId(event) !== pending.pointerId) return
      if (typeof event.buttons === 'number' && event.buttons === 0) {
        screenAuthorityPanRef.current = null
        return
      }
      const clientX = Number.isFinite(event.clientX) ? event.clientX : pending.startClientX
      const clientY = Number.isFinite(event.clientY) ? event.clientY : pending.startClientY
      const dx = clientX - pending.startClientX
      const dy = clientY - pending.startClientY
      if (!pending.started && dx * dx + dy * dy < 9) return
      pending.started = true
      const changed = applyFlowEditorScreenAuthorityPanSnapshot({
        snapshot: pending.snapshot,
        dx,
        dy,
        transform: pending.transform,
      })
      if (changed) props.emitFlowEditorInteractionFrame()
      try {
        event.preventDefault()
        event.stopPropagation()
      } catch {
        void 0
      }
    }

    const onPointerUp = (event: PointerEvent | MouseEvent) => {
      const pending = screenAuthorityPanRef.current
      if (!pending || readInteractionPointerId(event) !== pending.pointerId) return
      screenAuthorityPanRef.current = null
      try {
        event.preventDefault()
        event.stopPropagation()
      } catch {
        void 0
      }
    }

    window.addEventListener('pointerdown', onPointerDown, { passive: false, capture: true })
    window.addEventListener('pointermove', onPointerMove, { passive: false, capture: true })
    window.addEventListener('pointerup', onPointerUp, { passive: false, capture: true })
    window.addEventListener('pointercancel', onPointerUp, { passive: false, capture: true })
    window.addEventListener('mousedown', onPointerDown, { passive: false, capture: true })
    window.addEventListener('mousemove', onPointerMove, { passive: false, capture: true })
    window.addEventListener('mouseup', onPointerUp, { passive: false, capture: true })
    return () => {
      screenAuthorityPanRef.current = null
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('pointermove', onPointerMove, true)
      window.removeEventListener('pointerup', onPointerUp, true)
      window.removeEventListener('pointercancel', onPointerUp, true)
      window.removeEventListener('mousedown', onPointerDown, true)
      window.removeEventListener('mousemove', onPointerMove, true)
      window.removeEventListener('mouseup', onPointerUp, true)
    }
  }, [
    props.emitFlowEditorInteractionFrame,
    props.flowEditorSurfaceId,
    props.getLiveZoomTransform,
    props.rootRef,
    props.zoomViewKeyRef,
  ])

  React.useEffect(() => {
    if (!props.active || props.geospatialWidgetPanelMode || !props.canEdit || typeof window === 'undefined') return
    const handleCanvasPointerDragDrop = (event: Event) => {
      const detail = (event as CustomEvent<MediaPointerDragDropDetail>).detail
      if (!detail?.payload) return
      if (isMediaPointerDragDropClaimed(detail)) return
      if (!isMediaPointerDropDistanceAccepted(detail)) return
      claimMediaPointerDragDrop(detail)
      try {
        event.preventDefault()
        event.stopPropagation()
        ;(event as unknown as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.()
      } catch {
        void 0
      }
      if (!appendMediaPanelAtClientPoint(detail.payload, detail.clientX, detail.clientY)) {
        detail.__kgMediaPointerDropClaimed = false
        return
      }
    }
    window.addEventListener(MEDIA_POINTER_DRAG_DROP_EVENT, handleCanvasPointerDragDrop, true)
    return () => window.removeEventListener(MEDIA_POINTER_DRAG_DROP_EVENT, handleCanvasPointerDragDrop, true)
  }, [appendMediaPanelAtClientPoint, isMediaPointerDropDistanceAccepted, props.active, props.canEdit, props.geospatialWidgetPanelMode])

  React.useEffect(() => {
    if (!props.active || !props.canEdit || typeof window === 'undefined') return
    const handlePointerDown = (event: PointerEvent | MouseEvent) => {
      if (event.button !== 0 || props.toolMode !== 'addEdge') return
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest(FLOW_PORT_HANDLE_SELECTOR)) return
      if (readFlowPortHandleAtClientPoint({ clientX: event.clientX, clientY: event.clientY })) return
      props.cancelPendingEdge()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || props.toolMode !== 'addEdge') return
      props.cancelPendingEdge()
      try {
        event.preventDefault()
        event.stopPropagation()
      } catch {
        void 0
      }
    }
    window.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('mousedown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('mousedown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [props])

  return (
    <section
      ref={props.rootRef}
      className={`absolute inset-0 z-0 ${props.geospatialWidgetPanelMode ? 'pointer-events-none' : ''}`}
      aria-label="Flow Editor"
      data-kg-flow-editor-surface-root={props.flowEditorSurfaceId}
      onDragOverCapture={(ev) => {
        if (props.geospatialWidgetPanelMode || !props.canEdit) return
        if (ev.dataTransfer && hasMediaDragPayload(ev.dataTransfer)) {
          ev.preventDefault()
          try {
            ev.dataTransfer.dropEffect = 'copy'
          } catch {
            void 0
          }
          return
        }
        ev.preventDefault()
        try {
          ev.dataTransfer.dropEffect = 'copy'
        } catch {
          void 0
        }
      }}
      onDropCapture={(ev) => {
        if (props.geospatialWidgetPanelMode || !props.canEdit) return
        if (ev.dataTransfer && hasMediaDragPayload(ev.dataTransfer)) {
          const mediaPayload = readMediaDragPayload(ev.dataTransfer)
          if (mediaPayload && appendMediaPanelAtClientPoint(mediaPayload, ev.clientX, ev.clientY)) {
            ev.preventDefault()
            ev.stopPropagation()
          }
          return
        }
        const payload = readFlowWidgetDragPayloadFromDataTransfer({ getData: mime => ev.dataTransfer.getData(mime) })
        if (!payload) return
        const entry = (props.widgetRegistry || []).find(e => e && e.isEnabled && e.id === payload.registryEntryId) || null
        if (!entry) return
        const el = props.rootRef.current
        const rect = el ? el.getBoundingClientRect() : null
        if (!rect) return
        props.setCanvasWindowOffsetFromRect(rect)
        const sx = ev.clientX - rect.left
        const sy = ev.clientY - rect.top
        if (!Number.isFinite(sx) || !Number.isFinite(sy) || sx < 0 || sy < 0 || sx > rect.width || sy > rect.height) return
        const dropKey = `${payload.registryEntryId}:${Math.round(sx)}:${Math.round(sy)}`
        if (props.shouldDedupeWidgetDrop(dropKey)) {
          ev.preventDefault()
          ev.stopPropagation()
          return
        }
        const st = useGraphStore.getState()
        const pos = screenToWorld({
          transform:
            props.getLiveZoomTransform() ||
            getEffectiveZoomStateForKey({
              zoomViewKey: props.zoomViewKeyRef.current,
              zoomStateByKey: st.zoomStateByKey,
              zoomState: st.zoomState,
            }),
          sx,
          sy,
        })
        props.addNodeFromRegistryAtWorld({ entry, x: pos.x, y: pos.y })
        props.upsertUiToast({
          id: 'flow-editor-drop-widget',
          kind: 'neutral',
          message: `Created ${entry.nodeTypeId} node.`,
          ttlMs: 1500,
        })
        ev.preventDefault()
        ev.stopPropagation()
      }}
    >
      <FlowEditorOverlayPortHandleProvider
        active={props.canEdit}
        graphData={flowCanvasGraphDataOverride}
        pendingEdgeSourceId={props.pendingEdgeSourceId}
        registryEntries={props.widgetRegistry}
        schema={schema}
        toolMode={props.toolMode}
        beginEdge={props.beginAddEdgeFromNode}
        cancelEdge={props.cancelPendingEdge}
        finalizeEdge={props.finalizePendingEdge}
      >
      {!props.noGraphLoaded && (
        <FlowCanvas
          active={props.active}
          flowEditorSurfaceId={props.flowEditorSurfaceId}
          allowNodeDragOverride={props.canInteract}
          graphDataOverride={flowCanvasGraphDataOverride}
          graphDataRevisionOverride={props.flowEditorViewActive ? props.draftGraphDataRevision : props.baseGraphDataRevision}
          excludeRichMediaOverlayNodeIds={flowCanvasHiddenNodeIds}
          exposeRuntimeRef={ref => {
            props.flowRuntimeRefRef.current = ref
          }}
          onInteractionFrame={props.hasOverlayEditors ? props.emitFlowEditorInteractionFrame : undefined}
        />
      )}

      {(props.overlayOnlyActive || props.hasOverlayEditors || storyboardCardsActive) && (
        <svg
          ref={props.overlayEdgesSvgRef}
          className={UI_RESPONSIVE_PASSIVE_FILL_SURFACE_CLASSNAME}
          style={{
            zIndex: Z_INDEX_GRAPH_OVERLAY_EDGES,
            color: 'var(--kg-canvas-edge-stroke, #9ca3af)',
            overflow: 'visible',
            opacity: 1,
            visibility: 'visible',
          }}
          aria-hidden={true}
        />
      )}

      {props.overlayEditorElements}
      <StoryboardCardOverlayLayer2d
        active={storyboardCardsActive}
        flowEditorSurfaceId={props.flowEditorSurfaceId}
        getTransform={props.getLiveZoomTransform}
        graphData={storyboardGraphData}
        graphRevision={graphContentRevision || graphDataRevision || 0}
        schema={schema}
        widgetRegistry={props.widgetRegistry}
      />

      {props.noGraphLoaded && !props.geospatialWidgetPanelMode && (
        <aside className="absolute top-3 left-3 z-[220]" aria-label="Flow Editor Status">
          <section className={`rounded-lg border px-3 py-2 ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.input.border}`}>
            <p className={`text-xs ${UI_THEME_TOKENS.text.secondary}`}>No graph loaded.</p>
          </section>
        </aside>
      )}

      {!props.hasOverlayEditors && props.toolMode === 'addEdge' && props.canEdit && (
        <aside className="absolute top-16 left-3 z-[220]" aria-label="Add edge hint">
          <section className={`rounded-lg border px-3 py-2 ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.input.border}`}>
            <p className={`text-xs ${UI_THEME_TOKENS.text.secondary}`}>
              {props.pendingEdgeSourceId ? `Select target node (from ${props.pendingEdgeSourceId}).` : 'Select source node.'}
            </p>
          </section>
        </aside>
      )}

      {props.inspectorPortalHost ? props.createPortal(props.inspectorElement, props.inspectorPortalHost) : null}
      </FlowEditorOverlayPortHandleProvider>
    </section>
  )
}
