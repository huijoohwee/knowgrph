import React, { useEffect, useMemo, useRef } from 'react'
import * as d3 from 'd3'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useContainerDims } from '@/hooks/useContainerDims'
import { buildActive2dZoomViewKey } from '@/lib/canvas/active-2d-zoom-view-key'
import { pickZoomStateForView } from '@/lib/canvas/zoom-effective'
import { pickInitialZoomTransform } from '@/lib/zoom/viewport'
import { commitZoomTransformToStore } from '@/lib/canvas/zoom-commit'
import { CANVAS_INTERACTIVE_CLASS, CANVAS_SURFACE_CLASS } from '@/lib/canvas/surface'
import { invertZoomPoint } from '@/lib/canvas/viewport-transform'
import { readElementLocalPoint } from '@/lib/canvas/canvas-event-coords'
import { useZoomEffects } from '@/components/GraphCanvas/hooks/useZoomEffects'
import { createZoom } from '@/components/GraphCanvas/zoom'
import { deriveSceneDisplayGraph } from '@/lib/scene/sceneDerivation'
import { relaxNodesWithCollision } from '@/components/GraphCanvas/layout/relax'
import { fitAllTransform } from '@/components/GraphCanvas/fit'
import { readFitAllOptions, readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'
import { useAutoZoomModes2d } from '@/features/zoom/useAutoZoomModes2d'

import type { GraphData, GraphNode } from '@/lib/graph/types'

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

  const rows = Math.max(1, Math.ceil(nodes.length / Math.max(1, cols)))
  const gridW = cols * colW + Math.max(0, cols - 1) * pad
  const gridH = rows * rowH + Math.max(0, rows - 1) * pad
  const startX = -gridW / 2
  const startY = -gridH / 2

  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const col = i % cols
    const row = Math.floor(i / cols)
    pos[n.id] = {
      x: startX + col * (colW + pad),
      y: startY + row * (rowH + pad),
      w: colW,
      h: rowH,
    }
  }
  return pos
}

