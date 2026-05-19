import type { GraphData, GraphNode } from '@/lib/graph/types'
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
  if (args.geospatialWidgetPanelMode === true) return false
  return true
}

export function shouldAutoPlaceFlowEditorWidget(args: {
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

export function shouldUseFlowEditorWidgetFloatingScreenAuthority(args: {
  graphMetaKind?: string | null
  pinnedInCanvas?: boolean
}): boolean {
  const kind = String(args.graphMetaKind || '').trim()
  return kind === 'frontmatter-flow' && args.pinnedInCanvas !== true
}

export function shouldPreserveFrontmatterAutoManagedBalancedCollective(args: {
  graphData: GraphData | null | undefined
  posByNodeId: Record<string, { top: number; left: number }>
  pinnedByNodeId?: Record<string, boolean>
}): boolean {
  const graphData = args.graphData
  const kind = String((((graphData || null)?.metadata || {}) as Record<string, unknown>)?.kind || '').trim()
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
}): Record<string, { top: number; left: number }> {
  const graphData = args.graphData
  const kind = String((((graphData || null)?.metadata || {}) as Record<string, unknown>)?.kind || '').trim()
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

export function stripFrontmatterAutoManagedWidgetWorldPositions(args: {
  graphData: GraphData | null | undefined
  worldPosByNodeId: Record<string, { x: number; y: number }>
}): Record<string, { x: number; y: number }> {
  const graphData = args.graphData
  const kind = String((((graphData || null)?.metadata || {}) as Record<string, unknown>)?.kind || '').trim()
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
  const kind = String((((args.graphData || null)?.metadata || {}) as Record<string, unknown>)?.kind || '').trim()
  if (kind === 'frontmatter-flow') return false
  return args.carryForwardSameSourceUiState === true && args.stableSameSourceNodeLayout === true
}
