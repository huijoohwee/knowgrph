import type { GraphData, GraphNode } from '@/lib/graph/types'
import { resolveGraphNodeByCanonicalId } from '@/lib/graph/canonicalNodeIds'
import { isFrontmatterFlowGraph } from '@/lib/graph/frontmatterMode'
import {
  FLOW_IMAGE_GENERATION_NODE_TYPE_ID,
  FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
  FLOW_TEXT_GENERATION_NODE_TYPE_ID,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
  FLOW_VIDEO_TRANSCRIBER_NODE_TYPE_ID,
} from '@/lib/config'
import { isHorizontalOverlayStrip, isVerticalOverlayCluster } from '@/lib/ui/overlayBalancedSpread'

const FRONTMATTER_AUTO_MANAGED_WIDGET_RESIDUE_GAP_PX = 24
const FRONTMATTER_AUTO_MANAGED_WIDGET_RESIDUE_SIZE = {
  width: 360,
  height: 520,
} as const

function hasAutoManagedWidgetOverlap(items: Array<{ left: number; top: number; width: number; height: number }>, gapPx: number): boolean {
  for (let i = 0; i < items.length; i += 1) {
    const left = items[i]!
    for (let j = i + 1; j < items.length; j += 1) {
      const right = items[j]!
      const overlapX = left.left < right.left + right.width + gapPx && right.left < left.left + left.width + gapPx
      const overlapY = left.top < right.top + right.height + gapPx && right.top < left.top + left.height + gapPx
      if (overlapX && overlapY) return true
    }
  }
  return false
}

export function isCanonicalFrontmatterBuiltInWidgetNode(node: Pick<GraphNode, 'id' | 'type'> | null | undefined): boolean {
  const nodeType = String(node?.type || '').trim()
  return nodeType === FLOW_TEXT_GENERATION_NODE_TYPE_ID
    || nodeType === FLOW_IMAGE_GENERATION_NODE_TYPE_ID
    || nodeType === FLOW_VIDEO_GENERATION_NODE_TYPE_ID
    || nodeType === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID
    || nodeType === FLOW_VIDEO_TRANSCRIBER_NODE_TYPE_ID
}

export function resolveDefaultFlowWidgetPinnedInCanvas(args: {
  graphMetaKind?: string | null
  geospatialWidgetPanelMode?: boolean
}): boolean {
  const kind = String(args.graphMetaKind || '').trim()
  if (args.geospatialWidgetPanelMode === true) return false
  if (kind === 'frontmatter-flow') return false
  return true
}

export function resolveEffectiveFlowWidgetPinnedInCanvas(args: {
  graphMetaKind?: string | null
  geospatialWidgetPanelMode?: boolean
  node?: Pick<GraphNode, 'id' | 'type'> | null
  pinnedValue?: boolean | null
}): boolean {
  if (typeof args.pinnedValue === 'boolean') return args.pinnedValue
  return resolveDefaultFlowWidgetPinnedInCanvas({
    graphMetaKind: args.graphMetaKind,
    geospatialWidgetPanelMode: args.geospatialWidgetPanelMode,
  })
}

export function shouldAutoPlaceStoryboardWidget(args: {
  graphMetaKind?: string | null
  pinnedInCanvas?: boolean
  floatingPos?: { top?: number; left?: number } | null
  worldPos?: { x?: number; y?: number } | null
  nodeTypeId?: string | null
}): boolean {
  const kind = String(args.graphMetaKind || '').trim()
  const pinnedInCanvas = args.pinnedInCanvas === true
  const floatingPos = args.floatingPos || null
  const worldPos = args.worldPos || null
  const nodeTypeId = String(args.nodeTypeId || '').trim()
  const hasFloatingPos =
    !!floatingPos
    && Number.isFinite(floatingPos.top)
    && Number.isFinite(floatingPos.left)
  const hasWorldPos =
    !!worldPos
    && Number.isFinite(worldPos.x)
    && Number.isFinite(worldPos.y)
  if (kind !== 'frontmatter-flow') return true
  if (!pinnedInCanvas && isCanonicalFrontmatterBuiltInWidgetNode({ id: '', type: nodeTypeId })) return true
  if (pinnedInCanvas) return !hasWorldPos
  return !hasFloatingPos
}

export function shouldUseStoryboardWidgetFloatingScreenAuthority(args: {
  graphMetaKind?: string | null
  pinnedInCanvas?: boolean
  storyboardWidgetSurfaceId?: string | null
}): boolean {
  const kind = String(args.graphMetaKind || '').trim()
  const surfaceId = String(args.storyboardWidgetSurfaceId || '').trim()
  if (args.pinnedInCanvas === true) return false
  return surfaceId === 'storyboard' || kind === 'frontmatter-flow' || kind !== ''
}

