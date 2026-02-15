import React, { useEffect, useMemo, useRef } from 'react'
import * as d3 from 'd3'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useContainerDims } from '@/hooks/useContainerDims'
import { applyZoomRequest } from '@/components/GraphCanvas/zoomController'
import { buildActive2dZoomViewKey } from '@/lib/canvas/active-2d-zoom-view-key'
import { pickZoomStateForView } from '@/lib/canvas/zoom-effective'
import { pickInitialZoomTransform } from '@/lib/zoom/viewport'
import { commitZoomTransformToStore } from '@/lib/canvas/zoom-commit'
import { CANVAS_INTERACTIVE_CLASS, CANVAS_SURFACE_CLASS } from '@/lib/canvas/surface'

import type { GraphData } from '@/lib/graph/types'
import type { ZoomRequest } from '@/lib/zoom/requests'
import type { DesignLayerState } from '@/features/design/designLayersState'

type FrameNode = {
  id: string
  label: string
}

function coerceFrameNodes(nodes: Array<{ id?: unknown; label?: unknown }> | null | undefined): FrameNode[] {
  const src = Array.isArray(nodes) ? nodes : []
  const out: FrameNode[] = []
  for (let i = 0; i < src.length; i += 1) {
    const rawId = src[i]?.id
    const id = typeof rawId === 'string' ? rawId : String(rawId || '').trim()
    if (!id) continue
    const rawLabel = src[i]?.label
    const label = typeof rawLabel === 'string' && rawLabel.trim() ? rawLabel.trim() : id
    out.push({ id, label })
  }
  out.sort((a, b) => a.label.localeCompare(b.label))
  return out
}

function computeGridPositions(args: { nodes: FrameNode[]; colCount: number; colW: number; rowH: number; pad: number }):
  Record<string, { x: number; y: number; w: number; h: number }> {
  const nodes = args.nodes
  const cols = Math.max(1, Math.floor(args.colCount))
  const colW = Math.max(80, Math.floor(args.colW))
  const rowH = Math.max(64, Math.floor(args.rowH))
  const pad = Math.max(8, Math.floor(args.pad))
  const pos: Record<string, { x: number; y: number; w: number; h: number }> = {}

  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const col = i % cols
    const row = Math.floor(i / cols)
    pos[n.id] = {
      x: col * (colW + pad),
      y: row * (rowH + pad),
      w: colW,
      h: rowH,
    }
  }
  return pos
}

