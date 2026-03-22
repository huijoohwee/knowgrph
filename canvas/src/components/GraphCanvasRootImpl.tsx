import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useShallow } from 'zustand/react/shallow'
import { GraphNode, GraphEdge, GraphData } from '@/lib/graph/types'
import { type GraphSchema } from '@/lib/graph/schema'
import { DEFAULT_DRAG_ALPHA_TARGET } from '@/lib/graph/layoutDefaults'
import { useContainerDims } from '@/hooks/useContainerDims'
import { normalizeEdgesForSim, updateForceSimulationPresentation } from '@/components/GraphCanvas/simulation'
import { readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'
import type { PendingLink, TempLinkSelection } from '@/features/edge-creation'
import { GraphHoverTooltip, type HoverInfo } from '@/components/GraphHoverTooltip'
import {
  create2dSvgSnapshotFns,
  computeFlowState,
} from '@/components/GraphCanvas/helpers'
import { setupGraphScene, updateGraphSceneGroupsPresentation, updateGraphSceneNodesPresentation } from '@/components/GraphCanvas/scene'
import { emitPropsPanelOpen } from '@/features/canvas/utils'
import { useGraphCanvasStyles } from '@/components/GraphCanvas/useGraphCanvasStyles'
import { useZoomEffects } from '@/components/GraphCanvas/hooks/useZoomEffects'
import { useAutoZoomModes2d } from '@/features/zoom/useAutoZoomModes2d'
import { useEdgeCreationEffect } from '@/components/GraphCanvas/hooks/useEdgeCreationEffect'
import { useSelectionHighlight } from '@/components/GraphCanvas/hooks/useSelectionHighlight'
import { useGroupSelectionHighlight } from '@/components/GraphCanvas/hooks/useGroupSelectionHighlight'
import { buildLayoutPositionCacheKey, buildLayoutViewKey, computeLayoutDatasetKey, determineLayoutPositions } from '@/components/GraphCanvas/layout/positioning'
import { useDebouncedValue } from '@/features/hooks/useDebouncedValue'
import { useGraphStoreKeyRef } from '@/hooks/useGraphStoreKeyRef'
import type { PortHandleDatum } from '@/components/GraphCanvas/portHandles'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { cloneGraphDataForRender } from '@/components/GraphCanvas/renderClone'
import { pickInitialZoomTransform } from '@/lib/zoom/viewport'
import { buildZoomViewKey } from '@/components/GraphCanvas/zoomViewKey'
import { commitZoomTransformToStore } from '@/lib/canvas/zoom-commit'
import { pickZoomStateForView } from '@/lib/canvas/zoom-effective'
import { ensureSpacePanKeyListenerInstalled } from '@/lib/canvas/space-pan'
import { computeEffectiveFrontmatterMode } from '@/lib/graph/frontmatterMode'
import { buildGraphMetaKey, buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'
import { buildActive2dZoomViewKey } from '@/lib/canvas/active-2d-zoom-view-key'
import { buildSchemaLayoutEngineJson2d } from '@/lib/canvas/schema-layout-engine-json'
import { CANVAS_INTERACTIVE_CLASS, CANVAS_SURFACE_CLASS } from '@/lib/canvas/surface'
import { shouldIgnoreCanvasWheelEvent } from '@/lib/canvas/wheel-target-guard'
import { UI_SELECTORS } from '@/lib/config'
import { deriveSceneDisplayGraph, deriveSceneGroups } from '@/lib/scene/sceneDerivation'
import { buildCollapsedGroupIdsKey } from '@/lib/canvas/collapsedGroupIdsKey'
import { computeCenteredTransformToWorldPoint } from '@/lib/canvas/centerTransform'
import { computeEvenlyDistributedPositions } from '@/lib/canvas/evenDistribute'
import { computeArrangeCenters, type ArrangeAction2d } from '@/lib/canvas/arrange2d'
import { isEditableTarget, readArrangeShortcut, readNudgeDelta } from '@/lib/canvas/arrangeShortcuts'
import { readElementLocalPoint } from '@/lib/canvas/canvas-event-coords'
import { invertZoomPoint } from '@/lib/canvas/viewport-transform'
import { getNodeHalfExtents2d } from '@/components/GraphCanvas/nodeSizing2d'
import { disableAutoZoomModesForUserGesture } from '@/lib/canvas/auto-zoom-modes'
import { clampCanvasInteractionSpeedMultiplier, clampCanvasPanSpeedMultiplier } from '@/lib/canvas/camera-options-2d'
import { applyPanelBox } from '@/lib/render/mediaPanelLayout'
import { listMediaOverlayNodes } from '@/lib/render/mediaOverlayPool'
import { readNodeCenterWorld2d } from '@/lib/render/mediaAnchor'
import { startMediaOverlayLayoutLoop2d } from '@/lib/render/mediaOverlayLayoutLoop2d'
import RichMediaPanel from '@/components/RichMediaPanel'
import { MarkdownDesignOverlay } from '@/features/markdown-edgeless/MarkdownDesignOverlay'
import { emitMarkdownPanelMetric } from '@/features/metrics/uiMetrics'
import { getNodeMediaSpec } from '@/components/GraphCanvas/helpers'
import { lockGlobalUserSelect, unlockGlobalUserSelect } from '@/lib/canvas/interaction-user-select'
import { isSpacePanHeld } from '@/lib/canvas/space-pan'
import { InfiniteGridCanvasOverlay } from '@/components/InfiniteGridCanvasOverlay'
import { readSnapGridConfigFromSchema, snapPointToGrid, snapScalarToGrid } from '@/lib/canvas/gridSnap'
import { readCanvasGridConfigFromSchema, readCanvasGridWorldStepFromSchema } from '@/lib/canvas/canvasGridConfig'
import { createRafLatestScheduler } from '@/lib/react/rafLatestScheduler'
import { useMediaQuery } from '@/lib/ui/useMediaQuery'

export default function GraphCanvas({ active = true }: { active?: boolean }) {
  const containerRef = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const coarsePointer = useMediaQuery('(pointer: coarse)')
  const isEmbeddedPreview = useMemo(() => {
    try {
      const q = new URLSearchParams(String(window.location.search || '')).get('kgPreview') === '1'
      if (q) return true
      const w = window as unknown as { frameElement?: Element | null; parent?: Window | null }
      const parent = w?.parent
      if (!parent || parent === window) return false
      const frameEl = w?.frameElement
      if (!frameEl) return false
      return String(frameEl.getAttribute('data-kg-preview') || '') === '1'
    } catch {
      return false
    }
  }, [])
  const lastLayoutModeRef = useRef<null | 'force' | 'radial'>(null);
  const lastFrontmatterModeRef = useRef<boolean | null>(null);
  const lastSemanticModeRef = useRef<string | null>(null)
  const lastLayoutVariantRef = useRef<string | null>(null)
  const lastDatasetKeyRef = useRef<string | null>(null)
  const lastLayoutViewKeyRef = useRef<string | null>(null)
  const activeRef = useRef<boolean>(true)
  activeRef.current = !!active
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const nodesSelRef = useRef<d3.Selection<SVGElement, GraphNode, SVGGElement, unknown> | null>(null);
  const groupChevronSelRef = useRef<d3.Selection<SVGPathElement, GraphNode, SVGGElement, unknown> | null>(null)
  const mediaSelRef = useRef<d3.Selection<SVGGraphicsElement, GraphNode, SVGGElement, unknown> | null>(null);
  const portHandlesSelRef =
    useRef<d3.Selection<SVGCircleElement, PortHandleDatum, SVGGElement, unknown> | null>(null);
  const linksHitSelRef = useRef<d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown> | null>(null);
  const linksSelRef = useRef<d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown> | null>(null);
  const labelsSelRef = useRef<d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(null);
  const sceneGraphDataRef = useRef<GraphData | null>(null);
  const beforeRenderFrameRef = useRef<(() => void) | null>(null);
  const beforeRenderFrameWrappedSourceRef = useRef<(() => void) | null>(null)
  const nodesPresentationAppliedKeyRef = useRef<string | null>(null);
  const groupsPresentationAppliedKeyRef = useRef<string | null>(null);
  const sceneCleanupRef = useRef<null | (() => void)>(null)
  const sceneBuildKeyRef = useRef<string | null>(null)
  const activeLayoutCacheKeyRef = useRef<string | null>(null)

  useEffect(() => {
    ensureSpacePanKeyListenerInstalled()
  }, [])

  useEffect(() => {
    const el = svgRef.current
    if (!el) return

    const shouldIgnore = (target: EventTarget | null, e: WheelEvent | TouchEvent) => {
      const eventTarget = (target || null) as Element | null
      if (eventTarget && eventTarget.closest(UI_SELECTORS.canvasWheelIgnore)) return true
      const isWheel = typeof (e as WheelEvent).deltaY === 'number'
      if (isWheel) return shouldIgnoreCanvasWheelEvent({ event: e as WheelEvent, ignoreSelector: UI_SELECTORS.canvasWheelIgnore })
      return false
    }

    const onWheel = (e: WheelEvent) => {
      if (!activeRef.current) return
      if (shouldIgnore(e.target, e)) return
      try {
        e.preventDefault()
      } catch {
        void 0
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!activeRef.current) return
      if (shouldIgnore(e.target, e)) return
      if (!e.touches || e.touches.length <= 0) return
      try {
        e.preventDefault()
      } catch {
        void 0
      }
    }

    const onGesture = (e: Event) => {
      if (!activeRef.current) return
      try {
        e.preventDefault()
      } catch {
        void 0
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false, capture: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false, capture: true })
    el.addEventListener('gesturestart', onGesture as EventListener, { passive: false, capture: true })
    el.addEventListener('gesturechange', onGesture as EventListener, { passive: false, capture: true })
    el.addEventListener('gestureend', onGesture as EventListener, { passive: false, capture: true })
    return () => {
      el.removeEventListener('wheel', onWheel, true)
      el.removeEventListener('touchmove', onTouchMove, true)
      el.removeEventListener('gesturestart', onGesture as EventListener, true)
      el.removeEventListener('gesturechange', onGesture as EventListener, true)
      el.removeEventListener('gestureend', onGesture as EventListener, true)
    }
  }, [])
  const {
    graphDataRevision,
    setCanvasDims,
    setCanvasPos,
    schema,
    renderMediaAsNodes,
    mediaPanelDensity,
    threeIframeOverlayPoolMax,
    threeIframeOverlayBaseWidthRatioDefault,
    threeIframeOverlayBaseWidthRatioCompact,
    threeIframeOverlayBaseWidthMinPxDefault,
    threeIframeOverlayBaseWidthMinPxCompact,
    threeIframeOverlayBaseWidthMaxPxDefault,
    threeIframeOverlayBaseWidthMaxPxCompact,
    setLayoutPositionsForMode,
    frontmatterModeEnabled,
    multiDimTableModeEnabled,
    documentSemanticMode,
    documentStructureBaselineLock,
    canvasRenderMode,
    canvas2dRenderer,
    viewportControlsPreset,
    collapsedGroupIds,
    viewPinned,
    zoomState,
    fitToScreenMode,
    zoomToSelectionMode,
    graphCanvasArrangeRequest,
    clearGraphCanvasArrangeRequest,
    selectedNodeId,
    selectedNodeIds,
    markdownDocumentName,
    markdownDocumentText,
  } = useGraphStore(
    useShallow((s) => ({
      graphDataRevision: s.graphDataRevision,
      setCanvasDims: s.setCanvasDims,
      setCanvasPos: s.setCanvasPos,
      schema: s.schema,
      renderMediaAsNodes: s.renderMediaAsNodes,
      mediaPanelDensity: s.mediaPanelDensity,
      threeIframeOverlayPoolMax: s.threeIframeOverlayPoolMax,
      threeIframeOverlayBaseWidthRatioDefault: s.threeIframeOverlayBaseWidthRatioDefault,
      threeIframeOverlayBaseWidthRatioCompact: s.threeIframeOverlayBaseWidthRatioCompact,
      threeIframeOverlayBaseWidthMinPxDefault: s.threeIframeOverlayBaseWidthMinPxDefault,
      threeIframeOverlayBaseWidthMinPxCompact: s.threeIframeOverlayBaseWidthMinPxCompact,
      threeIframeOverlayBaseWidthMaxPxDefault: s.threeIframeOverlayBaseWidthMaxPxDefault,
      threeIframeOverlayBaseWidthMaxPxCompact: s.threeIframeOverlayBaseWidthMaxPxCompact,
      setLayoutPositionsForMode: s.setLayoutPositionsForMode,
      frontmatterModeEnabled: s.frontmatterModeEnabled || false,
      multiDimTableModeEnabled: (s as unknown as { multiDimTableModeEnabled?: unknown }).multiDimTableModeEnabled === true,
      documentSemanticMode: (s.documentSemanticMode || 'document') as 'document' | 'keyword',
      documentStructureBaselineLock: s.documentStructureBaselineLock === true,
      canvasRenderMode: s.canvasRenderMode,
      canvas2dRenderer: s.canvas2dRenderer,
      viewportControlsPreset: s.viewportControlsPreset,
      collapsedGroupIds: s.collapsedGroupIds || [],
      viewPinned: s.viewPinned === true,
      zoomState: s.zoomState || null,
      fitToScreenMode: s.fitToScreenMode === true,
      zoomToSelectionMode: s.zoomToSelectionMode === true,
      graphCanvasArrangeRequest: s.graphCanvasArrangeRequest,
      clearGraphCanvasArrangeRequest: s.clearGraphCanvasArrangeRequest,
      selectedNodeId: s.selectedNodeId,
      selectedNodeIds: s.selectedNodeIds,
      markdownDocumentName: s.markdownDocumentName,
      markdownDocumentText: s.markdownDocumentText,
    })),
  );

  const layoutSemanticModeKey = useMemo(() => {
    const base = String(documentSemanticMode || 'document')
    return multiDimTableModeEnabled ? `${base}:mdtbl` : base
  }, [documentSemanticMode, multiDimTableModeEnabled])

  const prevCanvasRenderModeRef = useRef<'2d' | '3d'>(canvasRenderMode)
  const prevRenderVariantRef = useRef<string>(canvasRenderMode === '2d' ? String(canvas2dRenderer || '') : '')
  const lastKnownZoomTransformRef = useRef<{ k: number; x: number; y: number } | null>(null)
  const registerCanvasSnapshotFns = useGraphStore(s => s.registerCanvasSnapshotFns);
  const selectedNodeIdRef = useGraphStoreKeyRef('selectedNodeId')
  const selectedEdgeIdRef = useGraphStoreKeyRef('selectedEdgeId')
  const selectedNodeIdsRef = useGraphStoreKeyRef('selectedNodeIds')
  const selectedEdgeIdsRef = useGraphStoreKeyRef('selectedEdgeIds')
  const graphDataRevisionRef = useGraphStoreKeyRef('graphDataRevision')
  const [marqueeBox, setMarqueeBox] = useState<null | { left: number; top: number; width: number; height: number }>(null)
  const marqueeRef = useRef<
    null | { start: { sx: number; sy: number }; end: { sx: number; sy: number }; mode: 'replace' | 'add' | 'remove'; pointerId: number }
  >(null)
  const zoomCommitParamsRef = useRef<{ zoomViewKey: string; viewportW: number; viewportH: number; graphDataRevision: number }>({
    zoomViewKey: '',
    viewportW: 0,
    viewportH: 0,
    graphDataRevision: 0,
  })
  const zoomCommitSchedulerRef = useRef(
    createRafLatestScheduler<{ k: number; x: number; y: number }>((transform) => {
      const params = zoomCommitParamsRef.current
      if (!params.zoomViewKey) return
      const store = useGraphStore.getState()
      commitZoomTransformToStore({
        state: {
          viewPinned: store.viewPinned === true,
          zoomState: store.zoomState,
          zoomStateByKey: store.zoomStateByKey,
          setZoomState: store.setZoomState,
          setZoomStateForKey: store.setZoomStateForKey,
        },
        zoomViewKey: params.zoomViewKey,
        transform,
        viewportW: params.viewportW,
        viewportH: params.viewportH,
        graphDataRevision: params.graphDataRevision,
      })
    }),
  )
  const schemaRef = useRef(schema)
  const iframeOverlayElsRef = useRef<Map<string, HTMLElement>>(new Map())
  const iframeNodeByIdRef = useRef<{ rev: number; sim: unknown | null; map: Map<string, GraphNode> }>({ rev: -1, sim: null, map: new Map() })
  const mediaOverlayScheduleRef = useRef<(() => void) | null>(null)
  const mediaOverlayScheduleRafRef = useRef<number | null>(null)
  const mediaOverlaySchedulePendingRef = useRef<boolean>(false)
  const iframeOverlayRefFnByIdRef = useRef<Map<string, (el: HTMLDivElement | null) => void>>(new Map())
  const requestMediaOverlaySchedule = useCallback(() => {
    const schedule = mediaOverlayScheduleRef.current
    if (schedule) {
      schedule()
      return
    }
    mediaOverlaySchedulePendingRef.current = true
    if (mediaOverlayScheduleRafRef.current != null) return
    mediaOverlayScheduleRafRef.current = requestAnimationFrame(() => {
      mediaOverlayScheduleRafRef.current = null
      try {
        mediaOverlayScheduleRef.current?.()
      } catch {
        void 0
      }
    })
  }, [])

  const stopEvent = React.useCallback((event: React.SyntheticEvent) => {
    try {
      event.stopPropagation()
    } catch {
      void 0
    }
  }, [])

  const mediaHeaderDragRef = useRef<null | { id: string; baseX: number; baseY: number; structured: boolean; frozen: boolean }>(null)
  const mediaOverlayPanRef = useRef<null | { pointerId: number; startClientX: number; startClientY: number; startTransform: d3.ZoomTransform }>(null)

  const beginMediaHeaderDrag = React.useCallback((id: string, clientX: number, clientY: number) => {
    if (!activeRef.current) return
    if (useGraphStore.getState().canvasPointerMode2d === 'pan') return
    if (isSpacePanHeld()) return
    const svgEl = svgRef.current
    if (!svgEl) return
    const sim = simulationRef.current
    const graph = sceneGraphDataRef.current
    const nodes = sim ? (sim.nodes() as unknown as GraphNode[]) : Array.isArray(graph?.nodes) ? (graph!.nodes as GraphNode[]) : []
    let node: GraphNode | null = null
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      if (String(n?.id || '') === id) {
        node = n
        break
      }
    }
    if (!node) return
    const x0 = typeof node.x === 'number' && Number.isFinite(node.x) ? node.x : 0
    const y0 = typeof node.y === 'number' && Number.isFinite(node.y) ? node.y : 0
    const mode = readLayoutMode(schemaRef.current)
    const structured = mode === 'radial'
    const frozen = svgEl.getAttribute('data-kg-layout-frozen') === '1'
    lockGlobalUserSelect()
    mediaHeaderDragRef.current = { id, baseX: x0, baseY: y0, structured, frozen }
    if (sim && !structured && !frozen) {
      try {
        sim.alphaTarget(DEFAULT_DRAG_ALPHA_TARGET).restart()
      } catch {
        void 0
      }
    }
    node.fx = x0
    node.fy = y0
    void clientX
    void clientY
  }, [])

  const moveMediaHeaderDrag = React.useCallback((dx: number, dy: number) => {
    const st = mediaHeaderDragRef.current
    if (!st) return
    if (useGraphStore.getState().canvasPointerMode2d === 'pan') return
    if (isSpacePanHeld()) return
    const svgEl = svgRef.current
    if (!svgEl) return
    const sim = simulationRef.current
    const graph = sceneGraphDataRef.current
    const nodes = sim ? (sim.nodes() as unknown as GraphNode[]) : Array.isArray(graph?.nodes) ? (graph!.nodes as GraphNode[]) : []
    let node: GraphNode | null = null
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      if (String(n?.id || '') === st.id) {
        node = n
        break
      }
    }
    if (!node) return
    const t = d3.zoomTransform(svgEl as unknown as SVGSVGElement)
    const k = typeof t.k === 'number' && Number.isFinite(t.k) && t.k > 0 ? t.k : 1
    const nx = st.baseX + dx / k
    const ny = st.baseY + dy / k
    const constraint = schemaRef.current.behavior.dragConstraint || 'free'
    const grid = readSnapGridConfigFromSchema(schemaRef.current)
    const snapped = grid.enabled ? snapPointToGrid({ x: nx, y: ny }, grid.size) : { x: nx, y: ny }
    const snapX = snapped.x
    const snapY = snapped.y
    if (constraint === 'axis-x') {
      node.fx = snapX
      if (st.structured || st.frozen) node.x = snapX
    } else if (constraint === 'axis-y') {
      node.fy = snapY
      if (st.structured || st.frozen) node.y = snapY
    } else if (constraint === 'none') {
      node.fx = st.baseX
      node.fy = st.baseY
    } else {
      node.fx = snapX
      node.fy = snapY
      if (st.structured || st.frozen) {
        node.x = snapX
        node.y = snapY
      }
    }
    node.vx = 0
    node.vy = 0
    if (st.structured || st.frozen) {
      try {
        const tickHandler = sim?.on('tick')
        if (typeof tickHandler === 'function') {
          ;(tickHandler as unknown as () => void)()
        }
      } catch {
        void 0
      }
    }
    try {
      requestMediaOverlaySchedule()
    } catch {
      void 0
    }
  }, [requestMediaOverlaySchedule])

  const endMediaHeaderDrag = React.useCallback(() => {
    const st = mediaHeaderDragRef.current
    if (!st) return
    mediaHeaderDragRef.current = null
    unlockGlobalUserSelect()
    const svgEl = svgRef.current
    const sim = simulationRef.current
    const graph = sceneGraphDataRef.current
    const nodes = sim ? (sim.nodes() as unknown as GraphNode[]) : Array.isArray(graph?.nodes) ? (graph!.nodes as GraphNode[]) : []
    let node: GraphNode | null = null
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      if (String(n?.id || '') === st.id) {
        node = n
        break
      }
    }
    if (sim && !st.structured && !st.frozen) {
      try {
        sim.alphaTarget(0)
      } catch {
        void 0
      }
      if (node) {
        node.fx = null
        node.fy = null
      }
    }
    if (node) {
      const x = typeof node.x === 'number' && Number.isFinite(node.x) ? node.x : (typeof node.fx === 'number' ? node.fx : null)
      const y = typeof node.y === 'number' && Number.isFinite(node.y) ? node.y : (typeof node.fy === 'number' ? node.fy : null)
      if (x != null && y != null && useGraphStore.getState().workspaceViewMode === 'editor') {
        try {
          useGraphStore.getState().updateNode(st.id, { x, y })
        } catch {
          void 0
        }
      }
    }
    void svgEl
  }, [])

  const startMediaOverlayPan = React.useCallback((args: { pointerId: number; clientX: number; clientY: number }) => {
    if (!activeRef.current) return
    const svgEl = svgRef.current
    const zoom = zoomRef.current
    if (!svgEl || !zoom) return
    try {
      d3.select(svgEl).interrupt()
    } catch {
      void 0
    }
    const st = useGraphStore.getState()
    disableAutoZoomModesForUserGesture(st)
    mediaOverlayPanRef.current = {
      pointerId: args.pointerId,
      startClientX: args.clientX,
      startClientY: args.clientY,
      startTransform: d3.zoomTransform(svgEl),
    }
  }, [])

  const moveMediaOverlayPan = React.useCallback((args: { pointerId: number; clientX: number; clientY: number; dx: number; dy: number }) => {
    const drag = mediaOverlayPanRef.current
    if (!drag || drag.pointerId !== args.pointerId) return
    const svgEl = svgRef.current
    const zoom = zoomRef.current
    if (!svgEl || !zoom) return
    const st = useGraphStore.getState()
    disableAutoZoomModesForUserGesture(st)
    const interactionSpeed =
      clampCanvasPanSpeedMultiplier(st.canvasPanSpeedMultiplier) * clampCanvasInteractionSpeedMultiplier(st.canvasInteractionSpeedMultiplier)
    const dx = args.dx * interactionSpeed
    const dy = args.dy * interactionSpeed
    const next = d3.zoomIdentity.translate(drag.startTransform.x + dx, drag.startTransform.y + dy).scale(drag.startTransform.k)
    d3.select(svgEl).call(
      zoom.transform as unknown as (sel: d3.Selection<SVGSVGElement, unknown, null, undefined>, t: d3.ZoomTransform) => void,
      next,
    )
  }, [])

  const endMediaOverlayPan = React.useCallback((args: { pointerId: number }) => {
    const drag = mediaOverlayPanRef.current
    if (!drag || drag.pointerId !== args.pointerId) return
    mediaOverlayPanRef.current = null
  }, [])

  const schemaLayoutEngineJson = useMemo(() => buildSchemaLayoutEngineJson2d(schema), [schema])

  const schemaNodesPresentationJson = useMemo(() => {
    return JSON.stringify({
      nodeShapeMode: schema?.behavior?.nodeShapeMode || 'auto',
      portHandles: schema?.behavior?.portHandles || null,
      nodeShapes: schema?.nodeShapes || null,
      allowNodeDrag: schema?.behavior?.allowNodeDrag !== false,
      hoverEnabled: schema?.behavior?.hover?.enabled !== false,
      expansion: schema?.behavior?.expansion || null,
      renderMediaAsNodes,
      mediaPanelDensity,
    })
  }, [
    schema?.behavior?.nodeShapeMode,
    schema?.behavior?.portHandles,
    schema?.nodeShapes,
    schema?.behavior?.allowNodeDrag,
    schema?.behavior?.hover?.enabled,
    schema?.behavior?.expansion,
    renderMediaAsNodes,
    mediaPanelDensity,
  ])

  const schemaGroupsPresentationJson = useMemo(() => {
    return JSON.stringify({
      groups: schema?.layout?.groups || null,
      labelStyles: schema?.labelStyles || null,
      nodeShapeMode: schema?.behavior?.nodeShapeMode || 'auto',
      portHandles: schema?.behavior?.portHandles || null,
    })
  }, [
    schema?.layout?.groups,
    schema?.labelStyles,
    schema?.behavior?.nodeShapeMode,
    schema?.behavior?.portHandles,
  ])

  const renderGraphData = useActiveGraphRenderData(active)
  const effectiveFrontmatterModeEnabled = useMemo(() => {
    return computeEffectiveFrontmatterMode({
      frontmatterModeEnabled: frontmatterModeEnabled === true,
      documentSemanticMode,
      graphData: renderGraphData,
    })
  }, [documentSemanticMode, frontmatterModeEnabled, renderGraphData])

  const collapsedGroupIdsKey = useMemo(() => {
    return buildCollapsedGroupIdsKey(collapsedGroupIds)
  }, [collapsedGroupIds])

  const clonedGraphData = useMemo(() => {
    if (!renderGraphData) return null
    return cloneGraphDataForRender(renderGraphData) as GraphData
  }, [renderGraphData])

  const sceneDisplayGraphDerivation = useMemo(() => {
    if (!clonedGraphData) return null
    return deriveSceneDisplayGraph({ graphData: clonedGraphData })
  }, [clonedGraphData])

  const sceneGraphData = useMemo(() => {
    if (!clonedGraphData) return null
    return sceneDisplayGraphDerivation?.displayGraphData || clonedGraphData
  }, [clonedGraphData, sceneDisplayGraphDerivation])

  const sceneGroupsDerivation = useMemo(() => {
    return deriveSceneGroups({
      graphData: clonedGraphData,
      graphDataRevision: graphDataRevision || 0,
      schema,
      documentSemanticMode: String(documentSemanticMode || ''),
      frontmatterModeEnabled: !!effectiveFrontmatterModeEnabled,
    })
  }, [clonedGraphData, documentSemanticMode, effectiveFrontmatterModeEnabled, graphDataRevision, schema])

  useEffect(() => {
    schemaRef.current = schema
  }, [schema])
  const { width, height, left, top, dpr } = useContainerDims(containerRef);

  const canvasGrid = useMemo(() => readCanvasGridConfigFromSchema(schema), [schema])
  const canvasGridStep = useMemo(() => readCanvasGridWorldStepFromSchema(schema), [schema])
  const getZoomTransform = useCallback(() => {
    const el = svgRef.current
    if (!el) return null
    return d3.zoomTransform(el)
  }, [])
  const getZoomEventTarget = useCallback(() => svgRef.current, [])

  const debouncedWidth = useDebouncedValue(width, 100);
  const debouncedHeight = useDebouncedValue(height, 100);
  const sceneWidth = useMemo(() => Math.max(1, Math.floor(debouncedWidth)), [debouncedWidth]);
  const sceneHeight = useMemo(() => Math.max(1, Math.floor(debouncedHeight)), [debouncedHeight]);
  const tempLinkSelRef = useRef<TempLinkSelection>(null);
  const linkDragRef = useRef<PendingLink | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const lastCanvasLayoutRef = useRef<null | { w: number; h: number; x: number; y: number }>(null)

  const mediaOverlayNodes = useMemo(() => {
    const nodes = Array.isArray(sceneGraphData?.nodes) ? (sceneGraphData!.nodes as GraphNode[]) : []
    const poolMaxRaw = typeof threeIframeOverlayPoolMax === 'number' && Number.isFinite(threeIframeOverlayPoolMax) ? threeIframeOverlayPoolMax : 0
    const poolMax = poolMaxRaw > 0 ? poolMaxRaw : 24
    const st = useGraphStore.getState() as unknown as { selectedNodeId?: unknown; selectedNodeIds?: unknown }
    const preferredNodeIds = [st.selectedNodeId, ...(Array.isArray(st.selectedNodeIds) ? st.selectedNodeIds : [])]
    return listMediaOverlayNodes({ enabled: true, nodes, poolMax, preferredNodeIds })
  }, [sceneGraphData, threeIframeOverlayPoolMax])

  const { mediaOverlayNodeIdsKey, mediaOverlayNodeIdSet } = useMemo(() => {
    const ids = mediaOverlayNodes.map(n => n.id)
    const sortedIds = ids.length <= 1 ? ids : ids.slice().sort()
    return {
      mediaOverlayNodeIdsKey: sortedIds.join('|'),
      mediaOverlayNodeIdSet: new Set(sortedIds),
    }
  }, [mediaOverlayNodes])
  useEffect(() => {
    const anyImportMeta = import.meta as unknown as { env?: { DEV?: boolean } }
    if (!anyImportMeta.env?.DEV) return
    if (!active) return
    const nodes = Array.isArray(sceneGraphData?.nodes) ? (sceneGraphData!.nodes as GraphNode[]) : []
    let specCount = 0
    let iframeCount = 0
    let imageCount = 0
    let videoCount = 0
    let svgCount = 0
    for (let i = 0; i < nodes.length; i += 1) {
      const spec = getNodeMediaSpec(nodes[i]!)
      if (!spec) continue
      specCount += 1
      if (spec.kind === 'iframe') iframeCount += 1
      else if (spec.kind === 'image') imageCount += 1
      else if (spec.kind === 'video') videoCount += 1
      else if (spec.kind === 'svg') svgCount += 1
    }
    emitMarkdownPanelMetric('canvas.2d.d3.richMedia.pool', {
      enabled: renderMediaAsNodes === true,
      nodes: nodes.length,
      mediaSpecCount: specCount,
      iframeCount,
      imageCount,
      videoCount,
      svgCount,
      overlayPoolSize: mediaOverlayNodes.length,
      overlayIds: mediaOverlayNodes.slice(0, 6).map(n => n.id),
      poolMaxRaw: threeIframeOverlayPoolMax,
    })
  }, [active, mediaOverlayNodeIdsKey, mediaOverlayNodes, renderMediaAsNodes, sceneGraphData, threeIframeOverlayPoolMax])
  useEffect(() => {
    return () => {
      const raf = mediaOverlayScheduleRafRef.current
      if (raf == null) return
      mediaOverlayScheduleRafRef.current = null
      try {
        cancelAnimationFrame(raf)
      } catch {
        void 0
      }
    }
  }, [])
  useEffect(() => {
    const next = new Map<string, HTMLElement>()
    for (const n of mediaOverlayNodes) {
      const existing = iframeOverlayElsRef.current.get(n.id)
      if (existing) next.set(n.id, existing)
    }
    iframeOverlayElsRef.current = next
    const keep = new Set<string>(mediaOverlayNodes.map(n => n.id))
    const refMap = iframeOverlayRefFnByIdRef.current
    for (const [id] of refMap) {
      if (!keep.has(id)) refMap.delete(id)
    }
  }, [mediaOverlayNodeIdsKey, mediaOverlayNodes])

  const getOverlayRefForId = useCallback((id: string) => {
    const key = String(id || '').trim()
    if (!key) return () => void 0
    const cached = iframeOverlayRefFnByIdRef.current.get(key)
    if (cached) return cached
    const fn = (el: HTMLElement | null) => {
      if (!el) {
        iframeOverlayElsRef.current.delete(key)
        return
      }
      const prev = iframeOverlayElsRef.current.get(key)
      if (prev === el) return
      iframeOverlayElsRef.current.set(key, el)
      try {
        applyPanelBox(el, { left: -99999, top: -99999, w: 1, h: 1, display: 'block', zIndex: 1 })
      } catch {
        void 0
      }
      try {
        requestMediaOverlaySchedule()
      } catch {
        void 0
      }
    }
    iframeOverlayRefFnByIdRef.current.set(key, fn)
    return fn
  }, [requestMediaOverlaySchedule])

  useEffect(() => {
    mediaOverlayScheduleRef.current = null
    if (!active) return
    if (mediaOverlayNodes.length === 0) return
    const density = mediaPanelDensity === 'compact' ? 'compact' : 'default'
    const widthRatioRaw = density === 'compact' ? threeIframeOverlayBaseWidthRatioCompact : threeIframeOverlayBaseWidthRatioDefault
    const widthMinRaw = density === 'compact' ? threeIframeOverlayBaseWidthMinPxCompact : threeIframeOverlayBaseWidthMinPxDefault
    const widthMaxRaw = density === 'compact' ? threeIframeOverlayBaseWidthMaxPxCompact : threeIframeOverlayBaseWidthMaxPxDefault

    const loop = startMediaOverlayLayoutLoop2d({
      enabled: true,
      loop: 'always',
      items: mediaOverlayNodes,
      density,
      viewportW: sceneWidth,
      viewportH: sceneHeight,
      readTransform: () => {
        const svgEl = svgRef.current
        if (!svgEl) return null
        return d3.zoomTransform(svgEl as unknown as SVGSVGElement)
      },
      getElementForId: (id) => iframeOverlayElsRef.current.get(id) || null,
      getNodeWorldCenterForId: (id) => {
        const graph = sceneGraphDataRef.current
        const sim = simulationRef.current
        const simNodes = sim ? (sim.nodes() as unknown as GraphNode[]) : []
        const graphNodes = Array.isArray(graph?.nodes) ? (graph!.nodes as GraphNode[]) : []
        const rev = typeof graphDataRevision === 'number' && Number.isFinite(graphDataRevision) ? graphDataRevision : 0
        if (iframeNodeByIdRef.current.rev !== rev || iframeNodeByIdRef.current.sim !== sim) {
          const map = new Map<string, GraphNode>()
          for (let i = 0; i < graphNodes.length; i += 1) {
            const n = graphNodes[i]
            const key = String(n?.id || '').trim()
            if (!key) continue
            map.set(key, n)
          }
          for (let i = 0; i < simNodes.length; i += 1) {
            const n = simNodes[i]
            const key = String(n?.id || '').trim()
            if (!key) continue
            map.set(key, n)
          }
          iframeNodeByIdRef.current = { rev, sim: sim || null, map }
        }
        const n = iframeNodeByIdRef.current.map.get(id) || null
        return readNodeCenterWorld2d(n, { coords: 'center' })
      },
      sizingConfig: {
        widthRatio: Number.isFinite(widthRatioRaw) ? Math.max(0.001, Number(widthRatioRaw)) : 0.2,
        widthMinPx: Number.isFinite(widthMinRaw) ? Math.max(1, Math.floor(widthMinRaw)) : 210,
        widthMaxPx: Number.isFinite(widthMaxRaw) ? Math.max(1, Math.floor(widthMaxRaw)) : 360,
      },
    })

    mediaOverlayScheduleRef.current = loop.schedule
    if (mediaOverlaySchedulePendingRef.current) {
      mediaOverlaySchedulePendingRef.current = false
      loop.schedule()
    }

    return () => {
      loop.stop()
      if (mediaOverlayScheduleRef.current === loop.schedule) {
        mediaOverlayScheduleRef.current = null
      }
    }
  }, [
    active,
    graphDataRevision,
    mediaOverlayNodes,
    mediaOverlayNodeIdsKey,
    mediaPanelDensity,
    sceneWidth,
    sceneHeight,
    threeIframeOverlayBaseWidthRatioCompact,
    threeIframeOverlayBaseWidthRatioDefault,
    threeIframeOverlayBaseWidthMaxPxCompact,
    threeIframeOverlayBaseWidthMaxPxDefault,
    threeIframeOverlayBaseWidthMinPxCompact,
    threeIframeOverlayBaseWidthMinPxDefault,
  ])

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onContextMenu = (ev: MouseEvent) => {
      if (ev.defaultPrevented) return;
      ev.preventDefault();
      const state = useGraphStore.getState()
      state.setSelectionSource('menu')
      state.selectNode(null)
      state.selectEdge(null)
      emitPropsPanelOpen({ clientX: ev.clientX, clientY: ev.clientY });
    };
    el.addEventListener('contextmenu', onContextMenu);
    return () => {
      el.removeEventListener('contextmenu', onContextMenu);
    };
  }, []);

  useEffect(() => {
    if (schema.behavior?.hover?.enabled === false) {
      setHoverInfo(null);
    }
  }, [schema.behavior?.hover?.enabled]);

  useEffect(() => {
    const next = {
      w: Math.max(1, Math.floor(width)),
      h: Math.max(1, Math.floor(height)),
      x: left,
      y: top,
    }
    const prev = lastCanvasLayoutRef.current
    if (prev && prev.w === next.w && prev.h === next.h && prev.x === next.x && prev.y === next.y) return
    lastCanvasLayoutRef.current = next
    if (!prev || prev.w !== next.w || prev.h !== next.h) setCanvasDims({ w: next.w, h: next.h })
    if (!prev || prev.x !== next.x || prev.y !== next.y) setCanvasPos({ x: next.x, y: next.y })
  }, [width, height, left, top, setCanvasDims, setCanvasPos]);

  useEffect(() => {
    if (!viewPinned) return
    if (!svgRef.current) return
    if (!gRef.current) return
    if (!zoomRef.current) return
    try {
      const t = d3.zoomTransform(svgRef.current)
      const st = useGraphStore.getState()
      const zoomViewKey = buildActive2dZoomViewKey({
        canvasRenderMode: st.canvasRenderMode,
        canvas2dRenderer: st.canvas2dRenderer,
        schema: st.schema,
        graphData: st.graphData,
        documentSemanticMode: st.documentSemanticMode,
        frontmatterModeEnabled: st.frontmatterModeEnabled,
        documentStructureBaselineLock: st.documentStructureBaselineLock,
        renderMediaAsNodes: st.renderMediaAsNodes,
        mediaPanelDensity: st.mediaPanelDensity,
        collapsedGroupIds: st.collapsedGroupIds,
      })
      const seeded = {
        k: t.k,
        x: t.x,
        y: t.y,
        graphDataRevision: undefined,
        viewportW: sceneWidth,
        viewportH: sceneHeight,
      }
      if (!st.zoomState) st.setZoomState(seeded)
      if (zoomViewKey && !st.zoomStateByKey?.[zoomViewKey]) {
        st.setZoomStateForKey(zoomViewKey, seeded)
      }
    } catch {
      void 0
    }
  }, [viewPinned, zoomState, sceneWidth, sceneHeight])

  useEffect(() => {
    if (!active) return
    if (fitToScreenMode || zoomToSelectionMode) return
    if (!svgRef.current) return
    if (!zoomRef.current) return
    try {
      const t = d3.zoomTransform(svgRef.current)
      const hasNonIdentityTransform = t.k !== 1 || t.x !== 0 || t.y !== 0
      if (!hasNonIdentityTransform) return
      const st = useGraphStore.getState()
      const zoomViewKey = buildActive2dZoomViewKey({
        canvasRenderMode: st.canvasRenderMode,
        canvas2dRenderer: st.canvas2dRenderer,
        schema: st.schema,
        graphData: st.graphData,
        documentSemanticMode: st.documentSemanticMode,
        frontmatterModeEnabled: st.frontmatterModeEnabled,
        documentStructureBaselineLock: st.documentStructureBaselineLock,
        renderMediaAsNodes: st.renderMediaAsNodes,
        mediaPanelDensity: st.mediaPanelDensity,
        collapsedGroupIds: st.collapsedGroupIds,
      })
      if (!zoomViewKey) return
      if (st.zoomStateByKey?.[zoomViewKey]) return
      const seeded = {
        k: t.k,
        x: t.x,
        y: t.y,
        graphDataRevision: undefined,
        viewportW: sceneWidth,
        viewportH: sceneHeight,
      }
      st.setZoomStateForKey(zoomViewKey, seeded)
      if (!st.zoomState) st.setZoomState(seeded)
    } catch {
      void 0
    }
  }, [
    active,
    canvas2dRenderer,
    canvasRenderMode,
    collapsedGroupIdsKey,
    documentSemanticMode,
    fitToScreenMode,
    frontmatterModeEnabled,
    mediaPanelDensity,
    renderMediaAsNodes,
    sceneHeight,
    sceneWidth,
    schemaLayoutEngineJson,
    zoomToSelectionMode,
  ])

  useEffect(() => {
    if (active) return
    try {
      simulationRef.current?.stop()
    } catch {
      void 0
    }
  }, [active])

  const prevActiveRef = useRef<boolean>(active)
  useEffect(() => {
    const prev = prevActiveRef.current
    prevActiveRef.current = active
    if (!prev || active) return
    const sel = nodesSelRef.current
    if (!sel) return

    const positions: Record<string, { x: number; y: number }> = {}
    sel.each((d: GraphNode) => {
      const id = String(d?.id || '').trim()
      const x = (d as unknown as { x?: unknown }).x
      const y = (d as unknown as { y?: unknown }).y
      if (!id) return
      if (typeof x !== 'number' || typeof y !== 'number') return
      if (!Number.isFinite(x) || !Number.isFinite(y)) return
      positions[id] = { x, y }
    })
    if (Object.keys(positions).length === 0) return

    const state = useGraphStore.getState()
    const schemaValue = schemaRef.current
    const mode = schemaValue ? readLayoutMode(schemaValue) : 'force'
    const semanticModeBase = String(state.documentSemanticMode || 'document')
    const semanticModeKey = state.multiDimTableModeEnabled === true ? `${semanticModeBase}:mdtbl` : semanticModeBase
    const graphDataForView = sceneGraphDataRef.current ?? ((state.graphData as unknown as import('@/lib/graph/types').GraphData | null) ?? null)
    const frontmatter = computeEffectiveFrontmatterMode({
      frontmatterModeEnabled: state.frontmatterModeEnabled === true,
      documentSemanticMode: semanticModeBase as 'document' | 'keyword',
      graphData: graphDataForView,
    })
    const datasetKey = computeLayoutDatasetKey({
      graphData: graphDataForView as unknown as { metadata?: unknown; nodes?: Array<{ type?: unknown; properties?: unknown; metadata?: unknown }> } | null,
      graphDataRevision: state.graphDataRevision || 0,
    })
    const layoutVariant = ''
    const graphMetaKey = buildGraphMetaKey(graphDataForView)
    const collapsedGroupIdsKey = (() => {
      return buildCollapsedGroupIdsKey(state.collapsedGroupIds)
    })()
    const schemaLayoutEngineJson = buildSchemaLayoutEngineJson2d(schemaValue)
    const viewKey = buildLayoutViewKey({
      schemaLayoutEngineJson,
      frontmatterModeEnabled: frontmatter,
      documentSemanticMode: semanticModeKey,
      graphMetaKey,
      renderMediaAsNodes: state.renderMediaAsNodes === true,
      mediaPanelDensity: String(state.mediaPanelDensity),
      collapsedGroupIdsKey,
    })
    const cacheKey = buildLayoutPositionCacheKey({
      datasetKey,
      mode,
      frontmatterMode: frontmatter,
      semanticMode: semanticModeKey,
      renderMode: '2d',
      viewKey,
      renderVariant: 'd3',
      layoutVariant,
    })

    try {
      state.setLayoutPositionsForMode(cacheKey, positions)
    } catch {
      void 0
    }
  }, [active])

  useEffect(() => {
    return () => {
      try {
        sceneCleanupRef.current?.()
      } catch {
        void 0
      } finally {
        sceneCleanupRef.current = null
        sceneBuildKeyRef.current = null
      }
    }
  }, [])

  useZoomEffects({
    svgRef,
    zoomRef,
    width,
    height,
    paused: !active,
    graphDataOverride: sceneGraphData,
  });

  useAutoZoomModes2d({
    viewportW: width,
    viewportH: height,
    paused: !active,
  })

  useEdgeCreationEffect({
    paused: !active,
    tempLinkSelRef,
    linkDragRef,
  });

  useEffect(() => {
    registerCanvasSnapshotFns('2d', svgRef.current ? create2dSvgSnapshotFns(svgRef) : null);
    return () => {
      registerCanvasSnapshotFns('2d', null);
    };
  }, [registerCanvasSnapshotFns]);

  useEffect(() => {
    if (active) return
    const sim = simulationRef.current
    if (!sim) return
    try {
      sim.alphaTarget(0)
      sim.stop()
    } catch {
      void 0
    }
  }, [active])

  const edgesForSim = useMemo(() => {
    const normalized = normalizeEdgesForSim(
      (sceneGraphData?.nodes ?? []) as GraphNode[],
      (sceneGraphData?.edges ?? []) as GraphEdge[],
    )
    return normalized
  }, [sceneGraphData])

  const flowState = useMemo(
    () => computeFlowState(sceneGraphData as GraphData | null),
    [sceneGraphData],
  );

  useEffect(() => {
    if (!active) return;
    if (!sceneGraphData || !svgRef.current) return;
    const schemaValue = schemaRef.current;
    if (!schemaValue) return;
    const hoverEnabled = schemaValue.behavior?.hover?.enabled !== false && !coarsePointer;
    const expansionCfg = schemaValue.behavior?.expansion || {};
    const expansionEnabled = expansionCfg.enabled !== false;
    const zoomOnDoubleClick = expansionEnabled && expansionCfg.zoomOnDoubleClick !== false;
    let rafId: number | null = null;
    rafId = requestAnimationFrame(() => {
      if (!svgRef.current) return;

      try {
        const t = d3.zoomTransform(svgRef.current as unknown as SVGSVGElement)
        lastKnownZoomTransformRef.current = {
          k: typeof t.k === 'number' && Number.isFinite(t.k) && t.k > 0 ? t.k : 1,
          x: typeof t.x === 'number' && Number.isFinite(t.x) ? t.x : 0,
          y: typeof t.y === 'number' && Number.isFinite(t.y) ? t.y : 0,
        }
      } catch {
        void 0
      }

      const buildKey = [
        String(graphDataRevisionRef.current ?? graphDataRevision),
        `${sceneWidth}x${sceneHeight}`,
        schemaLayoutEngineJson,
        String(effectiveFrontmatterModeEnabled ? 1 : 0),
        String(documentSemanticMode),
        buildGraphMetaKey(sceneGraphData),
        `${String(sceneGraphData?.nodes?.length ?? 0)}:${String(sceneGraphData?.edges?.length ?? 0)}`,
        String(renderMediaAsNodes ? 1 : 0),
        String(mediaPanelDensity),
        collapsedGroupIdsKey,
      ].join('|')

      if (sceneCleanupRef.current && sceneBuildKeyRef.current === buildKey) {
        return
      }

      const isMermaidLayout = (() => {
        const gd = sceneGraphData as unknown as { context?: unknown; metadata?: unknown } | null
        if (!gd) return false
        if (String(gd.context || '') === 'frontmatter-mermaid') return true
        const meta = gd.metadata
        if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return false
        return String((meta as Record<string, unknown>).layoutEngine || '') === 'mermaid'
      })()

      if (sceneCleanupRef.current) {
        try {
          const prevPositions: Record<string, { x: number; y: number }> = {}
          if (nodesSelRef.current) {
            nodesSelRef.current.each((d: GraphNode) => {
              if (d.id && typeof d.x === 'number' && typeof d.y === 'number' && Number.isFinite(d.x) && Number.isFinite(d.y)) {
                prevPositions[String(d.id)] = { x: d.x, y: d.y }
              }
            })
          }
          if (!isMermaidLayout && Object.keys(prevPositions).length > 0) {
            const state = useGraphStore.getState()
            const prevDatasetKey = lastDatasetKeyRef.current
            const prevMode = lastLayoutModeRef.current
            const prevFrontmatter = lastFrontmatterModeRef.current
            const prevSemantic = lastSemanticModeRef.current
            const prevViewKey = lastLayoutViewKeyRef.current
            if (prevDatasetKey && prevMode && prevFrontmatter != null && prevSemantic) {
              const key = buildLayoutPositionCacheKey({
                datasetKey: prevDatasetKey,
                mode: prevMode,
                frontmatterMode: prevFrontmatter,
                semanticMode: prevSemantic,
                renderMode: (prevCanvasRenderModeRef.current || '2d') as '2d' | '3d',
                renderVariant: prevRenderVariantRef.current || undefined,
                layoutVariant: lastLayoutVariantRef.current || undefined,
                viewKey: prevViewKey || undefined,
              })
              state.setLayoutPositionsForMode(key, prevPositions)
            }
          }
        } catch {
          void 0
        }
        try {
          sceneCleanupRef.current()
        } catch {
          void 0
        } finally {
          sceneCleanupRef.current = null
          sceneBuildKeyRef.current = null
        }
      }
      nodesPresentationAppliedKeyRef.current = `${schemaNodesPresentationJson}|${sceneWidth}|${sceneHeight}`
      groupsPresentationAppliedKeyRef.current = schemaGroupsPresentationJson
      const graphMetaKey = buildGraphMetaKey(sceneGraphData)
      const graphMetaKeyForZoom = buildGraphMetaKeyIgnoringPending(sceneGraphData)
      const zoomViewKey = buildZoomViewKey({
        canvasRenderMode,
        canvas2dRenderer,
        schemaLayoutEngineJson,
        frontmatterModeEnabled: !!effectiveFrontmatterModeEnabled,
        documentSemanticMode: layoutSemanticModeKey,
        graphMetaKey: graphMetaKeyForZoom,
        renderMediaAsNodes: renderMediaAsNodes === true,
        mediaPanelDensity: String(mediaPanelDensity),
        collapsedGroupIdsKey,
      })
      const layoutViewKey = buildLayoutViewKey({
        schemaLayoutEngineJson,
        frontmatterModeEnabled: !!effectiveFrontmatterModeEnabled,
        documentSemanticMode: layoutSemanticModeKey,
        graphMetaKey,
        renderMediaAsNodes: renderMediaAsNodes === true,
        mediaPanelDensity: String(mediaPanelDensity),
        collapsedGroupIdsKey,
      })

      const stateForZoom = useGraphStore.getState()
      const layoutPositionCacheByMode = useGraphStore.getState().layoutPositionCacheByMode;
      const isPinned = useGraphStore.getState().viewPinned === true;
      const z = pickZoomStateForView({
        zoomViewKey,
        zoomStateByKey: stateForZoom.zoomStateByKey,
        viewPinned: isPinned,
        fitToScreenMode,
        zoomToSelectionMode,
      })
      const mode = readLayoutMode(schemaValue)
      const prevMode = lastLayoutModeRef.current
      const prevFrontmatterMode = lastFrontmatterModeRef.current
      const prevSemanticMode = lastSemanticModeRef.current
      const prevLayoutVariant = lastLayoutVariantRef.current
      const prevDatasetKey = lastDatasetKeyRef.current
      const prevLayoutViewKey = lastLayoutViewKeyRef.current
      const datasetKey = computeLayoutDatasetKey({
        graphData: sceneGraphData,
        graphDataRevision: graphDataRevisionRef.current ?? graphDataRevision,
      })
      const layoutVariant = ''
      const pickedInitialZoomTransform = pickInitialZoomTransform({
        zoomState: z,
        pinned: isPinned,
        graphDataRevision: graphDataRevisionRef.current ?? graphDataRevision,
        nextViewportW: sceneWidth,
        nextViewportH: sceneHeight,
      })
      const initialZoomTransform =
        pickedInitialZoomTransform ||
        (!fitToScreenMode && !zoomToSelectionMode ? lastKnownZoomTransformRef.current : null)
      const {
        layoutPositionsForMode,
        skipInitialLayout,
        cacheKey,
      } = determineLayoutPositions({
        datasetKey,
        mode,
        frontmatterMode: !!effectiveFrontmatterModeEnabled,
        semanticMode: layoutSemanticModeKey,
        renderMode: canvasRenderMode,
        renderVariant: canvasRenderMode === '2d' ? canvas2dRenderer : '',
        layoutVariant,
        viewKey: layoutViewKey,
        prevViewKey: prevLayoutViewKey,
        prevDatasetKey,
        prevMode,
        prevFrontmatterMode,
        prevSemanticMode,
        prevRenderMode: prevCanvasRenderModeRef.current,
        prevRenderVariant: prevRenderVariantRef.current,
        prevLayoutVariant,
        nodes: Array.isArray(sceneGraphData.nodes) ? sceneGraphData.nodes : [],
        layoutPositionCacheByMode,
      });

      const baselineLayoutPositions = (() => {
        if (String(documentSemanticMode || 'document') !== 'keyword') return null
        if (!layoutPositionCacheByMode) return null

        const lookup = (key: string | null): Record<string, { x: number; y: number }> | null => {
          if (!key) return null
          const cached = layoutPositionCacheByMode[key] ?? null
          return cached && Object.keys(cached).length > 0 ? cached : null
        }

        if (prevSemanticMode === 'document' && prevDatasetKey && prevLayoutViewKey) {
          const baselineFromPrevKey = buildLayoutPositionCacheKey({
            datasetKey: prevDatasetKey,
            mode: prevMode ?? mode,
            frontmatterMode: prevFrontmatterMode ?? !!effectiveFrontmatterModeEnabled,
            semanticMode: 'document',
            renderMode: canvasRenderMode,
            viewKey: prevLayoutViewKey,
            renderVariant: canvasRenderMode === '2d' ? canvas2dRenderer : '',
            layoutVariant: prevLayoutVariant ?? layoutVariant,
          })
          const found = lookup(baselineFromPrevKey)
          if (found) return found
        }

        const graphMetaKey = buildGraphMetaKey(sceneGraphData)
        const baselineGraphMetaKey = (() => {
          const meta = sceneGraphData.metadata && typeof sceneGraphData.metadata === 'object' && !Array.isArray(sceneGraphData.metadata)
            ? (sceneGraphData.metadata as Record<string, unknown>)
            : null
          const raw = meta && typeof meta.baselineGraphMetaKey === 'string' ? meta.baselineGraphMetaKey.trim() : ''
          return raw || graphMetaKey
        })()
        const baselineLayoutViewKey = buildLayoutViewKey({
          schemaLayoutEngineJson,
          frontmatterModeEnabled: !!effectiveFrontmatterModeEnabled,
          documentSemanticMode: 'document',
          graphMetaKey: baselineGraphMetaKey,
          renderMediaAsNodes: renderMediaAsNodes === true,
          mediaPanelDensity: String(mediaPanelDensity),
          collapsedGroupIdsKey,
        })
        const baselineFromCurrentKey = buildLayoutPositionCacheKey({
          datasetKey,
          mode,
          frontmatterMode: !!effectiveFrontmatterModeEnabled,
          semanticMode: 'document',
          renderMode: canvasRenderMode,
          viewKey: baselineLayoutViewKey,
          renderVariant: canvasRenderMode === '2d' ? canvas2dRenderer : '',
          layoutVariant,
        })
        return lookup(baselineFromCurrentKey)
      })()

      const effectiveSkipInitialLayout =
        String(documentSemanticMode || 'document') === 'keyword' &&
        canvasRenderMode === '2d' &&
        String(canvas2dRenderer || '') === 'd3' &&
        !!baselineLayoutPositions
          ? true
          : skipInitialLayout
      
      const prevPositions: Record<string, { x: number; y: number }> = {}
      if (nodesSelRef.current) {
        nodesSelRef.current.each((d: GraphNode) => {
          if (d.id && typeof d.x === 'number' && typeof d.y === 'number' && Number.isFinite(d.x) && Number.isFinite(d.y)) {
            prevPositions[String(d.id)] = { x: d.x, y: d.y }
          }
        })
      }

      lastLayoutModeRef.current = mode
      lastFrontmatterModeRef.current = !!effectiveFrontmatterModeEnabled
      lastSemanticModeRef.current = layoutSemanticModeKey
      lastLayoutVariantRef.current = layoutVariant
      lastDatasetKeyRef.current = datasetKey
      lastLayoutViewKeyRef.current = layoutViewKey
      activeLayoutCacheKeyRef.current = cacheKey
      sceneCleanupRef.current = setupGraphScene({
        active: () => activeRef.current,
        svgEl: svgRef.current,
        svgRef,
        graphData: sceneGraphData,
        graphDataRevision: graphDataRevision || 0,
        schema: schemaValue,
        documentSemanticMode: (documentSemanticMode as 'document' | 'keyword' | undefined) ?? undefined,
        edgesForSim,
        width: sceneWidth,
        height: sceneHeight,
        hoverEnabled,
        zoomOnDoubleClick,
        renderMediaAsNodes,
        mediaOverlayNodeIdSet,
        mediaPanelDensity,
        enableTightInitialLayout: (() => {
          if (isEmbeddedPreview) return false
          const nodesCount = Array.isArray(sceneGraphData?.nodes) ? sceneGraphData.nodes.length : 0
          const edgesCount = Array.isArray(sceneGraphData?.edges) ? sceneGraphData.edges.length : 0
          if (nodesCount > 2600) return false
          if (edgesCount > 8200) return false
          return true
        })(),
        fitToScreenMode,
        viewportControlsPreset,
        initialZoomTransform,
        layoutPositionsForMode,
        baselineLayoutPositions,
        prevPositions: Object.keys(prevPositions).length > 0 ? prevPositions : null,
        skipInitialLayout: effectiveSkipInitialLayout,
        freezeSimulation: isEmbeddedPreview || isMermaidLayout,
        groupsForBboxCollide: sceneGroupsDerivation?.allGroups || [],
        layoutGroupKeyByNodeId: sceneGroupsDerivation?.layoutGroupKeyByNodeId || null,
        gRef,
        nodesSelRef,
        groupChevronSelRef,
        mediaSelRef,
        portHandlesSelRef,
        linksHitSelRef,
        linksSelRef,
        labelsSelRef,
        zoomRef,
        tempLinkSelRef,
        linkDragRef,
        simulationRef,
        sceneGraphDataRef,
        beforeRenderFrameRef,
        selectedEdgeIdRef,
        selectedNodeIdRef,
        selectedNodeIdsRef,
        selectedEdgeIdsRef,
        selectNode: id => useGraphStore.getState().selectNode(id),
        selectEdge: id => useGraphStore.getState().selectEdge(id),
        selectGroup: id => useGraphStore.getState().selectGroup(id),
        selectGroupExpanded: x =>
          useGraphStore.getState().selectGroupExpanded({ id: x.id, nodeIds: x.nodeIds, edgeIds: x.edgeIds }),
        toggleGroupCollapsed: id => useGraphStore.getState().toggleGroupCollapsed(id),
        setSelectionSource: src => useGraphStore.getState().setSelectionSource(src),
        addNode: n => useGraphStore.getState().addNode(n),
        updateNode: (id, u) => useGraphStore.getState().updateNode(id, u),
        addEdge: e => useGraphStore.getState().addEdge(e),
        updateEdge: (id, u) => useGraphStore.getState().updateEdge(id, u),
        enableEditorGestures: useGraphStore.getState().workspaceViewMode === 'editor',
        setHoverInfo: updater => setHoverInfo(prev => updater(prev)),
        setLifecycleStageRendering: () => useGraphStore.getState().setLifecycleStage('rendering'),
        requestZoomSelection: () => useGraphStore.getState().requestZoom('selection'),
        edgeScrollEnabled: () => useGraphStore.getState().viewPinned !== true,
        onZoomTransform: t => {
          try {
            requestMediaOverlaySchedule()
          } catch {
            void 0
          }
          zoomCommitParamsRef.current = {
            zoomViewKey,
            viewportW: sceneWidth,
            viewportH: sceneHeight,
            graphDataRevision: graphDataRevisionRef.current,
          }
          zoomCommitSchedulerRef.current.schedule(t)
        },
        getSchema: () => schemaRef.current,
        getRenderMediaAsNodes: () => useGraphStore.getState().renderMediaAsNodes === true,
        layoutCacheKey: cacheKey,
        setLayoutPositionsForMode,
      });
      const baseBefore = beforeRenderFrameRef.current
      if (baseBefore && beforeRenderFrameWrappedSourceRef.current !== baseBefore) {
        beforeRenderFrameWrappedSourceRef.current = baseBefore
        beforeRenderFrameRef.current = () => {
          baseBefore()
          try {
            requestMediaOverlaySchedule()
          } catch {
            void 0
          }
        }
      }
      sceneBuildKeyRef.current = buildKey

    });
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      zoomCommitSchedulerRef.current.cancel()
    };
  }, [
    active,
    coarsePointer,
    graphDataRevision,
    graphDataRevisionRef,
    isEmbeddedPreview,
    sceneWidth,
    sceneHeight,
    sceneGraphData,
    sceneGroupsDerivation?.allGroups,
    sceneGroupsDerivation?.layoutGroupKeyByNodeId,
    schemaGroupsPresentationJson,
    schemaNodesPresentationJson,
    schemaLayoutEngineJson,
    edgesForSim,
    setLayoutPositionsForMode,
    effectiveFrontmatterModeEnabled,
    documentSemanticMode,
    canvasRenderMode,
    canvas2dRenderer,
    renderMediaAsNodes,
    mediaPanelDensity,
    viewportControlsPreset,
    collapsedGroupIdsKey,
    selectedNodeIdRef,
    selectedEdgeIdRef,
    selectedNodeIdsRef,
    selectedEdgeIdsRef,
    fitToScreenMode,
    zoomToSelectionMode,
  ]);

  useEffect(() => {
    const req = graphCanvasArrangeRequest
    if (!active) return
    if (!req) return
    try {
      clearGraphCanvasArrangeRequest()
    } catch {
      void 0
    }

    const svgEl = svgRef.current
    if (!svgEl) return
    const graphDataNow = sceneGraphDataRef.current
    if (!graphDataNow) return
    const nodes = Array.isArray(graphDataNow.nodes) ? (graphDataNow.nodes as GraphNode[]) : []
    if (nodes.length === 0) return

    const selectionIds = (() => {
      const multi = Array.isArray(selectedNodeIdsRef.current) ? selectedNodeIdsRef.current : []
      if (multi.length > 0) return multi
      const single = selectedNodeIdRef.current
      return single ? [single] : []
    })()

    if (req.type === 'center') {
      const scopeNodes = req.scope === 'all' ? nodes : nodes.filter(n => selectionIds.includes(String(n.id)))
      if (scopeNodes.length === 0) return
      let cx = 0
      let cy = 0
      let count = 0
      for (let i = 0; i < scopeNodes.length; i += 1) {
        const n = scopeNodes[i]
        const x = typeof n.x === 'number' ? n.x : null
        const y = typeof n.y === 'number' ? n.y : null
        if (x == null || y == null) continue
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue
        cx += x
        cy += y
        count += 1
      }
      if (count <= 0) return
      cx /= count
      cy /= count
      const w = Math.max(1, Math.floor(sceneWidth))
      const h = Math.max(1, Math.floor(sceneHeight))
      const t = d3.zoomTransform(svgEl)
      const next = computeCenteredTransformToWorldPoint({ transform: { k: t.k, x: t.x, y: t.y }, viewportW: w, viewportH: h, worldX: cx, worldY: cy })
      useGraphStore.getState().requestZoomTransform(next)
      return
    }

    if (req.type === 'distribute') {
      const selectedNodes = nodes.filter(n => selectionIds.includes(String(n.id)))
      if (selectedNodes.length < 3) return
      const update = computeEvenlyDistributedPositions({
        nodes: selectedNodes.map(n => ({
          id: String(n.id),
          x: typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : 0,
          y: typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : 0,
        })),
        axis: req.axis,
        minSpacing: 120,
      })
      const byId = new Map<string, { x: number; y: number }>(Object.entries(update))

      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i]
        const id = String(n.id)
        const p = byId.get(id)
        if (!p) continue
        n.x = p.x
        n.y = p.y
        n.fx = p.x
        n.fy = p.y
        n.vx = 0
        n.vy = 0
      }
      try {
        simulationRef.current?.stop()
      } catch {
        void 0
      }
      try {
        svgRef.current?.setAttribute('data-kg-layout-frozen', '1')
      } catch {
        void 0
      }
      try {
        const tickHandler = simulationRef.current?.on('tick')
        if (typeof tickHandler === 'function') (tickHandler as unknown as () => void)()
      } catch {
        void 0
      }
      const cacheKey = activeLayoutCacheKeyRef.current
      if (cacheKey) {
        const positions: Record<string, { x: number; y: number }> = {}
        for (let i = 0; i < nodes.length; i += 1) {
          const n = nodes[i]
          const id = String(n.id)
          const x = typeof n.x === 'number' ? n.x : null
          const y = typeof n.y === 'number' ? n.y : null
          if (!id || x == null || y == null) continue
          if (!Number.isFinite(x) || !Number.isFinite(y)) continue
          positions[id] = { x, y }
        }
        if (Object.keys(positions).length > 0) {
          useGraphStore.getState().setLayoutPositionsForMode(cacheKey, positions)
        }
      }
    }
  }, [active, clearGraphCanvasArrangeRequest, graphCanvasArrangeRequest, sceneHeight, sceneWidth, selectedNodeIdRef, selectedNodeIdsRef])

  useEffect(() => {
    prevCanvasRenderModeRef.current = canvasRenderMode
  }, [canvasRenderMode])

  useEffect(() => {
    prevRenderVariantRef.current = canvasRenderMode === '2d' ? String(canvas2dRenderer || '') : ''
  }, [canvas2dRenderer, canvasRenderMode])

  useEffect(() => {
    const g = gRef.current
    if (!g) return
    if (nodesPresentationAppliedKeyRef.current === `${schemaNodesPresentationJson}|${sceneWidth}|${sceneHeight}`) return
    if (!simulationRef.current) return
    if (!sceneGraphDataRef.current) return

    if (!activeRef.current) return
    if (svgRef.current?.getAttribute('data-kg-layout-frozen') === '1') return
    const schemaValue = schemaRef.current
    const hoverEnabled = schemaValue.behavior?.hover?.enabled !== false && !coarsePointer
    const expansionCfg = schemaValue.behavior?.expansion || {}
    const expansionEnabled = expansionCfg.enabled !== false
    const zoomOnDoubleClick = expansionEnabled && expansionCfg.zoomOnDoubleClick !== false

    const groupKeyByNodeId = sceneGroupsDerivation?.layoutGroupKeyByNodeId || null
    const groupKeyOf = (n: GraphNode): string | null => {
      const id = String(n.id || '').trim()
      if (!id || !groupKeyByNodeId) return null
      return groupKeyByNodeId[id] || null
    }
    updateForceSimulationPresentation({
      simulation: simulationRef.current,
      nodes: Array.isArray(sceneGraphDataRef.current.nodes) ? (sceneGraphDataRef.current.nodes as GraphNode[]) : [],
      edges: edgesForSim,
      width: sceneWidth,
      height: sceneHeight,
      schema: schemaValue,
      groupKeyOf,
      groupsForBboxCollide: sceneGroupsDerivation?.allGroups || [],
    })
    updateGraphSceneNodesPresentation({
      svgEl: svgRef.current,
      zoomRef,
      edgeScrollEnabled: () => useGraphStore.getState().viewPinned !== true,
      gRef,
      schema: schemaValue,
      documentSemanticMode: (documentSemanticMode as 'document' | 'keyword' | undefined) ?? undefined,
      hoverEnabled,
      zoomOnDoubleClick,
      renderMediaAsNodes,
      mediaOverlayNodeIdSet,
      mediaPanelDensity,
      tempLinkSelRef,
      linkDragRef,
      simulationRef,
      sceneGraphDataRef,
      nodesSelRef,
      groupChevronSelRef,
      mediaSelRef,
      portHandlesSelRef,
      labelsSelRef,
      setHoverInfo: updater => setHoverInfo(prev => updater(prev)),
      selectNode: id => useGraphStore.getState().selectNode(id),
      selectEdge: id => useGraphStore.getState().selectEdge(id),
      setSelectionSource: src => useGraphStore.getState().setSelectionSource(src),
      addEdge: e => useGraphStore.getState().addEdge(e),
      updateEdge: (id, u) => useGraphStore.getState().updateEdge(id, u),
      getSelectedEdgeId: () => selectedEdgeIdRef.current,
      enableEditorGestures: useGraphStore.getState().workspaceViewMode === 'editor',
      onCommitNodePosition:
        useGraphStore.getState().workspaceViewMode === 'editor'
          ? ({ id, x, y }) => {
              useGraphStore.getState().updateNode(id, { x, y })
            }
          : undefined,
      requestZoomSelection: () => useGraphStore.getState().requestZoom('selection'),
      toggleGroupCollapsed: id => useGraphStore.getState().toggleGroupCollapsed(id),
    })
    nodesPresentationAppliedKeyRef.current = `${schemaNodesPresentationJson}|${sceneWidth}|${sceneHeight}`
  }, [
    coarsePointer,
    edgesForSim,
    mediaPanelDensity,
    renderMediaAsNodes,
    sceneGroupsDerivation?.allGroups,
    sceneGroupsDerivation?.layoutGroupKeyByNodeId,
    sceneHeight,
    sceneWidth,
    schemaNodesPresentationJson,
    selectedEdgeIdRef,
  ])

  useEffect(() => {
    const g = gRef.current
    if (!g) return
    if (groupsPresentationAppliedKeyRef.current === schemaGroupsPresentationJson) return
    const schemaValue = schemaRef.current
    if (!sceneGraphData) return
    const hoverEnabled = schemaValue.behavior?.hover?.enabled !== false && !coarsePointer
    updateGraphSceneGroupsPresentation({
      gRef,
      schema: schemaValue,
      graphData: sceneGraphData,
      documentSemanticMode: (documentSemanticMode as 'document' | 'keyword' | undefined) ?? undefined,
      beforeRenderFrameRef,
      simulationRef,
      hoverEnabled,
      setHoverInfo: updater => setHoverInfo(prev => updater(prev)),
      setSelectionSource: src => useGraphStore.getState().setSelectionSource(src),
      selectNode: id => useGraphStore.getState().selectNode(id),
      selectGroup: id => useGraphStore.getState().selectGroup(id),
      selectGroupExpanded: x =>
        useGraphStore.getState().selectGroupExpanded({ id: x.id, nodeIds: x.nodeIds, edgeIds: x.edgeIds }),
      toggleGroupCollapsed: id => useGraphStore.getState().toggleGroupCollapsed(id),
    })
    groupsPresentationAppliedKeyRef.current = schemaGroupsPresentationJson
  }, [coarsePointer, schemaGroupsPresentationJson, sceneGraphData])


  useSelectionHighlight({
    paused: !active,
    nodesSelRef,
    mediaSelRef,
    labelsSelRef,
    linksSelRef,
  });
  useGroupSelectionHighlight({ gRef, paused: !active })

  useEffect(() => {
    if (!active) return
    const unsubscribe = useGraphStore.subscribe(
      s => `${s.selectedNodeId || ''}:${s.selectedEdgeId || ''}:${s.selectedGroupId || ''}`,
      () => {
        const fn = beforeRenderFrameRef.current
        if (!fn) return
        try {
          fn()
        } catch {
          void 0
        }
      },
    )
    return () => {
      try {
        unsubscribe()
      } catch {
        void 0
      }
    }
  }, [active])

  useEffect(() => {
    if (!active) return
    const unsubscribe = useGraphStore.subscribe(
      s =>
        [
          s.zoomLabelScaleMode2d,
          s.zoomLabelScaleExponent2d,
          s.zoomLabelScaleClampMin2d,
          s.zoomLabelScaleClampMax2d,
          s.zoomStrokeScaleMode2d,
          s.zoomStrokeScaleExponent2d,
          s.zoomStrokeScaleClampMin2d,
          s.zoomStrokeScaleClampMax2d,
        ].join(':'),
      () => {
        const svgEl = svgRef.current
        const zoom = zoomRef.current
        if (!svgEl || !zoom) return
        try {
          const svg = d3.select(svgEl)
          const t0 = d3.zoomTransform(svgEl)
          svg.call(
            zoom.transform as unknown as (
              sel: d3.Selection<SVGSVGElement, unknown, null, undefined>,
              t: d3.ZoomTransform,
            ) => void,
            t0,
          )
        } catch {
          void 0
        }
      },
    )
    return () => {
      try {
        unsubscribe()
      } catch {
        void 0
      }
    }
  }, [active])

  useEffect(() => {
    if (!active) return
    if (!labelsSelRef.current || !sceneGraphData) return;
    const { valuesByNodeId, kindsByNodeId } = flowState;
    if (Object.keys(kindsByNodeId).length === 0) return;
    labelsSelRef.current
      .text((d: GraphNode) => {
        const kind = kindsByNodeId[d.id];
        if (!kind) return d.label;
        const rawValue = valuesByNodeId[d.id];
        if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) return d.label;
        const rounded = Math.round(rawValue * 100) / 100;
        return `${d.label} (${rounded})`;
      });
  }, [active, flowState, sceneGraphData, schemaNodesPresentationJson]);

  useGraphCanvasStyles({
    gRef,
    nodesSelRef,
    linksSelRef,
    labelsSelRef,
    schema,
    documentSemanticMode: (documentSemanticMode as 'document' | 'keyword' | undefined) ?? undefined,
    paused: !active,
    graphDataRevision: graphDataRevisionRef.current ?? 0,
  });

  const selectedIds = useMemo(() => {
    const set = new Set<string>()
    if (selectedNodeId) {
      const id = String(selectedNodeId || '').trim()
      if (id) set.add(id)
    }
    const ids = Array.isArray(selectedNodeIds) ? selectedNodeIds : []
    for (let i = 0; i < ids.length; i += 1) {
      const id = String(ids[i] || '').trim()
      if (id) set.add(id)
    }
    return Array.from(set)
  }, [selectedNodeId, selectedNodeIds])

  const applyArrange = useMemo(() => {
    return (action: ArrangeAction2d) => {
      if (!active) return
      if (selectedIds.length < 2) return
      const graphDataNow = sceneGraphDataRef.current
      if (!graphDataNow) return
      const nodes = Array.isArray(graphDataNow.nodes) ? (graphDataNow.nodes as GraphNode[]) : []
      if (nodes.length === 0) return
      const byId = new Map<string, GraphNode>()
      for (let i = 0; i < nodes.length; i += 1) byId.set(String(nodes[i]!.id), nodes[i]!)
      const refId = (() => {
        const a = String(selectedNodeId || '').trim()
        if (a && selectedIds.includes(a)) return a
        return selectedIds[0] || ''
      })()
      const grid = readSnapGridConfigFromSchema(schema)
      const gridSize = grid.enabled ? grid.size : 0
      const snap = (v: number) => (grid.enabled ? snapScalarToGrid(v, grid.size) : v)

      const items = selectedIds
        .map(id => {
          const n = byId.get(id)
          if (!n) return null
          const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
          const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
          if (x == null || y == null) return null
          const half = getNodeHalfExtents2d(n, schema)
          return { id, cx: x, cy: y, w: half.halfW * 2, h: half.halfH * 2 }
        })
        .filter(Boolean) as { id: string; cx: number; cy: number; w: number; h: number }[]
      if (items.length < 2) return
      const next = computeArrangeCenters({ action, items, refId, minSpacing: gridSize || 120 })
      for (let i = 0; i < items.length; i += 1) {
        const id = items[i]!.id
        const n = byId.get(id)
        const p = next[id]
        if (!n || !p) continue
        n.x = snap(p.cx)
        n.y = snap(p.cy)
        n.fx = n.x
        n.fy = n.y
        n.vx = 0
        n.vy = 0
      }

      try {
        simulationRef.current?.stop()
      } catch {
        void 0
      }
      try {
        svgRef.current?.setAttribute('data-kg-layout-frozen', '1')
      } catch {
        void 0
      }
      try {
        const tickHandler = simulationRef.current?.on('tick')
        if (typeof tickHandler === 'function') (tickHandler as unknown as () => void)()
      } catch {
        void 0
      }
      const cacheKey = activeLayoutCacheKeyRef.current
      if (cacheKey) {
        const positions: Record<string, { x: number; y: number }> = {}
        for (let i = 0; i < nodes.length; i += 1) {
          const n = nodes[i]!
          const id = String(n.id)
          const x = typeof n.x === 'number' ? n.x : null
          const y = typeof n.y === 'number' ? n.y : null
          if (!id || x == null || y == null) continue
          if (!Number.isFinite(x) || !Number.isFinite(y)) continue
          positions[id] = { x, y }
        }
        if (Object.keys(positions).length > 0) {
          useGraphStore.getState().setLayoutPositionsForMode(cacheKey, positions)
        }
      }
    }
  }, [active, schema, selectedIds, selectedNodeId])

  useEffect(() => {
    if (!active) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return
      const arrange = readArrangeShortcut(e)
      if (arrange) {
        e.preventDefault()
        applyArrange(arrange)
        return
      }
      if (selectedIds.length === 0) return
      const grid = readSnapGridConfigFromSchema(schema)
      const delta = readNudgeDelta({ e, snapGridEnabled: grid.enabled, snapGridSize: grid.size })
      if (!delta) return
      const graphDataNow = sceneGraphDataRef.current
      if (!graphDataNow) return
      const nodes = Array.isArray(graphDataNow.nodes) ? (graphDataNow.nodes as GraphNode[]) : []
      if (nodes.length === 0) return
      const set = new Set<string>(selectedIds)
      let changed = 0
      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i]!
        const id = String(n.id || '').trim()
        if (!id || !set.has(id)) continue
        const x0 = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
        const y0 = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
        if (x0 == null || y0 == null) continue
        n.x = x0 + delta.dx
        n.y = y0 + delta.dy
        n.fx = n.x
        n.fy = n.y
        n.vx = 0
        n.vy = 0
        changed += 1
      }
      if (changed === 0) return
      e.preventDefault()
      try {
        simulationRef.current?.stop()
      } catch {
        void 0
      }
      try {
        svgRef.current?.setAttribute('data-kg-layout-frozen', '1')
      } catch {
        void 0
      }
      try {
        const tickHandler = simulationRef.current?.on('tick')
        if (typeof tickHandler === 'function') (tickHandler as unknown as () => void)()
      } catch {
        void 0
      }
      const cacheKey = activeLayoutCacheKeyRef.current
      if (cacheKey) {
        const positions: Record<string, { x: number; y: number }> = {}
        for (let i = 0; i < nodes.length; i += 1) {
          const n = nodes[i]!
          const id = String(n.id)
          const x = typeof n.x === 'number' ? n.x : null
          const y = typeof n.y === 'number' ? n.y : null
          if (!id || x == null || y == null) continue
          if (!Number.isFinite(x) || !Number.isFinite(y)) continue
          positions[id] = { x, y }
        }
        if (Object.keys(positions).length > 0) {
          useGraphStore.getState().setLayoutPositionsForMode(cacheKey, positions)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true } as AddEventListenerOptions)
    }
  }, [active, applyArrange, schema?.behavior?.snapGrid, selectedIds])

  return (
    <main
      ref={containerRef}
      className={CANVAS_SURFACE_CLASS}
      role="main"
      aria-label="Graph Canvas"
    >
      {active && selectedIds.length >= 2 ? (
        <div className="pointer-events-none absolute right-3 top-3 z-50 flex flex-wrap gap-1 rounded-md border border-[var(--kg-border)] bg-[var(--kg-panel-bg)] p-2 text-xs text-[var(--kg-text)] shadow">
          <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => applyArrange('align-left')}>
            Align L
          </button>
          <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => applyArrange('align-center-x')}>
            Align CX
          </button>
          <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => applyArrange('align-right')}>
            Align R
          </button>
          <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => applyArrange('align-top')}>
            Align T
          </button>
          <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => applyArrange('align-center-y')}>
            Align CY
          </button>
          <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => applyArrange('align-bottom')}>
            Align B
          </button>
          <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => applyArrange('distribute-x')}>
            Dist X
          </button>
          <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => applyArrange('distribute-y')}>
            Dist Y
          </button>
        </div>
      ) : null}
      <InfiniteGridCanvasOverlay
        enabled={canvasGrid.enabled}
        gridSize={canvasGridStep}
        variant={canvasGrid.variant}
        majorEvery={canvasGrid.majorEvery}
        dotRadiusPx={canvasGrid.dotRadiusPx}
        width={width}
        height={height}
        dpr={dpr}
        getTransform={getZoomTransform}
        getEventTarget={getZoomEventTarget}
      />
      <svg
        ref={svgRef}
        className={`${CANVAS_INTERACTIVE_CLASS} z-10`}
        data-kg-canvas-interactive="1"
        viewBox={`0 0 ${Math.max(1, Math.floor(width))} ${Math.max(1, Math.floor(height))}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={e => {
          if (!active) return
          if (e.button !== 0) return
          const svgEl = svgRef.current
          if (!svgEl) return
          if (e.target !== svgEl) return
          const selectMode = schema?.behavior?.selectMode || 'single'
          if (selectMode !== 'lasso') return
          const local = readElementLocalPoint({ el: svgEl, event: e })
          if (!local) return
          try {
            ;(e.currentTarget as unknown as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(e.pointerId)
          } catch {
            void 0
          }
          const mode: 'replace' | 'add' | 'remove' = e.altKey ? 'remove' : e.shiftKey || e.metaKey || e.ctrlKey ? 'add' : 'replace'
          marqueeRef.current = { start: { sx: local.sx, sy: local.sy }, end: { sx: local.sx, sy: local.sy }, mode, pointerId: e.pointerId }
          setMarqueeBox({ left: local.sx, top: local.sy, width: 1, height: 1 })
          try {
            e.preventDefault()
          } catch {
            void 0
          }
        }}
        onPointerMove={e => {
          const m = marqueeRef.current
          if (!m) return
          if (e.pointerId !== m.pointerId) return
          const svgEl = svgRef.current
          if (!svgEl) return
          const local = readElementLocalPoint({ el: svgEl, event: e })
          if (!local) return
          marqueeRef.current = { ...m, end: { sx: local.sx, sy: local.sy } }
          const left = Math.min(m.start.sx, local.sx)
          const top = Math.min(m.start.sy, local.sy)
          const right = Math.max(m.start.sx, local.sx)
          const bottom = Math.max(m.start.sy, local.sy)
          setMarqueeBox({ left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) })
        }}
        onPointerUp={e => {
          const m = marqueeRef.current
          marqueeRef.current = null
          setMarqueeBox(null)
          if (!active) return
          const svgEl = svgRef.current
          if (!svgEl) return
          if (!m || e.pointerId !== m.pointerId) return
          const w = Math.abs(m.end.sx - m.start.sx)
          const h = Math.abs(m.end.sy - m.start.sy)
          if (w < 6 || h < 6) return
          const t = d3.zoomTransform(svgEl)
          const a = invertZoomPoint(t, m.start)
          const b = invertZoomPoint(t, m.end)
          const minX = Math.min(a.x, b.x)
          const minY = Math.min(a.y, b.y)
          const maxX = Math.max(a.x, b.x)
          const maxY = Math.max(a.y, b.y)
          const graphDataNow = sceneGraphDataRef.current
          if (!graphDataNow) return
          const nodes = Array.isArray(graphDataNow.nodes) ? (graphDataNow.nodes as GraphNode[]) : []
          const hits: string[] = []
          for (let i = 0; i < nodes.length; i += 1) {
            const n = nodes[i]!
            const id = String(n.id || '').trim()
            if (!id) continue
            const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
            const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
            if (x == null || y == null) continue
            const half = getNodeHalfExtents2d(n, schema)
            const nMinX = x - half.halfW
            const nMaxX = x + half.halfW
            const nMinY = y - half.halfH
            const nMaxY = y + half.halfH
            const intersects = nMinX <= maxX && nMaxX >= minX && nMinY <= maxY && nMaxY >= minY
            if (intersects) hits.push(id)
          }
          const st = useGraphStore.getState()
          st.setSelectionSource('canvas')
          st.selectEdge(null)
          const prevRaw = Array.isArray(st.selectedNodeIds) ? st.selectedNodeIds : []
          const prev = prevRaw.map(v => String(v || '').trim()).filter(Boolean)
          if (m.mode === 'remove') {
            const drop = new Set<string>(hits)
            const next = prev.filter(id => !drop.has(id))
            st.selectNodesExpanded({ nodeIds: next, activeNodeId: next.length > 0 ? next[next.length - 1] : null })
          } else if (m.mode === 'add') {
            const set = new Set<string>(prev)
            for (let i = 0; i < hits.length; i += 1) set.add(hits[i]!)
            const next = Array.from(set)
            st.selectNodesExpanded({ nodeIds: next, activeNodeId: next.length > 0 ? next[next.length - 1] : null })
          } else {
            st.selectNodesExpanded({ nodeIds: hits, activeNodeId: hits.length > 0 ? hits[hits.length - 1] : null })
          }
        }}
      />
      {active && mediaOverlayNodes.length > 0 ? (
        <section aria-label="D3 rich media overlay" className="absolute inset-0 z-[80] pointer-events-none">
          {mediaOverlayNodes.map(n => {
            return (
              <RichMediaPanel
                key={n.id}
                ref={getOverlayRefForId(n.id)}
                data-kg-canvas-wheel-ignore="true"
                data-kg-canvas-pointer-ignore="true"
                data-kg-panel-box="leftTop"
                className="absolute left-0 top-0 pointer-events-auto"
                title={n.title}
                url={n.url}
                srcDoc={n.srcDoc}
                openUrl={n.openUrl}
                kind={n.kind}
                interactive={renderMediaAsNodes === true && n.interactive}
                iframeMode="srcdoc-when-needed"
                forwardWheelTo={() => svgRef.current}
                shouldStartHeaderDrag={() => {
                  if (useGraphStore.getState().canvasPointerMode2d === 'pan') return false
                  if (isSpacePanHeld()) return false
                  return true
                }}
                onOverlayPanStart={({ pointerId, clientX, clientY }) => startMediaOverlayPan({ pointerId, clientX, clientY })}
                onOverlayPan={({ pointerId, clientX, clientY, dx, dy }) => moveMediaOverlayPan({ pointerId, clientX, clientY, dx, dy })}
                onOverlayPanEnd={({ pointerId }) => endMediaOverlayPan({ pointerId })}
                onHeaderDragStart={({ clientX, clientY }) => beginMediaHeaderDrag(n.id, clientX, clientY)}
                onHeaderDrag={({ dx, dy }) => moveMediaHeaderDrag(dx, dy)}
                onHeaderDragEnd={() => endMediaHeaderDrag()}
                onWheelCapture={stopEvent}
                onClickCapture={stopEvent}
                onDoubleClickCapture={stopEvent}
                onContextMenuCapture={stopEvent}
              />
            )
          })}
        </section>
      ) : null}
      {marqueeBox ? (
        <section
          aria-hidden={true}
          className="absolute pointer-events-none border border-[var(--kg-canvas-node-selected)] bg-[color-mix(in_srgb,var(--kg-canvas-node-selected)_15%,transparent)]"
          style={{ left: marqueeBox.left, top: marqueeBox.top, width: marqueeBox.width, height: marqueeBox.height }}
        />
      ) : null}
      <GraphHoverTooltip
        hoverInfo={hoverInfo}
        containerRef={containerRef as unknown as React.RefObject<HTMLElement | null>}
        nodes={(sceneGraphData as GraphData | null)?.nodes}
        edges={(sceneGraphData as GraphData | null)?.edges}
        schema={schema as GraphSchema | null}
        onRequestClose={() => setHoverInfo(null)}
      />
      <MarkdownDesignOverlay
        enabled={active && !!String(markdownDocumentText || '').trim()}
        svgRef={svgRef}
        markdownDocumentName={markdownDocumentName}
        markdownDocumentText={markdownDocumentText}
        allowedKinds={['table', 'code', 'blockquote']}
      />
    </main>
  );
}
