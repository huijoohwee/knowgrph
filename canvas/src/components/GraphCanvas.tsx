import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useShallow } from 'zustand/react/shallow'
import { GraphNode, GraphEdge, GraphData } from '@/lib/graph/types'
import { type GraphSchema } from '@/lib/graph/schema'
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

export default function GraphCanvas({ active = true }: { active?: boolean }) {
  const containerRef = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
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
  const lastSemanticModeRef = useRef<'document' | 'keyword' | null>(null)
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
    setLayoutPositionsForMode,
    frontmatterModeEnabled,
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
  } = useGraphStore(
    useShallow((s) => ({
      graphDataRevision: s.graphDataRevision,
      setCanvasDims: s.setCanvasDims,
      setCanvasPos: s.setCanvasPos,
      schema: s.schema,
      renderMediaAsNodes: s.renderMediaAsNodes,
      mediaPanelDensity: s.mediaPanelDensity,
      setLayoutPositionsForMode: s.setLayoutPositionsForMode,
      frontmatterModeEnabled: s.frontmatterModeEnabled || false,
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
    })),
  );
  const prevCanvasRenderModeRef = useRef<'2d' | '3d'>(canvasRenderMode)
  const prevRenderVariantRef = useRef<string>(canvasRenderMode === '2d' ? String(canvas2dRenderer || '') : '')
  const lastKnownZoomTransformRef = useRef<{ k: number; x: number; y: number } | null>(null)
  const registerCanvasSnapshotFns = useGraphStore(s => s.registerCanvasSnapshotFns);
  const selectedNodeIdRef = useGraphStoreKeyRef('selectedNodeId')
  const selectedEdgeIdRef = useGraphStoreKeyRef('selectedEdgeId')
  const selectedNodeIdsRef = useGraphStoreKeyRef('selectedNodeIds')
  const selectedEdgeIdsRef = useGraphStoreKeyRef('selectedEdgeIds')
  const graphDataRevisionRef = useGraphStoreKeyRef('graphDataRevision')
  const zoomCommitRafIdRef = useRef<number | null>(null)
  const zoomCommitPendingRef = useRef(false)
  const zoomCommitLatestTransformRef = useRef<{ k: number; x: number; y: number } | null>(null)
  const schemaRef = useRef(schema)

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
      frontmatterModeEnabled: frontmatterModeEnabled === true && documentStructureBaselineLock !== true,
      documentSemanticMode,
      graphData: renderGraphData,
    })
  }, [documentSemanticMode, documentStructureBaselineLock, frontmatterModeEnabled, renderGraphData])

  const collapsedGroupIdsKey = useMemo(() => {
    return buildCollapsedGroupIdsKey(collapsedGroupIds)
  }, [collapsedGroupIds])

  const sceneGraphData = useMemo(() => {
    if (!renderGraphData) return null
    return cloneGraphDataForRender(renderGraphData)
  }, [renderGraphData])

  const sceneGroupsDerivation = useMemo(() => {
    return deriveSceneGroups({
      graphData: sceneGraphData,
      graphDataRevision: graphDataRevision || 0,
      schema,
      documentSemanticMode: String(documentSemanticMode || ''),
      frontmatterModeEnabled: !!effectiveFrontmatterModeEnabled,
    })
  }, [documentSemanticMode, effectiveFrontmatterModeEnabled, graphDataRevision, sceneGraphData, schema])

  const sceneDisplayDerivation = useMemo(() => {
    return deriveSceneDisplayGraph({ graphData: sceneGraphData })
  }, [sceneGraphData])

  useEffect(() => {
    schemaRef.current = schema
  }, [schema])
  const { width, height, left, top } = useContainerDims(containerRef);
  const debouncedWidth = useDebouncedValue(width, 100);
  const debouncedHeight = useDebouncedValue(height, 100);
  const sceneWidth = useMemo(() => Math.max(1, Math.floor(debouncedWidth)), [debouncedWidth]);
  const sceneHeight = useMemo(() => Math.max(1, Math.floor(debouncedHeight)), [debouncedHeight]);
  const tempLinkSelRef = useRef<TempLinkSelection>(null);
  const linkDragRef = useRef<PendingLink | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);

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
    setCanvasDims({ w: Math.max(1, Math.floor(width)), h: Math.max(1, Math.floor(height)) });
    setCanvasPos({ x: left, y: top });
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
    const semanticMode = String(state.documentSemanticMode || 'document')
    const graphDataForView = sceneGraphDataRef.current ?? ((state.graphData as unknown as import('@/lib/graph/types').GraphData | null) ?? null)
    const frontmatter = computeEffectiveFrontmatterMode({
      frontmatterModeEnabled: state.frontmatterModeEnabled === true && state.documentStructureBaselineLock !== true,
      documentSemanticMode: semanticMode as 'document' | 'keyword',
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
      documentSemanticMode: semanticMode,
      graphMetaKey,
      renderMediaAsNodes: state.renderMediaAsNodes === true,
      mediaPanelDensity: String(state.mediaPanelDensity),
      collapsedGroupIdsKey,
    })
    const cacheKey = buildLayoutPositionCacheKey({
      datasetKey,
      mode,
      frontmatterMode: frontmatter,
      semanticMode,
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
    graphDataOverride: sceneDisplayDerivation?.displayGraphData ?? null,
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
    const hoverEnabled = schemaValue.behavior?.hover?.enabled !== false;
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
        if (!isEmbeddedPreview) {
          const sim = simulationRef.current
          const effectiveMode = readLayoutMode(schemaValue)
          const isFrozen = svgRef.current?.getAttribute('data-kg-layout-frozen') === '1'
          if (sim && effectiveMode !== 'radial' && !isFrozen) {
            try {
              sim.alphaTarget(0.02).restart()
            } catch {
              void 0
            }
          }
        }
        return
      }

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
          if (Object.keys(prevPositions).length > 0) {
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
      nodesPresentationAppliedKeyRef.current = schemaNodesPresentationJson
      groupsPresentationAppliedKeyRef.current = schemaGroupsPresentationJson
      const graphMetaKey = buildGraphMetaKey(sceneGraphData)
      const graphMetaKeyForZoom = buildGraphMetaKeyIgnoringPending(sceneGraphData)
      const zoomViewKey = buildZoomViewKey({
        canvasRenderMode,
        canvas2dRenderer,
        schemaLayoutEngineJson,
        frontmatterModeEnabled: !!effectiveFrontmatterModeEnabled,
        documentSemanticMode: String(documentSemanticMode),
        graphMetaKey: graphMetaKeyForZoom,
        renderMediaAsNodes: renderMediaAsNodes === true,
        mediaPanelDensity: String(mediaPanelDensity),
        collapsedGroupIdsKey,
      })
      const layoutViewKey = buildLayoutViewKey({
        schemaLayoutEngineJson,
        frontmatterModeEnabled: !!effectiveFrontmatterModeEnabled,
        documentSemanticMode: String(documentSemanticMode),
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
        semanticMode: documentSemanticMode,
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
      lastSemanticModeRef.current = documentSemanticMode
      lastLayoutVariantRef.current = layoutVariant
      lastDatasetKeyRef.current = datasetKey
      lastLayoutViewKeyRef.current = layoutViewKey
      activeLayoutCacheKeyRef.current = cacheKey
      sceneCleanupRef.current = setupGraphScene({
        svgEl: svgRef.current,
        svgRef,
        graphData: sceneGraphData,
        graphDataRevision: graphDataRevision || 0,
        schema: schemaValue,
        edgesForSim,
        width: sceneWidth,
        height: sceneHeight,
        hoverEnabled,
        zoomOnDoubleClick,
        renderMediaAsNodes,
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
        freezeSimulation: isEmbeddedPreview,
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
          zoomCommitLatestTransformRef.current = t
          if (zoomCommitPendingRef.current) return
          zoomCommitPendingRef.current = true
          if (zoomCommitRafIdRef.current != null) {
            try {
              cancelAnimationFrame(zoomCommitRafIdRef.current)
            } catch {
              void 0
            }
          }
          zoomCommitRafIdRef.current = requestAnimationFrame(() => {
            zoomCommitRafIdRef.current = null
            zoomCommitPendingRef.current = false
            const latest = zoomCommitLatestTransformRef.current
            if (!latest) return
            const state = useGraphStore.getState()
            commitZoomTransformToStore({
              state,
              zoomViewKey,
              transform: latest,
              viewportW: sceneWidth,
              viewportH: sceneHeight,
              graphDataRevision: graphDataRevisionRef.current,
            })
          })
        },
        getSchema: () => schemaRef.current,
        getRenderMediaAsNodes: () => useGraphStore.getState().renderMediaAsNodes === true,
        layoutCacheKey: cacheKey,
        setLayoutPositionsForMode,
      });
      sceneBuildKeyRef.current = buildKey

    });
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      if (zoomCommitRafIdRef.current != null) {
        try {
          cancelAnimationFrame(zoomCommitRafIdRef.current)
        } catch {
          void 0
        }
      }
      zoomCommitRafIdRef.current = null
      zoomCommitPendingRef.current = false
    };
  }, [
    active,
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
    if (nodesPresentationAppliedKeyRef.current === schemaNodesPresentationJson) return
    if (!simulationRef.current) return
    if (!sceneGraphDataRef.current) return
    const schemaValue = schemaRef.current
    const hoverEnabled = schemaValue.behavior?.hover?.enabled !== false
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
      viewportCenter: (() => {
        const el = svgRef.current
        if (!el) return undefined
        try {
          const t = d3.zoomTransform(el)
          const k = typeof t.k === 'number' && Number.isFinite(t.k) && t.k > 0 ? t.k : 1
          const x = typeof t.x === 'number' && Number.isFinite(t.x) ? t.x : 0
          const y = typeof t.y === 'number' && Number.isFinite(t.y) ? t.y : 0
          return { x: (sceneWidth / 2 - x) / k, y: (sceneHeight / 2 - y) / k }
        } catch {
          return undefined
        }
      })(),
    })
    updateGraphSceneNodesPresentation({
      svgEl: svgRef.current,
      zoomRef,
      edgeScrollEnabled: () => useGraphStore.getState().viewPinned !== true,
      gRef,
      schema: schemaValue,
      hoverEnabled,
      zoomOnDoubleClick,
      renderMediaAsNodes,
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
    nodesPresentationAppliedKeyRef.current = schemaNodesPresentationJson
  }, [
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
    const hoverEnabled = schemaValue.behavior?.hover?.enabled !== false
    updateGraphSceneGroupsPresentation({
      gRef,
      schema: schemaValue,
      graphData: sceneGraphData,
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
  }, [schemaGroupsPresentationJson, sceneGraphData])


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
    paused: !active,
    graphDataRevision: graphDataRevisionRef.current ?? 0,
  });

  return (
    <main
      ref={containerRef}
      className={CANVAS_SURFACE_CLASS}
      role="main"
      aria-label="Graph Canvas"
    >
      <svg
        ref={svgRef}
        className={`${CANVAS_INTERACTIVE_CLASS} z-0`}
        data-kg-canvas-interactive="1"
        viewBox={`0 0 ${Math.max(1, Math.floor(width))} ${Math.max(1, Math.floor(height))}`}
        preserveAspectRatio="xMidYMid meet"
      />
      <GraphHoverTooltip
        hoverInfo={hoverInfo}
        containerRef={containerRef as unknown as React.RefObject<HTMLElement | null>}
        nodes={(sceneGraphData as GraphData | null)?.nodes}
        edges={(sceneGraphData as GraphData | null)?.edges}
        schema={schema as GraphSchema | null}
        onRequestClose={() => setHoverInfo(null)}
      />
    </main>
  );
}
