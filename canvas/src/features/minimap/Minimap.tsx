import React from 'react'
import { Map } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import IconButton from '@/components/IconButton'
import usePersistedBoolean from '@/features/hooks/usePersistedBoolean'
import { LS_KEYS } from '@/lib/config'
import type { GraphNode, GraphEdge } from '@/lib/graph/types'
import { defaultSchema, getRendererPalette, MVP_COLOR_PALETTE } from '@/lib/graph/schema'
import { buildActive2dZoomViewKey } from '@/lib/canvas/active-2d-zoom-view-key'
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
import { readZoomScaleExtent } from '@/lib/graph/layoutDefaults'

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
  const graphData = useGraphStore(s => s.graphData)
  const graphId = useGraphStore(s => s.graphId)
  const canvasDims = useGraphStore(s => s.canvasDims)
  const miniW = MINIMAP_WIDTH
  const miniH = MINIMAP_HEIGHT
  const zoomStateByKey = useGraphStore(s => s.zoomStateByKey)
  const { canvasRenderMode, canvas2dRenderer, documentSemanticMode, frontmatterModeEnabled, documentStructureBaselineLock, renderMediaAsNodes, mediaPanelDensity, collapsedGroupIds } = useGraphStore(
    useShallow(s => ({
      canvasRenderMode: s.canvasRenderMode,
      canvas2dRenderer: s.canvas2dRenderer,
      documentSemanticMode: s.documentSemanticMode,
      frontmatterModeEnabled: s.frontmatterModeEnabled,
      documentStructureBaselineLock: s.documentStructureBaselineLock,
      renderMediaAsNodes: s.renderMediaAsNodes,
      mediaPanelDensity: s.mediaPanelDensity,
      collapsedGroupIds: s.collapsedGroupIds,
    })),
  )
  const preview = useGraphStore(s => s.minimapPreview)
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId)
  const uiPanelOpacity = useGraphStore(s => s.uiPanelOpacity)

  const schema = useGraphStore(s => s.schema)

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
    })
  }, [
    canvas2dRenderer,
    canvasRenderMode,
    collapsedGroupIds,
    documentSemanticMode,
    documentStructureBaselineLock,
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
  const nodes = React.useMemo(
    () => (Array.isArray(graphData?.nodes) ? (graphData!.nodes as GraphNode[]) : []),
    [graphData],
  );
  const edges = React.useMemo(
    () => (Array.isArray(graphData?.edges) ? (graphData!.edges as GraphEdge[]) : []),
    [graphData],
  );
  const bounds = preview?.bounds ?? computeGraphBounds(nodes, 20);
  const sx = preview?.sx ?? (() => {
    const scaleX = miniW / Math.max(1, bounds.width);
    const scaleY = miniH / Math.max(1, bounds.height);
    return Math.min(scaleX, scaleY);
  })();

  const EDGE_LIMIT = 20000;
  const edgesPathD = React.useMemo(() => {
    if (preview?.edgesPath) return preview.edgesPath as string;
    return edges.length > EDGE_LIMIT ? '' : buildEdgesPathD(nodes, edges, bounds, sx, graphId ?? '');
  }, [nodes, edges, bounds, sx, preview?.edgesPath, graphId]);
  const nodesPathD = React.useMemo(() => {
    if (preview?.nodesPath) return preview.nodesPath as string;
    return buildNodesPathD(nodes, bounds, sx, 3, graphId ?? '');
  }, [nodes, bounds, sx, preview?.nodesPath, graphId]);

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
    const z = zoomState || { k: 1, x: 0, y: 0 };
    const vr = computeViewRect(Math.max(1, canvasDims.w), Math.max(1, canvasDims.h), z.k, z.x, z.y, 1);
    const gx = Math.max(bounds.minX, Math.min(vr.x, bounds.maxX - vr.w));
    const gy = Math.max(bounds.minY, Math.min(vr.y, bounds.maxY - vr.h));
    return { x: gx, y: gy, w: vr.w, h: vr.h };
  }, [canvasDims, zoomState, bounds]);

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
  const dragPidRef = React.useRef<number | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const pendingRef = React.useRef<{ ngx: number; ngy: number } | null>(null);

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
    dragPidRef.current = e.pointerId;
    try { (e.currentTarget as SVGRectElement).setPointerCapture(e.pointerId); } catch { void 0 }
  };

  const onRectPointerMove = (e: React.PointerEvent<SVGRectElement>) => {
    e.preventDefault();
    if (!dragRef.current) {
      const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
      const lx = e.clientX - r.left;
      const ly = e.clientY - r.top;
      const cx = viewRect.w / 2;
      const cy = viewRect.h / 2;
      const isCenter = Math.abs(lx - cx) <= centerThreshold && Math.abs(ly - cy) <= centerThreshold;
      setHoverCenter(isCenter);
      return;
    }
    if (dragPidRef.current != null && e.pointerId !== dragPidRef.current) return;
    const svgEl = (e.currentTarget as SVGGraphicsElement).ownerSVGElement as (SVGSVGElement | null);
    if (!svgEl) return;
    const mrect = svgEl.getBoundingClientRect();
    const curMx = e.clientX - mrect.left;
    const curMy = e.clientY - mrect.top;
    const dx = curMx - dragRef.current.mx;
    const dy = curMy - dragRef.current.my;
    const dxg = dx / sx;
    const dyg = dy / sx;
    const w0 = viewRectRaw.w;
    const h0 = viewRectRaw.h;
    const ngx = Math.max(bounds.minX, Math.min(dragRef.current.gx + dxg, bounds.maxX - w0));
    const ngy = Math.max(bounds.minY, Math.min(dragRef.current.gy + dyg, bounds.maxY - h0));
    pendingRef.current = { ngx, ngy };
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(() => {
        const p = pendingRef.current;
        if (p) {
          const z = zoomStateRef.current || { k: 1, x: 0, y: 0 };
          const t = computeTransformFromViewTopLeft(Math.max(1, canvasDims.w), Math.max(1, canvasDims.h), z.k, p.ngx, p.ngy);
          const EPS = 0.5;
          const nearlySame = Math.abs(t.x - z.x) < EPS && Math.abs(t.y - z.y) < EPS && Math.abs((t.k || 1) - (z.k || 1)) < 1e-9;
          if (!nearlySame) {
            requestZoomTransform(t);
          }
        }
        rafRef.current = null;
      });
    }
  };

  const onRectPointerUp = (e: React.PointerEvent<SVGRectElement>) => {
    if ((e.currentTarget as SVGRectElement).hasPointerCapture?.(e.pointerId)) {
      try { (e.currentTarget as SVGRectElement).releasePointerCapture(e.pointerId); } catch { void 0 }
    }
    const svgEl = (e.currentTarget as SVGGraphicsElement).ownerSVGElement as (SVGSVGElement | null);
    const rect = svgEl?.getBoundingClientRect();
    const hasPos = rect != null;
    const z = zoomStateRef.current || { k: 1, x: 0, y: 0 };
    const k = z.k || 1;
    if (hasPos) {
      const mx = e.clientX - (rect as DOMRect).left;
      const my = e.clientY - (rect as DOMRect).top;
      const ux = mx / sx + bounds.minX;
      const uy = my / sx + bounds.minY;
      const vw = Math.max(1, canvasDims.w);
      const vh = Math.max(1, canvasDims.h);
      const kk = clampZoomScale(k, minScale, maxScale)
      const w0 = vw / kk;
      const h0 = vh / kk;
      const minCX = bounds.minX + w0 / 2;
      const maxCX = bounds.maxX - w0 / 2;
      const minCY = bounds.minY + h0 / 2;
      const maxCY = bounds.maxY - h0 / 2;
      const cx = Math.max(minCX, Math.min(ux, maxCX));
      const cy = Math.max(minCY, Math.min(uy, maxCY));
      const t = computeTransformFromCenter(vw, vh, cx, cy, kk, { minScale, maxScale });
      const EPS = 0.5;
      const nearlySame = Math.abs(t.x - z.x) < EPS && Math.abs(t.y - z.y) < EPS && Math.abs((t.k || 1) - (z.k || 1)) < 1e-9;
      if (!nearlySame) {
        requestZoomTransform(t);
      }
    }
    dragRef.current = null;
    dragPidRef.current = null;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pendingRef.current = null;
  };

  const onRectPointerCancel = () => {
    dragRef.current = null;
    dragPidRef.current = null;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pendingRef.current = null;
  };

  const onRectLostCapture = () => {
    dragRef.current = null;
    dragPidRef.current = null;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pendingRef.current = null;
  };

  const onRectPointerEnter = (e: React.PointerEvent<SVGRectElement>) => {
    if (!(e.buttons & 1) || dragRef.current) return;
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
    dragPidRef.current = e.pointerId;
    try { (e.currentTarget as SVGRectElement).setPointerCapture(e.pointerId); } catch { void 0 }
  };

  const onRectPointerLeave = (e: React.PointerEvent<SVGRectElement>) => {
    if ((e.currentTarget as SVGRectElement).hasPointerCapture?.(e.pointerId)) {
      try { (e.currentTarget as SVGRectElement).releasePointerCapture(e.pointerId); } catch { void 0 }
    }
    dragRef.current = null;
    dragPidRef.current = null;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pendingRef.current = null;
  };

  const [hoverCenter, setHoverCenter] = React.useState(false);
  const isNearCenter = React.useCallback((lx: number, ly: number) => {
    const cx = viewRect.w / 2;
    const cy = viewRect.h / 2;
    return Math.abs(lx - cx) <= centerThreshold && Math.abs(ly - cy) <= centerThreshold;
  }, [viewRect, centerThreshold]);
  const onRectMouseMove = (e: React.MouseEvent<SVGRectElement>) => {
    if (dragRef.current) return;
    const rectEl = e.currentTarget as SVGRectElement;
    const rect = rectEl.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const isCenter = isNearCenter(localX, localY);
    setHoverCenter(isCenter);
  };
  const onRectMouseLeave = () => setHoverCenter(false);

  if (minimapCollapsed) {
    return (
      <IconButton
        title="Show Minimap"
        onClick={() => setMinimapCollapsed(false)}
        className="p-1"
        showTooltip={false}
        style={{ opacity: minimapOpacity }}
      >
        <Map size={14} aria-hidden="true" />
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
            onPointerUp={onRectPointerUp}
            onPointerCancel={onRectPointerCancel}
            onLostPointerCapture={onRectLostCapture}
            onPointerEnter={(e) => {
              const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
              const lx = e.clientX - r.left;
              const ly = e.clientY - r.top;
              const near = isNearCenter(lx, ly);
              setHoverCenter(near);
              if (!(e.buttons & 1) || dragRef.current || !near) return;
              onRectPointerEnter(e);
            }}
            onPointerLeave={onRectPointerLeave}
            onMouseMove={onRectMouseMove}
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
      <IconButton
        title="Hide Minimap"
        onClick={() => setMinimapCollapsed(true)}
        className="absolute top-1 right-1 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
        showTooltip={false}
      >
        <Map size={14} aria-hidden="true" />
      </IconButton>
    </aside>
  );
}

export default React.memo(Minimap)