export function areStoryboardWidgetOverlaysOwnedByFloatingScreenAuthority(args: {
  graphMetaKind?: string | null
  storyboardWidgetSurfaceId?: string | null
  nodeIds: ReadonlyArray<string>
  nodeById?: ReadonlyMap<string, Pick<GraphNode, 'id' | 'type'>> | null
  pinnedByNodeId?: Record<string, boolean> | null
}): boolean {
  const kind = String(args.graphMetaKind || '').trim()
  if (args.nodeIds.length === 0) return false
  return args.nodeIds.every(rawId => {
    const id = String(rawId || '').trim()
    if (!id) return false
    const pinnedInCanvas = resolveEffectiveFlowWidgetPinnedInCanvas({
      graphMetaKind: kind,
      node: args.nodeById?.get(id) || null,
      pinnedValue: args.pinnedByNodeId?.[id],
    })
    return shouldUseStoryboardWidgetFloatingScreenAuthority({
      graphMetaKind: kind,
      pinnedInCanvas,
      storyboardWidgetSurfaceId: args.storyboardWidgetSurfaceId,
    })
  })
}

export function hasUnplacedStoryboardWidgetFloatingScreenAuthorityWidget(args: {
  graphMetaKind?: string | null
  nodeIds: ReadonlyArray<string>
  nodeTypeById?: ReadonlyMap<string, string> | null
  pinnedByNodeId?: Record<string, boolean> | null
  worldPosByNodeId?: Record<string, { x: number; y: number }> | null
  screenPosByNodeId?: Record<string, { left: number; top: number }> | null
}): boolean {
  const kind = String(args.graphMetaKind || '').trim()
  if (kind !== 'frontmatter-flow') return false
  return args.nodeIds.some(rawId => {
    const id = String(rawId || '').trim()
    if (!id) return false
    const pinnedInCanvas = resolveEffectiveFlowWidgetPinnedInCanvas({
      graphMetaKind: kind,
      node: { id, type: args.nodeTypeById?.get(id) || '' },
      pinnedValue: args.pinnedByNodeId?.[id],
    })
    if (!shouldUseStoryboardWidgetFloatingScreenAuthority({ graphMetaKind: kind, pinnedInCanvas })) return false
    const world = args.worldPosByNodeId?.[id]
    const screen = args.screenPosByNodeId?.[id]
    const hasWorld = !!world && Number.isFinite(world.x) && Number.isFinite(world.y)
    const hasScreen = !!screen && Number.isFinite(screen.left) && Number.isFinite(screen.top)
    return !hasWorld && !hasScreen
  })
}

export function shouldPreserveFrontmatterAutoManagedBalancedCollective(args: {
  graphData: GraphData | null | undefined
  posByNodeId: Record<string, { top: number; left: number }>
  pinnedByNodeId?: Record<string, boolean>
}): boolean {
  const graphData = args.graphData
  const kind = isFrontmatterFlowGraph(graphData) ? 'frontmatter-flow' : ''
  if (kind !== 'frontmatter-flow') return false
  const nodes = Array.isArray(graphData?.nodes) ? graphData.nodes : []
  const items: Array<{ id: string; left: number; top: number; width: number; height: number }> = []
  let autoManagedNodeCount = 0
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    if (!isCanonicalFrontmatterBuiltInWidgetNode(node)) continue
    autoManagedNodeCount += 1
    const id = String(node?.id || '').trim()
    const pos = id ? args.posByNodeId?.[id] : undefined
    if (!id || !pos) continue
    if (args.pinnedByNodeId?.[id] === true) continue
    if (!Number.isFinite(pos.top) || !Number.isFinite(pos.left)) continue
    items.push({
      id,
      left: pos.left,
      top: pos.top,
      width: FRONTMATTER_AUTO_MANAGED_WIDGET_RESIDUE_SIZE.width,
      height: FRONTMATTER_AUTO_MANAGED_WIDGET_RESIDUE_SIZE.height,
    })
  }
  if (autoManagedNodeCount === 0 || items.length !== autoManagedNodeCount) return false
  return !hasAutoManagedWidgetOverlap(items, FRONTMATTER_AUTO_MANAGED_WIDGET_RESIDUE_GAP_PX)
    && !isVerticalOverlayCluster({ items, gapPx: FRONTMATTER_AUTO_MANAGED_WIDGET_RESIDUE_GAP_PX })
    && !isHorizontalOverlayStrip({ items, gapPx: FRONTMATTER_AUTO_MANAGED_WIDGET_RESIDUE_GAP_PX })
}

