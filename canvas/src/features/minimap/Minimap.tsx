import React from 'react'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag';
import { Map as MapIcon, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import IconButton from '@/components/IconButton'
import usePersistedBoolean from '@/features/hooks/usePersistedBoolean'
import { LS_KEYS } from '@/lib/config'
import { UI_LABELS } from '@/lib/config'
import type { GraphNode, GraphEdge } from '@/lib/graph/types'
import { defaultSchema, getRendererPalette, MVP_COLOR_PALETTE } from '@/lib/graph/schema'
import { deriveSceneDisplayGraph } from '@/lib/scene/sceneDerivation'
import { buildActive2dZoomViewKey } from '@/lib/canvas/active-2d-zoom-view-key'
import { buildCollapsedGroupIdsKey } from '@/lib/canvas/collapsedGroupIdsKey'
import { buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'
import { readLayoutMode2d } from '@/lib/graph/layoutMode'
import { buildSchemaLayoutEngineJson2d } from '@/lib/canvas/schema-layout-engine-json'
import { computeLayoutDatasetKey, buildLayoutPositionCacheKey, buildLayoutViewKey } from '@/lib/canvas/layoutPositioning'
import { pickSeedFromOtherRendererCache } from '@/lib/canvas/layoutSeed'
import { computeEffectiveFrontmatterMode } from '@/lib/graph/frontmatterMode'
import {
  computeViewRect,
  computeGraphBounds,
  computeTransformFromViewTopLeft,
  computeTransformFromCenter,
  clampZoomScale,
  MINIMAP_WIDTH,
  MINIMAP_HEIGHT,
} from '@/features/minimap/math'
import { buildEdgesPathD, buildNodesPathD } from '@/features/minimap/renderer'
import { DEFAULT_FLOW_NODE_WIDTH_PX, DEFAULT_ZOOM_MIN_SCALE_HARD_CAP, readZoomScaleExtent } from '@/lib/graph/layoutDefaults'
import { computeNodeQuickEditorScale, NODE_QUICK_EDITOR_BASE_SIZE } from '@/components/FlowEditor/nodeQuickEditorZoom'
import { computeDefaultNodeQuickEditorFloatingPos, computeNodeQuickEditorMaxAnchorShiftPx } from '@/components/FlowEditor/nodeQuickEditorLayout'
import { createRafValueScheduler } from '@/lib/react/rafValueScheduler'
import { isFlowEditorCanvas2dRenderer } from '@/lib/config.render'

type ZoomT = { k: number; x: number; y: number };

type Highlight = {
  selNodes: GraphNode[];
  nbrNodes: GraphNode[];
  selEdges: GraphEdge[];
};

type ZoomTransform = ZoomT;

const requestZoomTransform = (t: ZoomTransform) => {
  useGraphStore.getState().requestZoomTransform(t)
}

function Minimap() {
  const [minimapCollapsed, setMinimapCollapsed] = usePersistedBoolean(LS_KEYS.minimapCollapsed, false)
  const rawGraphData = useGraphStore(s => s.graphData)
  const activeGraphData = useActiveGraphRenderData(true)
  const graphData = activeGraphData || rawGraphData
  const graphId = useGraphStore(s => s.graphId)
  const canvasDims = useGraphStore(s => s.canvasDims)
  const miniW = MINIMAP_WIDTH
  const miniH = MINIMAP_HEIGHT
  const zoomStateByKey = useGraphStore(s => s.zoomStateByKey)
  const { canvasRenderMode, canvas2dRenderer, documentSemanticMode, multiDimTableModeEnabled, frontmatterModeEnabled, documentStructureBaselineLock, renderMediaAsNodes, mediaPanelDensity, collapsedGroupIds, designRendererWebpageLayoutKey, infiniteCanvasInteractionMode } = useGraphStore(
    useShallow(s => ({
      canvasRenderMode: s.canvasRenderMode,
      canvas2dRenderer: s.canvas2dRenderer,
      documentSemanticMode: s.documentSemanticMode,
      multiDimTableModeEnabled: s.multiDimTableModeEnabled,
      frontmatterModeEnabled: s.frontmatterModeEnabled,
      documentStructureBaselineLock: s.documentStructureBaselineLock,
      renderMediaAsNodes: s.renderMediaAsNodes,
      mediaPanelDensity: s.mediaPanelDensity,
      collapsedGroupIds: s.collapsedGroupIds,
      designRendererWebpageLayoutKey: s.designRendererWebpageLayoutKey,
      infiniteCanvasInteractionMode: s.infiniteCanvasInteractionMode,
    })),
  )
  const preview = useGraphStore(s => s.minimapPreview)
  const requestZoom = useGraphStore(s => s.requestZoom)
  const graphDataRevision = useGraphStore(s => s.graphDataRevision)
  const layoutPositionCacheByMode = useGraphStore(s => s.layoutPositionCacheByMode)
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId)
  const uiPanelOpacity = useGraphStore(s => s.uiPanelOpacity)
  const { openQuickEditorNodeIds, flowNodeQuickEditorPinnedByNodeId, flowNodeQuickEditorPosByNodeId, flowNodeQuickEditorWorldPosByNodeId } = useGraphStore(
    useShallow(s => ({
      openQuickEditorNodeIds: s.openQuickEditorNodeIds,
      flowNodeQuickEditorPinnedByNodeId: s.flowNodeQuickEditorPinnedByNodeId,
      flowNodeQuickEditorPosByNodeId: s.flowNodeQuickEditorPosByNodeId,
      flowNodeQuickEditorWorldPosByNodeId: (s as unknown as { flowNodeQuickEditorWorldPosByNodeId?: Record<string, { x: number; y: number }> }).flowNodeQuickEditorWorldPosByNodeId,
    })),
  )

  const schema = useGraphStore(s => s.schema)
  const sceneDisplayGraphDerivation = React.useMemo(() => {
    if (!graphData) return null
    return deriveSceneDisplayGraph({ graphData })
  }, [graphData])
  const sceneGraphData = React.useMemo(() => {
    if (!graphData) return null
    return sceneDisplayGraphDerivation?.displayGraphData || graphData
  }, [graphData, sceneDisplayGraphDerivation])
  const usesDerivedSceneGraph = sceneGraphData !== graphData

  const zoomViewKey = React.useMemo(() => {
    return buildActive2dZoomViewKey({
      canvasRenderMode,
      canvas2dRenderer,
      schema,
      graphData,
      documentSemanticMode,
      frontmatterModeEnabled,
      documentStructureBaselineLock,
      renderMediaAsNodes,
      mediaPanelDensity,
      collapsedGroupIds,
      designRendererWebpageLayoutKey,
    })
  }, [
    canvas2dRenderer,
    canvasRenderMode,
    collapsedGroupIds,
    documentSemanticMode,
    documentStructureBaselineLock,
    designRendererWebpageLayoutKey,
    frontmatterModeEnabled,
    graphData,
    mediaPanelDensity,
    renderMediaAsNodes,
    schema,
  ])

  const zoomState = React.useMemo(() => {
    if (!zoomViewKey) return null
    return zoomStateByKey?.[zoomViewKey] ?? null
  }, [zoomStateByKey, zoomViewKey])

  const zoomStateRef = React.useRef<ZoomTransform | null>(zoomState ? { k: zoomState.k, x: zoomState.x, y: zoomState.y } : null)
  React.useEffect(() => {
    zoomStateRef.current = zoomState ? { k: zoomState.k, x: zoomState.x, y: zoomState.y } : null
  }, [zoomState])
  const [minScale, maxScale] = React.useMemo(() => {
    return readZoomScaleExtent(schema || defaultSchema)
  }, [schema])
  const palette = getRendererPalette(schema || null)
  const highlightColor = typeof palette.nodes.idea === 'string' && palette.nodes.idea.trim()
    ? palette.nodes.idea
    : MVP_COLOR_PALETTE.nodes.idea
  const minimapOpacity = uiPanelOpacity ?? 0.7
  const nodes = React.useMemo(() => {
    const baseNodes = Array.isArray(sceneGraphData?.nodes) ? (sceneGraphData!.nodes as GraphNode[]) : []
    if (baseNodes.length === 0) return baseNodes
    if (infiniteCanvasInteractionMode === 'interactive') return baseNodes
    const schemaEffective = schema || defaultSchema
    const semanticModeKey = multiDimTableModeEnabled ? `${String(documentSemanticMode || 'document')}:mdtbl` : String(documentSemanticMode || 'document')
    const effectiveFrontmatter = computeEffectiveFrontmatterMode({
      frontmatterModeEnabled: frontmatterModeEnabled === true && documentStructureBaselineLock !== true,
      documentSemanticMode: String(documentSemanticMode || 'document'),
      graphData,
    })
    const datasetKey = computeLayoutDatasetKey({ graphData: sceneGraphData as never, graphDataRevision: graphDataRevision || 0 })
    const layoutMode = readLayoutMode2d(schemaEffective)
    const graphMetaKey = buildGraphMetaKeyIgnoringPending(sceneGraphData as never)
    const collapsedGroupIdsKey = buildCollapsedGroupIdsKey(collapsedGroupIds)
    const viewKey = buildLayoutViewKey({
      schemaLayoutEngineJson: buildSchemaLayoutEngineJson2d(schema || null),
      frontmatterModeEnabled: effectiveFrontmatter,
      documentSemanticMode: semanticModeKey,
      graphMetaKey,
      renderMediaAsNodes: renderMediaAsNodes === true,
      mediaPanelDensity: String(mediaPanelDensity),
      collapsedGroupIdsKey,
    })
    const baseKey = buildLayoutPositionCacheKey({
      datasetKey,
      mode: layoutMode,
      frontmatterMode: effectiveFrontmatter,
      semanticMode: semanticModeKey,
      renderMode: '2d',
      renderVariant: String(canvas2dRenderer || ''),
      viewKey,
    })
    const positionSeed = pickSeedFromOtherRendererCache({
      nodes: baseNodes,
      cache: (layoutPositionCacheByMode as unknown as Record<string, Record<string, { x: number; y: number }>>) || null,
      baseKey,
    })
    if (!positionSeed) return baseNodes
    let changed = false
    const next = new Array<GraphNode>(baseNodes.length)
    for (let i = 0; i < baseNodes.length; i += 1) {
      const n = baseNodes[i]!
      const id = String(n?.id || '').trim()
      const p = id ? positionSeed[id] : null
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) {
        next[i] = n
        continue
      }
      if (typeof n.x === 'number' && Number.isFinite(n.x) && typeof n.y === 'number' && Number.isFinite(n.y)) {
        next[i] = n
        continue
      }
      if (n.x === p.x && n.y === p.y) {
        next[i] = n
        continue
      }
      changed = true
      next[i] = { ...n, x: p.x, y: p.y }
    }
    return changed ? next : baseNodes
  }, [
    canvas2dRenderer,
    collapsedGroupIds,
    defaultSchema,
    documentSemanticMode,
    documentStructureBaselineLock,
    frontmatterModeEnabled,
    graphData,
    graphDataRevision,
    infiniteCanvasInteractionMode,
    layoutPositionCacheByMode,
    mediaPanelDensity,
    multiDimTableModeEnabled,
    renderMediaAsNodes,
    sceneGraphData,
    schema,
  ]);
  const edges = React.useMemo(
    () => (Array.isArray(sceneGraphData?.edges) ? (sceneGraphData!.edges as GraphEdge[]) : []),
    [sceneGraphData],
  );

  const flowEditorOverlaySubset = React.useMemo(() => {
    const isFlowEditor = isFlowEditorCanvas2dRenderer(canvas2dRenderer)
    const ids = Array.isArray(openQuickEditorNodeIds) ? openQuickEditorNodeIds.map(v => String(v || '').trim()).filter(Boolean) : []
    if (!isFlowEditor || ids.length === 0) return null
    const zoom = zoomState || { k: 1, x: 0, y: 0 }
    const k = typeof zoom.k === 'number' && Number.isFinite(zoom.k) && zoom.k > 0 ? zoom.k : 1
    const tx = typeof zoom.x === 'number' && Number.isFinite(zoom.x) ? zoom.x : 0
    const ty = typeof zoom.y === 'number' && Number.isFinite(zoom.y) ? zoom.y : 0
    const nodeById = new Map<string, GraphNode>()
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const id = String(n?.id || '').trim()
      if (id) nodeById.set(id, n)
    }
    const pinnedById = flowNodeQuickEditorPinnedByNodeId || {}
    const posById = flowNodeQuickEditorPosByNodeId || {}
    const worldById = flowNodeQuickEditorWorldPosByNodeId || {}
    const port = schema?.behavior?.portHandles || null
    const portEnabled = Boolean((port as { enabled?: unknown } | null)?.enabled)
    const portSizePx =
      typeof (port as { size?: unknown } | null)?.size === 'number' && Number.isFinite((port as { size: number }).size)
        ? Math.max(0, (port as { size: number }).size)
        : 4
    const portOffsetPx =
      typeof (port as { offset?: unknown } | null)?.offset === 'number' && Number.isFinite((port as { offset: number }).offset)
        ? Math.max(0, (port as { offset: number }).offset)
        : 2
    const portExtraPadScreenPx = portEnabled ? portSizePx + portOffsetPx + 8 : 0
    const [schemaMinK, schemaMaxK] = readZoomScaleExtent(schema || defaultSchema)
    const extent = { minK: Math.min(schemaMinK, DEFAULT_ZOOM_MIN_SCALE_HARD_CAP), maxK: schemaMaxK }

    const overlayNodes: GraphNode[] = []
    const idSet = new Set(ids)
    for (let stackIndex = 0; stackIndex < ids.length; stackIndex += 1) {
      const id = ids[stackIndex]!
      const node = nodeById.get(id)
      if (!node) continue
      const pinnedInCanvas = typeof pinnedById[id] === 'boolean' ? pinnedById[id] : true
      const floating = !pinnedInCanvas
      const panelScale = computeNodeQuickEditorScale(k, extent, { mode: 'pinnedInCanvas' })
      const wPx = NODE_QUICK_EDITOR_BASE_SIZE.width * panelScale
      const hPx = NODE_QUICK_EDITOR_BASE_SIZE.height * panelScale
      const stackCol = stackIndex % 3
      const stackRow = Math.floor(stackIndex / 3)
      const stackTopPx = stackIndex <= 0 ? 0 : stackRow * 54 + stackCol * 8
      const stackLeftPx = stackIndex <= 0 ? 0 : stackCol * 54
      const leftTopPx = (() => {
        if (floating) {
          const stored = posById[id]
          const fallback = computeDefaultNodeQuickEditorFloatingPos({ stackIndex, viewportW: canvasDims.w, viewportH: canvasDims.h })
          const left = stored && typeof stored.left === 'number' && Number.isFinite(stored.left) ? stored.left : fallback.left
          const top = stored && typeof stored.top === 'number' && Number.isFinite(stored.top) ? stored.top : fallback.top
          return { left, top }
        }
        const stored = worldById[id] as { x?: unknown; y?: unknown } | null
        const x = typeof stored?.x === 'number' && Number.isFinite(stored.x) ? (stored.x as number) : null
        const y = typeof stored?.y === 'number' && Number.isFinite(stored.y) ? (stored.y as number) : null
        if (x != null && y != null) {
          return { left: tx + x * k, top: ty + y * k }
        }
        const nx = typeof node.x === 'number' && Number.isFinite(node.x) ? node.x : 0
        const ny = typeof node.y === 'number' && Number.isFinite(node.y) ? node.y : 0
        const nodeLeftPx = tx + nx * k
        const nodeTopPx = ty + ny * k
        const anchoredLeftPx = nodeLeftPx + DEFAULT_FLOW_NODE_WIDTH_PX * k + 16 + portExtraPadScreenPx
        const anchoredTopPx = nodeTopPx - 12
        return {
          left: anchoredLeftPx + stackLeftPx,
          top: anchoredTopPx + stackTopPx,
        }
      })()
      const cxWorld = (leftTopPx.left + wPx / 2 - tx) / k
      const cyWorld = (leftTopPx.top + hPx / 2 - ty) / k
      overlayNodes.push({
        id: `__qe:${id}`,
        type: 'FlowQuickEditor' as unknown as string,
        x: cxWorld,
        y: cyWorld,
        label: '',
      } as unknown as GraphNode)
    }

    const overlayEdges: GraphEdge[] = []
    for (let i = 0; i < edges.length; i += 1) {
      const e = edges[i]
      const s = String(e?.source || '').trim()
      const t = String(e?.target || '').trim()
      if (!s || !t) continue
      if (!idSet.has(s) || !idSet.has(t)) continue
      overlayEdges.push({
        ...e,
        source: `__qe:${s}`,
        target: `__qe:${t}`,
      })
    }

    return { nodes: overlayNodes, edges: overlayEdges }
  }, [
    canvas2dRenderer,
    canvasDims.h,
    canvasDims.w,
    defaultSchema,
    edges,
    flowNodeQuickEditorPinnedByNodeId,
    flowNodeQuickEditorPosByNodeId,
    flowNodeQuickEditorWorldPosByNodeId,
    nodes,
    openQuickEditorNodeIds,
    schema,
    zoomState,
  ])

  const nodesForBounds = flowEditorOverlaySubset ? [...nodes, ...flowEditorOverlaySubset.nodes] : nodes
  const graphBounds = flowEditorOverlaySubset ? computeGraphBounds(nodesForBounds, 20) : (preview?.bounds ?? computeGraphBounds(nodes, 20));
  const viewRectWorld = React.useMemo(() => {
    const z = zoomState || { k: 1, x: 0, y: 0 };
    return computeViewRect(Math.max(1, canvasDims.w), Math.max(1, canvasDims.h), z.k, z.x, z.y, 1);
  }, [canvasDims, zoomState]);
  const bounds = React.useMemo(() => {
    const vrMinX = viewRectWorld.x;
    const vrMinY = viewRectWorld.y;
    const vrMaxX = viewRectWorld.x + viewRectWorld.w;
    const vrMaxY = viewRectWorld.y + viewRectWorld.h;
    const minX = Math.min(graphBounds.minX, vrMinX);
    const minY = Math.min(graphBounds.minY, vrMinY);
    const maxX = Math.max(graphBounds.maxX, vrMaxX);
    const maxY = Math.max(graphBounds.maxY, vrMaxY);
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    return { minX, minY, maxX, maxY, width, height };
  }, [graphBounds.maxX, graphBounds.maxY, graphBounds.minX, graphBounds.minY, viewRectWorld.h, viewRectWorld.w, viewRectWorld.x, viewRectWorld.y]);
  const sx = React.useMemo(() => {
    const scaleX = miniW / Math.max(1, bounds.width);
    const scaleY = miniH / Math.max(1, bounds.height);
    return Math.min(scaleX, scaleY);
  }, [bounds.height, bounds.width, miniH, miniW]);

  const canUsePreview = React.useMemo(() => {
    if (flowEditorOverlaySubset) return false
    if (usesDerivedSceneGraph) return false
    if (graphData !== rawGraphData) return false
    if (infiniteCanvasInteractionMode === 'interactive') return false
    if (canvas2dRenderer !== 'd3') return false
    const b = preview?.bounds;
    if (!b) return false;
    return (
      Math.abs(b.minX - bounds.minX) < 1e-6
      && Math.abs(b.minY - bounds.minY) < 1e-6
      && Math.abs(b.maxX - bounds.maxX) < 1e-6
      && Math.abs(b.maxY - bounds.maxY) < 1e-6
    );
  }, [bounds.maxX, bounds.maxY, bounds.minX, bounds.minY, canvas2dRenderer, flowEditorOverlaySubset, graphData, infiniteCanvasInteractionMode, preview?.bounds, rawGraphData, usesDerivedSceneGraph]);

  const EDGE_LIMIT = 20000;
  const edgesPathD = React.useMemo(() => {
    if (canUsePreview && preview?.edgesPath) return preview.edgesPath as string;
    return edges.length > EDGE_LIMIT ? '' : buildEdgesPathD(nodes, edges, bounds, sx, graphId ?? '');
  }, [canUsePreview, nodes, edges, bounds, sx, preview?.edgesPath, graphId]);
  const nodesPathD = React.useMemo(() => {
    if (canUsePreview && preview?.nodesPath) return preview.nodesPath as string;
    return buildNodesPathD(nodes, bounds, sx, 3, graphId ?? '');
  }, [canUsePreview, nodes, bounds, sx, preview?.nodesPath, graphId]);

  const overlayEdgesPathD = React.useMemo(() => {
    const overlay = flowEditorOverlaySubset
    if (!overlay) return ''
    return overlay.edges.length > EDGE_LIMIT ? '' : buildEdgesPathD(overlay.nodes, overlay.edges, bounds, sx, `qe:${graphId ?? ''}`)
  }, [bounds, flowEditorOverlaySubset, graphId, sx])
  const overlayNodesPathD = React.useMemo(() => {
    const overlay = flowEditorOverlaySubset
    if (!overlay) return ''
    return buildNodesPathD(overlay.nodes, bounds, sx, 2, `qe:${graphId ?? ''}`)
  }, [bounds, flowEditorOverlaySubset, graphId, sx])

  const highlight: Highlight = React.useMemo(() => {
    if (!selectedNodeId && !selectedEdgeId) return { selNodes: [], nbrNodes: [], selEdges: [] };
    if (selectedNodeId) {
      const nbr = new Set<string>();
      for (let i = 0; i < edges.length; i++) {
        const e = edges[i];
        const s = String(e.source);
        const t = String(e.target);
        if (s === selectedNodeId) nbr.add(t);
        if (t === selectedNodeId) nbr.add(s);
      }
      const selNodes = nodes.filter((n) => n.id === selectedNodeId);
      const nbrNodes = nodes.filter((n) => nbr.has(n.id));
      const selEdges = edges.filter((e) => e.source === selectedNodeId || e.target === selectedNodeId);
      return { selNodes, nbrNodes, selEdges };
    }
    if (selectedEdgeId) {
      const eSel = edges.find((e) => e.id === selectedEdgeId);
      if (!eSel) return { selNodes: [], nbrNodes: [], selEdges: [] };
      const sId = String(eSel.source);
      const tId = String(eSel.target);
      const selNodes = nodes.filter((n) => n.id === sId || n.id === tId);
      const nbrNodes: GraphNode[] = [];
      const selEdges = [eSel];
      return { selNodes, nbrNodes, selEdges };
    }
    return { selNodes: [], nbrNodes: [], selEdges: [] };
  }, [selectedNodeId, selectedEdgeId, nodes, edges]);

  const selNodesPathD = React.useMemo(
    () => (highlight.selNodes.length ? buildNodesPathD(highlight.selNodes, bounds, sx, 4, graphId ?? '') : ''),
    [highlight.selNodes, bounds, sx, graphId]
  );
  const nbrNodesPathD = React.useMemo(
    () => (highlight.nbrNodes.length ? buildNodesPathD(highlight.nbrNodes, bounds, sx, 3, graphId ?? '') : ''),
    [highlight.nbrNodes, bounds, sx, graphId]
  );
  const selEdgesPathD = React.useMemo(
    () => (highlight.selEdges.length ? buildEdgesPathD(nodes, highlight.selEdges, bounds, sx, graphId ?? '') : ''),
    [nodes, highlight.selEdges, bounds, sx, graphId]
  );

  const viewRectRaw = React.useMemo(() => {
    return { x: viewRectWorld.x, y: viewRectWorld.y, w: viewRectWorld.w, h: viewRectWorld.h };
  }, [viewRectWorld.h, viewRectWorld.w, viewRectWorld.x, viewRectWorld.y]);

  const viewRect = React.useMemo(() => ({
    x: (viewRectRaw.x - bounds.minX) * sx,
    y: (viewRectRaw.y - bounds.minY) * sx,
    w: viewRectRaw.w * sx,
    h: viewRectRaw.h * sx,
  }), [viewRectRaw, bounds, sx]);

  const centerThreshold = React.useMemo(() => {
    const minSide = Math.min(viewRect.w, viewRect.h);
    const base = Math.max(4, minSide * 0.06);
    const k = zoomState?.k ?? 1;
    const scale = k < 0.3 ? (0.3 / Math.max(k, 0.1)) : 1;
    return Math.min(14, base * scale);
  }, [viewRect, zoomState]);

  const dragRef = React.useRef<{ mx: number; my: number; gx: number; gy: number } | null>(null);


  const onMinimapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = (e.target as SVGElement).closest('svg')!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cx = mx / sx + bounds.minX;
    const cy = my / sx + bounds.minY;
    const z: ZoomT = zoomState || { k: 1, x: 0, y: 0 };
    const k = z.k || 1;
    const x = -cx * k + (canvasDims.w / 2);
    const y = -cy * k + (canvasDims.h / 2);
    requestZoomTransform({ k, x, y });
  };

  const onMinimapWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    dragRef.current = null;
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const ux = mx / sx + bounds.minX;
    const uy = my / sx + bounds.minY;
    const z: ZoomT = zoomState || { k: 1, x: 0, y: 0 };
    const k0 = z.k || 1;
    const factor = Math.pow(1.2, -e.deltaY / 100);
    const k1 = clampZoomScale(k0 * factor, minScale, maxScale)
    const t = computeTransformFromCenter(
      Math.max(1, canvasDims.w),
      Math.max(1, canvasDims.h),
      ux,
      uy,
      k1,
      { minScale, maxScale },
    )
    requestZoomTransform(t);
  };

  const onRectPointerDown = (e: React.PointerEvent<SVGRectElement>) => {
    e.preventDefault();
    const svgEl = (e.currentTarget as SVGGraphicsElement).ownerSVGElement as (SVGSVGElement | null);
    if (!svgEl) return;
    const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const lx = e.clientX - r.left;
    const ly = e.clientY - r.top;
    const cx = viewRect.w / 2;
    const cy = viewRect.h / 2;
    const nearCenter = Math.abs(lx - cx) <= centerThreshold && Math.abs(ly - cy) <= centerThreshold;
    if (!nearCenter) return;
    const rect = svgEl.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    dragRef.current = { mx, my, gx: viewRectRaw.x, gy: viewRectRaw.y };

    const scheduler = createRafValueScheduler((p: { ngx: number; ngy: number }) => {
      const z = zoomStateRef.current || { k: 1, x: 0, y: 0 }
      const t = computeTransformFromViewTopLeft(Math.max(1, canvasDims.w), Math.max(1, canvasDims.h), z.k, p.ngx, p.ngy)
      const EPS = 0.5
      const nearlySame =
        Math.abs(t.x - z.x) < EPS && Math.abs(t.y - z.y) < EPS && Math.abs((t.k || 1) - (z.k || 1)) < 1e-9
      if (!nearlySame) requestZoomTransform(t)
    })

    startPointerDrag({
      ev: e.nativeEvent,
      cursor: 'grabbing',
      shouldStart: (down) => {
        if (down.pointerType === 'mouse' && down.button !== 0) return false;
        return true;
      },
      onMove: (mv) => {
        if (!dragRef.current) return;
        const owner = (e.currentTarget as SVGGraphicsElement).ownerSVGElement as (SVGSVGElement | null);
        if (!owner) return;
        const mrect = owner.getBoundingClientRect();
        const curMx = mv.clientX - mrect.left;
        const curMy = mv.clientY - mrect.top;
        const dx = curMx - dragRef.current.mx;
        const dy = curMy - dragRef.current.my;
        const dxg = dx / sx;
        const dyg = dy / sx;
        const ngx = dragRef.current.gx + dxg;
        const ngy = dragRef.current.gy + dyg;
        scheduler.schedule({ ngx, ngy })
      },
      onEnd: (up) => {
        const owner = (e.currentTarget as SVGGraphicsElement).ownerSVGElement as (SVGSVGElement | null);
        const rect = owner?.getBoundingClientRect();
        const hasPos = rect != null;
        const z = zoomStateRef.current || { k: 1, x: 0, y: 0 };
        const k = z.k || 1;
        if (hasPos) {
          const mx = up.clientX - (rect as DOMRect).left;
          const my = up.clientY - (rect as DOMRect).top;
          const ux = mx / sx + bounds.minX;
          const uy = my / sx + bounds.minY;
          const vw = Math.max(1, canvasDims.w);
          const vh = Math.max(1, canvasDims.h);
          const kk = clampZoomScale(k, minScale, maxScale)
          const t = computeTransformFromCenter(vw, vh, ux, uy, kk, { minScale, maxScale });
          const EPS = 0.5;
          const nearlySame = Math.abs(t.x - z.x) < EPS && Math.abs(t.y - z.y) < EPS && Math.abs((t.k || 1) - (z.k || 1)) < 1e-9;
          if (!nearlySame) {
            requestZoomTransform(t);
          }
        }
        dragRef.current = null;
        scheduler.cancel()
      },
      onCancel: () => {
        dragRef.current = null;
        scheduler.cancel()
      },
    });
  };

  const onRectPointerMove = (e: React.PointerEvent<SVGRectElement>) => {
    if (dragRef.current) return;
    const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const lx = e.clientX - r.left;
    const ly = e.clientY - r.top;
    const cx = viewRect.w / 2;
    const cy = viewRect.h / 2;
    const isCenter = Math.abs(lx - cx) <= centerThreshold && Math.abs(ly - cy) <= centerThreshold;
    setHoverCenter(isCenter);
  };

  const [hoverCenter, setHoverCenter] = React.useState(false);
  const isNearCenter = React.useCallback((lx: number, ly: number) => {
    const cx = viewRect.w / 2;
    const cy = viewRect.h / 2;
    return Math.abs(lx - cx) <= centerThreshold && Math.abs(ly - cy) <= centerThreshold;
  }, [viewRect, centerThreshold]);
  const onRectMouseLeave = () => setHoverCenter(false);
  const handleReset = React.useCallback(() => requestZoom('reset'), [requestZoom])
  const handleZoomIn = React.useCallback(() => requestZoom('in'), [requestZoom])
  const handleZoomOut = React.useCallback(() => requestZoom('out'), [requestZoom])

  if (minimapCollapsed) {
    return (
      <IconButton
        title="Show Minimap"
        onClick={() => setMinimapCollapsed(false)}
        className="p-1"
        showTooltip={false}
        style={{ opacity: minimapOpacity }}
      >
        <MapIcon size={14} aria-hidden="true" />
      </IconButton>
    )
  }

  return (
    <aside className="relative group" aria-label="Minimap">
      <div className="relative rounded bg-white backdrop-blur-sm shadow border border-gray-200 overflow-hidden" style={{ opacity: minimapOpacity }}>
        <svg width={miniW} height={miniH} onClick={onMinimapClick} onWheel={onMinimapWheel} className="relative block">
          <rect x={0} y={0} width={miniW} height={miniH} fill="#f8fafc" />
          {edgesPathD && (
            <path d={edgesPathD} stroke="#94a3b8" strokeWidth={1} strokeOpacity={0.6} fill="none" pointerEvents="none" shapeRendering="crispEdges" />
          )}
          {nodesPathD && (
            <path d={nodesPathD} fill="#334155" stroke="none" pointerEvents="none" />
          )}
          {overlayEdgesPathD && (
            <path d={overlayEdgesPathD} stroke="#0f172a" strokeWidth={1} strokeOpacity={0.35} fill="none" pointerEvents="none" shapeRendering="crispEdges" />
          )}
          {overlayNodesPathD && (
            <path d={overlayNodesPathD} fill="#0f172a" fillOpacity={0.35} stroke="none" pointerEvents="none" />
          )}
          {selEdgesPathD && (
            <path d={selEdgesPathD} stroke={highlightColor} strokeWidth={1.5} strokeOpacity={0.9} fill="none" pointerEvents="none" shapeRendering="crispEdges" />
          )}
          {nbrNodesPathD && (
            <path d={nbrNodesPathD} fill={palette.nodes.execution} stroke="none" pointerEvents="none" />
          )}
          {selNodesPathD && (
            <path d={selNodesPathD} fill={highlightColor} stroke="none" pointerEvents="none" />
          )}
          <rect
            x={viewRect.x}
            y={viewRect.y}
            width={viewRect.w}
            height={viewRect.h}
            fill="none"
            stroke={highlightColor}
            strokeWidth={1}
            style={{ cursor: dragRef.current ? 'grabbing' : (hoverCenter ? 'grab' : 'auto'), touchAction: 'none' }}
            onPointerDown={onRectPointerDown}
            onPointerMove={onRectPointerMove}
            onPointerLeave={() => setHoverCenter(false)}
            onMouseLeave={onRectMouseLeave}
          />
          {hoverCenter && (
            <g transform={`translate(${viewRect.x + viewRect.w / 2}, ${viewRect.y + viewRect.h / 2})`}>
              <line x1={-6} y1={0} x2={6} y2={0} stroke={highlightColor} strokeWidth={1} />
              <line x1={0} y1={-6} x2={0} y2={6} stroke={highlightColor} strokeWidth={1} />
            </g>
          )}
        </svg>
      </div>
      <div className="absolute top-1 right-1 flex flex-col items-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <IconButton
          title="Hide Minimap"
          onClick={() => setMinimapCollapsed(true)}
          className="p-1"
          showTooltip={false}
        >
          <MapIcon size={14} aria-hidden="true" />
        </IconButton>
        <IconButton
          title={UI_LABELS.reset}
          onClick={handleReset}
          className="p-1"
          showTooltip={false}
        >
          <RotateCcw size={14} aria-hidden="true" />
        </IconButton>
        <IconButton
          title={UI_LABELS.zoomIn}
          onClick={handleZoomIn}
          className="p-1"
          showTooltip={false}
        >
          <ZoomIn size={14} aria-hidden="true" />
        </IconButton>
        <IconButton
          title={UI_LABELS.zoomOut}
          onClick={handleZoomOut}
          className="p-1"
          showTooltip={false}
        >
          <ZoomOut size={14} aria-hidden="true" />
        </IconButton>
      </div>
    </aside>
  );
}

export default React.memo(Minimap)
