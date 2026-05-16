import * as d3 from 'd3'

import type { GraphData, GraphNode } from '@/lib/graph/types'
import { fitAllTransform, type FitAllTransformOptions } from '@/components/GraphCanvas/fit'
import {
  readFrontmatterOverlayFitProxyScale,
  type FrontmatterOverlayFitProxyScales,
} from '@/components/FlowCanvas/frontmatterLayoutConfig'
import { DEFAULT_FLOW_NODE_WIDTH_PX } from '@/lib/graph/layoutDefaults'
import { computeCollectiveFollowPinnedScale, WIDGET_BASE_SIZE } from '@/components/FlowEditor/widgetZoom'
import { deriveFrontmatterFlowOverlayNodeIds } from '@/lib/flowEditor/frontmatterOverlayNodeIds'
import { resolveFlowLayoutBalancedViewportPreset } from '@/lib/graph/frontmatterFlowSettings'
import { getCachedGraphLookup } from '@/lib/graph/lookupCache'
import { hashScopedStringArraySignature } from '@/lib/hash/signature'
import { computeBalancedSpreadLayout, computeBalancedSpreadSpacingPx, computeBalancedSpreadViewportMargins } from '@/lib/ui/overlayBalancedSpread'

export { readFrontmatterOverlayFitProxyScale } from '@/components/FlowCanvas/frontmatterLayoutConfig'

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
  frontmatterOverlayFitProxyScales?: Partial<FrontmatterOverlayFitProxyScales> | null
}): d3.ZoomTransform {
  const nodes = Array.isArray(args.nodes) ? args.nodes : []
  if (nodes.length === 0) return d3.zoomIdentity

  const graphMeta = (args.graphData?.metadata || {}) as Record<string, unknown>
  const graphContext = String(args.graphData?.context || '').trim()
  const isFrontmatterOverlayFit =
    String(graphMeta.kind || '').trim() === 'frontmatter-flow' ||
    graphContext === 'frontmatter-flow'
  const explicitOpenIds = Array.isArray(args.openWidgetNodeIds) ? args.openWidgetNodeIds : []
  const frontmatterOverlayIds = isFrontmatterOverlayFit ? deriveFrontmatterFlowOverlayNodeIds(args.graphData || null) : []
  const openIds = isFrontmatterOverlayFit
    ? frontmatterOverlayIds
    : explicitOpenIds
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
  const pinnedIdSet = new Set(
    pinned
      .map(entry => String(entry.id || '').trim())
      .filter(Boolean),
  )

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
  const buildOverlayFitNodes = (kGuess: number) => {
    const panelScale = computeCollectiveFollowPinnedScale({
      zoomK: kGuess,
      extent: { minK: minScale, maxK: maxScale },
      viewportW: args.viewportW,
      viewportH: args.viewportH,
      count: Math.max(1, pinned.length),
      baseWidth: WIDGET_BASE_SIZE.width,
      baseHeight: WIDGET_BASE_SIZE.height,
      viewportPreset: isFrontmatterOverlayFit ? 'widgetFrontmatter' : 'widgetCanvas',
    })
    const portExtraPadWorld = args.portExtraPadScreenPx / Math.max(1e-6, kGuess)
    const panelW = (WIDGET_BASE_SIZE.width * panelScale) / Math.max(1e-6, kGuess)
    const panelH = (WIDGET_BASE_SIZE.height * panelScale) / Math.max(1e-6, kGuess)
    const fitProxyScale = isFrontmatterOverlayFit
      ? readFrontmatterOverlayFitProxyScale(args.viewportW, args.frontmatterOverlayFitProxyScales)
      : 1
    const panelWFit = panelW * fitProxyScale
    const panelHFit = panelH * fitProxyScale
    const balancedViewportPreset = resolveFlowLayoutBalancedViewportPreset({
      graphData: args.graphData,
      fallbackPreset: isFrontmatterOverlayFit ? 'widgetFrontmatter' : 'widgetCanvas',
    })
    const spacingPx = computeBalancedSpreadSpacingPx({
      baseGapPx: 24,
      zoomK: kGuess,
      count: Math.max(1, pinned.length),
      preset: balancedViewportPreset,
    })
    const margins = computeBalancedSpreadViewportMargins({
      viewportW: args.viewportW,
      viewportH: args.viewportH,
      preset: balancedViewportPreset,
      minLeftPx: 20,
      minRightPx: 20,
      minTopPx: isFrontmatterOverlayFit ? 64 : 96,
      minBottomPx: 24,
    })
    const balanced = computeBalancedSpreadLayout({
      count: Math.max(1, pinned.length),
      viewportW: args.viewportW,
      viewportH: args.viewportH,
      cellW: panelWFit + spacingPx,
      cellH: panelHFit + spacingPx,
      gapPx: spacingPx,
      zoomK: kGuess,
      marginLeftPx: margins.left,
      marginRightPx: margins.right,
      marginTopPx: margins.top,
      marginBottomPx: margins.bottom,
      snapPx: 1,
    })
    if (!(panelW > 1e-9) || !(panelH > 1e-9) || !(panelWFit > 1e-9) || !(panelHFit > 1e-9)) {
      return {
        extras: [] as GraphNode[],
        fitNodes: nodes,
      }
    }

    const extras: GraphNode[] = []
    const fitExtras: GraphNode[] = []
    for (let i = 0; i < pinned.length; i += 1) {
      const entry = pinned[i]!
      const id = entry.id
      const balancedCell = balanced.cells[Math.min(i, balanced.cells.length - 1)] || null

      const stored = worldById[id] as { x?: unknown; y?: unknown } | null
      const storedX = typeof stored?.x === 'number' && Number.isFinite(stored.x) ? (stored.x as number) : null
      const storedY = typeof stored?.y === 'number' && Number.isFinite(stored.y) ? (stored.y as number) : null

      const fallback = (() => {
        const base = nodeById.get(id)
        if (!base) return null
        if (balancedCell) {
          return {
            left: balancedCell.left / Math.max(1e-6, kGuess),
            top: balancedCell.top / Math.max(1e-6, kGuess),
          }
        }
        const props = (base.properties || {}) as Record<string, unknown>
        const width = typeof props['visual:width'] === 'number' && Number.isFinite(props['visual:width']) ? (props['visual:width'] as number) : null
        const height = typeof props['visual:height'] === 'number' && Number.isFinite(props['visual:height']) ? (props['visual:height'] as number) : null
        const x = typeof base.x === 'number' && Number.isFinite(base.x) ? base.x : null
        const y = typeof base.y === 'number' && Number.isFinite(base.y) ? base.y : null
        if (width == null || height == null || x == null || y == null) return null
        const left = x - width / 2 + DEFAULT_FLOW_NODE_WIDTH_PX + portExtraPadWorld
        const top = y - height / 2
        return { left, top }
      })()

      const left = storedX != null ? storedX : (fallback ? fallback.left : null)
      const top = storedY != null ? storedY : (fallback ? fallback.top : null)
      if (left == null || top == null) continue
      const centerX = left + panelW / 2
      const centerY = top + panelH / 2
      extras.push({
        id: `__qe:${id}`,
        type: 'FlowWidget',
        label: '',
        x: centerX,
        y: centerY,
        properties: {
          'visual:width': panelW,
          'visual:height': panelH,
          'visual:shape': 'rect',
        } as unknown as GraphNode['properties'],
      })
      fitExtras.push({
        id: `__qf:${id}`,
        type: 'FlowWidget',
        label: '',
        x: centerX,
        y: centerY,
        properties: {
          'visual:width': panelWFit,
          'visual:height': panelHFit,
          'visual:shape': 'rect',
        } as unknown as GraphNode['properties'],
      })
    }

    const unpinnedNodes = isFrontmatterOverlayFit
      ? []
      : nodes.filter(node => {
          const id = String(node?.id || '').trim()
          return !id || !pinnedIdSet.has(id)
        })
    return {
      extras,
      fitNodes: fitExtras.length > 0 ? [...unpinnedNodes, ...fitExtras] : nodes,
    }
  }

  const refit = (kGuess: number): d3.ZoomTransform => {
    const { extras, fitNodes } = buildOverlayFitNodes(kGuess)
    if (extras.length === 0) {
      return fitAllTransform(nodes, args.fitW, args.viewportH, { ...args.fitOpts, graphData: args.graphData || undefined })
    }
    return fitAllTransform(fitNodes, args.fitW, args.viewportH, { ...args.fitOpts, graphData: args.graphData || undefined })
  }

  const fitBase = fitAllTransform(nodes, args.fitW, args.viewportH, { ...args.fitOpts, graphData: args.graphData || undefined })
  const kBase = typeof fitBase?.k === 'number' && Number.isFinite(fitBase.k) && fitBase.k > 0 ? (fitBase.k as number) : null
  if (!kBase) return fitBase

  const neutralFrontmatterFitZoom = Math.max(minScale, Math.min(maxScale, 1))
  let kGuess = isFrontmatterOverlayFit ? neutralFrontmatterFitZoom : kBase
  let last = fitBase
  for (let iter = 0; iter < 3; iter += 1) {
    const next = refit(kGuess)
    const nextK = typeof next?.k === 'number' && Number.isFinite(next.k) && next.k > 0 ? (next.k as number) : null
    if (!nextK) return last
    last = next
    if (Math.abs(nextK - kGuess) < 1e-6) break
    kGuess = nextK
  }
  const { extras } = buildOverlayFitNodes(last.k)
  if (extras.length === 0) return last
  let minScreenX = Number.POSITIVE_INFINITY
  let minScreenY = Number.POSITIVE_INFINITY
  let maxScreenX = Number.NEGATIVE_INFINITY
  let maxScreenY = Number.NEGATIVE_INFINITY
  const sum = extras.reduce((acc, node) => ({
    x: acc.x + (last.x + last.k * (Number(node.x) || 0)),
    y: acc.y + (last.y + last.k * (Number(node.y) || 0)),
  }), { x: 0, y: 0 })
  for (let i = 0; i < extras.length; i += 1) {
    const node = extras[i]!
    const props = (node.properties || {}) as Record<string, unknown>
    const width = typeof props['visual:width'] === 'number' && Number.isFinite(props['visual:width']) ? (props['visual:width'] as number) : 0
    const height = typeof props['visual:height'] === 'number' && Number.isFinite(props['visual:height']) ? (props['visual:height'] as number) : 0
    const centerX = last.x + last.k * (Number(node.x) || 0)
    const centerY = last.y + last.k * (Number(node.y) || 0)
    minScreenX = Math.min(minScreenX, centerX - (width * last.k) / 2)
    minScreenY = Math.min(minScreenY, centerY - (height * last.k) / 2)
    maxScreenX = Math.max(maxScreenX, centerX + (width * last.k) / 2)
    maxScreenY = Math.max(maxScreenY, centerY + (height * last.k) / 2)
  }
  const centroidX = sum.x / extras.length
  const centroidY = sum.y / extras.length
  const desiredDeltaX = args.fitW / 2 - centroidX
  const desiredDeltaY = args.viewportH / 2 - centroidY
  const minDeltaX = Number.isFinite(minScreenX) ? -minScreenX : desiredDeltaX
  const maxDeltaX = Number.isFinite(maxScreenX) ? args.fitW - maxScreenX : desiredDeltaX
  const minDeltaY = Number.isFinite(minScreenY) ? -minScreenY : desiredDeltaY
  const maxDeltaY = Number.isFinite(maxScreenY) ? args.viewportH - maxScreenY : desiredDeltaY
  const deltaX =
    minDeltaX <= maxDeltaX
      ? Math.max(minDeltaX, Math.min(maxDeltaX, desiredDeltaX))
      : desiredDeltaX
  const deltaY =
    minDeltaY <= maxDeltaY
      ? Math.max(minDeltaY, Math.min(maxDeltaY, desiredDeltaY))
      : desiredDeltaY
  if (Math.abs(deltaX) < 1e-6 && Math.abs(deltaY) < 1e-6) return last
  return d3.zoomIdentity.translate(last.x + deltaX, last.y + deltaY).scale(last.k)
}
