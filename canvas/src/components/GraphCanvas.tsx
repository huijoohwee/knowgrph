import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useShallow } from 'zustand/react/shallow'
import { GraphNode, GraphEdge, GraphData } from '@/lib/graph/types'
import { type GraphSchema } from '@/lib/graph/schema'
import { useContainerDims } from '@/hooks/useContainerDims'
import { normalizeEdgesForSim, updateForceSimulationPresentation } from '@/components/GraphCanvas/simulation'
import { readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'
import { createLayoutGroupKeyOfNode } from '@/components/GraphCanvas/layout/layoutGroupKey'
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
import { buildStratifyLayoutVariant } from '@/components/GraphCanvas/layout/stratifyVariant'
import { useDebouncedValue } from '@/features/hooks/useDebouncedValue'
import { useGraphStoreKeyRef } from '@/hooks/useGraphStoreKeyRef'
import type { PortHandleDatum } from '@/components/GraphCanvas/portHandles'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { cloneGraphDataForRender } from '@/components/GraphCanvas/renderClone'
import { pickInitialZoomTransform } from '@/components/GraphCanvas/zoomState'
import { buildZoomViewKey } from '@/components/GraphCanvas/zoomViewKey'
import { isSameZoomState } from '@/lib/zoom/zoomStateEq'
import { computeEffectiveFrontmatterMode } from '@/lib/graph/frontmatterMode'

export default function GraphCanvas({ active = true }: { active?: boolean }) {
  const containerRef = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const lastLayoutModeRef = useRef<null | 'force' | 'radial' | 'stratify'>(null);
  const lastFrontmatterModeRef = useRef<boolean | null>(null);
  const lastSemanticModeRef = useRef<'document' | 'keyword' | null>(null)
  const lastLayoutVariantRef = useRef<string | null>(null)
  const lastDatasetKeyRef = useRef<string | null>(null)
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
    canvasRenderMode,
    canvas2dRenderer,
    collapsedGroupIds,
    viewPinned,
    zoomState,
    fitToScreenMode,
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
      canvasRenderMode: s.canvasRenderMode,
      canvas2dRenderer: s.canvas2dRenderer,
      collapsedGroupIds: s.collapsedGroupIds || [],
      viewPinned: s.viewPinned === true,
      zoomState: s.zoomState || null,
      fitToScreenMode: s.fitToScreenMode === true,
    })),
  );
  const prevCanvasRenderModeRef = useRef<'2d' | '3d'>(canvasRenderMode)
  const prevRenderVariantRef = useRef<string>(canvasRenderMode === '2d' ? String(canvas2dRenderer || '') : '')
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

  const schemaLayoutEngineJson = useMemo(() => {
    const mode = schema ? readLayoutMode(schema) : 'force'
    const forces = schema?.layout?.forces || null
    const fitPadding = schema?.layout?.fitPadding ?? null
    return JSON.stringify({
      mode,
      forces,
      fitPadding,
      stratify: schema?.layout?.stratify || null,
    })
  }, [schema])

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
    const ids = Array.isArray(collapsedGroupIds) ? collapsedGroupIds : []
    const normalized = ids.map(x => String(x || '').trim()).filter(Boolean)
    if (normalized.length === 0) return ''
    normalized.sort((a, b) => a.localeCompare(b))
    return normalized.join('|')
  }, [collapsedGroupIds])

  const sceneGraphData = useMemo(() => {
    if (!renderGraphData) return null
    return cloneGraphDataForRender(renderGraphData)
  }, [renderGraphData])

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
    if (zoomState) return
    if (!svgRef.current) return
    if (!gRef.current) return
    if (!zoomRef.current) return
    try {
      const t = d3.zoomTransform(svgRef.current)
      useGraphStore.getState().setZoomState({
        k: t.k,
        x: t.x,
        y: t.y,
        graphDataRevision: undefined,
        viewportW: sceneWidth,
        viewportH: sceneHeight,
      })
    } catch {
      void 0
    }
  }, [viewPinned, zoomState, sceneWidth, sceneHeight])

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
    const frontmatter = computeEffectiveFrontmatterMode({
      frontmatterModeEnabled: state.frontmatterModeEnabled === true,
      documentSemanticMode: semanticMode as 'document' | 'keyword',
      graphData: (state.graphData as unknown as import('@/lib/graph/types').GraphData | null) ?? null,
    })
    const datasetKey = computeLayoutDatasetKey({
      graphData: state.graphData as unknown as { metadata?: unknown; nodes?: Array<{ type?: unknown; properties?: unknown; metadata?: unknown }> } | null,
      graphDataRevision: state.graphDataRevision || 0,
    })
    const layoutVariant = (() => {
      if (mode !== 'stratify') return ''
      const stratify = schemaValue?.layout?.stratify || null
      const orientation = stratify?.orientation === 'horizontal' ? 'horizontal' : 'vertical'
      const groupRoots = stratify?.groupRoots !== false ? '1' : '0'
      const grid = stratify?.grid || null
      const gridEnabled = grid?.enabled !== false ? '1' : '0'
      const gridSize = typeof grid?.size === 'number' && Number.isFinite(grid.size) ? String(Math.floor(grid.size)) : ''
      const antiLine = stratify?.antiLine || null
      const antiLineEnabled = antiLine?.enabled !== false ? '1' : '0'
      const wrapRows =
        typeof antiLine?.wrapRows === 'number' && Number.isFinite(antiLine.wrapRows) ? String(Math.floor(antiLine.wrapRows)) : ''
      const maxAspectRatio =
        typeof antiLine?.maxAspectRatio === 'number' && Number.isFinite(antiLine.maxAspectRatio)
          ? String(Math.round(antiLine.maxAspectRatio * 100) / 100)
          : ''
      const parts = [
        `o=${orientation}`,
        `gr=${groupRoots}`,
        `g=${gridEnabled}${gridSize ? `:${gridSize}` : ''}`,
        `al=${antiLineEnabled}${wrapRows || maxAspectRatio ? `:${wrapRows || ''}:${maxAspectRatio || ''}` : ''}`,
      ]
      return parts.join('|')
    })()
    const graphMetaKey = String(state.graphData?.metadata && typeof state.graphData.metadata === 'object'
      ? `${String((state.graphData.metadata as Record<string, unknown>).kind ?? '')}:${String((state.graphData.metadata as Record<string, unknown>).source ?? '')}`
      : '')
    const collapsedGroupIdsKey = (() => {
      const ids = Array.isArray(state.collapsedGroupIds) ? state.collapsedGroupIds : []
      const normalized = ids.map(x => String(x || '').trim()).filter(Boolean)
      if (normalized.length === 0) return ''
      normalized.sort((a, b) => a.localeCompare(b))
      return normalized.join('|')
    })()
    const schemaLayoutEngineJson = JSON.stringify({
      mode,
      forces: schemaValue?.layout?.forces || null,
      fitPadding: schemaValue?.layout?.fitPadding ?? null,
      stratify: schemaValue?.layout?.stratify || null,
    })
    const schemaNodesPresentationJson = JSON.stringify({
      nodeShapeMode: schemaValue?.behavior?.nodeShapeMode || 'auto',
      portHandles: schemaValue?.behavior?.portHandles || null,
      nodeShapes: schemaValue?.nodeShapes || null,
      allowNodeDrag: schemaValue?.behavior?.allowNodeDrag !== false,
      hoverEnabled: schemaValue?.behavior?.hover?.enabled !== false,
      expansion: schemaValue?.behavior?.expansion || null,
      renderMediaAsNodes: state.renderMediaAsNodes === true,
      mediaPanelDensity: String(state.mediaPanelDensity),
    })
    const schemaGroupsPresentationJson = JSON.stringify({
      groups: schemaValue?.layout?.groups || null,
      labelStyles: schemaValue?.labelStyles || null,
      nodeShapeMode: schemaValue?.behavior?.nodeShapeMode || 'auto',
      portHandles: schemaValue?.behavior?.portHandles || null,
    })
    const viewKey = buildLayoutViewKey({
      schemaLayoutEngineJson,
      frontmatterModeEnabled: frontmatter,
      documentSemanticMode: semanticMode,
      graphMetaKey,
      renderMediaAsNodes: state.renderMediaAsNodes === true,
      mediaPanelDensity: String(state.mediaPanelDensity),
      collapsedGroupIdsKey,
      schemaNodesPresentationJson,
      schemaGroupsPresentationJson,
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
      const buildKey = [
        String(graphDataRevisionRef.current ?? graphDataRevision),
        `${sceneWidth}x${sceneHeight}`,
        schemaLayoutEngineJson,
        String(effectiveFrontmatterModeEnabled ? 1 : 0),
        String(documentSemanticMode),
        String(sceneGraphData?.metadata && typeof sceneGraphData.metadata === 'object'
          ? `${String((sceneGraphData.metadata as Record<string, unknown>).kind ?? '')}:${String((sceneGraphData.metadata as Record<string, unknown>).source ?? '')}`
          : ''),
        `${String(sceneGraphData?.nodes?.length ?? 0)}:${String(sceneGraphData?.edges?.length ?? 0)}`,
        String(renderMediaAsNodes ? 1 : 0),
        String(mediaPanelDensity),
        collapsedGroupIdsKey,
      ].join('|')

      if (sceneCleanupRef.current && sceneBuildKeyRef.current === buildKey) {
        const sim = simulationRef.current
        const effectiveMode = readLayoutMode(schemaValue)
        if (sim && effectiveMode !== 'radial' && effectiveMode !== 'stratify') {
          try {
            sim.alphaTarget(0.08).restart()
          } catch {
            void 0
          }
        }
        return
      }

      if (sceneCleanupRef.current) {
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
      const graphMetaKey = String(sceneGraphData?.metadata && typeof sceneGraphData.metadata === 'object'
        ? `${String((sceneGraphData.metadata as Record<string, unknown>).kind ?? '')}:${String((sceneGraphData.metadata as Record<string, unknown>).source ?? '')}`
        : '')
      const zoomViewKey = buildZoomViewKey({
        canvasRenderMode,
        canvas2dRenderer,
        schemaLayoutEngineJson,
        frontmatterModeEnabled: !!effectiveFrontmatterModeEnabled,
        documentSemanticMode: String(documentSemanticMode),
        graphMetaKey,
        renderMediaAsNodes: renderMediaAsNodes === true,
        mediaPanelDensity: String(mediaPanelDensity),
        collapsedGroupIdsKey,
        schemaNodesPresentationJson,
        schemaGroupsPresentationJson,
      })
      const layoutViewKey = buildLayoutViewKey({
        schemaLayoutEngineJson,
        frontmatterModeEnabled: !!effectiveFrontmatterModeEnabled,
        documentSemanticMode: String(documentSemanticMode),
        graphMetaKey,
        renderMediaAsNodes: renderMediaAsNodes === true,
        mediaPanelDensity: String(mediaPanelDensity),
        collapsedGroupIdsKey,
        schemaNodesPresentationJson,
        schemaGroupsPresentationJson,
      })

      const stateForZoom = useGraphStore.getState()
      const z = stateForZoom.zoomStateByKey[zoomViewKey] || stateForZoom.zoomState;
      const layoutPositionCacheByMode = useGraphStore.getState().layoutPositionCacheByMode;
      const isPinned = useGraphStore.getState().viewPinned === true;
      const mode = readLayoutMode(schemaValue)
      const prevMode = lastLayoutModeRef.current
      const prevFrontmatterMode = lastFrontmatterModeRef.current
      const prevSemanticMode = lastSemanticModeRef.current
      const prevLayoutVariant = lastLayoutVariantRef.current
      const prevDatasetKey = lastDatasetKeyRef.current
      const datasetKey = computeLayoutDatasetKey({
        graphData: sceneGraphData,
        graphDataRevision: graphDataRevisionRef.current ?? graphDataRevision,
      })
      const layoutVariant = (() => {
        if (mode !== 'stratify') return ''
        return buildStratifyLayoutVariant(schemaValue)
      })()
      const initialZoomTransform = pickInitialZoomTransform({
        zoomState: z,
        pinned: isPinned,
        graphDataRevision: graphDataRevisionRef.current ?? graphDataRevision,
        nextViewportW: sceneWidth,
        nextViewportH: sceneHeight,
      })
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
      sceneCleanupRef.current = setupGraphScene({
        svgEl: svgRef.current,
        svgRef,
        graphData: sceneGraphData,
        schema: schemaValue,
        edgesForSim,
        width: sceneWidth,
        height: sceneHeight,
        hoverEnabled,
        zoomOnDoubleClick,
        renderMediaAsNodes,
        mediaPanelDensity,
        fitToScreenMode,
        initialZoomTransform,
        layoutPositionsForMode,
        prevPositions: Object.keys(prevPositions).length > 0 ? prevPositions : null,
        skipInitialLayout,
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
        addEdge: e => useGraphStore.getState().addEdge(e),
        updateEdge: (id, u) => useGraphStore.getState().updateEdge(id, u),
        setHoverInfo: updater => setHoverInfo(prev => updater(prev)),
        setLifecycleStageRendering: () => useGraphStore.getState().setLifecycleStage('rendering'),
        requestZoomSelection: () => useGraphStore.getState().requestZoom('selection'),
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
            const pinned = state.viewPinned === true
            const next = {
              ...latest,
              graphDataRevision: pinned ? undefined : graphDataRevisionRef.current,
              viewportW: sceneWidth,
              viewportH: sceneHeight,
            }
            const existing = state.zoomStateByKey?.[zoomViewKey] || state.zoomState
            if (isSameZoomState(existing || null, next)) return
            state.setZoomState(next)
            state.setZoomStateForKey(zoomViewKey, next)
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
    sceneWidth,
    sceneHeight,
    sceneGraphData,
    schemaLayoutEngineJson,
    edgesForSim,
    setLayoutPositionsForMode,
    effectiveFrontmatterModeEnabled,
    documentSemanticMode,
    canvasRenderMode,
    canvas2dRenderer,
    renderMediaAsNodes,
    mediaPanelDensity,
    schemaNodesPresentationJson,
    schemaGroupsPresentationJson,
    collapsedGroupIdsKey,
    selectedNodeIdRef,
    selectedEdgeIdRef,
    selectedNodeIdsRef,
    selectedEdgeIdsRef,
    fitToScreenMode,
  ]);

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
    updateForceSimulationPresentation({
      simulation: simulationRef.current,
      nodes: Array.isArray(sceneGraphDataRef.current.nodes) ? (sceneGraphDataRef.current.nodes as GraphNode[]) : [],
      width: sceneWidth,
      height: sceneHeight,
      schema: schemaValue,
      groupKeyOf: createLayoutGroupKeyOfNode({ graphData: sceneGraphDataRef.current, schema: schemaValue }),
    })
    updateGraphSceneNodesPresentation({
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
      requestZoomSelection: () => useGraphStore.getState().requestZoom('selection'),
      toggleGroupCollapsed: id => useGraphStore.getState().toggleGroupCollapsed(id),
    })
    nodesPresentationAppliedKeyRef.current = schemaNodesPresentationJson
  }, [schemaNodesPresentationJson, sceneWidth, sceneHeight, renderMediaAsNodes, mediaPanelDensity])

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
      className="absolute inset-0 overflow-hidden"
      role="main"
      aria-label="Graph Canvas"
    >
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full z-0"
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
