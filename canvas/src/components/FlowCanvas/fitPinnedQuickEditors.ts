import * as d3 from 'd3'

import type { GraphData, GraphNode } from '@/lib/graph/types'
import { fitAllTransform, type FitAllTransformOptions } from '@/components/GraphCanvas/fit'
import { DEFAULT_FLOW_NODE_WIDTH_PX } from '@/lib/graph/layoutDefaults'
import { computeNodeQuickEditorScale, NODE_QUICK_EDITOR_BASE_SIZE } from '@/components/FlowEditor/nodeQuickEditorZoom'

export function fitFlowEditorPinnedQuickEditors(args: {
  nodes: GraphNode[]
  fitW: number
  viewportH: number
  viewportW: number
  openQuickEditorNodeIds: ReadonlyArray<unknown>
  pinnedById: Record<string, boolean>
  worldPosById: Record<string, { x?: unknown; y?: unknown }>
  portExtraPadScreenPx: number
  graphData?: GraphData | null
  fitOpts: FitAllTransformOptions
}): d3.ZoomTransform {
  const nodes = Array.isArray(args.nodes) ? args.nodes : []
  if (nodes.length === 0) return d3.zoomIdentity

  const openIds = Array.isArray(args.openQuickEditorNodeIds) ? args.openQuickEditorNodeIds : []
  if (openIds.length === 0) {
    return fitAllTransform(nodes, args.fitW, args.viewportH, { ...args.fitOpts, graphData: args.graphData || undefined })
  }

  const pinnedById = args.pinnedById || {}
  const pinned: Array<{ id: string; stackIndex: number }> = []
  for (let stackIndex = 0; stackIndex < openIds.length; stackIndex += 1) {
    const id = String(openIds[stackIndex] || '').trim()
    if (!id) continue
    const v = pinnedById[id]
    const pinnedInCanvas = typeof v === 'boolean' ? v : true
    if (pinnedInCanvas) pinned.push({ id, stackIndex })
  }
  if (pinned.length === 0) {
    return fitAllTransform(nodes, args.fitW, args.viewportH, { ...args.fitOpts, graphData: args.graphData || undefined })
  }

  const nodeById = new Map<string, { left: number; top: number; w: number; h: number }>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const id = String((n as unknown as { id?: unknown })?.id || '').trim()
    if (!id) continue
    const props = (n.properties || {}) as Record<string, unknown>
    const w = typeof props['visual:width'] === 'number' && Number.isFinite(props['visual:width']) ? (props['visual:width'] as number) : null
    const h = typeof props['visual:height'] === 'number' && Number.isFinite(props['visual:height']) ? (props['visual:height'] as number) : null
    const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
    const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
    if (w == null || h == null || x == null || y == null) continue
    nodeById.set(id, { left: x - w / 2, top: y - h / 2, w, h })
  }
  if (nodeById.size === 0) {
    return fitAllTransform(nodes, args.fitW, args.viewportH, { ...args.fitOpts, graphData: args.graphData || undefined })
  }

  const minScale = typeof args.fitOpts.minScale === 'number' && Number.isFinite(args.fitOpts.minScale) && args.fitOpts.minScale > 0
    ? (args.fitOpts.minScale as number)
    : 0.001
  const maxScale = typeof args.fitOpts.maxScale === 'number' && Number.isFinite(args.fitOpts.maxScale) && args.fitOpts.maxScale > minScale
    ? (args.fitOpts.maxScale as number)
    : Math.max(minScale * 2, 6)
  const worldById = args.worldPosById || {}

  const refit = (kGuess: number): d3.ZoomTransform => {
    const panelScale = computeNodeQuickEditorScale(kGuess, { minK: minScale, maxK: maxScale }, { mode: 'pinnedInCanvas' })
    const portExtraPadWorld = args.portExtraPadScreenPx / Math.max(1e-6, kGuess)
    const panelW = (NODE_QUICK_EDITOR_BASE_SIZE.width * panelScale) / Math.max(1e-6, kGuess)
    const panelH = (NODE_QUICK_EDITOR_BASE_SIZE.height * panelScale) / Math.max(1e-6, kGuess)
    if (!(panelW > 1e-9) || !(panelH > 1e-9)) {
      return fitAllTransform(nodes, args.fitW, args.viewportH, { ...args.fitOpts, graphData: args.graphData || undefined })
    }

    const extras: GraphNode[] = []
    for (let i = 0; i < pinned.length; i += 1) {
      const entry = pinned[i]!
      const id = entry.id
      const idx = entry.stackIndex
      const col = idx % 3
      const row = Math.floor(idx / 3)
      const stackTopPx = row * 54 + col * 8
      const stackLeftPx = col * 54

      const stored = worldById[id] as { x?: unknown; y?: unknown } | null
      const storedX = typeof stored?.x === 'number' && Number.isFinite(stored.x) ? (stored.x as number) : null
      const storedY = typeof stored?.y === 'number' && Number.isFinite(stored.y) ? (stored.y as number) : null

      const fallback = (() => {
        const base = nodeById.get(id)
        if (!base) return null
        const left = base.left + DEFAULT_FLOW_NODE_WIDTH_PX + portExtraPadWorld + (16 + stackLeftPx) / Math.max(1e-6, kGuess)
        const top = base.top + (-12 + stackTopPx) / Math.max(1e-6, kGuess)
        return { left, top }
      })()

      const left = storedX != null ? storedX : (fallback ? fallback.left : null)
      const top = storedY != null ? storedY : (fallback ? fallback.top : null)
      if (left == null || top == null) continue
      extras.push({
        id: `__qe:${id}`,
        type: 'FlowQuickEditor',
        label: '',
        x: left + panelW / 2,
        y: top + panelH / 2,
        properties: {
          'visual:width': panelW,
          'visual:height': panelH,
          'visual:shape': 'rect',
        } as unknown as GraphNode['properties'],
      })
    }

    if (extras.length === 0) {
      return fitAllTransform(nodes, args.fitW, args.viewportH, { ...args.fitOpts, graphData: args.graphData || undefined })
    }
    return fitAllTransform([...nodes, ...extras], args.fitW, args.viewportH, { ...args.fitOpts, graphData: args.graphData || undefined })
  }

  const fitBase = fitAllTransform(nodes, args.fitW, args.viewportH, { ...args.fitOpts, graphData: args.graphData || undefined })
  const kBase = typeof fitBase?.k === 'number' && Number.isFinite(fitBase.k) && fitBase.k > 0 ? (fitBase.k as number) : null
  if (!kBase) return fitBase

  let kGuess = kBase
  let last = fitBase
  for (let iter = 0; iter < 3; iter += 1) {
    const next = refit(kGuess)
    const nextK = typeof next?.k === 'number' && Number.isFinite(next.k) && next.k > 0 ? (next.k as number) : null
    if (!nextK) return last
    last = next
    if (Math.abs(nextK - kGuess) < 1e-6) break
    kGuess = nextK
  }
  return last
}