export default function DesignCanvas({
  active = true,
  layerState,
}: {
  active?: boolean
  layerState?: DesignLayerState
}) {
  const containerRef = useRef<HTMLElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const dims = useContainerDims(containerRef)

  const snapshot = useGraphStore(
    useShallow(s => ({
      graphData: s.graphData,
      graphDataRevision: s.graphDataRevision,
      schema: s.schema,
      canvasRenderMode: s.canvasRenderMode,
      canvas2dRenderer: s.canvas2dRenderer,
      documentSemanticMode: s.documentSemanticMode,
      frontmatterModeEnabled: s.frontmatterModeEnabled,
      documentStructureBaselineLock: s.documentStructureBaselineLock,
      renderMediaAsNodes: s.renderMediaAsNodes,
      mediaPanelDensity: s.mediaPanelDensity,
      collapsedGroupIds: s.collapsedGroupIds,
      zoomStateByKey: s.zoomStateByKey,
      viewPinned: s.viewPinned,
      fitToScreenMode: s.fitToScreenMode,
      zoomToSelectionMode: s.zoomToSelectionMode,
      selectedNodeId: s.selectedNodeId,
    })),
  )

  const frameNodes = useMemo(() => coerceFrameNodes(snapshot.graphData?.nodes as never), [snapshot.graphData])

  const FRAME_W = 320
  const FRAME_H = 240
  const GAP = 48

  const sortedNodes = useMemo(() => {
    const order = Array.isArray(layerState?.order) ? layerState!.order : []
    if (order.length === 0) return frameNodes
    const byId = new Map(frameNodes.map(n => [n.id, n] as const))
    const used = new Set<string>()
    const out: FrameNode[] = []
    for (let i = 0; i < order.length; i += 1) {
      const id = String(order[i] || '').trim()
      if (!id) continue
      const n = byId.get(id)
      if (!n) continue
      if (used.has(id)) continue
      used.add(id)
      out.push(n)
    }
    for (let i = 0; i < frameNodes.length; i += 1) {
      const n = frameNodes[i]
      if (used.has(n.id)) continue
      out.push(n)
    }
    return out
  }, [frameNodes, layerState])

  const visibleNodes = useMemo(() => {
    const hidden = layerState?.hiddenById || {}
    return sortedNodes.filter(n => hidden[n.id] !== true)
  }, [layerState?.hiddenById, sortedNodes])

  const positions = useMemo(() => {
    return computeGridPositions({ nodes: visibleNodes, colCount: 4, colW: FRAME_W, rowH: FRAME_H, pad: GAP })
  }, [visibleNodes])

  const zoomViewKey = useMemo(() => {
    return buildActive2dZoomViewKey({
      canvasRenderMode: snapshot.canvasRenderMode,
      canvas2dRenderer: snapshot.canvas2dRenderer,
      schema: snapshot.schema,
      graphData: snapshot.graphData,
      documentSemanticMode: snapshot.documentSemanticMode,
      frontmatterModeEnabled: snapshot.frontmatterModeEnabled,
      documentStructureBaselineLock: snapshot.documentStructureBaselineLock,
      renderMediaAsNodes: snapshot.renderMediaAsNodes,
      mediaPanelDensity: snapshot.mediaPanelDensity,
      collapsedGroupIds: snapshot.collapsedGroupIds,
    })
  }, [
    snapshot.canvas2dRenderer,
    snapshot.canvasRenderMode,
    snapshot.collapsedGroupIds,
    snapshot.documentSemanticMode,
    snapshot.documentStructureBaselineLock,
    snapshot.frontmatterModeEnabled,
    snapshot.graphData,
    snapshot.mediaPanelDensity,
    snapshot.renderMediaAsNodes,
    snapshot.schema,
  ])

  const dimsRef = useRef({ width: dims.width, height: dims.height })
  useEffect(() => {
    dimsRef.current = { width: dims.width, height: dims.height }
  }, [dims.width, dims.height])

  useEffect(() => {
    if (!active) return
    let rafId: number | null = null
    const apply = (zoomRequest: ZoomRequest | null) => {
      if (!zoomRequest || !svgRef.current || !zoomRef.current) return
      const state = useGraphStore.getState()
      const svg = d3.select(svgRef.current)

      const localGraphData: GraphData = {
        type: 'Graph',
        nodes: visibleNodes.map(n => {
          const p = positions[n.id]
          if (!p) return { id: n.id, label: n.label, type: 'Frame', properties: {}, x: 0, y: 0 }
          return {
            id: n.id,
            label: n.label,
            type: 'Frame',
            properties: {},
            x: p.x + p.w / 2,
            y: p.y + p.h / 2,
          }
        }),
        edges: [],
        metadata: state.graphData?.metadata,
      }

      applyZoomRequest(zoomRequest, {
        svg,
        zoom: zoomRef.current,
        graphData: localGraphData,
        width: Math.max(1, Math.floor(dimsRef.current.width)),
        height: Math.max(1, Math.floor(dimsRef.current.height)),
        selectedNodeId: state.selectedNodeId,
        selectedEdgeId: state.selectedEdgeId,
        selectedNodeIds: state.selectedNodeIds,
        selectedEdgeIds: state.selectedEdgeIds,
      })
    }
    const schedule = (zoomRequest: ZoomRequest | null) => {
      if (rafId != null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        apply(zoomRequest)
      })
    }
    const unsubZoomRequest = useGraphStore.subscribe(
      s => s.zoomRequest,
      zoomRequest => schedule(zoomRequest),
    )
    return () => {
      unsubZoomRequest()
      if (rafId != null) cancelAnimationFrame(rafId)
    }
  }, [active, positions, visibleNodes])

  useEffect(() => {
    if (!active) return
    if (!svgRef.current || !gRef.current) return
    const svgEl = svgRef.current
    const gEl = gRef.current

    const svg = d3.select(svgEl)
    const g = d3.select(gEl)

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 6])
      .on('zoom', e => {
        if (!active) return
        const t = e.transform
        g.attr('transform', `translate(${t.x},${t.y}) scale(${t.k})`)

        const store = useGraphStore.getState()
        const key = zoomViewKey
        if (!key) return
        commitZoomTransformToStore({
          state: {
            viewPinned: store.viewPinned,
            zoomState: store.zoomState,
            zoomStateByKey: store.zoomStateByKey,
            setZoomState: store.setZoomState,
            setZoomStateForKey: store.setZoomStateForKey,
          },
          zoomViewKey: key,
          transform: { k: t.k, x: t.x, y: t.y },
          viewportW: dims.width,
          viewportH: dims.height,
          graphDataRevision: store.graphDataRevision,
        })
      })

    zoomRef.current = zoom
    svg.call(zoom as never)

    const store = useGraphStore.getState()
    const initialZoomState = pickZoomStateForView({
      zoomViewKey,
      zoomStateByKey: store.zoomStateByKey,
      viewPinned: store.viewPinned,
      fitToScreenMode: store.fitToScreenMode,
      zoomToSelectionMode: store.zoomToSelectionMode,
    })

    const initial = pickInitialZoomTransform({
      zoomState: initialZoomState,
      pinned: store.viewPinned,
      graphDataRevision: store.graphDataRevision,
      nextViewportW: dims.width,
      nextViewportH: dims.height,
    })

    if (initial) {
      svg.call(zoom.transform as never, d3.zoomIdentity.translate(initial.x, initial.y).scale(initial.k))
    } else {
      svg.call(zoom.transform as never, d3.zoomIdentity)
    }

    return () => {
      try {
        svg.on('.zoom', null)
      } catch {
        void 0
      }
      zoomRef.current = null
    }
  }, [active, dims.height, dims.width, zoomViewKey])

  const handleSelectNode = useMemo(() => {
    return (id: string) => {
      const store = useGraphStore.getState()
      store.setSelectionSource('canvas')
      store.selectNode(id)
    }
  }, [])

  const BG_SIZE = 100000

  return (
    <section
      ref={containerRef}
      className={`${CANVAS_SURFACE_CLASS} relative h-full w-full overflow-hidden bg-[var(--kg-canvas-bg)]`}
      aria-label="Design Canvas"
    >
      <svg
        ref={svgRef}
        className={`${CANVAS_INTERACTIVE_CLASS} block h-full w-full select-none`}
        role="img"
        aria-label="Design renderer"
      >
        <defs>
          <pattern id="grid-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="var(--kg-border)" opacity="0.5" />
          </pattern>
          <filter id="shadow-sm" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.1" />
          </filter>
          <filter id="shadow-md" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.1" />
          </filter>
        </defs>
        
        <g ref={gRef}>
          <rect x={-BG_SIZE} y={-BG_SIZE} width={BG_SIZE * 2} height={BG_SIZE * 2} fill="url(#grid-pattern)" />

          {visibleNodes.map(n => {
            const p = positions[n.id]
            if (!p) return null
            const selected = snapshot.selectedNodeId === n.id
            
            return (
              <g
                key={n.id}
                transform={`translate(${p.x},${p.y})`}
                onPointerDown={e => {
                  e.stopPropagation()
                  handleSelectNode(n.id)
                }}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x={0}
                  y={0}
                  width={p.w}
                  height={p.h}
                  rx={8}
                  fill="var(--kg-panel-bg)"
                  stroke={selected ? 'var(--kg-canvas-accent)' : 'var(--kg-border)'}
                  strokeWidth={selected ? 2 : 1}
                  filter={selected ? 'url(#shadow-md)' : 'url(#shadow-sm)'}
                />
                <path 
                  d={`M 0 8 Q 0 0 8 0 L ${p.w - 8} 0 Q ${p.w} 0 ${p.w} 8 L ${p.w} 32 L 0 32 Z`}
                  fill="var(--kg-statusbar-bg)"
                  opacity={0.5}
                />

                <text
                  x={12}
                  y={22}
                  fill="var(--kg-text-primary)"
                  fontSize={12}
                  fontWeight={600}
                  style={{ pointerEvents: 'none' }}
                >
                  {n.label}
                </text>

                <g transform="translate(16, 48)" opacity={0.3}>
                  <rect width={p.w - 32} height={12} rx={2} fill="var(--kg-text-tertiary)" />
                  <rect y={20} width={(p.w - 32) * 0.6} height={12} rx={2} fill="var(--kg-text-tertiary)" />
                  <rect y={40} width={p.w - 32} height={p.h - 100} rx={4} fill="var(--kg-border)" />
                </g>

                <text
                  x={p.w - 12}
                  y={22}
                  textAnchor="end"
                  fill="var(--kg-text-tertiary)"
                  fontSize={10}
                  style={{ pointerEvents: 'none' }}
                >
                  {n.id}
                </text>
              </g>
            )
          })}
        </g>
      </svg>
    </section>
  )
}