export function stripFrontmatterAutoManagedWidgetScreenPositions(args: {
  graphData: GraphData | null | undefined
  posByNodeId: Record<string, { top: number; left: number }>
  pinnedByNodeId?: Record<string, boolean>
  preserveBalancedCollective?: boolean
  preserveStableSameSourceOverlayState?: boolean
}): Record<string, { top: number; left: number }> {
  const graphData = args.graphData
  const kind = isFrontmatterFlowGraph(graphData) ? 'frontmatter-flow' : ''
  if (kind !== 'frontmatter-flow') return args.posByNodeId
  const nodes = Array.isArray(graphData?.nodes) ? graphData.nodes : []
  if (
    args.preserveBalancedCollective === true
    && shouldPreserveFrontmatterAutoManagedBalancedCollective({
      graphData,
      posByNodeId: args.posByNodeId,
      pinnedByNodeId: args.pinnedByNodeId,
    })
  ) {
    return args.posByNodeId
  }
  const next = { ...(args.posByNodeId || {}) }
  let changed = false
  let positionedAutoManagedCount = 0
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    if (!isCanonicalFrontmatterBuiltInWidgetNode(node)) continue
    const id = String(node?.id || '').trim()
    if (!id || !next[id]) continue
    positionedAutoManagedCount += 1
  }
  if (args.preserveStableSameSourceOverlayState === true && positionedAutoManagedCount <= 1) {
    return args.posByNodeId
  }
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    const id = String(node?.id || '').trim()
    if (!id || !next[id]) continue
    if (!isCanonicalFrontmatterBuiltInWidgetNode(node)) continue
    delete next[id]
    changed = true
  }
  return changed ? next : args.posByNodeId
}

export function stripFrontmatterAutoManagedWidgetPinnedStates(args: {
  graphData: GraphData | null | undefined
  pinnedByNodeId: Record<string, boolean>
}): Record<string, boolean> {
  const graphData = args.graphData
  const kind = isFrontmatterFlowGraph(graphData) ? 'frontmatter-flow' : ''
  if (kind !== 'frontmatter-flow') return args.pinnedByNodeId
  const nodes = Array.isArray(graphData?.nodes) ? graphData.nodes : []
  const next = { ...(args.pinnedByNodeId || {}) }
  let changed = false
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    if (!isCanonicalFrontmatterBuiltInWidgetNode(node)) continue
    const id = String(node?.id || '').trim()
    if (!id || next[id] !== true) continue
    delete next[id]
    changed = true
  }
  for (const [rawId, pinned] of Object.entries(args.pinnedByNodeId || {})) {
    if (pinned !== true) continue
    const node = resolveGraphNodeByCanonicalId(graphData, rawId)
    if (!isCanonicalFrontmatterBuiltInWidgetNode(node)) continue
    if (!Object.prototype.hasOwnProperty.call(next, rawId)) continue
    delete next[rawId]
    changed = true
  }
  return changed ? next : args.pinnedByNodeId
}

export function stripFrontmatterAutoManagedWidgetWorldPositions(args: {
  graphData: GraphData | null | undefined
  worldPosByNodeId: Record<string, { x: number; y: number }>
}): Record<string, { x: number; y: number }> {
  const graphData = args.graphData
  const kind = isFrontmatterFlowGraph(graphData) ? 'frontmatter-flow' : ''
  if (kind !== 'frontmatter-flow') return args.worldPosByNodeId
  const nodes = Array.isArray(graphData?.nodes) ? graphData.nodes : []
  const next = { ...(args.worldPosByNodeId || {}) }
  let changed = false
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    if (!isCanonicalFrontmatterBuiltInWidgetNode(node)) continue
    const id = String(node?.id || '').trim()
    if (!id || !next[id]) continue
    delete next[id]
    changed = true
  }
  return changed ? next : args.worldPosByNodeId
}

export function shouldCarryForwardFlowWidgetOverlayStateOnGraphCommit(args: {
  graphData: GraphData | null | undefined
  carryForwardSameSourceUiState?: boolean
  stableSameSourceNodeLayout?: boolean
  preserveBalancedCollective?: boolean
}): boolean {
  if (args.preserveBalancedCollective === true) return true
  const kind = isFrontmatterFlowGraph(args.graphData) ? 'frontmatter-flow' : ''
  if (kind === 'frontmatter-flow') {
    return args.carryForwardSameSourceUiState === true && args.stableSameSourceNodeLayout === true
  }
  return args.carryForwardSameSourceUiState === true && args.stableSameSourceNodeLayout === true
}