export default function DesignCanvas({
  active = true,
}: {
  active?: boolean
}) {
  const containerRef = useRef<HTMLElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const labelsSelRef = useRef<d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null>(null)
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
      viewportControlsPreset: s.viewportControlsPreset,
      designLayerState: s.designLayerState,
      designFramePosById: s.designFramePosById,
      setDesignFramePosMany: s.setDesignFramePosMany,
    })),
  )

  const designGraphDataForDisplay = useMemo(() => {
    const g = snapshot.graphData
    if (!g) return null
    return deriveSceneDisplayGraph({ graphData: g as GraphData })?.displayGraphData || (g as GraphData)
  }, [snapshot.graphData])

  const frameNodes = useMemo(() => coerceFrameNodes(designGraphDataForDisplay?.nodes as never), [designGraphDataForDisplay])

  const FRAME_W = 320
  const FRAME_H = 240
  const GAP = 48

  const sortedNodes = useMemo(() => {
    const order = Array.isArray(snapshot.designLayerState?.order) ? snapshot.designLayerState!.order : []
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
  }, [frameNodes, snapshot.designLayerState])

  const visibleNodes = useMemo(() => {
    const hidden = snapshot.designLayerState?.hiddenById || {}
    return sortedNodes.filter(n => hidden[n.id] !== true)
  }, [snapshot.designLayerState?.hiddenById, sortedNodes])

  const positions = useMemo(() => {
    const viewportW = Math.max(1, dims.width)
    const maxCols = Math.max(1, Math.floor((viewportW + GAP) / (FRAME_W + GAP)))
    const colCount = Math.max(1, Math.min(10, maxCols || 4))
    const grid = computeGridPositions({ nodes: visibleNodes, colCount, colW: FRAME_W, rowH: FRAME_H, pad: GAP })
    const overrides = snapshot.designFramePosById || {}
    const out: Record<string, { x: number; y: number; w: number; h: number }> = {}
    for (let i = 0; i < visibleNodes.length; i += 1) {
      const n = visibleNodes[i]
      const base = grid[n.id]
      if (!base) continue
      const o = overrides[n.id]
      if (o && Number.isFinite(o.x) && Number.isFinite(o.y)) {
        out[n.id] = { x: o.x, y: o.y, w: base.w, h: base.h }
      } else {
        out[n.id] = base
      }
    }
    return out
  }, [dims.width, snapshot.designFramePosById, visibleNodes])

  const localGraphData: GraphData = useMemo(() => {
    return {
      type: 'Graph',
      nodes: visibleNodes.map(n => {
        const p = positions[n.id]
        if (!p) return { id: n.id, label: n.label, type: 'Frame', properties: {}, x: 0, y: 0 }
        return {
          id: n.id,
          label: n.label,
          type: 'Frame',
          properties: {
            'visual:width': p.w,
            'visual:height': p.h,
            'visual:shape': 'rect',
          },
          x: p.x + p.w / 2,
          y: p.y + p.h / 2,
        }
      }),
      edges: [],
      metadata: snapshot.graphData?.metadata,
    }
  }, [positions, snapshot.graphData?.metadata, visibleNodes])

  const localGraphDataRef = useRef<GraphData>(localGraphData)
  useEffect(() => {
    localGraphDataRef.current = localGraphData
  }, [localGraphData])

  const setDesignFramePosMany = snapshot.setDesignFramePosMany

  const frameElByIdRef = useRef<Map<string, SVGGElement>>(new Map())
  const dragRef = useRef<null | { id: string; startWorld: { x: number; y: number }; startPos: { x: number; y: number } }>(null)
  const dragRafRef = useRef<number | null>(null)
  const dragPendingRef = useRef<null | { id: string; nextPos: { x: number; y: number } }>(null)
  const lastInitKeyRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (dragRafRef.current != null) {
        try {
          window.cancelAnimationFrame(dragRafRef.current)
        } catch {
          void 0
        }
        dragRafRef.current = null
      }
      dragPendingRef.current = null
      dragRef.current = null
    }
  }, [])

  const scheduleDragVisual = useMemo(() => {
    return () => {
      if (dragRafRef.current != null) return
      dragRafRef.current = window.requestAnimationFrame(() => {
        dragRafRef.current = null
        const pending = dragPendingRef.current
        if (!pending) return
        const el = frameElByIdRef.current.get(pending.id)
        if (!el) return
        try {
          el.setAttribute('transform', `translate(${pending.nextPos.x},${pending.nextPos.y})`)
        } catch {
          void 0
        }
      })
    }
  }, [])

  const pointerToWorld = useMemo(() => {
    return (ev: React.PointerEvent, svgEl: SVGSVGElement): { x: number; y: number } | null => {
      const local = readElementLocalPoint({ el: svgEl, event: ev })
      if (!local) return null
      const t = d3.zoomTransform(svgEl)
      return invertZoomPoint(t, local)
    }
  }, [])

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

  useZoomEffects({
    svgRef,
    zoomRef,
    width: dims.width,
    height: dims.height,
    paused: !active,
    graphDataOverride: localGraphData,
  })

  useAutoZoomModes2d({
    viewportW: dims.width,
    viewportH: dims.height,
    paused: !active,
    getGraph: () => ({ graphData: localGraphData, graphDataRevision: snapshot.graphDataRevision || 0 }),
  })

  useEffect(() => {
    if (!active) return
    if (!svgRef.current || !gRef.current) return
    const svgEl = svgRef.current
    const gEl = gRef.current

    const svg = d3.select(svgEl)
    const g = d3.select(gEl)

    const zoom = createZoom(svg, g, labelsSelRef, snapshot.schema, snapshot.viewportControlsPreset, t => {
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

    const initKey = zoomViewKey
    const alreadyInitialized = lastInitKeyRef.current === initKey
    const t0 = d3.zoomTransform(svgEl)
    const hasNonIdentityTransform = t0.k !== 1 || t0.x !== 0 || t0.y !== 0

    const autoZoomActive = store.viewPinned !== true && (store.fitToScreenMode || store.zoomToSelectionMode)

    if (!alreadyInitialized || !hasNonIdentityTransform) {
      if (!alreadyInitialized && !autoZoomActive && hasNonIdentityTransform && !initial) {
        if (zoomViewKey && !store.zoomStateByKey?.[zoomViewKey]) {
          commitZoomTransformToStore({
            state: {
              viewPinned: store.viewPinned,
              zoomState: store.zoomState,
              zoomStateByKey: store.zoomStateByKey,
              setZoomState: store.setZoomState,
              setZoomStateForKey: store.setZoomStateForKey,
            },
            zoomViewKey,
            transform: { k: t0.k, x: t0.x, y: t0.y },
            viewportW: dims.width,
            viewportH: dims.height,
            graphDataRevision: store.graphDataRevision,
          })
        }
      } else if (initial) {
        svg.call(zoom.transform as never, d3.zoomIdentity.translate(initial.x, initial.y).scale(initial.k))
      } else if (store.viewPinned !== true && dims.width > 80 && dims.height > 80) {
        const g0 = localGraphDataRef.current
        const nodes0 = Array.isArray(g0.nodes) ? (g0.nodes as GraphNode[]) : ([] as GraphNode[])
        if (nodes0.length > 0) {
          const mode = readLayoutMode(snapshot.schema)
          const intent = store.fitToScreenMode ? 'fitToScreen' : 'initialFit'
          const opts = readFitAllOptions({ schema: snapshot.schema, mode, intent })
          const t = fitAllTransform(nodes0, Math.max(1, dims.width), Math.max(1, dims.height), {
            ...opts,
            graphData: g0,
          })
          svg.call(zoom.transform as never, d3.zoomIdentity.translate(t.x, t.y).scale(t.k))
        } else {
          svg.call(zoom.transform as never, d3.zoomIdentity)
        }
      } else {
        svg.call(zoom.transform as never, d3.zoomIdentity)
      }
      if (initKey) lastInitKeyRef.current = initKey
    }

    return () => {
      try {
        svg.on('.zoom', null)
        svg.on('.kgPointerPan', null)
        svg.on('.kgPointerPanMove', null)
        svg.on('.kgPointerPanUp', null)
        svg.on('.kgWheelZoom', null)
        svg.on('.kgWheelZoomGuard', null)
        svg.on('.kgZoomWheelLastPointer', null)
        svg.on('.kgTouch', null)
        svg.on('.kgPanOnScroll', null)
        svg.on('.kgDesignViewport', null)
      } catch {
        void 0
      }
      zoomRef.current = null
    }
  }, [active, dims.height, dims.width, snapshot.schema, snapshot.viewportControlsPreset, zoomViewKey])

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
                ref={el => {
                  const map = frameElByIdRef.current
                  if (el) map.set(n.id, el)
                  else map.delete(n.id)
                }}
                transform={`translate(${p.x},${p.y})`}
                onPointerDown={e => {
                  e.stopPropagation()
                  if (!active) return
                  const svgEl = svgRef.current
                  if (!svgEl) return
                  const world = pointerToWorld(e, svgEl)
                  if (!world) return
                  try {
                    ;(e.currentTarget as unknown as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(e.pointerId)
                  } catch {
                    void 0
                  }
                  handleSelectNode(n.id)
                  dragRef.current = { id: n.id, startWorld: world, startPos: { x: p.x, y: p.y } }
                }}
                onPointerMove={e => {
                  const drag = dragRef.current
                  if (!drag) return
                  if (!active) return
                  const svgEl = svgRef.current
                  if (!svgEl) return
                  const world = pointerToWorld(e, svgEl)
                  if (!world) return
                  const dx = world.x - drag.startWorld.x
                  const dy = world.y - drag.startWorld.y
                  const nextX = drag.startPos.x + dx
                  const nextY = drag.startPos.y + dy
                  if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) return
                  dragPendingRef.current = { id: drag.id, nextPos: { x: nextX, y: nextY } }
                  scheduleDragVisual()
                }}
                onPointerUp={() => {
                  if (!active) {
                    dragRef.current = null
                    return
                  }
                  const drag = dragRef.current
                  dragRef.current = null
                  const pending = dragPendingRef.current
                  dragPendingRef.current = null
                  if (dragRafRef.current != null) {
                    try {
                      window.cancelAnimationFrame(dragRafRef.current)
                    } catch {
                      void 0
                    }
                    dragRafRef.current = null
                  }
                  const updates: Record<string, { x: number; y: number }> = {}
                  if (pending) updates[pending.id] = pending.nextPos

                  const schema = snapshot.schema
                  if (!schema) {
                    if (Object.keys(updates).length > 0) setDesignFramePosMany(updates)
                    return
                  }

                  const workPos: Record<string, { x: number; y: number; w: number; h: number }> = {}
                  for (let i = 0; i < visibleNodes.length; i += 1) {
                    const vn = visibleNodes[i]
                    const base = positions[vn.id]
                    if (!base) continue
                    workPos[vn.id] = { x: base.x, y: base.y, w: base.w, h: base.h }
                  }
                  if (pending && workPos[pending.id]) {
                    workPos[pending.id] = { ...workPos[pending.id]!, x: pending.nextPos.x, y: pending.nextPos.y }
                  }

                  const estimateOverlapPressure = (): number => {
                    const ids = Object.keys(workPos)
                    if (ids.length < 3) return 0
                    let cell = 0
                    for (let i = 0; i < ids.length; i += 1) {
                      const p = workPos[ids[i]!]!
                      cell = Math.max(cell, Math.floor(Math.max(p.w, p.h) * 0.75))
                    }
                    cell = Math.max(8, cell)
                    const counts = new Map<string, number>()
                    for (let i = 0; i < ids.length; i += 1) {
                      const p = workPos[ids[i]!]!
                      const gx = Math.floor(p.x / cell)
                      const gy = Math.floor(p.y / cell)
                      const key = `${gx}:${gy}`
                      counts.set(key, (counts.get(key) || 0) + 1)
                    }
                    let collisions = 0
                    for (const c of counts.values()) {
                      if (c > 1) collisions += c - 1
                    }
                    return collisions / Math.max(1, ids.length)
                  }
                  const overlapPressure = estimateOverlapPressure()
                  if (overlapPressure < 0.02) {
                    if (Object.keys(updates).length > 0) setDesignFramePosMany(updates)
                    return
                  }

                  const nodes: GraphNode[] = []
                  for (let i = 0; i < visibleNodes.length; i += 1) {
                    const vn = visibleNodes[i]
                    const p = workPos[vn.id]
                    if (!p) continue
                    const cx = p.x + p.w / 2
                    const cy = p.y + p.h / 2
                    const node: GraphNode = {
                      id: vn.id,
                      label: vn.label,
                      type: 'Frame',
                      properties: {
                        'visual:width': p.w,
                        'visual:height': p.h,
                        'visual:shape': 'rect',
                      },
                      x: cx,
                      y: cy,
                      vx: 0,
                      vy: 0,
                    }
                    nodes.push(node)
                  }

                  const pinnedId = pending?.id || drag?.id || null
                  if (pinnedId) {
                    for (let i = 0; i < nodes.length; i += 1) {
                      const n0 = nodes[i]
                      if (String(n0.id) !== pinnedId) continue
                      ;(n0 as unknown as { fx?: number; fy?: number }).fx = n0.x
                      ;(n0 as unknown as { fx?: number; fy?: number }).fy = n0.y
                      break
                    }
                  }

                  relaxNodesWithCollision({
                    nodes,
                    edges: [],
                    schema,
                    defaultSteps: 12,
                  })

                  for (let i = 0; i < nodes.length; i += 1) {
                    const n0 = nodes[i]
                    const id = String(n0.id || '')
                    const w = typeof (n0.properties as Record<string, unknown>)['visual:width'] === 'number' ? ((n0.properties as Record<string, unknown>)['visual:width'] as number) : FRAME_W
                    const h = typeof (n0.properties as Record<string, unknown>)['visual:height'] === 'number' ? ((n0.properties as Record<string, unknown>)['visual:height'] as number) : FRAME_H
                    const x = (typeof n0.x === 'number' && Number.isFinite(n0.x) ? n0.x : 0) - w / 2
                    const y = (typeof n0.y === 'number' && Number.isFinite(n0.y) ? n0.y : 0) - h / 2
                    const prev = workPos[id]
                    if (!prev) continue
                    if (Math.abs(prev.x - x) < 0.5 && Math.abs(prev.y - y) < 0.5) continue
                    updates[id] = { x, y }
                  }
                  if (Object.keys(updates).length > 0) setDesignFramePosMany(updates)
                }}
                onPointerCancel={() => {
                  dragRef.current = null
                  dragPendingRef.current = null
                  if (dragRafRef.current != null) {
                    try {
                      window.cancelAnimationFrame(dragRafRef.current)
                    } catch {
                      void 0
                    }
                    dragRafRef.current = null
                  }
                  const el = frameElByIdRef.current.get(n.id)
                  if (el) {
                    try {
                      el.setAttribute('transform', `translate(${p.x},${p.y})`)
                    } catch {
                      void 0
                    }
                  }
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
