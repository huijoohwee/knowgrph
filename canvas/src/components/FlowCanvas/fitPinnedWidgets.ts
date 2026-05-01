import * as d3 from 'd3'

import type { GraphData, GraphNode } from '@/lib/graph/types'
import { fitAllTransform, type FitAllTransformOptions } from '@/components/GraphCanvas/fit'
import { DEFAULT_FLOW_NODE_WIDTH_PX } from '@/lib/graph/layoutDefaults'
import { computeWidgetScale, WIDGET_BASE_SIZE } from '@/components/FlowEditor/widgetZoom'
import { getCachedGraphLookup } from '@/lib/graph/lookupCache'
import { hashScopedStringArraySignature } from '@/lib/hash/signature'

export function fitFlowEditorPinnedWidgets(args: {
  nodes: GraphNode[]
  fitW: number
  viewportH: number
  viewportW: number
  openWidgetNodeIds: ReadonlyArray<unknown>
  pinnedById: Record<string, boolean>
  worldPosById: Record<string, { x?: unknown; y?: unknown }>
  portExtraPadScreenPx: number
  graphData?: GraphData | null
  fitOpts: FitAllTransformOptions
}): d3.ZoomTransform {
  const nodes = Array.isArray(args.nodes) ? args.nodes : []
  if (nodes.length === 0) return d3.zoomIdentity

  const openIds = Array.isArray(args.openWidgetNodeIds) ? args.openWidgetNodeIds : []
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

  const nodeLookup = getCachedGraphLookup({
    cacheScope: 'flow-canvas-fit-pinned-widgets',
    graphData: { type: 'application/json', nodes, edges: [] },
    graphSemanticKey: hashScopedStringArraySignature(
      'flow-canvas-fit-pinned-widgets',
      nodes.map(node => {
        const props = (node?.properties || {}) as Record<string, unknown>
        const width = typeof props['visual:width'] === 'number' && Number.isFinite(props['visual:width']) ? props['visual:width'] : ''
        const height = typeof props['visual:height'] === 'number' && Number.isFinite(props['visual:height']) ? props['visual:height'] : ''
        const x = typeof node?.x === 'number' && Number.isFinite(node.x) ? node.x : ''
        const y = typeof node?.y === 'number' && Number.isFinite(node.y) ? node.y : ''
        return `${String(node?.id || '').trim()}:${String(node?.type || '').trim()}:${x}:${y}:${width}:${height}`
      }),
    ),
  })
  const nodeById = nodeLookup?.nodeById || new Map<string, GraphNode>()
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
    const panelScale = computeWidgetScale(kGuess, { minK: minScale, maxK: maxScale }, { mode: 'pinnedInCanvas' })
    const portExtraPadWorld = args.portExtraPadScreenPx / Math.max(1e-6, kGuess)
    const panelW = (WIDGET_BASE_SIZE.width * panelScale) / Math.max(1e-6, kGuess)
    const panelH = (WIDGET_BASE_SIZE.height * panelScale) / Math.max(1e-6, kGuess)
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
        const props = (base.properties || {}) as Record<string, unknown>
        const width = typeof props['visual:width'] === 'number' && Number.isFinite(props['visual:width']) ? (props['visual:width'] as number) : null
        const height = typeof props['visual:height'] === 'number' && Number.isFinite(props['visual:height']) ? (props['visual:height'] as number) : null
        const x = typeof base.x === 'number' && Number.isFinite(base.x) ? base.x : null
        const y = typeof base.y === 'number' && Number.isFinite(base.y) ? base.y : null
        if (width == null || height == null || x == null || y == null) return null
        const left = x - width / 2 + DEFAULT_FLOW_NODE_WIDTH_PX + portExtraPadWorld + (16 + stackLeftPx) / Math.max(1e-6, kGuess)
        const top = y - height / 2 + (-12 + stackTopPx) / Math.max(1e-6, kGuess)
        return { left, top }
      })()

      const left = storedX != null ? storedX : (fallback ? fallback.left : null)
      const top = storedY != null ? storedY : (fallback ? fallback.top : null)
      if (left == null || top == null) continue
      extras.push({
        id: `__qe:${id}`,
        type: 'FlowWidget',
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
